# Instalação do Kombexa

Este manual cobre dois caminhos:

- **Caminho A, sem Docker**: Node.js e PostgreSQL instalados na máquina. Foi o caminho **executado e verificado** na auditoria (Ubuntu 24.04, Node 22.22, PostgreSQL 16.15).
- **Caminho B, com Docker Compose**: sobe banco, aplicação, agendador e backup. **Não pôde ser executado na auditoria** (Docker indisponível no ambiente). Os comandos vêm dos arquivos reais (`Dockerfile`, `docker-compose.yml`), e o conteúdo da imagem foi simulado; ainda assim, trate-o como **precisa de validação** na primeira vez.

Os comandos estão em **Linux/macOS (bash)** e, quando a sintaxe muda, em **Windows PowerShell**.

---

## 1. Instalar as ferramentas

| Ferramenta | Versão recomendada | Por quê |
| --- | --- | --- |
| Node.js | **22 LTS** | É a versão do `Dockerfile` (`node:22-alpine`) e do CI. O código usa `process.loadEnvFile`, que só existe a partir do Node 20.12/21.7. |
| npm | 10 (vem com o Node 22) | O projeto tem `package-lock.json` (npm). |
| PostgreSQL | **16** | É a versão do `docker-compose.yml` e do CI. |
| Git | qualquer recente | Para clonar. |
| Docker Desktop | opcional | Só para o caminho B. |

**Windows (PowerShell, com winget):**

```powershell
winget install OpenJS.NodeJS.LTS
winget install PostgreSQL.PostgreSQL.16
winget install Git.Git
# feche e abra o PowerShell, depois confira:
node -v   # deve mostrar v22.x
npm -v
psql --version
```

> Se o `psql` não for encontrado no Windows, adicione `C:\Program Files\PostgreSQL\16\bin` ao PATH. Durante a instalação do PostgreSQL, anote a senha do usuário `postgres`.

