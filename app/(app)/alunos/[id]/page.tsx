import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatAddress } from "@/components/AddressFields";
import { CancelPaymentButton, ConfirmSubmit } from "@/components/client";
import { Alert, Badge, Card, Dl, Empty } from "@/components/ui";
import { requireAcademyAdmin } from "@/lib/auth/guards";
import { can } from "@/lib/permissions";
import { frequencyOf } from "@/services/attendance";
import { maskCpf } from "@/lib/cpf";
import { formatDate, formatDateTime, formatReference, todayIn } from "@/lib/dates";
import { FEE_STATUS_LABEL } from "@/lib/fee-status";
import { PAYMENT_METHODS, PAYMENT_STATUS, STUDENT_STATUS } from "@/lib/labels";
import { formatMoney } from "@/lib/money";
import { isUuid, orNotFound } from "@/lib/page";
import { reminderText, whatsappLink } from "@/lib/whatsapp";
import { listAuditFor } from "@/services/audit";
import { listFees } from "@/services/fees";
import { guardiansOf, isMinor } from "@/services/guardians";
import { listPayments } from "@/services/payments";
import { getHealth, getStudent, studentFinancialSummary } from "@/services/students";
import { cancelPaymentAction } from "../../pagamentos/actions";
import { addRankAction, removeRankAction } from "../actions";
import { RankForm } from "../ProfileForms";
import { listRanks } from "@/services/ranks";
import { listModalities } from "@/services/academy";
import { anonymizeAction, guardianAccessAction, primaryGuardianAction, removeGuardianAction, saveGuardianAction, saveHealthAction, signedAction, toggleStudentStatusAction } from "../actions";
import { EraseForm, GuardianForm, HealthForm } from "../ProfileForms";

export const metadata: Metadata = { title: "Aluno" };

const SITUATION = { ok: "Em dia", pending: "A vencer", overdue: "Atrasado" } as const;
const TABS = [["info", "Cadastro"], ["mensalidades", "Mensalidades"], ["pagamentos", "Pagamentos"], ["graduacoes", "Graduações"], ["saude", "Saúde"], ["historico", "Histórico"]] as const;

