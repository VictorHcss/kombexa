# Banco de dados

**Tecnologia:** PostgreSQL 16, acessado pelo Drizzle ORM 0.45 com o driver `postgres` (postgres.js).
**Fonte da verdade:** `projeto/db/schema.ts`. **Migrations:** `projeto/drizzle/`.

Verificações feitas na auditoria:

- As 12 migrations foram aplicadas num PostgreSQL 16 limpo e criaram **19 tabelas** e **48 índices**.
- As chaves estrangeiras e os `CHECK` foram lidos do banco já migrado (`pg_constraint`) e conferem com o `schema.ts`.
- `drizzle-kit generate`, rodado numa cópia descartável, respondeu **"No schema changes"**: schema e migrations estão sincronizados.

## 1. Diagrama ER

Gerado a partir do `schema.ts` (só as colunas principais de cada tabela; a lista completa está na seção 3).

```mermaid
erDiagram
  academies ||--o{ users : "equipe (academy_id)"
  academies ||--o{ students : "vínculos"
  academies ||--o{ modalities : ""
  academies ||--o{ guardians : ""
  academies ||--o{ invites : ""
  academies ||--o{ fees : ""
  academies ||--o{ payments : ""
  academies ||--o{ financial_entries : ""
  academies ||--o{ attendances : ""
  academies ||--o{ announcements : ""
  academies ||--o{ student_ranks : ""
  academies ||--o{ audit_logs : ""
  academies ||--o| academy_logos : "logo"

  users ||--o{ sessions : ""
  users ||--o{ password_resets : ""
  users ||--o{ email_verifications : ""
  users |o--o{ students : "conta do aluno (user_id)"
  users |o--o{ guardians : "conta do responsável"

  modalities ||--o{ students : "RESTRICT"
  invites |o--o{ students : "entrou por"
  students ||--o{ student_guardians : ""
  guardians ||--o{ student_guardians : "RESTRICT"
  students ||--o{ fees : "RESTRICT"
  students ||--o{ payments : "RESTRICT"
  fees |o--o{ payments : "RESTRICT"
  payments |o--o| financial_entries : "payment_id único"
  fees ||--o{ fee_reminders : ""
  students ||--o{ attendances : ""
  students ||--o{ student_ranks : ""

  academies {
    uuid id PK
    varchar name
    boolean active
    varchar timezone
    varchar pix_key
    boolean auto_generate_fees
    int reminder_days_before
  }
  users {
    uuid id PK
    uuid academy_id FK "null p/ plataforma e aluno"
    user_role role
    varchar email "único sem maiúsculas"
    text password_hash
    text_array permissions "null = acesso total"
  }
  students {
    uuid id PK
    uuid academy_id FK
    uuid user_id FK
    uuid modality_id FK
    student_status status
    int monthly_fee_cents
    int due_day
    text health_notes "dado sensível"
    varchar checkin_code "único"
    timestamptz closed_at
  }
  fees {
    uuid id PK
    uuid student_id FK
    int amount_cents
    date due_date
    varchar reference "AAAA-MM"
    fee_status status
  }
  payments {
    uuid id PK
    uuid student_id FK
    uuid fee_id FK "opcional"
    int amount_cents
    date paid_at
    payment_method method
    payment_status status
  }
  financial_entries {
    uuid id PK
    entry_type type
    int amount_cents
    uuid payment_id FK "único"
    entry_status status
  }
```

## 2. Tipos enumerados

| Enum | Valores | Observação |
| --- | --- | --- |
| `user_role` | `PLATFORM_ADMIN`, `ACADEMY_ADMIN`, `STUDENT` | |
| `student_status` | `active`, `inactive`, `pending`, `rejected`, `suspended` | `suspended` está reservado e **não é usado** pelo código atual |
| `fee_status` | `pending`, `paid`, `canceled` | "Atrasada" **não existe** aqui: é calculada |
| `payment_status` | `paid`, `pending`, `canceled` | |
| `payment_method` | `cash`, `pix`, `debit`, `credit`, `other` | |
| `entry_type` | `income`, `expense` | |
| `entry_status` | `active`, `canceled` | |

## 3. Tabelas

As colunas `created_at` e `updated_at` (com fuso) aparecem em quase todas e foram omitidas. Todas as chaves primárias são UUID gerado pelo banco (`gen_random_uuid()`), exceto `academy_logos` (PK = `academy_id`) e `student_guardians` (PK composta).

### Identidade e acesso

| Tabela | Colunas relevantes | Regras |
| --- | --- | --- |
| `academies` | `name`, `active`, `document` (CPF/CNPJ), `legal_name`, `owner_name`, contatos, endereço, `enrollment_terms`, `timezone`, `pix_key`, `auto_generate_fees`, `reminder_days_before`, `overdue_reminder` | Academia suspensa (`active=false`) bloqueia login e derruba as sessões da equipe |
| `users` | `academy_id`, `role`, `name`, `email`, `password_hash`, `active`, `permissions`, `email_verified_at`, consentimento LGPD | E-mail único sem diferenciar maiúsculas (`users_email_unique` em `lower(email)`) |
| `sessions` | `user_id`, `token_hash` (SHA-256), `expires_at` | Token único; só o hash é guardado |
| `password_resets` | `user_id`, `token_hash`, `expires_at`, `used_at` | Link de uso único, 30 min (72 h no primeiro acesso) |
| `email_verifications` | `user_id`, `token_hash`, `expires_at`, `used_at` | Idem |

