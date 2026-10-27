"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { handleForm, type ActionState } from "@/lib/action";
import { requireAcademyAdmin } from "@/lib/auth/guards";
import { isUuid } from "@/lib/page";
import { announcementInput } from "@/lib/validation";
import { createAnnouncement, setAnnouncementArchived, updateAnnouncement } from "@/services/announcements";

const done = (ok: string, archived = false) => {
  revalidatePath("/comunicados");
  revalidatePath("/aluno", "layout");
  redirect(`/comunicados?ok=${ok}${archived ? "&ver=arquivados" : ""}`);
};

export async function saveAnnouncementAction(id: string | null, _: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await requireAcademyAdmin("comunicados");
  if (id !== null && !isUuid(id)) return { message: "Comunicado não encontrado." };
  let ok = false;
  const state = await handleForm(form, announcementInput, async (data) => {
    if (id) await updateAnnouncement(ctx, id, data);
    else await createAnnouncement(ctx, data);
    ok = true;
  });
  if (!ok) return state;
  done(id ? "comunicado-salvo" : "comunicado-publicado");
  return {};
}

export async function archiveAnnouncementAction(form: FormData) {
  const ctx = await requireAcademyAdmin("comunicados");
  const id = String(form.get("id") ?? "");
  if (!isUuid(id)) return;
  const archived = form.get("archived") === "true";
  await setAnnouncementArchived(ctx, id, archived);
  done(archived ? "comunicado-arquivado" : "comunicado-reativado");
}
