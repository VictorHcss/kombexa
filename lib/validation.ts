/**
 * Validações de entrada (servidor). Recebem os campos como texto, exatamente
 * como chegam dos formulários, e devolvem dados tipados ou mensagens em português.
 */
import { z } from "zod";
import { isBrazilTimezone } from "./dates";
import { ALL_PERMISSIONS, type Permission } from "./permissions";
import { isValidDate, isValidReference, today } from "./dates";
import { formatCpf, isValidCnpj, isValidCpf } from "./cpf";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "./labels";
import { parseMoney } from "./money";

const text = (max: number) => z.string().trim().max(max, `Use no máximo ${max} caracteres.`);
const optionalText = (max: number) => text(max).optional().transform((v) => (v ? v : null));
const requiredText = (label: string, max: number) => text(max).min(1, `Informe ${label}.`);

const money = (label: string, { allowZero = false } = {}) =>
  z.string().trim().min(1, `Informe ${label}.`).transform((v, ctx) => {
    const cents = parseMoney(v);
    if (cents === null) {
      ctx.addIssue({ code: "custom", message: "Valor inválido. Use o formato 150,00." });
      return z.NEVER;
    }
    if (!allowZero && cents <= 0) {
      ctx.addIssue({ code: "custom", message: "O valor precisa ser maior que zero." });
      return z.NEVER;
    }
    return cents;
  });

const dateField = (label: string) =>
  z.string().trim().min(1, `Informe ${label}.`).refine(isValidDate, "Data inválida.");

const phone = z.string().trim().optional().transform((v) => (v ? v : null))
  .refine((v) => v === null || /^[\d\s()+-]{8,20}$/.test(v), "Telefone inválido. Use só números, espaços, parênteses e traço.")
  .refine((v) => v === null || v.replace(/\D/g, "").length >= 8, "Telefone muito curto.");
const email = z.string().trim().optional().transform((v) => (v ? v.toLowerCase() : null))
  .refine((v) => v === null || z.email().safeParse(v).success, "E-mail inválido.");

const UF = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];
const optionalCpf = z.string().trim().optional().transform((v) => (v ? formatCpf(v) : null))
  .refine((v) => v === null || isValidCpf(v), "CPF inválido. Confira os números.");

/** Endereço: todos os campos opcionais, mas CEP e UF são conferidos quando preenchidos. */
export const addressFields = {
  zip: z.string().trim().optional().transform((v) => (v ? v.replace(/\D/g, "").replace(/^(\d{5})(\d{3})$/, "$1-$2") : null))
    .refine((v) => v === null || /^\d{5}-\d{3}$/.test(v), "CEP inválido. Use 8 números."),
  street: optionalText(120),
  number: optionalText(20),
  complement: optionalText(60),
  district: optionalText(60),
  city: optionalText(80),
  state: z.string().trim().toUpperCase().optional().transform((v) => (v ? v : null)).refine((v) => v === null || UF.includes(v), "UF inválida."),
};

const guardianFields = {
  guardianId: z.string().trim().optional().transform((v) => (v ? v : null)),
  guardianName: optionalText(120),
  guardianCpf: optionalCpf,
  guardianPhone: phone,
  guardianEmail: email,
  guardianRelationship: optionalText(40),
};

export const studentInput = z.object({
  name: requiredText("o nome completo", 120).refine((v) => v.includes(" ") || v.length >= 3, "Informe o nome completo."),
  phone,
  email,
  birthDate: dateField("a data de nascimento"),
  cpf: optionalCpf,
  ...addressFields,
  modalityId: z.uuid("Escolha a modalidade."),
  joinedAt: dateField("a data de entrada"),
  status: z.enum(["active", "inactive"], { message: "Status inválido." }),
  monthlyFee: money("o valor mensal"),
  dueDay: z.coerce.number({ message: "Dia inválido." }).int().min(1, "Use um dia entre 1 e 31.").max(31, "Use um dia entre 1 e 31."),
  notes: optionalText(1000),
  emergencyName: optionalText(120),
  emergencyPhone: phone,
  emergencyRelation: optionalText(40),
  imageConsent: z.enum(["sim", "nao", ""]).optional().transform((v) => (v === "sim" ? true : v === "nao" ? false : null)),
  ...guardianFields,
}).refine((s) => s.birthDate <= s.joinedAt, { message: "A data de nascimento precisa ser anterior à entrada.", path: ["birthDate"] })
  .refine((s) => !s.emergencyName === !s.emergencyPhone, { message: "Informe nome e telefone do contato de emergência.", path: ["emergencyPhone"] });

