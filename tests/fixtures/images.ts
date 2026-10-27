// Imagens mínimas, mas válidas, montadas byte a byte (sem depender de arquivos binários no repositório).
import { crc32, deflateSync } from "node:zlib";

const chunk = (type: string, data: Buffer) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body) >>> 0);
  return Buffer.concat([len, body, crc]);
};

/** PNG RGB de verdade (abre em qualquer visualizador). */
export function png(width: number, height: number): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8 bits, RGB
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(width * 3, 0xff)]);
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

/** JPEG com SOI, um APP0, SOF0 (tamanho) e EOI: suficiente para o leitor de cabeçalho. */
export function jpeg(width: number, height: number): Buffer {
  const app0 = Buffer.from([0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00]);
  const sof = Buffer.from([0xff, 0xc0, 0x00, 0x11, 0x08, height >> 8, height & 255, width >> 8, width & 255, 0x03, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1]);
  return Buffer.concat([Buffer.from([0xff, 0xd8]), app0, sof, Buffer.alloc(40), Buffer.from([0xff, 0xd9])]);
}

/** WebP com bloco VP8X (tamanho no cabeçalho estendido). */
export function webp(width: number, height: number): Buffer {
  const vp8x = Buffer.alloc(10);
  vp8x.writeUIntLE(width - 1, 4, 3); vp8x.writeUIntLE(height - 1, 7, 3);
  const body = Buffer.concat([Buffer.from("WEBP"), Buffer.from("VP8X"), Buffer.from([10, 0, 0, 0]), vp8x, Buffer.alloc(8)]);
  const size = Buffer.alloc(4); size.writeUInt32LE(body.length);
  return Buffer.concat([Buffer.from("RIFF"), size, body]);
}
