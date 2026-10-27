# Kombexa

**Kombexa** é uma plataforma web de gestão para academias de artes marciais e esportes de combate: alunos, mensalidades, pagamentos, presença, graduações, documentos e uma Área do Aluno para cada atleta acompanhar a própria jornada.

**Situação:** MVP funcional, versão **0.11.0**. Requisitos e estado de cada um em [docs/produto.md](docs/produto.md); o que mudou em cada versão em [docs/changelog.md](docs/changelog.md).

---

## 1. O que o Kombexa faz

O fluxo principal da recepção é: **pesquisar o aluno → abrir o perfil → ver a situação financeira → registrar o pagamento**.

**Para a equipe da academia**

- **Início** com o que pede ação: mensalidades atrasadas, solicitações de entrada, vencimentos próximos e o resumo financeiro do mês.
- **Alunos:** cadastro completo (dados pessoais, matrícula, responsável legal para menores, contato de emergência, uso de imagem e endereço), pesquisa, filtros, ativação e inativação. Saúde é uma seção restrita, com consentimento e permissão própria.
- **Graduações:** histórico de faixas, cordas e graus por aluno, com a data, a modalidade e quem graduou.
- **Mensalidades e pagamentos:** geração do mês sem duplicar, pagamento parcial com saldo, pagamento pendente que só entra no caixa ao ser confirmado, cancelamento com motivo e recibo. A mensalidade é paga pela soma dos pagamentos; ninguém marca à mão.
- **Financeiro e relatórios:** entradas, saídas, saldo, recebido × esperado, atraso e formas de pagamento.
- **Presença:** marcar quem treinou, frequência, lista de alunos sumidos e **registro pelo QR Code do aluno**.
- **Comunicados:** mural de avisos (horários, feriados, eventos, graduações) que os alunos veem na Área do Aluno.
- **Documentos com a identidade da academia:** ficha de matrícula / contrato de prestação de serviços e recibo, com a **logo da academia** no cabeçalho, prontos para imprimir ou salvar em PDF.
- **Configurações:** dados da academia (incluindo razão social e responsável, usados no contrato), **identidade visual (logo)**, Pix, modalidades, termos da ficha e equipe com permissões por área.
- **Convite com QR Code**, solicitações de entrada, auditoria de tudo o que importa e direitos do titular (LGPD).

**Para o aluno (e o responsável por um aluno menor)**

- **Início:** situação (em dia, a vencer, atrasado), próximo vencimento, Pix copia e cola, histórico de mensalidades e pagamentos, atalhos e comunicados recentes.
- **Frequência:** treinos dos últimos 30 dias, por mês e a lista do último ano, mais o histórico de graduações.
- **Comunicados** da academia.
- **Documentos:** a própria ficha/contrato (com o estado da assinatura registrado pela academia) e os recibos.
- **Carteirinha:** QR Code pessoal para registrar a presença na recepção.
- **Minha conta:** telefone, senha e download de todos os dados (LGPD).

O aluno **só lê** os dados da academia: não marca pagamento, não altera presença, não muda a própria matrícula e não vê dados de outro aluno, mesmo trocando o ID na URL.

## 2. Tecnologias

Next.js 16 (App Router, Server Components e Server Actions), React 19, TypeScript, PostgreSQL 16, Drizzle ORM, Zod, bcryptjs, qrcode, Nodemailer, Vitest e Playwright, Docker e Docker Compose. As fontes Manrope e Barlow Condensed são auto-hospedadas (@fontsource), sem depender de serviços externos no build.

## 3. Pré-requisitos

- **Com Docker:** Docker e Docker Compose.
- **Sem Docker:** Node.js 20 ou mais novo e PostgreSQL 14 ou mais novo (testado com o 16).

## 4. Instalar as dependências

```bash
npm install
```

## 5. Configurar as variáveis de ambiente

```bash
cp .env.example .env
```

O `.env.example` explica cada variável. As essenciais são estas:

| Variável | Para quê |
| --- | --- |
| `DATABASE_URL` | Banco principal |
| `TEST_DATABASE_URL` | Banco dos testes. **É apagado e recriado a cada execução**; nunca aponte para dados reais |
| `E2E_DATABASE_URL` | Banco dos testes de ponta a ponta (também é recriado) |
| `APP_URL` | Endereço público (links nos e-mails) |
| `CRON_SECRET` | Senha da tarefa diária; use um valor longo e aleatório |
| `EMAIL_PROVIDER`, `EMAIL_FROM`, `SMTP_*` ou `RESEND_API_KEY` | Envio de e-mails. Sem configurar, os e-mails aparecem no console |
| `LOGO_STORAGE` | Onde guardar as logos das academias. Padrão e única opção hoje: `database` |
| `NEXT_PUBLIC_KOMBEXA_LOGO` | Caminho do arquivo oficial da marca Kombexa, quando existir (ver item 9) |

