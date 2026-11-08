# Guia de PostgreSQL (com o banco do Kombexa)

**Todas as consultas deste guia foram executadas** no banco de desenvolvimento do Kombexa (após `npm run db:seed`) durante a auditoria. As que alteram dados estão dentro de `BEGIN ... ROLLBACK`, para você poder rodá-las sem estragar nada.

## Como abrir o banco

```bash
psql postgres://fight:fight@localhost:5432/fight_manager
```

No Windows, o mesmo comando funciona no PowerShell se o `psql` estiver no PATH. Alternativas gráficas: DBeaver ou pgAdmin. Comandos úteis dentro do `psql`:

| Comando | Faz |
| --- | --- |
| `\dt` | Lista as tabelas (devem aparecer 19) |
| `\d students` | Mostra colunas, índices e chaves de uma tabela |
| `\dT+` | Lista os tipos enumerados |
| `\q` | Sai |

## 1. Tabelas e modelagem

Uma tabela é uma planilha com colunas de tipo fixo. Compare a definição em TypeScript com o SQL gerado:

```ts
// db/schema.ts
export const fees = pgTable("fees", {
  id: uuid("id").primaryKey().defaultRandom(),
  academyId: uuid("academy_id").notNull().references(() => academies.id, { onDelete: "cascade" }),
  studentId: uuid("student_id").notNull().references(() => students.id, { onDelete: "restrict" }),
  amountCents: integer("amount_cents").notNull(),
  dueDate: date("due_date").notNull(),
  reference: varchar("reference", { length: 7 }).notNull(),   // "2026-09"
  status: feeStatus("status").notNull().default("pending"),
  ...
```

| Conceito | Neste exemplo |
| --- | --- |
| **Chave primária** (PK) | `id`, um UUID gerado pelo banco. Identifica a linha. |
| **Chave estrangeira** (FK) | `student_id` aponta para `students.id`. O banco não aceita mensalidade de aluno inexistente. |
| **NOT NULL** | `amount_cents` é obrigatório. |
| **DEFAULT** | `status` começa como `pending`. |
| **Enum** | `fee_status` só aceita `pending`, `paid` e `canceled`. |
| **ON DELETE RESTRICT** | Não deixa apagar um aluno que tem mensalidades (protege o histórico). |
| **ON DELETE CASCADE** | Apagar a academia apagaria as mensalidades dela. |

**Decisões de modelagem do Kombexa que valem copiar:**

- **Dinheiro em centavos** (`integer`): R$ 150,90 = `15090`. Nada de `float`.
- **Calcular em vez de guardar:** não existe coluna "atrasada" nem "saldo". Atraso = `pending` + vencimento passado; saldo = valor − soma dos pagamentos.
- **Conta separada do vínculo:** `users` é a pessoa que faz login; `students` é a pessoa **dentro de uma academia**.

## 2. SELECT: ler dados

```sql
SELECT name, phone, monthly_fee_cents / 100.0 AS mensalidade_reais
FROM students
WHERE status = 'active'
ORDER BY name
LIMIT 5;
```

Resultado real:

```text
       name       |      phone      | mensalidade_reais
------------------+-----------------+-------------------
 Ana Beatriz Lima | (33) 98701-5566 | 180.00...
 Beatriz Rocha    | (33) 98815-4433 | 150.00...
 ...
```

- `AS` dá um apelido à coluna calculada.
- `/ 100.0` (com ponto) força divisão decimal; `/ 100` faria divisão inteira.

## 3. JOIN: juntar tabelas

**Mensalidades atrasadas com o nome do aluno:**

```sql
SELECT s.name, f.reference, f.due_date, f.amount_cents
FROM fees f
JOIN students s ON s.id = f.student_id
WHERE f.status = 'pending' AND f.due_date < CURRENT_DATE
ORDER BY f.due_date;
```

`f` e `s` são apelidos das tabelas. `JOIN ... ON` diz como as linhas se ligam.

> **Se voltar vazio, não é erro.** Os dados de exemplo são criados relativos ao dia em que você rodou o seed. Na auditoria (3 de novembro), as mensalidades de novembro venciam entre os dias 5 e 15, então ainda não havia atrasadas. Troque `CURRENT_DATE` por `CURRENT_DATE + 30` para "viajar no tempo" e ver o resultado.

