import { expect, test } from "@playwright/test";
import { login, toast } from "./helpers";

// v0.7: aluno cria conta sem academia, a academia adiciona pelo e-mail; a plataforma cria academias.

test("aluno cria conta sem academia e a academia adiciona e aprova pelo e-mail", async ({ page }) => {
  const email = `marcos${Date.now()}@teste.dev`;
  await page.goto("/login");
  await page.getByRole("link", { name: "Criar conta" }).click();
  await page.fill("#name", "Marcos Teixeira");
  await page.fill("#email", email);
  await page.fill("#phone", "(33) 99111-2233");
  await page.fill("#birthDate", "1990-05-05");
  await page.fill("#password", "senha-do-marcos");
  await page.fill("#confirm", "senha-do-marcos");
  await page.check("input[name=consent]");
  await page.getByRole("button", { name: "Criar minha conta" }).click();
  await expect(page.locator(".no-academy")).toContainText(email);

  await page.context().clearCookies();
  await login(page);
  await page.goto("/solicitacoes");
  await page.fill("#add-email", email);
  await page.getByRole("button", { name: "Adicionar", exact: true }).click();
  const card = page.locator(".request", { hasText: "Marcos Teixeira" });
  await expect(card).toContainText("adicionado pela academia");
  await card.locator("select[name=modalityId]").selectOption({ label: "Boxe" });
  await card.locator("input[name=monthlyFee]").fill("150,00");
  await card.getByRole("button", { name: "Aprovar como novo aluno" }).click();
  await expect(toast(page)).toContainText("Entrada aprovada");

  await page.context().clearCookies();
  await login(page, email, "senha-do-marcos");
  await expect(page.locator(".hero")).toBeVisible(); // agora vê a situação na academia
});

test("plataforma cria a academia e o responsável entra pelo link de acesso", async ({ page }) => {
  const email = `dono${Date.now()}@academia.dev`;
  await login(page, "plataforma@kombexa.dev");
  // com academias cadastradas, o formulário fica recolhido em "Nova academia"
  const create = page.locator("details.create-academy");
  if (!(await create.getAttribute("open") !== null)) await create.locator("summary").click();
  await page.fill("#academyName", "Academia Tigre Branco");
  await page.fill("#adminName", "Carla Dias");
  await page.fill("#adminEmail", email);
  await page.getByRole("button", { name: "Criar academia e enviar acesso" }).click();
  const link = await page.locator(".access-link input").inputValue();
  await expect(page.locator(".academy-list")).toContainText(email);

  await page.context().clearCookies();
  await page.goto(new URL(link).pathname);
  await page.fill("#next", "senha-da-carla-1");
  await page.fill("#confirm", "senha-da-carla-1");
  await page.click("button[type=submit]");
  await expect(page.locator(".alert--ok")).toContainText("Senha redefinida");
  await login(page, email, "senha-da-carla-1");
  await expect(page.locator(".sidebar-brand")).toContainText("Academia Tigre Branco");
});

test("criar conta de academia não é público", async ({ page }) => {
  await page.goto("/criar-conta");
  await expect(page.locator("main")).not.toContainText("Nome da academia");
  await expect(page.locator("main")).toContainText("equipe do Kombexa");
});
