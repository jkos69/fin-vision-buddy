import { useCallback, useRef, useState } from 'react';
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, ShieldCheck, AlertTriangle, Send } from 'lucide-react';
import { parseExcelFile } from '@/lib/excel-parser';
import { useOPEX } from '@/contexts/OPEXContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import type { OPEXRecord } from '@/types/opex';
import { MESES_PT } from '@/types/opex';

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

interface ValidationReport {
  mesesOrcamento: number[];
  mesesReal: number[];
  diretorias: string[];
  totalRecords: number;
  negativos: number;
  records: OPEXRecord[];
}

type UploadStatus = 'idle' | 'parsing' | 'validating' | 'uploading' | 'success' | 'error';

export function FileUpload() {
  const { setRecords, reloadFromDB } = useOPEX();
  const { session } = useAuth();
  const [status, setStatus] = useState<UploadStatus>('idle');
  const [message, setMessage] = useState('');
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [validation, setValidation] = useState<ValidationReport | null>(null);
  const [fileName, setFileName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      setStatus('error');
      setMessage('Arquivo deve ser .xlsx ou .xls');
      return;
    }
    setStatus('parsing');
    setMessage('Processando planilha...');
    setFileName(file.name);
    setProgress(0);

    try {
      const records = await parseExcelFile(file);
      const mesesReal = [...new Set(records.filter(r => r.base === 'REAL26').map(r => r.mes))].sort((a, b) => a - b);
      const mesesOrcamento = [...new Set(records.filter(r => r.base === 'ORÇ26').map(r => r.mes))].sort((a, b) => a - b);
      const diretorias = [...new Set(records.map(r => r.diretoria))].sort();
      const negativos = records.filter(r => r.executado < -10000).length;

      setValidation({ mesesOrcamento, mesesReal, diretorias, totalRecords: records.length, negativos, records });
      setStatus('validating');
    } catch (e: any) {
      setStatus('error');
      setMessage(e.message || 'Erro ao processar arquivo');
    }
  }, []);

  const confirmUpload = useCallback(async () => {
    if (!validation) return;
    const records = validation.records;
    setStatus('uploading');
    setMessage('Limpando dados anteriores...');
    setProgress(0);

    try {
      await supabase.from('opex_records').delete().gt('id', 0);
      await supabase.from('opex_uploads').delete().neq('id', '00000000-0000-0000-0000-000000000000');

      const totalOrcado = records.filter(r => r.base === 'ORÇ26').reduce((s, r) => s + r.executado, 0);
      const totalRealizado = records.filter(r => r.base === 'REAL26').reduce((s, r) => s + r.executado, 0);

      const { data: uploadData, error: uploadError } = await supabase
        .from('opex_uploads')
        .insert({
          uploaded_by: session?.nomeDisplay || 'unknown',
          filename: fileName,
          total_records: records.length,
          meses_real: validation.mesesReal,
          total_orcado: totalOrcado,
          total_realizado: totalRealizado,
        })
        .select('id')
        .single();

      if (uploadError || !uploadData) throw new Error('Erro ao criar registro de upload');

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

      await reloadFromDB();

      setStatus('success');
      const mesesStr = validation.mesesReal.map(m => MESES_PT[m - 1]).join(', ');
      setMessage(`${records.length.toLocaleString('pt-BR')} registros importados! Meses reais: ${mesesStr || 'nenhum'}`);
      setValidation(null);
    } catch (e: any) {
      setStatus('error');
      setMessage(e.message || 'Erro ao processar arquivo');
    }
  }, [validation, setRecords, reloadFromDB, session, fileName]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  return (
    <div className="space-y-4">
      <div
        className={`glass-card p-8 text-center cursor-pointer transition-all duration-300 ${dragOver ? 'border-primary glow-primary' : 'hover:border-primary/50'}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => status !== 'validating' && inputRef.current?.click()}
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
        {(status === 'parsing' || status === 'uploading') && (
          <>
            <FileSpreadsheet className="mx-auto mb-4 h-10 w-10 text-primary animate-pulse" />
            <p className="text-lg font-medium text-primary">{message}</p>
            {progress > 0 && (
              <div className="mt-3 w-full max-w-xs mx-auto">
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }} />
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
        {status === 'validating' && (
          <p className="text-sm text-muted-foreground">Relatório de validação abaixo ↓</p>
        )}
      </div>

      {/* Validation report */}
      {status === 'validating' && validation && (
        <div className="glass-card p-5 space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /> Relatório de Validação</h3>
          <p className="text-xs text-muted-foreground">Arquivo: {fileName}</p>
          <div className="space-y-2 text-xs">
            <div className="flex items-center gap-2">
              {validation.mesesOrcamento.length === 12 ? <CheckCircle2 className="h-3.5 w-3.5 text-success" /> : <AlertTriangle className="h-3.5 w-3.5 text-warning" />}
              <span>{validation.mesesOrcamento.length} meses de orçamento encontrados</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-success" />
              <span>{validation.mesesReal.length} meses com dados reais: {validation.mesesReal.map(m => MESES_PT[m - 1]).join(', ') || 'nenhum'}</span>
            </div>
            <div className="flex items-center gap-2">
              {validation.diretorias.length >= 5 ? <CheckCircle2 className="h-3.5 w-3.5 text-success" /> : <AlertTriangle className="h-3.5 w-3.5 text-warning" />}
              <span>{validation.diretorias.length} diretorias encontradas</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-success" />
              <span>Total: {validation.totalRecords.toLocaleString('pt-BR')} registros</span>
            </div>
            {validation.negativos > 0 && (
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                <span>{validation.negativos} registros com valores negativos significativos (&lt; -10.000) — pode indicar estornos</span>
              </div>
            )}
          </div>
          <div className="flex gap-2 pt-2">
            <button
              onClick={confirmUpload}
              className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
            >
              <Send className="h-3.5 w-3.5" /> Enviar para o banco de dados
            </button>
            <button
              onClick={() => { setStatus('idle'); setValidation(null); }}
              className="px-4 py-2 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
