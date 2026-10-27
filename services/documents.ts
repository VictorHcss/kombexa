/**
 * Documentos do vínculo aluno ↔ academia (ficha de matrícula / contrato de prestação de serviços).
 *
 * Dois caminhos de entrada, cada um com sua própria checagem de acesso, e um carregador interno
 * que sempre filtra pelo par (academia, aluno):
 * - equipe: o aluno precisa ser da academia da sessão;
 * - área do aluno: o aluno precisa ser o próprio usuário (ou dependente dele) com vínculo ativo.
 * A identidade visual vem SEMPRE da academia dona do vínculo.
 */
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { academies, students } from "@/db/schema";
import { NotFoundError } from "@/lib/errors";
import { academyLogoDataUrl } from "./branding";
import type { AcademyContext } from "./context";
import { ownsOrGuards } from "./guardian-access";
import { guardiansOf } from "./guardians";
import { getHealth, getStudent } from "./students";
import type { StudentContext } from "./student-portal";

async function load(academyId: string, studentId: string, withHealth: boolean) {
  const scope = { academyId };
  const [[academy], student, guardians, logo] = await Promise.all([
    db.select().from(academies).where(eq(academies.id, academyId)),
    getStudent(scope, studentId), // confere de novo que o aluno é desta academia
    guardiansOf(scope, studentId),
    academyLogoDataUrl(academyId),
  ]);
  if (!academy) throw new NotFoundError("Academia");
  const health = withHealth ? (await getHealth(scope, studentId)).notes : null;
  const terms = (academy.enrollmentTerms ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
  return { academy, logo, student, guardians, terms, health, signedAt: student.enrollmentSignedAt };
}

/** Equipe da academia. Saúde só entra quando pedida (e a página exige a permissão \"saude\"). */
export function enrollmentDocument(ctx: AcademyContext, studentId: string, { withHealth = false } = {}) {
  return load(ctx.academyId, studentId, withHealth);
}

/** Área do aluno/responsável: só o próprio vínculo ativo. Nunca inclui saúde. */
export async function ownEnrollmentDocument(ctx: StudentContext, studentId: string) {
  const [link] = await db.select({ academyId: students.academyId }).from(students)
    .innerJoin(academies, eq(academies.id, students.academyId))
    .where(and(eq(students.id, studentId), ownsOrGuards(ctx.userId), eq(students.status, "active"), eq(academies.active, true)));
  if (!link) throw new NotFoundError("Documento");
  return load(link.academyId, studentId, false);
}

export type EnrollmentDocumentData = Awaited<ReturnType<typeof load>>;
