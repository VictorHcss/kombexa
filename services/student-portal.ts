/**
 * Área do aluno (perfil STUDENT): só leitura e só os próprios dados.
 * Toda consulta parte do vínculo em que students.user_id é a conta logada e o
 * status é "active". Não há como pedir dados de outro aluno pela URL.
 */
import { and, asc, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { academies, attendances, fees, modalities, payments, students, users } from "@/db/schema";
import { listRanks } from "./ranks";
import { audit } from "./audit";
import { ownsOrGuards } from "./guardian-access";
import { today } from "@/lib/dates";
import { NotFoundError } from "@/lib/errors";
import { displayFeeStatus } from "@/lib/fee-status";

export interface StudentContext {
  userId: string;
  role: "STUDENT";
}

export async function studentOverview(ctx: StudentContext, studentId: string) {
  const [me] = await db.select({
    id: students.id, academyId: students.academyId, academyName: academies.name, academyPhone: academies.phone, academyEmail: academies.email, academyTimezone: academies.timezone, academyCity: academies.city, pixKey: academies.pixKey, name: students.name, phone: students.phone,
    email: students.email, birthDate: students.birthDate, modality: modalities.name, joinedAt: students.joinedAt,
    monthlyFeeCents: students.monthlyFeeCents, dueDay: students.dueDay,
  }).from(students).innerJoin(academies, eq(academies.id, students.academyId)).leftJoin(modalities, eq(modalities.id, students.modalityId))
    .where(and(eq(students.id, studentId), ownsOrGuards(ctx.userId), eq(students.status, "active"), eq(academies.active, true)));
  if (!me) throw new NotFoundError("Vínculo");

  const now = today(new Date(), me.academyTimezone);
  const myFees = (await db.select({
    id: fees.id, reference: fees.reference, dueDate: fees.dueDate, amountCents: fees.amountCents, status: fees.status,
    paidCents: sql<number>`coalesce((select sum(p.amount_cents) from payments p where p.fee_id = fees.id and p.status = 'paid'), 0)::int`,
  }).from(fees).where(and(eq(fees.studentId, me.id), eq(fees.academyId, me.academyId), sql`${fees.status} <> 'canceled'`)).orderBy(desc(fees.dueDate)).limit(24))
    .map((f) => ({ ...f, displayStatus: displayFeeStatus(f.status, f.dueDate, now), balanceCents: Math.max(0, f.amountCents - f.paidCents) }));

  const myPayments = await db.select({ id: payments.id, paidAt: payments.paidAt, amountCents: payments.amountCents, method: payments.method, status: payments.status, feeId: payments.feeId })
    .from(payments).where(and(eq(payments.studentId, me.id), eq(payments.academyId, me.academyId), eq(payments.status, "paid"))).orderBy(desc(payments.paidAt)).limit(24);

  const open = myFees.filter((f) => f.status === "pending");
  const situation = open.some((f) => f.displayStatus === "overdue") ? "overdue" : open.length ? "pending" : "ok";
  return { me, fees: myFees, payments: myPayments, situation: situation as "ok" | "pending" | "overdue", openCents: open.reduce((s, f) => s + f.balanceCents, 0) };
}

/**
 * O aluno troca o próprio telefone. Vale para a conta e para todos os vínculos ativos
 * (cada academia guarda a sua cópia); cada academia recebe o registro na auditoria.
 */
export async function updateOwnPhone(ctx: StudentContext, phone: string) {
  await db.transaction(async (tx) => {
    await tx.update(users).set({ phone }).where(eq(users.id, ctx.userId));
    const changed = await tx.update(students).set({ phone })
      .where(and(eq(students.userId, ctx.userId), eq(students.status, "active")))
      .returning({ id: students.id, academyId: students.academyId, name: students.name });
    for (const s of changed) {
      await audit(tx, { userId: ctx.userId, academyId: s.academyId }, "student.contact_updated", "student", s.id, `${s.name} atualizou o próprio telefone pela área do aluno`);
    }
  });
}

/** Dados da própria conta para a tela "Minha conta" (telefone da conta ou, se vazio, o do vínculo mais recente). */
export async function ownAccount(ctx: StudentContext) {
  const [u] = await db.select({ name: users.name, email: users.email, phone: users.phone }).from(users).where(eq(users.id, ctx.userId));
  if (!u) throw new NotFoundError("Conta");
  if (u.phone) return u;
  const [s] = await db.select({ phone: students.phone }).from(students)
    .where(and(eq(students.userId, ctx.userId), eq(students.status, "active"))).orderBy(desc(students.createdAt)).limit(1);
  return { ...u, phone: s?.phone ?? null };
}

/**
 * Vínculos ativos que a conta pode ver: os próprios e os dos dependentes (responsável).
 * É a base de todas as páginas da área do aluno: nenhuma recebe ID de aluno sem passar por aqui
 * ou por ownsOrGuards.
 */
export async function activeLinks(ctx: StudentContext) {
  const rows = await db.select({
    id: students.id, name: students.name, academyId: students.academyId, academyName: academies.name, academyTimezone: academies.timezone, signedAt: students.enrollmentSignedAt,
    own: sql<boolean>`${students.userId} = ${ctx.userId}`,
  }).from(students).innerJoin(academies, eq(academies.id, students.academyId))
    .where(and(ownsOrGuards(ctx.userId), eq(students.status, "active"), eq(academies.active, true)))
    .orderBy(sql`${students.userId} = ${ctx.userId} desc`, asc(academies.name), asc(students.name));
  return rows.map((r) => ({ ...r, asGuardian: !r.own }));
}

async function ownLink(ctx: StudentContext, studentId: string) {
  const [link] = await db.select({ id: students.id, academyId: students.academyId, timezone: academies.timezone }).from(students)
    .innerJoin(academies, eq(academies.id, students.academyId))
    .where(and(eq(students.id, studentId), ownsOrGuards(ctx.userId), eq(students.status, "active"), eq(academies.active, true)));
  if (!link) throw new NotFoundError("Vínculo");
  return link;
}

/** Presenças registradas pela academia (somente leitura), do último ano, com resumo por mês. */
export async function ownAttendance(ctx: StudentContext, studentId: string) {
  const link = await ownLink(ctx, studentId);
  const now = today(new Date(), link.timezone);
  const since = `${Number(now.slice(0, 4)) - 1}${now.slice(4)}`;
  const rows = await db.select({ date: sql<string>`${attendances.date}::text` }).from(attendances)
    .where(and(eq(attendances.academyId, link.academyId), eq(attendances.studentId, link.id), gte(attendances.date, since)))
    .orderBy(desc(attendances.date));
  const dates = rows.map((r) => r.date);
  const byMonth = new Map<string, number>();
  for (const d of dates) byMonth.set(d.slice(0, 7), (byMonth.get(d.slice(0, 7)) ?? 0) + 1);
  const last30Start = new Date(`${now}T12:00:00Z`); last30Start.setUTCDate(last30Start.getUTCDate() - 29);
  const from30 = last30Start.toISOString().slice(0, 10);
  return { dates, byMonth: [...byMonth.entries()].map(([month, count]) => ({ month, count })), last30: dates.filter((d) => d >= from30).length, today: now };
}

/** Graduações registradas pela academia (somente leitura). */
export async function ownRanks(ctx: StudentContext, studentId: string) {
  const link = await ownLink(ctx, studentId);
  return listRanks({ academyId: link.academyId }, link.id);
}
