"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { initials } from "@/lib/initials";
import { Brand } from "./Brand";
import { ThemeToggle } from "./ThemeToggle";
import { can, hasFullAccess, type Permission } from "@/lib/permissions";

const icon = (d: string, size = 20) => <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true"><path d={d} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>;
const P = {
  home: "M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z",
  users: "M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6M21 19v-1a4 4 0 0 0-3-3.9M16 4.1a3 3 0 0 1 0 5.8",
  calendar: "M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM8 13h3M8 16h6",
  card: "M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 10h18M7 15h4",
  chart: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  check: "M9 11l3 3 8-8M20 12v7a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h11",
  report: "M4 19V5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1zM8 16v-4M12 16V8M16 16v-6",
  inbox: "M4 13h4l1.5 3h5L16 13h4M5 5h14l1 8v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-5z",
  qr: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2M14 18h2M18 18h2v2",
  history: "M3 12a9 9 0 1 0 3-6.7M3 4v4h4M12 8v4l3 2",
  settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z",
  book: "M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5zM4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5",
  plus: "M12 5v14M5 12h14",
  megaphone: "M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1zM15 9a3 3 0 0 1 0 6M18 6a7 7 0 0 1 0 12",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  logout: "M15 17l5-5-5-5M20 12H9M12 20H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7",
};

type Item = { href: string; label: string; icon: keyof typeof P; needs?: Permission };
const GROUPS: { label: string; items: Item[] }[] = [
  { label: "Dia a dia", items: [
    { href: "/", label: "Início", icon: "home", needs: "mensalidades" },
    { href: "/alunos", label: "Alunos", icon: "users", needs: "alunos" },
    { href: "/mensalidades", label: "Mensalidades", icon: "calendar", needs: "mensalidades" },
    { href: "/pagamentos", label: "Pagamentos", icon: "card", needs: "pagamentos" },
    { href: "/presenca", label: "Presença", icon: "check", needs: "presenca" },
    { href: "/financeiro", label: "Financeiro", icon: "chart", needs: "financeiro" },
    { href: "/relatorios", label: "Relatórios", icon: "report", needs: "financeiro" },
  ] },
  { label: "Academia", items: [
    { href: "/solicitacoes", label: "Solicitações", icon: "inbox", needs: "solicitacoes" },
    { href: "/convidar", label: "Convidar alunos", icon: "qr", needs: "solicitacoes" },
    { href: "/comunicados", label: "Comunicados", icon: "megaphone", needs: "comunicados" },
    { href: "/configuracoes", label: "Configurações", icon: "settings" },
  ] },
  { label: "Sistema", items: [
    { href: "/auditoria", label: "Auditoria", icon: "history", needs: "auditoria" },
    { href: "/documentacao", label: "Documentação", icon: "book" },
  ] },
];


