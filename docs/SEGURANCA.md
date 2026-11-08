# Segurança
## 1. Modelo de autenticação

| Item | Implementação | Arquivo |
| --- | --- | --- |
| Senhas | bcrypt, custo 12; mínimo de 10 caracteres nos scripts de administrador | `lib/auth/password.ts` |
| Sessão | Token aleatório de 32 bytes no cookie `fm_session`; o banco guarda só o SHA-256 | `lib/auth/session.ts` |
| Cookie | `httpOnly`, `SameSite=Lax`, `Secure` em produção, validade de 7 dias | idem |
| Limite de login | 5 erros por e-mail → bloqueio de 15 min (em memória) | `lib/auth/login.ts` |
| Enumeração de e-mails | Bcrypt roda mesmo quando o e-mail não existe; mensagens idênticas | idem |
| Revogação | Trocar ou redefinir a senha, desativar o usuário ou suspender a academia derruba as sessões | `services/users.ts`, `lib/auth/session.ts` |
| Recuperação de senha | Token de 32 bytes, só o hash no banco, 30 min, uso único; pedido novo invalida os antigos | `services/password-reset.ts` |
| CSRF | Server Actions do Next.js conferem a origem; cookie `SameSite=Lax` | — |

## 2. Perfis e permissões

| Perfil | Pode |
| --- | --- |
| `PLATFORM_ADMIN` | Só `/plataforma`: criar academias, suspender e reativar, reenviar acesso. **Não vê dados de alunos.** |
| `ACADEMY_ADMIN` com acesso total (`permissions = null`) | Tudo da própria academia, inclusive gerenciar a equipe |
| `ACADEMY_ADMIN` com lista de permissões | Só as áreas liberadas (10 possíveis: alunos, saúde, mensalidades, pagamentos, presença, financeiro, solicitações, comunicados, configurações, auditoria) |
| `STUDENT` | Só os próprios dados e os dos dependentes, quando é responsável com acesso |

**Como é garantido:** toda página e toda Server Action chama um guarda (`lib/auth/guards.ts`) na primeira linha. O teste `tests/guardas.test.ts` lê o código-fonte e falha se uma tela ou action da área da academia esquecer o guarda ou usar a permissão errada. A auditoria fez uma varredura independente e só encontrou sem guarda as rotas que são públicas por natureza (login, recuperação de senha, convite, saúde).

## 3. Isolamento entre academias

- `academyId` vem **da sessão**, nunca da URL ou do formulário.
- Toda consulta de serviço filtra por `academy_id`; nenhuma função busca registro só pelo ID.
- Na área do aluno, os dados são filtrados pela conta (`ownsOrGuards`).
- Registro de outra academia responde "não encontrado", igual a um inexistente.
- Há testes automatizados de isolamento.

**Limite do modelo:** o isolamento é feito pela aplicação, sem *Row-Level Security* do PostgreSQL. Um serviço novo que esqueça o filtro `academy_id` vazaria dados. Recomendação abaixo.

## 4. Proteção de dados (LGPD)

- Consentimento registrado com data e texto aceito (cadastro, imagem, saúde).
- **Dados de saúde** em seção restrita, com permissão própria (`saude`); a consulta comum do aluno nunca lê `health_notes`.
- **Direito de acesso:** exportação em JSON pela equipe (`/alunos/{id}/exportar`) e pelo próprio aluno (`/aluno/meus-dados`).
- **Direito de eliminação:** `anonymizeStudent` apaga os dados pessoais e mantém o financeiro de forma anônima (obrigação contábil).
- Logs de erro e o webhook de erros não incluem dados de alunos.
- O QR de presença não contém dados pessoais.

## 5. Proteções técnicas verificadas

