import { FileUpload } from '@/components/FileUpload';
import { useOPEX } from '@/contexts/OPEXContext';
import { getMesesComReal, formatCurrency } from '@/lib/opex-utils';
import { MESES_PT } from '@/types/opex';
import { Database, Trash2 } from 'lucide-react';

export default function UploadPage() {
  const { records, setRecords, hasData, filteredRecords } = useOPEX();
  const mesesComReal = hasData ? getMesesComReal(filteredRecords) : [];
  const orcCount = records.filter(r => r.base === 'ORÇ26').length;
  const realCount = records.filter(r => r.base === 'REAL26').length;

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Upload de Planilha</h1>
        <p className="text-sm text-muted-foreground">Importe ou atualize os dados OPEX</p>
      </div>

      <FileUpload />

      {hasData && (
        <div className="glass-card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Dados Carregados</h3>
          </div>
          <div className="grid gap-3 text-xs sm:grid-cols-2">
            <div className="rounded-md bg-muted/50 p-3">
              <p className="text-muted-foreground">Total de registros</p>
              <p className="text-lg font-bold font-mono">{records.length.toLocaleString('pt-BR')}</p>
            </div>
            <div className="rounded-md bg-muted/50 p-3">
              <p className="text-muted-foreground">Orçamento (ORÇ26)</p>
              <p className="text-lg font-bold font-mono">{orcCount.toLocaleString('pt-BR')}</p>
            </div>
            <div className="rounded-md bg-muted/50 p-3">
              <p className="text-muted-foreground">Realizado (REAL26)</p>
              <p className="text-lg font-bold font-mono">{realCount.toLocaleString('pt-BR')}</p>
            </div>
            <div className="rounded-md bg-muted/50 p-3">
              <p className="text-muted-foreground">Meses com realizado</p>
              <p className="text-lg font-bold font-mono">
                {mesesComReal.length > 0 ? mesesComReal.map(m => MESES_PT[m - 1]).join(', ') : '—'}
              </p>
            </div>
          </div>
          <button
            onClick={() => { setRecords([]); localStorage.removeItem('opex-data'); }}
            className="flex items-center gap-2 text-xs text-destructive hover:underline"
          >
            <Trash2 className="h-3 w-3" />
            Limpar dados
          </button>
        </div>
      )}
    </div>
  );
}