/** Moldura: menu lateral no computador; no celular, barra inferior com o principal e "Mais" para o resto. */
export function Shell({ academy, user, logout, requests, permissions, children }: { academy: string; user: string; logout: () => void; requests: number; permissions: Permission[] | null; children: ReactNode }) {
  const allowed = (p?: Permission) => !p || can(permissions, p);
  const groups = GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => allowed(i.needs)) })).filter((g) => g.items.length);
  const role = hasFullAccess(permissions) ? "Acesso total" : "Equipe";
  // barra inferior: até 4 atalhos do que a pessoa usa, com o pagamento no meio quando ela pode registrar
  const tabs = [
    allowed("mensalidades") && { href: "/", label: "Início", icon: P.home },
    allowed("alunos") && { href: "/alunos", label: "Alunos", icon: P.users },
    allowed("pagamentos") && { href: "/pagamentos/novo", label: "Pagamento", icon: P.plus, main: true },
    allowed("mensalidades") && { href: "/mensalidades", label: "Mensalidades", icon: P.calendar },
    !allowed("mensalidades") && allowed("pagamentos") && { href: "/pagamentos", label: "Pagamentos", icon: P.card },
    !allowed("mensalidades") && allowed("presenca") && { href: "/presenca", label: "Presença", icon: P.check },
    !allowed("mensalidades") && allowed("financeiro") && { href: "/financeiro", label: "Financeiro", icon: P.chart },
  ].filter(Boolean).slice(0, 4) as { href: string; label: string; icon: string; main?: boolean }[];
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [lastPath, setLastPath] = useState(path);
  if (path !== lastPath) {
    setLastPath(path);
    setOpen(false); // mudou de página: fecha o menu
  }
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  const inMore = !tabs.some((t) => (t.href === "/" ? path === "/" : path.startsWith(t.href)));

  return (
    <div className="shell">
      <header className="topbar">
        <Link href="/" className="brand-link"><Brand subtitle={academy} /></Link>
        {/* key: a cada página nova o menu volta fechado */}
        <details className="user-menu" key={path}>
          <summary aria-label={`Conta de ${user}`}><span className="avatar avatar--small" aria-hidden="true">{initials(user)}</span></summary>
          <div className="user-menu-panel">
            <p className="user-menu-who"><strong>{user}</strong><small>{role} · {academy}</small></p>
            <Link href="/configuracoes?aba=acesso">{icon(P.settings, 18)}Minha senha e acessos</Link>
            <div className="user-menu-theme"><span>Tema</span><ThemeToggle /></div>
            <form action={logout}><button type="submit">{icon(P.logout, 18)}Sair</button></form>
          </div>
        </details>
      </header>
      <aside id="nav" className={`sidebar${open ? " is-open" : ""}`} aria-label="Menu">
        <div className="sidebar-brand"><Link href="/" className="brand-link"><Brand subtitle={academy} /></Link></div>
        {allowed("pagamentos") && <Link href="/pagamentos/novo" className="btn btn--primary sidebar-cta">{icon(P.plus, 18)}Registrar pagamento</Link>}
        <nav aria-label="Principal" className="sidebar-nav">
          {groups.map((group) => (
            <div key={group.label} className="nav-group">
              <p className="nav-group-label">{group.label}</p>
              {group.items.map((item) => (
                <Link key={item.href} href={item.href} aria-current={active(item.href) ? "page" : undefined}>
                  {icon(P[item.icon])}
                  <span>{item.label}</span>
                  {item.href === "/solicitacoes" && requests > 0 && <span className="nav-badge" aria-label={`${requests} pendentes`}>{requests}</span>}
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-theme"><ThemeToggle className="theme-toggle--on-dark" /></div>
        <form action={logout} className="sidebar-user">
          <span className="avatar" aria-hidden="true">{initials(user)}</span>
          <span className="sidebar-user-text"><strong>{user}</strong><small>{role}</small></span>
          <button type="submit" className="icon-button" aria-label="Sair" title="Sair">{icon(P.logout)}</button>
        </form>
      </aside>
      {open && <button type="button" className="scrim" aria-label="Fechar menu" onClick={() => setOpen(false)} />}
      <main className="content">{children}</main>
      <nav className="tabbar" aria-label="Atalhos" style={{ gridTemplateColumns: `repeat(${tabs.length + 1}, 1fr)` }}>
        {tabs.map((t) => (
          <Link key={t.href} href={t.href} className={t.main ? "tabbar-main" : undefined}
            aria-current={(t.href === "/" || t.main ? path === t.href : path.startsWith(t.href)) ? "page" : undefined}>{icon(t.icon, 22)}<span>{t.label}</span></Link>
        ))}
        <button type="button" aria-expanded={open} aria-controls="nav" className={inMore ? "is-current" : undefined} onClick={() => setOpen((o) => !o)}>
          {icon(P.more, 22)}<span>Mais</span>{requests > 0 && <span className="tab-dot" aria-label={`${requests} solicitações`} />}
        </button>
      </nav>
    </div>
  );
}
