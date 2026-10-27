/**
 * Marca do produto: Kombexa. É a identidade da PLATAFORMA (login, menu, metadados, rodapé dos
 * documentos). A logo de cada academia é outra coisa e fica em services/branding.ts.
 *
 * Arquivos oficiais: quando existirem, coloque em public/brand/ (ver public/brand/README.md) e
 * defina NEXT_PUBLIC_KOMBEXA_LOGO (ex.: /brand/kombexa-simbolo.svg). Sem eles, usamos o
 * MONOGRAMA PROVISÓRIO abaixo (um "K" no quadrado laranja), que não é o logotipo definitivo.
 */
const OFFICIAL_MARK = process.env.NEXT_PUBLIC_KOMBEXA_LOGO || null;

export function BrandMark({ size = 28 }: { size?: number }) {
  if (OFFICIAL_MARK) {
    // eslint-disable-next-line @next/next/no-img-element -- arquivo estático da marca, tamanho fixo
    return <img src={OFFICIAL_MARK} width={size} height={size} alt="" aria-hidden="true" className="brand-mark" />;
  }
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="brand-mark" data-provisional="true">
      <rect width="32" height="32" rx="7" fill="#FF4B1F" />
      <path d="M10 8h4v6.2L19.6 8h4.8l-6.6 7.4L24.6 24h-4.9l-4.8-6.3-0.9 1V24h-4z" fill="#111315" />
    </svg>
  );
}

export function Brand({ subtitle }: { subtitle?: string }) {
  return (
    <span className="brand">
      <BrandMark />
      <span className="brand-text">
        <span className="brand-name">Kombexa</span>
        {subtitle && <small>{subtitle}</small>}
      </span>
    </span>
  );
}
