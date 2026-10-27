// v0.11 (Kombexa): identidade visual por academia, documentos, comunicados, graduações,
// QR Code de presença e as consultas da Área do Aluno. Contra PostgreSQL de verdade.
import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { modalityOf, newAcademy, studentData } from "./helpers";
import { jpeg, png, webp } from "./fixtures/images";
import { db } from "@/db";
import { academyLogos, attendances, auditLogs, students, users } from "@/db/schema";
import { today } from "@/lib/dates";
import { DomainError, NotFoundError } from "@/lib/errors";
import { ImageError, inspectImage, LOGO_MAX_BYTES, validateLogo } from "@/lib/image";
import { firstArea } from "@/lib/auth/guards";
import { ALL_PERMISSIONS, can } from "@/lib/permissions";
import { academyInput, announcementInput, normalizeCheckinCode, rankInput } from "@/lib/validation";
import { updateAcademy } from "@/services/academy";
import { announcementsForStudent, createAnnouncement, setAnnouncementArchived, updateAnnouncement } from "@/services/announcements";
import { academyLogoDataUrl, ownAcademyLogo, removeAcademyLogo, saveAcademyLogo } from "@/services/branding";
import { checkInByCode, newCheckinCode, ownCheckinCode, regenerateCheckinCode } from "@/services/checkin";
import { enrollmentDocument, ownEnrollmentDocument } from "@/services/documents";
import { createPayment } from "@/services/payments";
import { addRank, listRanks, removeRank } from "@/services/ranks";
import { getOwnReceipt, getReceipt } from "@/services/receipts";
import { activeLinks, ownAttendance, ownRanks, studentOverview } from "@/services/student-portal";
import { createStudent } from "@/services/students";
import type { AcademyContext } from "@/services/context";

const account = async (name = "Lara Nunes") => {
  const [u] = await db.insert(users).values({ academyId: null, role: "STUDENT", name, email: `k${Date.now()}${Math.random()}@a.dev`, passwordHash: "x" }).returning();
  return { userId: u.id, role: "STUDENT" as const };
};

/** Aluno ativo na academia, já ligado a uma conta. */
async function enrolled(ctx: AcademyContext, name = "Lara Nunes") {
  const me = await account(name);
  const s = await createStudent(ctx, studentData(ctx, { name }));
  await db.update(students).set({ userId: me.userId }).where(eq(students.id, s.id));
  return { me, student: s };
}

const pay = (studentId: string, amount = 15000) => ({ studentId, feeId: null, amount, paidAt: today(), method: "pix" as const, status: "paid" as const, reference: "Matrícula", notes: null });

