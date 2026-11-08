# Guia de testes (com os testes do Kombexa)

O Kombexa tem uma suíte de testes **excelente**: 317 testes Vitest (após a auditoria) usando um PostgreSQL de verdade, mais 21 fluxos de navegador com Playwright. Estudar esses testes é uma das melhores formas de entender o sistema, porque cada teste é uma **regra de negócio escrita de um jeito que o computador confere**.

## 1. Os três tipos de teste

```mermaid
flowchart TB
  E2E["Ponta a ponta (E2E)<br/>tests/e2e/*.spec.ts — Playwright<br/>abre o navegador e clica"]
  INT["Integração<br/>tests/*.test.ts que usam o banco<br/>chamam os serviços de verdade"]
  UNI["Unitários<br/>tests/lib.test.ts, money-and-dates...<br/>funções puras, sem banco"]
  UNI --> INT --> E2E
```

| Tipo | O que testa | Velocidade | Exemplo no projeto |
| --- | --- | --- | --- |
| **Unitário** | Uma função sozinha, sem banco | Milissegundos | `lib.test.ts`: "150,90" vira 15090? |
| **Integração** | Serviço + banco real juntos | Dezenas de ms | `automacao-e-presenca.test.ts`: "não marca aluno de outra academia" |
| **E2E** | O sistema inteiro, pelo navegador | Segundos | `fluxos.spec.ts`: "pagamento parcial pela busca..." |

Quanto mais baixo na pirâmide, mais rápido e mais numeroso. O projeto segue isso: centenas de unitários e de integração e algumas dezenas de E2E nos fluxos críticos.

## 2. Ferramentas

| Ferramenta | Arquivo de configuração | Papel |
| --- | --- | --- |
| **Vitest** | `vitest.config.ts` | Unitários e integração |
| **Playwright** | `playwright.config.ts` | Navegador (Chromium), em desktop e celular (Pixel 7) |
| **PostgreSQL real** | `tests/setup.ts` | Banco de teste recriado do zero |
| **GitHub Actions** | `.github/workflows/ci.yml` | Roda tudo a cada push |

Detalhes do `vitest.config.ts` que importam:

```ts
test: {
  include: ["tests/**/*.test.ts"],       // os E2E (tests/e2e/*.spec.ts) ficam com o Playwright
  setupFiles: ["./tests/setup.ts"],     // roda antes: recria o banco de teste
  fileParallelism: false,               // arquivos em sequência: todos usam o mesmo banco
  testTimeout: 20000,
}
```

## 3. Como o banco de teste funciona

```ts
// tests/setup.ts (resumido)
const url = process.env.TEST_DATABASE_URL ?? "postgres://fight:fight@localhost:5432/fight_manager_test";
process.env.DATABASE_URL = url;                        // o app passa a usar o banco de TESTE
await sql.unsafe("drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;");
execSync("node scripts/migrate.mjs", ...);             // aplica todas as migrations
```

> ⚠️ **Por isso `TEST_DATABASE_URL` nunca pode apontar para o banco de verdade**: ele é apagado a cada `npm test`.

E cada teste cria a **própria academia**, isolada das outras:

```ts
// tests/helpers.ts
export async function newAcademy(name = "Academia Teste"): Promise<AcademyContext> {
  // cria academia + administrador + modalidade "Boxe" e devolve o contexto
}
export function studentData(ctx, overrides = {}) {
  // dados válidos de um aluno adulto; você muda só o que quiser
}
```

## 4. Lendo um teste de verdade

```ts
// tests/automacao-e-presenca.test.ts
it("não marca aluno de outra academia", async () => {
  const a = await newAcademy("A");                          // Arrange (preparar)
  const b = await newAcademy("B");
  const s = await createStudent(b, studentData(b));         //   aluno da academia B
  await expect(setPresence(a, s.id, today(), true))         // Act (agir): A tenta marcar
    .rejects.toThrow();                                     // Assert (conferir): tem que falhar
});
```

O padrão **Arrange, Act, Assert** (preparar, agir, conferir) aparece em quase todo teste do projeto. Este, em 5 linhas, prova que o isolamento entre academias funciona para a presença.

## 5. Um teste diferente: o que lê o próprio código

`tests/guardas.test.ts` não chama nenhuma função do sistema. Ele **lê os arquivos** `page.tsx`, `actions.ts` e `route.ts` da área da academia e confere, com expressões regulares, se cada função exportada chama `requireAcademyAdmin` com a permissão esperada para aquela pasta:

```ts
const BY_FOLDER: Record<string, string> = {
  alunos: "alunos", mensalidades: "mensalidades", pagamentos: "pagamentos", ...
};
// exceções conscientes, cada uma com o motivo documentado:
const EXCEPTIONS = { "alunos/actions.ts": { searchStudentsAction: "", saveHealthAction: "saude" }, ... };
```

Se alguém criar `app/(app)/financeiro/nova-coisa/page.tsx` e esquecer o guarda, **o teste quebra antes de ir ao ar**. Uma ideia criativa para proteger uma regra de segurança.

> **Lição da auditoria:** a exceção `searchStudentsAction: ""` estava correta como guarda, mas permissiva demais nos dados (qualquer membro da equipe recebia os resultados). Um teste que confere a *estrutura* do código não substitui um teste que confere o *comportamento*. Por isso a correção veio com `tests/auditoria-permissoes.test.ts`, que chama a action de verdade.