| Ameaça | Situação |
| --- | --- |
| SQL Injection | Protegido. Todo acesso usa o Drizzle com parâmetros. O único `sql.unsafe` está nos testes (recriar o banco de teste). |
| XSS | Protegido pelo React (escapa tudo). Só há dois `dangerouslySetInnerHTML`: o SVG do QR Code, gerado pela biblioteca `qrcode` a partir de um token do sistema, e o script fixo de tema em `app/layout.tsx`. Nenhum recebe texto do usuário. |
| Clickjacking | `X-Frame-Options: DENY` e `frame-ancestors 'none'` |
| Cabeçalhos | CSP, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, COOP e HSTS em produção (`next.config.ts`) |
| Upload | Só a logo: PNG/JPEG/WebP validados **pelos bytes** (não pela extensão), até 1 MB, de 32 a 4000 px; SVG recusado de propósito; guardado no banco, sem gravar em disco |
| Open redirect | `safeBack()` só aceita caminhos internos (`/...`, nunca `//...`) |
| Concorrência | `SELECT ... FOR UPDATE` em pagamentos; índices únicos contra duplicidade (há testes de concorrência) |
| Cron | Segredo de 16+ caracteres comparado em tempo constante |
| Erros | Mensagem genérica ao usuário; detalhe só no log |

## 6. Variáveis sensíveis

| Variável | Sensível? | Cuidado |
| --- | --- | --- |
| `DATABASE_URL`, `POSTGRES_PASSWORD` | **Sim** | Senha forte em produção |
| `CRON_SECRET` | **Sim** | Valor longo e aleatório (por exemplo, `openssl rand -hex 32`) |
| `SMTP_PASS`, `RESEND_API_KEY` | **Sim** | No Gmail e no Outlook, use "senha de app" |
| `ERROR_WEBHOOK_URL` | Sim (quem tem a URL posta no seu canal) | |
| `ADMIN_PASSWORD` | **Sim** | Só no momento de rodar o script; não deixe no `.env` |
| `APP_URL` | Não, mas **obrigatória em produção** (seção 7.1) | |
| `COOKIE_SECURE=false`, `SHOW_TEST_ACCOUNTS=true` | Inseguras em produção | Só localmente |

O `.env` está no `.gitignore` e no `.dockerignore`. O pacote ZIP desta auditoria **não contém nenhum `.env` real**.

## 7. Riscos encontrados na auditoria

### 7.1 Corrigido: link de redefinição de senha envenenável (gravidade alta)

**Problema.** `lib/url.ts → siteUrl()` montava o endereço dos links dos e-mails a partir dos cabeçalhos `X-Forwarded-Host` e `Host`, que quem faz a requisição controla.

**Ataque demonstrado.** Um pedido em `/esqueci-senha` para o e-mail da vítima, enviado com `X-Forwarded-Host: atacante.example` (e `Origin` combinando, para passar na checagem das Server Actions), fez o sistema enviar um e-mail **legítimo** com o link `http://atacante.example/redefinir-senha/<token>`. Se a vítima clica, o token vai para o atacante, que troca a senha dela. O mesmo valia para convites, confirmação de e-mail e o link de primeiro acesso das academias.

**Correção.** Quando `APP_URL` está definida, ela é a única fonte do endereço; os cabeçalhos só são usados sem `APP_URL` (desenvolvimento). Teste de regressão em `tests/auditoria-seguranca.test.ts`. A prova de conceito foi repetida após a correção, e o link saiu com o endereço configurado.

**Ação necessária do proprietário:** **defina `APP_URL` em produção.** Sem ela, o comportamento antigo continua, e a proteção passa a depender do proxy reverso descartar `X-Forwarded-Host` vindo do cliente.

### 7.2 Corrigido: injeção de fórmula no CSV (média)

O nome do aluno é digitado pela própria pessoa no cadastro público por convite e vai para a exportação de mensalidades. Um nome como `=HYPERLINK("http://...";"clique")` vira fórmula quando o administrador abre o arquivo no Excel. Agora `lib/csv.ts` coloca um apóstrofo antes de textos que começam com `=`, `+`, `-`, `@`, tabulação ou retorno, preservando números como `-5,00`. Teste em `tests/auditoria-seguranca.test.ts`.

### 7.3 Corrigido: busca de alunos ignorava as permissões (média, risco interno)

`searchStudentsAction` aceitava qualquer membro da equipe. Alguém liberado só para "Comunicados" ou "Presença" podia chamar a action diretamente e obter nome, telefone, e-mail, valor da mensalidade e situação de atraso de qualquer aluno. Agora ela só devolve resultados a quem tem `alunos`, `mensalidades` ou `pagamentos`. Teste em `tests/auditoria-permissoes.test.ts`, confirmado: falha no código antigo e passa no novo.

