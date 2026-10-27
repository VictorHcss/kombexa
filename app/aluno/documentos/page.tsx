import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Card, Empty } from "@/components/ui";
import { StudentHeader } from "@/components/StudentHeader";
import { requireStudent } from "@/lib/auth/guards";
import { formatDate } from "@/lib/dates";
import { PAYMENT_METHODS } from "@/lib/labels";
import { formatMoney } from "@/lib/money";
import { activeLinks, studentOverview } from "@/services/student-portal";

export const metadata: Metadata = { title: "Documentos" };
export const dynamic = "force-dynamic";

/** Documentos do vínculo: ficha/contrato e recibos. Só os da própria conta (ou dos dependentes). */
export default async function StudentDocuments() {
  const ctx = await requireStudent();
  const links = await activeLinks(ctx);
  const overviews = await Promise.all(links.map((l) => studentOverview(ctx, l.id)));
  return (
    <div className="student-area">
      <StudentHeader user={ctx.user.name} current="/aluno/documentos" />
      <main className="content content--narrow">
        <h1 className="greeting">Documentos</h1>
        {links.length === 0 && <Card><Empty title="Nenhuma matrícula ativa" text="Os documentos aparecem depois que a academia aprovar sua matrícula." /></Card>}
        {links.map((l, i) => {
          const payments = overviews[i].payments;
          return (
            <section key={l.id} className="membership" aria-label={`${l.name}, ${l.academyName}`}>
              <h2 className="membership-name">{l.asGuardian ? `${l.name} · ${l.academyName}` : l.academyName}</h2>
              <Card title="Matrícula">
                <ul className="doc-list">
                  <li>
                    <div><strong>Ficha de matrícula e contrato</strong>
                      <span className="small muted">{l.signedAt ? `Assinatura registrada pela academia em ${formatDate(l.signedAt)}` : "A academia ainda não registrou a assinatura"}</span></div>
                    <div className="doc-actions">
                      {l.signedAt ? <Badge status="paid">Assinada</Badge> : <Badge status="pending">Pendente</Badge>}
                      <Link className="btn btn--small" href={`/aluno/documentos/${l.id}`}>Ver</Link>
                    </div>
                  </li>
                </ul>
                <p className="small muted card-note">A assinatura é feita no papel, na academia. Este documento mostra os dados cadastrados e os termos atuais.</p>
              </Card>
              <Card title="Recibos">
                {payments.length === 0 ? <p className="muted card-note">Nenhum pagamento confirmado ainda.</p> : (
                  <ul className="doc-list">
                    {payments.map((p) => (
                      <li key={p.id}>
                        <div><strong>{formatMoney(p.amountCents)}</strong><span className="small muted">{formatDate(p.paidAt)}, {PAYMENT_METHODS[p.method].toLowerCase()}</span></div>
                        <Link className="btn btn--small btn--ghost" href={`/aluno/recibo/${p.id}`}>Recibo</Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </section>
          );
        })}
        <p className="small muted student-foot"><a href="/aluno/meus-dados" download>Baixar meus dados</a>: tudo o que as academias guardam sobre você, em um arquivo.</p>
      </main>
    </div>
  );
}
