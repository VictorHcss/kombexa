/**
 * Responsáveis legais. Um responsável é da academia e pode estar ligado a vários
 * alunos (irmãos). Cada aluno tem no máximo um responsável principal, que é o
 * contato para questões administrativas e financeiras.
 */
import { and, asc, eq, ilike, or, sql } from "drizzle-orm";
import { db, type Tx } from "@/db";
import { guardians, studentGuardians, students } from "@/db/schema";
import { DomainError, NotFoundError } from "@/lib/errors";
import { ageOn } from "@/lib/validation";
import { today } from "@/lib/dates";
import type { z } from "zod";
import type { guardianInput } from "@/lib/validation";
import { audit } from "./audit";
import type { AcademyContext } from "./context";

type GuardianData = z.output<typeof guardianInput>;

export const isMinor = (birthDate: string | null) => !!birthDate && ageOn(birthDate, today()) < 18;

export async function searchGuardians(ctx: AcademyContext, q: string) {
  const like = `%${q.trim().replace(/[%_\\]/g, "\\$&")}%`;
  const digits = q.replace(/\D/g, "");
  return db.select({
    id: guardians.id, name: guardians.name, phone: guardians.phone, email: guardians.email,
    children: sql<string>`(select string_agg(s.name, ', ' order by s.name) from student_guardians sg join students s on s.id = sg.student_id where sg.guardian_id = guardians.id)`,
  }).from(guardians)
    .where(and(eq(guardians.academyId, ctx.academyId), or(
      ilike(guardians.name, like),
      digits.length >= 3 ? sql`regexp_replace(${guardians.phone}, '\\D', '', 'g') like ${`%${digits}%`}` : undefined,
    ))).orderBy(asc(guardians.name)).limit(8);
}

export async function guardiansOf(ctx: Pick<AcademyContext, "academyId">, studentId: string) {
  return db.select({
    id: guardians.id, name: guardians.name, cpf: guardians.cpf, phone: guardians.phone, email: guardians.email,
    zip: guardians.zip, street: guardians.street, number: guardians.number, complement: guardians.complement,
    district: guardians.district, city: guardians.city, state: guardians.state,
    relationship: studentGuardians.relationship, isPrimary: studentGuardians.isPrimary, userId: guardians.userId,
  }).from(studentGuardians).innerJoin(guardians, eq(guardians.id, studentGuardians.guardianId))
    .where(and(eq(studentGuardians.studentId, studentId), eq(guardians.academyId, ctx.academyId)))
    .orderBy(sql`${studentGuardians.isPrimary} desc`, asc(guardians.name));
}

/** Liga um responsável (existente ou novo) ao aluno, dentro de uma transação já aberta. */
export async function attachGuardian(tx: Tx, ctx: AcademyContext, studentId: string, data: {
  guardianId: string | null; name: string | null; cpf: string | null; phone: string | null; email: string | null;
  relationship: string; isPrimary: boolean; address?: Partial<typeof guardians.$inferInsert>;
}) {
  let guardianId = data.guardianId;
  if (guardianId) {
    const [g] = await tx.select({ id: guardians.id }).from(guardians).where(and(eq(guardians.id, guardianId), eq(guardians.academyId, ctx.academyId)));
    if (!g) throw new DomainError("Responsável não encontrado nesta academia.", { guardianId: "Responsável inválido." });
  } else {
    if (!data.name || !data.phone) throw new DomainError("Informe nome e telefone do responsável.", { guardianName: data.name ? "" : "Informe o nome.", guardianPhone: data.phone ? "" : "Informe o telefone." });
    const [g] = await tx.insert(guardians).values({ academyId: ctx.academyId, name: data.name, cpf: data.cpf, phone: data.phone, email: data.email, ...data.address }).returning({ id: guardians.id });
    guardianId = g.id;
  }
  if (data.isPrimary) await tx.update(studentGuardians).set({ isPrimary: false }).where(eq(studentGuardians.studentId, studentId));
  await tx.insert(studentGuardians).values({ studentId, guardianId, relationship: data.relationship, isPrimary: data.isPrimary })
    .onConflictDoUpdate({ target: [studentGuardians.studentId, studentGuardians.guardianId], set: { relationship: data.relationship, isPrimary: data.isPrimary } });
  return guardianId;
}

