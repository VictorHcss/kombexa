import { expect, test } from "@playwright/test";
import { brl, confirmDialog, login, toast } from "./helpers";

// Um diálogo nativo do navegador em qualquer fluxo é um defeito: todas as confirmações são do sistema.
test.beforeEach(({ page }) => {
  page.on("dialog", (d) => { throw new Error(`Diálogo nativo inesperado: ${d.message()}`); });
});

test("login: senha errada mantém o e-mail; senha certa entra", async ({ page }) => {
  await page.goto("/login");
  await page.fill("#email", "admin@academia.dev");
  await page.fill("#password", "errada");
  await page.click("button[type=submit]");
  await expect(page.locator(".alert--danger")).toHaveText("E-mail ou senha incorretos.");
  await expect(page.locator("#email")).toHaveValue("admin@academia.dev");
  await page.fill("#password", "kombexa123");
  await page.click("button[type=submit]");
  await expect(page.locator(".attention-card").first()).toBeVisible();
});

test("pagamento parcial pela busca, erro que não perde as escolhas, e cancelamento", async ({ page }) => {
  await login(page);
  await page.goto("/pagamentos/novo");
  // parte do telefone do Victor: o exemplo sempre cria para ele a mensalidade do mês seguinte, em aberto
  await page.fill("#studentId", "99812");
  await expect(page.locator(".combo-list li[role=option]").first()).toContainText("Victor Almeida");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/aluno=/);
  // a URL muda antes de o servidor responder: espera as mensalidades do aluno chegarem
  await expect(page.locator("#feeId")).toBeVisible();
  // com as mensalidades na tela, o saldo em aberto precisa estar sugerido (se não, é defeito, não demora)
  await expect(page.locator("#amount")).not.toHaveValue("", { timeout: 1000 });
  const balance = Math.round(Number((await page.inputValue("#amount")).replace(/\./g, "").replace(",", ".")) * 100);

  // erro de validação: a forma e a situação escolhidas continuam escolhidas
  await page.selectOption("#method", "cash");
  await page.selectOption("#status", "pending");
  await page.fill("#amount", "abc");
  await page.click(".content form.card button[type=submit]");
  await expect(page.locator(".field-error").first()).toBeVisible();
  await expect(page.locator("#method")).toHaveValue("cash");
  await expect(page.locator("#status")).toHaveValue("pending");

  await page.selectOption("#status", "paid");
  await page.fill("#amount", "10");
  await page.locator("#paidAt").click();
  await expect(page.locator("#amount")).toHaveValue("10,00");
  await page.click(".content form.card button[type=submit]");
  await expect(toast(page)).toContainText("Pagamento registrado");
  const profile = page.url().split("?")[0];
  await page.goto(`${profile}?aba=mensalidades`);
  // a mensalidade escolhida ficou com o saldo menos R$ 10 (o total do aluno depende do dia do mês:
  // no começo do mês o exemplo tem duas em aberto, por isso a conferência é na linha da mensalidade)
  await expect(page.locator("tbody")).toContainText(brl(balance - 1000));
  await expect(page.locator(".situation")).toContainText("em aberto");

  await page.goto(`${profile}?aba=pagamentos`);
  const row = page.locator("tbody tr").first();
  await row.getByRole("button", { name: "Cancelar" }).click();
  await row.locator("input[name=reason]").fill("Lançado em duplicidade");
  await row.getByRole("button", { name: "Confirmar" }).click();
  await expect(page.locator("dialog.modal[open]")).toContainText("R$ 10,00");
  await confirmDialog(page);
  await expect(toast(page)).toContainText("Pagamento cancelado");
});

test("geração de mensalidades do mês não duplica", async ({ page }) => {
  await login(page);
  for (const expected of [/\d+ mensalidade\(s\) gerada\(s\)/, /^0 mensalidade\(s\) gerada\(s\)/]) {
    await page.goto("/mensalidades/gerar");
    await page.fill("#reference", "2028-04");
    await page.click(".content button[type=submit]");
    await expect(toast(page)).toHaveText(expected);
  }
});

