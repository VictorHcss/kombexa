import { and, asc, desc, eq, getTableColumns, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { fees, modalities, payments, students, type Student } from "@/db/schema";
import { todayIn } from "@/lib/dates";
import { DomainError, NotFoundError } from "@/lib/errors";
import type { z } from "zod";
import type { studentInput } from "@/lib/validation";
import { assertModality } from "./academy";
import { audit } from "./audit";
import { attachGuardian, isMinor } from "./guardians";
import type { AcademyContext } from "./context";

type StudentData = z.output<typeof studentInput>;

const toRow = (d: StudentData) => ({
  name: d.name, phone: d.phone, email: d.email, birthDate: d.birthDate, cpf: d.cpf, modalityId: d.modalityId, joinedAt: d.joinedAt,
  status: d.status, monthlyFeeCents: d.monthlyFee, dueDay: d.dueDay, notes: d.notes,
  zip: d.zip, street: d.street, number: d.number, complement: d.complement, district: d.district, city: d.city, state: d.state,
  emergencyName: d.emergencyName, emergencyPhone: d.emergencyPhone, emergencyRelation: d.emergencyRelation, imageConsent: d.imageConsent,
});

/** Menor de idade só é salvo com responsável principal: o informado agora ou um já ligado. */
async function ensureGuardian(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], ctx: AcademyContext, studentId: string, d: StudentData, hasPrimary: boolean) {
  const informed = !!(d.guardianId || d.guardianName || d.guardianPhone);
  if (!isMinor(d.birthDate)) {
    if (informed) await attachGuardian(tx, ctx, studentId, { guardianId: d.guardianId, name: d.guardianName, cpf: d.guardianCpf, phone: d.guardianPhone, email: d.guardianEmail, relationship: d.guardianRelationship ?? "Responsável", isPrimary: !hasPrimary });
    return;
  }
  if (!informed && hasPrimary) return;
  if (!informed) throw new DomainError("Aluno menor de idade precisa de um responsável.", { guardianName: "Informe o responsável ou escolha um já cadastrado." });
  if (!d.guardianRelationship) throw new DomainError("Informe o parentesco do responsável.", { guardianRelationship: "Informe o parentesco." });
  await attachGuardian(tx, ctx, studentId, { guardianId: d.guardianId, name: d.guardianName, cpf: d.guardianCpf, phone: d.guardianPhone, email: d.guardianEmail, relationship: d.guardianRelationship, isPrimary: true });
}

const consentTime = (value: boolean | null, before?: Student) =>
  value === null ? null : before && before.imageConsent === value ? before.imageConsentAt : new Date();

export async function createStudent(ctx: AcademyContext, data: StudentData): Promise<Student> {
  await assertModality(ctx, data.modalityId);
  return db.transaction(async (tx) => {
    const [student] = await tx.insert(students).values({ academyId: ctx.academyId, ...toRow(data), imageConsentAt: consentTime(data.imageConsent) }).returning();
    await ensureGuardian(tx, ctx, student.id, data, false);
    await audit(tx, ctx, "student.created", "student", student.id, `Aluno cadastrado: ${student.name}`);
    return student;
  });
}

export async function updateStudent(ctx: AcademyContext, id: string, data: StudentData): Promise<Student> {
  return db.transaction(async (tx) => {
    const [before] = await tx.select().from(students).where(and(eq(students.id, id), eq(students.academyId, ctx.academyId)));
    if (!before) throw new NotFoundError("Aluno");
    await assertModality(ctx, data.modalityId, { allowInactive: data.modalityId === before.modalityId });
    const [student] = await tx.update(students).set({ ...toRow(data), imageConsentAt: consentTime(data.imageConsent, before) })
      .where(and(eq(students.id, id), eq(students.academyId, ctx.academyId))).returning();
    const [primary] = await tx.select({ n: sql<number>`count(*)::int` }).from(sql`student_guardians`).where(sql`student_id = ${id} and is_primary`);
    await ensureGuardian(tx, ctx, id, data, primary.n > 0);
    const changed = Object.keys(toRow(data)).filter((k) => String(before[k as keyof Student]) !== String(student[k as keyof Student]));
    if (changed.length) await audit(tx, ctx, "student.updated", "student", id, `Cadastro de ${student.name} alterado`, { fields: changed });
    return student;
  });
}

