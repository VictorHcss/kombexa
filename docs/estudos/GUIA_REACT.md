# Guia de React (com o código do Kombexa)

O Kombexa usa **React 19**. Uma particularidade importante: como roda dentro do Next.js com Server Components, **a maior parte dos componentes não tem estado nenhum**. Eles só recebem dados e desenham. O estado (`useState`) aparece apenas onde há interação de verdade: formulários, buscas, janelas de confirmação.

## 1. Componentes e props

Um componente é uma função que recebe **props** (propriedades) e devolve JSX.

```tsx
// components/ui.tsx
export function PageHeader({ title, description, actions }:
  { title: string; description?: string; actions?: ReactNode }) {
  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}       {/* (1) */}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}
```

Uso real, no Início:

```tsx
<PageHeader title="Início" description={`Resumo de ${formatReference(reference)}.`}
  actions={<Link href="/mensalidades/gerar" className="btn">Gerar mensalidades do mês</Link>} />
```

1. **Renderização condicional:** `{description && <p>...</p>}` só desenha o parágrafo se houver descrição.
2. Props podem ser texto (`title`) ou **outros elementos** (`actions` recebe um `<Link>`). Isso deixa o componente flexível.
3. `className` (não `class`): no JSX, o atributo de CSS se chama assim.

**`children`**: o conteúdo entre as tags de abertura e fechamento.

```tsx
// components/ui.tsx
export function Card({ title, actions, children, className = "", id }: {...; children: ReactNode }) {
  return (
    <section className={`card ${className}`} id={id}>
      {(title || actions) && <div className="card-head">{title && <h2>{title}</h2>}{actions}</div>}
      {children}
    </section>
  );
}
// uso: <Card title="Pendências"> ...qualquer coisa aqui vira children... </Card>
```

## 2. Estado (`useState`)

Estado é "uma variável que, quando muda, faz o componente se desenhar de novo".

```tsx
// app/(app)/alunos/StudentForm.tsx
const [birth, setBirth] = useState(v.birthDate ?? "");     // (1)
const minor = (age(birth) ?? 99) < 18;                      // (2)
// ...
<input id="birthDate" name="birthDate" type="date" defaultValue={v.birthDate} required
       onChange={(ev) => setBirth(ev.target.value)} />       // (3)
```

1. `birth` é o valor atual; `setBirth` é a única forma de mudá-lo.
2. `minor` é **calculado** a partir do estado, sem ser estado separado. Boa prática: não guarde o que dá para calcular.
3. Ao digitar a data, `setBirth` atualiza o estado, o componente redesenha, `minor` é recalculado e, se a pessoa tiver menos de 18 anos, **aparece a seção de responsável**. Tudo isso sem ir ao servidor.

Estado tipado, com união de textos:

```tsx
const [mode, setMode] = useState<"novo" | "existente">(values.guardianId ? "existente" : "novo");
```

## 3. Hooks usados no projeto

| Hook | Para quê | Exemplo |
| --- | --- | --- |
| `useState` | Valor que muda e redesenha | `StudentForm.tsx` (idade), `StudentSearch` (busca) |
| `useEffect` | Fazer algo **depois** de desenhar (temporizador, foco) | Busca com atraso em `components/client.tsx`; foco no campo em `CheckInForm.tsx` |
| `useRef` | Guardar uma referência a um elemento do DOM | O `<dialog>` em `ConfirmSubmit` |
| `useActionState` | Ligar um formulário a uma Server Action e receber o retorno | Todos os `*Form.tsx` |
| `useFormStatus` | Saber se o formulário está sendo enviado | Botão `Submit` |
| `useId` | Gerar um id único para acessibilidade | `StudentSearch` |
| `useRouter`, `useSearchParams` | Navegar e ler a URL (do Next) | `StudentSearch`, `Flash` |

### `useEffect` com limpeza: a busca de alunos

```tsx
// components/client.tsx (StudentSearch)
useEffect(() => {
  if (term.length < 2) return;
  let current = true;                                   // (1)
  const t = setTimeout(() => {                          // (2)
    setLoading(true);
    search(term).then((r) => { if (current) { setResults(r); setActive(0); setOpen(true); } })
                .finally(() => current && setLoading(false));
  }, 200);
  return () => { current = false; clearTimeout(t); };   // (3)
}, [term, search]);                                     // (4)
```

1. Marca se esta busca ainda é a mais recente.
2. **Debounce**: espera 200 ms depois da última tecla, para não consultar o servidor a cada letra.
3. A função devolvida é a **limpeza**: roda antes da próxima execução. Se a pessoa digitar de novo, a busca antiga é cancelada e a resposta atrasada é ignorada (`current = false`). Isso evita um bug clássico: o resultado de "Fer" chegando depois do de "Fernanda".
4. **Dependências:** o efeito roda de novo quando `term` ou `search` mudam.

