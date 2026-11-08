import { headers } from "next/headers";

/**
 * Endereço público do site, usado nos links dos e-mails (redefinição de senha, convites,
 * confirmação de e-mail, primeiro acesso) e no link do convite.
 *
 * SEGURANÇA: quando APP_URL está configurada, ela é a única fonte. Os cabeçalhos Host e
 * X-Forwarded-Host vêm de quem faz a requisição e podem ser forjados: sem isso, um atacante
 * pede a recuperação de senha de outra pessoa com "X-Forwarded-Host: site-dele" e o e-mail
 * legítimo sai com o link (e o token) apontando para o site do atacante.
 * Sem APP_URL (desenvolvimento), continua usando a requisição, como antes.
 */
export async function siteUrl(): Promise<string> {
  const configured = configuredSiteUrl();
  if (configured) return configured;
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? (process.env.NODE_ENV === "production" ? "https" : "http");
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  return `${proto.split(",")[0]}://${host}`;
}

/** APP_URL normalizada (só protocolo, host e porta), ou null se ausente ou inválida. */
export function configuredSiteUrl(value = process.env.APP_URL): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0].trim() || h.get("x-real-ip") || "local";
}
