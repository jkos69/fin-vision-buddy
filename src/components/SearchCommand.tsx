import { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useOPEX } from '@/contexts/OPEXContext';
import { Dialog, DialogContent } from '@/components/ui/dialog';

export function SearchCommand() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const { filteredRecords } = useOPEX();
  const navigate = useNavigate();

  const results = useMemo(() => {
    if (!query || query.length < 2) return [];
    const q = query.toLowerCase();
    const found: { type: string; value: string; route: string }[] = [];
    const seen = new Set<string>();

    for (const r of filteredRecords) {
      if (found.length >= 20) break;
      for (const [field, type, route] of [
        ['areaGrupo1', 'Área', '/areas'],
        ['pacote', 'Pacote', '/pacotes'],
        ['recurso', 'Recurso', '/areas'],
        ['nomeFornecedor', 'Fornecedor', '/comparacao'],
        ['historico', 'Histórico', '/comparacao'],
      ] as const) {
        const val = (r as any)[field] as string;
        if (val && val.toLowerCase().includes(q) && !seen.has(`${type}:${val}`)) {
          seen.add(`${type}:${val}`);
          found.push({ type, value: val, route });
        }
      }
    }
    return found;
  }, [query, filteredRecords]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 w-full px-3 py-2 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
      >
        <Search className="h-3.5 w-3.5" />
        <span>Buscar...</span>
        <kbd className="ml-auto text-[10px] bg-muted px-1.5 py-0.5 rounded">⌘K</kbd>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md p-0 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Buscar área, pacote, recurso, fornecedor..."
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          {results.length > 0 && (
            <div className="max-h-64 overflow-y-auto p-2">
              {results.map((r, i) => (
                <button
                  key={i}
                  onClick={() => { navigate(r.route); setOpen(false); setQuery(''); }}
                  className="flex items-center gap-3 w-full px-3 py-2 rounded-md text-xs hover:bg-accent transition-colors text-left"
                >
                  <span className="text-primary font-medium w-16">{r.type}</span>
                  <span className="flex-1 truncate">{r.value}</span>
                </button>
              ))}
            </div>
          )}
          {query.length >= 2 && results.length === 0 && (
            <div className="p-6 text-center text-xs text-muted-foreground">Nenhum resultado encontrado</div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