export default async function StudentPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ aba?: string; erro?: string }> }) {
  const ctx = await requireAcademyAdmin("alunos");
  const canPay = can(ctx.permissions, "pagamentos");
  const tabs = TABS.filter(([key]) => key !== "saude" || can(ctx.permissions, "saude"));
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const { aba = "info", erro } = await searchParams;
  const s = await orNotFound(getStudent(ctx, id));
  const [summary, fees, payments, guardians, freq] = await Promise.all([studentFinancialSummary(ctx, id), listFees(ctx, { studentId: id }), listPayments(ctx, { studentId: id }), guardiansOf(ctx, id), frequencyOf(ctx.academyId, id, todayIn(ctx.timezone))]);
  const minor = isMinor(s.birthDate);
  const primary = guardians.find((g) => g.isPrimary);
  const openFees = fees.filter((f) => f.displayStatus === "pending" || f.displayStatus === "overdue");
  const here = `/alunos/${id}?aba=${aba}`;

  // cobrança: para quem tem responsável principal, a mensagem vai para ele
  const nextOpen = openFees.find((f) => f.displayStatus === "overdue") ?? [...openFees].sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
  const contact = primary ? { name: primary.name, phone: primary.phone } : { name: s.name, phone: s.phone };
  const wa = whatsappLink(contact.phone, reminderText({ name: contact.name, student: primary ? s.name : undefined, academy: ctx.user.academyName ?? "academia", reference: nextOpen?.reference, dueDate: nextOpen?.dueDate, openCents: nextOpen?.balanceCents, overdue: nextOpen?.displayStatus === "overdue" }));

  return (
    <>
      <div className="profile-head">
        <div>
          <Link href="/alunos" className="back-link">← Alunos</Link>
          <h1 className="profile-title">{s.name}</h1>
          <p className="muted profile-meta">
            {s.modality} <Badge status={s.status}>{STUDENT_STATUS[s.status]}</Badge>
            {minor && <Badge status="pending">Menor de idade</Badge>}
            {!s.enrollmentSignedAt && <Badge status="pending">Ficha pendente</Badge>}
          </p>
        </div>
        <span className={`situation situation--${summary.situation}`}>
          {SITUATION[summary.situation]}{summary.openCents > 0 && <small>{formatMoney(summary.openCents)} em aberto</small>}
        </span>
      </div>
      {erro && <Alert tone="danger">{erro}</Alert>}
      {s.anonymizedAt && <Alert tone="info">Dados pessoais eliminados a pedido do titular em {formatDateTime(s.anonymizedAt)}. As mensalidades e os pagamentos continuam no financeiro, sem identificar a pessoa.</Alert>}
      {minor && !primary && <Alert tone="danger">Aluno menor de idade sem responsável principal. <Link href={`/alunos/${id}/editar`}>Informe o responsável</Link>.</Alert>}
      {!s.birthDate && <Alert tone="info">Data de nascimento não informada. Ela é obrigatória para saber se o aluno precisa de responsável. <Link href={`/alunos/${id}/editar`}>Completar cadastro</Link></Alert>}

      <div className="stats stats--compact">
        <div className="stat"><span className="stat-label">Último pagamento</span><strong>{summary.lastPayment ? formatDate(summary.lastPayment.paidAt) : "Nenhum"}</strong>{summary.lastPayment && <span className="stat-hint">{formatMoney(summary.lastPayment.amountCents)}</span>}</div>
        <div className="stat"><span className="stat-label">Em aberto</span><strong>{summary.pendingCount}</strong><span className="stat-hint">{summary.overdueCount} atrasada(s)</span></div>
        <div className="stat"><span className="stat-label">Mensalidade</span><strong>{s.monthlyFeeCents === null ? "–" : formatMoney(s.monthlyFeeCents)}</strong><span className="stat-hint">vence todo dia {s.dueDay}</span></div>
        <div className="stat"><span className="stat-label">Treinos em 30 dias</span><strong>{freq.last30}</strong><span className="stat-hint">{freq.last ? `último em ${formatDate(freq.last)}` : `aluno desde ${formatDate(s.joinedAt)}`}</span></div>
      </div>

      <div className="quick profile-actions">
        {canPay && <Link href={`/pagamentos/novo?aluno=${s.id}${openFees[0] ? `&mensalidade=${openFees[0].id}` : ""}`} className="btn btn--primary">Registrar pagamento</Link>}
        {wa && <a href={wa} className="btn btn--whatsapp" target="_blank" rel="noopener noreferrer">{nextOpen ? "Cobrar" : "WhatsApp"}{primary ? ` ${primary.name.split(" ")[0]}` : ""}</a>}
        {!s.anonymizedAt && <Link href={`/alunos/${s.id}/editar`} className="btn">Editar</Link>}
        <details className="menu">
          <summary className="btn">Mais ações</summary>
          <div className="menu-list">
            <Link href={`/mensalidades/nova?aluno=${s.id}`}>Nova mensalidade</Link>
            <Link href={`/alunos/${s.id}/ficha`}>Imprimir ficha de matrícula</Link>
            <a href={`/alunos/${s.id}/exportar`} download>Exportar dados (LGPD)</a>
            <form action={toggleStudentStatusAction}>
              <input type="hidden" name="id" value={s.id} />
              <input type="hidden" name="status" value={s.status === "active" ? "inactive" : "active"} />
              <ConfirmSubmit className="menu-item" tone="primary" title={s.status === "active" ? "Marcar como inativo" : "Reativar aluno"} confirmLabel={s.status === "active" ? "Marcar como inativo" : "Reativar"}
                message={s.status === "active" ? `Marcar ${s.name} como inativo? Ele deixa de receber mensalidades na geração do mês. O histórico é mantido.` : `Reativar ${s.name}? Ele volta a receber mensalidades na geração do mês.`}>
                {s.status === "active" ? "Marcar como inativo" : "Reativar aluno"}
              </ConfirmSubmit>
            </form>
          </div>
        </details>
      </div>

      <nav className="tabs" aria-label="Seções do perfil">
        {tabs.map(([key, label]) => <Link key={key} href={`/alunos/${id}?aba=${key}`} aria-current={aba === key ? "page" : undefined} scroll={false}>{label}</Link>)}
      </nav>

      {aba === "info" && (
        <>
          <Card title="Dados pessoais">
            <Dl items={[
              ["Data de nascimento", s.birthDate ? `${formatDate(s.birthDate)}${minor ? " (menor de idade)" : ""}` : null], ["CPF", maskCpf(s.cpf)],
              ["Telefone", s.phone], ["E-mail", s.email], ["Endereço", formatAddress(s)], ["Observações", s.notes],
              ...(s.dataConsentAt ? [["Consentimento de dados", `Aceito pelo convite em ${formatDateTime(s.dataConsentAt)}`] as [string, string]] : []),
            ]} />
          </Card>

          {(minor || guardians.length > 0) && (
            <Card title="Responsáveis" actions={<GuardianForm action={saveGuardianAction.bind(null, s.id)} onlyOne={guardians.length === 0} />}>
              {guardians.length === 0 ? <Empty title="Nenhum responsável" text="Aluno menor de idade precisa de um responsável principal." /> : (
                <ul className="plain-list">
                  {guardians.map((g) => (
                    <li key={g.id} className="guardian-item">
                      <div>
                        <strong>{g.name}</strong> <span className="muted">({g.relationship})</span> {g.isPrimary && <Badge status="active">Principal</Badge>}
                        <div className="small muted">{[g.phone, g.email, maskCpf(g.cpf)].filter(Boolean).join(", ")}</div>
                        {g.userId && <div className="small tone-ok">Acessa a área do responsável</div>}
                      </div>
                      <div className="row-actions">
                        {!g.isPrimary && (
                          <form action={primaryGuardianAction}><input type="hidden" name="studentId" value={s.id} /><input type="hidden" name="guardianId" value={g.id} />
                            <ConfirmSubmit className="btn btn--small btn--ghost" tone="primary" title="Tornar principal" confirmLabel="Tornar principal" message={`${g.name} passa a ser o contato de cobrança e quem assina a ficha de ${s.name}.`}>Tornar principal</ConfirmSubmit></form>
                        )}
                        <GuardianForm action={saveGuardianAction.bind(null, s.id)} guardian={g as never} onlyOne={guardians.length === 1} />
                        {g.email && (
                          <form action={guardianAccessAction}><input type="hidden" name="studentId" value={s.id} /><input type="hidden" name="guardianId" value={g.id} />
                            {g.userId && <input type="hidden" name="revoke" value="1" />}
                            <ConfirmSubmit className={`btn btn--small ${g.userId ? "btn--ghost-danger" : ""}`} tone={g.userId ? "danger" : "primary"} title={g.userId ? "Remover acesso" : "Dar acesso ao responsável"} confirmLabel={g.userId ? "Remover acesso" : "Enviar acesso"}
                              message={g.userId ? `${g.name} deixa de ver os dependentes na área do responsável.` : `${g.name} recebe em ${g.email} um link para criar a senha e acompanhar situação, mensalidades, Pix e recibos dos dependentes nesta academia.`}>
                              {g.userId ? "Remover acesso" : "Dar acesso"}
                            </ConfirmSubmit></form>
                        )}
                        {(!g.isPrimary || !minor) && (
                          <form action={removeGuardianAction}><input type="hidden" name="studentId" value={s.id} /><input type="hidden" name="guardianId" value={g.id} />
                            <ConfirmSubmit className="btn btn--small btn--ghost-danger" title="Remover responsável" confirmLabel="Remover" message={`Remover ${g.name} dos responsáveis de ${s.name}? O cadastro de ${g.name} continua existindo se for responsável por outro aluno.`}>Remover</ConfirmSubmit></form>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}

          <Card title="Emergência e imagem">
            <Dl items={[
              ["Contato de emergência", s.emergencyName ? `${s.emergencyName}${s.emergencyRelation ? ` (${s.emergencyRelation})` : ""}, ${s.emergencyPhone}` : null],
              ["Uso de imagem", s.imageConsent === null ? "Ainda não perguntado" : `${s.imageConsent ? "Autoriza" : "Não autoriza"}${s.imageConsentAt ? `, registrado em ${formatDateTime(s.imageConsentAt)}` : ""}`],
            ]} />
          </Card>

          {!s.anonymizedAt && (
            <Card title="Privacidade">
              <p className="small muted" style={{ marginTop: 0 }}>A pedido do titular (ou do responsável), a LGPD garante acesso aos dados e a eliminação deles. Em <strong>Mais ações → Exportar dados</strong>, você baixa tudo o que o sistema guarda sobre o aluno.</p>
              {s.status === "inactive"
                ? <EraseForm action={anonymizeAction.bind(null, s.id)} />
                : <p className="small muted" style={{ margin: 0 }}>Para eliminar os dados pessoais, marque o aluno como inativo e quite ou cancele as mensalidades em aberto.</p>}
            </Card>
          )}

          <Card title="Ficha de matrícula" actions={<Link href={`/alunos/${s.id}/ficha`} className="btn btn--small">Imprimir ficha</Link>}>
            {s.enrollmentSignedAt ? (
              <form action={signedAction} className="inline-form">
                <span>Assinada em <strong>{formatDate(s.enrollmentSignedAt)}</strong>.</span>
                <input type="hidden" name="id" value={s.id} /><input type="hidden" name="undo" value="1" />
                <ConfirmSubmit className="btn btn--small btn--ghost" tone="primary" title="Desmarcar assinatura" confirmLabel="Desmarcar" message="Marcar a ficha como não assinada? Use se a ficha precisar ser refeita.">Desmarcar</ConfirmSubmit>
              </form>
            ) : (
              <form action={signedAction} className="inline-form">
                <span className="muted">Ainda não assinada.</span>
                <input type="hidden" name="id" value={s.id} />
                <label className="small">Assinada em <input type="date" name="date" defaultValue={todayIn(ctx.timezone)} aria-label="Data da assinatura" /></label>
                <ConfirmSubmit className="btn btn--small" tone="primary" title="Ficha assinada" confirmLabel="Confirmar" message={`Confirmar que a ficha de ${s.name} foi assinada${minor && primary ? ` por ${primary.name}` : ""}?`}>Marcar como assinada</ConfirmSubmit>
              </form>
            )}
          </Card>
        </>
      )}

      {aba === "mensalidades" && (
        <Card>
          {fees.length === 0 ? <Empty title="Nenhuma mensalidade" action={<Link href={`/mensalidades/nova?aluno=${s.id}`} className="btn">Criar mensalidade</Link>} /> : (
            <div className="table-wrap"><table className="table">
              <thead><tr><th>Referência</th><th>Vencimento</th><th>Situação</th><th className="num">Valor</th><th className="num">Em aberto</th><th /></tr></thead>
              <tbody>{fees.map((f) => (
                <tr key={f.id}>
                  <td className="primary">{formatReference(f.reference)}</td>
                  <td data-label="Vencimento">{formatDate(f.dueDate)}</td>
                  <td data-label="Situação"><Badge status={f.displayStatus}>{FEE_STATUS_LABEL[f.displayStatus]}</Badge></td>
                  <td data-label="Valor" className="num">{formatMoney(f.amountCents)}</td>
                  <td data-label="Em aberto" className="num">{f.status === "canceled" || f.status === "paid" ? "–" : formatMoney(f.balanceCents)}</td>
                  <td>{f.status === "pending" && canPay && <div className="row-actions"><Link className="btn btn--small" href={`/pagamentos/novo?aluno=${s.id}&mensalidade=${f.id}`} aria-label={`Registrar pagamento de ${f.reference}`}>Receber</Link></div>}</td>
                </tr>
              ))}</tbody>
            </table></div>
          )}
        </Card>
      )}

      {aba === "pagamentos" && (
        <Card>
          {payments.length === 0 ? <Empty title="Nenhum pagamento registrado" /> : (
            <div className="table-wrap"><table className="table">
              <thead><tr><th>Data</th><th>Referência</th><th>Forma</th><th>Status</th><th className="num">Valor</th><th /></tr></thead>
              <tbody>{payments.map((p) => (
                <tr key={p.id}>
                  <td className="primary">{formatDate(p.paidAt)}</td>
                  <td data-label="Referência">{p.feeReference ? `Mensalidade ${p.feeReference}` : p.reference ?? "Avulso"}</td>
                  <td data-label="Forma">{PAYMENT_METHODS[p.method]}</td>
                  <td data-label="Status"><Badge status={p.status}>{PAYMENT_STATUS[p.status]}</Badge>{p.cancelReason && <div className="small muted">{p.cancelReason}</div>}</td>
                  <td data-label="Valor" className="num">{formatMoney(p.amountCents)}</td>
                  <td><div className="row-actions">{p.status !== "pending" && <Link href={`/pagamentos/${p.id}/recibo`} className="btn btn--small btn--ghost">Recibo</Link>}{p.status !== "canceled" && <CancelPaymentButton action={cancelPaymentAction} paymentId={p.id} back={here} description={`o pagamento de ${formatMoney(p.amountCents)} de ${formatDate(p.paidAt)}`} />}</div></td>
                </tr>
              ))}</tbody>
            </table></div>
          )}
        </Card>
      )}

      {aba === "saude" && can(ctx.permissions, "saude") && <Health studentId={s.id} ctx={ctx} />}
      {aba === "graduacoes" && <Ranks ctx={ctx} studentId={s.id} modalityId={s.modalityId} />}
      {aba === "historico" && <History ctx={ctx} studentId={s.id} />}
    </>
  );
}

/** Carregada só quando a aba é aberta: o dado de saúde nunca vai junto com o resto do perfil. */
async function Health({ ctx, studentId }: { ctx: Awaited<ReturnType<typeof requireAcademyAdmin>>; studentId: string }) {
  const health = await getHealth(ctx, studentId);
  return (
    <Card title="Saúde (restrito)">
      <p className="small muted" style={{ marginTop: 0 }}>Dado sensível pela LGPD. Aparece só aqui: não entra em listas, buscas, mensagens nem na ficha impressa, a menos que você marque para incluir. Alterações ficam registradas na auditoria, sem o conteúdo.</p>
      <HealthForm action={saveHealthAction.bind(null, studentId)} notes={health.notes ?? ""} consentAt={health.consentAt ? formatDateTime(health.consentAt) : null} />
    </Card>
  );
}

async function Ranks({ ctx, studentId, modalityId }: { ctx: Awaited<ReturnType<typeof requireAcademyAdmin>>; studentId: string; modalityId: string | null }) {
  const [ranks, mods] = await Promise.all([listRanks(ctx, studentId), listModalities(ctx)]);
  return (
    <>
      <Card title="Graduação atual">
        {ranks.length === 0 ? <Empty title="Nenhuma graduação registrada" text="Registre a faixa ou corda atual do aluno. Ele vê o histórico na Área do Aluno." /> : (
          <p className="rank-current"><strong>{ranks[0].rank}</strong><span className="small muted">{[ranks[0].modality, `desde ${formatDate(ranks[0].awardedAt)}`].filter(Boolean).join(" · ")}</span></p>
        )}
      </Card>
      <Card title="Registrar graduação">
        <RankForm action={addRankAction.bind(null, studentId)} modalities={mods.filter((m) => m.active || m.id === modalityId)} defaultModality={modalityId} today={todayIn(ctx.timezone)} />
      </Card>
      {ranks.length > 0 && (
        <Card title={`Histórico (${ranks.length})`}>
          <ul className="rank-list">
            {ranks.map((r) => (
              <li key={r.id}>
                <div><strong>{r.rank}</strong><span className="small muted">{[formatDate(r.awardedAt), r.modality, r.awardedBy && `por ${r.awardedBy}`].filter(Boolean).join(" · ")}</span>{r.notes && <span className="small">{r.notes}</span>}</div>
                <form action={removeRankAction}>
                  <input type="hidden" name="studentId" value={studentId} /><input type="hidden" name="rankId" value={r.id} />
                  <ConfirmSubmit className="btn btn--small btn--ghost-danger" title="Remover registro" confirmLabel="Remover" message={`Remover o registro "${r.rank}" de ${formatDate(r.awardedAt)}? Use só para corrigir um lançamento errado. A remoção fica na auditoria.`}>Remover</ConfirmSubmit>
                </form>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}

async function History({ ctx, studentId }: { ctx: Awaited<ReturnType<typeof requireAcademyAdmin>>; studentId: string }) {
  const events = await listAuditFor(ctx, studentId);
  return (
    <Card>
      {events.length === 0 ? <Empty title="Sem histórico ainda" /> : (
        <ul className="dl" style={{ listStyle: "none", padding: 0 }}>
          {events.map((e) => <li key={e.id}><span className="small muted">{e.when}, por {e.user ?? "Sistema"}</span><div>{e.summary}</div></li>)}
        </ul>
      )}
    </Card>
  );
}
