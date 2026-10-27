/**
 * Conta do responsável. A academia dá acesso a um responsável que tem e-mail: o sistema cria
 * (ou reaproveita) uma conta de perfil STUDENT e manda o link para criar a senha. Na área dele
 * aparecem os dependentes, com a mesma visão de situação, mensalidades, Pix e recibos.
 */
import { randomBytes } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { academies, guardians, studentGuardians, students, users } from "@/db/schema";
import { hashPassword } from "@/lib/auth/password";
import { sendSafely } from "@/lib/email";
import { DomainError, NotFoundError } from "@/lib/errors";
import { audit } from "./audit";
import type { AcademyContext } from "./context";
import { ACCESS_LINK_HOURS, createAccessLink } from "./password-reset";

export async function grantGuardianAccess(ctx: AcademyContext, guardianId: string, baseUrl: string) {
  const [g] = await db.select().from(guardians).where(and(eq(guardians.id, guardianId), eq(guardians.academyId, ctx.academyId)));
  if (!g) throw new NotFoundError("Responsável");
  if (!g.email) throw new DomainError("Cadastre o e-mail do responsável antes de dar acesso.");
  const email = g.email.toLowerCase();
  const [academy] = await db.select({ name: academies.name }).from(academies).where(eq(academies.id, ctx.academyId));

  const { userId, token, created } = await db.transaction(async (tx) => {
    const [existing] = await tx.select().from(users).where(sql`lower(${users.email}) = ${email}`);
    if (existing && existing.role !== "STUDENT") throw new DomainError("Esse e-mail já é usado por uma conta da equipe. Use outro e-mail para o responsável.");
    let id = existing?.id;
    if (!id) {
      const [u] = await tx.insert(users).values({
        academyId: null, role: "STUDENT", name: g.name, email, phone: g.phone, emailVerifiedAt: new Date(), // e-mail informado pela academia; o link chega nele
        passwordHash: await hashPassword(randomBytes(24).toString("base64url")),
      }).returning({ id: users.id });
      id = u.id;
    }
    await tx.update(guardians).set({ userId: id }).where(eq(guardians.id, g.id));
    await audit(tx, ctx, "guardian.access_granted", "guardian", g.id, `Acesso à área do responsável liberado para ${g.name}`);
    // conta nova: link para criar a senha; conta que já existia: só avisa (a pessoa já tem senha)
    return { userId: id, token: existing ? null : await createAccessLink(tx, id), created: !existing };
  });

  const link = token ? `${baseUrl}/redefinir-senha/${token}` : `${baseUrl}/login`;
  const sent = await sendSafely({
    to: email,
    subject: `Acesso à área do responsável: ${academy?.name ?? "academia"}`,
    text: [
      `Olá, ${g.name.split(" ")[0]}!`,
      "",
      `A ${academy?.name ?? "academia"} liberou para você a área do responsável no Kombexa: situação, mensalidades, Pix e recibos dos seus dependentes.`,
      "",
      created ? `Para criar a sua senha, abra o link abaixo (vale por ${ACCESS_LINK_HOURS / 24} dias e só funciona uma vez):` : "Entre com o seu e-mail e a senha que você já usa:",
      link,
    ].join("\n"),
  });
  return { userId, link, sent, created, email };
}

export async function revokeGuardianAccess(ctx: AcademyContext, guardianId: string) {
  await db.transaction(async (tx) => {
    const [g] = await tx.update(guardians).set({ userId: null }).where(and(eq(guardians.id, guardianId), eq(guardians.academyId, ctx.academyId))).returning({ id: guardians.id, name: guardians.name });
    if (!g) throw new NotFoundError("Responsável");
    await audit(tx, ctx, "guardian.access_revoked", "guardian", g.id, `Acesso à área do responsável removido de ${g.name}`);
  });
}

/** Dependentes ativos de uma conta, em academias ativas. */
export async function dependentsOf(userId: string) {
  return db.selectDistinct({ id: students.id, name: students.name, academyName: academies.name })
    .from(guardians)
    .innerJoin(studentGuardians, eq(studentGuardians.guardianId, guardians.id))
    .innerJoin(students, eq(students.id, studentGuardians.studentId))
    .innerJoin(academies, eq(academies.id, students.academyId))
    .where(and(eq(guardians.userId, userId), eq(students.status, "active"), eq(academies.active, true)))
    .orderBy(students.name);
}

/** Condição SQL: o aluno pertence à conta (é o próprio) ou a conta é responsável por ele. */
export const ownsOrGuards = (userId: string) => sql`(${students.userId} = ${userId} or exists (
  select 1 from student_guardians sg join guardians g on g.id = sg.guardian_id
  where sg.student_id = ${students.id} and g.user_id = ${userId}))`;
