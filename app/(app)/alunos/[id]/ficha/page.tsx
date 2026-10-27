import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EnrollmentDocument } from "@/components/EnrollmentDocument";
import { requireAcademyAdmin } from "@/lib/auth/guards";
import { isUuid, orNotFound } from "@/lib/page";
import { can } from "@/lib/permissions";
import { enrollmentDocument } from "@/services/documents";
import { PrintButton } from "./PrintButton";

export const metadata: Metadata = { title: "Ficha de matrícula" };

/** Ficha/contrato para impressão, com a identidade visual da academia. */
export default async function EnrollmentSheet({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saude?: string }> }) {
  const ctx = await requireAcademyAdmin("alunos");
  const { id } = await params;
  if (!isUuid(id)) notFound();
  // saúde é dado sensível: só entra para quem tem a permissão "saude" (antes bastava mudar a URL)
  const healthAllowed = can(ctx.permissions, "saude");
  const withHealth = healthAllowed && (await searchParams).saude === "1";
  const doc = await orNotFound(enrollmentDocument(ctx, id, { withHealth }));

  return (
    <div className="sheet-page">
      <div className="sheet-toolbar no-print">
        <Link href={`/alunos/${id}`} className="btn btn--ghost">← Voltar ao perfil</Link>
        {healthAllowed && <Link href={`/alunos/${id}/ficha${withHealth ? "" : "?saude=1"}`} className="btn" replace>{withHealth ? "Tirar observações de saúde" : "Incluir observações de saúde"}</Link>}
        <PrintButton />
      </div>
      {doc.terms.length === 0 && <p className="alert alert--info no-print">A academia ainda não escreveu os termos da matrícula. <Link href="/configuracoes?aba=ficha">Escrever os termos</Link></p>}
      {!doc.logo && <p className="alert alert--info no-print">A ficha sai com o nome da academia no cabeçalho. <Link href="/configuracoes?aba=identidade">Adicionar a logo da academia</Link></p>}
      <EnrollmentDocument doc={doc} />
    </div>
  );
}
