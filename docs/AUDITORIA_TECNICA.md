# Auditoria técnica do Kombexa

**Data:** 03/11/2026 · **Repositório:** https://github.com/VictorHcss/kombexa · **Branch:** `main` · **Commit:** `258429dfbd074c83fcdb206833b0d0e85b289c97` (27/10/2026) · **Versão:** 0.11.0

## 1. Parecer geral

O Kombexa é um projeto **bem construído**. Recebido sem nenhuma alteração, ele compilou sem erros de tipo, passou no lint, passou em 312 de 312 testes automatizados com banco real, gerou o build de produção e rodou localmente. A arquitetura é coerente e seguida com disciplina, e há cuidados pouco comuns em projetos deste porte: testes de concorrência, um teste que audita os guardas lendo o código-fonte, LGPD tratada de forma concreta e cabeçalhos de segurança completos.

A auditoria encontrou **uma vulnerabilidade de gravidade alta** (links de e-mail envenenáveis, com sequestro de conta pela recuperação de senha), **duas médias** (injeção de fórmula em CSV e uma Server Action que ignorava as permissões da equipe), **dependências com uma falha crítica conhecida** e **um defeito no Dockerfile**. Todos foram corrigidos, com testes de regressão. Os riscos restantes são de **configuração de produção** e estão documentados.

| Área | Nota | Comentário |
| --- | --- | --- |
| Organização e arquitetura | Muito boa | Camadas claras, regra "tela não acessa banco" cumprida |
| Qualidade do código | Muito boa | TypeScript estrito sem erros; nomes e comentários explicativos |
| Banco de dados | Muito boa | Regras críticas garantidas por índices e `CHECK`; schema sincronizado com as migrations |
| Testes | Boa | Extensos e com banco real; **37% redundantes** |
| Segurança | Boa (após correções) | Base sólida; os achados eram pontuais |
| Operação (Docker, backup) | Regular | Backup funcional e testado; compose com padrões de desenvolvimento; Docker não validado aqui |
| Documentação original | Boa | Extensa, com 3 trechos desatualizados |

## 2. Tecnologias identificadas (no código, não no README)

Next.js 16 (App Router, Server Components, Server Actions, Turbopack) · React 19 · TypeScript 6 (`strict`) · PostgreSQL 16 · Drizzle ORM 0.45 + postgres.js · Zod 4 · bcryptjs · Nodemailer / Resend · qrcode · Vitest 5 · Playwright · Docker (Node 22 Alpine) · Docker Compose · GitHub Actions · CSS próprio, sem framework de UI.

Ausentes, apesar de comuns: middleware/proxy do Next, biblioteca de autenticação (a sessão é própria), ORM com Row-Level Security, Redis, filas.

## 3. Arquitetura

Monólito Next.js em camadas: **páginas/actions → guardas → validação → serviços → Drizzle → PostgreSQL**. Multi-tenancy por coluna (`academy_id`), com o tenant sempre vindo da sessão. Detalhes e diagramas em `documentacao/ARQUITETURA.md`.

Pontos fortes:

- Toda Server Action e página começa com um guarda tipado, e `tests/guardas.test.ts` falha se algum for esquecido.
- Gravações que tocam várias tabelas usam transação; pagamentos usam `SELECT ... FOR UPDATE`.
- Auditoria gravada na mesma transação da ação.
- Erros: `DomainError` para mensagens seguras; erro inesperado só no log, em JSON estruturado.

Pontos de atenção:

- O isolamento entre academias depende só da aplicação (sem RLS).
- Limites de tentativa em memória.

## 4. Funcionalidades: classificação

| Funcionalidade | Classificação |
| --- | --- |
| Alunos (cadastro completo, ficha imprimível, status) | Implementada e funcional |
| Responsáveis de menores, inclusive acesso do responsável | Implementada e funcional |
| Multi-academia e isolamento | Implementada e funcional |
| Mensalidades: manual, em lote e automática diária | Implementada e funcional |
| Pagamentos, inclusive parciais e pendentes; cancelamento | Implementada e funcional |
| Recibo com valor por extenso | Implementada e funcional |
| Financeiro, relatórios e CSV | Implementada e funcional |
| Presença manual e lista de "sumidos" | Implementada e funcional |
| Check-in por QR Code | **Parcialmente implementada**: sem leitura por câmera; leitor USB ou digitação |
| Convites (QR, link, e-mail) e aprovação | Implementada e funcional |
| Equipe com 10 permissões por pessoa | Implementada e funcional (uma brecha corrigida) |
| Graduações com histórico | Implementada e funcional (texto livre, sem catálogo de faixas) |
| Carteirinha digital | Implementada e funcional |
| Documentos (ficha e recibos) | Implementada e funcional |
| Comunicados | Implementada e funcional |
| Área do aluno e do responsável | Implementada e funcional |
| Pix copia e cola | Implementada e funcional (**sem** integração bancária) |
| Logo da academia | Implementada e funcional (armazenamento só no banco) |
| LGPD: consentimento, exportação, anonimização | Implementada e funcional |
| Administração da plataforma | Implementada e funcional |
| Auditoria | Implementada e funcional |
| Recuperação de senha e confirmação de e-mail | Implementada e funcional |
| Lembretes por e-mail | Implementada e funcional (envio real não testado: sem credenciais) |
| Status de aluno `suspended` | Em desenvolvimento (existe no banco, sem uso) |
| Armazenamento de logo em S3/R2/GCS | Não encontrada (anunciada como futura) |
| Pagamento online / gateway | Não encontrada |
| Autenticação em dois fatores | Não encontrada |
| Aplicativo nativo | Não encontrada (há PWA) |

