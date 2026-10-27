/**
 * Graduações (faixas, cordas, graus). Só a equipe registra; o aluno consulta.
 * Cada promoção é uma linha: o histórico é a própria lista, e a atual é a mais recente.
 */
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { modalities, studentRanks, students } from "@/db/schema";
import { todayIn } from "@/lib/dates";
import { DomainError, NotFoundError } from "@/lib/errors";
import type { z } from "zod";
import type { rankInput } from "@/lib/validation";
import { audit } from "./audit";
import type { AcademyContext } from "./context";

export async function listRanks(scope: Pick<AcademyContext, "academyId">, studentId: string) {
  return db.select({
    id: studentRanks.id, rank: studentRanks.rank, awardedAt: studentRanks.awardedAt, awardedBy: studentRanks.awardedBy,
    notes: studentRanks.notes, modality: modalities.name,
  }).from(studentRanks).leftJoin(modalities, eq(modalities.id, studentRanks.modalityId))
    .where(and(eq(studentRanks.academyId, scope.academyId), eq(studentRanks.studentId, studentId)))
    .orderBy(desc(studentRanks.awardedAt), desc(studentRanks.createdAt));
}

export async function addRank(ctx: AcademyContext, studentId: string, data: z.output<typeof rankInput>) {
  if (data.awardedAt > todayIn(ctx.timezone)) throw new DomainError("A data da graduação não pode estar no futuro.", { awardedAt: "Data no futuro." });
  return db.transaction(async (tx) => {
    const [s] = await tx.select({ id: students.id, name: students.name }).from(students)
      .where(and(eq(students.id, studentId), eq(students.academyId, ctx.academyId)));
    if (!s) throw new NotFoundError("Aluno");
    if (data.modalityId) {
      const [m] = await tx.select({ id: modalities.id }).from(modalities).where(and(eq(modalities.id, data.modalityId), eq(modalities.academyId, ctx.academyId)));
      if (!m) throw new DomainError("Escolha uma modalidade da academia.", { modalityId: "Modalidade inválida." });
    }
    const [r] = await tx.insert(studentRanks).values({ academyId: ctx.academyId, studentId, ...data, createdBy: ctx.userId }).returning();
    await audit(tx, ctx, "student.rank_added", "student", studentId, `Graduação registrada para ${s.name}: ${r.rank}`);
    return r;
  });
}

/** Remove um registro lançado por engano (fica o registro na auditoria). */
export async function removeRank(ctx: AcademyContext, rankId: string) {
  return db.transaction(async (tx) => {
    const [r] = await tx.delete(studentRanks).where(and(eq(studentRanks.id, rankId), eq(studentRanks.academyId, ctx.academyId))).returning();
    if (!r) throw new NotFoundError("Graduação");
    await audit(tx, ctx, "student.rank_removed", "student", r.studentId, `Registro de graduação removido: ${r.rank} (${r.awardedAt})`);
    return r;
  });
}
