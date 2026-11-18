import type { CurrencyCode } from '../types/domain';

export function formatDateBR(input?: string | Date | null): string {
  if (!input) return '—';
  const d = typeof input === 'string' ? parseFlexibleDate(input) : input;
  if (!d || Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
}

export function formatDateTimeBR(input?: string | Date | null): string {
  if (!input) return '—';
  const d = typeof input === 'string' ? parseFlexibleDate(input) : input;
  if (!d || Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function parseFlexibleDate(str: string): Date | null {
  if (!str) return null;
  const brMatch = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(str.trim());
  if (brMatch) {
    const [, dd, mm, yyyy] = brMatch;
    return new Date(`${yyyy}-${mm}-${dd}T12:00:00-03:00`);
  }
  const isoDateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str.trim());
  if (isoDateOnly) {
    return new Date(`${str.trim()}T12:00:00-03:00`);
  }
  const parsed = new Date(str);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function toIsoDate(d: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
  return parts;
}

export function maskCPF(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  return digits
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

export function maskPhoneBR(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';

  // Permite digitação de "+55" manualmente antes de aplicar a máscara nacional
  if (trimmed === '+55') return '+55';

  // Suporte a DDI internacional explícito (ex.: +56 Chile, +1 EUA, +351 Portugal)
  if (trimmed.startsWith('+') && !trimmed.startsWith('+55')) {
    const intlDigits = trimmed.replace(/\D/g, '').slice(0, 15);
    if (!intlDigits) return '+';
    if (intlDigits.startsWith('56')) {
      const local = intlDigits.slice(2, 11);
      if (!local) return '+56';
      if (local.startsWith('9') || local.startsWith('2')) {
        if (local.length <= 1) return `+56 ${local}`;
        if (local.length <= 5) return `+56 ${local.slice(0, 1)} ${local.slice(1)}`;
        return `+56 ${local.slice(0, 1)} ${local.slice(1, 5)} ${local.slice(5)}`;
      }
      if (local.length <= 2) return `+56 ${local}`;
      if (local.length <= 5) return `+56 ${local.slice(0, 2)} ${local.slice(2)}`;
      return `+56 ${local.slice(0, 2)} ${local.slice(2, 5)} ${local.slice(5)}`;
    }
    return `+${intlDigits}`;
  }

  // Remove o prefixo +55 já aplicado para não duplicar "55" no DDD a cada tecla
  const hadPrefix55 = /^\+55/.test(trimmed);
  const withoutPrefix = hadPrefix55 ? trimmed.replace(/^\+55\s*/, '') : trimmed;
  let digits = withoutPrefix.replace(/\D/g, '');

  // Se colou DDI 55 sem '+' (ex.: 5511999990000) ou zero à esquerda no DDD (011999990000)
  if (!hadPrefix55 && digits.startsWith('55') && digits.length > 11) {
    digits = digits.slice(2);
  }
  if (digits.startsWith('0') && digits.length > 10) {
    digits = digits.slice(1);
  }

  digits = digits.slice(0, 11);
  if (digits.length === 0) return '';
  if (digits.length <= 2) return `+55 (${digits}`;
  if (digits.length <= 6) return `+55 (${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `+55 (${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `+55 (${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export function isValidWhatsApp(value: string): boolean {
  const trimmed = (value || '').trim();
  if (!trimmed) return false;
  const digits = trimmed.replace(/\D/g, '');
  if (trimmed.startsWith('+') && !trimmed.startsWith('+55')) {
    return digits.length >= 10 && digits.length <= 15;
  }
  const localDigits = trimmed.startsWith('+55')
    ? trimmed.replace(/^\+55\s*/, '').replace(/\D/g, '')
    : digits.startsWith('55') && digits.length > 11
      ? digits.slice(2)
      : digits;
  return localDigits.length === 10 || localDigits.length === 11;
}

export function formatCurrency(value: number | undefined | null, currency: CurrencyCode = 'BRL'): string {
  const num = typeof value === 'number' && !Number.isNaN(value) ? value : 0;
  if (currency === 'BRL') {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num);
  }
  if (currency === 'CLP') {
    return `CLP ${new Intl.NumberFormat('es-CL', { maximumFractionDigits: 0 }).format(num)}`;
  }
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
}

export function buildWhatsAppUrl(phone: string, message: string): string {
  const digits = (phone || '').replace(/\D/g, '');
  const normalized = digits.startsWith('55') || digits.startsWith('56') ? digits : `55${digits}`;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}

export function exportToCSV(filename: string, headers: string[], rows: (string | number | boolean | null | undefined)[][]): void {
  const escapeCell = (cell: string | number | boolean | null | undefined) => {
    const str = cell === null || cell === undefined ? '' : String(cell);
    const escaped = str.replace(/"/g, '""');
    return `"${escaped}"`;
  };
  const csvLines = [headers.map(escapeCell).join(';'), ...rows.map((r) => r.map(escapeCell).join(';'))];
  const blob = new Blob(['\uFEFF' + csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function buildGoogleCalendarUrl(params: {
  title: string;
  startIso: string;
  endIso?: string;
  details?: string;
  location?: string;
}): string {
  const start = parseFlexibleDate(params.startIso) ?? new Date();
  const end = params.endIso ? (parseFlexibleDate(params.endIso) ?? new Date(start.getTime() + 3600000)) : new Date(start.getTime() + 3600000);
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const query = new URLSearchParams({
    action: 'TEMPLATE',
    text: params.title,
    dates: `${fmt(start)}/${fmt(end)}`,
    ctz: 'America/Sao_Paulo',
    details: params.details || '',
    location: params.location || 'Online / Google Meet',
  });
  return `https://calendar.google.com/calendar/render?${query.toString()}`;
}

export function downloadIcsFile(params: {
  title: string;
  startIso: string;
  endIso?: string;
  description?: string;
  location?: string;
}): void {
  const start = parseFlexibleDate(params.startIso) ?? new Date();
  const end = params.endIso ? (parseFlexibleDate(params.endIso) ?? new Date(start.getTime() + 3600000)) : new Date(start.getTime() + 3600000);
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const safeDesc = (params.description || '').replace(/\n/g, '\\n');
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//DM Integra Chile//Agenda//PT-BR',
    'BEGIN:VEVENT',
    `UID:${Date.now()}@dmintegrachile.com`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${params.title}`,
    `DESCRIPTION:${safeDesc}`,
    `LOCATION:${params.location || 'Online'}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${params.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function sanitizeHtml(html: string): string {
  if (!html) return '';
  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi, '')
    .replace(/\son\w+\s*=\s*(['"]).*?\1/gi, '')
    .replace(/\son\w+\s*=\s*[^\s>]+/gi, '')
    .replace(/javascript:/gi, '');
}

export function applyTemplateVariables(body: string, vars: Record<string, string>): string {
  let result = body;
  for (const [key, val] of Object.entries(vars)) {
    result = result.replaceAll(`{{${key}}}`, val ?? '');
  }
  return result;
}

export function isValidCPF(raw: string): boolean {
  const digits = (raw || '').replace(/\D/g, '');
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;

  const calcDigit = (sliceLen: number): number => {
    let sum = 0;
    for (let i = 0; i < sliceLen; i += 1) {
      sum += Number(digits[i]) * (sliceLen + 1 - i);
    }
    const rem = (sum * 10) % 11;
    return rem === 10 ? 0 : rem;
  };

  return calcDigit(9) === Number(digits[9]) && calcDigit(10) === Number(digits[10]);
}

export function normalizeDigits(raw?: string): string {
  return (raw || '').replace(/\D/g, '');
}

export function daysUntilDate(dateStr?: string | null): number | null {
  if (!dateStr) return null;
  const parsed = parseFlexibleDate(dateStr);
  if (!parsed) return null;
  const now = new Date();
  const diffMs = parsed.getTime() - now.getTime();
  return Math.ceil(diffMs / 86400000);
}

export function formatStandardDocFilename(pessoa: string, docNome: string, isoDate?: string, ext = 'pdf'): string {
  const clean = (s: string) =>
    (s || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .toUpperCase() || 'DOC';
  const datePart = isoDate && /^\d{4}-\d{2}-\d{2}/.test(isoDate) ? isoDate.slice(0, 10) : toIsoDate(new Date());
  return `${clean(pessoa)}_${clean(docNome)}_${datePart}.${ext.replace(/^\./, '')}`;
}

export function generateVerificationCode(prefix = 'DM'): string {
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  const ts = Date.now().toString(36).slice(-4).toUpperCase();
  return `${prefix}-${ts}-${rand}`;
}

const UNIDADES = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
const ESPECIAIS = ['dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
const DEZENAS = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
const CENTENAS = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];

function chunkExtenso(n: number): string {
  if (n === 0) return '';
  if (n === 100) return 'cem';
  const c = Math.floor(n / 100);
  const d = Math.floor((n % 100) / 10);
  const u = n % 10;
  const parts: string[] = [];
  if (c > 0) parts.push(CENTENAS[c]);
  if (d === 1) {
    parts.push(ESPECIAIS[u]);
  } else {
    if (d > 1) parts.push(DEZENAS[d]);
    if (u > 0) parts.push(UNIDADES[u]);
  }
  return parts.join(' e ');
}

function intExtenso(num: number): string {
  if (num === 0) return 'zero';
  const milhoes = Math.floor(num / 1000000);
  const milhares = Math.floor((num % 1000000) / 1000);
  const resto = num % 1000;
  const parts: string[] = [];
  if (milhoes > 0) {
    parts.push(`${chunkExtenso(milhoes)} ${milhoes === 1 ? 'milhão' : 'milhões'}`);
  }
  if (milhares > 0) {
    parts.push(milhares === 1 ? 'mil' : `${chunkExtenso(milhares)} mil`);
  }
  if (resto > 0) {
    parts.push(chunkExtenso(resto));
  }
  return parts.join(resto < 100 || resto % 100 === 0 ? ' e ' : ', ');
}

export function valorPorExtenso(valor: number, moeda: CurrencyCode = 'BRL'): string {
  const safe = Math.max(0, Number(valor) || 0);
  const inteiro = Math.floor(safe);
  const centavos = Math.round((safe - inteiro) * 100);
  const unitName =
    moeda === 'BRL'
      ? inteiro === 1
        ? 'real'
        : 'reais'
      : moeda === 'USD'
        ? inteiro === 1
          ? 'dólar americano'
          : 'dólares americanos'
        : inteiro === 1
          ? 'peso chileno'
          : 'pesos chilenos';

  const base = `${intExtenso(inteiro)} ${unitName}`;
  if (centavos > 0 && moeda !== 'CLP') {
    const centLabel = centavos === 1 ? 'centavo' : 'centavos';
    return `${base} e ${intExtenso(centavos)} ${centLabel}`;
  }
  return base;
}

