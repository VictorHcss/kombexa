/**
 * Convites de entrada. O QR Code leva só o token, que é aleatório (144 bits) e não
 * identifica academia nem pessoa: quem descobre a academia é o servidor.
 */
import { randomBytes } from "node:crypto";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db, type Tx } from "@/db";
import { academies, invites, type Invite } from "@/db/schema";
import { mailer, sendSafely } from "@/lib/email";
import { DomainError } from "@/lib/errors";
import { allow } from "@/lib/rate-limit";
import { audit } from "./audit";
import type { AcademyContext } from "./context";

export const newToken = () => randomBytes(18).toString("base64url");

/** Um convite está válido se não foi revogado, não venceu e não atingiu o limite de usos. */
export function inviteIsUsable(invite: Pick<Invite, "revokedAt" | "expiresAt" | "maxUses" | "usesCount">, now = new Date()): boolean {
  if (invite.revokedAt) return false;
  if (invite.expiresAt && invite.expiresAt <= now) return false;
  if (invite.maxUses !== null && invite.usesCount >= invite.maxUses) return false;
  return true;
}

/** O convite geral atual da academia; cria um na primeira vez. */
export async function currentInvite(ctx: AcademyContext): Promise<Invite> {
  const [existing] = await db.select().from(invites)
    .where(and(eq(invites.academyId, ctx.academyId), isNull(invites.revokedAt))).orderBy(desc(invites.createdAt)).limit(1);
  if (existing && inviteIsUsable(existing)) return existing;
  return db.transaction(async (tx) => createInvite(tx, ctx));
}

async function createInvite(tx: Tx, ctx: AcademyContext) {
  const [invite] = await tx.insert(invites).values({ academyId: ctx.academyId, token: newToken(), createdBy: ctx.userId }).returning();
  await audit(tx, ctx, "invite.created", "invite", invite.id, "Código de convite gerado");
  return invite;
}

/** Revoga o convite atual (o QR antigo para de funcionar) e gera um novo. */
export async function regenerateInvite(ctx: AcademyContext): Promise<Invite> {
  return db.transaction(async (tx) => {
    await tx.update(invites).set({ revokedAt: new Date() }).where(and(eq(invites.academyId, ctx.academyId), isNull(invites.revokedAt)));
    await audit(tx, ctx, "invite.revoked", "invite", null, "Códigos de convite anteriores revogados");
    return createInvite(tx, ctx);
  });
}

/** Página pública do convite: descobre a academia pelo token. Não revela nada se o token for inválido. */
export async function resolveInvite(token: string) {
  if (!/^[A-Za-z0-9_-]{16,40}$/.test(token)) return null;
  const [row] = await db.select({ invite: invites, academyName: academies.name, academyActive: academies.active })
    .from(invites).innerJoin(academies, eq(academies.id, invites.academyId)).where(eq(invites.token, token));
  if (!row || !row.academyActive || !inviteIsUsable(row.invite)) return null;
  return { inviteId: row.invite.id, academyId: row.invite.academyId, academyName: row.academyName };
}

/** Conta um uso, travando a linha para o limite de usos valer mesmo com cadastros simultâneos. */
export async function consumeInvite(tx: Tx, token: string) {
  const [invite] = await tx.select().from(invites).where(eq(invites.token, token)).for("update");
  if (!invite || !inviteIsUsable(invite)) return null;
  await tx.update(invites).set({ usesCount: sql`${invites.usesCount} + 1` }).where(eq(invites.id, invite.id));
  return invite;
}

/**
 * Envia o link do convite atual para um e-mail. Não cria conta nem pedido: a pessoa abre o
 * link, cria a conta e o pedido chega em Solicitações, como pelo QR Code.
 * Limite por academia, para o formulário não virar envio em massa.
 */
export async function sendInviteEmail(ctx: AcademyContext, email: string, baseUrl: string) {
  // em produção sem e-mail configurado, "enviado" seria mentira: melhor avisar e usar o WhatsApp
  if (mailer().name === "console" && process.env.NODE_ENV === "production") throw new DomainError("O envio de e-mails ainda não foi configurado no sistema. Envie o link pelo WhatsApp ou mostre o QR Code.");
  if (!allow(`invite-email:${ctx.academyId}`, 30, 60 * 60_000)) throw new DomainError("Limite de convites por e-mail atingido. Tente de novo em uma hora.");
  const invite = await currentInvite(ctx);
  const [academy] = await db.select({ name: academies.name }).from(academies).where(eq(academies.id, ctx.academyId));
  const link = `${baseUrl}/convite/${invite.token}`;
  const sent = await sendSafely({
    to: email,
    subject: `Convite da ${academy.name}`,
    text: [
      "Olá!",
      "",
      `A ${academy.name} convidou você para acompanhar suas mensalidades e pagamentos pelo Kombexa.`,
      "Crie sua conta neste link (leva um minuto):",
      link,
      "",
      "Depois que a recepção aprovar a sua entrada, você vê suas mensalidades, pagamentos e recibos.",
      "Se você não esperava este convite, ignore este e-mail.",
    ].join("\n"),
  });
  if (!sent) throw new DomainError("Não foi possível enviar o e-mail agora. Confira a configuração de e-mail ou envie o link pelo WhatsApp.");
  await db.transaction((tx) => audit(tx, ctx, "invite.emailed", "invite", invite.id, `Convite enviado por e-mail para ${email}`));
}
