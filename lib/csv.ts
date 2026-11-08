/**
 * CSV para abrir no Excel em português: separador ";" (o Excel brasileiro usa a vírgula
 * como decimal), BOM no início para os acentos aparecerem certos e aspas quando preciso.
 */
type Cell = string | number | null | undefined;

/** Número no formato do csvMoney ("1234,56", "-5,00"): fica como está para o Excel somar. */
const NUMERIC = /^[-+]?\d+(,\d+)?$/;

/**
 * Injeção de fórmula (OWASP "CSV Injection"): texto que começa com = + - @ (ou tabulação/retorno)
 * vira fórmula no Excel. Nomes e observações podem vir do cadastro público pelo convite, então
 * esses textos ganham um apóstrofo na frente e aparecem como texto. Números não são alterados.
 */
const neutralize = (text: string) => (/^[=+\-@\t\r]/.test(text) && !NUMERIC.test(text) ? `'${text}` : text);

const escape = (value: Cell) => {
  const text = value === null || value === undefined ? "" : typeof value === "number" ? String(value) : neutralize(String(value));
  return /[";\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** Centavos em "1234,56", sem "R$": o Excel reconhece como número e dá para somar. */
export const csvMoney = (cents: number) => (cents / 100).toFixed(2).replace(".", ",");

export function toCsv(header: string[], rows: Cell[][]): string {
  return "\uFEFF" + [header, ...rows].map((r) => r.map(escape).join(";")).join("\r\n") + "\r\n";
}

export function csvResponse(fileName: string, body: string): Response {
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
