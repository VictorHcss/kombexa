import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ReceiptSheet } from "@/components/ReceiptSheet";
import { requireStudent } from "@/lib/auth/guards";
import { isUuid, orNotFound } from "@/lib/page";
import { getOwnReceipt } from "@/services/receipts";
import { PrintButton } from "../../../(app)/alunos/[id]/ficha/PrintButton";

export const metadata: Metadata = { title: "Recibo" };
export const dynamic = "force-dynamic";

export default async function StudentReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireStudent();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const r = await orNotFound(getOwnReceipt(ctx, id));
  return (
    <main className="content content--narrow">
      <div className="sheet-toolbar no-print"><Link href="/aluno/documentos" className="btn btn--ghost">← Documentos</Link><PrintButton /></div>
      <ReceiptSheet r={r} />
    </main>
  );
}
