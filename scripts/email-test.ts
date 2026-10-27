/**
 * Testa a configuração de e-mail enviando uma mensagem de verdade.
 * Uso: npm run email:test -- destino@email.com
 * Mostra qual forma de envio está ativa e o erro completo, se houver (ver docs/instalacao.md).
 */
import "./load-env";
import { emailProvider, mailer, smtpConfigFromEnv } from "../lib/email";

async function main() {
  const to = process.argv[2];
  if (!to || !to.includes("@")) throw new Error("Uso: npm run email:test -- destino@email.com");
  const provider = emailProvider();
  console.log(`Forma de envio: ${provider}`);
  console.log(`Remetente (EMAIL_FROM): ${process.env.EMAIL_FROM || "(padrão) Kombexa <nao-responda@kombexa.dev>"}`);
  if (provider === "smtp") {
    const c = smtpConfigFromEnv();
    console.log(`Servidor SMTP: ${c?.host}:${c?.port} (${c?.secure ? "SSL" : "STARTTLS"}), usuário ${c?.user ?? "(sem autenticação)"}`);
  }
  if (provider === "console") console.log("Nenhum serviço configurado: a mensagem vai aparecer abaixo, sem ser enviada.");
  await mailer().send({
    to,
    subject: "Teste de e-mail do Kombexa",
    text: `Se você recebeu esta mensagem, o envio de e-mails está funcionando.\n\nForma de envio: ${provider}\nEnviado em: ${new Date().toLocaleString("pt-BR", { timeZone: process.env.APP_TIMEZONE || "America/Sao_Paulo" })}`,
  });
  console.log(provider === "console" ? "Pronto (modo console)." : `Enviado para ${to}. Confira a caixa de entrada e o spam.`);
}

main().then(() => process.exit(0)).catch((e) => { console.error("Falha ao enviar:", e instanceof Error ? e.message : e); process.exit(1); });