### Pessoas da academia

| Tabela | Colunas relevantes | Regras |
| --- | --- | --- |
| `modalities` | `academy_id`, `name`, `default_fee_cents`, `active` | Nome único por academia (sem maiúsculas); desativar em vez de apagar |
| `invites` | `academy_id`, `token`, `label`, `expires_at`, `max_uses`, `uses_count`, `revoked_at` | Token único |
| `students` | ver diagrama, mais CPF, endereço, emergência, consentimentos (imagem, saúde, dados), `anonymized_at`, `decided_at/by`, `rejection_reason`, `closed_at` | Ver "restrições" abaixo |
| `guardians` | `academy_id`, `name`, `cpf`, `phone` (obrigatório), `email`, `user_id`, endereço | Responsável ligado a aluno não pode ser apagado |
| `student_guardians` | `student_id`, `guardian_id`, `relationship`, `is_primary` | No máximo um principal por aluno |

### Dinheiro

| Tabela | Colunas relevantes | Regras |
| --- | --- | --- |
| `fees` | `student_id`, `amount_cents`, `due_date`, `reference`, `status`, `notes` | Uma mensalidade **não cancelada** por aluno e mês |
| `payments` | `student_id`, `fee_id`, `amount_cents`, `paid_at`, `method`, `status`, `canceled_at`, `cancel_reason`, `created_by` | Nunca apagado; cancelado com motivo |
| `financial_entries` | `type`, `category`, `description`, `amount_cents`, `date`, `status`, `payment_id` | `payment_id` único: um pagamento gera no máximo uma entrada |
| `fee_reminders` | `fee_id`, `kind` (`before`/`overdue`), `sent_to`, `sent_at` | Único por (mensalidade, tipo): o lembrete não se repete |

### Rotina e comunicação

| Tabela | Colunas relevantes | Regras |
| --- | --- | --- |
| `attendances` | `student_id`, `date`, `created_by` | Uma presença por aluno por dia |
| `student_ranks` | `student_id`, `modality_id`, `rank` (texto livre), `awarded_at`, `awarded_by`, `notes` | Histórico: cada promoção é uma linha |
| `announcements` | `title`, `body`, `category`, `pinned`, `published_at`, `archived_at` | Arquivar tira do mural sem apagar |
| `academy_logos` | `mime`, `data` (bytea), `size_bytes`, `width`, `height`, `sha256` | Uma por academia; `CHECK` contra arquivo vazio |
| `audit_logs` | `academy_id`, `user_id`, `action`, `entity`, `entity_id`, `summary`, `data` (jsonb) | Gravado na mesma transação da ação |

## 4. Restrições de integridade (garantidas pelo banco)

| Restrição | Onde | O que impede |
| --- | --- | --- |
| `users_email_unique` em `lower(email)` | `users` | Duas contas com o mesmo e-mail em maiúsculas diferentes |
| `students_complete_when_approved` (CHECK) | `students` | Aluno fora de `pending`/`rejected` sem modalidade, data de início ou valor |
| `students_user_academy_unique` (índice parcial, `closed_at IS NULL`) | `students` | Duas matrículas em aberto da mesma conta na mesma academia |
| `fees_student_reference_unique` (parcial, `status <> 'canceled'`) | `fees` | Mensalidade duplicada no mesmo mês, mesmo com geração simultânea |
| `financial_entries.payment_id` UNIQUE | `financial_entries` | Pagamento contado duas vezes no caixa |
| `attendances_student_date` UNIQUE | `attendances` | Presença duplicada no dia (o check-in usa `ON CONFLICT DO NOTHING`) |
| `fee_reminders_fee_kind` UNIQUE | `fee_reminders` | Lembrete repetido |
| `student_guardians_one_primary` (parcial) | `student_guardians` | Dois responsáveis principais |
| `ON DELETE RESTRICT` em `fees`, `payments`, `financial_entries.payment_id`, `students.modality_id` | vários | Apagar histórico financeiro ou modalidade em uso |
| `ON DELETE CASCADE` a partir de `academies` | todas as tabelas de negócio | Dados órfãos se uma academia for apagada |

> **Observação da auditoria (precisa de validação, baixo risco):** como `fees.student_id` é `RESTRICT` e `students.academy_id` é `CASCADE`, apagar fisicamente uma academia que tenha mensalidades provavelmente seria recusado pelo PostgreSQL. Isso não afeta o uso atual, porque **o sistema não apaga academias**: só as suspende (`active=false`). Se um dia existir "excluir academia", a ordem de exclusão precisará ser pensada.

## 5. Índices de desempenho

