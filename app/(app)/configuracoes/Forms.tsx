"use client";

import { useActionState, useState } from "react";
import { AddressFields } from "@/components/AddressFields";
import { MoneyInput, PasswordInput, Submit } from "@/components/client";
import { BRAZIL_TIMEZONES } from "@/lib/dates";
import { ALL_PERMISSIONS, PERMISSIONS, type Permission } from "@/lib/permissions";
import { Alert, Field } from "@/components/ui";
import { changePasswordAction, createUserAction, updatePermissionsAction, saveModalityAction, updateAcademyAction, updateTermsAction, uploadLogoAction } from "./actions";

export function PasswordForm() {
  const [state, action] = useActionState(changePasswordAction, {});
  const e = state.errors ?? {};
  return (
    <form action={action} className="form">
      {state.message && <Alert tone="danger">{state.message}</Alert>}
      <Field label="Senha atual" name="current" error={e.current}><input id="current" name="current" type="password" autoComplete="current-password" required /></Field>
      <Field label="Nova senha" name="next" error={e.next} hint="Pelo menos 10 caracteres."><input id="next" name="next" type="password" autoComplete="new-password" required /></Field>
      <Field label="Repita a nova senha" name="confirm" error={e.confirm}><input id="confirm" name="confirm" type="password" autoComplete="new-password" required /></Field>
      <div className="form-actions"><Submit>Trocar senha</Submit></div>
    </form>
  );
}

/**
 * Escolha do acesso: "total" (vê tudo e gerencia a equipe) ou "personalizado" (só as áreas marcadas).
 * Os nomes perm_<chave> são lidos no servidor por permissionsFromForm.
 */
export function PermissionPicker({ idPrefix, initial }: { idPrefix: string; initial: readonly Permission[] | null }) {
  const [custom, setCustom] = useState(initial !== null);
  const [chosen, setChosen] = useState<Set<Permission>>(new Set(initial ?? ["alunos", "pagamentos"]));
  const toggle = (p: Permission) => setChosen((old) => {
    const next = new Set(old);
    if (next.has(p)) { next.delete(p); if (p === "alunos") next.delete("saude"); } else { next.add(p); if (p === "saude") next.add("alunos"); }
    return next;
  });
  return (
    <fieldset className="access-picker">
      <legend>O que a pessoa pode fazer</legend>
      <div className="access-modes">
        <label className={`access-mode${!custom ? " is-on" : ""}`}>
          <input type="radio" name="access" value="full" checked={!custom} onChange={() => setCustom(false)} />
          <span><strong>Acesso total</strong><small>Vê tudo e gerencia a equipe, como você.</small></span>
        </label>
        <label className={`access-mode${custom ? " is-on" : ""}`}>
          <input type="radio" name="access" value="custom" checked={custom} onChange={() => setCustom(true)} />
          <span><strong>Personalizado</strong><small>Escolha as áreas que ela vai usar.</small></span>
        </label>
      </div>
      {custom && (
        <div className="perm-grid">
          {ALL_PERMISSIONS.map((p) => (
            <label key={p} className="perm" htmlFor={`${idPrefix}-${p}`}>
              <input id={`${idPrefix}-${p}`} type="checkbox" name={`perm_${p}`} checked={chosen.has(p)} onChange={() => toggle(p)} />
              <span><strong>{PERMISSIONS[p].label}</strong><small>{PERMISSIONS[p].hint}</small></span>
            </label>
          ))}
        </div>
      )}
    </fieldset>
  );
}

export function NewUserForm() {
  const [state, action] = useActionState(createUserAction, {});
  const e = state.errors ?? {};
  const v = state.values ?? {};
  return (
    <form action={action} className="form" noValidate>
      {state.message && <Alert tone="danger">{state.message}</Alert>}
      <div className="form-grid">
        <Field label="Nome" name="name" error={e.name}><input id="name" name="name" defaultValue={v.name} required /></Field>
        <Field label="E-mail (login)" name="email" error={e.email}><input id="email" name="email" type="email" defaultValue={v.email} required /></Field>
        <div className="span-2"><Field label="Senha inicial" name="password" error={e.password} hint="Pelo menos 10 caracteres. Peça para a pessoa trocar no primeiro acesso."><PasswordInput id="password" name="password" autoComplete="new-password" /></Field></div>
      </div>
      <PermissionPicker idPrefix="novo" initial={v.access === "full" ? null : ["alunos", "pagamentos"]} />
      <div className="form-actions"><Submit>Adicionar à equipe</Submit></div>
    </form>
  );
}

