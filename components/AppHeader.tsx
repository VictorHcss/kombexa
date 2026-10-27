import Link from "next/link";
import { Brand } from "./Brand";
import { ThemeToggle } from "./ThemeToggle";
import { initials } from "@/lib/initials";

type HeaderLink = { href: string; label: string; current?: boolean };

/** Cabeçalho das áreas sem menu lateral (aluno e plataforma): marca, atalhos, quem está conectado e Sair. */
export function AppHeader({ user, role, home, logout, links = [] }: { user: string; role: string; home: string; logout: () => void; links?: HeaderLink[] }) {
  return (
    <header className="app-header">
      <Link href={home} className="brand-link"><Brand subtitle={role} /></Link>
      {links.length > 0 && (
        <nav className="app-header-nav" aria-label="Atalhos">
          {links.map((l) => <Link key={l.href} href={l.href} aria-current={l.current ? "page" : undefined}>{l.label}</Link>)}
        </nav>
      )}
      <div className="app-header-user">
        <span className="avatar avatar--small" aria-hidden="true">{initials(user)}</span>
        <span className="app-header-name">{user}</span>
        <ThemeToggle className="theme-toggle--on-dark" />
        <form action={logout}><button type="submit" className="btn btn--small btn--on-dark">Sair</button></form>
      </div>
    </header>
  );
}