Além dos índices únicos acima: `students` por (academia, status), (academia, nome minúsculo) e (academia, telefone); `fees` por (academia, status, vencimento) e por aluno; `payments` por (academia, data), por mensalidade e por aluno; `financial_entries`, `attendances`, `audit_logs` e `announcements` por (academia, data); `invites` por academia; `password_resets` por usuário; `student_ranks` por (aluno, data).

## 6. Dinheiro e datas

- **Valores em centavos**, sempre `integer` (`amount_cents`, `monthly_fee_cents`). R$ 150,90 é gravado como `15090`. Somas são feitas no SQL e convertidas para `bigint`.
- **Datas de calendário** (vencimento, pagamento, presença) são `date`, sem hora. "Hoje" é calculado no fuso da academia (`academies.timezone`).
- **Momentos** (criação, consentimento, sessão) são `timestamptz`.

## 7. Migrations

| Arquivo | O que cria ou altera (conferido no SQL) |
| --- | --- |
| `0000_init.sql` | Os 7 enums e as tabelas iniciais (`academies`, `users`, `sessions`, `students`, `fees`, `payments`, `financial_entries`, `audit_logs`) |
| `0001_invites.sql` | Tabela `invites`; em `students`: `user_id`, `invite_id`, `decided_at/by`, `rejection_reason`; remove o antigo `users.student_id` |
| `0002_vinculo_encerrado.sql` | `students.closed_at` e o índice parcial `students_user_academy_unique` refeito |
| `0003_cadastro_completo.sql` | Tabelas `modalities`, `guardians`, `student_guardians`; endereço e documento da academia; CPF, endereço, emergência e consentimentos do aluno; `students.modality_id` (com cópia dos dados) |
| `0004_modalidade_ligada.sql` | Remove a coluna de texto `students.modality` (depois da cópia feita na 0003) |
| `0005_consentimento.sql` | `data_consent_at` e `data_consent_text` em `students` |
| `0006_senha_e_titular.sql` | Tabela `password_resets`; `students.anonymized_at` (eliminação LGPD) |
| `0007_conta_sem_academia.sql` | Em `users`: telefone, nascimento e consentimento (conta de aluno sem academia) |
| `0008_equipe_fuso_pix_email.sql` | Tabela `email_verifications`; `academies.timezone` e `pix_key`; `users.permissions` e `email_verified_at` |
| `0009_automacao_lembretes.sql` | Tabela `fee_reminders`; campos de automação em `academies` |
| `0010_presenca_responsavel.sql` | Tabela `attendances`; `guardians.user_id` (acesso do responsável) |
| `0011_identidade_comunicados_graduacao.sql` | Tabelas `academy_logos`, `announcements`, `student_ranks`; `legal_name`/`owner_name` da academia; `checkin_code` do aluno |

Comandos:

```bash
npm run db:migrate    # aplica as pendentes (o container também faz isso ao iniciar)
npm run db:generate   # depois de editar db/schema.ts: gera o SQL da próxima migration
```

Regras para não se machucar:

1. **Nunca edite uma migration que já foi aplicada** em algum banco. Crie outra.
2. Leia o SQL gerado antes de aplicar: o `drizzle-kit` pode propor `DROP COLUMN` quando você renomeia algo.
3. Teste primeiro no banco de teste (`npm test` recria tudo a partir das migrations).

## 8. Seeds

`scripts/seed.ts` (`npm run db:seed`) cria uma academia fictícia, 6 modalidades, alunos, responsáveis, mensalidades de dois meses (pagas, parciais e atrasadas), despesas, presenças e 7 contas de teste com a senha pública `kombexa123`.

- Usa as **mesmas funções de serviço** do sistema (`createStudent`, `createPayment`...), então os dados respeitam todas as regras.
- É **idempotente**: se `admin@academia.dev` já existe, só completa as contas que faltam.
- É **bloqueado em produção** (`NODE_ENV=production`) sem `ALLOW_SEED=1`.
- Não apaga nada. Para recomeçar do zero, recrie o banco (ver [MANUTENCAO.md](MANUTENCAO.md)).

## 9. Backup e restauração

`scripts/backup.sh` usa `pg_dump --format=custom` e apaga backups com mais de `KEEP_DAYS` dias. No Docker Compose, o serviço `backup` roda o script uma vez por dia.

**Testado na auditoria:** um backup do banco de desenvolvimento foi restaurado num banco novo com `pg_restore`, e as contagens de alunos, pagamentos, usuários e migrations ficaram idênticas.

```bash
DATABASE_URL=postgres://fight:fight@localhost:5432/fight_manager BACKUP_DIR=./backups sh scripts/backup.sh
createdb -U fight kombexa_restaurado
pg_restore --no-owner --dbname=postgres://fight:fight@localhost:5432/kombexa_restaurado ./backups/kombexa-AAAA-MM-DD_HHMM.dump
```

Procedimento completo em [MANUTENCAO.md](MANUTENCAO.md).

> As logos ficam dentro do banco (`academy_logos.data`), então entram no backup automaticamente. Os backups contêm **dados pessoais e de saúde**: guarde-os com o mesmo cuidado do banco.
