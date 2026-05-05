import * as XLSX from 'xlsx';
import { CAPEX_MES_MAP, type CapexRecord } from '@/types/capex';

const MAX_RECORDS = 100000;
const HEADER_ROW_INDEX = 3;

type ProgressMessage = { type: 'progress'; current: number; total: number };
type SuccessMessage = { type: 'success'; records: CapexRecord[] };
type ErrorMessage = { type: 'error'; message: string };

function s(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v).trim().substring(0, 300);
}

function num(v: unknown): number {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return isNaN(v) ? 0 : v;
  let str = String(v).trim().replace(/[R$\s]/g, '');
  const lc = str.lastIndexOf(','), ld = str.lastIndexOf('.');
  if (lc > ld) str = str.replace(/\./g, '').replace(',', '.');
  else str = str.replace(/,/g, '');
  const n = parseFloat(str);
  return isNaN(n) ? 0 : n;
}

function findKey(row: Record<string, any>, target: string): string | null {
  const keys = Object.keys(row);
  if (keys.includes(target)) return target;
  const norm = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const t = norm(target);
  let found = keys.find(k => norm(k) === t);
  if (found) return found;
  found = keys.find(k => norm(k).includes(t));
  return found || null;
}

function get(row: Record<string, any>, target: string): any {
  const k = findKey(row, target);
  return k ? row[k] : undefined;
}

function parseMes(row: Record<string, any>): number {
  const nMes = get(row, 'Nº MÊS');
  if (nMes !== undefined && nMes !== '') {
    const n = Math.round(num(nMes));
    if (n >= 1 && n <= 12) return n;
  }
  const mes = get(row, 'Mês');
  if (mes !== undefined && mes !== '') {
    if (typeof mes === 'number') {
      const d = XLSX.SSF.parse_date_code(mes);
      if (d && d.m >= 1 && d.m <= 12) return d.m;
    }
    const str = String(mes).trim().toUpperCase();
    if (CAPEX_MES_MAP[str]) return CAPEX_MES_MAP[str];
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) return parsed.getMonth() + 1;
  }
  return 0;
}

function postProgress(current: number, total: number) {
  self.postMessage({ type: 'progress', current, total } satisfies ProgressMessage);
}

self.onmessage = async (event: MessageEvent<{ file: File }>) => {
  try {
    postProgress(0, 100);
    const buffer = await event.data.file.arrayBuffer();
    postProgress(0, 100);

    const bookInfo = XLSX.read(buffer.slice(0), { type: 'array', bookSheets: true, bookProps: false });
    const sheetName = bookInfo.SheetNames.find(n => n.toLowerCase().includes('base 2026')) || bookInfo.SheetNames[0];
    if (!sheetName) throw new Error("Aba 'Base 2026' não encontrada na planilha");

    const wb = XLSX.read(buffer, {
      type: 'array',
      sheets: sheetName,
      sheetRows: 5000,
      dense: true,
      raw: true,
      cellDates: false,
      cellNF: false,
      cellHTML: false,
      cellStyles: false,
      cellFormula: false,
    });
    const sheet = wb.Sheets[sheetName];

    const originalRef = sheet['!ref'];
    const decoded = XLSX.utils.decode_range(originalRef || 'A1:A1');
    let lastRowWithData = HEADER_ROW_INDEX;
    const denseRows = sheet as unknown as any[][];
    for (let r = denseRows.length - 1; r >= HEADER_ROW_INDEX; r--) {
      const row = denseRows[r];
      if (Array.isArray(row) && row.some(cell => cell?.v !== undefined && cell.v !== null && cell.v !== '')) {
        lastRowWithData = r;
        break;
      }
    }
    const newRef = XLSX.utils.encode_range({
      s: { r: 0, c: decoded.s.c },
      e: { r: lastRowWithData, c: decoded.e.c }
    });
    sheet['!ref'] = newRef;
    console.log('[Capex Parser] Original !ref:', originalRef, '→ truncated to:', newRef, `(dense rows: ${denseRows.length})`);

    const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, { range: HEADER_ROW_INDEX, defval: '', raw: true, blankrows: false, dense: true, sheetStubs: false, skipHidden: true, header: undefined, cellDates: false, dateNF: undefined, WTF: false, FS: undefined, RS: undefined, strip: false } as any)
      .map((row: Record<string, any>) => row)
      .filter(Boolean);
    console.log('[Capex Parser] Sheet:', sheetName, '| Total raw rows:', rows.length);
    if (rows[0]) console.log('[Capex Parser] Headers detected:', Object.keys(rows[0]));

    const records: CapexRecord[] = [];
    let descBase = 0, descExec = 0, descMes = 0;
    let processed = 0;
    const reportEvery = 200;
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