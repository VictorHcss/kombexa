import type { NextConfig } from "next";

const production = process.env.NODE_ENV === "production";

/**
 * Cabeçalhos de segurança em todas as respostas.
 * - CSP: só recursos do próprio sistema. O Next.js injeta scripts inline, por isso 'unsafe-inline';
 *   em desenvolvimento ele também precisa de 'unsafe-eval' (recarregamento rápido).
 * - frame-ancestors 'none' + X-Frame-Options: ninguém coloca o sistema dentro de um iframe (clickjacking).
 * - HSTS só em produção: o navegador passa a usar sempre HTTPS.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${production ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self'${production ? "" : " ws: wss:"}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ...(production ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }] : []),
];

const config: NextConfig = {
  poweredByHeader: false,
  // upload da logo da academia (até 1 MB, validado no servidor): folga para o resto do formulário
  experimental: { serverActions: { bodySizeLimit: "2mb" } },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default config;
