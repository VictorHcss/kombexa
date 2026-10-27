/**
 * Contas de teste criadas pelo seed (npm run db:seed), uma para cada tipo de usuário.
 * São só para desenvolvimento e demonstração: as senhas são públicas.
 * A tela de login mostra estas contas quando SHOW_TEST_ACCOUNTS permite (ver showTestAccounts).
 */
export const TEST_PASSWORD = "kombexa123";

export interface TestAccount {
  email: string;
  role: "PLATFORM_ADMIN" | "ACADEMY_ADMIN" | "STUDENT";
  label: string;
  description: string;
}

export const TEST_ACCOUNTS: TestAccount[] = [
  { email: "admin@academia.dev", role: "ACADEMY_ADMIN", label: "Administrador da academia", description: "Painel completo: alunos, mensalidades, pagamentos e financeiro." },
  { email: "recepcao@academia.dev", role: "ACADEMY_ADMIN", label: "Equipe com acesso personalizado", description: "Recepção: alunos, mensalidades, pagamentos e solicitações; sem financeiro nem saúde." },
  { email: "aluno@academia.dev", role: "STUDENT", label: "Aluno aprovado", description: "Área do aluno com mensalidades, pagamentos e recibos." },
  { email: "responsavel@academia.dev", role: "STUDENT", label: "Responsável com acesso", description: "Mãe de dois alunos menores: vê situação, Pix e recibos dos dependentes." },
  { email: "pendente@academia.dev", role: "STUDENT", label: "Aluno aguardando aprovação", description: "Pediu para entrar pelo convite; aparece em Solicitações." },
  { email: "semacademia@academia.dev", role: "STUDENT", label: "Aluno sem academia", description: "Criou a conta sozinho; a academia pode adicioná-lo pelo e-mail." },
  { email: "plataforma@kombexa.dev", role: "PLATFORM_ADMIN", label: "Administrador da plataforma", description: "Visão de todas as academias cadastradas." },
];

/**
 * Mostra as contas de teste no login?
 *   SHOW_TEST_ACCOUNTS=true  → sempre mostra (ex.: demonstração no Docker)
 *   SHOW_TEST_ACCOUNTS=false → nunca mostra
 *   sem a variável            → mostra só em desenvolvimento (npm run dev)
 * Mesmo ligado, só aparecem as contas que existem no banco.
 */
export function showTestAccounts(): boolean {
  const flag = process.env.SHOW_TEST_ACCOUNTS;
  if (flag === "true") return true;
  if (flag === "false") return false;
  return process.env.NODE_ENV !== "production";
}