## 4. Context

**O Kombexa não usa `createContext`/`useContext`** (zero ocorrências). Os dados descem por props, e o "contexto" de quem está logado é resolvido **no servidor** (`requireAcademyAdmin`). É um bom exemplo de que, com Server Components, muitas vezes você nem precisa de Context.

Onde Context faria sentido num projeto React tradicional, aqui a solução é: o layout do servidor busca o usuário e passa para o `Shell` por props.

## 5. Formulários: o jeito React 19

O projeto usa **formulários nativos** ligados a Server Actions. Nada de `onSubmit` com `preventDefault` e `fetch`:

```tsx
// app/(app)/alunos/StudentForm.tsx
const [state, formAction] = useActionState(action, {});   // state = o que a action devolveu
const v: StudentValues = { ...initial, ...state.values };  // valores: os digitados vencem os iniciais
const e = state.errors ?? {};                              // erros por campo

return (
  <form action={formAction} className="card form" noValidate>
    {state.message && <Alert tone="danger">{state.message}</Alert>}
    {/* cada campo usa defaultValue={v.campo} e mostra e.campo se houver erro */}
  </form>
);
```

Por que `defaultValue` (e não `value`)? Campos **não controlados** guardam o próprio valor no navegador. É mais simples e funciona mesmo antes do JavaScript carregar. O `state.values` devolvido pela action garante que, se der erro, **ninguém perde o que digitou** (há teste E2E para isso).

## 6. Eventos

```tsx
onChange={(ev) => setBirth(ev.target.value)}                  // digitou/escolheu
onClick={() => dialog.current?.showModal()}                    // clicou
onClick={(e) => e.target === dialog.current && dialog.current?.close()}  // clicou fora da janela
```

`ev.target.value` é o valor atual do campo. Os eventos recebem um objeto com informações do que aconteceu.

## 7. Comunicação entre componentes

| Direção | Como | Exemplo |
| --- | --- | --- |
| Pai → filho | Props | `<Submit pending="Conferindo…">Registrar</Submit>` |
| Filho → pai | O pai passa uma **função** como prop; o filho a chama | Em `mensalidades/FeeForm.tsx`, `<StudentSearch onPick={pick} />`: quando o usuário escolhe um aluno, o filho chama `pick` e o formulário preenche o valor |
| Servidor → cliente | Props serializáveis (texto, número, objetos simples) e **Server Actions** | Em `pagamentos/PaymentForm.tsx`, `<StudentSearch search={searchStudentsAction} />`: uma função do servidor passada como prop e chamada a cada busca |
| Entre telas | URL (`?ok=...`, `?aluno=...`) | Depois de salvar, o `redirect` leva `?ok=` e o componente `Flash` mostra o aviso |

## 8. Um componente completo, comentado: `ConfirmSubmit`

```tsx
// components/client.tsx
export function ConfirmSubmit({ children, message, title = "Confirmar ação", confirmLabel = "Confirmar", ... }) {
  const { pending } = useFormStatus();                 // o formulário está enviando?
  const dialog = useRef<HTMLDialogElement>(null);      // referência ao <dialog>
  const trigger = useRef<HTMLButtonElement>(null);     // referência ao botão
  const confirmAction = () => {
    dialog.current?.close();
    trigger.current?.closest("form")?.requestSubmit(); // envia o formulário em que o botão está
  };
  return (
    <>
      <button ref={trigger} type="button" disabled={pending} onClick={() => dialog.current?.showModal()}>
        {pending ? "Aguarde…" : children}
      </button>
      <dialog ref={dialog} className="modal">
        <h2>{title}</h2>
        <div className="modal-text">{message}</div>
        <button type="button" onClick={() => dialog.current?.close()} autoFocus>Voltar</button>
        <button type="button" onClick={confirmAction}>{confirmLabel}</button>
      </dialog>
    </>
  );
}
```

Lições: (1) `<dialog>` é um elemento nativo do HTML, acessível e que fecha com Esc, sem biblioteca; (2) `useRef` dá acesso direto ao elemento; (3) `<>...</>` (Fragment) agrupa elementos sem criar uma `div` extra; (4) `autoFocus` em "Voltar" faz a opção segura ser a padrão, cuidado de UX para ações destrutivas.

## Para fixar

1. Em `StudentForm.tsx`, encontre onde `minor` é usado no JSX. O que aparece e desaparece?
2. Por que `ConfirmSubmit` usa `type="button"` e não `type="submit"` no primeiro botão?
3. Exercícios 4, 8 e 13 de [EXERCICIOS_PRATICOS.md](EXERCICIOS_PRATICOS.md).
