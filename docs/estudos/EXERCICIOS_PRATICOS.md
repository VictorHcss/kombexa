# Exercícios práticos

17 exercícios progressivos, todos sobre o código real do Kombexa. **Não há respostas prontas**: há pistas, arquivos de referência e um critério objetivo para você saber que terminou.

**Antes de cada exercício:**

```bash
git switch main && git switch -c exercicio-NN
```

**Critério comum a todos** (além do critério específico): `npm run typecheck`, `npm run lint` e `npm test` passando. Se você quebrou algo, os testes avisam.

Os exercícios marcados com ★ resolvem algo que **de fato falta** no sistema hoje e podem virar contribuições reais.

---

## Nível iniciante

### 1. Conhecendo o sistema pelos olhos de cada perfil

- **Objetivo:** entender o produto antes do código.
- **Conceitos:** perfis, permissões, multi-academia.
- **Arquivos:** `lib/test-accounts.ts`, `lib/permissions.ts`.
- **Desafio:** com o seed rodado, entre com `admin@academia.dev`, `recepcao@academia.dev`, `aluno@academia.dev`, `responsavel@academia.dev` e `plataforma@kombexa.dev` (senha `kombexa123`). Para cada um, anote quais menus aparecem. Depois, logado como recepção, digite na barra de endereço `/financeiro`.
- **Critério:** uma tabela "perfil × telas que vê" e a explicação, com o nome da função, de por que a recepção **não** entrou em `/financeiro` (pista: `lib/auth/guards.ts`).

### 2. Lendo e testando uma função pura

- **Objetivo:** ler TypeScript com calma e escrever o primeiro teste.
- **Conceitos:** tipos de parâmetro e retorno, `null`, testes unitários.
- **Arquivos:** `lib/money.ts`, `tests/lib.test.ts`.
- **Desafio:** antes de rodar, preveja o resultado de `parseMoney("1.234,5")`, `parseMoney("R$ 10")`, `parseMoney("10,999")`, `parseMoney("-5")` e `formatMoney(-123456)`. Depois crie `tests/meus-testes.test.ts` conferindo suas previsões.
- **Critério:** 5 asserções passando, e um comentário explicando qualquer previsão que você errou.

### 3. O compilador como aliado

- **Objetivo:** sentir o `Record` e o `as const` trabalhando.
- **Conceitos:** `Record<K, V>`, `keyof typeof`, uniões literais.
- **Arquivos:** `lib/fee-status.ts`, `lib/labels.ts`, `lib/permissions.ts`.
- **Desafio:** (a) apague temporariamente a linha `overdue: "Atrasada",` de `FEE_STATUS_LABEL` e leia o erro do `npm run typecheck`; desfaça. (b) Em `lib/labels.ts`, crie e exporte `type PaymentMethodKey = keyof typeof PAYMENT_METHODS` e uma função `paymentMethodLabel(key: PaymentMethodKey): string`.
- **Critério:** explicar em 2 frases o que o erro do item (a) protege; a função do item (b) compila e `paymentMethodLabel("dinheiro")` **não** compila (teste isso e desfaça).

### 4. Um componente com uma prop nova

- **Objetivo:** props opcionais e renderização condicional.
- **Conceitos:** componentes, props, `ReactNode`, `&&`.
- **Arquivos:** `components/ui.tsx` (`Card`), `app/styles/componentes.css`.
- **Desafio:** adicione ao `Card` uma prop opcional `footer?: ReactNode`, desenhada numa `<div className="card-foot">` no fim do cartão **só quando existir**. Use-a no cartão "Pendências" do Início (`app/(app)/page.tsx`) com um texto como "Atualizado agora".
- **Critério:** os outros cartões continuam iguais (nenhum ganhou uma `div` vazia; confira no inspetor do navegador) e o do Início mostra o rodapé.

### 5. Sua primeira página no App Router