**Ubuntu/Debian:**

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs postgresql git
```

**macOS (Homebrew):**

```bash
brew install node@22 postgresql@16 git
brew services start postgresql@16
```

## 2. Clonar o repositório

```bash
git clone https://github.com/VictorHcss/kombexa.git
cd kombexa
```

Se você recebeu o pacote `KOMBEXA_COMPLETO.zip`, o código já está em `KOMBEXA/projeto/`: extraia e entre nessa pasta.

## 3. Instalar as dependências

```bash
npm ci
```

`npm ci` instala exatamente as versões do `package-lock.json` (mais previsível que `npm install`). Na auditoria levou cerca de 15 s e instalou 431 pacotes. Os avisos `deprecated` sobre `@esbuild-kit` e `eslint@9` são esperados e não impedem nada (ver [MANUTENCAO.md](MANUTENCAO.md)).

## 4. Configurar o arquivo de ambiente

```bash
cp .env.example .env
```

```powershell
Copy-Item .env.example .env
```

O `.env.example` já funciona para desenvolvimento local, **se** o PostgreSQL tiver o usuário `fight` com senha `fight` (passo 5). As variáveis mais importantes:

| Variável | Obrigatória | Para quê |
| --- | --- | --- |
| `DATABASE_URL` | sim | Banco da aplicação |
| `TEST_DATABASE_URL` | para `npm test` | Banco dos testes. **É apagado e recriado a cada execução.** Nunca aponte para dados reais. |
| `E2E_DATABASE_URL` | para `npm run test:e2e` | Banco dos testes de navegador. Também é apagado. |
| `APP_TIMEZONE` | não | Fuso padrão (`America/Sao_Paulo`) |
| `APP_URL` | **sim em produção** | Endereço público usado nos links dos e-mails. Desde a auditoria, também protege contra links falsificados (ver [SEGURANCA.md](SEGURANCA.md)). |
| `CRON_SECRET` | para a tarefa diária | Segredo da rota `/api/tarefas/diarias` (mínimo 16 caracteres; troque em produção) |
| `EMAIL_PROVIDER`, `EMAIL_FROM`, `SMTP_*`, `RESEND_API_KEY` | não | Envio de e-mails. Sem eles, os e-mails aparecem só no console do servidor. |
| `COOKIE_SECURE` | não | `false` apenas para testar build de produção sem HTTPS na sua máquina |
| `SHOW_TEST_ACCOUNTS` | não | Mostra as contas de teste na tela de login |

> O `.env` está no `.gitignore`. Nunca o envie para o GitHub.

## 5. Inicializar o banco de dados

Crie o usuário e os três bancos. Os nomes vêm do `.env.example`.

**Linux/macOS:**

```bash
sudo -u postgres psql -c "CREATE USER fight WITH PASSWORD 'fight' CREATEDB;"
sudo -u postgres psql -c "CREATE DATABASE fight_manager OWNER fight;"
sudo -u postgres psql -c "CREATE DATABASE fight_manager_test OWNER fight;"
sudo -u postgres psql -c "CREATE DATABASE fight_manager_e2e OWNER fight;"
```

(No macOS com Homebrew, troque `sudo -u postgres psql` por `psql postgres`.)

**Windows PowerShell** (vai pedir a senha do usuário `postgres` definida na instalação):

```powershell
psql -U postgres -c "CREATE USER fight WITH PASSWORD 'fight' CREATEDB;"
psql -U postgres -c "CREATE DATABASE fight_manager OWNER fight;"
psql -U postgres -c "CREATE DATABASE fight_manager_test OWNER fight;"
psql -U postgres -c "CREATE DATABASE fight_manager_e2e OWNER fight;"
```

> Os testes apagam e recriam o schema `public` dos bancos de teste. Se o usuário `fight` não for dono deles, os testes falham por permissão.

## 6. Executar as migrações

```bash
npm run db:migrate
```

Saída esperada: `Migrations aplicadas.` São 12 migrations (`drizzle/0000_init.sql` a `0011_identidade_comunicados_graduacao.sql`), que criam 19 tabelas. O comando é seguro para repetir: só aplica as pendentes.

## 7. Inserir dados de demonstração (opcional)

```bash
npm run db:seed
```

Cria a "Academia Punho de Ferro (exemplo)" com 10 alunos fictícios, mensalidades, pagamentos, despesas e 7 contas de teste. **Todas usam a senha `kombexa123`**:

| E-mail | Perfil |
| --- | --- |
| `admin@academia.dev` | Administrador da academia (acesso total) |
| `recepcao@academia.dev` | Equipe com acesso limitado |
| `aluno@academia.dev` | Aluno aprovado |
| `responsavel@academia.dev` | Responsável por dois menores |
| `pendente@academia.dev` | Aluno aguardando aprovação |
| `semacademia@academia.dev` | Aluno sem academia |
| `plataforma@kombexa.dev` | Administrador da plataforma |

O seed **não apaga nada**: se os dados já existem, só completa as contas que faltam. Ele se recusa a rodar com `NODE_ENV=production`, a menos que exista `ALLOW_SEED=1` (comportamento confirmado na auditoria). **Nunca rode o seed num banco real**: as senhas são públicas.

## 8. Criar o primeiro administrador (uso real, sem seed)

A senha vai numa variável de ambiente (`ADMIN_PASSWORD`, no mínimo 10 caracteres), para não ficar no histórico do terminal.

**Administrador da plataforma** (é quem cria as academias em `/plataforma`):

```bash
ADMIN_PASSWORD="uma-senha-forte-aqui" npm run db:create-platform-admin -- "Seu Nome" voce@email.com
```

```powershell
$env:ADMIN_PASSWORD = "uma-senha-forte-aqui"
npm run db:create-platform-admin -- "Seu Nome" voce@email.com
Remove-Item Env:ADMIN_PASSWORD
```

**Ou, direto, uma academia com o seu administrador:**

```bash
ADMIN_PASSWORD="uma-senha-forte-aqui" npm run db:create-admin -- "Nome da Academia" "Seu Nome" voce@email.com
```

```powershell
$env:ADMIN_PASSWORD = "uma-senha-forte-aqui"
npm run db:create-admin -- "Nome da Academia" "Seu Nome" voce@email.com
Remove-Item Env:ADMIN_PASSWORD
```

Ambos foram executados na auditoria. Sem a senha, o script mostra o modo de uso e sai com erro, sem criar nada.

## 9. Iniciar o sistema

**Desenvolvimento** (recarrega ao salvar arquivos):

```bash
npm run dev
```

**Produção local** (o que roda num servidor):

```bash
npm run build
npm start
```

> No modo produção o cookie de sessão só funciona por HTTPS. Para testar `npm start` em `http://localhost`, defina `COOKIE_SECURE=false` (no `.env` ou no comando: `COOKIE_SECURE=false npm start`; no PowerShell, `$env:COOKIE_SECURE="false"; npm start`). **Nunca faça isso num servidor público.**

