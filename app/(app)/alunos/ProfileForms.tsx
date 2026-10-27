"use client";

import { useActionState, useState } from "react";
import { AddressFields } from "@/components/AddressFields";
import { Submit } from "@/components/client";
import { Alert, Field } from "@/components/ui";
import type { ActionState } from "@/lib/action";

type Guardian = { id: string; name: string; cpf: string | null; phone: string; email: string | null; relationship: string; isPrimary: boolean } & Record<string, string | boolean | null>;

/** Adicionar ou editar um responsável, direto no perfil. */
export function GuardianForm({ action, guardian, onlyOne }: { action: (s: ActionState, f: FormData) => Promise<ActionState>; guardian?: Guardian; onlyOne?: boolean }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(action, {});
  const v: Record<string, string> = { ...(guardian ? Object.fromEntries(Object.entries(guardian).map(([k, x]) => [k, x === null ? "" : String(x)])) : {}), ...state.values };
  const e = state.errors ?? {};
  if (!open && !state.message) return <button type="button" className={guardian ? "btn btn--small btn--ghost" : "btn btn--small"} onClick={() => setOpen(true)}>{guardian ? "Editar" : "Adicionar responsável"}</button>;
  return (
    <form action={formAction} className="form guardian-edit" noValidate>
      {state.message && <Alert tone="danger">{state.message}</Alert>}
      {guardian && <input type="hidden" name="guardianId" value={guardian.id} />}
      <div className="form-grid">
        <Field label="Nome" name="name" error={e.name}><input id="name" name="name" defaultValue={v.name} required /></Field>
        <Field label="Parentesco" name="relationship" error={e.relationship}><input id="relationship" name="relationship" defaultValue={v.relationship} placeholder="Ex.: mãe, pai, avó" required /></Field>
        <Field label="Telefone (WhatsApp)" name="phone" error={e.phone}><input id="phone" name="phone" defaultValue={v.phone} inputMode="tel" required /></Field>
        <Field label="CPF (opcional)" name="cpf" error={e.cpf}><input id="cpf" name="cpf" defaultValue={v.cpf} inputMode="numeric" /></Field>
        <div className="span-2"><Field label="E-mail (opcional)" name="email" error={e.email}><input id="email" name="email" type="email" defaultValue={v.email} /></Field></div>
      </div>
      <details className="form-more"><summary>Endereço (opcional)</summary><AddressFields values={v} errors={e} prefix="g-" /></details>
      {!onlyOne && <label className="check"><input type="checkbox" name="isPrimary" defaultChecked={v.isPrimary === "true"} /> Responsável principal (contato de cobrança e assinatura da ficha)</label>}
      <div className="form-actions"><Submit>Salvar responsável</Submit><button type="button" className="btn btn--ghost" onClick={() => setOpen(false)}>Cancelar</button></div>
    </form>
  );
}

/** Saúde: dado sensível, com consentimento obrigatório. */
export function HealthForm({ action, notes, consentAt }: { action: (s: ActionState, f: FormData) => Promise<ActionState>; notes: string; consentAt: string | null }) {
  const [state, formAction] = useActionState(action, {});
  const e = state.errors ?? {};
  return (
    <form action={formAction} className="form">
      {state.message && <Alert tone="danger">{state.message}</Alert>}
      <Field label="Restrições, condições ou cuidados" name="notes" hint="Ex.: asma, lesão no joelho esquerdo, alergia a látex. Deixe vazio para apagar.">
        <textarea id="notes" name="notes" defaultValue={state.values?.notes ?? notes} maxLength={2000} rows={4} />
      </Field>
      <div className={`field${e.consent ? " has-error" : ""}`}>
        <label className="check"><input type="checkbox" name="consent" defaultChecked={!!consentAt} /> O aluno (ou o responsável) autorizou guardar estas informações de saúde.</label>
        {e.consent && <small className="field-error">{e.consent}</small>}
        {consentAt && <small className="field-hint">Consentimento registrado em {consentAt}.</small>}
      </div>
      <div className="form-actions"><Submit>Salvar</Submit></div>
    </form>
  );
}

/** Eliminação dos dados pessoais (LGPD): irreversível, pede a palavra de confirmação. */
export function EraseForm({ action }: { action: (s: ActionState, f: FormData) => Promise<ActionState> }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(action, {});
  if (!open && !state.message) return <button type="button" className="btn btn--small btn--ghost-danger" onClick={() => setOpen(true)}>Eliminar dados pessoais</button>;
  return (
    <form action={formAction} className="form erase-form">
      {state.message && <Alert tone="danger">{state.message}</Alert>}
      <p className="small" style={{ margin: 0 }}>Nome, contatos, documentos, endereço, responsáveis, saúde e a conta de acesso serão apagados. Mensalidades e pagamentos continuam no financeiro, sem identificar a pessoa. <strong>Não dá para desfazer.</strong></p>
      <Field label='Digite ELIMINAR para confirmar' name="confirmation" error={state.errors?.confirmation}><input id="confirmation" name="confirmation" autoComplete="off" required /></Field>
      <div className="form-actions"><Submit className="btn btn--danger" pending="Eliminando…">Eliminar definitivamente</Submit><button type="button" className="btn btn--ghost" onClick={() => setOpen(false)}>Cancelar</button></div>
    </form>
  );
}

/** Registrar uma graduação (faixa, corda, grau) no histórico do aluno. */
export function RankForm({ action, modalities, defaultModality, today }: { action: (s: ActionState, f: FormData) => Promise<ActionState>; modalities: { id: string; name: string }[]; defaultModality: string | null; today: string }) {
  const [state, formAction] = useActionState(action, {});
  const v: Record<string, string> = { awardedAt: today, modalityId: defaultModality ?? "", ...state.values };
  const e = state.errors ?? {};
  return (
    <form action={formAction} className="form" noValidate>
      {state.message && <Alert tone="danger">{state.message}</Alert>}
      <div className="form-grid">
        <Field label="Graduação" name="rank" error={e.rank} hint="Como a academia chama: faixa azul, 2º grau, corda verde..."><input id="rank" name="rank" defaultValue={v.rank} maxLength={60} required /></Field>
        <Field label="Data" name="awardedAt" error={e.awardedAt}><input id="awardedAt" name="awardedAt" type="date" max={today} defaultValue={v.awardedAt} required /></Field>
        <Field label="Modalidade" name="modalityId" error={e.modalityId}>
          <select id="modalityId" name="modalityId" defaultValue={v.modalityId}><option value="">Não informar</option>{modalities.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
        </Field>
        <Field label="Graduado por (opcional)" name="awardedBy" error={e.awardedBy}><input id="awardedBy" name="awardedBy" defaultValue={v.awardedBy} maxLength={120} /></Field>
        <div className="span-2"><Field label="Observação (opcional)" name="notes" error={e.notes}><input id="notes" name="notes" defaultValue={v.notes} maxLength={200} /></Field></div>
      </div>
      <div className="form-actions"><Submit>Registrar graduação</Submit></div>
    </form>
  );
}
