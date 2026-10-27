"use client";

import { useState } from "react";

export function InviteTools({ link, academy }: { link: string; academy: string }) {
  const [copied, setCopied] = useState(false);
  const message = `Faça seu cadastro na ${academy} pelo Kombexa: ${link}`;
  return (
    <div className="form-actions no-print">
      <button type="button" className="btn btn--primary" onClick={async () => { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2500); }}>
        {copied ? "Link copiado" : "Copiar link"}
      </button>
      <a className="btn" href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer">Enviar pelo WhatsApp</a>
      <button type="button" className="btn" onClick={() => window.print()}>Imprimir cartaz</button>
    </div>
  );
}