Nunca envie o `.env` para o Git.

## 6. Executar as migrações

```bash
npm run db:migrate     # aplica tudo o que está em drizzle/
npm run db:seed        # opcional: dados de exemplo para desenvolvimento
```

As migrações são aditivas e preservam os dados. A **0011** (desta versão) cria `academy_logos`, `announcements` e `student_ranks` e acrescenta `academies.legal_name`, `academies.owner_name`, `students.checkin_code` e `students.checkin_code_created_at`. Não apaga nem renomeia nada. Ela foi testada aplicando-a sobre um banco da 0.10.2 com dados.

> **Quem já tinha o seed antigo:** as contas de exemplo agora usam a senha `kombexa123`, e o administrador da plataforma é `plataforma@kombexa.dev`. Rode `npm run db:seed` de novo (o seed recria os dados de exemplo).

## 7. Iniciar o ambiente de desenvolvimento

**Com Docker:**

```bash
cp .env.example .env
docker compose up -d --build
docker compose exec app npm run db:seed
```

**Sem Docker:**

```bash
npm install
cp .env.example .env
npm run db:migrate
npm run db:seed
npm run dev
```

Acesse **http://localhost:3000**. Com o seed, a tela de login mostra as contas de teste (senha `kombexa123`): `admin@academia.dev` (academia, acesso total), `recepcao@academia.dev` (acesso personalizado), `aluno@academia.dev` (aluno), `responsavel@academia.dev` (responsável) e `plataforma@kombexa.dev` (plataforma).

**Uso real, sem dados de exemplo:**

1. Configure o envio de e-mails ([docs/instalacao.md](docs/instalacao.md)) e teste com `npm run email:test -- seu@email.com`.
2. Crie o administrador da plataforma:
   ```bash
   ADMIN_PASSWORD="uma-senha-forte-aqui" npm run db:create-platform-admin -- "Seu Nome" voce@email.com
   ```
3. Entre com essa conta e crie as academias em `/plataforma`. O responsável de cada uma recebe o link para criar a senha.

## 8. Testes e compilação

```bash
npm test             # Vitest, contra PostgreSQL de verdade (TEST_DATABASE_URL)
npm run typecheck    # TypeScript
npm run lint         # ESLint
npm run build        # build de produção
npx playwright install chromium   # só na primeira vez
npm run test:e2e     # ponta a ponta no navegador (precisa do build)
```

O GitHub Actions (`.github/workflows/ci.yml`) roda tudo isso a cada commit.

Os testes cobrem regras de negócio, isolamento entre academias, concorrência, dinheiro, fuso, permissões, convites, contas, Pix, presença e área do responsável. Nesta versão entraram também:

- validação de imagem pelo conteúdo;
- logo (envio, troca, remoção e isolamento);
- documentos com a logo certa e sem logo;
- ficha do aluno protegida contra troca de ID;
- comunicados, graduações e QR Code de presença;
- frequência e finanças do aluno.

Há ainda um teste que lê o código e exige `requireStudent()` em toda página e action da Área do Aluno, como o que já existia para a área da equipe.

## 9. Armazenamento de imagens e marca

**Logo de cada academia.** Fica no próprio PostgreSQL (tabela `academy_logos`, `LOGO_STORAGE=database`):

- funciona em qualquer hospedagem, inclusive com disco efêmero (contêineres, PaaS);
- entra no backup do banco;
- não precisa de credenciais.

Limites: PNG, JPEG ou WebP de até 1 MB, entre 32 e 4000 pixels de lado. O servidor confere a assinatura binária e as dimensões do arquivo e não confia na extensão nem no tipo informado pelo navegador. SVG é recusado por segurança.

Para usar um armazenamento de objetos (S3, R2, GCS), implemente a interface `LogoStore` em `services/branding.ts` e selecione o driver pelo `LOGO_STORAGE`. Hoje só o driver `database` existe.

**Marca Kombexa.** Ainda não há arquivos oficiais no repositório. O sistema usa um **monograma provisório** (um "K" carvão no quadrado laranja). Quando os arquivos oficiais chegarem, siga [public/brand/README.md](public/brand/README.md).

## 10. Como usar a identidade da academia e a Área do Aluno

**Logo e dados para documentos** (permissão *Configurações da academia*):

1. **Configurações → Academia:** preencha nome, razão social, CPF/CNPJ, responsável, contato e endereço. Eles saem no cabeçalho e no contrato.
2. **Configurações → Identidade visual:** escolha a imagem, confira a prévia e salve. Ali também dá para substituir ou remover a logo e ver como fica o cabeçalho dos documentos.
3. A ficha (**Alunos → aluno → Ficha de matrícula**) e os recibos passam a sair com a logo. Sem logo, saem com as iniciais e o nome da academia.

