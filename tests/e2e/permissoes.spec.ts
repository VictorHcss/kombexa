// Permissões na prática: a recepção (acesso personalizado) só vê e só abre o que foi liberado,
// e cada perfil fica na própria área. O teste estático tests/guardas.test.ts cobre todas as rotas;
// este confere, no navegador, o que a pessoa realmente vê.
import { expect, test } from "@playwright/test";
import { login } from "./helpers";

const RECEPCAO = "recepcao@academia.dev"; // alunos, mensalidades, pagamentos e solicitações
const DENIED = "não tem permissão";

test("recepção: o menu mostra só o que foi liberado", async ({ page }) => {
  await login(page, RECEPCAO);
  const menu = page.locator(".sidebar-nav");
  // pelo endereço do link: o nome de "Solicitações" inclui o contador de pedidos
  for (const href of ["/", "/alunos", "/mensalidades", "/pagamentos", "/solicitacoes"]) await expect(menu.locator(`a[href="${href}"]`), href).toBeVisible();
  for (const href of ["/financeiro", "/relatorios", "/presenca", "/auditoria"]) await expect(menu.locator(`a[href="${href}"]`), href).toHaveCount(0);
  await expect(page.locator("main")).not.toContainText("Caixa do mês"); // números do financeiro no Início
});

test("recepção: digitar o endereço de uma área bloqueada volta com aviso", async ({ page }) => {
  await login(page, RECEPCAO);
  for (const path of ["/financeiro", "/relatorios", "/presenca", "/auditoria", "/financeiro/novo"]) {
    await page.goto(path);
    await expect(page, path).not.toHaveURL(new RegExp(`${path}$`));
    await expect(page.locator("main"), path).toContainText(DENIED);
  }
  // a exportação do financeiro também é bloqueada (não baixa nada)
  const res = await page.request.get("/financeiro/exportar", { maxRedirects: 0 });
  expect(res.status()).toBeGreaterThanOrEqual(300);
  expect(res.status()).toBeLessThan(400);
});

test("recepção: configurações só com a própria senha; perfil sem a aba de saúde", async ({ page }) => {
  await login(page, RECEPCAO);
  await page.goto("/configuracoes?aba=academia");
  await expect(page.getByRole("link", { name: "Academia", exact: true })).toHaveCount(0);
  await expect(page.locator("main")).toContainText("Minha senha");
  await expect(page.locator("main")).not.toContainText("Adicionar pessoa à equipe");

  await page.goto("/alunos");
  await page.locator("tbody tr td.primary a").first().click();
  await expect(page.locator(".tabs")).not.toContainText("Saúde");
  await page.goto(`${page.url().split("?")[0]}?aba=saude`);
  await expect(page.locator("main")).not.toContainText("Dados de saúde");
});

test("cada perfil fica na própria área", async ({ page }) => {
  await login(page, "aluno@academia.dev");
  await page.goto("/alunos");
  await expect(page).toHaveURL(/\/aluno$/);
  await page.goto("/plataforma");
  await expect(page).not.toHaveURL(/\/plataforma/);

  await page.context().clearCookies();
  await login(page, "plataforma@kombexa.dev");
  await page.goto("/mensalidades");
  await expect(page).toHaveURL(/\/plataforma/);

  await page.context().clearCookies();
  await page.goto("/configuracoes");
  await expect(page).toHaveURL(/\/login/);
});

test("acesso total muda o acesso da recepção e vale na hora", async ({ browser }) => {
  const admin = await browser.newPage();
  const recepcao = await browser.newPage();
  await login(recepcao, RECEPCAO);
  await recepcao.goto("/presenca");
  await expect(recepcao.locator("main")).toContainText(DENIED);

  await login(admin);
  await admin.goto("/configuracoes?aba=acesso");
  const camila = admin.locator(".team-list > li", { hasText: RECEPCAO });
  await camila.getByText("Alterar acesso").click();
  await camila.getByLabel(/Presença/).check();
  await camila.getByRole("button", { name: "Salvar acesso" }).click();
  await expect(admin.locator(".team-list > li", { hasText: RECEPCAO }).locator(".team-perms")).toContainText("Presença");

  await recepcao.goto("/presenca");
  await expect(recepcao.locator("main")).not.toContainText(DENIED);
  await expect(recepcao.getByRole("heading", { name: "Presença" })).toBeVisible();

  // volta como estava para os outros testes
  await admin.goto("/configuracoes?aba=acesso");
  const again = admin.locator(".team-list > li", { hasText: RECEPCAO });
  await again.getByText("Alterar acesso").click();
  await again.getByLabel(/Presença/).uncheck();
  await again.getByRole("button", { name: "Salvar acesso" }).click();
  await expect(admin.locator(".team-list > li", { hasText: RECEPCAO }).locator(".team-perms")).not.toContainText("Presença");
});