## 10. Acessar a aplicação

- Aplicação: <http://localhost:3000>
- Verificação de saúde: <http://localhost:3000/api/saude>, que deve responder `{"ok":true,...}`

Entre com uma das contas do passo 7 ou com o administrador criado no passo 8.

## 11. Encerrar os serviços

- `npm run dev` ou `npm start`: **Ctrl + C** no terminal.
- PostgreSQL no Linux: `sudo systemctl stop postgresql`; no macOS: `brew services stop postgresql@16`; no Windows: serviço `postgresql-x64-16` em `services.msc`.

---

## Caminho B: Docker Compose (precisa de validação)

O `docker-compose.yml` define quatro serviços:

| Serviço | O que faz |
| --- | --- |
| `db` | PostgreSQL 16, dados no volume `pgdata`, porta 5432 publicada |
| `app` | A aplicação. Ao iniciar, aplica as migrations e sobe o `next start` na porta 3000 |
| `scheduler` | Chama `POST /api/tarefas/diarias` de hora em hora com o `CRON_SECRET` |
| `backup` | Roda `scripts/backup.sh` uma vez por dia, gravando em `./backups` |

```bash
cp .env.example .env
docker compose up -d --build
docker compose ps
```

**Dados de exemplo no Docker.** O container roda com `NODE_ENV=production`, então o seed precisa da liberação explícita:

```bash
docker compose exec -e ALLOW_SEED=1 app npm run db:seed
```

> A documentação original (`docs/instalacao.md`) indica `docker compose exec app npm run db:seed`, **sem** `ALLOW_SEED=1`. Com isso o script apenas imprime "Seed bloqueado em produção". Comportamento reproduzido na auditoria.

**Primeiro administrador no Docker:**

```bash
docker compose exec -e ADMIN_PASSWORD="uma-senha-forte" app npm run db:create-platform-admin -- "Seu Nome" voce@email.com
```

| Ação | Comando |
| --- | --- |
| Ver logs da aplicação | `docker compose logs -f app` |
| Ver logs do banco | `docker compose logs -f db` |
| Parar (mantém os dados) | `docker compose down` |
| Parar e **apagar o banco** | `docker compose down -v` |
| Reconstruir após mudar o código | `docker compose up -d --build` |

> **Antes de usar o compose num servidor real**, leia [SEGURANCA.md](SEGURANCA.md), seção "Docker Compose em produção". Os valores padrão de `CRON_SECRET`, `SHOW_TEST_ACCOUNTS` e a porta do banco publicada são pensados para uso local.

---

## 12. Problemas comuns

| Sintoma | Causa provável | Solução |
| --- | --- | --- |
| `DATABASE_URL não configurada` | Falta o `.env` | Passo 4 |
| `password authentication failed for user "fight"` | Usuário ou senha diferentes do `.env` | Refaça o passo 5 ou ajuste `DATABASE_URL` |
| `ECONNREFUSED 127.0.0.1:5432` | PostgreSQL parado | Inicie o serviço do PostgreSQL |
| `permission denied for schema public` ao rodar `npm test` | O banco de teste não pertence ao usuário `fight` | Crie com `OWNER fight` (passo 5) |
| Login "não funciona" com `npm start` em http | Cookie `Secure` exige HTTPS | `COOKIE_SECURE=false` só localmente |
| "Muitas tentativas. Aguarde 15 minutos" | Limite de 5 erros por e-mail (em memória) | Espere ou reinicie o servidor |
| A porta 3000 está ocupada | Outro processo | `npm run dev -- -p 3001` |
| Seed no Docker diz "bloqueado em produção" | Container em produção | Use `-e ALLOW_SEED=1` (veja acima) |
| `npm run test:e2e` não acha o navegador | Playwright sem Chromium | `npx playwright install chromium` |
| `npm run test:e2e` falha logo no início | Faltou o build | `npm run build` antes |
| E-mails não chegam | Envio não configurado | `npm run email:test -- seu@email.com` mostra o que está configurado; guia em `projeto/docs/instalacao.md`, seção "Configurar o envio de e-mails" |
| Links dos e-mails apontam para `localhost` em produção | `APP_URL` não foi trocada | Defina `APP_URL=https://seu-dominio` |