- **Objetivo:** criar rota, layout e metadados.
- **Conceitos:** `page.tsx`, rota pública, `metadata`, Server Component.
- **Arquivos:** `app/sem-acesso/page.tsx` (modelo de página pública simples), `app/layout.tsx`.
- **Desafio:** crie `/sobre`, uma página pública que mostre o nome do sistema e a versão lida do `package.json` (pista: `import pkg from "@/package.json"`, já que o `tsconfig` tem `resolveJsonModule`).
- **Critério:** `http://localhost:3000/sobre` abre **sem login**; a aba do navegador mostra o título que você definiu; no `npm run build`, a rota aparece como `○ (Static)`. Explique por que ela é estática e `/alunos` não.

### 6. SQL sobre dados reais

- **Objetivo:** fazer perguntas ao banco.
- **Conceitos:** `SELECT`, `JOIN`, `LEFT JOIN`, `GROUP BY`, `HAVING`.
- **Arquivos:** `GUIA_POSTGRESQL.md` (seção 9), `db/schema.ts`.
- **Desafio:** escreva as 4 consultas da seção 9 do guia de PostgreSQL.
- **Critério:** os números batem com o que o sistema mostra nas telas (por exemplo, a quantidade de alunos por modalidade bate com o filtro da tela `/alunos`).

---

## Nível intermediário

### 7. Uma regra de validação nova, com teste

- **Objetivo:** mudar uma regra de negócio de ponta a ponta.
- **Conceitos:** Zod, mensagens por campo, `safeParse`.
- **Arquivos:** `lib/validation.ts` (`announcementInput`), `app/(app)/comunicados/AnnouncementForm.tsx`, `tests/kombexa.test.ts` (procure `"valida o formulário"`).
- **Desafio:** o título do comunicado deve ter **no mínimo 5 caracteres**, com a mensagem "Use pelo menos 5 caracteres no título.".
- **Critério:** um teste novo com `announcementInput.safeParse` aceitando "Feriado" e recusando "Oi"; na tela, ao enviar "Oi", a mensagem aparece embaixo do campo e o texto digitado **não se perde**.

### 8. Contador de caracteres (estado no cliente)

- **Objetivo:** `useState` e eventos.
- **Conceitos:** campo controlado × não controlado, `onChange`, renderização.
- **Arquivos:** `app/(app)/comunicados/AnnouncementForm.tsx` (o `<textarea name="body" maxLength={4000}>`), `app/(app)/alunos/StudentForm.tsx` (exemplo de `useState` com `onChange`).
- **Desafio:** mostre "1234 / 4000" embaixo do texto do comunicado, atualizando enquanto a pessoa digita; o contador fica vermelho acima de 3800.
- **Critério:** o contador começa com o tamanho correto ao **editar** um comunicado existente; o envio continua funcionando; você consegue explicar por que manteve `defaultValue` em vez de passar para `value`.

### 9. ★ Exportar a presença do dia em CSV

- **Objetivo:** criar um Route Handler protegido.
- **Conceitos:** `route.ts`, guarda, `searchParams`, CSV, isolamento.
- **Arquivos:** `app/(app)/financeiro/exportar/route.ts` (modelo), `services/attendance.ts` (`attendanceDay`), `lib/csv.ts`, `tests/guardas.test.ts`.
- **Desafio:** `GET /presenca/exportar?data=AAAA-MM-DD` devolve um CSV com nome do aluno, modalidade e "Presente"/"Ausente". Sem `data`, usa hoje (no fuso da academia). Coloque um botão "Exportar CSV" na tela de presença.
- **Critério:** (a) o CSV abre no Excel com acentos certos; (b) logado como alguém **sem** a permissão `presenca`, a rota não entrega os dados; (c) `tests/guardas.test.ts` continua passando **sem** você adicionar exceção (por quê? pista: `BY_FOLDER`).

### 10. Testes de graduação, do seu jeito

