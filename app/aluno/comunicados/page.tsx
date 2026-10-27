import type { Metadata } from "next";
import { Card, Empty } from "@/components/ui";
import { StudentHeader } from "@/components/StudentHeader";
import { requireStudent } from "@/lib/auth/guards";
import { formatDateTime } from "@/lib/dates";
import { ANNOUNCEMENT_CATEGORIES, announcementsForStudent, type AnnouncementCategory } from "@/services/announcements";

export const metadata: Metadata = { title: "Comunicados" };
export const dynamic = "force-dynamic";

export default async function StudentAnnouncements() {
  const ctx = await requireStudent();
  const items = await announcementsForStudent(ctx);
  const several = new Set(items.map((i) => i.academyName)).size > 1;
  return (
    <div className="student-area">
      <StudentHeader user={ctx.user.name} current="/aluno/comunicados" />
      <main className="content content--narrow">
        <h1 className="greeting">Comunicados</h1>
        {items.length === 0 ? <Card><Empty title="Nenhum comunicado no momento" text="Avisos da academia sobre horários, feriados, eventos e graduações aparecem aqui." /></Card> : (
          <ul className="announcement-list">
            {items.map((a) => (
              <li key={a.id} className={`card announcement${a.pinned ? " is-pinned" : ""}`}>
                <p className="announcement-meta">
                  <span className="chip">{ANNOUNCEMENT_CATEGORIES[a.category as AnnouncementCategory] ?? "Geral"}</span>
                  {a.pinned && <span className="chip chip--accent">Fixado</span>}
                  <span className="small muted">{several ? `${a.academyName} · ` : ""}{formatDateTime(a.publishedAt)}</span>
                </p>
                <h2>{a.title}</h2>
                <p className="announcement-body">{a.body}</p>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
