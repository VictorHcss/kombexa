import type { Metadata } from "next";
import Link from "next/link";
import { ConfirmSubmit } from "@/components/client";
import { Badge, Card, Empty, PageHeader } from "@/components/ui";
import { requireAcademyAdmin } from "@/lib/auth/guards";
import { formatDateTime } from "@/lib/dates";
import { ANNOUNCEMENT_CATEGORIES, listAnnouncements, type AnnouncementCategory } from "@/services/announcements";
import { archiveAnnouncementAction } from "./actions";
import { AnnouncementForm } from "./AnnouncementForm";

export const metadata: Metadata = { title: "Comunicados" };

export default async function AnnouncementsPage({ searchParams }: { searchParams: Promise<{ ver?: string }> }) {
  const ctx = await requireAcademyAdmin("comunicados");
  const archived = (await searchParams).ver === "arquivados";
  const items = await listAnnouncements(ctx, { archived });

  return (
    <>
      <PageHeader title="Comunicados" description="Avisos que os alunos veem na Área do Aluno: horários, feriados, eventos e graduações." />
      <nav className="tabs" aria-label="Comunicados">
        <Link href="/comunicados" aria-current={!archived ? "page" : undefined}>No mural</Link>
        <Link href="/comunicados?ver=arquivados" aria-current={archived ? "page" : undefined}>Arquivados</Link>
      </nav>
      {!archived && <Card title="Novo comunicado"><AnnouncementForm id={null} /></Card>}
      <Card title={archived ? "Arquivados" : "No mural agora"}>
        {items.length === 0 ? (
          <Empty title={archived ? "Nenhum comunicado arquivado" : "Nenhum comunicado no mural"} text={archived ? undefined : "Publique o primeiro aviso acima. Ele aparece para todos os alunos ativos da academia."} />
        ) : (
          <ul className="announcement-admin-list">
            {items.map((a) => (
              <li key={a.id}>
                <div className="announcement-head">
                  <strong>{a.title}</strong>
                  <span className="announcement-meta">
                    <span className="chip">{ANNOUNCEMENT_CATEGORIES[a.category as AnnouncementCategory] ?? "Geral"}</span>
                    {a.pinned && <Badge status="pending">Fixado</Badge>}
                    <span className="small muted">{formatDateTime(a.publishedAt)}</span>
                  </span>
                </div>
                <p className="announcement-body">{a.body}</p>
                <div className="team-actions">
                  {!archived && (
                    <details className="team-edit">
                      <summary className="btn btn--small">Editar</summary>
                      <AnnouncementForm id={a.id} initial={{ title: a.title, body: a.body, category: a.category, pinned: a.pinned }} />
                    </details>
                  )}
                  <form action={archiveAnnouncementAction}>
                    <input type="hidden" name="id" value={a.id} /><input type="hidden" name="archived" value={String(!archived)} />
                    <ConfirmSubmit className="btn btn--small btn--ghost" tone="primary" title={archived ? "Voltar ao mural" : "Arquivar comunicado"} confirmLabel={archived ? "Voltar ao mural" : "Arquivar"}
                      message={archived ? `Colocar "${a.title}" de volta no mural dos alunos?` : `Arquivar "${a.title}"? Ele sai do mural dos alunos, mas continua no histórico.`}>
                      {archived ? "Voltar ao mural" : "Arquivar"}
                    </ConfirmSubmit>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