async function ownStudent(tx: Tx, ctx: AcademyContext, studentId: string) {
  const [s] = await tx.select({ id: students.id, name: students.name, birthDate: students.birthDate }).from(students)
    .where(and(eq(students.id, studentId), eq(students.academyId, ctx.academyId)));
  if (!s) throw new NotFoundError("Aluno");
  return s;
}

/** Adicionar ou atualizar um responsável pelo perfil do aluno. */
export async function saveGuardian(ctx: AcademyContext, studentId: string, data: GuardianData) {
  return db.transaction(async (tx) => {
    const student = await ownStudent(tx, ctx, studentId);
    const address = { zip: data.zip, street: data.street, number: data.number, complement: data.complement, district: data.district, city: data.city, state: data.state };
    let guardianId = data.guardianId;
    if (guardianId) {
      const [g] = await tx.update(guardians).set({ name: data.name, cpf: data.cpf, phone: data.phone, email: data.email, ...address })
        .where(and(eq(guardians.id, guardianId), eq(guardians.academyId, ctx.academyId))).returning({ id: guardians.id });
      if (!g) throw new NotFoundError("Responsável");
    }
    const existing = await tx.select().from(studentGuardians).where(eq(studentGuardians.studentId, studentId));
    const isPrimary = data.isPrimary || existing.length === 0 || (existing.length === 1 && existing[0].guardianId === guardianId);
    guardianId = await attachGuardian(tx, ctx, studentId, { guardianId, name: data.name, cpf: data.cpf, phone: data.phone, email: data.email, relationship: data.relationship, isPrimary, address });
    await audit(tx, ctx, "guardian.saved", "student", studentId, `Responsável ${data.name} (${data.relationship}) ${data.guardianId ? "atualizado" : "adicionado"} para ${student.name}`);
    return guardianId;
  });
}

export async function setPrimaryGuardian(ctx: AcademyContext, studentId: string, guardianId: string) {
  return db.transaction(async (tx) => {
    const student = await ownStudent(tx, ctx, studentId);
    const [link] = await tx.select().from(studentGuardians).where(and(eq(studentGuardians.studentId, studentId), eq(studentGuardians.guardianId, guardianId)));
    if (!link) throw new NotFoundError("Responsável");
    await tx.update(studentGuardians).set({ isPrimary: false }).where(eq(studentGuardians.studentId, studentId));
    await tx.update(studentGuardians).set({ isPrimary: true }).where(and(eq(studentGuardians.studentId, studentId), eq(studentGuardians.guardianId, guardianId)));
    await audit(tx, ctx, "guardian.primary", "student", studentId, `Responsável principal de ${student.name} alterado`);
  });
}

/** Remove o vínculo. Um menor não pode ficar sem responsável principal. */
export async function removeGuardian(ctx: AcademyContext, studentId: string, guardianId: string) {
  return db.transaction(async (tx) => {
    const student = await ownStudent(tx, ctx, studentId);
    const links = await tx.select().from(studentGuardians).where(eq(studentGuardians.studentId, studentId));
    const link = links.find((l) => l.guardianId === guardianId);
    if (!link) throw new NotFoundError("Responsável");
    if (link.isPrimary && isMinor(student.birthDate)) {
      throw new DomainError("Aluno menor de idade precisa de um responsável principal. Defina outro como principal antes de remover este.");
    }
    await tx.delete(studentGuardians).where(and(eq(studentGuardians.studentId, studentId), eq(studentGuardians.guardianId, guardianId)));
    await audit(tx, ctx, "guardian.removed", "student", studentId, `Responsável removido de ${student.name}`);
  });
}

/** Contato de cobrança: o responsável principal, se houver; senão, o próprio aluno. */
export async function billingContact(ctx: AcademyContext, studentId: string) {
  const [primary] = (await guardiansOf(ctx, studentId)).filter((g) => g.isPrimary);
  return primary ? { name: primary.name, phone: primary.phone, isGuardian: true as const } : null;
}
