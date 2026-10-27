"use client";

import { useSyncExternalStore } from "react";
import { THEME_COOKIE, type ThemeChoice } from "@/lib/theme";

/**
 * Preferência de tema por aparelho: claro, escuro ou seguir o sistema. Fica num cookie
 * (lido antes da primeira pintura pelo script em app/layout.tsx, sem "piscar") e vale para
 * todas as áreas: equipe, aluno e plataforma.
 */

const listeners = new Set<() => void>();
function read(): ThemeChoice {
  const m = document.cookie.match(new RegExp(`(?:^|; )${THEME_COOKIE}=(light|dark)`));
  return (m?.[1] as ThemeChoice) ?? "system";
}
function apply(choice: ThemeChoice) {
  if (choice === "system") {
    delete document.documentElement.dataset.theme;
    document.cookie = `${THEME_COOKIE}=; path=/; max-age=0; samesite=lax`;
  } else {
    document.documentElement.dataset.theme = choice;
    document.cookie = `${THEME_COOKIE}=${choice}; path=/; max-age=31536000; samesite=lax`;
  }
  listeners.forEach((l) => l());
}

const OPTIONS: [ThemeChoice, string][] = [["light", "Claro"], ["dark", "Escuro"], ["system", "Sistema"]];

export function ThemeToggle({ className = "" }: { className?: string }) {
  const current = useSyncExternalStore((cb) => { listeners.add(cb); return () => listeners.delete(cb); }, read, () => "system" as ThemeChoice);
  return (
    <div className={`theme-toggle ${className}`} role="group" aria-label="Tema da interface">
      {OPTIONS.map(([value, label]) => (
        <button key={value} type="button" aria-pressed={current === value} onClick={() => apply(value)}>{label}</button>
      ))}
    </div>
  );
}

