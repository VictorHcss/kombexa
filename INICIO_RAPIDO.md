# Início rápido: Kombexa em 10 minutos

## O que tem neste pacote

```text
KOMBEXA/
├── INICIO_RAPIDO.md       ← você está aqui
├── projeto/               código-fonte completo, JÁ com as correções da auditoria
├── documentacao/          documentação técnica (comece pelo README.md)
│   └── estudos/           11 guias didáticos + 17 exercícios
└── relatorios/
    ├── AUDITORIA_TECNICA.md      parecer e achados
    ├── RESULTADO_DOS_TESTES.md   o que foi testado e como
    ├── PENDENCIAS.md             o que falta fazer (leia a P1!)
    ├── alteracoes-auditoria.patch  as correções, para aplicar no seu repositório
    ├── backup-original/          os arquivos como eram antes das correções
    └── logs/                     saídas reais dos comandos da auditoria
```

## Pré-requisitos

Node.js **22**, PostgreSQL **16** e Git. Como instalar cada um (Windows, Linux, macOS): `documentacao/INSTALACAO.md`, passo 1.

## 1. Extrair e entrar no projeto

**Windows (PowerShell):**

```powershell
Expand-Archive KOMBEXA_COMPLETO.zip -DestinationPath .
cd KOMBEXA\projeto
```

**Linux/macOS:**

```bash
unzip KOMBEXA_COMPLETO.zip
cd KOMBEXA/projeto
```

## 2. Criar os bancos (uma vez só)

**Windows:**

```powershell
psql -U postgres -c "CREATE USER fight WITH PASSWORD 'fight' CREATEDB;"
psql -U postgres -c "CREATE DATABASE fight_manager OWNER fight;"
psql -U postgres -c "CREATE DATABASE fight_manager_test OWNER fight;"
psql -U postgres -c "CREATE DATABASE fight_manager_e2e OWNER fight;"
```

**Linux:** os mesmos comandos, trocando `psql -U postgres` por `sudo -u postgres psql`.

## 3. Instalar, configurar e popular

```bash
npm ci
cp .env.example .env            # PowerShell: Copy-Item .env.example .env
npm run db:migrate
npm run db:seed
```

## 4. Rodar

```bash
npm run dev
```

Abra **http://localhost:3000** e entre com uma conta de teste (senha **`kombexa123`**):

| E-mail | Você verá |
| --- | --- |
| `admin@academia.dev` | Painel completo da academia |
| `recepcao@academia.dev` | Equipe com acesso limitado |
| `aluno@academia.dev` | Área do aluno |
| `responsavel@academia.dev` | Responsável por dois menores |
| `plataforma@kombexa.dev` | Administração da plataforma |

Para parar: **Ctrl + C**.

## 5. Conferir que está tudo certo

```bash
npm run typecheck && npm run lint && npm test
```

Esperado: nenhum erro e **317 testes passando** (cerca de 1 minuto).

## Antes de colocar em produção

1. **Defina `APP_URL`** com o seu domínio (necessário para a correção de segurança valer).
2. **Não use** as contas de teste nem o `npm run db:seed`.
3. Leia `documentacao/SEGURANCA.md`, item 7.5, se for usar o Docker Compose.

## Problemas?

| Erro | Solução |
| --- | --- |
| `DATABASE_URL não configurada` | Faltou o `cp .env.example .env` |
| `password authentication failed` | Refaça o passo 2 |
| `ECONNREFUSED ...5432` | O PostgreSQL está desligado |
| Outros | `documentacao/INSTALACAO.md`, seção 12 |

## Para onde ir agora

- **Quero usar e publicar:** `documentacao/README.md` → `INSTALACAO.md` → `SEGURANCA.md`
- **Quero estudar o código:** `documentacao/estudos/GUIA_DE_ESTUDOS.md`
- **Quero saber o que a auditoria fez:** `relatorios/AUDITORIA_TECNICA.md`
