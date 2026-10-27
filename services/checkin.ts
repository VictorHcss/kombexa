/**
 * QR Code de presença do aluno.
 *
 * O QR leva só um código aleatório ("KBX1:" + 12 caracteres, ~60 bits), sem nome, CPF ou ID.
 * Ler o código não abre nada: ele só serve para a EQUIPE da academia marcar a presença, e o
 * servidor confere que o código é de um aluno ativo DAQUELA academia. Gerar um código novo
 * invalida o anterior (coluna única em students.checkin_code).
 */
import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { attendances, students } from "@/db/schema";
import { DomainError, NotFoundError } from "@/lib/errors";
import { audit } from "./audit";
import type { AcademyContext } from "./context";
import { ownsOrGuards } from "./guardian-access";
import type { StudentContext } from "./student-portal";

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"; // Crockford: sem I, L, O, U (não confunde ao digitar)

export function newCheckinCode(): string {
  const bytes = randomBytes(12);
  return Array.from(bytes, (b) => ALPHABET[b & 31]).join("");
}

export const checkinPayload = (code: string) => `KBX1:${code}`;
export const formatCheckinCode = (code: string) => code.replace(/(.{4})(?=.)/g, "$1-");

async function ownLink(ctx: StudentContext, studentId: string) {
  const [s] = await db.select({ id: students.id, academyId: students.academyId, name: students.name, code: students.checkinCode })
    .from(students).where(and(eq(students.id, studentId), ownsOrGuards(ctx.userId), eq(students.status, "active")));
  if (!s) throw new NotFoundError("Vínculo");
  return s;
}

/** Código do aluno (cria na primeira vez). Só o próprio aluno ou o responsável. */
export async function ownCheckinCode(ctx: StudentContext, studentId: string): Promise<string> {
  const s = await ownLink(ctx, studentId);
  if (s.code) return s.code;
  return issue(ctx, s, false);
}

/** Gera um código novo; o anterior deixa de valer na hora. */
export async function regenerateCheckinCode(ctx: StudentContext, studentId: string): Promise<string> {
  return issue(ctx, await ownLink(ctx, studentId), true);
}

async function issue(ctx: StudentContext, s: { id: string; academyId: string; name: string }, replaced: boolean) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = newCheckinCode();
    try {
      await db.transaction(async (tx) => {
        await tx.update(students).set({ checkinCode: code, checkinCodeCreatedAt: new Date() }).where(eq(students.id, s.id));
        if (replaced) await audit(tx, { userId: ctx.userId, academyId: s.academyId }, "student.checkin_code_replaced", "student", s.id, `QR Code de presença de ${s.name} substituído pela área do aluno`);
      });
      return code;
    } catch (error) {
      if ((error as { code?: string; cause?: { code?: string } }).code !== "23505" && (error as { cause?: { code?: string } }).cause?.code !== "23505") throw error;
    }
  }
  throw new Error("Não foi possível gerar um código único.");
}

/**
 * Equipe: marca a presença pelo código. Reaproveita a tabela de presença (uma por aluno por dia),
 * então ler o mesmo QR duas vezes não duplica nada.
 */
export async function checkInByCode(ctx: AcademyContext, code: string, date: string) {
  const [s] = await db.select({ id: students.id, name: students.name, status: students.status }).from(students)
    .where(and(eq(students.checkinCode, code), eq(students.academyId, ctx.academyId)));
  // mesma mensagem para código inexistente, substituído ou de outra academia: não revela qual
  if (!s) throw new DomainError("Código não reconhecido. Ele pode ter sido substituído pelo aluno ou não ser desta academia.");
  if (s.status !== "active") throw new DomainError(`${s.name} não está com a matrícula ativa.`);
  const inserted = await db.insert(attendances).values({ academyId: ctx.academyId, studentId: s.id, date, createdBy: ctx.userId })
    .onConflictDoNothing().returning({ id: attendances.id });
  return { studentId: s.id, name: s.name, already: inserted.length === 0 };
}
