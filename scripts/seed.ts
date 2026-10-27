/**
 * DADOS DE DESENVOLVIMENTO. Cria uma academia de exemplo com alunos fictícios,
 * mensalidades, pagamentos e despesas, usando as mesmas regras do sistema.
 * Não use em produção: as senhas são conhecidas.
 */
import "./load-env";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "../db";
import { academies, attendances, guardians, modalities, students, users } from "../db/schema";
import { hashPassword } from "../lib/auth/password";
import { consentText } from "../lib/consent";
import { TEST_ACCOUNTS, TEST_PASSWORD } from "../lib/test-accounts";
import { currentReference, dueDateFor, monthRange, today } from "../lib/dates";
import type { AcademyContext } from "../services/context";
import { createFee, generateMonthlyFees, listFees } from "../services/fees";
import { createEntry } from "../services/finance";
import { createPayment } from "../services/payments";
import { setEnrollmentSigned } from "../services/students";
import { createStudent } from "../services/students";
import { currentInvite } from "../services/invites";
import { signUpWithInvite } from "../services/enrollment";
import { signUpStudent } from "../services/accounts";

const PASSWORD = TEST_PASSWORD;

async function main() {
  if (process.env.NODE_ENV === "production" && !process.env.ALLOW_SEED) {
    throw new Error("Seed bloqueado em produção. Defina ALLOW_SEED=1 se tiver certeza.");
  }
  const [exists] = await db.select().from(users).where(eq(users.email, "admin@academia.dev"));
  if (exists) {
    // bancos criados com um seed antigo ganham as contas de teste que faltam, sem apagar nada
    const created = await ensureStudentAccounts(exists.academyId!, exists.id);
    console.log(created.length
      ? `Dados de desenvolvimento já existiam. Contas de teste adicionadas: ${created.join(", ")}.`
      : "Dados de desenvolvimento já existem. Para recriar, resete o banco (ver docs/instalacao.md).");
    printAccounts();
    return;
  }

  const [academy] = await db.insert(academies).values({
    name: "Academia Punho de Ferro (exemplo)", document: "11.222.333/0001-81", phone: "(33) 3271-0000", email: "contato@punhodeferro.dev",
    zip: "35010-000", street: "Rua Marechal Floriano", number: "1200", district: "Centro", city: "Governador Valadares", state: "MG",
    enrollmentTerms: [
      "1. A mensalidade vence no dia escolhido na matrícula. Após o vencimento, a matrícula fica em atraso até a regularização.",
      "2. O cancelamento deve ser comunicado à recepção com 30 dias de antecedência. Mensalidades vencidas continuam devidas.",
      "3. O aluno declara estar apto para a prática de atividade física e se compromete a informar qualquer restrição de saúde.",
      "4. É obrigatório o uso do equipamento de proteção indicado pelo professor em cada modalidade.",
      "5. Os valores podem ser reajustados uma vez por ano, com aviso prévio de 30 dias.",
    ].join("\n"),
  }).returning();
  const [admin] = await db.insert(users).values({ academyId: academy.id, role: "ACADEMY_ADMIN", name: "Rodrigo Alves", email: "admin@academia.dev", passwordHash: await hashPassword(PASSWORD) }).returning();
  await db.insert(users).values({ academyId: null, role: "PLATFORM_ADMIN", name: "Administrador da plataforma", email: "plataforma@kombexa.dev", passwordHash: await hashPassword(PASSWORD) });
  const ctx: AcademyContext = { userId: admin.id, academyId: academy.id, role: "ACADEMY_ADMIN" };
  const fees: Record<string, number> = { Boxe: 15000, "Muay Thai": 16000, "Jiu-Jitsu": 18000, MMA: 20000, Kickboxing: 14000, "Boxe Infantil": 11000 };
  const mods = await db.insert(modalities).values(Object.entries(fees).map(([name, cents]) => ({ academyId: academy.id, name, defaultFeeCents: cents }))).returning();
  const mod = (name: string) => mods.find((m) => m.name === name)!.id;
  const blank = { cpf: null, zip: null, street: null, number: null, complement: null, district: null, city: null, state: null, emergencyName: null, emergencyPhone: null, emergencyRelation: null, imageConsent: null, guardianId: null, guardianName: null, guardianCpf: null, guardianPhone: null, guardianEmail: null, guardianRelationship: null };

  const people: [string, string, string, number][] = [
    ["Victor Almeida", "Boxe", "(33) 99812-4410", 15000], ["João Pereira", "Muay Thai", "(33) 99745-1022", 16000],
    ["Pedro Santos", "Jiu-Jitsu", "(33) 98877-3301", 18000], ["Carlos Oliveira", "Boxe", "(33) 99121-8874", 15000],
    ["Mariana Costa", "Muay Thai", "(33) 99654-2210", 16000], ["Ana Beatriz Lima", "Jiu-Jitsu", "(33) 98701-5566", 18000],
    ["Lucas Ferreira", "MMA", "(33) 99233-7788", 20000], ["Beatriz Rocha", "Boxe", "(33) 98815-4433", 15000],
    ["Rafael Gomes", "Kickboxing", "(33) 99102-6655", 14000], ["Juliana Martins", "Jiu-Jitsu", "(33) 98566-1212", 18000],
  ];
  const created = [];
  for (const [i, [name, modality, phone, fee]] of people.entries()) {
    created.push(await createStudent(ctx, {
      ...blank, name, modalityId: mod(modality), phone, email: `${name.split(" ")[0].toLowerCase()}@exemplo.dev`, birthDate: `19${90 + (i % 9)}-0${(i % 9) + 1}-1${i % 9}`,
      joinedAt: "2026-02-01", status: i === 9 ? "inactive" : "active", monthlyFee: fee, dueDay: [5, 10, 15][i % 3], notes: null,
      city: "Governador Valadares", state: "MG", emergencyName: i % 2 ? "Cláudia Almeida" : null, emergencyPhone: i % 2 ? "(33) 99100-2200" : null, emergencyRelation: i % 2 ? "Esposa" : null,
      imageConsent: i % 3 === 0 ? true : i % 3 === 1 ? false : null,
    }));
    if (i < 6) await setEnrollmentSigned(ctx, created[i].id, "2026-02-01");
  }

  // dois irmãos da turma infantil, com a mesma responsável
  const [y0] = today().split("-").map(Number);
  const kid1 = await createStudent(ctx, { ...blank, name: "Pedro Henrique Souza", modalityId: mod("Boxe Infantil"), phone: null, email: null, birthDate: `${y0 - 9}-03-12`, joinedAt: "2026-03-01", status: "active", monthlyFee: 11000, dueDay: 10, notes: null,
    guardianName: "Juliana Souza", guardianPhone: "(33) 99877-6655", guardianCpf: "529.982.247-25", guardianEmail: "juliana.souza@exemplo.dev", guardianRelationship: "Mãe", emergencyName: "Marcos Souza", emergencyPhone: "(33) 99811-7766", emergencyRelation: "Pai", imageConsent: true });
  const { guardiansOf } = await import("../services/guardians");
  const [mother] = await guardiansOf(ctx, kid1.id);
  await createStudent(ctx, { ...blank, name: "Laura Souza", modalityId: mod("Boxe Infantil"), phone: null, email: null, birthDate: `${y0 - 12}-08-02`, joinedAt: "2026-03-01", status: "active", monthlyFee: 9900, dueDay: 10, notes: "Desconto de irmãos",
    guardianId: mother.id, guardianRelationship: "Mãe", emergencyName: "Marcos Souza", emergencyPhone: "(33) 99811-7766", emergencyRelation: "Pai", imageConsent: false });

  // mensalidades do mês passado (todas pagas) e do mês atual (algumas pagas, uma parcial, algumas atrasadas)
  const now = currentReference();
  const [y, m] = now.split("-").map(Number);
  void y0;
  const previous = `${m === 1 ? y - 1 : y}-${String(m === 1 ? 12 : m - 1).padStart(2, "0")}`;
  await generateMonthlyFees(ctx, previous);
  for (const fee of await listFees(ctx, monthRange(previous))) {
    await createPayment(ctx, { studentId: fee.studentId, feeId: fee.id, amount: fee.amountCents, paidAt: fee.dueDate, method: "pix", status: "paid", reference: null, notes: null });
  }
  await generateMonthlyFees(ctx, now);
  // ordem por nome: o exemplo sai sempre igual (os IDs são aleatórios e não servem para ordenar)
  const current = (await listFees(ctx, monthRange(now))).sort((x, y) => x.studentName.localeCompare(y.studentName));
  for (const [i, fee] of current.entries()) {
    if (fee.dueDate > today()) continue;
    if (i % 3 === 0) continue; // fica atrasada
    const amount = i % 4 === 1 ? Math.round(fee.amountCents * 0.6) : fee.amountCents; // alguns parciais
    await createPayment(ctx, { studentId: fee.studentId, feeId: fee.id, amount, paidAt: fee.dueDate, method: i % 2 ? "cash" : "pix", status: "paid", reference: null, notes: null });
  }
  const next = `${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, "0")}`;
  await createFee(ctx, { studentId: created[0].id, amount: created[0].monthlyFeeCents ?? 15000, dueDate: dueDateFor(next, created[0].dueDay), reference: next, notes: "Mensalidade do próximo mês, criada antecipadamente" });

  await createEntry(ctx, { type: "income", category: "Matrícula", description: "Matrícula – Lucas Ferreira", amount: 8000, date: `${now}-02`, notes: null });
  await createEntry(ctx, { type: "expense", category: "Equipamentos", description: "Luvas e caneleiras novas", amount: 64000, date: `${now}-03`, notes: null });
  await createEntry(ctx, { type: "expense", category: "Infraestrutura", description: "Conta de energia", amount: 38990, date: `${now}-08`, notes: null });
  await createEntry(ctx, { type: "expense", category: "Manutenção", description: "Troca de tatame", amount: 120000, date: `${previous}-20`, notes: null });

  await ensureStudentAccounts(academy.id, admin.id);
  console.log("Dados de desenvolvimento criados.");
  printAccounts();
}