test("convite: menor barrado, adulto aguarda aprovação e depois vê a própria área", async ({ page, browser }) => {
  await login(page);
  await page.goto("/convidar");
  const code = (await page.locator(".invite-code strong").innerText()).trim();

  const visitor = await (await browser.newContext()).newPage();
  const fill = async (birth: string, email: string) => {
    await visitor.goto(`/convite/${code}`);
    await visitor.fill("#name", "Fernanda Alves");
    await visitor.fill("#phone", "(33) 99555-4411");
    await visitor.fill("#email", email);
    await visitor.fill("#birthDate", birth);
    await visitor.fill("#password", "senha-da-fe-12");
    await visitor.fill("#confirm", "senha-da-fe-12");
    await visitor.check("input[name=consent]");
    await visitor.click("button[type=submit]");
  };
  await fill("2014-01-01", "menor@aluno.dev");
  await expect(visitor.locator(".field-error")).toContainText("maiores de 18 anos");
  await fill("1995-02-11", "fernanda@aluno.dev");
  await expect(visitor.locator(".alert", { hasText: "está em análise" })).toBeVisible();

  await page.goto("/solicitacoes");
  const card = page.locator(".card", { hasText: "Fernanda Alves" });
  await card.locator("select[name=modalityId]").selectOption({ label: "Jiu-Jitsu" });
  await card.getByRole("button", { name: "Aprovar como novo aluno" }).click();
  await expect(toast(page)).toContainText("Entrada aprovada");

  await visitor.goto("/aluno");
  await expect(visitor.locator(".hero")).toContainText("Você está em dia");
  await visitor.goto("/alunos");
  await expect(visitor).toHaveURL(/\/aluno$/); // aluno não entra nas telas da academia
});

test("criança com a responsável do irmão, saúde restrita e ficha de matrícula", async ({ page }) => {
  await login(page);
  await page.goto("/alunos/novo");
  await page.fill("#name", "Sofia Souza");
  await page.fill("#birthDate", "2017-05-20");
  await expect(page.locator(".guardian-box")).toBeVisible();
  await page.selectOption("#modalityId", { label: "Boxe Infantil" });
  await expect(page.locator("#monthlyFee")).toHaveValue("110,00");
  await page.getByRole("radio", { name: "Já cadastrado (irmãos)" }).click();
  await page.fill("input[aria-label='Buscar responsável']", "juliana");
  await page.locator(".guardian-box .combo-list li").first().click();
  await page.fill("#guardianRelationship", "Mãe");
  await page.click(".content form button[type=submit]");
  await expect(toast(page)).toContainText("Aluno cadastrado");
  await expect(page.locator(".guardian-item").first()).toContainText("Juliana Souza");
  await expect(page.locator(".btn--whatsapp")).toContainText("Juliana");
  const profile = page.url().split("?")[0];

  await page.goto(`${profile}?aba=saude`);
  await page.fill("#notes", "Asma leve.");
  await page.click(".content form button[type=submit]");
  await expect(page.locator(".field-error")).toContainText("Consentimento");
  await page.check("input[name=consent]");
  await page.click(".content form button[type=submit]");
  await expect(toast(page)).toContainText("saúde");
  await page.goto(`${profile}?aba=info`);
  await expect(page.locator(".content")).not.toContainText("Asma");

  await page.goto(`${profile}/ficha`);
  await expect(page.locator(".sheet")).toContainText("Juliana Souza, responsável legal");
  await expect(page.locator(".sheet")).not.toContainText("Asma");
  await page.goto(`${profile}/ficha?saude=1`);
  await expect(page.locator(".sheet")).toContainText("Asma");
});

test("listas mostram o total do filtro inteiro e paginam", async ({ page }) => {
  await login(page);
  await page.goto("/mensalidades");
  const title = await page.locator(".card-head h2").first().innerText();
  const total = Number(title.match(/^(\d+) mensalidade/)?.[1]);
  expect(total).toBeGreaterThan(0);
  await expect(page.locator(".pagination")).toContainText(`de ${total}`);
});
