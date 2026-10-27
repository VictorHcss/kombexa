import { formatAddress } from "./AddressFields";
import { DocumentFooter, DocumentHeader } from "./DocumentHeader";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { isMinor } from "@/services/guardians";
import type { EnrollmentDocumentData } from "@/services/documents";

/**
 * Ficha de matrícula e contrato de prestação de serviços: dados do aluno, do responsável,
 * da matrícula, os termos escritos pela academia e as assinaturas. Mesma folha para a equipe
 * (imprimir) e para o aluno (consultar). Assinatura: só é exibida como registrada se houver data.
 */
export function EnrollmentDocument({ doc }: { doc: EnrollmentDocumentData }) {
  const { academy, logo, student: s, guardians, terms, health } = doc;
  const minor = isMinor(s.birthDate);
  const primary = guardians.find((g) => g.isPrimary);
  const signer = minor && primary ? primary : null;
  const contractor = academy.legalName || academy.name;
  const line = (label: string, value: string | null | undefined) => <div className="sheet-field"><span>{label}</span><strong>{value || "\u00a0"}</strong></div>;

  return (
    <article className="sheet">
      <DocumentHeader academy={academy} logo={logo} />
      <h1>Ficha de matrícula e contrato de prestação de serviços</h1>
      {doc.signedAt && <p className="sheet-signed">Assinatura registrada pela academia em {formatDate(doc.signedAt)}.</p>}

      <h2>Contratada</h2>
      <div className="sheet-grid">
        {line("Academia", contractor)}{line("CPF/CNPJ", academy.document)}
        {line("Responsável", academy.ownerName)}{line("Endereço", formatAddress(academy))}
      </div>

      <h2>Aluno</h2>
      <div className="sheet-grid">
        {line("Nome", s.name)}{line("Data de nascimento", formatDate(s.birthDate))}
        {line("CPF", s.cpf)}{line("Telefone", s.phone)}
        {line("E-mail", s.email)}{line("Endereço", formatAddress(s))}
      </div>

      {guardians.length > 0 && (
        <>
          <h2>{guardians.length > 1 ? "Responsáveis" : "Responsável legal"}</h2>
          {guardians.map((g) => (
            <div key={g.id} className="sheet-grid">
              {line(g.isPrimary ? "Responsável principal" : "Responsável", `${g.name} (${g.relationship})`)}{line("CPF", g.cpf)}
              {line("Telefone", g.phone)}{line("E-mail", g.email)}
              {g.isPrimary && line("Endereço", formatAddress(g))}
            </div>
          ))}
        </>
      )}

      <h2>Matrícula</h2>
      <div className="sheet-grid">
        {line("Modalidade", s.modality)}{line("Data de início", formatDate(s.joinedAt))}
        {line("Mensalidade", s.monthlyFeeCents === null ? null : formatMoney(s.monthlyFeeCents))}{line("Vencimento", `Todo dia ${s.dueDay}`)}
      </div>

      <h2>Emergência e imagem</h2>
      <div className="sheet-grid">
        {line("Contato de emergência", s.emergencyName ? `${s.emergencyName}${s.emergencyRelation ? ` (${s.emergencyRelation})` : ""}` : null)}{line("Telefone", s.emergencyPhone)}
      </div>
      <p className="sheet-check">
        <span>{s.imageConsent === true ? "☒" : "☐"} Autorizo</span> <span>{s.imageConsent === false ? "☒" : "☐"} Não autorizo</span>{" "}
        o uso de imagem {minor ? "do aluno" : ""} em fotos e vídeos de treinos e eventos da academia.
      </p>

      {health !== null && (
        <>
          <h2>Saúde</h2>
          <p>{health || "Nenhuma observação registrada."}</p>
        </>
      )}

      {terms.length > 0 && (
        <>
          <h2>Termos</h2>
          <div className="sheet-terms">{terms.map((t, i) => <p key={i}>{t}</p>)}</div>
        </>
      )}

      <p className="sheet-date">{academy.city ?? "________________"}, ____ de ______________ de ______.</p>
      <div className="sheet-signs">
        <div><span />{signer ? `${signer.name}, responsável legal${signer.cpf ? `, CPF ${signer.cpf}` : ""}` : `${s.name}${s.cpf ? `, CPF ${s.cpf}` : ""}`}</div>
        <div><span />{contractor}{academy.ownerName ? `, por ${academy.ownerName}` : ""}</div>
      </div>
      <DocumentFooter />
    </article>
  );
}
