"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { handleForm, type ActionState } from "@/lib/action";
import { requireAcademyAdmin } from "@/lib/auth/guards";
import { DomainError } from "@/lib/errors";
import { academyInput, formToObject, modalityInput, passwordChangeInput, permissionsFromForm, userInput } from "@/lib/validation";
import { createModality, setModalityActive, updateAcademy, updateModality, updateTerms } from "@/services/academy";
import { removeAcademyLogo, saveAcademyLogo } from "@/services/branding";
import { LOGO_MAX_BYTES } from "@/lib/image";
import { createSession } from "@/lib/auth/session";
import { changePassword, createAcademyAdmin, setUserActive, updateUserPermissions } from "@/services/users";

const done = (aba: string, ok: string) => {
  revalidatePath("/", "layout");
  redirect(`/configuracoes?aba=${aba}&ok=${ok}`);
};

export async function createUserAction(_: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await requireAcademyAdmin("full");
  const access = permissionsFromForm(form);
  if ("error" in access) return { message: access.error, errors: { access: access.error }, values: { ...formToObject(form), password: "" } };
  let ok = false;
  const state = await handleForm(form, userInput, async (data) => { await createAcademyAdmin(ctx, data, access.permissions); ok = true; });
  if (!ok) return { ...state, values: { ...state.values, password: "" } };
  done("acesso", "usuario-criado");
  return {};
}

export async function toggleUserAction(form: FormData) {
  const ctx = await requireAcademyAdmin("full");
  try {
    await setUserActive(ctx, String(form.get("id")), form.get("active") === "true");
  } catch (error) {
    if (error instanceof DomainError) redirect(`/configuracoes?aba=acesso&erro=${encodeURIComponent(error.message)}`);
    throw error;
  }
  done("acesso", "usuario-salvo");
}

export async function updatePermissionsAction(id: string, _: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await requireAcademyAdmin("full");
  const access = permissionsFromForm(form);
  if ("error" in access) return { message: access.error };
  try {
    await updateUserPermissions(ctx, id, access.permissions);
  } catch (error) {
    if (error instanceof DomainError) return { message: error.message };
    throw error;
  }
  done("acesso", "acesso-alterado");
  return {};
}

export async function changePasswordAction(_: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await requireAcademyAdmin();
  let ok = false;
  const state = await handleForm(form, passwordChangeInput, async (data) => { await changePassword(ctx.userId, ctx.academyId, data.current, data.next); ok = true; });
  if (!ok) return { ...state, values: {} }; // nunca devolve senhas para o navegador
  await createSession(ctx.userId); // as outras sessões foram encerradas; esta continua aberta
  done("acesso", "senha-alterada");
  return {};
}

export async function updateAcademyAction(_: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await requireAcademyAdmin("configuracoes");
  let ok = false;
  const state = await handleForm(form, academyInput, async (data) => { await updateAcademy(ctx, data); ok = true; });
  if (!ok) return state;
  done("academia", "academia-salva");
  return {};
}

export async function updateTermsAction(_: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await requireAcademyAdmin("configuracoes");
  await updateTerms(ctx, String(form.get("terms") ?? ""));
  done("ficha", "termos-salvos");
  return {};
}

export async function saveModalityAction(id: string | null, _: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await requireAcademyAdmin("configuracoes");
  let ok = false;
  const state = await handleForm(form, modalityInput, async (data) => { if (id) await updateModality(ctx, id, data); else await createModality(ctx, data); ok = true; });
  if (!ok) return state;
  done("modalidades", "modalidade-salva");
  return {};
}

export async function toggleModalityAction(form: FormData) {
  const ctx = await requireAcademyAdmin("configuracoes");
  await setModalityActive(ctx, String(form.get("id")), form.get("active") === "true");
  done("modalidades", "modalidade-salva");
}

/**
 * Logo da academia. A academia vem SEMPRE da sessão (ctx.academyId): nenhum campo do formulário
 * escolhe qual academia muda. O conteúdo é validado no servidor (lib/image.ts).
 */
export async function uploadLogoAction(_: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await requireAcademyAdmin("configuracoes");
  const file = form.get("logo");
  if (!(file instanceof File) || file.size === 0) return { message: "Escolha uma imagem para enviar.", errors: { logo: "Escolha uma imagem." } };
  if (file.size > LOGO_MAX_BYTES) return { message: "A imagem passa de 1 MB. Reduza o tamanho e tente de novo.", errors: { logo: "Máximo de 1 MB." } };
  try {
    await saveAcademyLogo(ctx, new Uint8Array(await file.arrayBuffer()));
  } catch (error) {
    if (error instanceof DomainError) return { message: error.message, errors: error.fieldErrors };
    console.error(error);
    return { message: "Não foi possível salvar a logo agora. Tente de novo em instantes." };
  }
  done("identidade", "logo-salva");
  return {};
}

export async function removeLogoAction() {
  const ctx = await requireAcademyAdmin("configuracoes");
  try {
    await removeAcademyLogo(ctx);
  } catch (error) {
    if (error instanceof DomainError) redirect(`/configuracoes?aba=identidade&erro=${encodeURIComponent(error.message)}`);
    throw error;
  }
  done("identidade", "logo-removida");
}
