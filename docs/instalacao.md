# Instalação e operação

Do zero até o sistema rodando, e como mantê-lo no ar: instalação, desenvolvimento, publicação, e-mail, backup, tarefa diária e problemas comuns.

- [Instalação e configuração](#instalação-e-configuração)
- [Desenvolvimento](#desenvolvimento)
- [Publicação em produção](#publicação-em-produção)
- [Configurar o envio de e-mails](#configurar-o-envio-de-e-mails)
- [Backup, restauração e monitoramento](#backup-restauração-e-monitoramento)
- [Problemas comuns](#problemas-comuns)

## Instalação e configuração

### Variáveis de ambiente

Copie `.env.example` para `.env`:

| Variável | Uso |
| --- | --- |
| `DATABASE_URL` | Conexão com o PostgreSQL da aplicação |
| `TEST_DATABASE_URL` | Banco usado pelos testes (é apagado e recriado a cada execução; nunca aponte para o banco real) |
| `POSTGRES_PASSWORD` | Senha do PostgreSQL no `docker-compose.yml` |
| `APP_TIMEZONE` | Fuso usado para "hoje" e atrasos (padrão `America/Sao_Paulo`) |
| `COOKIE_SECURE` | `false` apenas para testar o build de produção sem HTTPS em rede local |

O `.env` está no `.gitignore` e no `.dockerignore`. Nenhuma senha ou token fica no código.

### Com Docker

```bash
cp .env.example .env
docker compose up -d --build
docker compose exec app npm run db:seed    # opcional
```

- Aplicação: http://localhost:3000
- PostgreSQL: localhost:5432 (usuário `fight`, banco `fight_manager`)
- As migrations rodam automaticamente sempre que o container da aplicação inicia.

| Ação | Comando |
| --- | --- |
| Subir | `docker compose up -d --build` |
| Parar | `docker compose down` |
| Logs | `docker compose logs -f app` (ou `db`) |
| Migrations | `docker compose exec app npm run db:migrate` |
| Seed | `docker compose exec app npm run db:seed` |
| Reset do banco (apaga tudo) | `docker compose down -v && docker compose up -d --build` |

### Sem Docker

1. Instale Node.js 20+ e PostgreSQL 14+.
2. Crie os bancos: `createdb fight_manager` e `createdb fight_manager_test`.
3. `npm install`, `cp .env.example .env` e ajuste as URLs.
4. `npm run db:migrate` e, se quiser, `npm run db:seed`.
5. `npm run dev` para desenvolvimento, ou `npm run build && npm start` para produção.

Reset sem Docker: `dropdb fight_manager && createdb fight_manager && npm run db:migrate`.

### Contas

- Com o seed, todas com a senha `kombexa123`: `plataforma@kombexa.dev` (plataforma), `admin@academia.dev` (academia), `aluno@academia.dev` (aluno aprovado), `pendente@academia.dev` (aluno aguardando aprovação) e `semacademia@academia.dev` (aluno sem academia). A tela de login mostra essas contas em desenvolvimento ou com `SHOW_TEST_ACCOUNTS=true`.
- Os scripts (`db:migrate`, `db:seed`, `db:create-admin`, `email:test`) leem o `.env` da raiz sozinhos; variáveis já definidas no ambiente têm prioridade.
- E-mail: veja a seção "Configurar o envio de e-mails" mais abaixo.
- Uso real: crie o administrador da plataforma com `ADMIN_PASSWORD="..." npm run db:create-platform-admin -- "Seu Nome" voce@email.com` e, pela tela `/plataforma`, as academias. O script `ADMIN_PASSWORD="..." npm run db:create-admin -- "Academia" "Nome" email@dominio.com` continua disponível para criar uma academia direto pelo terminal.

## Desenvolvimento

### Rotina

```bash
npm run dev         # servidor de desenvolvimento
npm test            # testes (PostgreSQL real, banco de TEST_DATABASE_URL)
npm run typecheck   # checagem de tipos
npm run build       # build de produção
```

### Onde colocar cada coisa

- **Regra de negócio ou consulta nova:** em `services/`, recebendo o `AcademyContext` e filtrando por `academyId`.
- **Validação de formulário:** em `lib/validation.ts` (Zod), com mensagens em português.
- **Ação de formulário:** `actions.ts` da página, sempre começando com `requireAcademyAdmin()`.
- **Mudança no banco:** edite `db/schema.ts` e rode `npm run db:generate`; revise o SQL gerado em `drizzle/`.

Cuidado conhecido: em subconsultas SQL escritas à mão, refira-se à coluna externa com o nome da tabela por extenso (`fees.id`), não com `${fees.id}`. Em consultas de uma só tabela, o Drizzle omite o nome da tabela e `id` passaria a apontar para a tabela interna. Há um teste de regressão para isso.

### Ferramentas

- **TypeScript 6.0**, fixado de propósito: o TypeScript 7 ainda não é suportado pelo `typescript-eslint`, usado no lint do Next.js.
- **Lint:** `npm run lint` (regras do Next.js para React, hooks e acessibilidade básica, e TypeScript).
- **Integração contínua:** `.github/workflows/ci.yml` roda tipos, lint, testes, build e ponta a ponta com um PostgreSQL real.

### Testes

`tests/setup.ts` apaga o schema do banco de testes, aplica as migrations e cada teste cria a própria academia (`tests/helpers.ts`), então os testes não dependem uns dos outros.

| Arquivo | O que testa |
| --- | --- |
| `lib.test.ts` | Funções puras, sem banco: centavos, datas e fuso, validações, CSV, Pix copia e cola, chave Pix e permissões |
| `alunos-e-financeiro.test.ts` | Cadastro e pesquisa de alunos, isolamento entre academias, mensalidades, pagamentos e financeiro |
| `cadastro.test.ts` | CPF e CNPJ, modalidades, menores e responsáveis, irmãos, saúde restrita, configuração inicial |
| `convites.test.ts` | Convite, cadastro pelo convite, aprovação, vínculo, recusa e visão do aluno |
| `contas.test.ts` | Conta de aluno sem academia, academia adicionando pelo e-mail, academia criada pela plataforma |
| `login.test.ts` | Hash de senha, login, usuário inativo, academia suspensa e limite de tentativas |
| `concorrencia-e-seguranca.test.ts` | Totais do filtro inteiro, paginação, consentimento, sessões e operações simultâneas |
| `senha-recibo-e-lgpd.test.ts` | Recuperação de senha, valor por extenso, recibo, exportação e eliminação de dados |
| `equipe.test.ts` | Suspender e reativar academias, permissões da equipe |
| `area-do-aluno.test.ts` | Telefone do aluno, contato da academia, confirmação de e-mail, área do responsável |
| `automacao-e-presenca.test.ts` | Tarefa diária (geração automática e lembretes, com data fixa) e presença |
| `guardas.test.ts` | Lê o código e confere que toda tela, action e rota da academia chama a guarda com a permissão certa |
| `e2e/*.spec.ts` | No navegador: login, pagamento, convite, contas, celular, senha e recibo, e permissões da recepção |


#### Ponta a ponta (`tests/e2e`, Playwright)

Rodam no navegador contra o build de produção e um banco próprio (`E2E_DATABASE_URL`), recriado com os dados de exemplo: login, pagamento pela busca com erro de validação e cancelamento, geração de mensalidades, convite com aprovação e área do aluno, criança com responsável, saúde e ficha, totais e paginação, e navegação no celular. Uma confirmação nativa do navegador em qualquer fluxo faz o teste falhar.

Antes desses, também foram feitos testes de ponta a ponta no navegador sobre o build de produção: login, pagamento parcial e cancelamento, financeiro, auditoria, acesso a outra academia pela URL, telas no celular e no computador, busca de aluno, janela de confirmação, filtros recolhíveis, geração de mensalidades, área do aluno e o fluxo completo do convite (menor de idade barrado, cadastro, fila isolada por academia, aprovação, vínculo com aluno existente, área do aluno e revogação do código). Ele não faz parte do `npm test`.

## Publicação em produção

O `Dockerfile` gera uma imagem de produção que aplica as migrations pendentes e inicia o servidor na porta 3000.

### Checklist

1. **PostgreSQL gerenciado** (ou um container com volume persistente e backup automático).
2. **Variáveis:** `DATABASE_URL` apontando para o banco de produção, `APP_TIMEZONE=America/Sao_Paulo`. **Não defina `COOKIE_SECURE=false`.**
3. **HTTPS obrigatório** (o cookie de sessão é `Secure`). Use o HTTPS do provedor ou um proxy como Caddy ou Nginx.
4. **Primeiro acesso:** `ADMIN_PASSWORD="..." npm run db:create-admin -- "Academia" "Nome" email` dentro do container. **Não rode o seed em produção.**
5. **Backups diários** do banco. O histórico financeiro não pode ser recriado.
6. **E-mail:** para a recuperação de senha funcionar, crie uma conta no Resend, verifique o domínio (registros SPF e DKIM no DNS) e defina `RESEND_API_KEY` e `EMAIL_FROM`. Sem isso, os e-mails só aparecem no log do servidor.
7. **Uma instância** da aplicação, ou aceite que o limite de tentativas de login seja contado por instância.

### Exemplo com a própria imagem

```bash
docker build -t kombexa .
docker run -d -p 3000:3000 -e DATABASE_URL="postgres://usuario:senha@host:5432/fight_manager" kombexa
docker exec -it <container> sh -c 'ADMIN_PASSWORD="..." npm run db:create-admin -- "Academia" "Nome" email@dominio.com'
```

### Observações

- A imagem inclui as dependências de desenvolvimento, porque o `tsx` é usado pelos scripts de administração. Uma imagem mais enxuta (modo `standalone` do Next.js) fica como melhoria.
- Os logs de erro saem na saída padrão do container (`docker logs`).
- O sistema envia `noindex` para buscadores: é uma ferramenta interna.

## Configurar o envio de e-mails

O Kombexa envia e-mails em quatro situações:

| E-mail | Quando | Para quem |
|---|---|---|
| Link de acesso da academia | O administrador da plataforma cria uma academia, ou gera um novo link | Responsável pela academia |
| Recuperação de senha | Alguém usa "Esqueci minha senha" | Dono da conta |
| Convite por e-mail | A academia envia o convite em "Convidar alunos" | Futuro aluno |
| Teste | `npm run email:test -- destino@email.com` | Quem você escolher |

Sem configuração, **nenhum e-mail é enviado**: as mensagens aparecem no console do servidor (no Docker, em `docker compose logs app`). Isso basta para desenvolver, mas não para uso real. Em especial, sem e-mail o responsável por uma academia nova não recebe o link de acesso, e a plataforma precisa copiar o link da tela e enviar por outro meio.

Todos os e-mails saem em texto e em HTML simples, com os links clicáveis.

### Resumo rápido

1. Escolha a forma de envio: **SMTP** (a mais fácil para começar, serve Gmail, Outlook ou o e-mail do seu domínio) ou **Resend** (melhor entrega em produção, exige domínio próprio).
2. Preencha as variáveis no `.env`, como nos exemplos abaixo.
3. Reinicie a aplicação (`npm run dev` de novo, ou `docker compose up -d` no Docker).
4. Teste: `npm run email:test -- seu@email.com`. No Docker: `docker compose exec app npm run email:test -- seu@email.com`.

### Variáveis

| Variável | Para que serve | Exemplo |
|---|---|---|
| `EMAIL_PROVIDER` | `smtp`, `resend` ou `console`. Vazio: escolhe sozinho (Resend se houver `RESEND_API_KEY`, senão SMTP se houver `SMTP_HOST`, senão console) | `smtp` |
| `EMAIL_FROM` | Remetente que aparece para quem recebe. Precisa ser um endereço que o serviço autoriza você a usar | `Academia Punho de Ferro <nao-responda@punhodeferro.com.br>` |
| `RESEND_API_KEY` | Chave da API do Resend | `re_123...` |
| `SMTP_HOST` | Servidor SMTP | `smtp.gmail.com` |
| `SMTP_PORT` | Porta. Use 587 (STARTTLS) ou 465 (SSL) | `587` |
| `SMTP_SECURE` | `true` na porta 465; `false` na 587. Vazio: decide pela porta | `false` |
| `SMTP_USER` | Usuário do SMTP (quase sempre o e-mail) | `contato@punhodeferro.com.br` |
| `SMTP_PASS` | Senha do SMTP ou senha de app | `abcd efgh ijkl mnop` |
| `EMAIL_OUTBOX_DIR` | Só desenvolvimento: grava cada e-mail como `.json` nesta pasta | `.outbox` |

As variáveis ficam no `.env`, que não vai para o Git. Nunca coloque senhas ou chaves no código. No Docker Compose, o `docker-compose.yml` já repassa todas elas do `.env` para a aplicação.

### Opção 1: SMTP

Serve para qualquer provedor que ofereça SMTP. Para começar ou para pouco volume (dezenas de e-mails por dia), é o caminho mais simples.

#### Gmail

O Gmail não aceita a senha normal da conta por SMTP. É preciso uma **senha de app**:

1. Ative a verificação em duas etapas na Conta Google (Segurança → Verificação em duas etapas).
2. Em Segurança → Senhas de app, crie uma senha para "Kombexa". O Google mostra 16 letras; copie.
3. No `.env`:

```env
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=suaacademia@gmail.com
SMTP_PASS=abcdefghijklmnop
EMAIL_FROM=Academia Punho de Ferro <suaacademia@gmail.com>
```

No Gmail, o `EMAIL_FROM` precisa ser o próprio endereço (ou um alias configurado nele). Contas gratuitas têm limite diário de envio (em torno de 500 mensagens), suficiente para uma academia.

#### Outlook / Microsoft 365

```env
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=contato@suaacademia.com.br
SMTP_PASS=sua-senha-ou-senha-de-app
EMAIL_FROM=Academia Punho de Ferro <contato@suaacademia.com.br>
```

No Microsoft 365, o administrador pode precisar liberar o "SMTP autenticado" para a caixa. Contas com verificação em duas etapas usam senha de app. Contas pessoais (outlook.com, hotmail.com) usam `smtp-mail.outlook.com`, mas a Microsoft vem restringindo SMTP nessas contas. Para uso real, prefira o e-mail do seu domínio ou o Resend.

#### E-mail do seu domínio (Hostinger, Locaweb, KingHost, HostGator, cPanel...)

O painel da hospedagem mostra servidor, porta e usuário na página da conta de e-mail. Alguns valores comuns (confira no seu painel, porque mudam com o tempo):

| Provedor | Servidor | Porta |
|---|---|---|
| Hostinger | `smtp.hostinger.com` | 465 (SSL) |
| Locaweb | `email-ssl.com.br` | 465 (SSL) |
| KingHost | `smtp.kinghost.net` | 587 |
| cPanel em geral | `mail.seudominio.com.br` | 465 (SSL) ou 587 |

Exemplo com porta 465:

```env
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=nao-responda@suaacademia.com.br
SMTP_PASS=senha-da-caixa
EMAIL_FROM=Academia Punho de Ferro <nao-responda@suaacademia.com.br>
```

Crie uma caixa só para o sistema (por exemplo `nao-responda@`). Assim a senha do e-mail principal não fica no servidor.

#### Serviços de envio com SMTP (Brevo, Amazon SES, Mailgun, SendGrid)

Todos oferecem SMTP, além da API. Crie a conta, verifique o domínio (veja "Não cair no spam", abaixo), gere as credenciais SMTP no painel e preencha as mesmas cinco variáveis. Exemplo com o Brevo:

```env
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=seu-login-smtp-do-brevo
SMTP_PASS=sua-chave-smtp-do-brevo
EMAIL_FROM=Academia Punho de Ferro <nao-responda@suaacademia.com.br>
```

### Opção 2: Resend

O Resend envia por uma chamada HTTP (sem SMTP). É a opção recomendada para produção com domínio próprio.

1. Crie uma conta em https://resend.com.
2. Em **Domains**, adicione o seu domínio (por exemplo `suaacademia.com.br`) e crie no DNS os registros que o Resend mostrar (SPF, DKIM e, de preferência, DMARC). A verificação costuma levar de minutos a algumas horas.
3. Em **API Keys**, crie uma chave com permissão de envio.
4. No `.env`:

```env
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_sua_chave
EMAIL_FROM=Academia Punho de Ferro <nao-responda@suaacademia.com.br>
```

O `EMAIL_FROM` precisa usar o domínio verificado. Sem domínio verificado, o Resend só entrega para o e-mail da sua própria conta, o que serve apenas para testes.

### Não cair no spam

Para e-mails de um domínio próprio, três registros no DNS fazem toda a diferença. O serviço de envio (Resend, Brevo, SES, sua hospedagem) mostra os valores exatos; você só cria os registros no painel onde o domínio está (Registro.br, Cloudflare, Hostinger...).

- **SPF** (registro TXT no domínio): diz quais servidores podem enviar pelo seu domínio. Exemplo: `v=spf1 include:_spf.resend.com ~all`. Tenha **um único** registro SPF; se já existir um, acrescente o `include:` nele em vez de criar outro.
- **DKIM** (registro TXT ou CNAME): assinatura que prova que a mensagem não foi alterada. O serviço gera a chave.
- **DMARC** (registro TXT em `_dmarc.seudominio.com.br`): diz o que fazer com mensagens que falham nas verificações. Para começar: `v=DMARC1; p=none; rua=mailto:voce@seudominio.com.br`.

Outras boas práticas:

- Use um remetente do mesmo domínio verificado. Um remetente `@gmail.com` enviado por outro serviço quase sempre cai no spam.
- Mantenha um nome reconhecível no remetente, como o nome da academia.
- Depois de configurar, envie um teste para um Gmail e confira em "Mostrar original" se SPF, DKIM e DMARC aparecem como `PASS`.

### Testar a configuração

```bash
npm run email:test -- seu@email.com
# no Docker:
docker compose exec app npm run email:test -- seu@email.com
```

O comando mostra a forma de envio ativa, o remetente e o servidor, e envia uma mensagem de verdade. Se algo falhar, ele mostra o erro completo do serviço. Na aplicação, uma falha de envio não interrompe a ação principal: a academia é criada e o pedido de senha é registrado, e o erro vai para o log do servidor. Por isso, teste antes de colocar em uso.

### Em desenvolvimento

Sem configurar nada, os e-mails aparecem no terminal de `npm run dev`:

```text
[e-mail de desenvolvimento] para admin@academia.dev
Assunto: Redefinir sua senha no Kombexa
...
```

Para guardar cada e-mail como arquivo, use `EMAIL_OUTBOX_DIR=.outbox`. Para ver os e-mails numa caixa de entrada falsa, com HTML, rode um servidor de teste como o Mailpit (`docker run -p 1025:1025 -p 8025:8025 axllent/mailpit`) e configure:

```env
EMAIL_PROVIDER=smtp
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_SECURE=false
```

As mensagens aparecem em http://localhost:8025. No Docker Compose, use o nome do serviço do Mailpit no lugar de `localhost`.

### Problemas comuns

| Mensagem ou sintoma | Causa provável | O que fazer |
|---|---|---|
| `Invalid login: 535` | Usuário ou senha do SMTP errados | No Gmail e no Outlook, use senha de app. Confira se `SMTP_USER` é o e-mail completo |
| `Greeting never received` ou `Connection timeout` | Porta bloqueada ou `SMTP_SECURE` trocado | Porta 465 pede `SMTP_SECURE=true`; porta 587 pede `false`. Alguns provedores de nuvem bloqueiam a porta 25 e às vezes a 587: tente a 465 |
| `wrong version number` / `SSL routines` | `SMTP_SECURE=true` na porta 587 | Use `SMTP_SECURE=false` na 587 |
| `self-signed certificate` | Servidor da hospedagem com certificado próprio | Use o nome de servidor que o provedor indica (normalmente com o certificado certo) |
| `Resend respondeu 403` | Domínio não verificado ou `EMAIL_FROM` de outro domínio | Termine a verificação do domínio e use um remetente dele |
| `Resend respondeu 422` | `EMAIL_FROM` mal formatado | Use `Nome <email@dominio>` |
| O teste funciona, mas o e-mail não chega | Caiu no spam | Configure SPF, DKIM e DMARC (veja acima) |
| Nada acontece e o log mostra `[e-mail de desenvolvimento]` | Nenhuma forma de envio configurada | Preencha o `.env` e reinicie a aplicação |
| No Docker, o `.env` foi alterado e nada mudou | O contêiner não foi recriado | `docker compose up -d` (recria com as novas variáveis) |

### Onde está o código

- `lib/email/index.ts`: escolha da forma de envio, Resend, SMTP e o HTML dos e-mails.
- `scripts/email-test.ts`: o comando `npm run email:test`.
- Textos dos e-mails: `services/accounts.ts` (acesso da academia), `services/password-reset.ts` (senha) e `services/invites.ts` (convite).
- Testes: os testes automatizados trocam o envio por uma caixa em memória (`useMailer(memoryMailer())`), então nunca enviam e-mails de verdade.

## Backup, restauração e monitoramento

### Backup automático

Com Docker Compose, o serviço `backup` faz um `pg_dump` por dia em `./backups` e apaga os arquivos com mais de `BACKUP_KEEP_DAYS` dias (padrão: 14).

```bash
docker compose up -d backup          # liga o backup diário
docker compose logs backup           # confere se rodou
docker compose run --rm backup sh /backup.sh   # backup agora, fora do horário
```

Sem Docker: `DATABASE_URL=postgres://... BACKUP_DIR=/caminho sh scripts/backup.sh` (agende no cron, por exemplo `0 3 * * *`).

**Importante:** um backup guardado só no mesmo servidor some junto com ele. Copie `./backups` para outro lugar (outro servidor, um bucket S3/R2/Backblaze, Google Drive com rclone).

### Restaurar

```bash
# banco vazio de destino
createdb -U fight fight_manager_restaurado
pg_restore --no-owner --dbname=postgres://fight:fight@localhost:5432/fight_manager_restaurado backups/kombexa-AAAA-MM-DD_HHMM.dump
```

Teste a restauração de vez em quando: backup que nunca foi restaurado não é garantia.

### Monitoramento

- **Erros do servidor:** cada erro vira uma linha JSON no log (`"level":"error"`, com rota e código). Com `ERROR_WEBHOOK_URL`, também chega um aviso curto no Discord, Slack ou ntfy. O aviso não leva dados de alunos.
- **Disponibilidade:** `GET /api/saude` responde `{"ok":true}` quando o sistema e o banco estão no ar (status 503 se o banco cair). Cadastre essa URL num monitor gratuito como UptimeRobot ou Better Stack.

### Tarefa diária (mensalidades automáticas e lembretes)

`POST /api/tarefas/diarias` com o cabeçalho `Authorization: Bearer <CRON_SECRET>`. Sem `CRON_SECRET` (mínimo de 16 caracteres), a rota responde 401 e nada roda. No Docker Compose, o serviço `scheduler` chama de hora em hora; fora dele, use o cron do servidor com `npm run jobs:daily`. A tarefa é idempotente: rodar várias vezes no mesmo dia não gera mensalidade nem lembrete repetido. Defina `APP_URL` com o endereço público, para os links dos e-mails.

## Problemas comuns

**"DATABASE_URL não configurada"**: crie o `.env` a partir do `.env.example` (sem Docker) ou confira o `docker-compose.yml`.

**A aplicação não conecta ao banco no Docker**: o host do banco dentro do Compose é `db`, não `localhost`. Veja o estado com `docker compose ps` e os logs com `docker compose logs db`.

**Login não funciona no build de produção sem HTTPS**: em produção o cookie de sessão é `Secure`. No `docker compose` local isso já vem desligado (`COOKIE_SECURE=false`). Não desligue em um servidor público.

**"Muitas tentativas"**: espere 15 minutos ou reinicie o servidor (a contagem fica em memória).

**A porta 5432 está em uso**: outro PostgreSQL está rodando. Pare-o ou troque a porta publicada no `docker-compose.yml`.

**Os testes apagaram meus dados**: `TEST_DATABASE_URL` precisa apontar para um banco separado (`fight_manager_test`). Os testes recriam esse banco do zero a cada execução.

**Mensalidade não aparece como atrasada no dia do vencimento**: é o comportamento esperado. Ela só fica atrasada a partir do dia seguinte, no horário de Brasília.

**Não consigo editar uma mensalidade**: ela já recebeu pagamento. Cancele o pagamento primeiro.

### Limitações conhecidas

- Páginas de registro inexistente (ou de outra academia) mostram a mensagem de "não encontrado", mas respondem com status HTTP 200 em vez de 404, por causa do carregamento em streaming do Next.js. Nenhum dado é exibido.
- Não há paginação: as listas mostram até 100 ou 200 registros e os filtros encontram os demais.
- A execução com Docker foi preparada, mas **não foi testada no ambiente em que o projeto foi desenvolvido** (sem Docker disponível). Migrations, testes e build de produção foram verificados contra um PostgreSQL real fora de container.