- **Objetivo:** escrever testes de integração com banco.
- **Conceitos:** Arrange-Act-Assert, `newAcademy`, isolamento.
- **Arquivos:** `services/ranks.ts` (`addRank(ctx, studentId, data)`, `listRanks`), `lib/validation.ts` (`rankInput`: `rank`, `awardedAt`, `modalityId`, `awardedBy`, `notes`), `tests/helpers.ts`, `GUIA_TESTES.md` (seção 9).
- **Desafio:** **sem olhar** os testes existentes, escreva: (1) registrar duas graduações e conferir que `listRanks` traz a mais recente primeiro; (2) a academia A não registra graduação para aluno da academia B. **Depois** compare com o `describe("graduações")` de `tests/kombexa.test.ts`.
- **Critério:** seus testes passam; você anota uma coisa que o teste original cobre e o seu não (ou o contrário).

### 11. Uma função genérica

- **Objetivo:** escrever generics.
- **Conceitos:** `<T, K>`, inferência, tipos de retorno.
- **Arquivos:** `lib/action.ts` (generic real do projeto), `services/reports.ts`.
- **Desafio:** em `lib/collections.ts`, crie `groupBy<T, K extends string>(items: T[], key: (item: T) => K): Record<K, T[]>`, com testes. Use-a em algum lugar real (por exemplo, agrupar alunos por modalidade num relatório).
- **Critério:** ao passar o mouse no resultado de `groupBy(alunos, (a) => a.status)`, o VS Code mostra `Record<"active" | ..., Aluno[]>` (e não `any`); 3 testes passando.

---

## Nível avançado

### 12. ★ Ler o QR Code pela câmera

- **Objetivo:** recurso do navegador, segurança e acessibilidade juntos.
- **Conceitos:** Client Component, `useEffect` com limpeza, APIs do navegador, `Permissions-Policy`.
- **Arquivos:** `app/(app)/presenca/CheckInForm.tsx`, `services/checkin.ts` (formato `KBX1:CODIGO`), `next.config.ts`.
- **Desafio:** adicione um botão "Usar câmera" que abre a câmera do celular ou tablet e lê o QR (pesquise a API `BarcodeDetector` e o suporte nos navegadores). Ao ler, preencha o campo e envie. **Atenção:** hoje `next.config.ts` envia `Permissions-Policy: camera=()`, que **bloqueia** a câmera de propósito. Você terá de mudar para `camera=(self)`, e deve justificar a mudança.
- **Critério:** funciona num celular real (via HTTPS ou `localhost`); sem suporte à API, o botão nem aparece e o campo manual continua funcionando; a câmera é **desligada** ao sair da tela (confira o indicador do celular); um parágrafo no PR explica o impacto de segurança da mudança de política.

### 13. ★ Catálogo de faixas por modalidade (migration nova)

- **Objetivo:** mudar o banco com segurança.
- **Conceitos:** modelagem, FK, índice único, migration, isolamento.
- **Arquivos:** `db/schema.ts` (`studentRanks`, `modalities`), `drizzle/0003_cadastro_completo.sql` (exemplo de migration com cópia de dados), `services/ranks.ts`, `app/(app)/configuracoes/`.
- **Desafio:** hoje a graduação é texto livre ("Faixa azul, 2º grau"). Crie a tabela `rank_levels` (academia, modalidade, nome, ordem), com nome único por modalidade, e uma tela em Configurações para cadastrar as faixas. No perfil do aluno, a graduação passa a ser escolhida da lista **quando** a modalidade tiver faixas cadastradas (sem lista, continua o texto livre: **nada pode quebrar para quem já usa**).
- **Critério:** `npm run db:generate` gera a migration e você **leu** o SQL; as graduações antigas continuam aparecendo; teste de isolamento (A não usa faixa de B); a guarda da nova action é `configuracoes`.

### 14. ★ Limites de tentativa que sobrevivem a reinícios

