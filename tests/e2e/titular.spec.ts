import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { login, toast } from "./helpers";

const OUTBOX = "test-results/outbox";
const lastEmailTo = (to: string) => {
  const files = readdirSync(OUTBOX).sort().reverse();
  for (const f of files) {
    const m = JSON.parse(readFileSync(join(OUTBOX, f), "utf8")) as { to: string; text: string };
    if (m.to === to) return m;
  }
  throw new Error(`nenhum e-mail para ${to}`);
};

test("recuperação de senha pelo link do e-mail", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("link", { name: "Esqueci minha senha" }).click();
  await page.fill("#email", "admin@academia.dev");
  await page.click("button[type=submit]");
  await expect(page.locator(".alert--ok")).toContainText("Se houver uma conta com esse e-mail");

  const link = lastEmailTo("admin@academia.dev").text.match(/https?:\/\/\S+\/redefinir-senha\/\S+/)![0];
  await page.goto(new URL(link).pathname);
  await page.fill("#next", "nova-senha-do-admin");
  await page.fill("#confirm", "nova-senha-do-admin");
  await page.click("button[type=submit]");
  await expect(page.locator(".alert--ok")).toContainText("Senha redefinida");
  await login(page, "admin@academia.dev", "nova-senha-do-admin");

  await page.goto(new URL(link).pathname); // o link não funciona duas vezes
  await expect(page.locator("main")).toContainText("expirou, já foi usado ou não existe");

  // volta a senha do exemplo para os outros testes
  await page.goto("/configuracoes?aba=acesso");
  await page.fill("#current", "nova-senha-do-admin");
  await page.fill("#next", "kombexa123");
  await page.fill("#confirm", "kombexa123");
  await page.getByRole("button", { name: "Trocar senha" }).click();
  await expect(toast(page)).toContainText("Senha alterada");
});

test("recibo do pagamento, com valor por extenso", async ({ page }) => {
  await login(page);
  await page.goto("/pagamentos?status=paid");
  await page.locator("tbody tr").first().getByRole("link", { name: "Recibo" }).click();
  await expect(page.locator(".receipt")).toContainText("Recebemos de");
  await expect(page.locator(".receipt-body")).toContainText(/reais|real|centavos/);
  await expect(page.locator(".receipt")).toContainText("sem valor fiscal");
});

test("exportar e eliminar os dados de um aluno (LGPD)", async ({ page }) => {
  await login(page);
  await page.goto("/alunos?status=inactive");
  await page.locator("td.primary a").first().click(); // Juliana Martins, inativa no exemplo
  await expect(page).toHaveURL(/\/alunos\/[0-9a-f-]{36}/);
  await expect(page.locator(".profile-head h1")).not.toBeEmpty();
  const profile = page.url().split("?")[0];
  const name = (await page.locator(".profile-head h1").innerText()).trim();

  await page.click(".menu > summary");
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Exportar dados (LGPD)" }).click();
  const file = await (await download).path();
  expect(JSON.parse(readFileSync(file!, "utf8")).aluno.nome).toBe(name);

  await page.goto(`${profile}?aba=info`);
  await page.getByRole("button", { name: "Eliminar dados pessoais" }).click();
  await page.fill("#confirmation", "talvez");
  await page.getByRole("button", { name: "Eliminar definitivamente" }).click();
  await expect(page.locator(".erase-form .alert--danger")).toContainText("Digite ELIMINAR");
  await page.fill("#confirmation", "ELIMINAR");
  await page.getByRole("button", { name: "Eliminar definitivamente" }).click();
  await expect(toast(page)).toContainText("Dados pessoais eliminados");
  await expect(page.locator(".profile-head h1")).toContainText("Aluno removido");
  await page.goto("/auditoria");
  await expect(page.locator(".content")).not.toContainText(name);
});
