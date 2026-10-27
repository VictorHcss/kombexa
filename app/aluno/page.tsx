import Link from "next/link";
import type { Metadata } from "next";
import { Suspense } from "react";
import { Flash } from "@/components/client";
import { Alert, Badge, Card, Dl } from "@/components/ui";
import { StudentHeader } from "@/components/StudentHeader";
import { requireStudent } from "@/lib/auth/guards";
import { formatDate, formatDateTime, formatReference, today } from "@/lib/dates";
import { FEE_STATUS_LABEL } from "@/lib/fee-status";
import { PAYMENT_METHODS } from "@/lib/labels";
import { formatMoney } from "@/lib/money";
import { whatsappLink } from "@/lib/whatsapp";
import { membershipsOf } from "@/services/enrollment";
import { dependentsOf } from "@/services/guardian-access";
import { frequencyOf } from "@/services/attendance";
import { ownRanks, studentOverview, type StudentContext } from "@/services/student-portal";
import { announcementsForStudent } from "@/services/announcements";
import QRCode from "qrcode";
import { CopyButton } from "@/components/CopyButton";
import { pixPayload } from "@/lib/pix";
import { resendVerificationAction } from "./conta/actions";

export const metadata: Metadata = { title: "Minha área" };
export const dynamic = "force-dynamic";

