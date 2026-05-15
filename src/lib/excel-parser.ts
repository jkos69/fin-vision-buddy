import * as XLSX from 'xlsx';
import type { OPEXRecord } from '@/types/opex';

const MAX_FILE_SIZE_MB = 50;
const MAX_RECORDS = 100000;
const MAX_STRING_LENGTH = 200;

function sanitizeString(value: unknown, maxLength = MAX_STRING_LENGTH): string {
  return String(value || '').trim().substring(0, maxLength);
}

function parseNumber(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return isNaN(value) ? 0 : value;
  
  let str = String(value).trim();
  str = str.replace(/[R$\s]/g, '');
  
  const lastComma = str.lastIndexOf(',');
  const lastDot = str.lastIndexOf('.');
  
  if (lastComma > lastDot) {
    str = str.replace(/\./g, '').replace(',', '.');
  } else {
    str = str.replace(/,/g, '');
  }
  
  const parsed = parseFloat(str);
  return isNaN(parsed) ? 0 : parsed;
}

export async function parseExcelFile(file: File): Promise<OPEXRecord[]> {
  if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
    throw new Error(`Arquivo muito grande (máx ${MAX_FILE_SIZE_MB}MB).`);
  }

  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames.find(n => n.includes('Base Real') || n.includes('Orçado')) || workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  
  // Truncar !ref para o último range com dados reais (preventivo).
  const originalRef = sheet['!ref'];
  if (originalRef) {
    const decoded = XLSX.utils.decode_range(originalRef);
    let lastRowWithData = 0;
    const lastColWithData = decoded.e.c;
    for (const key of Object.keys(sheet)) {
      if (key.startsWith('!')) continue;
      const decodedCell = XLSX.utils.decode_cell(key);
      if (decodedCell.r > lastRowWithData) lastRowWithData = decodedCell.r;
    }
    sheet['!ref'] = XLSX.utils.encode_range({
      s: { r: 0, c: decoded.s.c },
      e: { r: lastRowWithData, c: lastColWithData }
    });
    console.log('[OPEX Parser] !ref:', originalRef, '→', sheet['!ref'], `(varreu ${Object.keys(sheet).length} chaves)`);
  }

  const raw: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  
  let headerIdx = 3;
  for (let i = 0; i < Math.min(10, raw.length); i++) {
    const row = raw[i];
    if (row && row.some((cell: any) => String(cell).toUpperCase().includes('BASE'))) {
      headerIdx = i;
      break;
    }
  }
  console.log('[OPEX Parser] Sheet:', sheetName, '| Header row:', headerIdx, '| Headers:', raw[headerIdx]?.slice(0, 20));
  console.log('[OPEX Parser] First data row:', raw[headerIdx + 1]?.slice(0, 20));
  console.log('[OPEX Parser] Total rows in sheet:', raw.length);

  const records: OPEXRecord[] = [];
  
  for (let i = headerIdx + 1; i < raw.length; i++) {
    const row = raw[i];
    if (!row || row.length < 17) continue;

    const base = String(row[0] || '').trim();
    const baseUpper = base.toUpperCase();
    const isOrc = baseUpper === 'ORÇ26' || baseUpper === 'ORC26' || baseUpper.startsWith('ORÇ') || baseUpper.startsWith('ORC');
    const isReal = baseUpper === 'REAL26' || baseUpper.startsWith('REAL');

    if (!isOrc && !isReal) continue;

    const executado = parseNumber(row[40]) || parseNumber(row[15]);
    
    const mesRaw = row[16];
    let mes: number;
    if (typeof mesRaw === 'number') {
      mes = Math.round(mesRaw);
    } else {
      mes = Math.round(parseNumber(mesRaw));
    }
    if (mes < 1 || mes > 12) continue;

    records.push({
      base: (isOrc ? 'ORÇ26' : 'REAL26') as 'ORÇ26' | 'REAL26',
      centroCusto: sanitizeString(row[1]),
      descricaoCCusto: sanitizeString(row[2]),
      areaGrupo1: sanitizeString(row[5]),
      diretoria: sanitizeString(row[6]),
      responsavelArea: sanitizeString(row[7]),
      contaContabil: sanitizeString(row[8]),
      descricaoConta: sanitizeString(row[9]),
      agrupamento: sanitizeString(row[10]),
      decisao: sanitizeString(row[53]) || 'N/A',
      recurso: sanitizeString(row[11]),
      pacote: sanitizeString(row[12]),
      debito: parseNumber(row[13]),
      credito: parseNumber(row[14]),
      executado,
      mes,
      dataLcto: sanitizeString(row[17]),
      numeroLote: sanitizeString(row[18]),
      historico: sanitizeString(row[20]),
      nomeFornecedor: sanitizeString(row[24]),
      descPedido: sanitizeString(row[28]),
      fornecedorGerencial: sanitizeString(row[30]),
      tipo: sanitizeString(row[34]),
      origem: sanitizeString(row[3]),
      descrOrigem: sanitizeString(row[4]),
    });

    if (records.length > MAX_RECORDS) {
      throw new Error(`Limite de ${MAX_RECORDS.toLocaleString('pt-BR')} registros excedido.`);
    }
  }

  if (records.length === 0) {
    throw new Error('Nenhum registro válido encontrado na planilha. Verifique se a aba e estrutura estão corretas.');
  }

  return records;
}
