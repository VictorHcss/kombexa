# Guia de TypeScript (com o código do Kombexa)

O projeto usa TypeScript 6 em **modo estrito** (`"strict": true` no `tsconfig.json`). Isso significa que o compilador reclama de qualquer coisa que possa ser `null` sem tratamento, de parâmetros sem tipo etc. Rodar `npm run typecheck` é como ter um revisor que lê todo o código em segundos. Na auditoria, ele deu **0 erros**.

## 1. Tipos básicos e anotações

```ts
// lib/money.ts
export function parseMoney(input: string | number | null | undefined): number | null {
  //                       ^^^^^^ o parâmetro aceita 4 tipos     ^^^^^^^^^^^^^^ o retorno pode ser null
  if (input === null || input === undefined) return null;
  let text = String(input).trim()...
```

- `string | number | null | undefined` é uma **união**: "qualquer um destes".
- `: number | null` depois dos parênteses é o **tipo do retorno**. Quem chama `parseMoney` é **obrigado** a tratar o `null` antes de fazer conta, e o compilador não deixa esquecer.

```ts
const cents = parseMoney("150,90");
cents + 10;          // ❌ erro: 'cents' is possibly 'null'
if (cents !== null) cents + 10;  // ✅ aqui dentro o TS sabe que é number ("narrowing")
```

## 2. Uniões de textos literais (no lugar de `enum`)

O projeto **não usa** a palavra-chave `enum` do TypeScript (zero ocorrências). Usa uniões de textos, que são mais simples:

```ts
// lib/auth/session.ts
role: "PLATFORM_ADMIN" | "ACADEMY_ADMIN" | "STUDENT";
```

```ts
// lib/fee-status.ts
export type DisplayFeeStatus = "pending" | "overdue" | "paid" | "canceled";
```

Se você digitar `"pago"` onde se espera um `DisplayFeeStatus`, o compilador acusa na hora. Os "enums" do **banco** existem (`pgEnum` em `db/schema.ts`), e o Drizzle os transforma em uniões como essas.

## 3. `Record`: um objeto com todas as chaves obrigatórias

```ts
// lib/fee-status.ts
export const FEE_STATUS_LABEL: Record<DisplayFeeStatus, string> = {
  pending: "A vencer",
  overdue: "Atrasada",
  paid: "Paga",
  canceled: "Cancelada",
};
```

`Record<Chaves, Valor>` exige **uma entrada para cada status**. Se amanhã alguém criar o status `"refunded"`, este arquivo deixa de compilar até ganhar um rótulo. É o compilador lembrando você.

## 4. `as const` + `keyof typeof`: o tipo nasce dos dados

Um dos truques mais elegantes do projeto:

```ts
// lib/permissions.ts
export const PERMISSIONS = {
  alunos: { label: "Alunos", hint: "Ver, cadastrar e editar alunos..." },
  saude:  { label: "Dados de saúde", hint: "..." },
  // ... mais 8
} as const;                                            // (1)

export type Permission = keyof typeof PERMISSIONS;     // (2)
```

1. `as const` diz: "estes valores são fixos, não mude o tipo para `string` genérico".
2. `typeof PERMISSIONS` pega o tipo do objeto; `keyof` pega as chaves. O resultado é `"alunos" | "saude" | "mensalidades" | ...`.

**Ganho:** a lista de permissões existe em **um só lugar**. Adicionou uma permissão no objeto? O tipo `Permission` já a inclui, e todo `Record<Permission, ...>` (como `PERMISSION_HOME`, no mesmo arquivo) passa a exigir a nova chave.

## 5. Interfaces

```ts
// lib/auth/session.ts
export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: "PLATFORM_ADMIN" | "ACADEMY_ADMIN" | "STUDENT";
  academyId: string | null;          // null para plataforma e aluno
  permissions: Permission[] | null;  // null = acesso total
  emailVerified: boolean;
}
```

Uma `interface` descreve o "formato" de um objeto. Repare como o `null` tem **significado de negócio** documentado (`null = acesso total`).

`type` × `interface`: para objetos, quase tanto faz. O projeto usa `interface` para formatos de objeto (`SessionUser`, `AcademyContext`) e `type` para uniões e tipos derivados (`Permission`, `LoginResult`).

## 6. Uniões discriminadas: sucesso OU erro

```ts
// lib/auth/login.ts
export type LoginResult =
  | { ok: true; userId: string; role: string }
  | { ok: false; message: string };
```

O campo `ok` "discrimina" qual dos dois formatos você tem:

```ts
const result = await checkCredentials(email, password);
if (!result.ok) return { message: result.message };  // aqui o TS sabe: só existe message
await createSession(result.userId);                   // aqui o TS sabe: existe userId
```

Tentar ler `result.userId` antes do `if` é erro de compilação. É impossível esquecer de tratar a falha.

## 7. Type guards: funções que ensinam o compilador

```ts
// lib/permissions.ts
export const isPermission = (v: string): v is Permission => v in PERMISSIONS;
```