Critério: "funcional" significa que existem tela, action, serviço, persistência e teste automatizado, e que o fluxo foi exercitado (Vitest e/ou E2E).

## 5. Achados de segurança

| # | Achado | Gravidade | Status |
| --- | --- | --- | --- |
| S1 | `siteUrl()` confiava em `Host`/`X-Forwarded-Host`: e-mails de redefinição de senha, convite, confirmação e primeiro acesso com link para domínio do atacante. **Explorado com sucesso** | Alta | Corrigido (`APP_URL`) |
| S2 | CSV sem neutralizar fórmulas; o nome do aluno vem do cadastro público | Média | Corrigido |
| S3 | `searchStudentsAction` devolvia contatos e situação financeira a qualquer membro da equipe. **Vazamento demonstrado por teste** | Média | Corrigido |
| S4 | `next` com vulnerabilidade crítica conhecida; `zod`, `sharp` e outros com altas | Crítica/alta | Corrigido (`npm audit fix`, sem `--force`) |
| S5 | Compose com segredos e flags de desenvolvimento como padrão | Média em produção | Documentado |
| S6 | Limites de tentativa em memória; IP de `X-Forwarded-For` | Baixa | Documentado |
| S7 | Sem RLS; isolamento só na aplicação | Baixa (estrutural) | Documentado |
| S8 | Sem 2FA | Baixa | Documentado |

Verificado e **sem problema**: SQL Injection (tudo parametrizado), XSS (React; os dois `dangerouslySetInnerHTML` não recebem texto de usuário), upload (validação por bytes, sem SVG), sessões (hash do token, revogação), enumeração de e-mails, open redirect, clickjacking, CSRF, rota de cron (comparação em tempo constante), segredos no repositório (nenhum real). Detalhes em `documentacao/SEGURANCA.md`.

## 6. Outros achados

| # | Achado | Status |
| --- | --- | --- |
| O1 | `Dockerfile` não copiava `public/`: ícones do PWA com 404 na imagem (simulado) | Corrigido |
| O2 | 118 testes Vitest redundantes (6 pares idênticos + arquivos antigos) e 1 E2E duplicado | Documentado (`PENDENCIAS.md`, P6) |
| O3 | Documentação original: o seed no Docker não funciona como descrito; versões mínimas divergentes; dois trechos de arquitetura desatualizados | Corrigido na nova documentação; originais preservados |
| O4 | Apagar academia com mensalidades provavelmente falharia (CASCADE × RESTRICT) | Documentado; **precisa de validação**; sem impacto hoje |
| O5 | `eslint@9` sem suporte; `@esbuild-kit` obsoleto (via `drizzle-kit`) | Documentado |

## 7. Correções realizadas

| Arquivo | Mudança |
| --- | --- |
| `lib/url.ts` | `APP_URL` como fonte única quando definida; `configuredSiteUrl()` |
| `lib/csv.ts` | `neutralize()` contra injeção de fórmula, preservando números |
| `app/(app)/alunos/actions.ts` | `searchStudentsAction` exige `alunos`, `mensalidades` ou `pagamentos` |
| `package-lock.json` | `npm audit fix` dentro das faixas; `package.json` inalterado |
| `Dockerfile` | `COPY --from=build /app/public ./public` |
| `tests/auditoria-seguranca.test.ts` | novo (4 testes) |
| `tests/auditoria-permissoes.test.ts` | novo (1 teste, 7 cenários) |

Backups dos originais: `relatorios/backup-original/`. Patch: `relatorios/alteracoes-auditoria.patch`, testado com `git apply` numa cópia limpa do commit original. **Nada foi enviado ao GitHub. Nenhum arquivo original foi excluído.**

## 8. Execução local

**O sistema executou localmente de verdade:** migrations, seed, `npm run dev`/`npm start`, login com os perfis, `/api/saude`, scripts administrativos, tarefa diária, backup e restauração. Só **não** foram executados o Docker (indisponível no ambiente) e o envio real de e-mail (sem credenciais).

Resultados completos em `RESULTADO_DOS_TESTES.md`.

## 9. Recomendações (resumo)

1. Definir `APP_URL` em produção.
2. Endurecer o compose para produção (ou criar `docker-compose.prod.yml`).
3. Abrir um Pull Request com o patch e deixar o CI confirmar 21/21 no E2E.
4. Remover os testes redundantes, provando que nenhum se perdeu.
5. Atualizar `docs/` (3 trechos).
6. Persistir os limites de tentativa; avaliar 2FA.