**LEFT JOIN + GROUP BY: saldo de cada mensalidade.** É exatamente a lógica que `services/fees.ts` usa:

```sql
SELECT s.name, f.reference, f.amount_cents,
       COALESCE(SUM(p.amount_cents) FILTER (WHERE p.status = 'paid'), 0) AS pago_cents,
       f.amount_cents - COALESCE(SUM(p.amount_cents) FILTER (WHERE p.status = 'paid'), 0) AS saldo_cents
FROM fees f
JOIN students s ON s.id = f.student_id
LEFT JOIN payments p ON p.fee_id = f.id
WHERE f.status <> 'canceled'
GROUP BY s.name, f.id
ORDER BY saldo_cents DESC;
```

| Parte | Por quê |
| --- | --- |
| `LEFT JOIN` | Mantém mensalidades **sem nenhum** pagamento (um `JOIN` comum as esconderia) |
| `SUM(...)` | Soma os pagamentos de cada grupo |
| `FILTER (WHERE ...)` | Soma só os confirmados (recurso do PostgreSQL) |
| `COALESCE(x, 0)` | Sem pagamentos, `SUM` dá `NULL`; isso troca por 0 |
| `GROUP BY` | Uma linha por mensalidade |

Para ver só as **parcialmente pagas**, acrescente antes do `ORDER BY`:

```sql
HAVING COALESCE(SUM(p.amount_cents) FILTER (WHERE p.status = 'paid'), 0) BETWEEN 1 AND f.amount_cents - 1
```

(`HAVING` filtra **depois** de agrupar; `WHERE` filtra antes.)

Pode vir vazio se não houver nenhum pagamento parcial em aberto. Para criar um, registre na tela de Pagamentos um valor menor que o da mensalidade e rode de novo: a linha aparece.

**Caixa do mês:**

```sql
SELECT type, SUM(amount_cents) AS total_cents, COUNT(*)
FROM financial_entries
WHERE status = 'active' AND date >= date_trunc('month', CURRENT_DATE)
GROUP BY type;
```

## 4. INSERT, UPDATE, DELETE (com segurança)

```sql
BEGIN;                                                    -- abre a transação

INSERT INTO announcements (academy_id, title, body, category)
SELECT id, 'Treino especial', 'Sábado às 9h', 'evento'
FROM academies WHERE name LIKE 'Academia Punho%'
RETURNING id, title;                                      -- mostra o que foi criado

UPDATE announcements SET pinned = true
WHERE title = 'Treino especial'
RETURNING title, pinned;

DELETE FROM announcements WHERE title = 'Treino especial'
RETURNING title;

ROLLBACK;                                                 -- desfaz TUDO acima
```

- `INSERT ... SELECT` insere usando dados de outra consulta (aqui, o `id` da academia).
- `RETURNING` devolve as linhas afetadas: muito útil, e o Drizzle usa (`.returning()`).
- **Nunca rode `UPDATE` ou `DELETE` sem `WHERE`**: afetaria a tabela inteira.

> **No sistema, não se apaga dinheiro.** Pagamentos e lançamentos são **cancelados** (`status = 'canceled'`), nunca deletados. Isso é regra de negócio e de contabilidade.

## 5. Restrições na prática: o banco dizendo "não"

Tente duplicar uma mensalidade:

```sql
BEGIN;
INSERT INTO fees (academy_id, student_id, amount_cents, due_date, reference)
SELECT academy_id, student_id, amount_cents, due_date, reference
FROM fees WHERE status <> 'canceled' LIMIT 1;
ROLLBACK;
```

Resultado real:

```text
ERROR:  duplicate key value violates unique constraint "fees_student_reference_unique"
DETAIL:  Key (student_id, reference)=(b3456109-..., 2026-10) already exists.
```

Esse índice é **parcial**: só vale para mensalidades não canceladas.

```sql
CREATE UNIQUE INDEX fees_student_reference_unique ON fees (student_id, reference) WHERE status <> 'canceled';
```

