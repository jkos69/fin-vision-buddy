import { useCallback, useRef, useState } from 'react';
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle } from 'lucide-react';
import { parseExcelFile } from '@/lib/excel-parser';
import { useOPEX } from '@/contexts/OPEXContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import type { OPEXRecord } from '@/types/opex';

function mapRecordToDb(r: OPEXRecord, uploadId: string) {
  return {
    upload_id: uploadId,
    base: r.base,
    centro_custo: r.centroCusto,
    descricao_ccusto: r.descricaoCCusto,
    area_grupo1: r.areaGrupo1,
    diretoria: r.diretoria,
    responsavel_area: r.responsavelArea,
    conta_contabil: r.contaContabil,
    descricao_conta: r.descricaoConta,
    recurso: r.recurso,
    pacote: r.pacote,
    debito: r.debito,
    credito: r.credito,
    executado: r.executado,
    mes: r.mes,
    tipo: r.tipo,
    data_lcto: r.dataLcto,
    numero_lote: r.numeroLote,
    historico: r.historico,
    nome_fornecedor: r.nomeFornecedor,
    desc_pedido: r.descPedido,
    fornecedor_gerencial: r.fornecedorGerencial,
  };
}

export function FileUpload() {
  const { setRecords, reloadFromDB } = useOPEX();
  const { session } = useAuth();
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      setStatus('error');
      setMessage('Arquivo deve ser .xlsx ou .xls');
      return;
    }
    setStatus('loading');
    setMessage('Processando planilha...');
    setProgress(0);

    try {
      const records = await parseExcelFile(file);
      const mesesReal = [...new Set(records.filter(r => r.base === 'REAL26').map(r => r.mes))].sort((a, b) => a - b);
      console.log('[Upload] Parsed records:', records.length, '| REAL months:', mesesReal);

      // Delete old data
      setMessage('Limpando dados anteriores...');
      await supabase.from('opex_records').delete().gt('id', 0);
      await supabase.from('opex_uploads').delete().neq('id', '00000000-0000-0000-0000-000000000000');

      // Create upload entry
      const totalOrcado = records.filter(r => r.base === 'ORÇ26').reduce((s, r) => s + r.executado, 0);
      const totalRealizado = records.filter(r => r.base === 'REAL26').reduce((s, r) => s + r.executado, 0);

      const { data: uploadData, error: uploadError } = await supabase
        .from('opex_uploads')
        .insert({
          uploaded_by: session?.nomeDisplay || 'unknown',
          filename: file.name,
          total_records: records.length,
          meses_real: mesesReal,
          total_orcado: totalOrcado,
          total_realizado: totalRealizado,
        })
        .select('id')
        .single();

      if (uploadError || !uploadData) throw new Error('Erro ao criar registro de upload');

      // Insert in batches of 500
      const batchSize = 500;
      const total = records.length;
      for (let i = 0; i < total; i += batchSize) {
        const batch = records.slice(i, i + batchSize).map(r => mapRecordToDb(r, uploadData.id));
        const { error: insertError } = await supabase.from('opex_records').insert(batch);
        if (insertError) throw new Error(`Erro ao inserir batch ${i}: ${insertError.message}`);

        const sent = Math.min(i + batchSize, total);
        setProgress(Math.round((sent / total) * 100));
        setMessage(`Enviando... ${sent.toLocaleString('pt-BR')} / ${total.toLocaleString('pt-BR')} registros`);
      }

      // Reload from DB
      await reloadFromDB();

      setStatus('success');
      const mesesStr = mesesReal.map(m => ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'][m-1]).join(', ');
      setMessage(`${records.length.toLocaleString('pt-BR')} registros importados! Meses reais: ${mesesStr || 'nenhum'}`);
    } catch (e: any) {
      setStatus('error');
      setMessage(e.message || 'Erro ao processar arquivo');
    }
  }, [setRecords, reloadFromDB, session]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  return (
    <div
      className={`glass-card p-8 text-center cursor-pointer transition-all duration-300 ${dragOver ? 'border-primary glow-primary' : 'hover:border-primary/50'}`}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
      />
      
      {status === 'idle' && (
        <>
          <Upload className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
          <p className="text-lg font-medium">Arraste a planilha aqui ou clique para selecionar</p>
          <p className="mt-1 text-sm text-muted-foreground">Arquivo .xlsx com aba "Base Real & Orçado"</p>
        </>
      )}
      {status === 'loading' && (
        <>
          <FileSpreadsheet className="mx-auto mb-4 h-10 w-10 text-primary animate-pulse" />
          <p className="text-lg font-medium text-primary">{message}</p>
          {progress > 0 && (
            <div className="mt-3 w-full max-w-xs mx-auto">
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">{progress}%</p>
            </div>
          )}
        </>
      )}
      {status === 'success' && (
        <>
          <CheckCircle2 className="mx-auto mb-4 h-10 w-10 text-success" />
          <p className="text-lg font-medium text-success">{message}</p>
          <p className="mt-2 text-sm text-muted-foreground">Clique para importar nova planilha</p>
        </>
      )}
      {status === 'error' && (
        <>
          <AlertCircle className="mx-auto mb-4 h-10 w-10 text-destructive" />
          <p className="text-lg font-medium text-destructive">{message}</p>
          <p className="mt-2 text-sm text-muted-foreground">Tente novamente</p>
        </>
      )}
    </div>
  );
}
