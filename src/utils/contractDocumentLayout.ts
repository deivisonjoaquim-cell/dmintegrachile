export interface ParsedContractParty {
  role: 'CONTRATADO(A)' | 'CONTRATANTE';
  text: string;
}

export interface ParsedContractClause {
  id: string;
  heading: string;
  shortLabel: string;
  paragraphs: string[];
  isScopeTransparency: boolean;
}

export interface ParsedContractDocument {
  title: string;
  preamble: string[];
  parties: ParsedContractParty[];
  clauses: ParsedContractClause[];
  closingDateLine?: string;
  contractorSignatureLabel?: string;
  clientSignatureLabel?: string;
  hasLegacyAsciiSignature: boolean;
}

const CLAUSE_HEADING_RE =
  /^(CLÁUSULA\s+\d+[ªºa]?|CLÁUSULA\s+(?:DE|ADICIONAL)\b|CLAUSULA\s+\d+[ªºa]?|CLAUSULA\s+(?:DE|ADICIONAL)\b)/i;

const INTERNAL_NOTE_RE = /^nota\s+interna\s+de\s+conformidade\s*:/i;
const ASCII_SIG_LINE_RE = /^_{6,}/;
const CLOSING_LOCATION_DATE_RE = /^.+,\s*\d{2}\/\d{2}\/\d{4}\.?$/;
const DOC_TITLE_RE = /^(CONTRATO|TERMO|RECIBO|ORÇAMENTO|ORCAMENTO|AUTORIZAÇÃO|AUTORIZACAO|DECLARACI[ÓO]N|RELAÇÃO|RELACAO|AL SERVICIO)\b/i;

function stripHtmlTags(raw: string): string {
  return (raw || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/\r\n/g, '\n');
}

function buildShortClauseLabel(heading: string, index: number): string {
  const parts = heading.split(/\s*[–—-]\s*/);
  if (parts.length >= 2) {
    const numMatch = parts[0].match(/\d+[ªºa]?/);
    const prefix = numMatch ? `Cl. ${numMatch[0]}` : `Cl. ${index + 1}`;
    const subject = parts.slice(1).join(' – ').trim();
    const compact = subject.length > 26 ? `${subject.slice(0, 24).trim()}…` : subject;
    return `${prefix} · ${compact}`;
  }
  return heading.length > 30 ? `${heading.slice(0, 28).trim()}…` : heading;
}

/**
 * Insere cláusulas adicionais (Modalidade, Dependentes, Parcelamento, Taxas)
 * ANTES da cláusula do Foro ou da linha de local/data e assinaturas,
 * evitando que cláusulas apareçam abaixo das assinaturas do contrato.
 */
export function insertContractClausesBeforeClosing(baseText: string, extraClauses: string[]): string {
  const validExtras = extraClauses.map((c) => c.trim()).filter(Boolean);
  if (validExtras.length === 0) return baseText;

  const extraBlock = validExtras.join('\n\n');
  const lines = baseText.replace(/\r\n/g, '\n').split('\n');

  // Procura primeiro a Cláusula de Foro ou a linha de local/data / assinatura
  const anchorIdx = lines.findIndex((line) => {
    const t = line.trim();
    return (
      /^CL[ÁA]USULA\s+\d+[ªºa]?\s*[–—-]\s*DO\s+FORO/i.test(t) ||
      CLOSING_LOCATION_DATE_RE.test(t) ||
      ASCII_SIG_LINE_RE.test(t) ||
      t.includes('{{data_atual}}')
    );
  });

  if (anchorIdx === -1) {
    return `${baseText.trimEnd()}\n\n${extraBlock}`;
  }

  const before = lines.slice(0, anchorIdx).join('\n').trimEnd();
  const after = lines.slice(anchorIdx).join('\n').trimStart();
  return `${before}\n\n${extraBlock}\n\n${after}`;
}

/**
 * Analisa o texto do contrato/documento oficial em blocos estruturados para
 * renderização editorial bem enquadrada na tela A4 e no PDF multi-páginas.
 */
export function parseContractDocumentLayout(rawContent: string, fallbackTitle = 'Contrato de Prestação de Serviços'): ParsedContractDocument {
  const plain = stripHtmlTags(rawContent);
  const rawLines = plain
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .filter((line) => !INTERNAL_NOTE_RE.test(line));

  let title = fallbackTitle;
  const preamble: string[] = [];
  const parties: ParsedContractParty[] = [];
  const clauses: ParsedContractClause[] = [];
  let closingDateLine: string | undefined;
  let contractorSignatureLabel: string | undefined;
  let clientSignatureLabel: string | undefined;
  let hasLegacyAsciiSignature = false;

  let currentClause: ParsedContractClause | null = null;
  let seenTitle = false;
  let afterSignatureRule = false;

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    if (!line) continue;

    if (ASCII_SIG_LINE_RE.test(line)) {
      hasLegacyAsciiSignature = true;
      afterSignatureRule = true;
      continue;
    }

    if (afterSignatureRule) {
      if (line.includes('(CONTRATADO') && line.includes('(CONTRATANTE')) {
        const splitIdx = line.indexOf(')') + 1;
        contractorSignatureLabel = line.slice(0, splitIdx).trim();
        clientSignatureLabel = line.slice(splitIdx).trim();
      } else if (!contractorSignatureLabel) {
        contractorSignatureLabel = line;
      } else if (!clientSignatureLabel) {
        clientSignatureLabel = line;
      }
      continue;
    }

    if (!seenTitle && i <= 2 && DOC_TITLE_RE.test(line) && line.length <= 120) {
      title = line;
      seenTitle = true;
      continue;
    }

    if (CLAUSE_HEADING_RE.test(line)) {
      const idx = clauses.length;
      const isScopeTransparency = /TERCEIR|MORADIA|PARCEIR|ESCOPO\s+EXCLUSIVO/i.test(line);
      currentClause = {
        id: `clause-${idx + 1}`,
        heading: line,
        shortLabel: buildShortClauseLabel(line, idx),
        paragraphs: [],
        isScopeTransparency,
      };
      clauses.push(currentClause);
      continue;
    }

    if (!currentClause) {
      if (/^CONTRATADO\(A\)\s*:/i.test(line)) {
        parties.push({
          role: 'CONTRATADO(A)',
          text: line.replace(/^CONTRATADO\(A\)\s*:\s*/i, '').trim(),
        });
        continue;
      }
      if (/^CONTRATANTE\s*:/i.test(line)) {
        parties.push({
          role: 'CONTRATANTE',
          text: line.replace(/^CONTRATANTE\s*:\s*/i, '').trim(),
        });
        continue;
      }
      preamble.push(line);
      continue;
    }

    if (CLOSING_LOCATION_DATE_RE.test(line)) {
      closingDateLine = line;
      continue;
    }

    if (/moradia\s+n[ãa]o\s+[ée]\s+um\s+servi[çc]o\s+garantido|parceiros\s+independentes/i.test(line)) {
      currentClause.isScopeTransparency = true;
    }
    currentClause.paragraphs.push(line);
  }

  return {
    title,
    preamble,
    parties,
    clauses,
    closingDateLine,
    contractorSignatureLabel,
    clientSignatureLabel,
    hasLegacyAsciiSignature,
  };
}
