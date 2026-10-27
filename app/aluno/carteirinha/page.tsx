import type { Metadata } from "next";
import { Suspense } from "react";
import QRCode from "qrcode";
import { ConfirmSubmit, Flash } from "@/components/client";
import { Card, Empty } from "@/components/ui";
import { StudentHeader } from "@/components/StudentHeader";
import { requireStudent } from "@/lib/auth/guards";
import { formatDate } from "@/lib/dates";
import { checkinPayload, formatCheckinCode, ownCheckinCode } from "@/services/checkin";
import { activeLinks, ownRanks } from "@/services/student-portal";
import { regenerateCodeAction } from "./actions";

export const metadata: Metadata = { title: "Carteirinha" };
export const dynamic = "force-dynamic";

/**
 * Carteirinha com o QR Code de presença. O QR só tem um código aleatório: não mostra dados
 * pessoais e não abre nada sozinho; quem lê é a recepção, dentro do sistema da academia.
 */
export default async function CardPage() {
  const ctx = await requireStudent();
  const links = await activeLinks(ctx);
  return (
    <div className="student-area">
      <StudentHeader user={ctx.user.name} current="/aluno/carteirinha" />
      <main className="content content--narrow">
        <Suspense fallback={null}><Flash /></Suspense>
        <h1 className="greeting">Carteirinha</h1>
        {links.length === 0 && <Card><Empty title="Nenhuma matrícula ativa" text="A carteirinha aparece depois que a academia aprovar sua matrícula." /></Card>}
        {links.map((l) => <MemberCard key={l.id} ctx={ctx} link={l} />)}
        <p className="small muted student-foot">Mostre o QR Code na recepção para registrar a presença. Se alguém tiver uma foto do seu código, gere um novo: o anterior deixa de valer na hora.</p>
      </main>
    </div>
  );
}

async function MemberCard({ ctx, link }: { ctx: Awaited<ReturnType<typeof requireStudent>>; link: Awaited<ReturnType<typeof activeLinks>>[number] }) {
  const [code, ranks] = await Promise.all([ownCheckinCode(ctx, link.id), ownRanks(ctx, link.id)]);
  const svg = await QRCode.toString(checkinPayload(code), { type: "svg", margin: 1, errorCorrectionLevel: "M" });
  const src = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
  return (
    <section className="member-card" aria-label={`Carteirinha de ${link.name}`}>
      <div className="member-card-head">
        <span className="member-card-academy">{link.academyName}</span>
        <strong className="member-card-name">{link.name}</strong>
        {ranks[0] && <span className="member-card-rank">{ranks[0].rank} · desde {formatDate(ranks[0].awardedAt)}</span>}
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element -- QR gerado no servidor (SVG em data: URL) */}
      <img className="member-card-qr" src={src} alt={`QR Code de presença de ${link.name}`} width={220} height={220} />
      <p className="member-card-code" aria-label="Código para digitar">{formatCheckinCode(code)}</p>
      <form action={regenerateCodeAction}>
        <input type="hidden" name="studentId" value={link.id} />
        <ConfirmSubmit className="btn btn--small btn--ghost" tone="primary" title="Gerar novo código" confirmLabel="Gerar novo"
          message="Gerar um novo QR Code? O código atual deixa de funcionar na hora.">Gerar novo código</ConfirmSubmit>
      </form>
    </section>
  );
}
