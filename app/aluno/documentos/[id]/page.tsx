import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EnrollmentDocument } from "@/components/EnrollmentDocument";
import { requireStudent } from "@/lib/auth/guards";
import { isUuid, orNotFound } from "@/lib/page";
import { ownEnrollmentDocument } from "@/services/documents";
import { PrintButton } from "../../../(app)/alunos/[id]/ficha/PrintButton";

export const metadata: Metadata = { title: "Ficha de matrícula" };
export const dynamic = "force-dynamic";

/** O aluno vê a própria ficha. Trocar o ID na URL dá 404 (ownEnrollmentDocument confere o vínculo). */
export default async function OwnEnrollmentPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireStudent();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const doc = await orNotFound(ownEnrollmentDocument(ctx, id));
  return (
    <main className="content content--narrow sheet-page">
      <div className="sheet-toolbar no-print"><Link href="/aluno/documentos" className="btn btn--ghost">← Documentos</Link><PrintButton /></div>
      <EnrollmentDocument doc={doc} />
    </main>
  );
}
