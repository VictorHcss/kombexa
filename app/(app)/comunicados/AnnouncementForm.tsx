"use client";

import { useActionState } from "react";
import { Submit } from "@/components/client";
import { Alert, Field } from "@/components/ui";
import { saveAnnouncementAction } from "./actions";

const CATEGORIES = [["geral", "Geral"], ["horario", "Horários"], ["feriado", "Feriado"], ["evento", "Evento"], ["graduacao", "Graduação"]] as const;

export function AnnouncementForm({ id, initial }: { id: string | null; initial?: { title: string; body: string; category: string; pinned: boolean } }) {
  const [state, action] = useActionState(saveAnnouncementAction.bind(null, id), {});
  const e = state.errors ?? {};
  const v = { title: initial?.title ?? "", body: initial?.body ?? "", category: initial?.category ?? "geral", pinned: initial?.pinned ? "on" : "", ...state.values };
  const p = id ?? "novo";
  return (
    <form action={action} className="form" noValidate>
      {state.message && <Alert tone="danger">{state.message}</Alert>}
      <div className="form-grid">
        <div className="span-2"><Field label="Título" name={`${p}-title`} error={e.title}><input id={`${p}-title`} name="title" defaultValue={v.title} maxLength={120} required /></Field></div>
        <Field label="Categoria" name={`${p}-category`} error={e.category}>
          <select id={`${p}-category`} name="category" defaultValue={v.category}>{CATEGORIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        </Field>
        <label className="toggle toggle--inline"><input type="checkbox" name="pinned" defaultChecked={v.pinned === "on"} /><span>Fixar no topo do mural</span></label>
        <div className="span-2"><Field label="Texto" name={`${p}-body`} error={e.body} hint="Os alunos veem este texto na Área do Aluno. Nada é enviado por e-mail ou WhatsApp.">
          <textarea id={`${p}-body`} name="body" rows={5} defaultValue={v.body} maxLength={4000} required />
        </Field></div>
      </div>
      <div className="form-actions"><Submit pending={id ? "Salvando…" : "Publicando…"}>{id ? "Salvar alterações" : "Publicar comunicado"}</Submit></div>
    </form>
  );
}