/** Quantas mensalidades aparecem antes do "Ver histórico completo". */
const RECENT = 4;
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Área do aluno: só leitura dos dados da academia; telefone e senha em "Minha conta". */
export default async function StudentArea({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const ctx = await requireStudent();
  const { erro } = await searchParams;
  const [memberships, allDependents, news] = await Promise.all([membershipsOf(ctx.userId), dependentsOf(ctx.userId), announcementsForStudent(ctx, 2)]);
  // quem é aluno e também responsável vê os próprios dados e, abaixo, os dos dependentes
  const dependents = allDependents.filter((d) => !memberships.some((m) => m.id === d.id));
  const several = memberships.length > 1;

  return (
    <div className="student-area">
      <StudentHeader user={ctx.user.name} current="/aluno" />
      <main className="content content--narrow">
        <Suspense fallback={null}><Flash /></Suspense>
        <header className="student-greeting">
          <h1 className="greeting">Olá, {ctx.user.name.split(" ")[0]}</h1>
          {several && <p className="muted small">Você tem vínculo com {memberships.length} academias.</p>}
        </header>
        {erro && <Alert tone="danger">{erro}</Alert>}
        {!ctx.user.emailVerified && (
          <div className="alert alert--info verify-banner" role="status">
            <span><strong>Confirme seu e-mail.</strong> Enviamos um link para {ctx.user.email}. Assim a academia sabe que a conta é mesmo sua.</span>
            <form action={resendVerificationAction}><button type="submit" className="btn btn--small">Reenviar link</button></form>
          </div>
        )}

        {(memberships.some((m) => m.status === "active") || dependents.length > 0) && (
          <nav className="shortcuts" aria-label="Atalhos">
            <Link href="/aluno/carteirinha"><strong>Carteirinha</strong><span>QR Code de presença</span></Link>
            <Link href="/aluno/frequencia"><strong>Frequência</strong><span>Treinos e graduação</span></Link>
            <Link href="/aluno/documentos"><strong>Documentos</strong><span>Ficha e recibos</span></Link>
            <Link href="/aluno/comunicados"><strong>Comunicados</strong><span>Avisos da academia</span></Link>
          </nav>
        )}
        {news.length > 0 && (
          <Card title="Comunicados recentes" actions={<Link href="/aluno/comunicados" className="btn btn--small btn--ghost">Ver todos</Link>}>
            <ul className="news-list">{news.map((n) => <li key={n.id}><strong>{n.title}</strong><span className="small muted">{formatDateTime(n.publishedAt)}</span><p>{n.body.length > 160 ? `${n.body.slice(0, 160)}…` : n.body}</p></li>)}</ul>
          </Card>
        )}

        {memberships.length === 0 && dependents.length === 0 && (
          <Card className="no-academy">
            <h2>Sua conta ainda não está em uma academia</h2>
            <p>Passe o e-mail da sua conta para a recepção da academia. Quando ela adicionar você, suas mensalidades e pagamentos aparecem aqui.</p>
            <p className="no-academy-email"><span>E-mail da sua conta</span><strong>{ctx.user.email}</strong></p>
            <p className="small muted card-note">Tem o QR Code ou o código da academia? <Link href="/criar-conta?tipo=convite">Use o convite</Link> e o pedido chega direto para a recepção.</p>
          </Card>
        )}
        {memberships.map((m) => (
          m.status === "active" ? <Membership key={m.id} ctx={ctx} id={m.id} /> : (
            <section key={m.id} className="membership membership--closed" aria-label={m.academyName}>
              <h2 className="membership-name">{m.academyName}</h2>
              {m.status === "pending" && <Alert tone="info">Seu cadastro está em análise desde {formatDateTime(m.createdAt)}. Quando a recepção aprovar, suas mensalidades e pagamentos aparecem aqui.</Alert>}
              {m.status === "rejected" && <Alert tone="danger">Seu pedido de entrada não foi aprovado.{m.rejectionReason && ` Motivo: ${m.rejectionReason}.`} Em caso de dúvida, fale com a recepção.</Alert>}
              {(m.status === "inactive" || m.status === "suspended") && <p className="muted card-note">Seu vínculo com esta academia está {m.status === "inactive" ? "inativo" : "suspenso"}. Fale com a recepção.</p>}
            </section>
          )
        ))}
        {dependents.length > 0 && (
          <>
            {memberships.length > 0 && <h2 className="dependents-title">Seus dependentes</h2>}
            {dependents.map((d) => <Membership key={d.id} ctx={ctx} id={d.id} asGuardian />)}
          </>
        )}
        <p className="small muted student-foot"><a href="/aluno/meus-dados" download>Baixar meus dados</a>: tudo o que as academias guardam sobre você, em um arquivo.</p>
      </main>
    </div>
  );
}

async function Membership({ ctx, id, asGuardian = false }: { ctx: StudentContext; id: string; asGuardian?: boolean }) {
  const { me, fees, payments, situation, openCents } = await studentOverview(ctx, id);
  const first = me.name.split(" ")[0];
  const [freq, ranks] = await Promise.all([frequencyOf(me.academyId, me.id, today(new Date(), me.academyTimezone)), ownRanks(ctx, id)]);
  const open = fees.filter((f) => f.status === "pending").sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const overdue = open.filter((f) => f.displayStatus === "overdue");
  const overdueCents = overdue.reduce((t, f) => t + f.balanceCents, 0);
  const next = open[0];
  const lastPayment = payments[0];

  // cada mensalidade com os pagamentos dela; pagamentos sem mensalidade (avulsos) ficam à parte
  const byFee = new Map<string, typeof payments>();
  for (const p of payments) if (p.feeId) byFee.set(p.feeId, [...(byFee.get(p.feeId) ?? []), p]);
  const loose = payments.filter((p) => !p.feeId || !fees.some((f) => f.id === p.feeId));
  const recent = fees.slice(0, RECENT);
  const older = fees.slice(RECENT);

  // Pix copia e cola do próximo valor em aberto (só se a academia cadastrou a chave)
  const pix = me.pixKey && next ? await (async () => {
    const code = pixPayload({ key: me.pixKey!, name: me.academyName, city: me.academyCity, amountCents: next.balanceCents, txid: `M${next.reference.replace("-", "")}${me.id.slice(0, 6)}` });
    return { code, qr: await QRCode.toDataURL(code, { margin: 1, width: 352, errorCorrectionLevel: "M" }) };
  })() : null;

  const wa = whatsappLink(me.academyPhone, asGuardian
    ? `Olá! Sou responsável por ${first}, aluno(a) da ${me.academyName}.`
    : `Olá! Aqui é ${first}, aluno(a) da ${me.academyName}.`);
  const tel = me.academyPhone?.replace(/[^\d+]/g, "");

  const title = situation === "overdue" ? (overdue.length > 1 ? "Você tem mensalidades atrasadas" : "Você tem uma mensalidade atrasada")
    : "Você está em dia";
  const heroTitle = asGuardian ? title.replace("Você tem", `${first} tem`).replace("Você está", `${first} está`) : title;

  const feeRow = (f: (typeof fees)[number]) => (
    <li key={f.id} className={`history-item history-item--${f.displayStatus}`}>
      <div className="history-main">
        <strong>{formatReference(f.reference)}</strong>
        <span className="small muted">{f.status === "paid" ? "Venceu" : f.displayStatus === "overdue" ? "Venceu" : "Vence"} em {formatDate(f.dueDate)}</span>
      </div>
      <div className="history-side">
        <span className="history-value">{formatMoney(f.status === "pending" ? f.balanceCents : f.amountCents)}</span>
        <Badge status={f.displayStatus}>{FEE_STATUS_LABEL[f.displayStatus]}</Badge>
      </div>
      {(byFee.get(f.id) ?? []).length > 0 && (
        <ul className="history-payments">
          {byFee.get(f.id)!.map((p) => (
            <li key={p.id}>
              <span>Pago {formatMoney(p.amountCents)} em {formatDate(p.paidAt)}, {PAYMENT_METHODS[p.method].toLowerCase()}</span>
              <Link href={`/aluno/recibo/${p.id}`} className="btn btn--small btn--ghost">Recibo</Link>
            </li>
          ))}
        </ul>
      )}
    </li>
  );

  return (
    <section className="membership" aria-label={me.academyName}>
      <div className="membership-head">
        <div>
          {asGuardian && <p className="dependent-tag">Dependente</p>}
          <h2 className="membership-name">{asGuardian ? me.name : me.academyName}</h2>
          <p className="small muted">{[asGuardian ? me.academyName : null, me.modality, ranks[0]?.rank, `aluno desde ${formatDate(me.joinedAt)}`, freq.last30 ? `${freq.last30} treino${freq.last30 === 1 ? "" : "s"} em 30 dias` : null].filter(Boolean).join(" · ")}</p>
        </div>
        {(wa || tel || me.academyEmail) && (
          <div className="membership-contact">
            {wa && <a className="btn btn--small btn--whatsapp" href={wa} target="_blank" rel="noopener noreferrer">WhatsApp</a>}
            {tel && <a className="btn btn--small" href={`tel:${tel}`}>Ligar</a>}
            {!wa && !tel && me.academyEmail && <a className="btn btn--small" href={`mailto:${me.academyEmail}`}>E-mail</a>}
          </div>
        )}
      </div>

      {/* 1. Estou em dia? 2. Quanto e quando pago? Tudo no mesmo bloco. */}
      <div className={`hero hero--${situation}`} role="status">
        <span className="hero-label">{asGuardian ? `Situação de ${first}` : "Sua situação"}</span>
        <strong className="hero-title">{heroTitle}</strong>
        {situation === "overdue" && <span className="hero-text">{plural(overdue.length, "mensalidade atrasada", "mensalidades atrasadas")}, {formatMoney(overdueCents)} em aberto.</span>}
        {next ? (
          <div className="hero-next">
            <div><span className="hero-mini">{next.displayStatus === "overdue" ? "Mais antiga" : "Próxima"}</span><strong>{formatMoney(next.balanceCents)}</strong></div>
            <div><span className="hero-mini">{next.displayStatus === "overdue" ? "Venceu em" : "Vence em"}</span><strong>{formatDate(next.dueDate)}</strong></div>
            <div><span className="hero-mini">Referência</span><strong>{formatReference(next.reference)}</strong></div>
          </div>
        ) : (
          <span className="hero-text">
            {lastPayment ? `Último pagamento em ${formatDate(lastPayment.paidAt)}, ${formatMoney(lastPayment.amountCents)}.` : "Nenhuma mensalidade em aberto."}
            {me.monthlyFeeCents !== null && ` Sua mensalidade é de ${formatMoney(me.monthlyFeeCents)}, todo dia ${me.dueDay}.`}
          </span>
        )}
        {open.length > 1 && <span className="hero-foot">Total em aberto: {formatMoney(openCents)} em {open.length} mensalidades.</span>}
        <span className="hero-foot">{me.pixKey && next ? "Pague com o Pix abaixo ou na academia." : "O pagamento é feito na academia."} Depois de confirmado pela recepção, ele aparece aqui com o recibo.</span>
      </div>

      {pix && next && (
        <Card title="Pagar com Pix" className="pix-card">
          <div className="pix">
            {/* eslint-disable-next-line @next/next/no-img-element -- QR Code gerado no servidor, como data: URL */}
            <img src={pix.qr} alt={`QR Code Pix de ${formatMoney(next.balanceCents)}`} width={176} height={176} className="pix-qr" />
            <div className="pix-info">
              <p className="pix-amount"><span>Valor</span><strong>{formatMoney(next.balanceCents)}</strong><small>{formatReference(next.reference)}</small></p>
              <CopyButton text={pix.code} label="Copiar Pix copia e cola" className="btn btn--primary btn--block-mobile" />
              <details className="pix-code"><summary>Ver o código</summary><code>{pix.code}</code></details>
            </div>
          </div>
          <p className="small muted card-note">Abra o app do seu banco, escolha Pix copia e cola (ou leia o QR Code) e confira o nome da academia antes de pagar. O pagamento aparece aqui depois que a recepção confirmar.</p>
        </Card>
      )}

      <Card title="Histórico">
        {fees.length === 0 && loose.length === 0 ? <p className="muted card-note">Nenhuma mensalidade ainda.</p> : (
          <>
            <ul className="history">{recent.map(feeRow)}</ul>
            {older.length > 0 && (
              <details className="history-more">
                <summary>Ver histórico completo ({plural(older.length, "mensalidade", "mensalidades")})</summary>
                <ul className="history">{older.map(feeRow)}</ul>
              </details>
            )}
            {loose.length > 0 && (
              <>
                <h3 className="history-subtitle">Outros pagamentos</h3>
                <ul className="history">{loose.map((p) => (
                  <li key={p.id} className="history-item">
                    <div className="history-main"><strong>{formatDate(p.paidAt)}</strong><span className="small muted">{PAYMENT_METHODS[p.method]}</span></div>
                    <div className="history-side"><span className="history-value">{formatMoney(p.amountCents)}</span><Link href={`/aluno/recibo/${p.id}`} className="btn btn--small btn--ghost">Recibo</Link></div>
                  </li>
                ))}</ul>
              </>
            )}
          </>
        )}
      </Card>

      <details className="card my-data">
        <summary>{asGuardian ? `Dados de ${first}` : "Meus dados nesta academia"}</summary>
        <Dl items={[
          ["Modalidade", me.modality], ["Aluno desde", formatDate(me.joinedAt)],
          ["Mensalidade", me.monthlyFeeCents === null ? null : `${formatMoney(me.monthlyFeeCents)}, vence todo dia ${me.dueDay}`],
          ["Telefone", me.phone], ["E-mail", me.email], ["Nascimento", formatDate(me.birthDate)],
        ]} />
        <p className="small muted card-note">{asGuardian ? "Para corrigir algum dado, fale com a recepção." : <>O telefone você atualiza em <Link href="/aluno/conta">Minha conta</Link>. Para corrigir outros dados, fale com a recepção.</>}</p>
      </details>
    </section>
  );
}
