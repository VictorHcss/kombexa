/**
 * Schema do banco (Drizzle ORM + PostgreSQL).
 *
 * Multi-academia desde a base: toda tabela de dados de negócio tem academy_id,
 * e a camada de serviços sempre filtra por ele (ver services/context.ts).
 * Dinheiro sempre em centavos (integer), nunca em ponto flutuante.
 */
import { relations, sql } from "drizzle-orm";
import {
  boolean, check, customType, date, index, primaryKey, integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid, varchar, type AnyPgColumn,
} from "drizzle-orm/pg-core";

/** Conteúdo binário (logo da academia). O driver devolve Buffer. */
const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => "bytea" });

export const userRole = pgEnum("user_role", ["PLATFORM_ADMIN", "ACADEMY_ADMIN", "STUDENT"]);
// pending = pediu para entrar pelo convite; rejected = pedido recusado (fica no histórico).
// suspended está reservado para o futuro. Só "active" gera mensalidades e dá acesso à área do aluno.
export const studentStatus = pgEnum("student_status", ["active", "inactive", "pending", "rejected", "suspended"]);
// "atrasado" NÃO é armazenado: é calculado (pendente + vencimento no passado)
export const feeStatus = pgEnum("fee_status", ["pending", "paid", "canceled"]);
export const paymentStatus = pgEnum("payment_status", ["paid", "pending", "canceled"]);
export const paymentMethod = pgEnum("payment_method", ["cash", "pix", "debit", "credit", "other"]);
export const entryType = pgEnum("entry_type", ["income", "expense"]);
export const entryStatus = pgEnum("entry_status", ["active", "canceled"]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
};

/** Endereço estruturado (usado na academia, no aluno e no responsável; sai na ficha). */
const address = {
  zip: varchar("zip", { length: 9 }),
  street: varchar("street", { length: 120 }),
  number: varchar("number", { length: 20 }),
  complement: varchar("complement", { length: 60 }),
  district: varchar("district", { length: 60 }),
  city: varchar("city", { length: 80 }),
  state: varchar("state", { length: 2 }),
};

export const academies = pgTable("academies", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 120 }).notNull(),
  active: boolean("active").notNull().default(true),
  document: varchar("document", { length: 18 }), // CPF ou CNPJ, se a academia usar na ficha
  legalName: varchar("legal_name", { length: 160 }), // razão social (contratos), opcional
  ownerName: varchar("owner_name", { length: 120 }), // responsável legal pela academia (contratos), opcional
  phone: varchar("phone", { length: 20 }),
  email: varchar("email", { length: 160 }),
  ...address,
  enrollmentTerms: text("enrollment_terms"), // termos escritos pela academia, impressos na ficha
  // fuso da academia: decide quando uma mensalidade passa a contar como atrasada
  timezone: varchar("timezone", { length: 40 }).notNull().default("America/Sao_Paulo"),
  // chave Pix: gera o "Pix copia e cola" com o valor da mensalidade na área do aluno (sem integração)
  pixKey: varchar("pix_key", { length: 77 }),
  // automação (tarefa diária): gerar as mensalidades do mês sozinho e lembrar o aluno por e-mail
  autoGenerateFees: boolean("auto_generate_fees").notNull().default(true),
  reminderDaysBefore: integer("reminder_days_before").default(3), // null = sem lembrete antes do vencimento
  overdueReminder: boolean("overdue_reminder").notNull().default(true), // um aviso no dia seguinte ao vencimento
  ...timestamps,
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  // null para PLATFORM_ADMIN e STUDENT (o aluno se liga às academias por students.user_id)
  academyId: uuid("academy_id").references(() => academies.id, { onDelete: "cascade" }),
  role: userRole("role").notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  email: varchar("email", { length: 160 }).notNull(),
  passwordHash: text("password_hash").notNull(),
  active: boolean("active").notNull().default(true),
  // conta de aluno criada sem convite: consentimento dado no cadastro (LGPD), copiado para cada
  // vínculo quando o administrador de uma academia adiciona o aluno pelo e-mail da conta
  // telefone e nascimento informados no cadastro sem convite (copiados para o vínculo com a academia)
  phone: varchar("phone", { length: 20 }),
  birthDate: date("birth_date"),
  dataConsentAt: timestamp("data_consent_at", { withTimezone: true }),
  dataConsentText: text("data_consent_text"),
  // administrador da academia: null = acesso total (gerencia a equipe); lista = só o que foi liberado
  permissions: text("permissions").array(),
  // e-mail confirmado pelo link enviado no cadastro (contas antigas foram marcadas como confirmadas)
  emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
  ...timestamps,
}, (t) => [uniqueIndex("users_email_unique").on(sql`lower(${t.email})`)]);

