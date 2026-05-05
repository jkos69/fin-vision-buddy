import * as XLSX from 'xlsx';
import { CapexRecord, CAPEX_MES_MAP } from '@/types/capex';

const MAX_FILE_SIZE_MB = 50;
const MAX_RECORDS = 100000;

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

/** Find a key in row tolerantly: exact, then case/accents-insensitive substring. */
function findKey(row: Record<string, any>, target: string): string | null {
  const keys = Object.keys(row);
  if (keys.includes(target)) return target;
  const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
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
      // Excel date serial
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

export async function parseCapexFile(
  file: File,
  onProgress?: (current: number, total: number) => void
): Promise<CapexRecord[]> {
  if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
    throw new Error(`Arquivo muito grande (máx ${MAX_FILE_SIZE_MB}MB).`);
  }
  if (onProgress) {
    onProgress(0, 100);
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array', cellDates: false });
  const sheetName = wb.SheetNames.find(n => n.toLowerCase().includes('base 2026')) || wb.SheetNames[0];
  if (!sheetName) throw new Error("Aba 'Base 2026' não encontrada na planilha");
  const sheet = wb.Sheets[sheetName];

  // Truncar !ref para o último range com dados reais (Excel pode marcar 1M+ linhas).
  // Usar Object.keys do sheet em vez de varrer o range declarado: o SheetJS só armazena
  // chaves para células que existem de verdade (~60k chaves vs ~40M de células fantasma).
  const originalRef = sheet['!ref'];
  const decoded = XLSX.utils.decode_range(originalRef || 'A1:A1');
  let lastRowWithData = 3;
  const lastColWithData = decoded.e.c;
  for (const key of Object.keys(sheet)) {
    if (key.startsWith('!')) continue;
    const decodedCell = XLSX.utils.decode_cell(key);
    if (decodedCell.r > lastRowWithData) lastRowWithData = decodedCell.r;
  }
  const newRef = XLSX.utils.encode_range({
    s: { r: 0, c: decoded.s.c },
    e: { r: lastRowWithData, c: lastColWithData }
  });
  sheet['!ref'] = newRef;
  console.log('[Capex Parser] Original !ref:', originalRef, '→ truncated to:', newRef, `(varreu ${Object.keys(sheet).length} chaves)`);

  const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, { range: 3, defval: '' });
  console.log('[Capex Parser] Sheet:', sheetName, '| Total raw rows:', rows.length);
  if (rows[0]) console.log('[Capex Parser] Headers detected:', Object.keys(rows[0]));

  const records: CapexRecord[] = [];
  let descBase = 0, descExec = 0, descMes = 0;
  let processed = 0;
  const reportEvery = 200;
  const totalRows = rows.length;

  for (const row of rows) {
    processed++;
    if (onProgress && (processed % reportEvery === 0 || processed === totalRows)) {
      onProgress(processed, totalRows);
      await new Promise(resolve => setTimeout(resolve, 0));
    }
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
  return records;
}