/** Responsável (adicionar ou editar pelo perfil do aluno). */
export const guardianInput = z.object({
  guardianId: z.string().trim().optional().transform((v) => (v ? v : null)),
  name: requiredText("o nome do responsável", 120),
  cpf: optionalCpf,
  phone: z.string().trim().min(1, "Informe o telefone do responsável.")
    .refine((v) => /^[\d\s()+-]{8,20}$/.test(v) && v.replace(/\D/g, "").length >= 10, "Telefone inválido. Inclua o DDD."),
  email,
  relationship: requiredText("o parentesco", 40),
  isPrimary: z.string().optional().transform((v) => v === "on" || v === "true"),
  ...addressFields,
});

/** Dados da academia (Configurações). */
export const academyInput = z.object({
  name: requiredText("o nome da academia", 120),
  legalName: optionalText(160),
  ownerName: optionalText(120),
  document: z.string().trim().optional().transform((v) => (v ? v : null)).refine((v) => {
    if (v === null) return true;
    const d = v.replace(/\D/g, "");
    return (d.length === 11 && isValidCpf(d)) || (d.length === 14 && isValidCnpj(d));
  }, "CPF ou CNPJ inválido."),
  phone,
  email,
  ...addressFields,
  timezone: z.string().optional().transform((v) => v || "America/Sao_Paulo").refine(isBrazilTimezone, "Escolha um fuso da lista."),
  autoGenerateFees: z.string().optional().transform((v) => v === "on"),
  overdueReminder: z.string().optional().transform((v) => v === "on"),
  reminderDaysBefore: z.string().optional().transform((v) => (v && v !== "0" ? Number(v) : null))
    .refine((v) => v === null || [1, 2, 3, 5, 7].includes(v), "Escolha uma opção da lista."),
  pixKey: z.string().trim().optional().transform((v) => (v ? normalizePixKey(v) : null))
    .refine((v) => v === null || v.length > 0, "Chave Pix inválida. Use CPF, CNPJ, e-mail, celular com DDD ou a chave aleatória."),
});

/**
 * Normaliza a chave Pix como o Banco Central espera no código "copia e cola":
 * CPF/CNPJ só com números, celular como +55DDDNÚMERO, e-mail em minúsculas e chave aleatória (UUID) como está.
 * Devolve "" se não reconhecer o formato.
 */
export function normalizePixKey(raw: string): string {
  const v = raw.trim();
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)) return v.toLowerCase();
  if (v.includes("@")) return z.email().safeParse(v.toLowerCase()).success && v.length <= 77 ? v.toLowerCase() : "";
  const digits = v.replace(/\D/g, "");
  if (v.startsWith("+") || /[()\s]/.test(v)) {
    const local = digits.startsWith("55") && digits.length >= 12 ? digits.slice(2) : digits;
    return local.length === 10 || local.length === 11 ? `+55${local}` : "";
  }
  if (digits.length === 11 && isValidCpf(digits)) return digits;
  if (digits.length === 14 && isValidCnpj(digits)) return digits;
  if (digits.length === 11 || digits.length === 13) return `+55${digits.length === 13 ? digits.slice(2) : digits}`; // celular sem formatação
  return "";
}

export const modalityInput = z.object({
  name: requiredText("o nome da modalidade", 60),
  defaultFee: z.string().trim().optional().transform((v, ctx) => {
    if (!v) return null;
    const cents = parseMoney(v);
    if (cents === null || cents <= 0) { ctx.addIssue({ code: "custom", message: "Valor inválido. Use o formato 150,00." }); return z.NEVER; }
    return cents;
  }),
});