Por isso dá para cancelar uma mensalidade e criar outra no mesmo mês, mas não ter duas ativas. Mesmo que o código tenha um bug, ou que duas pessoas cliquem "gerar mensalidades" ao mesmo tempo, o banco segura.

## 6. Índices

Um índice é como o índice remissivo de um livro: evita ler a tabela inteira. Veja se o PostgreSQL usa um:

```sql
SET enable_seqscan = off;   -- só para a demonstração: tabelas pequenas preferem leitura sequencial
EXPLAIN SELECT * FROM fees
WHERE academy_id = '00000000-0000-0000-0000-000000000000' AND status = 'pending' AND due_date < CURRENT_DATE;
```

Resultado real:

```text
Index Scan using fees_academy_status_due_idx on fees
  Index Cond: ((academy_id = '...'::uuid) AND (status = 'pending'::fee_status) AND (due_date < CURRENT_DATE))
```

O índice `fees_academy_status_due_idx` tem as colunas na **mesma ordem** em que a lista de mensalidades filtra: academia → situação → vencimento. A ordem das colunas num índice composto importa.

> Com poucas linhas, o PostgreSQL prefere ler a tabela toda, e é por isso que desligamos `enable_seqscan` na demonstração. Em produção, com milhares de mensalidades, ele escolhe o índice sozinho.

## 7. Transações e travas

**Transação** = "tudo ou nada". O Kombexa usa em toda gravação que mexe em mais de uma tabela:

```ts
// services/payments.ts
return db.transaction(async (tx) => {
  // grava o pagamento, a entrada no caixa, recalcula a mensalidade e audita.
  // Se QUALQUER passo falhar, nada fica gravado.
});
```

**Trava de linha** (`SELECT ... FOR UPDATE`): impede que duas transações mexam na mesma mensalidade ao mesmo tempo. Experimente com dois terminais `psql`:

```sql
-- Terminal 1
BEGIN;
SELECT id, amount_cents FROM fees WHERE status = 'pending' LIMIT 1 FOR UPDATE;
-- (não feche ainda)

-- Terminal 2 (mesmo id)
BEGIN;
SELECT id FROM fees WHERE id = '<id do terminal 1>' FOR UPDATE;
-- fica ESPERANDO...

-- Terminal 1
ROLLBACK;
-- o Terminal 2 é liberado na hora. Depois rode ROLLBACK nele também.
```

É assim que dois pagamentos simultâneos não ultrapassam o saldo.

## 8. Migrações

Uma migration é um arquivo SQL que leva o banco de uma versão para a próxima. As do Kombexa estão em `drizzle/` e são aplicadas **em ordem** e **uma única vez**; o Drizzle anota quais já rodaram:

```sql
SELECT id, created_at FROM drizzle.__drizzle_migrations ORDER BY id;   -- 12 linhas
```

Fluxo para mudar o banco:

1. Edite `db/schema.ts`.
2. `npm run db:generate` cria `drizzle/0012_algum_nome.sql`.
3. **Leia o SQL.** Se você renomeou uma coluna, o gerador pode propor `DROP` + `ADD`, o que **perde os dados**. Nesse caso, edite o SQL para `ALTER TABLE ... RENAME COLUMN`.
4. `npm test` (o banco de teste é recriado a partir de todas as migrations).
5. `npm run db:migrate`.

Exemplo real de migration bem feita: `0003_cadastro_completo.sql` cria a tabela `modalities` e **copia** os textos antigos para ela; só depois a `0004_modalidade_ligada.sql` remove a coluna velha. Duas etapas, sem perda de dados.

## 9. Exercícios rápidos de SQL

Responda com consultas (as soluções você confere comparando com as telas do sistema):

1. Quantos alunos ativos há em cada modalidade? (dica: `JOIN modalities` + `GROUP BY`)
2. Quais alunos não têm nenhuma presença registrada? (dica: `LEFT JOIN attendances ... WHERE a.id IS NULL`)
3. Qual o total recebido por forma de pagamento (`method`) no mês?
4. Liste as 10 últimas ações da auditoria com o nome de quem fez (`audit_logs JOIN users`).

Mais desafios em [EXERCICIOS_PRATICOS.md](EXERCICIOS_PRATICOS.md).
