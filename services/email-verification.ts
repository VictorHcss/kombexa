/**
 * Confirmação de e-mail das contas de aluno criadas pelo próprio aluno.
 * - O link vale 48 horas e uma vez; o banco guarda só o hash do token.
 * - Pedir de novo invalida os links anteriores (e tem limite, para não encher a caixa de ninguém).
 * - A conta funciona antes de confirmar; a academia vê "e-mail não confirmado" no pedido.
 */
import { createHash, randomBytes } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { emailVerifications, users } from "@/db/schema";
import { sendSafely } from "@/lib/email";
import { DomainError } from "@/lib/errors";
import { allow } from "@/lib/rate-limit";
import { audit } from "./audit";

export const VERIFY_HOURS = 48;
const hash = (token: string) => createHash("sha256").update(token).digest("hex");

/** Gera um novo link e envia. Devolve false se a conta já está confirmada ou passou do limite de envios. */
export async function sendEmailVerification(userId: string, baseUrl: string): Promise<boolean> {
  const [user] = await db.select({ id: users.id, name: users.name, email: users.email, verifiedAt: users.emailVerifiedAt }).from(users).where(eq(users.id, userId));
  if (!user || user.verifiedAt) return false;
  if (!allow(`verify:${user.id}`, 5, 60 * 60_000)) return false;
  const token = randomBytes(32).toString("base64url");
  await db.transaction(async (tx) => {
    await tx.update(emailVerifications).set({ usedAt: new Date() }).where(and(eq(emailVerifications.userId, user.id), isNull(emailVerifications.usedAt)));
    await tx.insert(emailVerifications).values({ userId: user.id, tokenHash: hash(token), expiresAt: new Date(Date.now() + VERIFY_HOURS * 3_600_000) });
  });
  await sendSafely({
    to: user.email,
    subject: "Confirme seu e-mail no Kombexa",
    text: [
      `Olá, ${user.name.split(" ")[0]}!`,
      "",
      "Para confirmar que este e-mail é seu, abra o link abaixo:",
      `${baseUrl}/confirmar-email/${token}`,
      "",
      `O link vale por ${VERIFY_HOURS} horas. Se você não criou uma conta, ignore este e-mail.`,
    ].join("\n"),
  });
  return true;
}

/** Confirma pelo link. Usar o mesmo link de novo depois de confirmado não é erro. */
export async function confirmEmail(token: string): Promise<{ name: string }> {
  const invalid = new DomainError("Este link de confirmação não é mais válido. Entre na sua conta e peça um novo.");
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) throw invalid;
  return db.transaction(async (tx) => {
    const [row] = await tx.select().from(emailVerifications).where(eq(emailVerifications.tokenHash, hash(token))).for("update");
    if (!row) throw invalid;
    const [user] = await tx.select().from(users).where(eq(users.id, row.userId));
    if (!user || !user.active) throw invalid;
    if (user.emailVerifiedAt) return { name: user.name };
    if (row.usedAt || row.expiresAt <= new Date()) throw invalid;
    await tx.update(users).set({ emailVerifiedAt: new Date() }).where(eq(users.id, user.id));
    await tx.update(emailVerifications).set({ usedAt: new Date() }).where(eq(emailVerifications.userId, user.id));
    await audit(tx, { userId: user.id, academyId: user.academyId }, "user.email_verified", "user", user.id, `${user.name} confirmou o e-mail`);
    return { name: user.name };
  });
}

export async function isEmailVerified(userId: string): Promise<boolean> {
  const [u] = await db.select({ at: users.emailVerifiedAt }).from(users).where(eq(users.id, userId));
  return !!u?.at;
}