### 7.4 Corrigido: dependências vulneráveis

`npm audit` apontava 28 alertas, sendo **1 crítico** (`next`) e **4 altos** (`zod`, `sharp`, `vite`, `source-map-js`). `npm audit fix`, **sem** `--force`, atualizou o `package-lock.json` dentro das faixas do `package.json` (`next` 16.3.6 → 16.4.4, `zod` 4.6.5 → 4.6.7, `nodemailer` 10.0.12 → 10.3.1, entre outros). Restam **20 moderados, todos em ferramentas de desenvolvimento** (`drizzle-kit` e a cadeia do `eslint`), que não entram na aplicação em produção. Corrigi-los exigiria rebaixar versões maiores (`--force`), o que não foi feito.

### 7.5 Aberto: Docker Compose com padrões de desenvolvimento

Se o `docker-compose.yml` for usado como está num servidor:

| Item | Risco | O que fazer |
| --- | --- | --- |
| `CRON_SECRET` padrão `troque-este-segredo-local` (é público, está no GitHub) | Qualquer pessoa dispara a tarefa diária. Ela é idempotente, então o risco é baixo, mas é uma porta aberta | Definir no `.env` |
| `SHOW_TEST_ACCOUNTS` padrão `true` | Se o seed tiver rodado, a tela de login mostra contas com senha pública | `SHOW_TEST_ACCOUNTS=false` e nunca rodar o seed em produção |
| `COOKIE_SECURE` padrão `false` | Cookie de sessão trafegando sem HTTPS | `COOKIE_SECURE=true` (ou remover a variável) atrás de HTTPS |
| Porta `5432:5432` publicada | Banco acessível de fora, se o firewall permitir | Remover `ports` do serviço `db` ou usar `127.0.0.1:5432:5432` |
| `POSTGRES_PASSWORD` padrão `fight` | Senha conhecida | Senha forte no `.env` |

Esses padrões não foram alterados porque o arquivo é declaradamente para o ambiente local ("Ambiente local: PostgreSQL + aplicação") e mudá-los quebraria a experiência de demonstração. Recomenda-se criar um `docker-compose.prod.yml`.

### 7.6 Aberto: limites de tentativa em memória (baixo)

Os limites de login, cadastro e recuperação de senha ficam na memória do processo:

- com mais de uma instância, cada uma conta separado;
- reiniciar o servidor zera as contagens;
- o IP vem de `X-Forwarded-For` (`lib/url.ts → clientIp`). Sem um proxy que **reescreva** esse cabeçalho, o atacante troca o IP a cada pedido e escapa dos limites por conexão. O limite **por e-mail** do login não é afetado.

Recomendação: guardar as tentativas no PostgreSQL ou no Redis e confiar só no IP informado pelo proxy conhecido.

### 7.7 Aberto: isolamento só na aplicação (baixo, estrutural)

Como dito na seção 3. Mitigação sugerida, em ordem de esforço: (1) manter a regra de revisão "toda consulta nova filtra `academy_id`"; (2) adicionar testes de isolamento para cada serviço novo; (3) avaliar Row-Level Security do PostgreSQL no futuro.

### 7.8 Observação: autenticação em dois fatores

Não existe. Para contas de acesso total e para o administrador da plataforma, seria uma melhoria relevante.

## 8. Recomendações, em ordem de prioridade

1. **Definir `APP_URL`** em toda instalação de produção.
2. **Revisar os padrões do Docker Compose** (seção 7.5) antes de publicar.
3. Rodar `npm audit` mensalmente e `npm audit fix` (sem `--force`).
4. Persistir os limites de tentativa (seção 7.6) se houver mais de uma instância ou se não houver proxy confiável.
5. Proteger os backups: eles contêm dados de saúde (LGPD, dado sensível).
6. Avaliar 2FA para contas de acesso total e da plataforma.
7. Manter o hábito do projeto: todo serviço novo com teste de isolamento entre academias.
