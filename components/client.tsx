"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { centsToInput, formatMoney, parseMoney } from "@/lib/money";
import { useFormStatus } from "react-dom";

/** Botão de envio que mostra o carregamento e evita clique duplo. */
export function Submit({ children, className = "btn btn--primary", pending: pendingText = "Salvando…" }: { children: ReactNode; className?: string; pending?: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" className={className} disabled={pending} aria-busy={pending}>{pending ? pendingText : children}</button>;
}

/**
 * Envia o formulário só depois de confirmar, numa janela do próprio sistema
 * (<dialog> nativo: acessível, fecha com Esc, sem biblioteca extra).
 */
export function ConfirmSubmit({ children, message, title = "Confirmar ação", confirmLabel = "Confirmar", tone = "danger", className = "btn btn--ghost-danger" }: {
  children: ReactNode; message: ReactNode; title?: string; confirmLabel?: string; tone?: "danger" | "primary"; className?: string;
}) {
  const { pending } = useFormStatus();
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const confirmAction = () => {
    dialog.current?.close();
    trigger.current?.closest("form")?.requestSubmit();
  };
  return (
    <>
      <button ref={trigger} type="button" className={className} disabled={pending} onClick={() => dialog.current?.showModal()}>
        {pending ? "Aguarde…" : children}
      </button>
      <dialog ref={dialog} className="modal" aria-labelledby={undefined} onClick={(e) => e.target === dialog.current && dialog.current?.close()}>
        <div className="modal-body">
          <h2>{title}</h2>
          <div className="modal-text">{message}</div>
          <div className="modal-actions">
            <button type="button" className="btn btn--ghost" onClick={() => dialog.current?.close()} autoFocus>Voltar</button>
            <button type="button" className={`btn ${tone === "danger" ? "btn--danger" : "btn--primary"}`} onClick={confirmAction}>{confirmLabel}</button>
          </div>
        </div>
      </dialog>
    </>
  );
}

/** Cancelamento de pagamento: pede o motivo, que fica no histórico e na auditoria. */
export function CancelPaymentButton({ action, paymentId, back, description }: { action: (form: FormData) => void; paymentId: string; back: string; description: string }) {
  const [open, setOpen] = useState(false);
  if (!open) return <button type="button" className="btn btn--small btn--ghost-danger" onClick={() => setOpen(true)}>Cancelar</button>;
  return (
    <form action={action} className="inline-form">
      <input type="hidden" name="id" value={paymentId} />
      <input type="hidden" name="back" value={back} />
      <input name="reason" required minLength={3} maxLength={200} placeholder="Motivo do cancelamento" aria-label="Motivo do cancelamento" autoFocus />
      <ConfirmSubmit className="btn btn--small btn--danger" title="Cancelar pagamento" confirmLabel="Cancelar pagamento"
        message={<><p>Cancelar {description}?</p><p className="muted">O valor sai do financeiro e a mensalidade volta a ficar em aberto. O pagamento continua no histórico como cancelado.</p></>}>
        Confirmar
      </ConfirmSubmit>
      <button type="button" className="btn btn--small btn--ghost" onClick={() => setOpen(false)}>Voltar</button>
    </form>
  );
}

const FLASH: Record<string, string> = {
  "aluno-criado": "Aluno cadastrado com sucesso.",
  "aluno-salvo": "Cadastro atualizado.",
  "aluno-status": "Status do aluno atualizado.",
  "mensalidade-criada": "Mensalidade criada.",
  "mensalidade-salva": "Mensalidade atualizada.",
  "mensalidade-cancelada": "Mensalidade cancelada.",
  "pagamento-registrado": "Pagamento registrado com sucesso.",
  "pagamento-confirmado": "Pagamento confirmado.",
  "pagamento-cancelado": "Pagamento cancelado. A mensalidade voltou a ficar em aberto.",
  "lancamento-criado": "Lançamento registrado.",
  "lancamento-cancelado": "Lançamento cancelado.",
  "usuario-criado": "Pessoa adicionada à equipe.",
  "acesso-alterado": "Acesso atualizado. Vale a partir da próxima página que a pessoa abrir.",
  "responsavel-com-acesso": "Acesso liberado. O responsável recebeu o link por e-mail.",
  "responsavel-sem-acesso": "Acesso do responsável removido.",
  "email-reenviado": "Enviamos um novo link de confirmação para o seu e-mail.",
  "usuario-salvo": "Acesso atualizado.",
  "senha-alterada": "Senha alterada. Outros aparelhos conectados foram desconectados.",
  "academia-salva": "Dados da academia salvos.",
  "termos-salvos": "Termos da ficha salvos.",
  "modalidade-salva": "Modalidade salva.",
  "responsavel-salvo": "Responsável salvo.",
  "responsavel-removido": "Responsável removido.",
  "saude-salva": "Observações de saúde salvas.",
  "ficha-assinada": "Ficha marcada como assinada.",
  "dados-eliminados": "Dados pessoais eliminados. O financeiro foi mantido sem identificar a pessoa.",
  "convite-novo": "Novo código gerado. O QR Code anterior não funciona mais.",
  "entrada-aprovada": "Entrada aprovada. O aluno já pode acessar a área dele.",
  "entrada-vinculada": "Conta vinculada ao cadastro existente.",
  "entrada-recusada": "Pedido recusado. O aluno verá o aviso na área dele.",
  "pedido-enviado": "Conta criada e pedido enviado para a academia.",
  "conta-criada": "Conta criada. Passe o seu e-mail para a recepção da academia.",
  "aluno-adicionado": "Conta adicionada. Complete os dados para aprovar a entrada.",
  "academia-criada": "Academia criada.",
  "acesso-enviado": "Novo link de acesso gerado.",
  "academia-suspensa": "Academia suspensa. Os acessos dela foram encerrados.",
  "academia-reativada": "Academia reativada.",
  "contato-salvo": "Telefone atualizado nas suas academias.",
  "logo-salva": "Logo da academia salva. Ela já aparece nos documentos.",
  "logo-removida": "Logo removida. Os documentos voltam a usar o nome da academia.",
  "comunicado-publicado": "Comunicado publicado para os alunos.",
  "comunicado-salvo": "Comunicado atualizado.",
  "comunicado-arquivado": "Comunicado arquivado. Ele saiu do mural dos alunos.",
  "comunicado-reativado": "Comunicado de volta ao mural.",
  "graduacao-registrada": "Graduação registrada.",
  "graduacao-removida": "Registro de graduação removido.",
  "codigo-gerado": "Novo QR Code gerado. O anterior deixou de valer.",
  "presenca-registrada": "Presença registrada.",
  "tema-salvo": "Tema atualizado.",
};

/** Mensagem de sucesso após uma ação (vem no parâmetro ?ok= da URL e some sozinha). */
export function Flash() {
  const params = useSearchParams();
  const router = useRouter();
  const code = params.get("ok");
  const generated = params.get("geradas");
  const [visible, setVisible] = useState<string | null>(null);
  const [lastCode, setLastCode] = useState<string | null>(null);
  if (code !== lastCode) {
    setLastCode(code);
    if (code) setVisible((code === "mensalidades-geradas" ? `${generated ?? 0} mensalidade(s) gerada(s).` : FLASH[code]) ?? null);
  }

  // tira o ?ok= da URL (para não repetir a mensagem ao recarregar) e fecha a mensagem depois de 5 segundos
  useEffect(() => {
    if (!code) return;
    const clean = new URLSearchParams(params.toString());
    clean.delete("ok");
    clean.delete("geradas");
    router.replace(`${window.location.pathname}${clean.size ? `?${clean}` : ""}`, { scroll: false });
  }, [code, params, router]);
  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => setVisible(null), 5000);
    return () => clearTimeout(t);
  }, [visible]);

  if (!visible) return null;
  return <div className="toast" role="status">{visible}<button type="button" onClick={() => setVisible(null)} aria-label="Fechar">×</button></div>;
}

