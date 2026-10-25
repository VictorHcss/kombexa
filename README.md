# Kombexa

Gestão administrativa para academias de luta e artes marciais: alunos, mensalidades, pagamentos e um financeiro básico, num sistema web simples, rápido e responsivo.

**Situação:** MVP funcional (versão 0.10.2). Requisitos e estado de cada um em [docs/produto.md](docs/produto.md). Começou como projeto de portfólio, mas foi construído com PostgreSQL real, migrations, validações no servidor, testes, auditoria e isolamento entre academias, para poder evoluir para uso real.

## O que o Kombexa faz

O fluxo principal é: **pesquisar o aluno → abrir o perfil → ver a situação financeira → registrar o pagamento**.

- **Início:** primeiro o que pede ação (mensalidades atrasadas, solicitações de entrada, mensalidades a vencer), depois as pendências e o resumo financeiro do mês.
- **Configuração da academia:** dados (nome, CPF/CNPJ, contato e endereço), modalidades com valor sugerido e termos da ficha de matrícula, tudo pela interface. No primeiro acesso, o Início mostra o que falta configurar.
- **Alunos:** cadastro em seções (dados pessoais, matrícula, contato de emergência, uso de imagem e endereço), edição, pesquisa por nome, telefone, e-mail, CPF ou pelo nome e telefone do responsável, filtro por status, ativação e inativação. Cada aluno tem um valor mensal e um dia de vencimento, usados em todas as mensalidades futuras.
- **Menores de idade:** a data de nascimento é obrigatória, e o aluno menor de 18 anos só é salvo com um responsável legal principal. Irmãos compartilham o mesmo responsável. O principal é o contato de cobrança (o WhatsApp vai para ele) e quem assina a ficha.
- **Ficha de matrícula:** página para imprimir ou salvar em PDF com os dados da academia, do aluno e do responsável, os termos escritos pela academia e as assinaturas. O perfil mostra "ficha pendente" até ser marcada como assinada.
- **Saúde (dado sensível):** seção restrita do perfil, com consentimento obrigatório. Fica fora das listas, das buscas, das mensagens e da ficha (a menos que se marque para incluir), e a auditoria registra a alteração sem o conteúdo.
- **Perfil do aluno:** situação financeira em destaque (em dia, em aberto ou atrasado), último pagamento e abas de informações, mensalidades, pagamentos e histórico.
- **Mensalidades:** criação individual (com o valor do aluno já preenchido), geração do mês para todos os alunos ativos com um clique (sem duplicar), edição e cancelamento enquanto não há pagamento, filtros por situação, período e aluno.
- **Situações padronizadas:** A vencer, Atrasada, Paga e Cancelada. "Em aberto" é usado só para valores.
- **Atraso calculado:** uma mensalidade fica "pendente" no banco e aparece como atrasada quando o vencimento já passou, pelo horário de Brasília. Não depende de tarefa agendada nem de alteração manual.
- **Pagamentos:** aluno escolhido por busca (nome, telefone ou e-mail, com modalidade e situação para diferenciar homônimos), vinculados a uma mensalidade ou avulsos, pagamento parcial com saldo restante, pagamento "pendente" que só entra no caixa ao ser confirmado, cancelamento com motivo (a mensalidade volta a ficar em aberto) e filtros por período, forma e aluno.
- **Financeiro:** entradas, saídas e saldo do período. Todo pagamento gera sozinho a entrada correspondente, e cancelá-lo cancela a entrada. Lançamentos manuais ficam para despesas, matrículas e outros recebimentos; a categoria "Mensalidade" não existe no lançamento manual, então nada é contado duas vezes.
- **Convite com QR Code:** a academia gera um código e um QR Code para a recepção, impressão ou WhatsApp. O aluno escaneia, cria a própria conta e o pedido chega para aprovação. O administrador aprova completando modalidade, início e mensalidade, ou vincula a conta a um aluno já cadastrado (o sistema sugere pelo e-mail ou telefone). Pedidos recusados ficam no histórico, com aviso ao aluno. Só para maiores de 18 anos; menores continuam cadastrados pelo administrador.
- **Contas:** só o administrador da plataforma cria academias, informando o e-mail do responsável, que recebe um link para criar a senha. Alunos criam a própria conta em "Criar conta" e ficam sem academia até uma academia adicioná-los pelo e-mail (ou entram direto pelo convite).
- **Área do aluno:** depois da aprovação, o aluno entra e vê só os próprios dados: cadastro, mensalidades com situação e saldo, e pagamentos. Somente leitura dos dados da academia; em "Minha conta", o aluno atualiza o telefone e troca a senha.
- **Cobrança pelo WhatsApp:** no perfil e nas pendências, um link abre o WhatsApp com a mensagem pronta (valor e vencimento). Não há integração: nada é enviado pelo sistema.
- **Celular primeiro:** barra inferior com Início, Alunos, Registrar pagamento, Mensalidades e Mais; filtros recolhíveis e confirmações em janela própria.
- **E-mails:** link de acesso de academias novas, recuperação de senha (link válido por 30 minutos e de uso único, sem revelar se o e-mail tem conta) e convite por e-mail. Envio por SMTP (Gmail, Outlook, e-mail do domínio etc.) ou Resend; sem configurar, os e-mails aparecem no console do servidor. Guia em [docs/instalacao.md](docs/instalacao.md).
- **Recibo de pagamento:** para imprimir, salvar em PDF ou enviar pelo WhatsApp, com o valor por extenso e o responsável como pagador quando o aluno é menor. O aluno também vê os próprios recibos.
- **Direitos do titular (LGPD):** exportar todos os dados de um aluno (o próprio aluno também baixa os dele) e eliminar os dados pessoais mantendo o financeiro de forma anônima.
- **Login real:** senha com hash (bcrypt), sessão no banco com cookie httpOnly e limite de tentativas.
- **Equipe com permissões:** o responsável adiciona pessoas e marca o que cada uma pode fazer; o restante some do menu e é bloqueado no servidor.
- **Pix copia e cola:** com a chave Pix cadastrada, o aluno paga pelo QR Code ou pelo código, já com o valor da mensalidade.
- **Segurança e operação:** cabeçalhos de segurança, confirmação de e-mail, fuso por academia, backup diário e monitoramento (ver [docs/instalacao.md](docs/instalacao.md)).
- **Automação:** mensalidades do mês geradas automaticamente e lembretes de vencimento por e-mail (tarefa diária; ver [docs/instalacao.md](docs/instalacao.md) e o serviço `scheduler`).
- **Presença:** marcar quem treinou, frequência e lista de alunos sumidos.
- **Área do responsável:** o responsável acompanha os dependentes com a própria conta.
- **Relatórios:** recebido × esperado, atraso, modalidades e formas de pagamento.
- **Instalável no celular (PWA).**
- **Auditoria:** quem criou, confirmou ou cancelou pagamentos, quem alterou mensalidades, alunos e acessos, quando e em qual academia.
- **Multi-academia na base:** cada academia só enxerga os próprios dados; trocar um ID na URL não atravessa academias (há testes para isso).
- **Documentação dentro do sistema**, no menu "Documentação".

