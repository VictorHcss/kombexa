// Regressão (auditoria 2026-11): a busca de alunos respeita as permissões da equipe.
import { describe, expect, it, vi } from "vitest";
import type { Permission } from "@/lib/permissions";
import { newAcademy, studentData } from "./helpers";
import { createStudent } from "@/services/students";

const who: { academyId: string; userId: string; permissions: Permission[] | null } = { academyId: "", userId: "", permissions: null };
vi.mock("@/lib/auth/guards", () => ({
  requireAcademyAdmin: async () => ({ ...who, role: "ACADEMY_ADMIN", timezone: "America/Sao_Paulo", user: {} }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const { searchStudentsAction } = await import("@/app/(app)/alunos/actions");

describe("busca de alunos (formulários de mensalidade e pagamento)", () => {
  it("não devolve dados a quem só tem Comunicados ou Presença; devolve a quem usa os formulários", async () => {
    const ctx = await newAcademy();
    await createStudent(ctx, studentData(ctx, { name: "Fernanda Busca", email: "fernanda.busca@exemplo.dev" }));
    Object.assign(who, { academyId: ctx.academyId, userId: ctx.userId });

    for (const limited of [["comunicados"], ["presenca"], []] as Permission[][]) {
      who.permissions = limited;
      expect(await searchStudentsAction("Fernanda")).toEqual([]);
    }
    for (const allowed of [null, ["pagamentos"], ["mensalidades"], ["alunos"]] as (Permission[] | null)[]) {
      who.permissions = allowed;
      const rows = await searchStudentsAction("Fernanda");
      expect(rows.map((r) => r.name)).toEqual(["Fernanda Busca"]);
    }
  });
});
