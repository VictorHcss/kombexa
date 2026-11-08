# API e rotas

O Kombexa **não tem uma API REST pública** para integrações. O que existe:

1. **Páginas** (`page.tsx`): respondem `GET` com HTML.
2. **Server Actions** (`actions.ts`): funções chamadas pelos formulários. Tecnicamente viram um `POST` para a URL da página, com um identificador da action gerado no build. **Não são uma API estável**: o identificador muda entre builds e não deve ser chamado por sistemas externos.
3. **Route Handlers** (`route.ts`): os únicos endpoints HTTP "de verdade". São 6.

Este inventário foi gerado lendo o código (cada arquivo e o guarda que ele chama) e conferido com a saída do `npm run build`, que lista 49 rotas.

**Convenções de resposta das Server Actions:** sucesso → `redirect` para a próxima tela com `?ok=<código>` (vira um aviso verde); falha de validação ou regra → devolvem `{ message, errors: {campo: mensagem}, values }` e o formulário mostra os erros sem perder o que foi digitado; erro inesperado → mensagem genérica e detalhe só no log do servidor. Sem sessão → `redirect("/login")`; sem permissão → redireciona para a primeira área liberada com `?erro=...`.

---

## 1. Route Handlers (endpoints HTTP)

### `GET /api/saude`

| | |
| --- | --- |
| Finalidade | Monitor de disponibilidade (UptimeRobot, healthcheck do Docker): executa `select 1` no banco |
| Autenticação | Nenhuma |
| Resposta 200 | `{"ok": true, "at": "2026-11-03T15:04:03.967Z"}` |
| Resposta 503 | `{"ok": false}` (banco fora do ar). Não expõe o erro |
| Arquivo | `app/api/saude/route.ts` |

Verificado na auditoria: respondeu 200.

### `POST /api/tarefas/diarias`

| | |
| --- | --- |
| Finalidade | Tarefa diária: gera mensalidades do mês e envia lembretes |
| Autenticação | Cabeçalho `Authorization: Bearer <CRON_SECRET>` |
| Corpo | Vazio |
| Resposta 200 | `{"academies": 2, "generated": 0, "reminders": 0}` |
| Resposta 401 | `Não autorizado`: sem `CRON_SECRET` configurado, segredo com menos de 16 caracteres ou segredo errado (comparação em tempo constante) |
| Idempotente | Sim: pode rodar de hora em hora |
| Arquivo | `app/api/tarefas/diarias/route.ts` → `services/automation.ts` |

```bash
curl -X POST -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/tarefas/diarias
```

### `GET /financeiro/exportar`

| | |
| --- | --- |
| Finalidade | CSV das movimentações do período (abre direto no Excel em português) |
| Autenticação | Sessão da equipe com a permissão **`financeiro`** |
| Parâmetros (query) | `de` e `ate` (AAAA-MM-DD; padrão: mês atual), `tipo` (`income` ou `expense`) |
| Resposta | `text/csv`, arquivo `financeiro-<de>-a-<ate>.csv`; separador `;`, BOM UTF-8, saídas com valor negativo |
| Limite | 20 000 linhas |

### `GET /mensalidades/exportar`

| | |
| --- | --- |
| Finalidade | CSV das mensalidades filtradas |
| Autenticação | Permissão **`mensalidades`** |
| Parâmetros | `status` (`pending`, `overdue`, `paid`, `canceled`), `de`, `ate`, `q` (busca por nome) |
| Resposta | `text/csv`, arquivo `mensalidades-<hoje>.csv` |
| Limite | 10 000 linhas |

> Desde a auditoria, textos que começariam uma fórmula do Excel (`=`, `+`, `-`, `@`) recebem um apóstrofo na frente nas duas exportações CSV (ver [SEGURANCA.md](SEGURANCA.md)).

### `GET /alunos/{id}/exportar`

| | |
| --- | --- |
| Finalidade | LGPD: todos os dados de um aluno em JSON (direito de acesso do titular) |
| Autenticação | Permissão **`alunos`** |
| Parâmetros | `id` (UUID) na URL |
| Resposta 200 | `application/json` como anexo |
| Resposta 404 | ID inválido, inexistente ou **de outra academia** (mesma resposta, não revela qual) |

### `GET /aluno/meus-dados`

| | |
| --- | --- |
| Finalidade | LGPD: o próprio aluno baixa os seus dados |
| Autenticação | Perfil `STUDENT` |
| Resposta | `application/json`, arquivo `meus-dados-kombexa.json` |

---

## 2. Páginas

### Públicas

