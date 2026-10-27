import { ownsOrGuards } from "./guardian-access";
/** Recibo de um pagamento: dados do pagamento, de quem pagou e da academia. */
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { academies, fees, guardians, payments, studentGuardians, students } from "@/db/schema";
import { NotFoundError } from "@/lib/errors";
import { academyLogoDataUrl } from "./branding";
import type { AcademyContext } from "./context";
import type { StudentContext } from "./student-portal";

async function load(where: ReturnType<typeof and>) {
  const [row] = await db.select({
    id: payments.id, amountCents: payments.amountCents, paidAt: payments.paidAt, method: payments.method, status: payments.status,
    reference: payments.reference, feeReference: fees.reference, canceledAt: payments.canceledAt, cancelReason: payments.cancelReason,
    studentId: students.id, studentName: students.name, studentCpf: students.cpf, studentPhone: students.phone,
    academy: academies,
  }).from(payments)
    .innerJoin(students, eq(students.id, payments.studentId))
    .innerJoin(academies, eq(academies.id, payments.academyId))
    .leftJoin(fees, eq(fees.id, payments.feeId))
    .where(where);
  if (!row || row.status === "pending") throw new NotFoundError("Recibo"); // pagamento não confirmado não tem recibo
  const [payer] = await db.select({ name: guardians.name, cpf: guardians.cpf, phone: guardians.phone }).from(studentGuardians)
    .innerJoin(guardians, eq(guardians.id, studentGuardians.guardianId))
    .where(and(eq(studentGuardians.studentId, row.studentId), eq(studentGuardians.isPrimary, true)));
  // a logo é sempre a da academia dona do pagamento (a mesma que já filtrou o acesso acima)
  const logo = await academyLogoDataUrl(row.academy.id);
  return { ...row, logo, number: row.id.slice(0, 8).toUpperCase(), payer: payer ?? { name: row.studentName, cpf: row.studentCpf, phone: row.studentPhone }, payerIsGuardian: !!payer };
}

export const getReceipt = (ctx: AcademyContext, paymentId: string) => load(and(eq(payments.id, paymentId), eq(payments.academyId, ctx.academyId)));

/** Área do aluno: só recibos de pagamentos do próprio vínculo. */
export const getOwnReceipt = (ctx: StudentContext, paymentId: string) =>
  load(and(eq(payments.id, paymentId), ownsOrGuards(ctx.userId), eq(students.status, "active")));

export type Receipt = Awaited<ReturnType<typeof load>>;
