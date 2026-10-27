import type { MetadataRoute } from "next";

/** Instalar no celular ("Adicionar à tela de início"): abre como app, sem a barra do navegador. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Kombexa",
    short_name: "Kombexa",
    description: "Kombexa: gestão para academias de artes marciais e esportes de combate.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#111315",
    theme_color: "#111315",
    lang: "pt-BR",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Registrar pagamento", url: "/pagamentos/novo" },
      { name: "Minha área (aluno)", url: "/aluno" },
    ],
  };
}
