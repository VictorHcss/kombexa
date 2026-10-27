import type { Metadata } from "next";
import Link from "next/link";
import { Card, Empty, PageHeader } from "@/components/ui";
import { requireAcademyAdmin } from "@/lib/auth/guards";
import { formatDate, isValidDate, todayIn } from "@/lib/dates";
import { can } from "@/lib/permissions";
import { reminderText, whatsappLink } from "@/lib/whatsapp";
import { attendanceDay, missingStudents } from "@/services/attendance";
import { addDays } from "@/services/automation";
import { togglePresenceAction } from "./actions";
import { CheckInForm } from "./CheckInForm";

export const metadata: Metadata = { title: "Presença" };
const WEEKDAY = new Intl.DateTimeFormat("pt-BR", { weekday: "long", timeZone: "UTC" });

export default async function AttendancePage({ searchParams }: { searchParams: Promise<{ dia?: string; q?: string }> }) {
  const ctx = await requireAcademyAdmin("presenca");
  const sp = await searchParams;
  const today = todayIn(ctx.timezone);
  const day = sp.dia && isValidDate(sp.dia) && sp.dia <= today ? sp.dia : today;
  const [list, missing] = await Promise.all([attendanceDay(ctx, day, sp.q?.trim() || undefined), day === today ? missingStudents(ctx) : Promise.resolve([])]);
  const present = list.filter((s) => s.present).length;
  const weekday = WEEKDAY.format(new Date(`${day}T12:00:00Z`));
  const q = sp.q ? `&q=${encodeURIComponent(sp.q)}` : "";

  return (
    <>
      <PageHeader title="Presença" description={`${day === today ? "Hoje, " : ""}${weekday}, ${formatDate(day)}.`}
        actions={<nav className="day-nav" aria-label="Dia">
          <Link href={`/presenca?dia=${addDays(day, -1)}${q}`} className="btn" aria-label="Dia anterior">←</Link>
          <form className="day-pick"><input type="date" name="dia" defaultValue={day} max={today} aria-label="Escolher dia" /><button className="btn" type="submit">Ir</button></form>
          {day < today ? <Link href={`/presenca?dia=${addDays(day, 1)}${q}`} className="btn" aria-label="Dia seguinte">→</Link> : <span className="btn" aria-disabled="true">→</span>}
        </nav>} />

      <div className="presence-summary">
        <strong>{present}</strong><span>de {list.length} aluno{list.length === 1 ? "" : "s"} {sp.q ? "encontrados" : "ativos"} {day === today ? "treinaram hoje" : "treinaram neste dia"}</span>
      </div>

      {day === today && <Card title="Registrar pelo QR Code"><CheckInForm /></Card>}

      <form className="filters filters--inline" role="search">
        <input type="hidden" name="dia" value={day} />
        <label>Pesquisar aluno<input name="q" type="search" defaultValue={sp.q} placeholder="Nome do aluno" /></label>
        <button type="submit" className="btn">Filtrar</button>
        {sp.q && <Link href={`/presenca?dia=${day}`} className="btn btn--ghost">Limpar</Link>}
      </form>

      <Card>
        {list.length === 0 ? <Empty title="Nenhum aluno ativo encontrado" /> : (
          <ul className="presence-list">
            {list.map((s) => (
              <li key={s.id} data-present={s.present}>
                <div className="presence-who">
                  {can(ctx.permissions, "alunos") ? <Link href={`/alunos/${s.id}`}><strong>{s.name}</strong></Link> : <strong>{s.name}</strong>}
                  <span className="small muted">{[s.modality, `${s.month} treino${s.month === 1 ? "" : "s"} em 30 dias`, s.last && s.last !== day ? `último em ${formatDate(s.last)}` : null].filter(Boolean).join(" · ")}</span>
                </div>
                <form action={togglePresenceAction}>
                  <input type="hidden" name="studentId" value={s.id} /><input type="hidden" name="date" value={day} />
                  <input type="hidden" name="present" value={String(!s.present)} />
                  <button type="submit" className={`presence-toggle${s.present ? " is-on" : ""}`} aria-pressed={s.present} aria-label={`${s.present ? "Desmarcar" : "Marcar"} presença de ${s.name}`}>
                    <span aria-hidden="true">{s.present ? "✓" : "+"}</span>{s.present ? "Presente" : "Marcar"}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {missing.length > 0 && (
        <Card title={`Sumidos há 14 dias ou mais (${missing.length})`}>
          <p className="small muted card-lead">Alunos ativos sem presença nas últimas duas semanas. Um contato agora costuma evitar o cancelamento.</p>
          <ul className="plain-list missing-list">
            {missing.slice(0, 30).map((m) => {
              const wa = whatsappLink(m.phone, reminderText({ name: m.name, academy: ctx.user.academyName ?? "academia" }) + " Sentimos sua falta nos treinos! Está tudo bem?");
              return (
                <li key={m.id}>
                  <div><strong>{m.name}</strong><div className="small muted">{m.last ? `Último treino em ${formatDate(m.last)}` : "Nenhuma presença registrada"}</div></div>
                  {wa && <a className="btn btn--small btn--whatsapp" href={wa} target="_blank" rel="noopener noreferrer">WhatsApp</a>}
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </>
  );
}
