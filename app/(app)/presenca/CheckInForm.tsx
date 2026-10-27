"use client";

import { useActionState, useEffect, useRef } from "react";
import { Submit } from "@/components/client";
import { checkInAction } from "./actions";

/** Campo para leitor de QR (que funciona como teclado) ou para digitar o código do aluno. */
export function CheckInForm() {
  const [state, action] = useActionState(checkInAction, {});
  const input = useRef<HTMLInputElement>(null);
  // depois de cada leitura o campo fica vazio e com foco, pronto para o próximo aluno
  useEffect(() => { if (input.current) { input.current.value = ""; input.current.focus(); } }, [state]);
  return (
    <form action={action} className="checkin-form" aria-describedby="checkin-help">
      <label htmlFor="checkin-code">Código do QR do aluno</label>
      <div className="checkin-row">
        <input ref={input} id="checkin-code" name="code" autoComplete="off" autoCapitalize="characters" spellCheck={false} placeholder="ABCD-EFGH-1234" required />
        <Submit pending="Conferindo…" className="btn btn--primary">Registrar</Submit>
      </div>
      <p id="checkin-help" className="small muted">O aluno mostra o QR em <strong>Minha carteirinha</strong>. Use um leitor de QR conectado ao computador ou digite o código abaixo do QR. Vale só para hoje.</p>
      <div aria-live="polite">
        {state.ok && <p className="alert alert--ok">{state.ok}</p>}
        {state.message && <p className="alert alert--danger">{state.message}</p>}
      </div>
    </form>
  );
}