| Caminho | Finalidade |
| --- | --- |
| `/login` | Entrar. Mostra contas de teste se `SHOW_TEST_ACCOUNTS` permitir |
| `/esqueci-senha` | Pedir link de redefinição (resposta igual exista o e-mail ou não) |
| `/redefinir-senha/{token}` | Criar nova senha (link de 30 min, uso único) |
| `/confirmar-email/{token}` | Confirmar e-mail |
| `/criar-conta` | Conta de aluno sem academia, ou entrar com código de convite |
| `/convite/{token}` | Cadastro pelo QR Code/link de convite |
| `/sem-acesso` | Aviso para membro da equipe sem nenhuma permissão |

### Área da equipe da academia (`app/(app)/`)

O grupo `(app)` não aparece na URL. Todas usam `requireAcademyAdmin`.

| Caminho | Permissão |
| --- | --- |
| `/` (Início) | qualquer membro; quem não tem `mensalidades` é enviado para a primeira área liberada |
| `/alunos`, `/alunos/novo`, `/alunos/{id}`, `/alunos/{id}/editar`, `/alunos/{id}/ficha` | `alunos` |
| `/mensalidades`, `/mensalidades/nova`, `/mensalidades/gerar`, `/mensalidades/{id}/editar` | `mensalidades` |
| `/pagamentos`, `/pagamentos/novo`, `/pagamentos/{id}/recibo` | `pagamentos` |
| `/financeiro`, `/financeiro/novo`, `/relatorios` | `financeiro` |
| `/presenca` | `presenca` |
| `/solicitacoes`, `/convidar` | `solicitacoes` |
| `/comunicados` | `comunicados` |
| `/auditoria` | `auditoria` |
| `/configuracoes` | qualquer membro (a página mostra só as abas permitidas) |
| `/documentacao` | qualquer membro (ajuda de uso) |

### Área do aluno (`app/aluno/`), todas com `requireStudent()`

| Caminho | Finalidade |
| --- | --- |
| `/aluno` | Situação, mensalidades, Pix copia e cola; para responsável, os dependentes |
| `/aluno/carteirinha` | Carteirinha digital com o QR de presença |
| `/aluno/frequencia` | Presenças |
| `/aluno/comunicados` | Mural da academia |
| `/aluno/documentos`, `/aluno/documentos/{id}` | Ficha de matrícula e lista de recibos |
| `/aluno/recibo/{id}` | Recibo de um pagamento (só se for do aluno ou de um dependente) |
| `/aluno/conta` | Telefone, senha, reenvio de confirmação de e-mail |

### Plataforma

| Caminho | Guarda |
| --- | --- |
| `/plataforma` | `requirePlatformAdmin()` |

---

## 3. Server Actions

Coluna "Guarda": a chamada feita **na primeira linha** da action. Coluna "Serviço": a função de `services/` que faz o trabalho.

### Alunos: `app/(app)/alunos/actions.ts`

| Action | Guarda | Serviço | Corpo (campos principais) |
| --- | --- | --- | --- |
| `createStudentAction` | `alunos` | `createStudent` | nome, telefone, e-mail, nascimento, modalidade, início, status, mensalidade, dia de vencimento, CPF, endereço, emergência, consentimento de imagem, responsável |
| `updateStudentAction` | `alunos` | `updateStudent` | idem |
| `toggleStudentStatusAction` | `alunos` | `setStudentStatus` | ativo/inativo |
| `searchStudentsAction(q)` | equipe + (`alunos` **ou** `mensalidades` **ou** `pagamentos`)* | `listStudents` | texto de busca (mín. 2 caracteres, máx. 80); devolve até 8 alunos |
| `searchGuardiansAction(q)` | `alunos` | `searchGuardians` | texto de busca |
| `saveGuardianAction` / `primaryGuardianAction` / `removeGuardianAction` | `alunos` | `saveGuardian` etc. | dados do responsável |
| `saveHealthAction` | **`saude`** | `updateHealth` | observações de saúde + consentimento |
| `signedAction` | `alunos` | `setEnrollmentSigned` | data em que a ficha foi assinada |
| `anonymizeAction` | `alunos` | `anonymizeStudent` | eliminação LGPD (irreversível; financeiro mantido anônimo) |
| `guardianAccessAction` | `alunos` | `grantGuardianAccess` / `revokeGuardianAccess` | dá ou tira o acesso do responsável à área do aluno |
| `addRankAction` / `removeRankAction` | `alunos` | `addRank` / `removeRank` | graduação, data, quem graduou, modalidade |

\* Corrigido na auditoria: antes, qualquer membro da equipe recebia os resultados.

### Mensalidades, pagamentos e financeiro

