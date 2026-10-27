"use server";

import { grantGuardianAccess, revokeGuardianAccess } from "@/services/guardian-access";
import { siteUrl } from "@/lib/url";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { handleForm, type ActionState } from "@/lib/action";
import { requireAcademyAdmin } from "@/lib/auth/guards";
import { guardianInput, rankInput, studentInput } from "@/lib/validation";
import { addRank, removeRank } from "@/services/ranks";
import { DomainError } from "@/lib/errors";
import { isValidDate, todayIn } from "@/lib/dates";
import { removeGuardian, saveGuardian, searchGuardians, setPrimaryGuardian } from "@/services/guardians";
import { anonymizeStudent } from "@/services/privacy";
import { createStudent, listStudents, setEnrollmentSigned, setStudentStatus, updateHealth, updateStudent } from "@/services/students";

export async function createStudentAction(_: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await requireAcademyAdmin("alunos");
  let id = "";
  const state = await handleForm(form, studentInput, async (data) => { id = (await createStudent(ctx, data)).id; });
  if (!id) return state;
  revalidatePath("/alunos");
  redirect(`/alunos/${id}?ok=aluno-criado`);
}

export async function updateStudentAction(id: string, _: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await requireAcademyAdmin("alunos");
  let saved = false;
  const state = await handleForm(form, studentInput, async (data) => { await updateStudent(ctx, id, data); saved = true; });
  if (!saved) return state;
  revalidatePath(`/alunos/${id}`);
  redirect(`/alunos/${id}?ok=aluno-salvo`);
}

export async function toggleStudentStatusAction(form: FormData) {
  const ctx = await requireAcademyAdmin("alunos");
  const id = String(form.get("id"));
  const status = form.get("status") === "active" ? "active" : "inactive";
  await setStudentStatus(ctx, id, status);
  revalidatePath(`/alunos/${id}`);
  redirect(`/alunos/${id}?ok=aluno-status`);
}

/** Busca usada pelo campo de aluno (pagamento, mensalidade). Só dados da própria academia. */
export async function searchStudentsAction(q: string) {
  const ctx = await requireAcademyAdmin();
  if (typeof q !== "string" || q.trim().length < 2) return [];
  const rows = await listStudents(ctx, { q: q.slice(0, 80) }, 8);
  return rows.map((s) => ({ id: s.id, name: s.name, modality: s.modality, phone: s.phone, email: s.email, status: s.status, overdue: s.overdue, monthlyFeeCents: s.monthlyFeeCents }));
}

/** Busca de responsáveis já cadastrados na academia (para ligar irmãos ao mesmo responsável). */
export async function searchGuardiansAction(q: string) {
  const ctx = await requireAcademyAdmin("alunos");
  if (typeof q !== "string" || q.trim().length < 2) return [];
  return searchGuardians(ctx, q.slice(0, 80));
}

// ---------------------------------------------------------------- perfil: responsáveis, saúde e ficha
function back(id: string, aba: string, ok: string) {
  revalidatePath(`/alunos/${id}`);
  redirect(`/alunos/${id}?aba=${aba}&ok=${ok}`);
}

export async function saveGuardianAction(studentId: string, _: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await requireAcademyAdmin("alunos");
  let ok = false;
  const state = await handleForm(form, guardianInput, async (data) => { await saveGuardian(ctx, studentId, data); ok = true; });
  if (!ok) return state;
  back(studentId, "info", "responsavel-salvo");
  return {};
}

async function guarded(studentId: string, run: () => Promise<unknown>, aba: string, ok: string) {
  try {
    await run();
  } catch (error) {
    if (error instanceof DomainError) redirect(`/alunos/${studentId}?aba=${aba}&erro=${encodeURIComponent(error.message)}`);
    throw error;
  }
  back(studentId, aba, ok);
}

export async function primaryGuardianAction(form: FormData) {
  const ctx = await requireAcademyAdmin("alunos");
  const id = String(form.get("studentId"));
  await guarded(id, () => setPrimaryGuardian(ctx, id, String(form.get("guardianId"))), "info", "responsavel-salvo");
}

export async function removeGuardianAction(form: FormData) {
  const ctx = await requireAcademyAdmin("alunos");
  const id = String(form.get("studentId"));
  await guarded(id, () => removeGuardian(ctx, id, String(form.get("guardianId"))), "info", "responsavel-removido");
}

export async function saveHealthAction(studentId: string, _: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await requireAcademyAdmin("saude");
  try {
    await updateHealth(ctx, studentId, String(form.get("notes") ?? ""), form.get("consent") === "on");
  } catch (error) {
    if (error instanceof DomainError) return { message: error.message, errors: error.fieldErrors, values: { notes: String(form.get("notes") ?? "") } };
    throw error;
  }
  back(studentId, "saude", "saude-salva");
  return {};
}

export async function signedAction(form: FormData) {
  const ctx = await requireAcademyAdmin("alunos");
  const id = String(form.get("id"));
  const date = String(form.get("date") ?? "");
  await guarded(id, () => setEnrollmentSigned(ctx, id, form.get("undo") ? null : isValidDate(date) ? date : todayIn(ctx.timezone)), "info", "ficha-assinada");
}

export async function anonymizeAction(studentId: string, _: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await requireAcademyAdmin("alunos");
  try {
    await anonymizeStudent(ctx, studentId, String(form.get("confirmation") ?? ""));
  } catch (error) {
    if (error instanceof DomainError) return { message: error.message, errors: error.fieldErrors };
    throw error;
  }
  revalidatePath("/", "layout");
  redirect(`/alunos/${studentId}?ok=dados-eliminados`);
}

/** Libera (ou remove) a área do responsável para um responsável deste aluno. */
export async function guardianAccessAction(form: FormData) {
  const ctx = await requireAcademyAdmin("alunos");
  const studentId = String(form.get("studentId"));
  const guardianId = String(form.get("guardianId"));
  const back = `/alunos/${studentId}?aba=info`;
  try {
    if (form.get("revoke")) await revokeGuardianAccess(ctx, guardianId);
    else await grantGuardianAccess(ctx, guardianId, await siteUrl());
  } catch (error) {
    if (error instanceof DomainError) redirect(`${back}&erro=${encodeURIComponent(error.message)}`);
    throw error;
  }
  revalidatePath(`/alunos/${studentId}`);
  redirect(`${back}&ok=${form.get("revoke") ? "responsavel-sem-acesso" : "responsavel-com-acesso"}`);
}

/** Graduação: registrada pela equipe, nunca pelo aluno. */
export async function addRankAction(studentId: string, _: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await requireAcademyAdmin("alunos");
  let ok = false;
  const state = await handleForm(form, rankInput, async (data) => { await addRank(ctx, studentId, data); ok = true; });
  if (!ok) return state;
  back(studentId, "graduacoes", "graduacao-registrada");
  return {};
}

export async function removeRankAction(form: FormData) {
  const ctx = await requireAcademyAdmin("alunos");
  const id = String(form.get("studentId"));
  await guarded(id, () => removeRank(ctx, String(form.get("rankId"))), "graduacoes", "graduacao-removida");
}
