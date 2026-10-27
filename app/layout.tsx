import type { Metadata, Viewport } from "next";
import "@fontsource-variable/manrope"; // fontes auto-hospedadas: não dependem de internet no build
import "@fontsource/barlow-condensed/600.css"; // títulos e números (placar)
import "@fontsource/barlow-condensed/700.css";
import "./globals.css";
import { THEME_BOOT_SCRIPT } from "@/lib/theme";

export const metadata: Metadata = {
  title: { default: "Kombexa", template: "%s | Kombexa" },
  description: "Kombexa: gestão para academias de artes marciais e esportes de combate. Alunos, mensalidades, presença, documentos e Área do Aluno.",
  applicationName: "Kombexa",
  robots: { index: false, follow: false }, // sistema interno: não aparece em buscadores
  appleWebApp: { capable: true, title: "Kombexa", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  width: "device-width", initialScale: 1,
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#111315" }, { media: "(prefers-color-scheme: dark)", color: "#0b0c0e" }],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: o script abaixo ajusta data-theme antes do React (preferência de tema)
    <html lang="pt-BR" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} /></head>
      <body>{children}</body>
    </html>
  );
}
