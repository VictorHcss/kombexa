/**
 * Recuperação de senha.
 * - A resposta é a mesma, exista o e-mail ou não (não revela quem tem conta).
 * - O link vale 30 minutos e uma única vez; o banco guarda só o hash do token.
 * - Pedir de novo invalida os links anteriores; redefinir encerra todas as sessões.
 */
import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { db, type Tx } from "@/db";
import { academies, passwordResets, sessions, users } from "@/db/schema";
import { hashPassword } from "@/lib/auth/password";
import { sendSafely } from "@/lib/email";
import { DomainError } from "@/lib/errors";
import { allow } from "@/lib/rate-limit";
import { audit } from "./audit";

export const RESET_MINUTES = 30;
/** Link de primeiro acesso (conta criada pela plataforma): mais tempo, porque a pessoa pode não ver o e-mail na hora. */
export const ACCESS_LINK_HOURS = 72;
const hash = (token: string) => createHash("sha256").update(token).digest("hex");

export async function requestPasswordReset(emailInput: string, baseUrl: string, ip = "local"): Promise<void> {
  const email = emailInput.trim().toLowerCase();
  // limite por e-mail e por conexão: evita usar o formulário para encher a caixa de alguém
  if (!allow(`reset:${email}`, 3, 60 * 60_000) || !allow(`reset-ip:${ip}`, 10, 60 * 60_000)) return;

  const [user] = await db.select({ id: users.id, name: users.name, email: users.email, academyId: users.academyId, active: users.active, academyActive: academies.active })
    .from(users).leftJoin(academies, eq(academies.id, users.academyId)).where(sql`lower(${users.email}) = ${email}`);
  if (!user || !user.active || user.academyActive === false) return; // mesma resposta de sempre, sem enviar nada

  const token = randomBytes(32).toString("base64url");
  await db.transaction(async (tx) => {
    await tx.update(passwordResets).set({ usedAt: new Date() }).where(and(eq(passwordResets.userId, user.id), isNull(passwordResets.usedAt)));
    await tx.insert(passwordResets).values({ userId: user.id, tokenHash: hash(token), expiresAt: new Date(Date.now() + RESET_MINUTES * 60_000) });
    await audit(tx, { userId: user.id, academyId: user.academyId }, "user.password_reset_requested", "user", user.id, `${user.name} pediu para redefinir a senha`);
  });

  await sendSafely({
    to: user.email,
    subject: "Redefinir sua senha no Kombexa",
    text: [
      `Olá, ${user.name.split(" ")[0]}!`,
      "",
      "Recebemos um pedido para redefinir a sua senha. Para criar uma nova, abra o link abaixo:",
      `${baseUrl}/redefinir-senha/${token}`,
      "",
      `O link vale por ${RESET_MINUTES} minutos e só pode ser usado uma vez.`,
      "Se não foi você, ignore este e-mail: a sua senha atual continua valendo.",
    ].join("\n"),
  });
}

/** Confere o link sem consumi-lo (para mostrar o formulário ou a mensagem de link inválido). */
export async function checkResetToken(token: string): Promise<boolean> {
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) return false;
  const [row] = await db.select({ id: passwordResets.id }).from(passwordResets)
    .where(and(eq(passwordResets.tokenHash, hash(token)), isNull(passwordResets.usedAt), gt(passwordResets.expiresAt, new Date())));
  return !!row;
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const invalid = new DomainError("Este link não é mais válido. Peça um novo em \"Esqueci minha senha\".");
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) throw invalid;
  const passwordHash = await hashPassword(newPassword);
  await db.transaction(async (tx) => {
    // trava o pedido: dois envios simultâneos do mesmo link não redefinem duas vezes
    const [row] = await tx.select().from(passwordResets).where(eq(passwordResets.tokenHash, hash(token))).for("update");
    if (!row || row.usedAt || row.expiresAt <= new Date()) throw invalid;
    const [user] = await tx.select().from(users).where(eq(users.id, row.userId));
    if (!user || !user.active) throw invalid;
    await tx.update(users).set({ passwordHash }).where(eq(users.id, user.id));
    await tx.update(passwordResets).set({ usedAt: new Date() }).where(eq(passwordResets.userId, user.id));
    await tx.delete(sessions).where(eq(sessions.userId, user.id)); // quem tinha a senha antiga sai de todos os aparelhos
    await audit(tx, { userId: user.id, academyId: user.academyId }, "user.password_reset", "user", user.id, `${user.name} redefiniu a senha pelo link de recuperação`);
  });
}

/**
 * Link de primeiro acesso: o mesmo mecanismo da recuperação de senha, com validade maior.
 * Invalida os links anteriores da conta. Devolve o token (só ele monta o link; o banco guarda o hash).
 */
export async function createAccessLink(tx: Tx, userId: string, hours = ACCESS_LINK_HOURS): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await tx.update(passwordResets).set({ usedAt: new Date() }).where(and(eq(passwordResets.userId, userId), isNull(passwordResets.usedAt)));
  await tx.insert(passwordResets).values({ userId, tokenHash: hash(token), expiresAt: new Date(Date.now() + hours * 3_600_000) });
  return token;
}
