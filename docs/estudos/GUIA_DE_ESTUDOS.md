# Guia de estudos: aprendendo com o próprio Kombexa

Você tem uma vantagem rara: um sistema real, que funciona, com testes, escrito com as ferramentas que você está estudando. Este guia transforma o Kombexa no seu livro-texto.

> O projeto já traz um `docs/guia-de-estudo.md` (do autor, com 1100 linhas). Ele é ótimo como referência. Estes guias complementam aquele com uma trilha de estudo, exemplos explicados linha a linha e exercícios.

## 1. Como usar estes materiais

Não leia tudo de uma vez. A ordem abaixo foi pensada para que **cada etapa use o que a anterior ensinou**. Em cada etapa:

1. Leia o guia indicado.
2. Abra os arquivos citados no VS Code e leia o código de verdade.
3. Faça os exercícios do nível correspondente em [EXERCICIOS_PRATICOS.md](EXERCICIOS_PRATICOS.md).
4. Rode `npm run typecheck && npm test` depois de mexer em algo. Se passar, você não quebrou nada.

**Regra de ouro:** trabalhe numa branch (`git switch -c estudo-01`). Assim você pode experimentar à vontade e voltar com `git switch main`.

## 2. Pré-requisitos

| Você precisa saber... | Se não souber, estude antes |
| --- | --- |
| HTML e CSS básicos | Qualquer curso introdutório |
| JavaScript: variáveis, funções, arrays, objetos, `async/await` | MDN, "Guia JavaScript" |
| Terminal: `cd`, `ls`/`dir`, rodar comandos | 1 hora de prática |
| Git: `clone`, `status`, `add`, `commit`, `switch` | "Git para iniciantes" |

## 3. Trilha recomendada (8 etapas)

| Etapa | Tema | Guia | Arquivos para abrir | Tempo sugerido |
| --- | --- | --- | --- | --- |
| 1 | Colocar para rodar e passear pelo sistema | `../INSTALACAO.md` | — | 1 dia |
| 2 | Visão geral: o que fica onde | [ENTENDENDO_O_PROJETO.md](ENTENDENDO_O_PROJETO.md) e [MAPA_DO_CODIGO.md](MAPA_DO_CODIGO.md) | `package.json`, `app/`, `services/` | 1 dia |
| 3 | TypeScript | [GUIA_TYPESCRIPT.md](GUIA_TYPESCRIPT.md) | `lib/money.ts`, `lib/permissions.ts`, `lib/validation.ts` | 1 semana |
| 4 | Banco de dados | [GUIA_POSTGRESQL.md](GUIA_POSTGRESQL.md) | `db/schema.ts`, `drizzle/0000_init.sql` | 1 semana |
| 5 | React | [GUIA_REACT.md](GUIA_REACT.md) | `components/ui.tsx`, `components/client.tsx`, `*Form.tsx` | 1 semana |
| 6 | Next.js | [GUIA_NEXTJS.md](GUIA_NEXTJS.md) | `app/layout.tsx`, `app/(app)/layout.tsx`, uma página e suas actions | 1 semana |
| 7 | Backend: do formulário ao banco | [GUIA_BACKEND.md](GUIA_BACKEND.md) | `lib/action.ts`, `lib/auth/guards.ts`, `services/payments.ts` | 1 semana |
| 8 | Testes e Docker | [GUIA_TESTES.md](GUIA_TESTES.md), [GUIA_DOCKER.md](GUIA_DOCKER.md) | `tests/`, `Dockerfile`, `docker-compose.yml` | 1 semana |

Os tempos são para quem estuda algumas horas por dia. Se for mais devagar, tudo bem: o importante é entender, não correr.

## 4. Por onde começar a ler o código

Sugestão de leitura em espiral, do mais simples ao mais complexo:

1. **`lib/money.ts`**: funções puras, sem banco, sem React. Ótimo para começar.
2. **`lib/fee-status.ts`**: uma regra de negócio inteira em 4 linhas ("atrasada" é calculada).
3. **`lib/permissions.ts`**: um objeto vira tipo TypeScript.
4. **`db/schema.ts`**: a "planta" do banco.
5. **`services/attendance.ts`**: um serviço pequeno, que lê e grava no banco.
6. **`app/(app)/presenca/`**: a página, a action e o formulário da presença, usando o serviço acima.
7. **`services/payments.ts`**: o serviço mais "sério": transação, trava, auditoria.
8. **`tests/guardas.test.ts`**: um teste que lê o próprio código. Muito criativo.

## 5. Conhecimentos que o Kombexa usa, e onde aparecem

| Conceito | Onde ver no Kombexa |
| --- | --- |
| Tipos e inferência | `db/schema.ts` (`typeof users.$inferSelect`) |
| Union types | `"PLATFORM_ADMIN" \| "ACADEMY_ADMIN" \| "STUDENT"` em `lib/auth/session.ts` |
| Generics | `handleForm<S extends z.ZodType>` em `lib/action.ts` |
| Validação de dados | `lib/validation.ts` (Zod) |
| Server Components | Qualquer `page.tsx` |
| Client Components | Arquivos com `"use client"`, como `components/client.tsx` |
| Server Actions | Arquivos com `"use server"` (`actions.ts`) |
| Hooks | `useActionState`, `useFormStatus`, `useRef`, `useEffect` |
| SQL e índices | `drizzle/*.sql` |
| Transações e travas | `services/payments.ts` (`db.transaction`, `.for("update")`) |
| Segurança web | `lib/auth/`, `next.config.ts`, `../SEGURANCA.md` |
| Testes com banco real | `tests/*.test.ts` |
| Testes de navegador | `tests/e2e/*.spec.ts` |
| Contêineres | `Dockerfile`, `docker-compose.yml` |
| Integração contínua | `.github/workflows/ci.yml` |

## 6. Hábitos de quem programa bem (que este projeto já pratica)

- **Nomes que explicam:** `requireAcademyAdmin`, `recomputeFee`, `safeBack`. Leia o nome e você sabe o que faz.
- **Comentários que explicam o porquê, não o quê.** Veja `lib/auth/login.ts`: "compara mesmo quando o usuário não existe: o tempo de resposta não revela quais e-mails existem".
- **A regra mais importante vira teste.** Isolamento entre academias, concorrência e permissões têm testes próprios.
- **O banco ajuda a garantir as regras** (índices únicos, `CHECK`), além do código.
- **Mensagens de erro em português claro**, pensando em quem usa.

Copie esses hábitos nos seus próximos projetos.

## 7. Quando travar

1. Leia a mensagem de erro **inteira**. Ela costuma dizer o arquivo e a linha.
2. `npm run typecheck` aponta erros de tipo com precisão.
3. Procure no projeto como algo parecido já foi feito (`Ctrl+Shift+F` no VS Code). Quase tudo tem um exemplo pronto aqui dentro.
4. Use `console.log` no servidor: a saída aparece no terminal do `npm run dev`, não no navegador.
5. Volte ao estado bom: `git stash` ou `git checkout -- arquivo`.
