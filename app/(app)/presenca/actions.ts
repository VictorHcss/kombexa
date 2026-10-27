"use server";

import { revalidatePath } from "next/cache";
import { requireAcademyAdmin } from "@/lib/auth/guards";
import { isValidDate, todayIn } from "@/lib/dates";
import { isUuid } from "@/lib/page";
import { setPresence } from "@/services/attendance";
import { checkInByCode } from "@/services/checkin";
import { DomainError } from "@/lib/errors";
import { normalizeCheckinCode } from "@/lib/validation";

/** Marca ou desmarca a presença. Não aceita data no futuro. */
export async function togglePresenceAction(form: FormData) {
  const ctx = await requireAcademyAdmin("presenca");
  const studentId = String(form.get("studentId") ?? "");
  const raw = String(form.get("date") ?? "");
  const today = todayIn(ctx.timezone);
  const date = isValidDate(raw) && raw <= today ? raw : today;
  if (!isUuid(studentId)) return;
  await setPresence(ctx, studentId, date, form.get("present") === "true");
  revalidatePath("/presenca");
}

/**
 * Presença pelo QR Code do aluno. O leitor (ou a pessoa) digita o código; o servidor confere que
 * é de um aluno ativo DESTA academia. Vale só para hoje: não dá para lançar dias passados por código.
 */
export async function checkInAction(_: { message?: string; ok?: string }, form: FormData): Promise<{ message?: string; ok?: string }> {
  const ctx = await requireAcademyAdmin("presenca");
  const code = normalizeCheckinCode(String(form.get("code") ?? ""));
  if (!code) return { message: "Código inválido. Ele tem 12 letras e números (ex.: ABCD-EFGH-1234)." };
  try {
    const r = await checkInByCode(ctx, code, todayIn(ctx.timezone));
    revalidatePath("/presenca");
    return { ok: r.already ? `${r.name} já estava com presença hoje.` : `Presença de ${r.name} registrada.` };
  } catch (error) {
    if (error instanceof DomainError) return { message: error.message };
    throw error;
  }
}
