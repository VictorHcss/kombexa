"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStudent } from "@/lib/auth/guards";
import { isUuid } from "@/lib/page";
import { regenerateCheckinCode } from "@/services/checkin";

/** Novo código: o anterior (por exemplo, de um print compartilhado) deixa de valer. */
export async function regenerateCodeAction(form: FormData) {
  const ctx = await requireStudent();
  const id = String(form.get("studentId") ?? "");
  if (!isUuid(id)) return;
  await regenerateCheckinCode(ctx, id); // confere que o vínculo é da conta
  revalidatePath("/aluno/carteirinha");
  redirect("/aluno/carteirinha?ok=codigo-gerado");
}