/** Confirmação de e-mail: como na redefinição de senha, só o hash do token fica no banco. */
export const emailVerifications = pgTable("email_verifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Pedidos de redefinição de senha: só o hash do token fica no banco; cada link vale uma vez e por pouco tempo. */
export const passwordResets = pgTable("password_resets", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("password_resets_user_idx").on(t.userId)]);

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(), // só o hash do token fica no banco
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Convites de entrada. O QR Code leva só o token; o servidor descobre a academia.
 * Validade, limite de usos e rótulo já existem para evoluir (convites por turma, individuais...).
 */
export const invites = pgTable("invites", {
  id: uuid("id").primaryKey().defaultRandom(),
  academyId: uuid("academy_id").notNull().references(() => academies.id, { onDelete: "cascade" }),
  token: varchar("token", { length: 40 }).notNull().unique(),
  label: varchar("label", { length: 80 }).notNull().default("Convite geral"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  maxUses: integer("max_uses"),
  usesCount: integer("uses_count").notNull().default(0),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("invites_academy_idx").on(t.academyId)]);

/** Modalidades oferecidas por cada academia. Não são apagadas: desativar tira das listas. */
export const modalities = pgTable("modalities", {
  id: uuid("id").primaryKey().defaultRandom(),
  academyId: uuid("academy_id").notNull().references(() => academies.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 60 }).notNull(),
  defaultFeeCents: integer("default_fee_cents"), // sugerido no cadastro do aluno
  active: boolean("active").notNull().default(true),
  ...timestamps,
}, (t) => [uniqueIndex("modalities_academy_name_unique").on(t.academyId, sql`lower(${t.name})`)]);

/**
 * O "aluno" é o vínculo de uma pessoa com uma academia: guarda os dados da academia
 * (modalidade, mensalidade, status). A conta de acesso, quando existe, fica em users (user_id).
 */
export const students = pgTable("students", {
  id: uuid("id").primaryKey().defaultRandom(),
  academyId: uuid("academy_id").notNull().references(() => academies.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references((): AnyPgColumn => users.id, { onDelete: "set null" }),
  inviteId: uuid("invite_id").references(() => invites.id, { onDelete: "set null" }),
  name: varchar("name", { length: 120 }).notNull(),
  phone: varchar("phone", { length: 20 }),
  email: varchar("email", { length: 160 }),
  birthDate: date("birth_date"),
  // dados da academia: vazios enquanto o pedido está pendente, preenchidos na aprovação
  modalityId: uuid("modality_id").references(() => modalities.id, { onDelete: "restrict" }),
  joinedAt: date("joined_at"),
  status: studentStatus("status").notNull().default("active"),
  monthlyFeeCents: integer("monthly_fee_cents"),
  dueDay: integer("due_day").notNull().default(10), // dia de vencimento padrão
  notes: text("notes"),
  cpf: varchar("cpf", { length: 14 }),
  ...address,
  emergencyName: varchar("emergency_name", { length: 120 }),
  emergencyPhone: varchar("emergency_phone", { length: 20 }),
  emergencyRelation: varchar("emergency_relation", { length: 40 }),
  imageConsent: boolean("image_consent"), // null = ainda não perguntado
  imageConsentAt: timestamp("image_consent_at", { withTimezone: true }),
  // dado sensível (LGPD): só aparece na seção restrita do perfil e só com consentimento
  healthNotes: text("health_notes"),
  healthConsentAt: timestamp("health_consent_at", { withTimezone: true }),
  enrollmentSignedAt: date("enrollment_signed_at"), // ficha de matrícula assinada
  // código pessoal do QR Code de presença (aleatório, sem dados pessoais). null = ainda não gerado.
  // Gerar um novo invalida o anterior.
  checkinCode: varchar("checkin_code", { length: 16 }).unique(),
  checkinCodeCreatedAt: timestamp("checkin_code_created_at", { withTimezone: true }),
  // consentimento dado no cadastro pelo convite (LGPD): quando e qual texto foi aceito
  dataConsentAt: timestamp("data_consent_at", { withTimezone: true }),
  dataConsentText: text("data_consent_text"),
  // direito de eliminação (LGPD): dados pessoais apagados, financeiro mantido de forma anônima
  anonymizedAt: timestamp("anonymized_at", { withTimezone: true }),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  decidedBy: uuid("decided_by").references((): AnyPgColumn => users.id, { onDelete: "set null" }),
  rejectionReason: varchar("rejection_reason", { length: 200 }),
  // vínculo encerrado (hoje: pedido recusado). Fica no histórico e não bloqueia um novo pedido.
  closedAt: timestamp("closed_at", { withTimezone: true }),
  ...timestamps,
}, (t) => [
  // aluno aprovado (ou inativo) sempre tem os dados da academia completos
  check("students_complete_when_approved", sql`${t.status}::text in ('pending', 'rejected') or (${t.modalityId} is not null and ${t.joinedAt} is not null and ${t.monthlyFeeCents} is not null)`),
  // uma conta tem no máximo um vínculo em aberto por academia (vínculos encerrados não contam)
  uniqueIndex("students_user_academy_unique").on(t.userId, t.academyId).where(sql`${t.userId} is not null and ${t.closedAt} is null`),
  index("students_academy_status_idx").on(t.academyId, t.status),
  index("students_academy_name_idx").on(t.academyId, sql`lower(${t.name})`),
  index("students_academy_phone_idx").on(t.academyId, t.phone),
]);

/**
 * Responsável legal de alunos menores. É um cadastro da academia, ligado a um ou mais
 * alunos (irmãos compartilham o mesmo responsável). O principal é o contato de cobrança.
 */
export const guardians = pgTable("guardians", {
  id: uuid("id").primaryKey().defaultRandom(),
  academyId: uuid("academy_id").notNull().references(() => academies.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 120 }).notNull(),
  cpf: varchar("cpf", { length: 14 }),
  phone: varchar("phone", { length: 20 }).notNull(),
  email: varchar("email", { length: 160 }),
  // conta de acesso do responsável (perfil STUDENT): na área dele aparecem os dependentes
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  ...address,
  ...timestamps,
}, (t) => [index("guardians_academy_name_idx").on(t.academyId, sql`lower(${t.name})`)]);

