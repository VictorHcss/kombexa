import { formatAddress } from "./AddressFields";

export interface DocumentAcademy {
  name: string;
  legalName?: string | null;
  document?: string | null;
  phone?: string | null;
  email?: string | null;
  zip?: string | null; street?: string | null; number?: string | null; complement?: string | null;
  district?: string | null; city?: string | null; state?: string | null;
}

/**
 * Cabeçalho dos documentos da academia (ficha, contrato, recibo).
 * A identidade é da ACADEMIA: a logo dela quando cadastrada; sem logo, o nome em destaque.
 * A marca Kombexa não aparece aqui (fica só no rodapé, como sistema emissor).
 */
export function DocumentHeader({ academy, logo }: { academy: DocumentAcademy; logo: string | null }) {
  const contact = [academy.document && `${academy.document.replace(/\D/g, "").length === 14 ? "CNPJ" : "CPF"} ${academy.document}`, academy.phone, academy.email].filter(Boolean).join(" · ");
  const address = formatAddress(academy);
  return (
    <header className={`sheet-head${logo ? " has-logo" : ""}`}>
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element -- logo da academia embutida como data: URL (imprime sem depender de rota)
        <img src={logo} alt={`Logo da ${academy.name}`} className="sheet-logo" />
      ) : (
        <span className="sheet-monogram" aria-hidden="true">{monogram(academy.name)}</span>
      )}
      <div>
        <strong>{academy.name}</strong>
        {academy.legalName && academy.legalName !== academy.name && <span>{academy.legalName}</span>}
        {contact && <span>{contact}</span>}
        {address && <span>{address}</span>}
      </div>
    </header>
  );
}

/** Identificação discreta da plataforma, no pé do documento. */
export function DocumentFooter({ note }: { note?: string }) {
  return (
    <footer className="sheet-foot">
      {note && <span>{note}</span>}
      <span className="sheet-foot-system">Documento gerado pelo Kombexa · sistema de gestão da academia</span>
    </footer>
  );
}

/** Iniciais do nome da academia (até 2 letras), usadas quando não há logo. */
export function monogram(name: string): string {
  const words = name.replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter((w) => w.length > 2 || /^\p{Lu}/u.test(w));
  const letters = (words.length ? words : [name]).slice(0, 2).map((w) => w[0]).join("");
  return letters.toUpperCase() || "A";
}
