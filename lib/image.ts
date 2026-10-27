/**
 * Validação de imagens pelo CONTEÚDO do arquivo, não pela extensão nem pelo tipo que o navegador
 * informa (ambos são controlados por quem envia). Lê a assinatura binária e as dimensões direto
 * dos cabeçalhos de PNG, JPEG e WebP, sem dependências nativas.
 *
 * SVG não é aceito: é XML que pode carregar scripts e referências externas, e um tratamento
 * seguro exigiria um sanitizador dedicado. Para documentos impressos, PNG/WebP cobrem o caso.
 */

export type ImageMime = "image/png" | "image/jpeg" | "image/webp";

export const LOGO_MAX_BYTES = 1024 * 1024; // 1 MB
export const LOGO_MIN_SIDE = 32;
export const LOGO_MAX_SIDE = 4000;
export const LOGO_ACCEPT = "image/png,image/jpeg,image/webp";
export const LOGO_RULES = "PNG, JPEG ou WebP, até 1 MB, entre 32 e 4000 pixels de lado. Prefira fundo transparente (PNG).";

export interface ImageInfo { mime: ImageMime; width: number; height: number }

export class ImageError extends Error {}

const startsWith = (b: Uint8Array, sig: number[], offset = 0) => sig.every((v, i) => b[offset + i] === v);
const u16be = (b: Uint8Array, o: number) => (b[o] << 8) | b[o + 1];
const u32be = (b: Uint8Array, o: number) => ((b[o] << 24) >>> 0) + (b[o + 1] << 16) + (b[o + 2] << 8) + b[o + 3];
const u16le = (b: Uint8Array, o: number) => b[o] | (b[o + 1] << 8);
const u24le = (b: Uint8Array, o: number) => b[o] | (b[o + 1] << 8) | (b[o + 2] << 16);

function png(b: Uint8Array): ImageInfo | null {
  if (!startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return null;
  // primeiro bloco precisa ser IHDR (13 bytes) e o arquivo precisa terminar com IEND
  if (b.length < 45 || !startsWith(b, [0x49, 0x48, 0x44, 0x52], 12)) throw new ImageError("Arquivo PNG corrompido.");
  if (!startsWith(b, [0x49, 0x45, 0x4e, 0x44], b.length - 8)) throw new ImageError("Arquivo PNG incompleto ou corrompido.");
  return { mime: "image/png", width: u32be(b, 16), height: u32be(b, 20) };
}

function jpeg(b: Uint8Array): ImageInfo | null {
  if (!startsWith(b, [0xff, 0xd8, 0xff])) return null;
  if (!(b[b.length - 2] === 0xff && b[b.length - 1] === 0xd9)) throw new ImageError("Arquivo JPEG incompleto ou corrompido.");
  let o = 2;
  while (o + 9 < b.length) {
    if (b[o] !== 0xff) throw new ImageError("Arquivo JPEG corrompido.");
    const marker = b[o + 1];
    if (marker === 0xff) { o++; continue; } // preenchimento
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) { o += 2; continue; }
    const len = u16be(b, o + 2);
    if (len < 2) throw new ImageError("Arquivo JPEG corrompido.");
    // SOF0..SOF15, exceto DHT (C4), JPG (C8) e DAC (CC): trazem altura e largura
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { mime: "image/jpeg", height: u16be(b, o + 5), width: u16be(b, o + 7) };
    }
    if (marker === 0xda) break; // começou a imagem sem achar o tamanho
    o += 2 + len;
  }
  throw new ImageError("Não foi possível ler o tamanho do JPEG.");
}

function webp(b: Uint8Array): ImageInfo | null {
  if (!(startsWith(b, [0x52, 0x49, 0x46, 0x46]) && startsWith(b, [0x57, 0x45, 0x42, 0x50], 8))) return null;
  if (b.length < 30) throw new ImageError("Arquivo WebP corrompido.");
  const riffSize = b[4] | (b[5] << 8) | (b[6] << 16) | ((b[7] << 24) >>> 0);
  if (riffSize + 8 > b.length) throw new ImageError("Arquivo WebP incompleto.");
  const chunk = String.fromCharCode(b[12], b[13], b[14], b[15]);
  if (chunk === "VP8 ") {
    if (!startsWith(b, [0x9d, 0x01, 0x2a], 23)) throw new ImageError("Arquivo WebP corrompido.");
    return { mime: "image/webp", width: u16le(b, 26) & 0x3fff, height: u16le(b, 28) & 0x3fff };
  }
  if (chunk === "VP8L") {
    if (b[20] !== 0x2f) throw new ImageError("Arquivo WebP corrompido.");
    const bits = b[21] | (b[22] << 8) | (b[23] << 16) | ((b[24] << 24) >>> 0);
    return { mime: "image/webp", width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
  }
  if (chunk === "VP8X") return { mime: "image/webp", width: u24le(b, 24) + 1, height: u24le(b, 27) + 1 };
  throw new ImageError("Formato WebP não reconhecido.");
}

/** Identifica a imagem pelo conteúdo. Lança ImageError com mensagem pronta para o usuário. */
export function inspectImage(bytes: Uint8Array): ImageInfo {
  if (bytes.length === 0) throw new ImageError("Escolha um arquivo de imagem.");
  const head = new TextDecoder().decode(bytes.subarray(0, 256)).trimStart().toLowerCase();
  if (head.startsWith("<svg") || head.startsWith("<?xml") || head.includes("<svg")) {
    throw new ImageError("SVG não é aceito por segurança. Envie a logo em PNG, JPEG ou WebP.");
  }
  const info = png(bytes) ?? jpeg(bytes) ?? webp(bytes);
  if (!info) throw new ImageError("O arquivo não é uma imagem PNG, JPEG ou WebP válida.");
  return info;
}

/** Regras da logo: conteúdo, tamanho do arquivo e dimensões. */
export function validateLogo(bytes: Uint8Array): ImageInfo {
  if (bytes.length > LOGO_MAX_BYTES) throw new ImageError("A imagem passa de 1 MB. Reduza o tamanho e tente de novo.");
  const info = inspectImage(bytes);
  const { width, height } = info;
  if (!width || !height || width < LOGO_MIN_SIDE || height < LOGO_MIN_SIDE) throw new ImageError(`A imagem é pequena demais (mínimo ${LOGO_MIN_SIDE}×${LOGO_MIN_SIDE} pixels).`);
  if (width > LOGO_MAX_SIDE || height > LOGO_MAX_SIDE) throw new ImageError(`A imagem é grande demais (máximo ${LOGO_MAX_SIDE} pixels de lado).`);
  return info;
}