export const studentGuardians = pgTable("student_guardians", {
  studentId: uuid("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  guardianId: uuid("guardian_id").notNull().references(() => guardians.id, { onDelete: "restrict" }),
  relationship: varchar("relationship", { length: 40 }).notNull(), // mãe, pai, avó, tutor...
  isPrimary: boolean("is_primary").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  primaryKey({ columns: [t.studentId, t.guardianId] }),
  uniqueIndex("student_guardians_one_primary").on(t.studentId).where(sql`${t.isPrimary}`), // no máximo um principal
]);

export const fees = pgTable("fees", {
  id: uuid("id").primaryKey().defaultRandom(),
  academyId: uuid("academy_id").notNull().references(() => academies.id, { onDelete: "cascade" }),
  studentId: uuid("student_id").notNull().references(() => students.id, { onDelete: "restrict" }),
  amountCents: integer("amount_cents").notNull(),
  dueDate: date("due_date").notNull(),
  reference: varchar("reference", { length: 7 }).notNull(), // "2026-09"
  status: feeStatus("status").notNull().default("pending"),
  notes: text("notes"),
  ...timestamps,
}, (t) => [
  index("fees_academy_status_due_idx").on(t.academyId, t.status, t.dueDate),
  index("fees_student_idx").on(t.studentId),
  // uma mensalidade ativa por aluno e período (a geração em lote não duplica)
  uniqueIndex("fees_student_reference_unique").on(t.studentId, t.reference).where(sql`${t.status} <> 'canceled'`),
]);

export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  academyId: uuid("academy_id").notNull().references(() => academies.id, { onDelete: "cascade" }),
  studentId: uuid("student_id").notNull().references(() => students.id, { onDelete: "restrict" }),
  feeId: uuid("fee_id").references(() => fees.id, { onDelete: "restrict" }),
  amountCents: integer("amount_cents").notNull(),
  paidAt: date("paid_at").notNull(),
  reference: varchar("reference", { length: 60 }),
  method: paymentMethod("method").notNull(),
  status: paymentStatus("status").notNull().default("paid"),
  notes: text("notes"),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  canceledAt: timestamp("canceled_at", { withTimezone: true }),
  cancelReason: varchar("cancel_reason", { length: 200 }),
  ...timestamps,
}, (t) => [
  index("payments_academy_date_idx").on(t.academyId, t.paidAt),
  index("payments_fee_idx").on(t.feeId),
  index("payments_student_idx").on(t.studentId),
]);

export const financialEntries = pgTable("financial_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  academyId: uuid("academy_id").notNull().references(() => academies.id, { onDelete: "cascade" }),
  type: entryType("type").notNull(),
  category: varchar("category", { length: 40 }).notNull(),
  description: varchar("description", { length: 160 }).notNull(),
  amountCents: integer("amount_cents").notNull(),
  date: date("date").notNull(),
  notes: text("notes"),
  status: entryStatus("status").notNull().default("active"),
  // entrada gerada automaticamente por um pagamento (uma por pagamento: impede contagem dupla)
  paymentId: uuid("payment_id").references(() => payments.id, { onDelete: "restrict" }).unique(),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  ...timestamps,
}, (t) => [index("entries_academy_date_idx").on(t.academyId, t.date)]);

