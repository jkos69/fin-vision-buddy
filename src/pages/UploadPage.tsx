import { useState, useEffect } from 'react';
import { FileUpload } from '@/components/FileUpload';
import { useOPEX } from '@/contexts/OPEXContext';
import { useAuth } from '@/contexts/AuthContext';
import { getMesesComReal } from '@/lib/opex-utils';
import { MESES_PT } from '@/types/opex';
import { Database, Trash2, Lock, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';

export default function UploadPage() {
  const { records, clearRecords, hasData, filteredRecords } = useOPEX();
  const { isCEO } = useAuth();
  const mesesComReal = hasData ? getMesesComReal(filteredRecords) : [];
  const orcCount = records.filter(r => r.base === 'ORÇ26').length;
  const realCount = records.filter(r => r.base === 'REAL26').length;
  const missingOrigem = records.length > 0 && records.some(r => !r.origem);

  const [lastUpload, setLastUpload] = useState<any>(null);

  useEffect(() => {
    supabase.from('opex_uploads').select('*').order('created_at', { ascending: false }).limit(1).single()
      .then(({ data }) => setLastUpload(data));
  }, [records]);

  // Mini chart data: records per month ORÇ vs REAL
  const miniChartData = hasData ? Array.from({ length: 12 }, (_, i) => {
    const mes = i + 1;
    const orc = records.filter(r => r.base === 'ORÇ26' && r.mes === mes).length;
    const real = records.filter(r => r.base === 'REAL26' && r.mes === mes).length;
    return { mesNome: MESES_PT[i], orcado: orc, realizado: real };
  }) : [];

  if (!isCEO) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Lock className="h-12 w-12 text-muted-foreground/50" />
        <p className="text-muted-foreground text-sm">Os dados são atualizados pela administração.</p>
        {lastUpload && (
          <div className="glass-card p-4 text-xs text-muted-foreground space-y-1 text-center">
            <div className="flex items-center justify-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              Última atualização: {new Date(lastUpload.created_at).toLocaleString('pt-BR')} por {lastUpload.uploaded_by}
            </div>
            <p>{lastUpload.total_records?.toLocaleString('pt-BR')} registros</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Upload de Planilha</h1>
        <p className="text-sm text-muted-foreground">Importe ou atualize os dados OPEX</p>
      </div>

      {lastUpload && (
        <div className="glass-card p-4 text-xs space-y-1">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            Última atualização: {new Date(lastUpload.created_at).toLocaleString('pt-BR')} por {lastUpload.uploaded_by}
          </div>
          <p className="text-muted-foreground">Arquivo: <span className="text-foreground">{lastUpload.filename}</span></p>
          <p className="text-muted-foreground">
            {lastUpload.total_records?.toLocaleString('pt-BR')} registros
            {lastUpload.meses_real?.length > 0 && <> | Meses reais: {lastUpload.meses_real.map((m: number) => MESES_PT[m - 1]).join(', ')}</>}
          </p>
        </div>
      )}

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

          {/* Mini chart */}
          <div>
            <p className="text-xs text-muted-foreground mb-2">Registros por mês</p>
            <ResponsiveContainer width="100%" height={120}>
              <BarChart data={miniChartData}>
                <XAxis dataKey="mesNome" tick={{ fill: 'hsl(215,15%,55%)', fontSize: 9 }} />
                <YAxis hide />
                <Tooltip formatter={(v: number) => v.toLocaleString('pt-BR')} />
                <Bar dataKey="orcado" name="ORÇ26" fill="hsl(175,70%,45%)" opacity={0.5} />
                <Bar dataKey="realizado" name="REAL26" fill="hsl(210,80%,60%)" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <button
            onClick={() => { if (window.confirm('Limpar todos os dados?')) clearRecords(); }}
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