| Action | Guarda | Serviço | Observação |
| --- | --- | --- | --- |
| `createFeeAction` | `mensalidades` | `createFee` | aluno, valor, vencimento, referência |
| `updateFeeAction` | `mensalidades` | `updateFee` | não edita mensalidade que já recebeu pagamento |
| `cancelFeeAction` | `mensalidades` | `cancelFee` | |
| `generateFeesAction` | `mensalidades` | `generateMonthlyFees` | em lote; não duplica |
| `createPaymentAction` | `pagamentos` | `createPayment` | aluno, mensalidade (opcional), valor, data, forma, status (`paid`/`pending`) |
| `confirmPaymentAction` | `pagamentos` | `confirmPayment` | pagamento pendente → pago |
| `cancelPaymentAction` | `pagamentos` | `cancelPayment` | exige motivo |
| `createEntryAction` | `financeiro` | `createEntry` | tipo, categoria, descrição, valor, data (não aceita a categoria automática "Mensalidade") |
| `cancelEntryAction` | `financeiro` | `cancelEntry` | |

### Rotina e comunicação

| Action | Guarda | Serviço |
| --- | --- | --- |
| `togglePresenceAction` | `presenca` | `setPresence` |
| `checkInAction` | `presenca` | `checkInByCode` |
| `saveAnnouncementAction` / `archiveAnnouncementAction` | `comunicados` | `createAnnouncement` / `updateAnnouncement` / `setAnnouncementArchived` |
| `approveAction` / `linkAction` / `rejectAction` | `solicitacoes` | decisões sobre pedidos de entrada |
| `addByEmailAction` | `solicitacoes` | `addStudentByEmail` |
| `regenerateInviteAction` | `solicitacoes` | `regenerateInvite` (invalida o QR anterior) |
| `emailInviteAction` | `solicitacoes` | `sendInviteEmail` (limite: 30 por hora por academia) |

### Configurações: `app/(app)/configuracoes/actions.ts`

| Action | Guarda | Serviço |
| --- | --- | --- |
| `createUserAction` / `toggleUserAction` / `updatePermissionsAction` | **`full`** (acesso total) | `createAcademyAdmin` / `setUserActive` / `updateUserPermissions` |
| `changePasswordAction` | qualquer membro | `changePassword` (encerra as outras sessões) |
| `updateAcademyAction` / `updateTermsAction` | `configuracoes` | `updateAcademy` / `updateTerms` |
| `saveModalityAction` / `toggleModalityAction` | `configuracoes` | `createModality` / `updateModality` / `setModalityActive` |
| `uploadLogoAction` / `removeLogoAction` | `configuracoes` | `saveAcademyLogo` (PNG/JPEG/WebP até 1 MB, validados pelo conteúdo) / `removeAcademyLogo` |

### Área do aluno

| Action | Guarda | Serviço |
| --- | --- | --- |
| `regenerateCodeAction` | `requireStudent()` | `regenerateCheckinCode` |
| `updateContactAction` | `requireStudent()` | `updateOwnPhone` |
| `studentPasswordAction` | `requireStudent()` | `changePassword` |
| `resendVerificationAction` | `requireStudent()` | `sendEmailVerification` (5 por hora) |
| `joinAction` (convite, já logado) | `requireStudent()` | `joinWithInvite` |

### Plataforma: `app/plataforma/actions.ts`

| Action | Guarda | Serviço |
| --- | --- | --- |
| `createAcademyAction` | `requirePlatformAdmin()` | `createAcademyWithAdmin` (envia link de acesso de 72 h) |
| `resendAccessAction` | `requirePlatformAdmin()` | `resendAdminAccess` |
| `toggleAcademyAction` | `requirePlatformAdmin()` | `setAcademyActive` (suspender derruba as sessões) |

### Públicas (sem sessão)

| Action | Proteção |
| --- | --- |
| `login` | 5 tentativas erradas por e-mail a cada 15 min; tempo de resposta constante |
| `logout` | apaga a sessão |
| `requestResetAction` | 3 pedidos por e-mail e 10 por conexão, por hora; resposta sempre igual |
| `resetAction` | token de uso único e com validade |
| `signupAction` (convite) | 10 cadastros por hora por conexão; só maiores de 18 |
| `studentSignupAction` | 10 por hora por conexão |
| `inviteCodeAction` | 30 tentativas a cada 15 min por conexão |

> Os limites por "conexão" usam o IP de `X-Forwarded-For`, que só é confiável atrás de um proxy que reescreva esse cabeçalho. Ver [SEGURANCA.md](SEGURANCA.md).

## 4. Erros possíveis (resumo)

| Situação | Comportamento |
| --- | --- |
| Sem sessão | `redirect /login` |
| Perfil errado (ex.: aluno numa tela da academia) | Redireciona para a área do perfil |
| Sem a permissão da área | Volta para a primeira área liberada com `?erro=Você não tem permissão...` |
| Registro de outra academia ou inexistente | "não encontrado" (páginas respondem HTTP 200 com a mensagem por causa do streaming; rotas `route.ts` respondem 404) |
| Validação | Mensagens por campo, valores preservados |
| Regra de negócio (`DomainError`) | Mensagem clara (ex.: "O valor passa do saldo da mensalidade (R$ 50,00).") |
| Erro inesperado | "Não foi possível salvar agora..." e linha JSON no log com `digest` |