## 6. Testes E2E

```ts
// tests/e2e/helpers.ts
export async function login(page: Page, email = ADMIN.email, password = ADMIN.password) {
  await page.goto("/login");
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.click("button[type=submit]");
  await expect(page).not.toHaveURL(/\/login/);
}
```

Pontos de configuração (`playwright.config.ts`):

- Roda contra o **build de produção** (`next start -p 3200`), e não o `dev`: testa o que vai ao ar.
- Usa um banco próprio (`E2E_DATABASE_URL`), recriado com o seed por `tests/e2e/global-setup.ts`.
- Os e-mails viram arquivos em `test-results/outbox`, e o teste de "esqueci a senha" lê o link de lá.
- `workers: 1`: um teste por vez, porque compartilham o banco.

## 7. Como executar

```bash
npm test                                   # todos os Vitest (~1 min)
npx vitest run tests/lib.test.ts           # só um arquivo
npx vitest run -t "não marca aluno"        # só os testes com esse texto no nome
npx vitest                                 # modo "watch": reroda ao salvar

npm run build && npm run test:e2e          # todos os E2E
npx playwright test tests/e2e/fluxos.spec.ts:21   # um E2E específico (arquivo:linha)
npx playwright show-report                 # relatório HTML depois de uma falha
```

Antes do primeiro E2E: `npx playwright install chromium`.

## 8. Como interpretar uma falha

```text
 FAIL  tests/auditoria-seguranca.test.ts > CSV: injeção de fórmula > neutraliza texto...
AssertionError: expected '\ufeffAluno;Valor\r\n"\'=HYPERLINK(""…' to contain '\'+5511999;-3'
```

Leia nesta ordem:

1. **Qual teste:** arquivo > `describe` > `it`.
2. **O que se esperava × o que veio:** `expected X to contain Y`.
3. **A linha:** o Vitest mostra o trecho do código com uma seta.

Esse exemplo é **real**, da auditoria. O teste esperava que `+5511999` ganhasse um apóstrofo, mas o código, corretamente, não o alterou (é um número, e o Excel não o executa como fórmula). **Quem estava errado era o teste.** Quando um teste falha, pergunte sempre: "o código está errado ou a minha expectativa está?"

Falhas comuns no projeto:

| Mensagem | Causa |
| --- | --- |
| `ECONNREFUSED ...5432` | PostgreSQL desligado |
| `permission denied for schema public` | O banco de teste não pertence ao usuário `fight` |
| `Test timeout of 30000ms exceeded` (E2E) | Servidor lento, build ausente ou navegador com problema |
| `browserType.launch: Executable doesn't exist` | Falta `npx playwright install chromium` |

## 9. Como criar um teste novo

**Passo a passo, usando o modelo do projeto:**

```ts
// tests/meu-assunto.test.ts
import { describe, expect, it } from "vitest";
import { newAcademy, studentData } from "./helpers";
import { createStudent } from "@/services/students";
import { addRank, listRanks } from "@/services/ranks";

describe("graduações", () => {
  it("registra a faixa e ela aparece no histórico do aluno", async () => {
    const ctx = await newAcademy();
    const aluno = await createStudent(ctx, studentData(ctx));
    // ... chame addRank(ctx, aluno.id, {...}) com os campos do rankInput (lib/validation.ts)
    // ... e confira com expect(await listRanks(ctx, aluno.id)).toHaveLength(1)
  });

  it("não registra graduação para aluno de outra academia", async () => {
    // siga o modelo de "não marca aluno de outra academia" (seção 4)
  });
});
```

Os detalhes ficaram para você completar: veja a assinatura de `addRank` em `services/ranks.ts` e os campos de `rankInput` em `lib/validation.ts`. Isso é o exercício 10 de [EXERCICIOS_PRATICOS.md](EXERCICIOS_PRATICOS.md).

**Regras que o projeto segue e você deve seguir:**

1. **Todo serviço novo ganha um teste de isolamento** ("não faz X em outra academia").
2. **Todo bug corrigido ganha um teste de regressão**, e confira que ele **falha sem a correção**. Foi o que a auditoria fez com `auditoria-permissoes.test.ts`: rodou contra o código antigo, viu falhar, aplicou a correção e viu passar.
3. Nome do teste é uma frase que descreve a regra: `"o total é do filtro inteiro, não só da página"`.
4. Cada teste cria os próprios dados (`newAcademy()`); nunca dependa da ordem dos testes.

## 10. Dívida técnica: testes duplicados

Na auditoria, 6 pares de arquivos estavam **idênticos byte a byte** (`auth`/`login`, `business`/`alunos-e-financeiro`, `hardening`/`concorrencia-e-seguranca`, `registration`/`cadastro`, `enrollment`/`convites`, `titular`/`senha-recibo-e-lgpd`), e `v08`, `v09`, `v10`, `v10b`, `accounts` e `money-and-dates` repetem testes já presentes nos arquivos novos. São **118 testes executados duas vezes** (cerca de metade do tempo do `npm test`). Ao renomear os arquivos de inglês para português, os antigos ficaram para trás. Lista exata em `../../relatorios/PENDENCIAS.md`.
