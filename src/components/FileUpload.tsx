import { useCallback, useRef, useState } from 'react';
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle } from 'lucide-react';
import { parseExcelFile } from '@/lib/excel-parser';
import { useOPEX } from '@/contexts/OPEXContext';

export function FileUpload() {
  const { setRecords } = useOPEX();
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
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
    try {
      const records = await parseExcelFile(file);
      setRecords(records);
      setStatus('success');
      setMessage(`${records.length.toLocaleString('pt-BR')} registros importados com sucesso!`);
    } catch (e: any) {
      setStatus('error');
      setMessage(e.message || 'Erro ao processar arquivo');
    }
  }, [setRecords]);

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
