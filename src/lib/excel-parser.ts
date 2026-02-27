import * as XLSX from 'xlsx';
import type { OPEXRecord } from '@/types/opex';

const MAX_FILE_SIZE_MB = 10;
const MAX_RECORDS = 100000;
const MAX_STRING_LENGTH = 200;

function sanitizeString(value: unknown, maxLength = MAX_STRING_LENGTH): string {
  return String(value || '').trim().substring(0, maxLength);
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
  
  // Header at row 4 (index 3 in 0-based), data starts at row 5 (index 4)
  // But spec says header line 4 (0-indexed), data from line 5
  // Let's find the header row by looking for "BASE" or similar
  let headerIdx = 3; // default: row 5 (1-indexed) = index 4, header at index 3
  for (let i = 0; i < Math.min(10, raw.length); i++) {
    const row = raw[i];
    if (row && row.some((cell: any) => String(cell).toUpperCase().includes('BASE'))) {
      headerIdx = i;
      break;
    }
  }

  const records: OPEXRecord[] = [];
  
  for (let i = headerIdx + 1; i < raw.length; i++) {
    const row = raw[i];
    if (!row || row.length < 17) continue;

    const base = String(row[0] || '').trim().toUpperCase();
    if (base !== 'ORÇ26' && base !== 'REAL26') continue;

    const executado = Number(row[15]) || 0;
    const mes = Number(row[16]) || 0;
    if (mes < 1 || mes > 12) continue;

    records.push({
      base: base as 'ORÇ26' | 'REAL26',
      areaGrupo1: sanitizeString(row[5]),
      diretoria: sanitizeString(row[6]),
      recurso: sanitizeString(row[11]),
      pacote: sanitizeString(row[12]),
      executado,
      mes,
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
