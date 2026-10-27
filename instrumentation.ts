import type { Instrumentation } from "next";

/**
 * Monitoramento de erros sem serviço externo obrigatório: todo erro do servidor vira uma linha
 * JSON no log (fácil de filtrar no Docker, na hospedagem ou num coletor de logs). Se ERROR_WEBHOOK_URL
 * estiver configurada (Discord, Slack, ntfy...), também chega um aviso curto, sem dados de alunos.
 */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  const e = error as Error & { digest?: string };
  const entry = {
    level: "error", at: new Date().toISOString(), message: e.message, digest: e.digest,
    method: request.method, path: request.path.split("?")[0], route: context.routePath, kind: context.routeType,
  };
  console.error(JSON.stringify(entry));
  const url = process.env.ERROR_WEBHOOK_URL;
  if (!url) return;
  try {
    const text = `Kombexa: erro em ${entry.method} ${entry.path} (${entry.digest ?? "sem código"}): ${entry.message.slice(0, 200)}`;
    await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: text, text }), signal: AbortSignal.timeout(3000) });
  } catch {
    // o aviso nunca pode derrubar a resposta
  }
};
