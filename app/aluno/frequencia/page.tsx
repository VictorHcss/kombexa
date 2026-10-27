import type { Metadata } from "next";
import { Card, Empty } from "@/components/ui";
import { StudentHeader } from "@/components/StudentHeader";
import { requireStudent } from "@/lib/auth/guards";
import { formatDate, formatReference } from "@/lib/dates";
import { activeLinks, ownAttendance, ownRanks } from "@/services/student-portal";

export const metadata: Metadata = { title: "Frequência" };
export const dynamic = "force-dynamic";
const WEEKDAY = new Intl.DateTimeFormat("pt-BR", { weekday: "short", timeZone: "UTC" });

/** Frequência e graduação: somente leitura (quem registra é a academia). */
export default async function FrequencyPage() {
  const ctx = await requireStudent();
  const links = await activeLinks(ctx);
  return (
    <div className="student-area">
      <StudentHeader user={ctx.user.name} current="/aluno/frequencia" />
      <main className="content content--narrow">
        <h1 className="greeting">Frequência</h1>
        {links.length === 0 && <Card><Empty title="Nenhuma matrícula ativa" text="Quando uma academia aprovar sua matrícula, seus treinos aparecem aqui." /></Card>}
        {links.map((l) => <Block key={l.id} ctx={ctx} link={l} several={links.length > 1} />)}
        <p className="small muted student-foot">As presenças são registradas pela academia. Se algum treino estiver faltando, fale com a recepção.</p>
      </main>
    </div>
  );
}

async function Block({ ctx, link, several }: { ctx: Awaited<ReturnType<typeof requireStudent>>; link: Awaited<ReturnType<typeof activeLinks>>[number]; several: boolean }) {
  const [att, ranks] = await Promise.all([ownAttendance(ctx, link.id), ownRanks(ctx, link.id)]);
  const months = att.byMonth.slice(0, 6);
  const max = Math.max(1, ...months.map((m) => m.count));
  return (
    <section className="membership" aria-label={`${link.name}, ${link.academyName}`}>
      {(several || link.asGuardian) && <h2 className="membership-name">{link.asGuardian ? `${link.name} · ${link.academyName}` : link.academyName}</h2>}
      <div className="stat-row">
        <div className="stat"><span>Últimos 30 dias</span><strong>{att.last30}</strong><small>treino{att.last30 === 1 ? "" : "s"}</small></div>
        <div className="stat"><span>Último treino</span><strong>{att.dates[0] ? formatDate(att.dates[0]) : "—"}</strong></div>
        <div className="stat"><span>Graduação</span><strong>{ranks[0]?.rank ?? "—"}</strong>{ranks[0] && <small>desde {formatDate(ranks[0].awardedAt)}</small>}</div>
      </div>

      <Card title="Treinos por mês">
        {months.length === 0 ? <Empty title="Nenhuma presença registrada no último ano" /> : (
          <ul className="month-bars">
            {months.map((m) => (
              <li key={m.month}>
                <span>{formatReference(m.month)}</span>
                <span className="month-bar" aria-hidden="true"><span style={{ width: `${(m.count / max) * 100}%` }} /></span>
                <strong>{m.count}</strong>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {att.dates.length > 0 && (
        <details className="card my-data">
          <summary>Todas as presenças do último ano ({att.dates.length})</summary>
          <ul className="date-chips">{att.dates.map((d) => <li key={d}><span className="small muted">{WEEKDAY.format(new Date(`${d}T12:00:00Z`))}</span> {formatDate(d)}</li>)}</ul>
        </details>
      )}

      {ranks.length > 0 && (
        <Card title="Histórico de graduações">
          <ul className="rank-list">
            {ranks.map((r) => <li key={r.id}><div><strong>{r.rank}</strong><span className="small muted">{[formatDate(r.awardedAt), r.modality, r.awardedBy && `por ${r.awardedBy}`].filter(Boolean).join(" · ")}</span>{r.notes && <span className="small">{r.notes}</span>}</div></li>)}
          </ul>
        </Card>
      )}
    </section>
  );
}
