/**
 * Identidade visual de cada academia: a logo que vai nos documentos dela (ficha, recibo...).
 *
 * Duas marcas, dois papéis:
 * - Kombexa é o produto: aparece no sistema (login, menu, metadados) e, discreta, no rodapé dos
 *   documentos como "gerado pelo Kombexa".
 * - A logo da academia é a identidade do estabelecimento: encabeça os documentos dela.
 *
 * Isolamento: toda escrita usa ctx.academyId (vem da sessão, nunca do formulário). A leitura para
 * documentos só acontece depois que a página já conferiu o acesso ao documento, e sempre pela
 * academia dona do documento.
 */
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { academyLogos } from "@/db/schema";
import { DomainError } from "@/lib/errors";
import { ImageError, validateLogo, type ImageInfo } from "@/lib/image";
import { audit } from "./audit";
import type { AcademyContext } from "./context";

/**
 * Onde as logos ficam. Hoje: no PostgreSQL (tabela academy_logos). Funciona em qualquer hospedagem,
 * inclusive com disco efêmero, e entra no backup do banco. Para mover para um armazenamento de
 * objetos (S3, R2, GCS), implemente esta interface e escolha pelo LOGO_STORAGE (ver docs/instalacao.md).
 */
interface LogoStore {
  put(academyId: string, file: { bytes: Buffer; info: ImageInfo; sha256: string; uploadedBy: string }): Promise<void>;
  get(academyId: string): Promise<{ bytes: Buffer; mime: string; updatedAt: Date; width: number; height: number; sizeBytes: number } | null>;
  remove(academyId: string): Promise<boolean>;
}

const databaseStore: LogoStore = {
  async put(academyId, f) {
    const row = { mime: f.info.mime, data: f.bytes, sizeBytes: f.bytes.length, width: f.info.width, height: f.info.height, sha256: f.sha256, uploadedBy: f.uploadedBy, updatedAt: new Date() };
    await db.insert(academyLogos).values({ academyId, ...row }).onConflictDoUpdate({ target: academyLogos.academyId, set: row });
  },
  async get(academyId) {
    const [r] = await db.select().from(academyLogos).where(eq(academyLogos.academyId, academyId));
    // registro vazio (ex.: gravado fora do sistema) conta como "sem logo": o documento usa o nome
    return r && r.data.length > 0 ? { bytes: r.data, mime: r.mime, updatedAt: r.updatedAt, width: r.width, height: r.height, sizeBytes: r.sizeBytes } : null;
  },
  async remove(academyId) {
    const gone = await db.delete(academyLogos).where(eq(academyLogos.academyId, academyId)).returning({ id: academyLogos.academyId });
    return gone.length > 0;
  },
};

function store(): LogoStore {
  const driver = (process.env.LOGO_STORAGE || "database").toLowerCase();
  if (driver !== "database") throw new Error(`LOGO_STORAGE=${driver} não está implementado. Use "database" (padrão).`);
  return databaseStore;
}

/** Envia ou substitui a logo da academia do contexto. */
export async function saveAcademyLogo(ctx: AcademyContext, bytes: Uint8Array) {
  let info: ImageInfo;
  try {
    info = validateLogo(bytes);
  } catch (error) {
    if (error instanceof ImageError) throw new DomainError(error.message, { logo: error.message });
    throw error;
  }
  const buf = Buffer.from(bytes);
  const sha256 = createHash("sha256").update(buf).digest("hex");
  const replaced = !!(await store().get(ctx.academyId));
  await store().put(ctx.academyId, { bytes: buf, info, sha256, uploadedBy: ctx.userId });
  await db.transaction((tx) => audit(tx, ctx, replaced ? "academy.logo_replaced" : "academy.logo_added", "academy", ctx.academyId,
    replaced ? "Logo da academia substituída" : "Logo da academia adicionada",
    { mime: info.mime, width: info.width, height: info.height, bytes: buf.length, sha256 })); // nunca o conteúdo
  return info;
}

export async function removeAcademyLogo(ctx: AcademyContext) {
  const removed = await store().remove(ctx.academyId);
  if (!removed) throw new DomainError("A academia não tem logo cadastrada.");
  await db.transaction((tx) => audit(tx, ctx, "academy.logo_removed", "academy", ctx.academyId, "Logo da academia removida"));
}

/** Logo como data: URL (imprime junto com a página, sem rota pública). null = sem logo. */
export async function academyLogoDataUrl(academyId: string): Promise<string | null> {
  const logo = await store().get(academyId);
  return logo ? `data:${logo.mime};base64,${logo.bytes.toString("base64")}` : null;
}

/** Logo da academia do contexto, com detalhes para a tela de configuração. */
export async function ownAcademyLogo(ctx: AcademyContext) {
  const logo = await store().get(ctx.academyId);
  if (!logo) return null;
  return { src: `data:${logo.mime};base64,${logo.bytes.toString("base64")}`, mime: logo.mime, width: logo.width, height: logo.height, sizeBytes: logo.sizeBytes, updatedAt: logo.updatedAt };
}