// ------------------------------------------------------------------------------------------------
describe("validação de imagens pelo conteúdo", () => {
  it("aceita PNG, JPEG e WebP reais e lê as dimensões do próprio arquivo", () => {
    expect(inspectImage(png(64, 40))).toEqual({ mime: "image/png", width: 64, height: 40 });
    expect(inspectImage(jpeg(300, 120))).toEqual({ mime: "image/jpeg", width: 300, height: 120 });
    expect(inspectImage(webp(500, 250))).toEqual({ mime: "image/webp", width: 500, height: 250 });
  });

  it("recusa o que não é imagem, mesmo com nome ou tipo de imagem", () => {
    const fake = Buffer.from("isto é um texto renomeado para logo.png");
    expect(() => inspectImage(fake)).toThrow(ImageError);
    expect(() => inspectImage(Buffer.from("MZ\x90\x00 executável"))).toThrow("não é uma imagem");
    expect(() => inspectImage(new Uint8Array())).toThrow("Escolha");
  });

  it("recusa SVG (pode carregar scripts), com ou sem cabeçalho XML", () => {
    expect(() => inspectImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'))).toThrow("SVG");
    expect(() => inspectImage(Buffer.from('<?xml version="1.0"?>\n<svg></svg>'))).toThrow("SVG");
  });

  it("recusa imagem corrompida ou cortada", () => {
    const full = png(64, 64);
    expect(() => inspectImage(full.subarray(0, full.length - 12))).toThrow(ImageError); // sem IEND
    const j = jpeg(100, 100);
    expect(() => inspectImage(j.subarray(0, j.length - 2))).toThrow("JPEG");
  });

  it("aplica os limites da logo: tamanho do arquivo e dimensões", () => {
    expect(validateLogo(png(200, 80)).width).toBe(200);
    expect(() => validateLogo(png(16, 16))).toThrow("pequena");
    expect(() => validateLogo(jpeg(5000, 100))).toThrow("grande demais");
    const huge = Buffer.concat([png(64, 64), Buffer.alloc(LOGO_MAX_BYTES)]);
    expect(() => validateLogo(huge)).toThrow("1 MB");
  });
});

// ------------------------------------------------------------------------------------------------
describe("logo da academia", () => {
  it("adiciona, substitui e remove, com auditoria sem o conteúdo do arquivo", async () => {
    const ctx = await newAcademy("Logo");
    expect(await ownAcademyLogo(ctx)).toBeNull();

    await saveAcademyLogo(ctx, png(120, 60));
    const first = await ownAcademyLogo(ctx);
    expect(first).toMatchObject({ mime: "image/png", width: 120, height: 60 });
    expect(first!.src.startsWith("data:image/png;base64,")).toBe(true);

    await saveAcademyLogo(ctx, jpeg(400, 200)); // substitui: continua uma logo só
    expect(await ownAcademyLogo(ctx)).toMatchObject({ mime: "image/jpeg", width: 400 });
    expect(await db.select().from(academyLogos).where(eq(academyLogos.academyId, ctx.academyId))).toHaveLength(1);

    await removeAcademyLogo(ctx);
    expect(await ownAcademyLogo(ctx)).toBeNull();
    await expect(removeAcademyLogo(ctx)).rejects.toThrow("não tem logo");

    const logs = await db.select().from(auditLogs).where(eq(auditLogs.academyId, ctx.academyId));
    expect(logs.map((l) => l.action)).toEqual(expect.arrayContaining(["academy.logo_added", "academy.logo_replaced", "academy.logo_removed"]));
    const added = logs.find((l) => l.action === "academy.logo_added")!;
    expect(added.data).toMatchObject({ mime: "image/png", width: 120, height: 60 });
    expect(JSON.stringify(added.data)).not.toContain("base64");
  });

  it("arquivo inválido vira erro de campo e não grava nada", async () => {
    const ctx = await newAcademy("Logo inválida");
    const err = await saveAcademyLogo(ctx, Buffer.from("<svg onload=alert(1)></svg>")).catch((e) => e);
    expect(err).toBeInstanceOf(DomainError);
    expect((err as DomainError).fieldErrors?.logo).toContain("SVG");
    expect(await ownAcademyLogo(ctx)).toBeNull();
  });

  it("cada academia tem a sua: enviar ou remover em uma não toca na outra", async () => {
    const a = await newAcademy("A");
    const b = await newAcademy("B");
    await saveAcademyLogo(a, png(100, 100));
    expect(await ownAcademyLogo(b)).toBeNull();
    await saveAcademyLogo(b, webp(300, 100));
    await removeAcademyLogo(a);
    expect(await ownAcademyLogo(b)).toMatchObject({ mime: "image/webp" });
    expect(await academyLogoDataUrl(a.academyId)).toBeNull();
  });
});

// ------------------------------------------------------------------------------------------------
describe("dados cadastrais da academia para contratos", () => {
  it("valida e guarda razão social e responsável (opcionais)", async () => {
    const ctx = await newAcademy("Dados");
    const parsed = academyInput.parse({ name: "Equipe Leão", legalName: "Leão Esportes LTDA", ownerName: "Marcos Leão", document: "", phone: "", email: "" });
    await updateAcademy(ctx, parsed);
    const doc = await enrollmentDocument(ctx, (await createStudent(ctx, studentData(ctx))).id);
    expect(doc.academy).toMatchObject({ name: "Equipe Leão", legalName: "Leão Esportes LTDA", ownerName: "Marcos Leão" });
    expect(academyInput.parse({ name: "X", legalName: "  ", ownerName: "" })).toMatchObject({ legalName: null, ownerName: null });
    expect(academyInput.safeParse({ name: "X", legalName: "a".repeat(161) }).success).toBe(false);
  });
});

// ------------------------------------------------------------------------------------------------
describe("documentos com a identidade da academia", () => {
  it("a ficha usa a logo da academia dona do aluno; sem logo, segue sem quebrar", async () => {
    const a = await newAcademy("Doc A");
    const b = await newAcademy("Doc B");
    await saveAcademyLogo(b, png(90, 90));
    const sa = await createStudent(a, studentData(a));
    const sb = await createStudent(b, studentData(b));

    const docA = await enrollmentDocument(a, sa.id);
    expect(docA.logo).toBeNull(); // academia A não tem logo: o cabeçalho usa o nome
    expect(docA.academy.id).toBe(a.academyId);

    const docB = await enrollmentDocument(b, sb.id);
    expect(docB.logo).toMatch(/^data:image\/png;base64,/);
    expect(docB.academy.id).toBe(b.academyId);
  });

  it("a equipe de uma academia não abre a ficha de aluno de outra", async () => {
    const a = await newAcademy("Ficha A");
    const b = await newAcademy("Ficha B");
    const sb = await createStudent(b, studentData(b));
    await expect(enrollmentDocument(a, sb.id)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("saúde só entra quando pedida, e nunca na versão do aluno", async () => {
    const ctx = await newAcademy("Saúde");
    const { me, student } = await enrolled(ctx);
    await db.update(students).set({ healthNotes: "Asma leve", healthConsentAt: new Date() }).where(eq(students.id, student.id));
    expect((await enrollmentDocument(ctx, student.id)).health).toBeNull();
    expect((await enrollmentDocument(ctx, student.id, { withHealth: true })).health).toBe("Asma leve");
    expect((await ownEnrollmentDocument(me, student.id)).health).toBeNull();
  });

  it("o aluno vê só a própria ficha: trocar o ID na URL não abre a de outro", async () => {
    const ctx = await newAcademy("Própria");
    const { me, student } = await enrolled(ctx, "Ana Souza");
    const other = await enrolled(ctx, "Bruno Lima");
    const doc = await ownEnrollmentDocument(me, student.id);
    expect(doc.student.name).toBe("Ana Souza");
    await expect(ownEnrollmentDocument(me, other.student.id)).rejects.toBeInstanceOf(NotFoundError);
    // vínculo inativo também não abre
    await db.update(students).set({ status: "inactive" }).where(eq(students.id, student.id));
    await expect(ownEnrollmentDocument(me, student.id)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("assinatura só aparece quando a academia registrou a data", async () => {
    const ctx = await newAcademy("Assinatura");
    const { me, student } = await enrolled(ctx);
    expect((await ownEnrollmentDocument(me, student.id)).signedAt).toBeNull();
    await db.update(students).set({ enrollmentSignedAt: "2026-02-01" }).where(eq(students.id, student.id));
    expect((await ownEnrollmentDocument(me, student.id)).signedAt).toBe("2026-02-01");
  });

  it("o recibo traz a logo da academia do pagamento (equipe e aluno)", async () => {
    const ctx = await newAcademy("Recibo");
    await saveAcademyLogo(ctx, jpeg(200, 100));
    const { me, student } = await enrolled(ctx);
    const p = await createPayment(ctx, pay(student.id));
    expect((await getReceipt(ctx, p.id)).logo).toMatch(/^data:image\/jpeg;base64,/);
    expect((await getOwnReceipt(me, p.id)).logo).toMatch(/^data:image\/jpeg;base64,/);
    const outsider = await account("Outra Pessoa");
    await expect(getOwnReceipt(outsider, p.id)).rejects.toBeInstanceOf(NotFoundError);
  });
});

// ------------------------------------------------------------------------------------------------
describe("comunicados", () => {
  const input = (title: string) => announcementInput.parse({ title, body: "Treino às 19h.", category: "horario" });

  it("valida título, texto e categoria", () => {
    expect(announcementInput.safeParse({ title: "", body: "x", category: "geral" }).success).toBe(false);
    expect(announcementInput.safeParse({ title: "x", body: "x", category: "spam" }).success).toBe(false);
    expect(announcementInput.parse({ title: "x", body: "y", category: "evento", pinned: "on" }).pinned).toBe(true);
  });

  it("o aluno vê só os comunicados ativos das academias em que está ativo", async () => {
    const a = await newAcademy("Mural A");
    const b = await newAcademy("Mural B");
    const { me } = await enrolled(a);
    const ann = await createAnnouncement(a, input("Feriado na sexta"));
    await createAnnouncement(b, input("Aviso só da B"));

    const seen = await announcementsForStudent(me);
    expect(seen.map((x) => x.title)).toEqual(["Feriado na sexta"]);

    await setAnnouncementArchived(a, ann.id, true);
    expect(await announcementsForStudent(me)).toHaveLength(0);
    await setAnnouncementArchived(a, ann.id, false);
    expect(await announcementsForStudent(me)).toHaveLength(1);

    const stranger = await account("Sem academia");
    expect(await announcementsForStudent(stranger)).toHaveLength(0);
  });

  it("uma academia não edita nem arquiva comunicado de outra", async () => {
    const a = await newAcademy("Edita A");
    const b = await newAcademy("Edita B");
    const ann = await createAnnouncement(a, input("Original"));
    await expect(updateAnnouncement(b, ann.id, input("Invadido"))).rejects.toBeInstanceOf(NotFoundError);
    await expect(setAnnouncementArchived(b, ann.id, true)).rejects.toBeInstanceOf(NotFoundError);
    const logs = await db.select().from(auditLogs).where(and(eq(auditLogs.academyId, a.academyId), eq(auditLogs.action, "announcement.created")));
    expect(logs).toHaveLength(1);
  });
});

// ------------------------------------------------------------------------------------------------
describe("graduações", () => {
  it("valida o formulário", () => {
    expect(rankInput.safeParse({ rank: "", awardedAt: "2026-01-01" }).success).toBe(false);
    expect(rankInput.safeParse({ rank: "Faixa azul", awardedAt: "31/02/2026" }).success).toBe(false);
  });

  it("registra histórico, recusa data futura e modalidade de outra academia", async () => {
    const a = await newAcademy("Faixa A");
    const b = await newAcademy("Faixa B");
    const { me, student } = await enrolled(a);
    await addRank(a, student.id, rankInput.parse({ rank: "Faixa branca", awardedAt: "2025-01-10" }));
    await addRank(a, student.id, rankInput.parse({ rank: "Faixa azul", awardedAt: "2026-03-01", awardedBy: "Mestre Silva" }));
    await expect(addRank(a, student.id, rankInput.parse({ rank: "Faixa roxa", awardedAt: "2099-01-01" }))).rejects.toThrow("futuro");

    const otherModality = modalityOf(b);
    await expect(addRank(a, student.id, rankInput.parse({ rank: "X", awardedAt: "2026-01-01", modalityId: otherModality }))).rejects.toThrow("modalidade");

    const mine = await ownRanks(me, student.id);
    expect(mine.map((r) => r.rank)).toEqual(["Faixa azul", "Faixa branca"]); // mais recente primeiro
    expect(mine[0].awardedBy).toBe("Mestre Silva");
  });

  it("isolamento: outra academia não gradua nem apaga; outro aluno não lê", async () => {
    const a = await newAcademy("Iso A");
    const b = await newAcademy("Iso B");
    const { student } = await enrolled(a);
    await expect(addRank(b, student.id, rankInput.parse({ rank: "Faixa preta", awardedAt: "2026-01-01" }))).rejects.toBeInstanceOf(NotFoundError);
    const r = await addRank(a, student.id, rankInput.parse({ rank: "Faixa cinza", awardedAt: "2026-01-01" }));
    await expect(removeRank(b, r.id)).rejects.toBeInstanceOf(NotFoundError);
    expect(await listRanks(b, student.id)).toHaveLength(0);
    const intruder = await account("Intruso");
    await expect(ownRanks(intruder, student.id)).rejects.toBeInstanceOf(NotFoundError);
    await removeRank(a, r.id);
    expect(await listRanks(a, student.id)).toHaveLength(0);
  });
});

// ------------------------------------------------------------------------------------------------
describe("QR Code de presença", () => {
  it("o código é aleatório, sem dados pessoais, e aceita os formatos de leitura", () => {
    const c = newCheckinCode();
    expect(c).toMatch(/^[0-9A-HJKMNP-TV-Z]{12}$/);
    expect(newCheckinCode()).not.toBe(c);
    expect(normalizeCheckinCode(`KBX1:${c}`)).toBe(c);
    expect(normalizeCheckinCode(` ${c.slice(0, 4)}-${c.slice(4, 8)}-${c.slice(8)} `.toLowerCase())).toBe(c);
    expect(normalizeCheckinCode("12345")).toBeNull();
    expect(normalizeCheckinCode("' or 1=1 --")).toBeNull();
  });

  it("marca presença uma vez por dia e o código substituído deixa de valer", async () => {
    const ctx = await newAcademy("QR");
    const { me, student } = await enrolled(ctx);
    const code = await ownCheckinCode(me, student.id);
    expect(await ownCheckinCode(me, student.id)).toBe(code); // estável até gerar outro

    const d = today();
    expect(await checkInByCode(ctx, code, d)).toMatchObject({ studentId: student.id, already: false });
    expect(await checkInByCode(ctx, code, d)).toMatchObject({ already: true });
    expect(await db.select().from(attendances).where(eq(attendances.studentId, student.id))).toHaveLength(1);

    const fresh = await regenerateCheckinCode(me, student.id);
    expect(fresh).not.toBe(code);
    await expect(checkInByCode(ctx, code, d)).rejects.toThrow("não reconhecido");
    const audited = await db.select().from(auditLogs).where(and(eq(auditLogs.academyId, ctx.academyId), eq(auditLogs.action, "student.checkin_code_replaced")));
    expect(audited).toHaveLength(1);
  });

  it("código de outra academia ou de matrícula inativa não marca presença", async () => {
    const a = await newAcademy("QR A");
    const b = await newAcademy("QR B");
    const { me, student } = await enrolled(a);
    const code = await ownCheckinCode(me, student.id);
    await expect(checkInByCode(b, code, today())).rejects.toThrow("não reconhecido");
    await db.update(students).set({ status: "inactive" }).where(eq(students.id, student.id));
    await expect(checkInByCode(a, code, today())).rejects.toThrow("matrícula ativa");
  });

  it("só o próprio aluno (ou responsável) vê ou troca o código", async () => {
    const ctx = await newAcademy("QR dono");
    const { student } = await enrolled(ctx);
    const other = await account("Outra conta");
    await expect(ownCheckinCode(other, student.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(regenerateCheckinCode(other, student.id)).rejects.toBeInstanceOf(NotFoundError);
  });
});

// ------------------------------------------------------------------------------------------------
describe("Área do Aluno: frequência, finanças e vínculos", () => {
  it("frequência vem dos registros da academia e só do próprio vínculo", async () => {
    const ctx = await newAcademy("Freq");
    const { me, student } = await enrolled(ctx);
    const other = await enrolled(ctx, "Outro Aluno");
    const d = today();
    await db.insert(attendances).values([{ academyId: ctx.academyId, studentId: student.id, date: d }, { academyId: ctx.academyId, studentId: other.student.id, date: d }]);
    const att = await ownAttendance(me, student.id);
    expect(att.dates).toEqual([d]);
    expect(att.last30).toBe(1);
    expect(att.byMonth).toEqual([{ month: d.slice(0, 7), count: 1 }]);
    await expect(ownAttendance(me, other.student.id)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("mensalidades e pagamentos aparecem para o aluno, e ele não tem como alterá-los", async () => {
    const ctx = await newAcademy("Fin");
    const { me, student } = await enrolled(ctx);
    await createPayment(ctx, pay(student.id, 9000));
    const view = await studentOverview(me, student.id);
    expect(view.payments.map((p) => p.amountCents)).toEqual([9000]);
    // a área do aluno só expõe leitura: nenhum serviço do portal escreve em mensalidades ou pagamentos
    const portal = await import("@/services/student-portal");
    expect(Object.keys(portal).filter((k) => /pay|fee|mark|confirm/i.test(k) && k !== "studentOverview")).toEqual([]);
  });

  it("activeLinks lista os próprios vínculos ativos e os dos dependentes, nada além", async () => {
    const a = await newAcademy("Links A");
    const b = await newAcademy("Links B");
    const { me, student } = await enrolled(a);
    const sb = await createStudent(b, studentData(b, { status: "inactive" }));
    await db.update(students).set({ userId: me.userId }).where(eq(students.id, sb.id));
    const links = await activeLinks(me);
    expect(links.map((l) => l.id)).toEqual([student.id]);
    expect(links[0].asGuardian).toBe(false);
  });
});

// ------------------------------------------------------------------------------------------------
describe("permissões novas", () => {
  it("\"comunicados\" é uma permissão da equipe, com área própria", () => {
    expect(ALL_PERMISSIONS).toContain("comunicados");
    expect(can(["comunicados"], "comunicados")).toBe(true);
    expect(can(["alunos"], "comunicados")).toBe(false);
    expect(firstArea(["comunicados"])).toBe("/comunicados");
  });
});