## Documentação

| Arquivo | Para quem | O que tem |
| --- | --- | --- |
| [docs/guia-de-estudo.md](docs/guia-de-estudo.md) | Quem quer entender o código | O projeto por inteiro, decisões, problemas encontrados, exercícios e roteiro de apresentação |
| [docs/arquitetura.md](docs/arquitetura.md) | Quem vai mexer no código | Camadas, banco, autenticação, permissões e Server Actions |
| [docs/instalacao.md](docs/instalacao.md) | Quem vai rodar o sistema | Instalação, desenvolvimento, publicação, e-mail, backup, tarefa diária e problemas comuns |
| [docs/produto.md](docs/produto.md) | Quem quer saber o que ele faz | Requisitos e roadmap |
| [docs/changelog.md](docs/changelog.md) | Quem acompanha as versões | O que mudou em cada versão |

## Fora do escopo por enquanto

Contratos e assinatura digital, lembretes pelo WhatsApp (os automáticos são por e-mail), check-in feito pelo próprio aluno, turmas com horário, graduação e faixas, planos e descontos, aplicativo nativo (o sistema é instalável como PWA) e confirmação automática de Pix por um provedor de pagamento. Ver [docs/produto.md](docs/produto.md).

## Stack

Next.js 16 (App Router, Server Components e Server Actions), React 19, TypeScript, PostgreSQL 16, Drizzle ORM, Zod (validação), bcryptjs, qrcode, Vitest, Docker e Docker Compose. Fontes Manrope e Barlow Condensed auto-hospedadas (@fontsource), sem depender de serviços externos no build. Nodemailer para e-mail por SMTP.