export const feeInput = z.object({
  studentId: z.uuid("Escolha o aluno."),
  amount: money("o valor"),
  dueDate: dateField("o vencimento"),
  reference: z.string().trim().refine(isValidReference, "Período de referência inválido."),
  notes: optionalText(500),
});

export const feeUpdateInput = feeInput.omit({ studentId: true });

export const paymentInput = z.object({
  studentId: z.uuid("Escolha o aluno."),
  feeId: z.string().trim().optional().transform((v) => (v ? v : null)).refine((v) => v === null || z.uuid().safeParse(v).success, "Mensalidade inválida."),
  amount: money("o valor"),
  paidAt: dateField("a data do pagamento"),
  method: z.enum(["cash", "pix", "debit", "credit", "other"], { message: "Escolha a forma de pagamento." }),
  status: z.enum(["paid", "pending"], { message: "Status inválido." }),
  reference: optionalText(60),
  notes: optionalText(500),
});

export const entryInput = z.object({
  type: z.enum(["income", "expense"], { message: "Escolha entrada ou saída." }),
  category: z.string().trim().min(1, "Escolha a categoria."),
  description: requiredText("a descrição", 160),
  amount: money("o valor"),
  date: dateField("a data"),
  notes: optionalText(500),
}).refine((e) => (e.type === "income" ? (INCOME_CATEGORIES as readonly string[]) : (EXPENSE_CATEGORIES as readonly string[])).includes(e.category), {
  message: "Categoria inválida para esse tipo de lançamento.", path: ["category"],
});

export const userInput = z.object({
  name: requiredText("o nome", 120),
  email: z.string().trim().toLowerCase().pipe(z.email("E-mail inválido.")),
  password: z.string().min(10, "A senha precisa ter pelo menos 10 caracteres.").max(200),
});

/**
 * Permissões vindas do formulário da equipe: "access" = "full" (acesso total) ou "custom"
 * com uma caixa "perm_<chave>" para cada permissão. Dados de saúde exigem acesso a alunos.
 * Devolve null para acesso total, a lista para acesso personalizado, ou um erro.
 */
export function permissionsFromForm(form: FormData): { permissions: Permission[] | null } | { error: string } {
  if (form.get("access") !== "custom") return { permissions: null };
  const chosen = ALL_PERMISSIONS.filter((p) => form.get(`perm_${p}`) === "on");
  if (chosen.includes("saude") && !chosen.includes("alunos")) chosen.unshift("alunos");
  if (!chosen.length) return { error: "Marque pelo menos uma área que a pessoa pode acessar." };
  return { permissions: chosen };
}

export const passwordChangeInput = z.object({
  current: z.string().min(1, "Informe a senha atual."),
  next: z.string().min(10, "A nova senha precisa ter pelo menos 10 caracteres.").max(200),
  confirm: z.string(),
}).refine((p) => p.next === p.confirm, { message: "As senhas não conferem.", path: ["confirm"] });

/** Converte o erro do Zod em { campo: mensagem } para mostrar ao lado de cada campo. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}

export function formToObject(form: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (typeof v === "string") out[k] = v;
  return out;
}

/** Idade completa em uma data (YYYY-MM-DD), sem depender de fuso. */
export function ageOn(birthDate: string, on: string): number {
  const [by, bm, bd] = birthDate.split("-").map(Number);
  const [y, m, d] = on.split("-").map(Number);
  return y - by - (m < bm || (m === bm && d < bd) ? 1 : 0);
}

/**
 * Cadastro pelo convite (conta do aluno). Só para maiores de 18 anos: menores
 * continuam sendo cadastrados pelo administrador (LGPD exige cuidado com dados de menores).
 */
