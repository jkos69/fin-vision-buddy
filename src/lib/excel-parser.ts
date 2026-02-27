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
  // Remove currency symbols and spaces
  str = str.replace(/[R$\s]/g, '');
  
  const lastComma = str.lastIndexOf(',');
  const lastDot = str.lastIndexOf('.');
  
  if (lastComma > lastDot) {
    // Brazilian format: 1.234,56
    str = str.replace(/\./g, '').replace(',', '.');
  } else {
    // US format or no decimal: 1,234.56
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

    const base = String(row[0] || '').trim().toUpperCase();
    if (base !== 'ORÇ26' && base !== 'REAL26') continue;

    const executado = parseNumber(row[15]);
    const mes = parseNumber(row[16]);
    if (mes < 1 || mes > 12) continue;

    records.push({
      base: base as 'ORÇ26' | 'REAL26',
      centroCusto: sanitizeString(row[1]),
      descricaoCCusto: sanitizeString(row[2]),
      areaGrupo1: sanitizeString(row[5]),
      diretoria: sanitizeString(row[6]),
      responsavelArea: sanitizeString(row[7]),
      contaContabil: sanitizeString(row[8]),
      descricaoConta: sanitizeString(row[9]),
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