O retorno `v is Permission` significa: "se eu devolver `true`, trate `v` como `Permission` daqui em diante". É usado em `lib/auth/session.ts` para limpar o que vem do banco:

```ts
permissions: permissions ? permissions.filter(isPermission) : null
//                         string[] do banco ──► Permission[] garantido
```

## 8. Generics: funções que servem para vários tipos

```ts
// lib/action.ts
export async function handleForm<S extends z.ZodType>(       // (1)
  form: FormData,
  schema: S,                                                 // (2)
  run: (data: z.output<S>) => Promise<void>,                 // (3)
): Promise<ActionState> {
```

1. `<S extends z.ZodType>`: "S é algum esquema do Zod, eu ainda não sei qual".
2. Quem chama passa um esquema concreto, por exemplo `paymentInput`.
3. `z.output<S>` é **o tipo dos dados depois de validados por aquele esquema**. Assim, dentro de `run`, `data.amount` já é `number` (centavos), e não o texto `"150,90"` do formulário.

Uma função, escrita uma vez, que dá tipos corretos para **todos** os formulários do sistema.

## 9. Tipos inferidos do banco

```ts
// db/schema.ts
export type Student = typeof students.$inferSelect;
export type Payment = typeof payments.$inferSelect;
```

Você não escreve o tipo `Student` à mão: o Drizzle o deduz da definição da tabela. Mudou uma coluna no `schema.ts`? O tipo muda junto, e o compilador aponta todo lugar que precisa ser ajustado.

## 10. Tipando funções, componentes e serviços

**Função de serviço:** o primeiro parâmetro é sempre o contexto.

```ts
// services/payments.ts
type PaymentData = z.output<typeof paymentInput>;   // tipo derivado da validação

export async function createPayment(ctx: AcademyContext, data: PaymentData) { ... }
```

**Componente React:** as props são tipadas direto na assinatura.

```tsx
// components/ui.tsx
export function Card({ title, actions, children, className = "", id }:
  { title?: string; actions?: ReactNode; children: ReactNode; className?: string; id?: string }) {
```

`title?` (com `?`) é opcional; `className = ""` dá um valor padrão; `ReactNode` é "qualquer coisa que o React sabe desenhar".

**Tipos utilitários em ação (nos testes):**

```ts
// tests/helpers.ts
export function studentData(ctx: AcademyContext,
  overrides: Partial<Parameters<typeof createStudent>[1]> = {}) { ... }
```

Leia de dentro para fora: `typeof createStudent` (o tipo da função) → `Parameters<...>` (a lista de parâmetros) → `[1]` (o segundo, os dados) → `Partial<...>` (todos os campos opcionais). Resultado: "me passe só os campos que você quer mudar".

## 11. Validação de dados: Zod, a ponte entre o "texto do formulário" e os tipos

O TypeScript só existe **durante o desenvolvimento**. Quando o formulário chega, os dados são texto e podem ser qualquer coisa. O Zod valida **em tempo de execução** e gera o tipo para o TypeScript:

```ts
// lib/validation.ts
const money = (label: string, { allowZero = false } = {}) =>
  z.string().trim().min(1, `Informe ${label}.`).transform((v, ctx) => {
    const cents = parseMoney(v);
    if (cents === null) {
      ctx.addIssue({ code: "custom", message: "Valor inválido. Use o formato 150,00." });
      return z.NEVER;
    }
    if (!allowZero && cents <= 0) {
      ctx.addIssue({ code: "custom", message: "O valor precisa ser maior que zero." });
      return z.NEVER;
    }
    return cents;    // entra string, sai number
  });

export const studentInput = z.object({
  name: requiredText("o nome completo", 120).refine((v) => v.includes(" ") || v.length >= 3, "Informe o nome completo."),
  modalityId: z.uuid("Escolha a modalidade."),
  status: z.enum(["active", "inactive"], { message: "Status inválido." }),
  monthlyFee: money("o valor mensal"),
  dueDay: z.coerce.number({ message: "Dia inválido." }).int().min(1, "Use um dia entre 1 e 31.").max(31, "Use um dia entre 1 e 31."),
  // ...
});
```

Observe:

- **Mensagens em português** já na regra, que aparecem embaixo do campo.
- `.transform()` muda o tipo: entra `"150,90"` (string) e sai `15090` (number).
- `z.coerce.number()` converte o texto `"10"` em `10`.
- `z.output<typeof studentInput>` é o tipo final, usado pelo serviço.

## Para fixar

1. Em `lib/labels.ts`, `PAYMENT_METHODS` usa `as const`. Escreva (num arquivo de rascunho) o tipo `PaymentMethodKey = keyof typeof PAYMENT_METHODS` e passe o mouse em cima no VS Code. O que aparece?
2. Em `lib/auth/login.ts`, tente acessar `result.userId` antes do `if (!result.ok)`. Leia o erro do `npm run typecheck` e desfaça a mudança.
3. Exercícios 2, 3, 7 e 11 de [EXERCICIOS_PRATICOS.md](EXERCICIOS_PRATICOS.md).
