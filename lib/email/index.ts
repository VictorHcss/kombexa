/**
 * Envio de e-mails. O sistema só conhece a interface Mailer; qual implementação é usada
 * depende do ambiente (guia completo em docs/instalacao.md):
 *
 *   EMAIL_PROVIDER=resend  (ou só RESEND_API_KEY)  → Resend, por HTTP (exige domínio verificado)
 *   EMAIL_PROVIDER=smtp    (ou só SMTP_HOST)       → qualquer servidor SMTP: Gmail, Outlook,
 *                                                     Hostinger, Locaweb, Brevo, Amazon SES...
 *   EMAIL_PROVIDER=console (ou nada configurado)   → desenvolvimento: mostra no console e, se
 *                                                     EMAIL_OUTBOX_DIR estiver definida, grava um .json
 *
 * Todo e-mail sai em texto e em HTML simples (links clicáveis), gerado a partir do texto.
 * Nos testes automatizados, useMailer(memoryMailer()) captura as mensagens.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}

export interface Mailer {
  name: string;
  send(message: EmailMessage): Promise<void>;
}

const DEFAULT_FROM = "Kombexa <nao-responda@kombexa.dev>";
const from = () => process.env.EMAIL_FROM || DEFAULT_FROM;

/** HTML simples a partir do texto: escapa, deixa os links clicáveis e separa parágrafos. */
export function textToHtml(text: string): string {
  const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const paragraphs = text.split(/\n{2,}/).map((block) =>
    `<p style="margin:0 0 16px">${escape(block).replace(/https?:\/\/[^\s<]+/g, (url) => `<a href="${url}" style="color:#c53a14">${url}</a>`).replace(/\n/g, "<br>")}</p>`);
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;padding:24px;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#111315">`
    + `<div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;border-top:4px solid #ff4b1f;padding:28px;font-size:15px;line-height:1.55">`
    + `<p style="margin:0 0 20px;font-weight:bold;font-size:17px;letter-spacing:0.06em;text-transform:uppercase;color:#111315">Kombexa</p>${paragraphs.join("")}</div></body></html>`;
}

export function devMailer(): Mailer {
  return {
    name: "console",
    async send(m) {
      console.info(`\n[e-mail de desenvolvimento] para ${m.to}\nAssunto: ${m.subject}\n\n${m.text}\n`);
      const dir = process.env.EMAIL_OUTBOX_DIR;
      if (dir) {
        mkdirSync(dir, { recursive: true });
        writeFileSync(join(dir, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`), JSON.stringify(m, null, 2));
      }
    },
  };
}

/** Envio real pelo Resend, com uma chamada HTTP (sem biblioteca). https://resend.com/docs/api-reference/emails/send-email */
export function resendMailer(apiKey: string, sender: string): Mailer {
  return {
    name: "resend",
    async send(m) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: sender, to: [m.to], subject: m.subject, text: m.text, html: textToHtml(m.text) }),
      });
      if (!res.ok) throw new Error(`Resend respondeu ${res.status}: ${(await res.text()).slice(0, 200)}`);
    },
  };
}

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean; // true na porta 465 (SSL); false na 587, que usa STARTTLS
  user?: string;
  pass?: string;
}

/** Lê SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER e SMTP_PASS. */
export function smtpConfigFromEnv(env = process.env): SmtpConfig | null {
  if (!env.SMTP_HOST) return null;
  const port = Number(env.SMTP_PORT || 587);
  return {
    host: env.SMTP_HOST, port,
    secure: env.SMTP_SECURE ? env.SMTP_SECURE === "true" : port === 465,
    user: env.SMTP_USER || undefined, pass: env.SMTP_PASS || undefined,
  };
}

/** Envio por SMTP (nodemailer). A conexão é criada uma vez e reaproveitada. */
export function smtpMailer(config: SmtpConfig, sender: string): Mailer {
  let transport: Promise<import("nodemailer").Transporter> | null = null;
  const get = () => (transport ??= import("nodemailer").then((nm) => nm.createTransport({
    host: config.host, port: config.port, secure: config.secure,
    auth: config.user ? { user: config.user, pass: config.pass } : undefined,
    connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 20_000,
  })));
  return {
    name: "smtp",
    async send(m) {
      await (await get()).sendMail({ from: sender, to: m.to, subject: m.subject, text: m.text, html: textToHtml(m.text) });
    },
  };
}

export function memoryMailer(): Mailer & { sent: EmailMessage[] } {
  const sent: EmailMessage[] = [];
  return { name: "memória", sent, async send(m) { sent.push(m); } };
}

let override: Mailer | null = null;
let cached: { key: string; mailer: Mailer } | null = null;

/** Para os testes: troca o envio por uma caixa em memória. */
export function useMailer(mailer: Mailer | null) {
  override = mailer;
}

/** Qual forma de envio está configurada (para a tela da plataforma e o comando email:test). */
export function emailProvider(env = process.env): "resend" | "smtp" | "console" {
  const explicit = env.EMAIL_PROVIDER?.toLowerCase();
  if (explicit === "resend" || explicit === "smtp" || explicit === "console") return explicit;
  if (env.RESEND_API_KEY) return "resend";
  if (env.SMTP_HOST) return "smtp";
  return "console";
}

export function mailer(): Mailer {
  if (override) return override;
  const provider = emailProvider();
  const key = `${provider}|${process.env.RESEND_API_KEY ?? ""}|${process.env.SMTP_HOST ?? ""}|${from()}`;
  if (cached?.key === key) return cached.mailer;
  let chosen: Mailer;
  if (provider === "resend") {
    if (!process.env.RESEND_API_KEY) throw new Error("EMAIL_PROVIDER=resend, mas RESEND_API_KEY não está definida.");
    chosen = resendMailer(process.env.RESEND_API_KEY, from());
  } else if (provider === "smtp") {
    const config = smtpConfigFromEnv();
    if (!config) throw new Error("EMAIL_PROVIDER=smtp, mas SMTP_HOST não está definido.");
    chosen = smtpMailer(config, from());
  } else {
    if (process.env.NODE_ENV === "production") console.warn("E-mail não configurado: as mensagens só aparecem no log do servidor. Veja docs/instalacao.md.");
    chosen = devMailer();
  }
  cached = { key, mailer: chosen };
  return chosen;
}

/** Envia sem derrubar a ação principal se o serviço de e-mail falhar: o erro vai para o log. */
export async function sendSafely(message: EmailMessage): Promise<boolean> {
  try {
    await mailer().send(message);
    return true;
  } catch (error) {
    console.error("Falha ao enviar e-mail:", error instanceof Error ? error.message : error);
    return false;
  }
}