export const signupInput = z.object({
  name: requiredText("seu nome completo", 120).refine((v) => v.trim().includes(" "), "Informe nome e sobrenome."),
  phone: z.string().trim().min(1, "Informe seu telefone.")
    .refine((v) => /^[\d\s()+-]{8,20}$/.test(v) && v.replace(/\D/g, "").length >= 10, "Telefone inválido. Inclua o DDD."),
  email: z.string().trim().toLowerCase().pipe(z.email("E-mail inválido.")),
  birthDate: dateField("sua data de nascimento"),
  password: z.string().min(10, "A senha precisa ter pelo menos 10 caracteres.").max(200),
  confirm: z.string(),
  consent: z.literal("on", { message: "É preciso concordar com o uso dos dados pela academia." }),
}).refine((d) => d.password === d.confirm, { message: "As senhas não conferem.", path: ["confirm"] })
  .refine((d) => !isValidDate(d.birthDate) || ageOn(d.birthDate, today()) >= 18, {
    message: "O cadastro pelo convite é para maiores de 18 anos. Menores de idade são cadastrados pela recepção da academia.", path: ["birthDate"],
  })
  .refine((d) => !isValidDate(d.birthDate) || d.birthDate > "1900-01-01", { message: "Data de nascimento inválida.", path: ["birthDate"] });

/** Aprovação do pedido: o administrador completa os dados da academia. */
export const approvalInput = z.object({
  modalityId: z.uuid("Escolha a modalidade."),
  joinedAt: dateField("a data de início"),
  monthlyFee: money("o valor mensal"),
  dueDay: z.coerce.number({ message: "Dia inválido." }).int().min(1, "Use um dia entre 1 e 31.").max(31, "Use um dia entre 1 e 31."),
  notes: optionalText(1000),
});

/**
 * Conta de aluno criada pela tela "Criar conta", sem convite. A conta fica sem academia
 * até o administrador de uma academia adicionar o aluno pelo e-mail. Mesmas regras do convite
 * (maiores de 18 anos, senha de 10+ caracteres), com o consentimento da conta.
 */
export const studentAccountInput = signupInput;

/** Nova academia, criada pelo administrador da plataforma. O responsável define a senha pelo link enviado por e-mail. */
export const platformAcademyInput = z.object({
  academyName: requiredText("o nome da academia", 120).refine((v) => v.length >= 3, "Use pelo menos 3 caracteres."),
  adminName: requiredText("o nome do responsável", 120).refine((v) => v.trim().includes(" "), "Informe nome e sobrenome."),
  adminEmail: z.string().trim().toLowerCase().pipe(z.email("E-mail inválido.")),
});

/** Administrador da academia adiciona um aluno que já tem conta, pelo e-mail da conta. */
export const addByEmailInput = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("E-mail inválido.")),
});

/** Extrai o token de um código de convite digitado ou de um link colado (…/convite/TOKEN). */
export function inviteTokenFrom(input: string): string | null {
  const value = input.trim();
  const fromLink = value.match(/\/convite\/([A-Za-z0-9_-]{16,40})/);
  const token = fromLink ? fromLink[1] : value;
  return /^[A-Za-z0-9_-]{16,40}$/.test(token) ? token : null;
}

/** Área do aluno: o próprio aluno atualiza o telefone de contato (vai para todas as academias dele). */
export const ownContactInput = z.object({
  phone: z.string().trim().min(1, "Informe seu telefone.")
    .refine((v) => /^[\d\s()+-]{8,20}$/.test(v) && v.replace(/\D/g, "").length >= 10, "Telefone inválido. Inclua o DDD."),
});

export const announcementInput = z.object({
  title: requiredText("o título", 120),
  body: requiredText("o texto do comunicado", 4000),
  category: z.enum(["geral", "horario", "feriado", "evento", "graduacao"], { message: "Escolha uma categoria." }),
  pinned: z.string().optional().transform((v) => v === "on"),
});

/** Graduação (faixa, corda, grau). A data não pode estar no futuro (conferido no serviço, pelo fuso da academia). */
export const rankInput = z.object({
  rank: requiredText("a graduação", 60),
  awardedAt: z.string().refine(isValidDate, "Informe uma data válida."),
  modalityId: z.string().optional().transform((v) => (v ? v : null)),
  awardedBy: optionalText(120),
  notes: optionalText(200),
});

/** Código do QR Code de presença, digitado ou lido por leitor (aceita com ou sem o prefixo e os traços). */
export function normalizeCheckinCode(raw: string): string | null {
  const v = raw.trim().toUpperCase().replace(/^KBX1[:\s-]*/, "").replace(/[\s-]/g, "");
  return /^[0-9A-HJKMNP-TV-Z]{12}$/.test(v) ? v : null;
}
