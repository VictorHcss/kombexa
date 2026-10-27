/**
 * Contas criadas fora do convite:
 *   - aluno pela tela "Criar conta": conta STUDENT sem academia, até uma academia adicioná-lo;
 *   - academia pelo administrador da plataforma: academia + primeiro ACADEMY_ADMIN, que
 *     define a própria senha pelo link enviado ao e-mail informado.
 */
import { randomBytes } from "node:crypto";
import { sql } from "drizzle-orm";
import type { z } from "zod";
import { db } from "@/db";
import { academies, users } from "@/db/schema";
import { hashPassword } from "@/lib/auth/password";
import { accountConsentText } from "@/lib/consent";
import { mailer, sendSafely } from "@/lib/email";
import { DomainError, isUniqueViolation } from "@/lib/errors";
import type { platformAcademyInput, studentAccountInput } from "@/lib/validation";
import { audit } from "./audit";
import type { PlatformContext } from "./context";
import { ACCESS_LINK_HOURS, createAccessLink } from "./password-reset";

const emailTaken = (field: string) => new DomainError("Já existe uma conta com este e-mail.", { [field]: "E-mail já cadastrado." });

async function assertEmailFree(email: string, field: string) {
  const [taken] = await db.select({ id: users.id }).from(users).where(sql`lower(${users.email}) = ${email}`);
  if (taken) throw emailTaken(field);
}

/** Aluno cria a conta sozinho. Ela nasce sem academia: a área do aluno explica como ser adicionado. */
export async function signUpStudent(data: z.output<typeof studentAccountInput>) {
  await assertEmailFree(data.email, "email");
  const passwordHash = await hashPassword(data.password);
  try {
    return await db.transaction(async (tx) => {
      const [user] = await tx.insert(users).values({
        academyId: null, role: "STUDENT", name: data.name, email: data.email, phone: data.phone, birthDate: data.birthDate, passwordHash,
        dataConsentAt: new Date(), dataConsentText: accountConsentText(),
      }).returning({ id: users.id });
      await audit(tx, { userId: user.id, academyId: null }, "user.signed_up", "user", user.id, `${data.name} criou uma conta de aluno`);
      return { userId: user.id };
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw emailTaken("email");
    throw error;
  }
}

/**
 * Plataforma cria a academia e o responsável. A senha inicial é aleatória e ninguém a conhece:
 * o responsável entra pelo link de acesso (válido por ACCESS_LINK_HOURS horas), que também é
 * devolvido aqui para a plataforma copiar se o e-mail não chegar.
 */
export async function createAcademyWithAdmin(ctx: PlatformContext, data: z.output<typeof platformAcademyInput>, baseUrl: string) {
  await assertEmailFree(data.adminEmail, "adminEmail");
  const passwordHash = await hashPassword(randomBytes(24).toString("base64url"));
  let created: { academyId: string; userId: string; token: string };
  try {
    created = await db.transaction(async (tx) => {
      const [academy] = await tx.insert(academies).values({ name: data.academyName, email: data.adminEmail }).returning({ id: academies.id });
      const [user] = await tx.insert(users).values({ academyId: academy.id, role: "ACADEMY_ADMIN", name: data.adminName, email: data.adminEmail, passwordHash }).returning({ id: users.id });
      const token = await createAccessLink(tx, user.id);
      await audit(tx, { userId: ctx.userId, academyId: academy.id }, "academy.created", "academy", academy.id, `Academia ${data.academyName} criada pela plataforma, responsável ${data.adminName}`);
      return { academyId: academy.id, userId: user.id, token };
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw emailTaken("adminEmail");
    throw error;
  }
  const link = `${baseUrl}/redefinir-senha/${created.token}`;
  const sent = await deliver(welcomeEmail(data.adminEmail, data.adminName, data.academyName, link));
  return { ...created, link, sent };
}

/** Novo link de acesso para o responsável da academia (o anterior deixa de valer). */
export async function resendAdminAccess(ctx: PlatformContext, academyId: string, baseUrl: string) {
  const [row] = await db.select({ userId: users.id, name: users.name, email: users.email, academy: academies.name })
    .from(users).innerJoin(academies, sql`${academies.id} = ${users.academyId}`)
    .where(sql`${users.academyId} = ${academyId} and ${users.role} = 'ACADEMY_ADMIN' and ${users.active}`)
    .orderBy(users.createdAt).limit(1);
  if (!row) throw new DomainError("Esta academia não tem administrador ativo.");
  const token = await db.transaction(async (tx) => {
    const t = await createAccessLink(tx, row.userId);
    await audit(tx, { userId: ctx.userId, academyId }, "academy.access_link", "user", row.userId, `Novo link de acesso enviado para ${row.email}`);
    return t;
  });
  const link = `${baseUrl}/redefinir-senha/${token}`;
  const sent = await deliver(welcomeEmail(row.email, row.name, row.academy, link));
  return { email: row.email, link, sent };
}

/** Enviado de verdade? No modo console o e-mail só vai para o log: a tela mostra o link para copiar. */
async function deliver(message: Parameters<typeof sendSafely>[0]) {
  const ok = await sendSafely(message);
  return ok && mailer().name !== "console";
}

function welcomeEmail(to: string, name: string, academy: string, link: string) {
  const first = name.split(" ")[0];
  return {
    to,
    subject: `Acesso da ${academy} no Kombexa`,
    text: [
      `Olá, ${first}!`,
      "",
      `A conta da ${academy} no Kombexa está pronta. Para entrar pela primeira vez, crie a sua senha neste link:`,
      link,
      "",
      `O link vale por ${ACCESS_LINK_HOURS / 24} dias e só pode ser usado uma vez. Depois, entre com este e-mail (${to}) e a senha que você criou.`,
      "No primeiro acesso, o Início mostra o que falta configurar: dados da academia, modalidades e termos da ficha. Em \"Convidar alunos\" você encontra o QR Code para os alunos pedirem para entrar.",
      "",
      "Se você não esperava este e-mail, ignore-o.",
    ].join("\n"),
  };
}
