import { strFromU8, unzipSync } from 'fflate';
import { CAPEX_MES_MAP, type CapexRecord } from '@/types/capex';

const MAX_RECORDS = 100000;
const HEADER_ROW_NUMBER = 4;

type ProgressMessage = { type: 'progress'; current: number; total: number };
type SuccessMessage = { type: 'success'; records: CapexRecord[] };
type ErrorMessage = { type: 'error'; message: string };

interface CellValue { row: number; col: number; value: unknown }

type RowObject = Record<string, unknown>;

function s(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v).trim().substring(0, 300);
}

function num(v: unknown): number {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return Number.isNaN(v) ? 0 : v;
  let str = String(v).trim().replace(/[R$\s]/g, '');
  const lc = str.lastIndexOf(','), ld = str.lastIndexOf('.');
  if (lc > ld) str = str.replace(/\./g, '').replace(',', '.');
  else str = str.replace(/,/g, '');
  const n = parseFloat(str);
  return Number.isNaN(n) ? 0 : n;
}

function excelDateMonth(serial: number): number {
  if (!Number.isFinite(serial)) return 0;
  const utcDays = Math.floor(serial - 25569);
  const date = new Date(utcDays * 86400 * 1000);
  return date.getUTCMonth() + 1;
}

function findKey(row: RowObject, target: string): string | null {
  const keys = Object.keys(row);
  if (keys.includes(target)) return target;
  const norm = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const t = norm(target);
  return keys.find(k => norm(k) === t) || keys.find(k => norm(k).includes(t)) || null;
}

function get(row: RowObject, target: string): unknown {
  const k = findKey(row, target);
  return k ? row[k] : undefined;
}

function parseMes(row: RowObject): number {
  const nMes = get(row, 'Nº MÊS');
  if (nMes !== undefined && nMes !== '') {
    const n = Math.round(num(nMes));
    if (n >= 1 && n <= 12) return n;
  }
  const mes = get(row, 'Mês');
  if (mes !== undefined && mes !== '') {
    if (typeof mes === 'number') {
      const month = excelDateMonth(mes);
      if (month >= 1 && month <= 12) return month;
    }
    const str = String(mes).trim().toUpperCase();
    if (CAPEX_MES_MAP[str]) return CAPEX_MES_MAP[str];
    const parsed = new Date(str);
    if (!Number.isNaN(parsed.getTime())) return parsed.getMonth() + 1;
  }
  return 0;
}

function postProgress(current: number, total: number) {
  self.postMessage({ type: 'progress', current, total } satisfies ProgressMessage);
}

function decodeXml(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

function attr(xml: string, name: string): string {
  return decodeXml(xml.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1] || '');
}

function colIndex(ref: string): number {
  const letters = ref.match(/^[A-Z]+/i)?.[0].toUpperCase() || 'A';
  let n = 0;
  for (const ch of letters) n = n * 26 + ch.charCodeAt(0) - 64;
  return n - 1;
}

function rowNumber(ref: string): number {
  return Number(ref.match(/\d+$/)?.[0] || 0);
}

function toNumberIfNumeric(value: string): unknown {
  if (value === '') return '';
  const n = Number(value);
  return Number.isFinite(n) && /^-?\d+(\.\d+)?(?:e[+-]?\d+)?$/i.test(value) ? n : value;
}

function textFromRichXml(xml: string): string {
  let out = '';
  const re = /<t\b[^>]*>([\s\S]*?)<\/t>/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(xml))) out += decodeXml(match[1]);
  return out;
}

function readZipText(zip: Record<string, Uint8Array>, path: string): string {
  const entry = zip[path];
  if (!entry) throw new Error(`Arquivo interno não encontrado: ${path}`);
  return strFromU8(entry);
}