export interface StudentOption {
  id: string;
  name: string;
  modality: string | null;
  phone: string | null;
  email: string | null;
  status: string;
  overdue: number;
  monthlyFeeCents: number | null;
}

/**
 * Busca de aluno por nome, telefone ou e-mail, com resultados que diferenciam
 * homônimos (modalidade, telefone, situação). A busca acontece no servidor.
 * Com `param`, a escolha vai para a URL (a página recarrega as mensalidades do aluno).
 */
export function StudentSearch({ search, initial, name = "studentId", param, onPick, error }: {
  search: (q: string) => Promise<StudentOption[]>;
  initial?: StudentOption | null;
  name?: string;
  param?: string;
  onPick?: (s: StudentOption) => void;
  error?: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const listId = useId();
  const [chosen, setChosen] = useState<StudentOption | null>(initial ?? null);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<StudentOption[]>([]);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const term = q.trim();
  const searching = term.length >= 2;
  useEffect(() => {
    if (term.length < 2) return;
    let current = true;
    const t = setTimeout(() => {
      setLoading(true);
      search(term).then((r) => { if (current) { setResults(r); setActive(0); setOpen(true); } }).finally(() => current && setLoading(false));
    }, 200);
    return () => { current = false; clearTimeout(t); };
  }, [term, search]);
  const shown = searching ? results : [];

  const pick = (s: StudentOption) => {
    setChosen(s);
    setOpen(false);
    setQ("");
    onPick?.(s);
    if (param) {
      const next = new URLSearchParams(params.toString());
      next.set(param, s.id);
      next.delete("mensalidade");
      router.replace(`?${next}`, { scroll: false });
    }
  };
  const clear = () => {
    setChosen(null);
    if (param) {
      const next = new URLSearchParams(params.toString());
      next.delete(param);
      next.delete("mensalidade");
      router.replace(`?${next}`, { scroll: false });
    }
  };

  if (chosen) {
    return (
      <div className="picked">
        <input type="hidden" name={name} value={chosen.id} />
        <StudentLine s={chosen} />
        <button type="button" className="btn btn--small btn--ghost" onClick={clear}>Trocar</button>
      </div>
    );
  }
  return (
    <div className="combo">
      <input type="hidden" name={name} value="" />
      <input
        id={name} type="search" role="combobox" aria-expanded={open} aria-controls={listId} aria-autocomplete="list" autoComplete="off"
        aria-activedescendant={open && results[active] ? `${listId}-${active}` : undefined} aria-invalid={!!error}
        placeholder="Digite nome, telefone ou e-mail" value={q} onChange={(e) => setQ(e.target.value)}
        onFocus={() => shown.length && setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, shown.length - 1)); }
          if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
          if (e.key === "Enter" && open && shown[active]) { e.preventDefault(); pick(shown[active]); }
          if (e.key === "Escape") setOpen(false);
        }}
      />
      {open && searching && (
        <ul id={listId} role="listbox" className="combo-list">
          {shown.length === 0 && !loading && <li className="combo-empty">Nenhum aluno encontrado</li>}
          {shown.map((s, i) => (
            <li key={s.id} id={`${listId}-${i}`} role="option" aria-selected={i === active} onMouseDown={(e) => { e.preventDefault(); pick(s); }} onMouseEnter={() => setActive(i)}>
              <StudentLine s={s} />
            </li>
          ))}
        </ul>
      )}
      {q.trim().length > 0 && q.trim().length < 2 && <small className="field-hint">Digite pelo menos 2 letras.</small>}
    </div>
  );
}