- **Objetivo:** resolver uma pendência real da auditoria.
- **Conceitos:** concorrência, `INSERT ... ON CONFLICT`, janela de tempo, limpeza.
- **Arquivos:** `lib/rate-limit.ts`, `lib/auth/login.ts`, `../SEGURANCA.md` (item 7.6).
- **Desafio:** troque o `Map` em memória por uma tabela `rate_limit_hits` (chave, momento), mantendo a **mesma assinatura** de `allow(key, max, windowMs)`, só que agora `async`. Ajuste quem chama. Apague registros vencidos de forma barata.
- **Critério:** os testes de login e de limites continuam passando; um teste novo prova que o limite vale entre "instâncias" (duas chamadas com o estado em memória zerado no meio continuam bloqueadas); explique como você evitou que duas requisições simultâneas passassem do limite.

### 15. Limpeza dos testes duplicados (sem perder cobertura)

- **Objetivo:** refatorar com segurança, provando que nada se perdeu.
- **Conceitos:** cobertura, diff, disciplina de refatoração.
- **Arquivos:** `tests/`, `../../relatorios/PENDENCIAS.md` (lista dos redundantes).
- **Desafio:** antes de apagar, gere a lista de todos os nomes de teste (`npx vitest list` ou `grep -h "it(" tests/*.test.ts`). Apague os arquivos redundantes. Gere a lista de novo.
- **Critério:** **todo** nome de teste que existia antes ainda existe depois (use `comm` ou um script para provar); `npm test` passa e ficou mais rápido (meça o antes e o depois).

### 16. Validar o Docker de ponta a ponta

- **Objetivo:** fechar a pendência que a auditoria não pôde executar.
- **Conceitos:** imagem, volume, rede, variáveis, healthcheck.
- **Arquivos:** `Dockerfile`, `docker-compose.yml`, `GUIA_DOCKER.md` (seção 6).
- **Desafio:** faça o exercício guiado do `GUIA_DOCKER.md`. Depois crie `docker-compose.prod.yml` com os ajustes de `../SEGURANCA.md` (item 7.5): sem porta do banco publicada, sem valores padrão para segredos (falha se faltar), `SHOW_TEST_ACCOUNTS=false`, `COOKIE_SECURE=true` e `APP_URL` obrigatória.
- **Critério:** `docker compose -f docker-compose.prod.yml config` falha com uma mensagem clara quando falta `CRON_SECRET`; com tudo definido, sobe e responde em `/api/saude`; resultado anotado em `PENDENCIAS.md`.

### 17. Desafio final: uma funcionalidade inteira

- **Objetivo:** juntar tudo.
- **Conceitos:** todos.
- **Arquivos:** `GUIA_BACKEND.md` (checklist final), `MAPA_DO_CODIGO.md`.
- **Desafio:** escolha e implemente **uma**: (a) "aniversariantes do mês" no Início, com botão de WhatsApp (pista: `lib/whatsapp.ts`); (b) congelamento de matrícula (usar o status `suspended`, que existe no banco e hoje não é usado: ele não deve gerar mensalidades); (c) relatório de inadimplência por modalidade com gráfico.
- **Critério:** schema (se preciso) → validação → serviço com `ctx` e filtro de academia → action com guarda → tela → testes (regra **e** isolamento) → `npm run build` → um E2E cobrindo o caminho feliz. Escreva um parágrafo em `docs/changelog.md` como o autor faz.

---

## Como saber se aprendeu

Depois do nível intermediário, você deve conseguir responder sem consultar:

1. Por que toda Server Action começa com um guarda, mesmo que a tela já esconda o botão?
2. Onde está a garantia de que uma academia não vê os dados de outra: no banco, no serviço ou na tela?
3. Por que o sistema guarda R$ 150,90 como `15090`?
4. O que acontece, passo a passo, quando duas pessoas registram pagamento da mesma mensalidade ao mesmo tempo?
5. Por que "atrasada" não é uma coluna?

Depois do avançado: explique o problema de segurança que a auditoria encontrou em `lib/url.ts`, como ele foi explorado e por que a correção depende de `APP_URL`.
