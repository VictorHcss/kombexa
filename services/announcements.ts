/**
 * Comunicados da academia (mural). A equipe publica; os alunos com vínculo ativo leem.
 * Não há envio por e-mail, WhatsApp ou push: o comunicado aparece na Área do Aluno.
 */
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { academies, announcements, students } from "@/db/schema";
import { NotFoundError } from "@/lib/errors";
import type { z } from "zod";
import type { announcementInput } from "@/lib/validation";
import { audit } from "./audit";
import type { AcademyContext } from "./context";
import { ownsOrGuards } from "./guardian-access";
import type { StudentContext } from "./student-portal";

export const ANNOUNCEMENT_CATEGORIES = {
  geral: "Geral", horario: "Horários", feriado: "Feriado", evento: "Evento", graduacao: "Graduação",
} as const;
export type AnnouncementCategory = keyof typeof ANNOUNCEMENT_CATEGORIES;

type Input = z.output<typeof announcementInput>;

export async function listAnnouncements(ctx: AcademyContext, { archived = false } = {}) {
  return db.select().from(announcements)
    .where(and(eq(announcements.academyId, ctx.academyId), archived ? sql`${announcements.archivedAt} is not null` : isNull(announcements.archivedAt)))
    .orderBy(desc(announcements.pinned), desc(announcements.publishedAt)).limit(100);
}

export async function getAnnouncement(ctx: AcademyContext, id: string) {
  const [a] = await db.select().from(announcements).where(and(eq(announcements.id, id), eq(announcements.academyId, ctx.academyId)));
  if (!a) throw new NotFoundError("Comunicado");
  return a;
}

export async function createAnnouncement(ctx: AcademyContext, data: Input) {
  return db.transaction(async (tx) => {
    const [a] = await tx.insert(announcements).values({ academyId: ctx.academyId, ...data, createdBy: ctx.userId }).returning();
    await audit(tx, ctx, "announcement.created", "announcement", a.id, `Comunicado publicado: ${a.title}`);
    return a;
  });
}

export async function updateAnnouncement(ctx: AcademyContext, id: string, data: Input) {
  return db.transaction(async (tx) => {
    const [a] = await tx.update(announcements).set(data).where(and(eq(announcements.id, id), eq(announcements.academyId, ctx.academyId))).returning();
    if (!a) throw new NotFoundError("Comunicado");
    await audit(tx, ctx, "announcement.updated", "announcement", id, `Comunicado alterado: ${a.title}`);
    return a;
  });
}

/** Arquivar tira do mural dos alunos (sem apagar); reativar devolve. */
export async function setAnnouncementArchived(ctx: AcademyContext, id: string, archived: boolean) {
  return db.transaction(async (tx) => {
    const [a] = await tx.update(announcements).set({ archivedAt: archived ? new Date() : null })
      .where(and(eq(announcements.id, id), eq(announcements.academyId, ctx.academyId))).returning();
    if (!a) throw new NotFoundError("Comunicado");
    await audit(tx, ctx, archived ? "announcement.archived" : "announcement.restored", "announcement", id, `Comunicado ${archived ? "arquivado" : "reativado"}: ${a.title}`);
    return a;
  });
}

/**
 * Mural do aluno: comunicados ativos das academias em que ele (ou um dependente dele) tem
 * vínculo ativo. A lista de academias sai do vínculo, nunca de um parâmetro.
 */
export async function announcementsForStudent(ctx: StudentContext, limit = 50) {
  const linked = db.selectDistinct({ id: students.academyId }).from(students)
    .where(and(ownsOrGuards(ctx.userId), eq(students.status, "active")));
  return db.select({
    id: announcements.id, title: announcements.title, body: announcements.body, category: announcements.category,
    pinned: announcements.pinned, publishedAt: announcements.publishedAt, academyName: academies.name,
  }).from(announcements).innerJoin(academies, eq(academies.id, announcements.academyId))
    .where(and(inArray(announcements.academyId, linked), isNull(announcements.archivedAt), eq(academies.active, true)))
    .orderBy(desc(announcements.pinned), desc(announcements.publishedAt)).limit(limit);
}