## Como rodar

### Com Docker (mais simples)

Pré-requisitos: Docker e Docker Compose.

```bash
cp .env.example .env
docker compose up -d --build
docker compose exec app npm run db:seed
````

Acesse \*\*http://localhost:3000\*\*. O seed é opcional e adiciona dados de desenvolvimento para testar as funcionalidades.

### Sem Docker

Pré-requisitos: Node.js 20+ e PostgreSQL 14+.

bash

```
npm install
cp .env.example .env
npm run db:migrate
npm run db:seed
npm run dev
```

Acesse \*\*http://localhost:3000\*\*.

### Uso real (sem dados de exemplo)

1. Configure o envio de e-mails ([docs/instalacao.md](<https://docs/instalacao.md?utm_source=chatgpt.com>)) e teste com `npm run email:test -- seu@email.com`.
2. Crie o administrador da plataforma:

bash

```
ADMIN_PASSWORD="uma-senha-forte-aqui" npm run db:create-platform-admin -- "Seu Nome" voce@email.com
```

3. Entre com essa conta e crie as academias em /plataforma. O responsável de cada uma recebe o link para criar a senha.

Para criar uma academia diretamente pelo terminal, sem a tela:

bash

```
ADMIN_PASSWORD="..." npm run db:create-admin -- "Nome da Academia" "Nome do Responsável" responsavel@email.com
```

## Testes

Os testes rodam contra um PostgreSQL de verdade (o banco de `TEST_DATABASE_URL`, que é apagado e recriado a cada execução):

bash

```
npm test
npm run lint
npm run build && npm run test:e2e
```

Na primeira vez, instale o navegador dos testes de ponta a ponta com `npx playwright install chromium`. O GitHub Actions (`.github/workflows/ci.yml`) roda tudo isso a cada commit.

Os testes automatizados cobrem regras de negócio, isolamento entre academias, concorrência, dinheiro em centavos, fuso horário, atraso, validações, pesquisa, geração do mês, pagamento parcial, cancelamento, entradas automáticas, totais do financeiro, auditoria, login, fluxo de convite, contas, Pix copia e cola, permissões da equipe, confirmação de e-mail, tarefa diária, presença e área do responsável. Detalhes em [docs/instalacao.md](<https://docs/instalacao.md?utm_source=chatgpt.com>).

## Estrutura

text

```
app/            páginas e Server Actions (App Router)
  (app)/        área logada da academia: dashboard, alunos, mensalidades, pagamentos, financeiro...
  login/        entrar e sair
  criar-conta/  conta de aluno sem convite
  plataforma/   administrador da plataforma: cria academias e vê números gerais
  convite/      página pública aberta pelo QR Code
  aluno/        área do aluno (somente leitura)
components/     componentes de interface reutilizáveis
services/       regras de negócio e acesso a dados
lib/            dinheiro, datas, validações, autenticação e utilitários
db/             schema do Drizzle e conexão
drizzle/        migrations geradas
scripts/        migrate, seed e criação do primeiro administrador
tests/          testes automatizados
docs/           documentação técnica
```

## Limitações conhecidas

- Não há confirmação de e-mail no cadastro do aluno (a aprovação da academia é a barreira).
- Todos os administradores de uma academia têm o mesmo nível de acesso.
- O limite de tentativas de login fica em memória: com várias instâncias do servidor, cada uma conta separadamente.
- As listas mostram até 100 ou 200 registros; os filtros encontram os demais. Não há paginação.
- O painel da plataforma cria academias e reenvia o acesso, mas suspender academias ainda é feito no banco.

Mais em [docs/instalacao.md](<https://docs/instalacao.md?utm_source=chatgpt.com>) e [docs/produto.md](<https://docs/produto.md?utm_source=chatgpt.com>).

## Licença

MIT © Victor H.

```

```
