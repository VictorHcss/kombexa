# Arquitetura

Como o sistema é organizado por dentro: camadas, banco de dados, autenticação, permissões e as Server Actions.

- [Arquitetura](#arquitetura)
- [Banco de dados](#banco-de-dados)
- [Autenticação](#autenticação)
- [Perfis e permissões](#perfis-e-permissões)
- [API: Server Actions](#api-server-actions)

## Arquitetura

### Camadas

```text
Páginas (app/**/page.tsx)         Server Components: buscam dados e desenham a tela
   │
Componentes (components/, *Form)  interface reutilizável; formulários são Client Components
   │
Server Actions (app/**/actions.ts) recebem o formulário, conferem o acesso, validam e chamam o serviço
   │
Serviços (services/)              regras de negócio e acesso a dados, em transações
   │
Drizzle ORM (db/)                 schema tipado e conexão com o PostgreSQL
```

Nenhuma página ou componente faz consulta ao banco diretamente: tudo passa por `services/`.

### Fluxo de uma ação (exemplo: registrar pagamento)

1. O formulário (`app/(app)/pagamentos/PaymentForm.tsx`) envia os campos para `createPaymentAction`.
2. A action chama `requireAcademyAdmin()` (`lib/auth/guards.ts`), que confere a sessão e devolve o contexto `{ userId, academyId }`. Sem sessão válida, redireciona para o login.
3. `handleForm` (`lib/action.ts`) valida os campos com Zod (`lib/validation.ts`). Erros voltam ao formulário com mensagens em português.
4. `createPayment(ctx, dados)` (`services/payments.ts`) abre uma transação que:
   - confere que o aluno e a mensalidade são da academia do contexto;
   - trava a mensalidade (`SELECT ... FOR UPDATE`), para dois pagamentos simultâneos não passarem do saldo;
   - grava o pagamento, a entrada no financeiro (se pago) e o registro de auditoria;
   - recalcula a situação da mensalidade a partir dos pagamentos.
5. A action revalida as páginas e redireciona para o perfil do aluno com a mensagem de sucesso.

### Fluxo do convite

```text
Administrador abre "Convidar alunos" → QR Code com /convite/{token}
Aluno escaneia → a página resolve a academia pelo token (servidor) → cadastro da conta
→ conta STUDENT + vínculo "pending" na academia do convite (uma transação, com o uso do convite contado)
→ "Solicitações": aprovar (completa modalidade, início e mensalidade) | vincular a aluno existente | recusar
→ aprovado: o aluno vê a própria área em /aluno
```

Serviços: `services/invites.ts` (gerar, revogar, resolver, consumir), `services/enrollment.ts` (cadastro, pedidos, decisões) e `services/student-portal.ts` (leitura da área do aluno, sempre pelo par vínculo e conta).

### Decisões importantes

- **Contexto obrigatório (multi-academia):** todo serviço de academia recebe um `AcademyContext` e filtra **todas** as consultas por `academy_id`. Não existe função que busque um registro só pelo ID. IDs são UUID.
- **Dinheiro em centavos inteiros:** `lib/money.ts` converte "1.234,56" em `123456` manipulando texto, sem ponto flutuante. Somas acontecem no PostgreSQL, em inteiros.
- **Datas de calendário no fuso de Brasília:** vencimentos e pagamentos são `date` (sem hora). "Hoje" é calculado em `America/Sao_Paulo` (`lib/dates.ts`).
- **Atraso é derivado, não armazenado:** `fees.status` guarda `pending`, `paid` ou `canceled`; "atrasada" é `pending` com vencimento antes de hoje (`lib/fee-status.ts` e filtros SQL em `services/fees.ts`).
- **Pagamentos são a fonte da verdade da mensalidade:** `recomputeFee` define `paid` ou `pending` somando os pagamentos confirmados. Nada é marcado como pago à mão.
- **Uma entrada por pagamento:** `financial_entries.payment_id` é único. Lançamentos manuais não aceitam a categoria "Mensalidade".
- **Nada financeiro é apagado:** pagamentos e lançamentos são cancelados (com motivo, no caso de pagamentos) e continuam no histórico.
- **Auditoria na mesma transação:** `audit()` grava junto com a ação; se a ação falhar, o registro também não existe.
- **Conta separada do vínculo:** `users` é a pessoa; `students` é a pessoa dentro de uma academia. Ver database.md.
- **Erros:** `DomainError` carrega mensagens seguras para o usuário. Erros inesperados vão para o log do servidor e o usuário vê uma mensagem genérica. `error.tsx` trata falhas ao carregar páginas.

## Banco de dados

PostgreSQL 16 com Drizzle ORM. O schema fica em `db/schema.ts` e as migrations em `drizzle/`.

### Tabelas

| Tabela | Conteúdo | Relações |
| --- | --- | --- |
| `academies` | Academias (nome, ativa ou suspensa) | — |
| `users` | Usuários com perfil `PLATFORM_ADMIN`, `ACADEMY_ADMIN` ou `STUDENT` | `academy_id` → academies (nulo para PLATFORM_ADMIN) |
| `sessions` | Sessões de login (hash do token e validade) | `user_id` → users |
| `modalities` | Modalidades de cada academia, com valor mensal sugerido; desativar tira das opções sem afetar quem já está nelas | `academy_id` → academies |
| `guardians` | Responsáveis legais (nome, CPF, telefone, e-mail, endereço), por academia | `academy_id` → academies |
| `student_guardians` | Ligação aluno ↔ responsável, com parentesco e responsável principal | `student_id` → students, `guardian_id` → guardians |
| `invites` | Convites de entrada (token do QR Code, validade, limite e contagem de usos, revogação) | `academy_id` → academies |
| `students` | **Vínculo** de uma pessoa com uma academia: dados da academia e status | `academy_id` → academies, `user_id` → users (conta, opcional), `invite_id` → invites |
| `fees` | Mensalidades | `academy_id`, `student_id` → students |
| `payments` | Pagamentos, opcionalmente ligados a uma mensalidade | `academy_id`, `student_id`, `fee_id` → fees, `created_by` → users |
| `financial_entries` | Entradas e saídas do financeiro | `academy_id`, `payment_id` → payments (único) |
| `audit_logs` | Registro das ações importantes | `academy_id`, `user_id` → users |
| `academy_logos` | Logo de cada academia (bytes, tipo, dimensões, hash), validada pelo conteúdo | `academy_id` (chave primária) → academies |
| `announcements` | Comunicados para os alunos (categoria, fixado, arquivado) | `academy_id` → academies |
| `student_ranks` | Histórico de graduações (faixa/corda/grau, data, quem graduou) | `academy_id`, `student_id`, `modality_id` |

Todas as chaves primárias são UUID. Tabelas editáveis têm `created_at` e `updated_at`.

### Tipos enumerados

- `student_status`: `pending` (pedido pelo convite), `active`, `inactive`, `rejected` (pedido recusado), `suspended` (reservado para o futuro)
- `fee_status`: `pending`, `paid`, `canceled` (**"atrasada" não é armazenado**; ver architecture.md)
- `payment_status`: `paid`, `pending`, `canceled`
- `payment_method`: `cash`, `pix`, `debit`, `credit`, `other`
- `entry_type`: `income`, `expense`; `entry_status`: `active`, `canceled`

### Dinheiro e datas

- Valores em **centavos**, colunas `integer` (`amount_cents`, `monthly_fee_cents`). Totais são somados como `bigint` no banco.
- Vencimento, pagamento, entrada e datas do financeiro são `date` (sem hora); referência da mensalidade é texto `YYYY-MM`.

### Regras garantidas pelo banco

- `users`: e-mail único sem diferenciar maiúsculas (`lower(email)`).
- `fees`: um aluno não tem duas mensalidades **não canceladas** no mesmo período (índice único parcial `fees_student_reference_unique`).
- `financial_entries.payment_id` único: um pagamento gera no máximo uma entrada.
- `students`: uma conta tem no máximo um vínculo **em aberto** por academia (`students_user_academy_unique`, que ignora vínculos com `closed_at` preenchido).
- `students`: aluno fora de `pending`/`rejected` precisa ter modalidade, data de início e valor mensal (check `students_complete_when_approved`).
- `invites.token` único.
- `modalities`: nome único por academia, sem diferenciar maiúsculas.
- `student_guardians`: no máximo um responsável principal por aluno (`student_guardians_one_primary`). Um responsável ligado a algum aluno não pode ser apagado (`RESTRICT`).
- `students.modality_id` → `modalities` com `RESTRICT`: modalidades com alunos não são apagadas, só desativadas.
- `students`, `fees` e `payments` usam `ON DELETE RESTRICT` entre si: o histórico financeiro não pode ser apagado em cascata.

### Índices

`students` por academia com status, nome (minúsculo) e telefone; `fees` por academia, status e vencimento, e por aluno; `payments` por academia e data, por mensalidade e por aluno; `financial_entries` e `audit_logs` por academia e data.

### Migrations

```bash
npm run db:generate   # gera uma nova migration a partir de mudanças em db/schema.ts
npm run db:migrate    # aplica as pendentes (também roda sozinho ao subir o container)
```

### Dados de desenvolvimento

`npm run db:seed` cria uma academia de exemplo com 10 alunos fictícios, mensalidades do mês passado (pagas) e do atual (algumas pagas, parciais e atrasadas), despesas e dois usuários com senha conhecida. **São dados de desenvolvimento**: o script se recusa a rodar com `NODE_ENV=production`, a menos que `ALLOW_SEED=1`.

### Conta e vínculo

A **conta** (`users`, perfil `STUDENT`) guarda os dados da pessoa (nome, e-mail, senha) e não pertence a nenhuma academia (`academy_id` nulo). O **vínculo** (`students`) guarda o que é da academia: modalidade, início, mensalidade, observações e status, além de uma cópia do nome e dos contatos. Alunos cadastrados pelo administrador não têm conta (`user_id` nulo). Essa separação permite, no futuro, que a mesma pessoa treine em mais de uma academia com uma só conta.

Enquanto o pedido está `pending`, os dados da academia ficam vazios; eles são preenchidos na aprovação. O vínculo também registra quem decidiu e quando (`decided_by`, `decided_at`) e o motivo da recusa (`rejection_reason`).

Um pedido recusado recebe `closed_at` (vínculo encerrado): ele continua no histórico e na auditoria, e a estrutura já permite que a mesma pessoa faça um novo pedido depois, sem apagar o anterior. No MVP, a tela ainda não oferece esse novo pedido: quem foi recusado vê a orientação de falar com a recepção.

A regra de unicidade usa `closed_at` e não o status porque o PostgreSQL não permite, na condição de um índice, nem converter um enum para texto (operação não imutável) nem usar um valor de enum criado na mesma transação da migration.

### Cadastro completo (0.4.0)

- **Academia:** `document` (CPF ou CNPJ), `phone`, `email`, endereço (`zip`, `street`, `number`, `complement`, `district`, `city`, `state`) e `enrollment_terms` (termos da ficha).
- **Aluno:** `modality_id` (substitui o texto `modality`), `cpf`, endereço, contato de emergência (`emergency_name`, `emergency_phone`, `emergency_relation`), `image_consent` (nulo = não perguntado) com `image_consent_at`, `health_notes` com `health_consent_at` e `enrollment_signed_at` (ficha assinada).
- **Saúde:** `health_notes` nunca é lido pela consulta comum do aluno (`getStudent`), só por `getHealth`, usada pela aba Saúde e, se marcado, pela ficha.

#### Migração das modalidades

As migrations `0003_cadastro_completo` e `0004_modalidade_ligada` convertem os dados existentes: cada texto de modalidade usado numa academia vira uma modalidade dela (sem diferenciar maiúsculas), os alunos são ligados a ela, e só então a coluna de texto é removida. São duas migrations porque a remoção da coluna precisa acontecer depois da cópia dos dados.

## Autenticação

### O que está implementado

- **Login por e-mail e senha** (`/login`), com o e-mail comparado sem diferenciar maiúsculas.
- **Senhas com hash bcrypt** (custo 12), em `lib/auth/password.ts`. A senha nunca é gravada nem registrada em log.
- **Sessões no banco** (`sessions`): o navegador recebe um token aleatório de 32 bytes num cookie `fm_session`, e o banco guarda apenas o **hash SHA-256** desse token. Validade de 7 dias; sessões vencidas são limpas a cada novo login.
- **Cookie** `httpOnly`, `SameSite=Lax` e `Secure` em produção (pode ser desligado com `COOKIE_SECURE=false` apenas para testes locais sem HTTPS).
- **Limite de tentativas:** 5 erros por e-mail bloqueiam novas tentativas por 15 minutos (contagem em memória, por instância).
- **Tempo de resposta constante:** quando o e-mail não existe, uma comparação de senha é feita mesmo assim, para não revelar quais e-mails estão cadastrados.
- **Bloqueios:** usuário desativado ou academia suspensa não entram, e sessões já abertas deixam de valer.
- **Troca de senha** em Configurações, com a senha atual.
- **Cadastro do aluno pelo convite** (`/convite/{token}`): nome e sobrenome, telefone com DDD, e-mail, data de nascimento (18 anos ou mais), senha com confirmação e concordância com o uso dos dados pela academia. A conta nasce com perfil `STUDENT` e já entra logada, vendo o aviso de análise. Há limite de 10 cadastros por hora por conexão.
- **Conta de aluno sem convite** (`/criar-conta`): mesmos campos e regras do convite, com o consentimento para "as academias que me adicionarem". A conta nasce `STUDENT` sem vínculo; o administrador de uma academia a adiciona pelo e-mail em Solicitações, e ela passa pela mesma aprovação do convite.
- **Academias** não se cadastram sozinhas: o administrador da plataforma cria em `/plataforma` a academia e o responsável (`ACADEMY_ADMIN`). A senha inicial é aleatória e desconhecida; o responsável recebe um link de acesso (mesmo mecanismo da recuperação de senha, válido por 72 horas e de uso único) e cria a própria senha.
- **Destino após o login:** administrador da academia vai para `/`, administrador da plataforma para `/plataforma` e aluno para `/aluno`. Quem entra a partir de um convite volta para ele.
- **Proteção das páginas e ações:** toda página da área logada e toda Server Action chamam `requireAcademyAdmin()` ou `requirePlatformAdmin()` (`lib/auth/guards.ts`) antes de qualquer outra coisa. O layout não é a única barreira.
- As Server Actions do Next.js já verificam a origem das requisições, o que protege contra CSRF.

### Recuperação de senha

- Em **Esqueci minha senha** (`/esqueci-senha`), a pessoa informa o e-mail. A resposta é sempre a mesma, tenha a conta ou não.
- O link (`/redefinir-senha/{token}`) usa um token aleatório de 32 bytes; o banco guarda só o hash (`password_resets`). Vale 30 minutos e uma única vez; um pedido novo invalida os anteriores.
- Limites: 3 pedidos por hora por e-mail e 10 por conexão.
- Ao redefinir, todas as sessões da conta são encerradas. A página do link não envia o endereço para outros sites (`no-referrer`).
- **Envio:** Resend ou SMTP (Gmail, Outlook, e-mail do domínio...), escolhidos pelas variáveis do `.env`. Sem configuração, os e-mails aparecem no console do servidor e, com `EMAIL_OUTBOX_DIR`, também como arquivos. Guia completo em [instalacao.md](instalacao.md), seção "Configurar o envio de e-mails".

### O que ainda não existe

- Autenticação em dois fatores.
- Confirmação de e-mail no cadastro pelo convite (a aprovação do administrador é a barreira no MVP).
- Limite de tentativas compartilhado entre várias instâncias (exigiria Redis ou tabela própria).

## Perfis e permissões

### Perfis

| Perfil | Situação no MVP |
| --- | --- |
| `ACADEMY_ADMIN` | **Implementado.** Acesso completo aos dados da própria academia: alunos, mensalidades, pagamentos, financeiro, auditoria e administradores. Todos os administradores de uma academia têm o mesmo nível de acesso. |
| `PLATFORM_ADMIN` | **Implementado de forma mínima.** Vê apenas `/plataforma`: lista de academias com nome, situação, número de alunos ativos e de administradores. **Não acessa alunos, mensalidades, pagamentos nem dados pessoais.** Se tentar abrir as telas da academia, é redirecionado. |
| `STUDENT` | **Implementado de forma mínima.** Conta criada pelo próprio aluno, pelo convite ou em "Criar conta" (sem academia). Sem academia ou com o pedido pendente, vê só o aviso correspondente. Depois de aprovado, vê em `/aluno` apenas os próprios dados (cadastro, mensalidades e pagamentos), somente leitura. Não acessa nenhuma tela da academia. |

### Isolamento entre academias

- Toda tabela de negócio tem `academy_id`.
- Todo serviço de academia recebe um `AcademyContext` (`services/context.ts`), obtido **da sessão**, nunca de um parâmetro da requisição, e filtra todas as consultas por `academy_id`, inclusive em gravações e atualizações.
- Não existe função que busque um aluno, mensalidade ou pagamento só pelo ID.
- Buscar o ID de outra academia pela URL mostra "Não encontramos o que você procurava", exatamente como um ID inexistente.
- Relações cruzadas são conferidas: não é possível lançar pagamento de um aluno numa mensalidade de outro.
- Há testes automatizados para isso (`tests/alunos-e-financeiro.test.ts`, "isolamento entre academias").

### Privacidade do administrador da plataforma

Pelo princípio de menor privilégio, o `PLATFORM_ADMIN` não tem acesso aos dados das academias. Quando o suporte com acesso a dados for implementado, ele deve exigir liberação explícita por academia e gerar registro de auditoria (ver roadmap). Hoje, esse acesso **não existe**.

### Auditoria

Registradas em `audit_logs`, na mesma transação da ação: cadastro e alteração de alunos (com os campos alterados), mudança de status, criação, edição, cancelamento e geração de mensalidades, criação, confirmação e cancelamento de pagamentos (com o motivo), lançamentos e cancelamentos no financeiro, criação e desativação de administradores e troca de senha. Cada registro guarda o usuário, a academia e o horário. A consulta está em **Auditoria** no menu e no histórico de cada aluno. Os registros não podem ser editados pela interface.

### Planejado (não implementado)

Verificação em duas etapas para quem tem acesso total e acesso de suporte auditado. As permissões por área da equipe já existem (v0.9). Ver [produto.md](produto.md).

### Convites e entrada de alunos

- A Academia A só adiciona uma conta de aluno pelo e-mail exato (não há busca nem lista de contas), e o pedido criado é dela; a Academia B não o vê.
- Só o administrador da plataforma cria academias; ele vê números agregados, nunca alunos, mensalidades ou pagamentos.
- O convite da Academia A só cria vínculo com a Academia A: a academia vem do token, resolvida no servidor, nunca de um campo do formulário.
- A fila de solicitações e as ações de aprovar, vincular e recusar filtram pela academia do administrador. A Academia B não vê nem decide pedidos da Academia A (há testes para isso).
- A vinculação só aceita um aluno da mesma academia, sem conta e já aprovado.
- A área do aluno consulta sempre pelo par (vínculo, conta logada) e exige o status `active`. Não é possível ver dados de outro aluno trocando o ID.
- Pedidos pendentes e recusados não aparecem na lista de alunos, não recebem mensalidades nem pagamentos.

### Dados sensíveis (0.4.0)

- **Saúde:** lida só na aba Saúde do perfil e, se o administrador marcar, na ficha impressa. Exige consentimento registrado. A auditoria guarda que houve alteração, nunca o conteúdo. Não aparece em listas, buscas, mensagens, na área do aluno nem para o administrador da plataforma.
- **CPF:** completo no formulário e na ficha; mascarado (`529.***.***-25`) no perfil e nas listas.
- **Responsáveis e modalidades** são da academia: não é possível ligar um aluno a um responsável ou a uma modalidade de outra academia (há testes para isso).

### Direitos do titular (0.6.0)

- **Exportação:** no perfil, **Mais ações → Exportar dados (LGPD)** baixa um JSON com tudo o que o sistema guarda sobre o aluno (inclusive saúde, responsáveis, mensalidades e pagamentos). O aluno baixa os próprios dados em **Minha área → Baixar meus dados**. Cada exportação fica na auditoria.
- **Eliminação:** só para aluno inativo, sem mensalidade em aberto nem pagamento aguardando confirmação (enquanto há dívida, a academia tem motivo legítimo para manter os dados). Exige digitar ELIMINAR. Apaga nome, contatos, documentos, endereço, emergência, saúde, observações e consentimentos; remove os vínculos com responsáveis e apaga os responsáveis que não cuidam de mais ninguém; desativa e anonimiza a conta de acesso (se não tiver outros vínculos). Mensalidades, pagamentos e lançamentos continuam, com o nome trocado por "Aluno removido XXXXXX", inclusive nas descrições do financeiro e na auditoria.
- **Recibo:** o administrador vê os recibos da academia; o aluno, só os do próprio vínculo. Pagamento aguardando confirmação não tem recibo; pagamento cancelado sai marcado como cancelado.


### Permissões da equipe (v0.9)

Cada pessoa da equipe da academia (`ACADEMY_ADMIN`) tem `users.permissions`:

- `null` = **acesso total**: vê tudo e é a única que gerencia a equipe (criar, desativar, mudar acesso).
- lista = **personalizado**, com as chaves de `lib/permissions.ts`: `alunos`, `saude` (exige `alunos`), `mensalidades`, `pagamentos`, `financeiro`, `solicitacoes`, `configuracoes`, `auditoria`.

Toda página e Server Action chama `requireAcademyAdmin("<chave>")` (ou `"full"` para a equipe). Sem a permissão, a pessoa volta para a primeira área liberada com um aviso. O menu lateral, a barra do celular e os botões usam `can()` só para esconder o que não pode ser usado: quem protege é sempre o servidor. Ninguém altera o próprio acesso, então a academia sempre mantém alguém com acesso total. A permissão é lida do banco a cada página, e a mudança vale na hora.

## API: Server Actions

O MVP **não expõe uma API REST**. Todas as operações são **Server Actions** do Next.js, chamadas pelos formulários da própria aplicação. Toda action:

- exige sessão válida de `ACADEMY_ADMIN` (`requireAcademyAdmin()`); sem ela, redireciona para `/login`;
- opera **somente** sobre dados da academia do usuário logado;
- valida os dados no servidor (Zod) antes de qualquer gravação.

Actions com formulário (`useActionState`) devolvem `ActionState`:

```ts
{ message?: string; errors?: Record<string, string>; values?: Record<string, string> }
```

Em caso de sucesso, redirecionam com `?ok=<código>` (a mensagem de sucesso aparece na tela de destino). Actions de botão (sem estado) redirecionam de volta com `?ok=` ou `?erro=<mensagem>`.

Valores monetários são enviados como texto no formato brasileiro (`"150,00"`, `"1.234,56"`); datas como `YYYY-MM-DD`; período como `YYYY-MM`.

### Autenticação (`app/login/actions.ts`)

| Action | Campos | Resultado | Erros |
| --- | --- | --- | --- |
| `login` | `email`, `password` | cria a sessão e redireciona para `/` (ou `/plataforma`) | "E-mail ou senha incorretos.", "Muitas tentativas. Aguarde 15 minutos..." |
| `logout` | — | apaga a sessão e redireciona para `/login` | — |

### Alunos (`app/(app)/alunos/actions.ts`)

| Action | Campos | Sucesso | Erros possíveis |
| --- | --- | --- | --- |
| `createStudentAction` | `name`*, `modality`*, `joinedAt`*, `monthlyFee`*, `dueDay`* (1–31), `status`* (`active`/`inactive`), `phone`, `email`, `birthDate`, `notes` | `/alunos/{id}?ok=aluno-criado` | campo obrigatório, e-mail ou telefone inválido, valor inválido, data inválida |
| `updateStudentAction(id)` | mesmos campos | `/alunos/{id}?ok=aluno-salvo` | os mesmos, "Aluno não encontrado." |
| `toggleStudentStatusAction` | `id`, `status` | `/alunos/{id}?ok=aluno-status` | aluno de outra academia: 404 |

### Mensalidades (`app/(app)/mensalidades/actions.ts`)

| Action | Campos | Sucesso | Erros possíveis |
| --- | --- | --- | --- |
| `createFeeAction` | `studentId`*, `amount`*, `dueDate`*, `reference`* (`YYYY-MM`), `notes` | perfil do aluno, aba mensalidades | "Este aluno já tem uma mensalidade para esse período." |
| `updateFeeAction(id)` | `amount`*, `dueDate`*, `reference`*, `notes`, `back` | página de origem `?ok=mensalidade-salva` | "Mensalidade paga não pode ser editada...", "Esta mensalidade já recebeu pagamento..." |
| `cancelFeeAction` | `id`, `back` | `?ok=mensalidade-cancelada` | "Cancele os pagamentos desta mensalidade antes de cancelá-la." |
| `generateFeesAction` | `reference`* | `/mensalidades?...&ok=mensalidades-geradas&geradas=N` | "Escolha um mês válido." |

### Pagamentos (`app/(app)/pagamentos/actions.ts`)

| Action | Campos | Sucesso | Erros possíveis |
| --- | --- | --- | --- |
| `createPaymentAction` | `studentId`*, `amount`*, `paidAt`*, `method`* (`cash`/`pix`/`debit`/`credit`/`other`), `status`* (`paid`/`pending`), `feeId`, `reference`, `notes` | perfil do aluno, aba pagamentos | "O valor passa do saldo da mensalidade (R$ X).", "Esta mensalidade já está paga.", "Esta mensalidade é de outro aluno." |
| `confirmPaymentAction` | `id`, `back` | `?ok=pagamento-confirmado` | "Só pagamentos pendentes podem ser confirmados." |
| `cancelPaymentAction` | `id`, `reason`* (3+ caracteres), `back` | `?ok=pagamento-cancelado` | "Informe o motivo do cancelamento.", "Este pagamento já foi cancelado." |

Efeitos: um pagamento `paid` cria a entrada no financeiro e recalcula a mensalidade; cancelar cancela a entrada e recalcula a mensalidade.

### Financeiro (`app/(app)/financeiro/actions.ts`)

| Action | Campos | Sucesso | Erros possíveis |
| --- | --- | --- | --- |
| `createEntryAction` | `type`* (`income`/`expense`), `category`*, `description`*, `amount`*, `date`*, `notes` | `/financeiro?ok=lancamento-criado` | "Categoria inválida para esse tipo de lançamento." |
| `cancelEntryAction` | `id`, `back` | `?ok=lancamento-cancelado` | "Esta entrada veio de um pagamento. Para desfazer, cancele o pagamento." |

Categorias de entrada: `Matrícula`, `Outros recebimentos`. De saída: `Equipamentos`, `Manutenção`, `Infraestrutura`, `Despesas operacionais`, `Outras despesas`.

### Configurações (`app/(app)/configuracoes/actions.ts`)

| Action | Campos | Sucesso | Erros possíveis |
| --- | --- | --- | --- |
| `changePasswordAction` | `current`*, `next`* (10+), `confirm`* | `?ok=senha-alterada` | "Senha atual incorreta.", "As senhas não conferem." |
| `createUserAction` | `name`*, `email`*, `password`* (10+) | `?ok=usuario-criado` | "Já existe um usuário com esse e-mail." |
| `toggleUserAction` | `id`, `active` | `?ok=usuario-salvo` | "Você não pode desativar o seu próprio acesso." |

### Exemplo

Registrar R$ 100,00 de uma mensalidade de R$ 150,00, pelo formulário `/pagamentos/novo`:

```text
studentId=4f0c…  feeId=9a1e…  amount=100,00  paidAt=2026-09-10  method=pix  status=paid
```

Resultado: pagamento criado, entrada de R$ 100,00 no financeiro, mensalidade continua `pending` com saldo de R$ 50,00, registro `payment.created` na auditoria e redirecionamento para `/alunos/4f0c…?aba=pagamentos&ok=pagamento-registrado`.

### Convites e entrada de alunos

| Action | Arquivo | Acesso | Campos | Sucesso | Erros possíveis |
| --- | --- | --- | --- | --- | --- |
| `regenerateInviteAction` | `app/(app)/convidar/actions.ts` | ACADEMY_ADMIN | — | `/convidar?ok=convite-novo` (o código anterior é revogado) | — |
| `signupAction(token)` | `app/convite/[token]/actions.ts` | público | `name`*, `phone`*, `email`*, `birthDate`* (18+), `password`* (10+), `confirm`*, `consent`* | cria a sessão e vai para `/aluno?ok=pedido-enviado` | "Este convite não é mais válido...", "Já existe uma conta com este e-mail...", "O cadastro pelo convite é para maiores de 18 anos...", limite de cadastros |
| `joinAction(token)` | `app/convite/[token]/actions.ts` | STUDENT | — | `/aluno?ok=pedido-enviado` | "Você já tem vínculo ou pedido nesta academia.", "Seu pedido para esta academia foi recusado..." |
| `approveAction(id)` | `app/(app)/solicitacoes/actions.ts` | ACADEMY_ADMIN | `modality`*, `joinedAt`*, `monthlyFee`*, `dueDay`*, `notes` | perfil do aluno `?ok=entrada-aprovada` | "Este pedido já foi analisado." |
| `linkAction` | idem | ACADEMY_ADMIN | `id` (pedido), `existing` (aluno já cadastrado) | perfil do aluno existente `?ok=entrada-vinculada` | "Escolha um aluno já cadastrado nesta academia e sem conta." |
| `rejectAction` | idem | ACADEMY_ADMIN | `id`, `reason` (opcional, até 200 caracteres, visível ao aluno) | `/solicitacoes?ok=entrada-recusada` | "Este pedido já foi analisado." |

O endereço do convite é `/convite/{token}`. O token tem 24 caracteres aleatórios (144 bits) e não contém dados da academia nem de pessoas. Um token inexistente, revogado, vencido ou esgotado mostra a mesma mensagem de "convite inválido", sem revelar qual é o caso.

### Recuperação de senha, recibo e LGPD (0.6.0)

| Operação | Tipo e arquivo | Acesso | Entrada | Resultado |
| --- | --- | --- | --- | --- |
| `requestResetAction` | Server Action, `app/esqueci-senha/actions.ts` | público | `email` | sempre `{ sent: true }`; envia o link se a conta existir e estiver ativa |
| `resetAction(token)` | Server Action, `app/redefinir-senha/[token]/actions.ts` | público (com token) | `next` (10+), `confirm` | redireciona para `/login?ok=senha-redefinida`; erro "Este link não é mais válido" |
| `GET /alunos/{id}/exportar` | Route Handler | ACADEMY_ADMIN | — | JSON (download) com os dados do aluno; 404 para aluno de outra academia |
| `GET /aluno/meus-dados` | Route Handler | STUDENT | — | JSON (download) com a conta e todos os vínculos da pessoa |
| `anonymizeAction(id)` | Server Action, `app/(app)/alunos/actions.ts` | ACADEMY_ADMIN | `confirmation` = ELIMINAR | perfil com `?ok=dados-eliminados`; erros: aluno ativo, mensalidade em aberto, pagamento aguardando confirmação |
| `/pagamentos/{id}/recibo`, `/aluno/recibo/{id}` | Páginas | ACADEMY_ADMIN, STUDENT (só os próprios) | — | recibo para imprimir; 404 para pagamento aguardando confirmação ou de outra academia |

## Identidade visual e Área do Aluno (0.11)

- **Duas marcas, dois papéis.** Kombexa é o produto (`components/Brand.tsx`, metadados, rodapé dos documentos). A logo da academia (`services/branding.ts`) encabeça os documentos dela (`components/DocumentHeader.tsx`). Toda escrita de logo usa `ctx.academyId` da sessão; nenhum campo de formulário escolhe a academia.
- **Imagens validadas pelo conteúdo** (`lib/image.ts`): assinatura binária e dimensões de PNG, JPEG e WebP lidas do arquivo; SVG recusado. As logos ficam no PostgreSQL (interface `LogoStore`, trocável) e vão para o documento como `data:` URL, sem rota pública.
- **Documentos** (`services/documents.ts`): dois pontos de entrada com checagem própria (`enrollmentDocument` para a equipe, `ownEnrollmentDocument` para o aluno, via `ownsOrGuards`) e um carregador que sempre filtra pelo par academia + aluno. Saúde só entra com a permissão `saude`, e nunca na versão do aluno.
- **Área do Aluno:** toda consulta parte de `activeLinks` ou de `ownsOrGuards` (`services/student-portal.ts`). O aluno não tem nenhum serviço de escrita sobre mensalidades, pagamentos ou presença.
- **QR Code de presença** (`services/checkin.ts`): o QR leva só `KBX1:` + 12 caracteres aleatórios. A equipe registra com `checkInByCode`, que confere a academia da sessão e reaproveita `attendances` (uma por dia, sem duplicar). Gerar um novo código invalida o anterior.
- **Tema:** tokens em `app/styles/base.css`; tema escuro em `tema-escuro.css` por `data-theme` ou pelo sistema; preferência em cookie, aplicada antes da pintura (`lib/theme.ts`).
- **Testes de guarda:** `tests/guardas.test.ts` exige `requireAcademyAdmin(permissão)` na área da equipe e `requireStudent()` em toda a Área do Aluno.