export function PermissionsForm({ id, initial }: { id: string; initial: readonly Permission[] | null }) {
  const [state, action] = useActionState(updatePermissionsAction.bind(null, id), {});
  return (
    <form action={action} className="form">
      {state.message && <Alert tone="danger">{state.message}</Alert>}
      <PermissionPicker idPrefix={`u-${id}`} initial={initial} />
      <div className="form-actions"><Submit>Salvar acesso</Submit></div>
    </form>
  );
}

export function AcademyForm({ initial }: { initial: Record<string, string | null> }) {
  const [state, action] = useActionState(updateAcademyAction, {});
  const v = { ...initial, ...state.values };
  const e = state.errors ?? {};
  return (
    <form action={action} className="form" noValidate>
      {state.message && <Alert tone="danger">{state.message}</Alert>}
      <div className="form-grid">
        <Field label="Nome da academia" name="name" error={e.name}><input id="name" name="name" defaultValue={v.name ?? ""} required /></Field>
        <Field label="Razão social (opcional)" name="legalName" error={e.legalName} hint="Usada como contratada no contrato de matrícula."><input id="legalName" name="legalName" defaultValue={v.legalName ?? ""} maxLength={160} /></Field>
        <Field label="Responsável pela academia (opcional)" name="ownerName" error={e.ownerName} hint="Quem assina pela academia nos contratos."><input id="ownerName" name="ownerName" defaultValue={v.ownerName ?? ""} maxLength={120} autoComplete="name" /></Field>
        <Field label="CPF ou CNPJ (opcional)" name="document" error={e.document} hint="Sai na ficha de matrícula, como identificação da academia."><input id="document" name="document" defaultValue={v.document ?? ""} inputMode="numeric" /></Field>
        <Field label="Telefone ou WhatsApp" name="phone" error={e.phone}><input id="phone" name="phone" defaultValue={v.phone ?? ""} inputMode="tel" /></Field>
        <Field label="E-mail" name="email" error={e.email}><input id="email" name="email" type="email" defaultValue={v.email ?? ""} /></Field>
        <Field label="Fuso horário" name="timezone" error={e.timezone} hint="Decide a partir de quando uma mensalidade conta como atrasada.">
          <select id="timezone" name="timezone" defaultValue={v.timezone ?? "America/Sao_Paulo"}>{BRAZIL_TIMEZONES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        </Field>
      </div>
      <h3 className="form-section">Recebimento por Pix</h3>
      <div className="form-grid">
        <div className="span-2">
          <Field label="Chave Pix (opcional)" name="pixKey" error={e.pixKey} hint="CPF, CNPJ, e-mail, celular com DDD ou chave aleatória. Com ela, o aluno vê o Pix copia e cola e o QR Code com o valor da mensalidade.">
            <input id="pixKey" name="pixKey" defaultValue={v.pixKey ?? ""} autoComplete="off" spellCheck={false} />
          </Field>
        </div>
      </div>
      <h3 className="form-section">Automação</h3>
      <div className="toggle-list">
        <label className="toggle"><input type="checkbox" name="autoGenerateFees" defaultChecked={v.autoGenerateFees !== "false"} />
          <span><strong>Gerar as mensalidades do mês sozinho</strong><small>No dia 1, para todos os alunos ativos. Mensalidade cancelada não volta.</small></span></label>
        <label className="toggle"><input type="checkbox" name="overdueReminder" defaultChecked={v.overdueReminder !== "false"} />
          <span><strong>Avisar por e-mail no dia seguinte ao vencimento</strong><small>Só para quem ainda está em aberto.</small></span></label>
        <Field label="Lembrete antes do vencimento" name="reminderDaysBefore" error={e.reminderDaysBefore} hint="Vai para o responsável principal (menores) ou para o aluno, com o Pix copia e cola quando houver chave.">
          <select id="reminderDaysBefore" name="reminderDaysBefore" defaultValue={v.reminderDaysBefore ?? "3"}>
            <option value="0">Não enviar</option>
            {[1, 2, 3, 5, 7].map((d) => <option key={d} value={d}>{d} dia{d > 1 ? "s" : ""} antes</option>)}
          </select>
        </Field>
      </div>
      <h3 className="form-section">Endereço</h3>
      <AddressFields values={v} errors={e} />
      <div className="form-actions"><Submit>Salvar dados da academia</Submit></div>
    </form>
  );
}

export function TermsForm({ initial }: { initial: string }) {
  const [state, action] = useActionState(updateTermsAction, {});
  return (
    <form action={action} className="form">
      {state.message && <Alert tone="danger">{state.message}</Alert>}
      <Field label="Termos da matrícula" name="terms" hint="Regras, cancelamento, reajuste, uso de equipamentos… Cada linha vira um parágrafo na ficha impressa.">
        <textarea id="terms" name="terms" defaultValue={initial} rows={12} maxLength={20000} />
      </Field>
      <div className="form-actions"><Submit>Salvar termos</Submit></div>
    </form>
  );
}

export function ModalityForm({ id, initial }: { id: string | null; initial?: { name: string; defaultFee: string } }) {
  const [state, action] = useActionState(saveModalityAction.bind(null, id), {});
  const e = state.errors ?? {};
  const v = { ...initial, ...state.values };
  return (
    <form action={action} className="modality-form" noValidate>
      <Field label="Modalidade" name={`name-${id ?? "nova"}`} error={e.name}><input id={`name-${id ?? "nova"}`} name="name" defaultValue={v.name ?? ""} placeholder="Ex.: Muay Thai" required /></Field>
      <Field label="Mensalidade sugerida (opcional)" name={`fee-${id ?? "nova"}`} error={e.defaultFee}><MoneyInput id={`fee-${id ?? "nova"}`} name="defaultFee" defaultValue={v.defaultFee ?? ""} invalid={!!e.defaultFee} /></Field>
      <Submit className="btn btn--primary">{id ? "Salvar" : "Adicionar"}</Submit>
      {state.message && !e.name && <p className="field-error" style={{ gridColumn: "1 / -1" }}>{state.message}</p>}
    </form>
  );
}

/**
 * Logo da academia: escolher, ver a prévia antes de salvar, substituir e remover.
 * A conferência aqui é só para avisar cedo; quem decide é o servidor (lib/image.ts).
 */
export function LogoForm({ current, rules, maxBytes, accept }: { current: { src: string; width: number; height: number; sizeBytes: number } | null; rules: string; maxBytes: number; accept: string }) {
  const [state, action] = useActionState(uploadLogoAction, {});
  const [preview, setPreview] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const error = localError ?? state.errors?.logo ?? state.message;

  function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setLocalError(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    if (!file) return;
    if (!accept.split(",").includes(file.type)) { setLocalError("Use PNG, JPEG ou WebP."); e.target.value = ""; return; }
    if (file.size > maxBytes) { setLocalError("A imagem passa de 1 MB."); e.target.value = ""; return; }
    setPreview(URL.createObjectURL(file));
  }

  const shown = preview ?? current?.src ?? null;
  return (
    <form action={action} className="form logo-form">
      <div className="logo-preview" data-empty={!shown}>
        {shown ? (
          // eslint-disable-next-line @next/next/no-img-element -- prévia local (blob:) ou logo salva (data:)
          <img src={shown} alt={preview ? "Prévia da nova logo" : "Logo atual da academia"} />
        ) : <span>Sem logo</span>}
        {preview && <span className="logo-preview-tag">Prévia, ainda não salva</span>}
      </div>
      <div className="logo-side">
        <Field label={current ? "Substituir a logo" : "Escolher a logo"} name="logo" error={error ?? undefined} hint={rules}>
          <input id="logo" name="logo" type="file" accept={accept} onChange={pick} required aria-describedby="logo-hint" />
        </Field>
        {current && !preview && <p className="small muted">Atual: {current.width}×{current.height} px, {Math.max(1, Math.round(current.sizeBytes / 1024))} KB.</p>}
        <div className="form-actions"><Submit pending="Enviando…">{current ? "Salvar nova logo" : "Salvar logo"}</Submit></div>
      </div>
    </form>
  );
}