function printAccounts() {
  console.log(`\nContas de teste (senha para todas: ${PASSWORD}):`);
  for (const a of TEST_ACCOUNTS) console.log(`  ${a.label.padEnd(30)} ${a.email}`);
}

/**
 * Contas de aluno para testar a área do aluno e o fluxo de aprovação:
 *   aluno@academia.dev    → ligada ao cadastro de Victor Almeida (aluno ativo, com mensalidades e pagamentos)
 *   pendente@academia.dev → pediu para entrar pelo convite e aguarda aprovação em Solicitações
 *   semacademia@academia.dev → criou a conta sozinho, sem academia (a academia o adiciona pelo e-mail)
 * Devolve os e-mails criados agora (as que já existiam ficam como estão).
 */
async function ensureStudentAccounts(academyId: string, adminId: string): Promise<string[]> {
  const ctx: AcademyContext = { userId: adminId, academyId, role: "ACADEMY_ADMIN" };
  const created: string[] = [];
  const has = async (email: string) => !!(await db.select({ id: users.id }).from(users).where(eq(users.email, email)))[0];

  if (!(await has("aluno@academia.dev"))) {
    const [student] = await db.select().from(students)
      .where(and(eq(students.academyId, academyId), eq(students.name, "Victor Almeida"), isNull(students.userId)));
    if (student) {
      const [user] = await db.insert(users).values({ academyId: null, role: "STUDENT", name: student.name, email: "aluno@academia.dev", passwordHash: await hashPassword(PASSWORD) }).returning();
      const [academy] = await db.select({ name: academies.name }).from(academies).where(eq(academies.id, academyId));
      await db.update(students).set({ userId: user.id, dataConsentAt: new Date(), dataConsentText: consentText(academy.name) }).where(eq(students.id, student.id));
      created.push("aluno@academia.dev");
    }
  }

  if (!(await has("pendente@academia.dev"))) {
    const invite = await currentInvite(ctx);
    await signUpWithInvite(invite.token, {
      name: "Fernanda Ribeiro", phone: "(33) 99700-4411", email: "pendente@academia.dev", birthDate: "1995-06-20",
      password: PASSWORD, confirm: PASSWORD, consent: "on",
    });
    created.push("pendente@academia.dev");
  }

  if (!(await has("semacademia@academia.dev"))) {
    await signUpStudent({
      name: "Gabriel Moreira", phone: "(33) 99655-3020", email: "semacademia@academia.dev", birthDate: "1998-11-03",
      password: PASSWORD, confirm: PASSWORD, consent: "on",
    });
    created.push("semacademia@academia.dev");
  }

  // equipe com acesso personalizado: atende a recepção (alunos, mensalidades e pagamentos), sem financeiro nem saúde
  if (!(await has("recepcao@academia.dev"))) {
    await db.insert(users).values({
      academyId, role: "ACADEMY_ADMIN", name: "Camila Duarte", email: "recepcao@academia.dev", passwordHash: await hashPassword(PASSWORD),
      permissions: ["alunos", "mensalidades", "pagamentos", "solicitacoes"], emailVerifiedAt: new Date(),
    });
    created.push("recepcao@academia.dev");
  }

  // responsável com acesso: Juliana Souza (mãe dos irmãos do exemplo) vê os dependentes na área do responsável
  if (!(await has("responsavel@academia.dev"))) {
    const [mother] = await db.select({ id: guardians.id }).from(guardians).where(and(eq(guardians.academyId, academyId), eq(guardians.name, "Juliana Souza")));
    if (mother) {
      const [u] = await db.insert(users).values({ academyId: null, role: "STUDENT", name: "Juliana Souza", email: "responsavel@academia.dev", phone: "(33) 99877-6655", passwordHash: await hashPassword(PASSWORD), emailVerifiedAt: new Date() }).returning();
      await db.update(guardians).set({ userId: u.id }).where(eq(guardians.id, mother.id));
      created.push("responsavel@academia.dev");
    }
  }

  // presenças de exemplo nos últimos 30 dias (alguns alunos sumidos, para a lista "Sumidos")
  const [{ n: hasAttendance }] = await db.select({ n: sql<number>`count(*)::int` }).from(attendances).where(eq(attendances.academyId, academyId));
  if (!hasAttendance) {
    const active = await db.select({ id: students.id }).from(students).where(and(eq(students.academyId, academyId), eq(students.status, "active")));
    const base = today();
    const rows: { academyId: string; studentId: string; date: string }[] = [];
    active.forEach((st, i) => {
      const lastDay = i % 4 === 3 ? 20 : 0; // um em cada quatro está sem treinar há 20 dias
      for (let d = lastDay; d < 30; d += 2 + (i % 3)) {
        const [y, m, dd] = base.split("-").map(Number);
        rows.push({ academyId, studentId: st.id, date: new Date(Date.UTC(y, m - 1, dd - d)).toISOString().slice(0, 10) });
      }
    });
    if (rows.length) await db.insert(attendances).values(rows).onConflictDoNothing();
  }

  // chave Pix de exemplo (CPF de teste válido) para mostrar o Pix copia e cola na área do aluno
  await db.update(academies).set({ pixKey: "52998224725" }).where(and(eq(academies.id, academyId), isNull(academies.pixKey)));
  // contas de exemplo já confirmadas, menos o pedido pendente (mostra o aviso "e-mail não confirmado")
  await db.update(users).set({ emailVerifiedAt: new Date() })
    .where(and(isNull(users.emailVerifiedAt), inArray(users.email, ["aluno@academia.dev", "semacademia@academia.dev", "admin@academia.dev", "plataforma@kombexa.dev"])));
  return created;
}

main().then(() => process.exit(0)).catch((e) => { console.error(e.message); process.exit(1); });
