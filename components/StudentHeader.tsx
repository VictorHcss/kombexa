import { AppHeader } from "./AppHeader";
import { logout } from "@/app/login/actions";

const LINKS = [
  ["/aluno", "Início"], ["/aluno/frequencia", "Frequência"], ["/aluno/comunicados", "Comunicados"],
  ["/aluno/documentos", "Documentos"], ["/aluno/carteirinha", "Carteirinha"], ["/aluno/conta", "Minha conta"],
] as const;

/** Cabeçalho único da Área do Aluno (mesmos atalhos em todas as páginas). */
export function StudentHeader({ user, current }: { user: string; current: (typeof LINKS)[number][0] }) {
  return <AppHeader user={user} role="Área do aluno" home="/aluno" logout={logout} links={LINKS.map(([href, label]) => ({ href, label, current: href === current }))} />;
}