function StudentLine({ s }: { s: StudentOption }) {
  const details = [s.modality, s.phone ?? s.email].filter(Boolean).join(", ");
  return (
    <span className="student-line">
      <strong>{s.name}</strong>
      <span className="muted small">{details || "sem contato"}{s.status === "inactive" ? ", inativo" : ""}</span>
      {s.overdue > 0 && <span className="badge badge--danger">{s.overdue} atrasada{s.overdue > 1 ? "s" : ""}</span>}
    </span>
  );
}

/** Formata "1234,5" como "1.234,50" (apenas exibição; o servidor valida e converte para centavos). */
function prettyMoney(value: string): string {
  const cents = parseMoney(value);
  if (cents === null) return value;
  return formatMoney(cents).replace("R$ ", "");
}

/** Campo de valor em reais: "R$" fixo, teclado numérico e formatação ao sair do campo. */
export function MoneyInput({ id, name, defaultValue, required, placeholder = "0,00", invalid }: {
  id: string; name: string; defaultValue?: string; required?: boolean; placeholder?: string; invalid?: boolean;
}) {
  return (
    <div className={`money${invalid ? " is-invalid" : ""}`}>
      <span aria-hidden="true">R$</span>
      <input
        id={id} name={name} inputMode="decimal" autoComplete="off" placeholder={placeholder} required={required}
        defaultValue={defaultValue ? prettyMoney(defaultValue) : defaultValue} aria-invalid={invalid}
        onChange={(e) => { e.target.value = e.target.value.replace(/[^\d.,]/g, ""); }}
        onBlur={(e) => { e.target.value = e.target.value ? prettyMoney(e.target.value) : ""; }}
      />
    </div>
  );
}

export { centsToInput };

/** Filtros das listas: no celular, só a busca fica visível; o resto abre num botão. */
export function FilterToggle({ active }: { active: number }) {
  return (
    <button type="button" className="btn filters-toggle" aria-expanded="false"
      onClick={(e) => {
        const form = (e.currentTarget as HTMLButtonElement).closest("form");
        const open = form?.getAttribute("data-open") === "true";
        form?.setAttribute("data-open", String(!open));
        e.currentTarget.setAttribute("aria-expanded", String(!open));
      }}>
      Filtros{active > 0 && <span className="count">{active}</span>}
    </button>
  );
}

/** Campo de senha com botão para mostrar ou esconder o que foi digitado. */
export function PasswordInput({ id, name, autoComplete, autoFocus, required = true, describedBy }: {
  id: string; name: string; autoComplete: "current-password" | "new-password"; autoFocus?: boolean; required?: boolean; describedBy?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="password">
      <input id={id} name={name} type={visible ? "text" : "password"} autoComplete={autoComplete} autoFocus={autoFocus} required={required}
        aria-describedby={describedBy} spellCheck={false} autoCapitalize="none" />
      <button type="button" className="password-toggle" onClick={() => setVisible((v) => !v)} aria-pressed={visible} aria-controls={id}>
        {visible ? "Ocultar" : "Mostrar"}
      </button>
    </div>
  );
}