function normalizePath(base: string, target: string): string {
  if (target.startsWith('/')) return target.replace(/^\//, '');
  const stack = base.split('/').filter(Boolean);
  for (const part of target.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') stack.pop();
    else stack.push(part);
  }
  return stack.join('/');
}

function parseSharedStrings(zip: Record<string, Uint8Array>): string[] {
  if (!zip['xl/sharedStrings.xml']) return [];
  const xml = readZipText(zip, 'xl/sharedStrings.xml');
  const items: string[] = [];
  const re = /<si\b[^>]*>([\s\S]*?)<\/si>/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(xml))) items.push(textFromRichXml(match[1]));
  return items;
}

function getWorksheetPath(zip: Record<string, Uint8Array>): { sheetName: string; sheetPath: string } {
  const workbook = readZipText(zip, 'xl/workbook.xml');
  const rels = readZipText(zip, 'xl/_rels/workbook.xml.rels');
  const relationships = new Map<string, string>();
  const relRe = /<Relationship\b([^>]*)\/?>(?:<\/Relationship>)?/g;
  let rel: RegExpExecArray | null;
  while ((rel = relRe.exec(rels))) relationships.set(attr(rel[1], 'Id'), attr(rel[1], 'Target'));

  const sheets: Array<{ name: string; relId: string }> = [];
  const sheetRe = /<sheet\b([^>]*)\/?>(?:<\/sheet>)?/g;
  let sheet: RegExpExecArray | null;
  while ((sheet = sheetRe.exec(workbook))) sheets.push({ name: attr(sheet[1], 'name'), relId: attr(sheet[1], 'r:id') });

  const selected = sheets.find(s => s.name.toLowerCase().includes('base 2026')) || sheets[0];
  if (!selected) throw new Error("Aba 'Base 2026' não encontrada na planilha");
  const target = relationships.get(selected.relId);
  if (!target) throw new Error(`Relação da aba '${selected.name}' não encontrada`);
  return { sheetName: selected.name, sheetPath: normalizePath('xl', target) };
}

function parseSheetRows(sheetXml: string, sharedStrings: string[]): { originalRef: string; rows: RowObject[]; lastRow: number } {
  const originalRef = attr(sheetXml.match(/<dimension\b([^>]*)\/>/)?.[1] || '', 'ref') || 'A1:A1';
  const headers = new Map<number, string>();
  const rowMap = new Map<number, RowObject>();
  let lastRow = HEADER_ROW_NUMBER;
  const cellRe = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
  let cell: RegExpExecArray | null;

  while ((cell = cellRe.exec(sheetXml))) {
    const attrs = cell[1];
    const body = cell[2] || '';
    const ref = attr(attrs, 'r');
    if (!ref) continue;
    const row = rowNumber(ref);
    if (row < HEADER_ROW_NUMBER) continue;
    const col = colIndex(ref);
    const type = attr(attrs, 't');
    const rawValue = body.match(/<v[^>]*>([\s\S]*?)<\/v>/)?.[1] || '';
    let value: unknown = '';

    if (type === 's') value = sharedStrings[Number(rawValue)] || '';
    else if (type === 'inlineStr') value = textFromRichXml(body);
    else if (type === 'str') value = decodeXml(rawValue);
    else value = toNumberIfNumeric(decodeXml(rawValue));

    if (value === '') continue;
    if (row === HEADER_ROW_NUMBER) {
      headers.set(col, s(value));
      continue;
    }

    const header = headers.get(col);
    if (!header) continue;
    let rowObj = rowMap.get(row);
    if (!rowObj) {
      rowObj = {};
      rowMap.set(row, rowObj);
    }
    rowObj[header] = value;
    if (row > lastRow) lastRow = row;
  }

  const rows = [...rowMap.keys()].sort((a, b) => a - b).map(row => rowMap.get(row)!).filter(row => Object.keys(row).length > 0);
  return { originalRef, rows, lastRow };
}

