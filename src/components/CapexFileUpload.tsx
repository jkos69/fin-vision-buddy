import { useCallback, useRef, useState } from 'react';
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Send } from 'lucide-react';
import { parseCapexFile } from '@/lib/capex-parser';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import type { CapexRecord } from '@/types/capex';

type Status = 'idle' | 'parsing' | 'validating' | 'uploading' | 'success' | 'error';

interface Props { onUploaded?: () => void; }

export function CapexFileUpload({ onUploaded }: Props) {
  const { session } = useAuth();
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState('');
  const [records, setRecords] = useState<CapexRecord[] | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      setStatus('error'); setMessage('Arquivo deve ser .xlsx ou .xls'); return;
    }
    setStatus('parsing'); setMessage('Lendo arquivo...'); setFileName(file.name); setProgress(0);
    try {
      localStorage.removeItem('capex-data');
      const recs = await parseCapexFile(file, (current, total) => {
        const pct = Math.round((current / total) * 100);
        setProgress(pct);
        setMessage(`Lendo planilha... ${current.toLocaleString('pt-BR')} / ${total.toLocaleString('pt-BR')} linhas`);
      });
      setRecords(recs);
      setStatus('validating');
      setMessage(`${recs.length.toLocaleString('pt-BR')} registros prontos para envio`);
    } catch (e: any) {
      setStatus('error'); setMessage(e.message || 'Erro ao processar arquivo');
    }
  }, []);

  const confirmUpload = useCallback(async () => {
    if (!records || !session?.sessionToken) return;
    setStatus('uploading'); setMessage('Limpando dados anteriores...'); setProgress(0);
    try {
      const { data: cleared, error: clearErr } = await supabase.rpc('clear_capex_data', { p_session_token: session.sessionToken });
      if (clearErr) throw new Error('Erro ao limpar: ' + clearErr.message);
      if (!cleared) throw new Error('Sem permissão para limpar dados');

      const batchSize = 500;
      const total = records.length;
      for (let i = 0; i < total; i += batchSize) {
        const batch = records.slice(i, i + batchSize);
        const { error } = await supabase.rpc('insert_capex_batch', {
          p_records: batch as any,
          p_session_token: session.sessionToken,
          p_uploaded_by: session.nomeDisplay,
          p_file_name: fileName,
        });
        if (error) throw new Error(`Erro batch ${i}: ${error.message}`);
        const sent = Math.min(i + batchSize, total);
        setProgress(Math.round((sent / total) * 100));
        setMessage(`Enviando... ${sent.toLocaleString('pt-BR')} / ${total.toLocaleString('pt-BR')}`);
      }
      setStatus('success');
      setMessage(`${total.toLocaleString('pt-BR')} registros importados!`);
      setRecords(null);
      onUploaded?.();
    } catch (e: any) {
      setStatus('error'); setMessage(e.message || 'Erro ao enviar');
    }
  }, [records, session, fileName, onUploaded]);

  return (
    <div className="space-y-4">
      <div
        className={`glass-card p-8 text-center cursor-pointer transition-all duration-300 ${dragOver ? 'border-primary glow-primary' : 'hover:border-primary/50'}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
        onClick={() => status !== 'validating' && inputRef.current?.click()}
      >
        <input ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
        {status === 'idle' && (
          <>
            <Upload className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
            <p className="text-lg font-medium">Arraste a planilha de Capex aqui ou clique para selecionar</p>
            <p className="mt-1 text-sm text-muted-foreground">Arquivo .xlsx com aba "Base 2026"</p>
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
        {status === 'success' && (<><CheckCircle2 className="mx-auto mb-4 h-10 w-10 text-success" /><p className="text-lg font-medium text-success">{message}</p></>)}
        {status === 'error' && (<><AlertCircle className="mx-auto mb-4 h-10 w-10 text-destructive" /><p className="text-lg font-medium text-destructive">{message}</p></>)}
        {status === 'validating' && (<p className="text-sm text-muted-foreground">{message} — confirme abaixo</p>)}
      </div>

      {status === 'validating' && records && (
        <div className="glass-card p-5 space-y-3">
          <p className="text-xs text-muted-foreground">Arquivo: {fileName}</p>
          <p className="text-xs">Total: {records.length.toLocaleString('pt-BR')} registros</p>
          <p className="text-xs text-warning">Isso vai substituir o upload anterior de Capex.</p>
          <div className="flex gap-2 pt-2">
            <button onClick={confirmUpload} className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90">
              <Send className="h-3.5 w-3.5" /> Enviar para o banco
            </button>
            <button onClick={() => { setStatus('idle'); setRecords(null); }} className="px-4 py-2 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-accent">Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}
