import { requireStudent } from "@/lib/auth/guards";
import { exportOwnData } from "@/services/privacy";

/** O aluno baixa os próprios dados em JSON (LGPD). */
export async function GET() {
  const ctx = await requireStudent();
  const data = await exportOwnData(ctx);
  return new Response(JSON.stringify(data, null, 2), {
    headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": 'attachment; filename="meus-dados-kombexa.json"', "Cache-Control": "no-store" },
  });
}