self.onmessage = async (event: MessageEvent<{ file: File }>) => {
  try {
    postProgress(0, 100);
    const buffer = await event.data.file.arrayBuffer();
    postProgress(0, 100);

    const zip = unzipSync(new Uint8Array(buffer));
    const { sheetName, sheetPath } = getWorksheetPath(zip);
    const sharedStrings = parseSharedStrings(zip);
    const sheetXml = readZipText(zip, sheetPath);
    const { originalRef, rows, lastRow } = parseSheetRows(sheetXml, sharedStrings);
    const truncatedRef = `A1:AL${lastRow}`;

    console.log('[Capex Parser] Original !ref:', originalRef, '→ truncated to:', truncatedRef, `(xml cells: ${rows.length})`);
    console.log('[Capex Parser] Sheet:', sheetName, '| Total raw rows:', rows.length);
    if (rows[0]) console.log('[Capex Parser] Headers detected:', Object.keys(rows[0]));

    const records: CapexRecord[] = [];
    let descBase = 0, descExec = 0, descMes = 0;
    let processed = 0;
    const reportEvery = 100;
    const totalRows = rows.length;

    for (const row of rows) {
      processed++;
      if (processed % reportEvery === 0 || processed === totalRows) postProgress(processed, totalRows);
      const baseRaw = s(get(row, 'Base')).toLowerCase();
      if (baseRaw !== 'orc' && baseRaw !== 'real') { descBase++; continue; }
      const executado = num(get(row, 'EXECUTADO'));
      if (!executado) { descExec++; continue; }
      const mes = parseMes(row);
      if (mes < 1 || mes > 12) { descMes++; continue; }

      records.push({
        base: baseRaw as 'orc' | 'real',
        tipo: s(get(row, 'Tipo')),
        centro_custo: s(get(row, 'Centro de Custo')),
        desc_centro_custo: s(get(row, 'Desc. Centro de Custo')),
        area: s(get(row, 'Área')),
        diretoria: s(get(row, 'Diretoria')),
        responsavel_area: s(get(row, 'Responsável Área')),
        nome_projeto: s(get(row, 'Nome do Projeto')),
        projeto_novo: s(get(row, 'Projeto Novo?')),
        sponsor_projeto: s(get(row, 'Sponsor Projeto')),
        cod_fornecedor: s(get(row, 'Cod Fornecedor')),
        razao_social: s(get(row, 'Razao Social')),
        nome_fantasia: s(get(row, 'Nome Fantasia')),
        conta_contabil: s(get(row, 'Conta Contábil')),
        desc_conta_contabil: s(get(row, 'Descrição Conta Contábil')),
        grupo_pacotes: s(get(row, 'Grupo Pacotes')),
        grupo_contas_1: s(get(row, 'Grupo Contas 1')),
        grupo_contas_2: s(get(row, 'Grupo Contas 2')),
        item_contabil: s(get(row, 'Item Contábil')),
        executado,
        mes_num: mes,
        historico: s(get(row, 'HISTÓRICO')),
        data_lancamento: s(get(row, 'DATA')),
        nf_numero: s(get(row, 'Nº NF')),
        pedido_numero: s(get(row, 'Nº Pedido')),
        desc_pedido: s(get(row, 'Desc Pedido')),
      });
      if (records.length > MAX_RECORDS) throw new Error(`Limite de ${MAX_RECORDS} registros excedido`);
    }

    console.log(`[Capex Parser] Aceitas: ${records.length} | Descartadas: base=${descBase}, exec=${descExec}, mes=${descMes}`);
    if (records.length === 0) throw new Error('Nenhum registro válido encontrado na planilha.');
    self.postMessage({ type: 'success', records } satisfies SuccessMessage);
  } catch (error: any) {
    self.postMessage({ type: 'error', message: error?.message || 'Erro ao processar arquivo' } satisfies ErrorMessage);
  }
};

export type CapexWorkerMessage = ProgressMessage | SuccessMessage | ErrorMessage;