A marca Kombexa fica no sistema e, nos documentos, só no rodapé, como sistema emissor.

**Área do Aluno:**

1. **Acesso.** O aluno entra com a própria conta: pelo convite com QR Code (**Convidar alunos**), por "Criar conta" seguido de **Solicitações → Adicionar pelo e-mail**, ou, no caso do responsável de um aluno menor, pelo botão **Dar acesso** no perfil do aluno.
2. **O que ele vê.** Situação financeira, frequência, graduações, comunicados, documentos e a carteirinha.
3. **Presença pelo QR.** Na tela **Presença**, use um leitor de QR conectado ao computador (ele "digita" o código) ou digite o código abaixo do QR. Vale só para o dia de hoje e não duplica presença. Se o aluno gerar um código novo, o antigo deixa de valer.
4. **Comunicados.** Publicados em **Comunicados** (permissão própria), aparecem para todos os alunos ativos da academia. Arquivar tira do mural sem apagar.
5. **Graduações.** Registradas em **Alunos → aluno → Graduações**.

**Tema claro e escuro:** escolha **Claro**, **Escuro** ou **Sistema** no menu da conta (equipe), no cabeçalho (aluno e plataforma) ou nas telas de entrada. A escolha fica salva no aparelho.

## 11. O que ainda depende de configuração ou integração externa

- **E-mail:** precisa de SMTP ou Resend configurado. Sem isso, os e-mails vão para o console do servidor.
- **Pagamento on-line:** não há provedor integrado. O Pix copia e cola é gerado com a chave da academia, mas **a confirmação é manual** (a recepção registra o pagamento). O aluno nunca marca a própria mensalidade como paga.
- **Assinatura eletrônica:** não existe. A ficha é assinada no papel e a academia registra a data no perfil do aluno; o documento só aparece como "assinado" quando essa data existe.
- **Notificações:** comunicados aparecem só na Área do Aluno, sem envio por e-mail, WhatsApp ou push. Os lembretes automáticos de vencimento continuam por e-mail (tarefa diária).
- **Agenda de aulas e turmas:** não existe no modelo de dados; por isso a Área do Aluno não mostra horários.
- **Armazenamento de objetos para logos:** opcional; o padrão (banco) já funciona em produção.
- **Logo oficial do Kombexa:** aguardando os arquivos (item 9).

## Documentação

| Arquivo | Para quem | O que tem |
| --- | --- | --- |
| [docs/instalacao.md](docs/instalacao.md) | Quem vai rodar o sistema | Instalação, publicação, e-mail, backup, tarefa diária e problemas comuns |
| [docs/arquitetura.md](docs/arquitetura.md) | Quem vai mexer no código | Camadas, banco, autenticação, permissões e Server Actions |
| [docs/produto.md](docs/produto.md) | Quem quer saber o que ele faz | Requisitos e roadmap |
| [docs/guia-de-estudo.md](docs/guia-de-estudo.md) | Quem quer entender o código | O projeto por inteiro, decisões e exercícios |
| [docs/changelog.md](docs/changelog.md) | Quem acompanha as versões | O que mudou em cada versão |

## Estrutura

```text
app/            páginas e Server Actions (App Router)
  (app)/        área da equipe: início, alunos, mensalidades, pagamentos, presença, comunicados...
  aluno/        Área do Aluno: início, frequência, comunicados, documentos, carteirinha, conta
  plataforma/   administrador da plataforma
  login/ criar-conta/ convite/ esqueci-senha/ redefinir-senha/   telas públicas
  styles/       CSS por área; tokens da marca em base.css, tema escuro em tema-escuro.css
components/     interface reutilizável (Shell, cabeçalho e rodapé dos documentos, seletor de tema...)
services/       regras de negócio e acesso a dados (sempre com o contexto da academia ou do aluno)
lib/            dinheiro, datas, validações, imagens, autenticação e utilitários
db/             schema do Drizzle e conexão
drizzle/        migrações
public/brand/   arquivos oficiais da marca Kombexa (a receber)
scripts/        migrate, seed, criação de administradores, tarefa diária, backup
tests/          testes (Vitest) e tests/e2e (Playwright)
docs/           documentação técnica
```

## Limitações conhecidas

- O limite de tentativas de login fica em memória: com várias instâncias do servidor, cada uma conta separadamente.
- Os nomes técnicos do banco (`fight_manager`, usuário `fight`) e o cookie de sessão (`fm_session`) mantêm os nomes da versão anterior, para não quebrar instalações e sessões existentes.
- Sem agenda de aulas, não há reservas nem próximas aulas na Área do Aluno.

## Licença

MIT © Victor H.