export async function setStudentStatus(ctx: AcademyContext, id: string, status: "active" | "inactive") {
  return db.transaction(async (tx) => {
    const [student] = await tx.update(students).set({ status }).where(and(eq(students.id, id), eq(students.academyId, ctx.academyId))).returning();
    if (!student) throw new NotFoundError("Aluno");
    await audit(tx, ctx, "student.status", "student", id, `${student.name} marcado como ${status === "active" ? "ativo" : "inativo"}`);
    return student;
  });
}

const { healthNotes: _health, ...publicColumns } = getTableColumns(students);

export type StudentView = Omit<Student, "healthNotes"> & { modality: string | null; modalityActive: boolean | null };

/** Cadastro do aluno SEM o campo de saúde (ele só é lido por getHealth). */
export async function getStudent(ctx: Pick<AcademyContext, "academyId">, id: string): Promise<StudentView> {
  const [student] = await db.select({ ...publicColumns, modality: modalities.name, modalityActive: modalities.active }).from(students)
    .leftJoin(modalities, eq(modalities.id, students.modalityId))
    .where(and(eq(students.id, id), eq(students.academyId, ctx.academyId), inArray(students.status, ["active", "inactive", "suspended"])));
  if (!student) throw new NotFoundError("Aluno");
  return student;
}

/** Dado sensível: leitura separada, só para a seção restrita do perfil. */
export async function getHealth(ctx: Pick<AcademyContext, "academyId">, id: string) {
  const [row] = await db.select({ notes: students.healthNotes, consentAt: students.healthConsentAt }).from(students)
    .where(and(eq(students.id, id), eq(students.academyId, ctx.academyId)));
  if (!row) throw new NotFoundError("Aluno");
  return row;
}

export async function updateHealth(ctx: AcademyContext, id: string, notes: string, consent: boolean) {
  const text = notes.trim().slice(0, 2000) || null;
  if (text && !consent) throw new DomainError("Registre o consentimento para guardar informações de saúde.", { consent: "Consentimento obrigatório." });
  return db.transaction(async (tx) => {
    const [s] = await tx.update(students).set({ healthNotes: text, healthConsentAt: text ? new Date() : null })
      .where(and(eq(students.id, id), eq(students.academyId, ctx.academyId))).returning({ name: students.name });
    if (!s) throw new NotFoundError("Aluno");
    // o conteúdo não vai para a auditoria: só o registro de que houve alteração
    await audit(tx, ctx, "student.health", "student", id, `Observações de saúde de ${s.name} ${text ? "atualizadas" : "removidas"}`);
  });
}

export async function setEnrollmentSigned(ctx: AcademyContext, id: string, date: string | null) {
  return db.transaction(async (tx) => {
    const [s] = await tx.update(students).set({ enrollmentSignedAt: date }).where(and(eq(students.id, id), eq(students.academyId, ctx.academyId))).returning({ name: students.name });
    if (!s) throw new NotFoundError("Aluno");
    await audit(tx, ctx, "student.enrollment_signed", "student", id, date ? `Ficha de matrícula de ${s.name} assinada` : `Assinatura da ficha de ${s.name} desmarcada`);
  });
}

type StudentFilters = { q?: string; status?: "active" | "inactive" | "suspended" };