/** Presença: no máximo uma por aluno por dia (marcada pela equipe). */
export const attendances = pgTable("attendances", {
  id: uuid("id").primaryKey().defaultRandom(),
  academyId: uuid("academy_id").notNull().references(() => academies.id, { onDelete: "cascade" }),
  studentId: uuid("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("attendances_student_date").on(t.studentId, t.date), index("attendances_academy_date_idx").on(t.academyId, t.date)]);

/** Lembretes de mensalidade já enviados: no máximo um de cada tipo por mensalidade (a tarefa diária pode rodar várias vezes). */
export const feeReminders = pgTable("fee_reminders", {
  id: uuid("id").primaryKey().defaultRandom(),
  feeId: uuid("fee_id").notNull().references(() => fees.id, { onDelete: "cascade" }),
  kind: varchar("kind", { length: 20 }).notNull(), // "before" | "overdue"
  sentTo: varchar("sent_to", { length: 160 }).notNull(),
  sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("fee_reminders_fee_kind").on(t.feeId, t.kind)]);

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  academyId: uuid("academy_id").references(() => academies.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  action: varchar("action", { length: 60 }).notNull(), // ex.: payment.created
  entity: varchar("entity", { length: 40 }).notNull(),
  entityId: uuid("entity_id"),
  summary: varchar("summary", { length: 240 }).notNull(),
  data: jsonb("data"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("audit_academy_date_idx").on(t.academyId, t.createdAt)]);

/**
 * Logo da academia (identidade dos documentos dela). Uma por academia, guardada no próprio
 * PostgreSQL: funciona em qualquer hospedagem, inclusive com disco efêmero, e entra no backup.
 * Só PNG, JPEG ou WebP conferidos pelo conteúdo (ver lib/image.ts).
 */
export const academyLogos = pgTable("academy_logos", {
  academyId: uuid("academy_id").primaryKey().references(() => academies.id, { onDelete: "cascade" }),
  mime: varchar("mime", { length: 20 }).notNull(),
  data: bytea("data").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  sha256: varchar("sha256", { length: 64 }).notNull(),
  uploadedBy: uuid("uploaded_by").references(() => users.id, { onDelete: "set null" }),
  ...timestamps,
}, (t) => [check("academy_logos_not_empty", sql`octet_length(${t.data}) > 0 and ${t.sizeBytes} > 0`)]);

/** Comunicados da academia para os alunos (mural). Arquivar tira do mural sem apagar. */
export const announcements = pgTable("announcements", {
  id: uuid("id").primaryKey().defaultRandom(),
  academyId: uuid("academy_id").notNull().references(() => academies.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 120 }).notNull(),
  body: text("body").notNull(),
  category: varchar("category", { length: 20 }).notNull().default("geral"), // geral | horario | feriado | evento | graduacao
  pinned: boolean("pinned").notNull().default(false),
  publishedAt: timestamp("published_at", { withTimezone: true }).notNull().defaultNow(),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  ...timestamps,
}, (t) => [index("announcements_academy_idx").on(t.academyId, t.publishedAt)]);

/** Graduações (faixas/cordas/graus) registradas pela academia. Histórico: cada promoção é uma linha. */
export const studentRanks = pgTable("student_ranks", {
  id: uuid("id").primaryKey().defaultRandom(),
  academyId: uuid("academy_id").notNull().references(() => academies.id, { onDelete: "cascade" }),
  studentId: uuid("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  modalityId: uuid("modality_id").references(() => modalities.id, { onDelete: "set null" }),
  rank: varchar("rank", { length: 60 }).notNull(), // ex.: "Faixa azul, 2º grau"
  awardedAt: date("awarded_at").notNull(),
  awardedBy: varchar("awarded_by", { length: 120 }), // professor/mestre que graduou (texto livre)
  notes: varchar("notes", { length: 200 }),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("student_ranks_student_idx").on(t.studentId, t.awardedAt)]);

export const studentsRelations = relations(students, ({ many }) => ({ fees: many(fees), payments: many(payments) }));
export const feesRelations = relations(fees, ({ one, many }) => ({
  student: one(students, { fields: [fees.studentId], references: [students.id] }),
  payments: many(payments),
}));
export const paymentsRelations = relations(payments, ({ one }) => ({
  student: one(students, { fields: [payments.studentId], references: [students.id] }),
  fee: one(fees, { fields: [payments.feeId], references: [fees.id] }),
}));

export type User = typeof users.$inferSelect;
export type Student = typeof students.$inferSelect;
export type Invite = typeof invites.$inferSelect;
export type Modality = typeof modalities.$inferSelect;
export type Guardian = typeof guardians.$inferSelect;
export type Academy = typeof academies.$inferSelect;
export type Fee = typeof fees.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type Announcement = typeof announcements.$inferSelect;
export type StudentRank = typeof studentRanks.$inferSelect;
export type FinancialEntry = typeof financialEntries.$inferSelect;