function studentConditions(ctx: AcademyContext, filters: StudentFilters) {
  const q = filters.q?.trim();
  const digits = q?.replace(/\D/g, "");
  const like = q ? `%${q.replace(/[%_\\]/g, "\\$&")}%` : null;
  return and(
      eq(students.academyId, ctx.academyId),
      // pedidos pendentes e recusados ficam na tela de solicitações, não na lista de alunos
      filters.status ? eq(students.status, filters.status) : inArray(students.status, ["active", "inactive", "suspended"]),
      like ? or(
        ilike(students.name, like),
        ilike(students.email, like),
        digits && digits.length >= 3 ? sql`regexp_replace(coalesce(${students.phone}, ''), '\\D', '', 'g') like ${`%${digits}%`}` : undefined,
        digits && digits.length >= 3 ? sql`regexp_replace(coalesce(${students.cpf}, ''), '\\D', '', 'g') like ${`%${digits}%`}` : undefined,
        // a criança também é encontrada pelo nome ou telefone do responsável
        sql`exists (select 1 from student_guardians sg join guardians g on g.id = sg.guardian_id where sg.student_id = students.id
          and (g.name ilike ${like} ${digits && digits.length >= 3 ? sql`or regexp_replace(g.phone, '\\D', '', 'g') like ${`%${digits}%`}` : sql``}))`,
      ) : undefined,
    );
}

/** Busca por nome, telefone ou e-mail (sem diferenciar maiúsculas), com filtro de status. */
export async function listStudents(ctx: AcademyContext, filters: StudentFilters = {}, limit = 100, offset = 0) {
  const now = todayIn(ctx.timezone);

  return db.select({
    id: students.id, name: students.name, phone: students.phone, email: students.email, modality: modalities.name,
    status: students.status, monthlyFeeCents: students.monthlyFeeCents, hasAccount: sql<boolean>`${students.userId} is not null`,
    birthDate: students.birthDate, signed: sql<boolean>`${students.enrollmentSignedAt} is not null`,
    guardian: sql<string | null>`(select g.name from student_guardians sg join guardians g on g.id = sg.guardian_id where sg.student_id = students.id and sg.is_primary limit 1)`,
    overdue: sql<number>`(select count(*)::int from ${fees} f where f.student_id = students.id and f.status = 'pending' and f.due_date < ${now})`,
  }).from(students)
    .leftJoin(modalities, eq(modalities.id, students.modalityId))
    .where(studentConditions(ctx, filters))
    .orderBy(asc(students.name), asc(students.id)).limit(limit).offset(offset);
}

/** Quantos alunos o filtro encontra (para a paginação). */
export async function countStudents(ctx: AcademyContext, filters: StudentFilters = {}) {
  const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(students).where(studentConditions(ctx, filters));
  return row.n;
}

/** Situação financeira mostrada no perfil. */
export async function studentFinancialSummary(ctx: AcademyContext, studentId: string) {
  const now = todayIn(ctx.timezone);
  const [row] = await db.select({
    overdueCount: sql<number>`count(*) filter (where ${fees.dueDate} < ${now})::int`,
    pendingCount: sql<number>`count(*)::int`,
    openCents: sql<number>`coalesce(sum(${fees.amountCents} - coalesce((select sum(p.amount_cents) from ${payments} p where p.fee_id = fees.id and p.status = 'paid'), 0)), 0)::int`,
  }).from(fees).where(and(eq(fees.academyId, ctx.academyId), eq(fees.studentId, studentId), eq(fees.status, "pending")));

  const [last] = await db.select({ paidAt: payments.paidAt, amountCents: payments.amountCents }).from(payments)
    .where(and(eq(payments.academyId, ctx.academyId), eq(payments.studentId, studentId), eq(payments.status, "paid")))
    .orderBy(desc(payments.paidAt), desc(payments.createdAt)).limit(1);

  const situation = row.overdueCount > 0 ? "overdue" : row.pendingCount > 0 ? "pending" : "ok";
  return { ...row, situation: situation as "overdue" | "pending" | "ok", lastPayment: last ?? null };
}
