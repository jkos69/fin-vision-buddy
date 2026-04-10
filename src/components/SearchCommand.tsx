import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useOPEX } from '@/contexts/OPEXContext';
import { Dialog, DialogContent } from '@/components/ui/dialog';

export function SearchCommand() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const { filteredRecords } = useOPEX();
  const navigate = useNavigate();
  const listRef = useRef<HTMLDivElement>(null);

  // ⌘K / Ctrl+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const results = useMemo(() => {
    if (!query || query.length < 2) return [];
    const q = query.toLowerCase();
    const found: { type: string; value: string; route: string }[] = [];
    const seen = new Set<string>();

    for (const r of filteredRecords) {
      if (found.length >= 20) break;
      for (const [field, type, route] of [
        ['areaGrupo1', 'Área', '/areas'],
        ['centroCusto', 'Centro Custo', '/centrocusto'],
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

  // Grouped results
  const grouped = useMemo(() => {
    const groups: Record<string, typeof results> = {};
    results.forEach(r => {
      if (!groups[r.type]) groups[r.type] = [];
      groups[r.type].push(r);
    });
    return groups;
  }, [results]);

  // Flat list for keyboard navigation
  const flatResults = useMemo(() => {
    const flat: typeof results = [];
    Object.values(grouped).forEach(items => flat.push(...items));
    return flat;
  }, [grouped]);

  // Reset selection when results change
  useEffect(() => { setSelectedIndex(0); }, [flatResults]);

  const selectResult = useCallback((r: typeof results[0]) => {
    const params = new URLSearchParams();
    params.set('highlight', r.value);
    params.set('type', r.type);
    navigate(`${r.route}?${params.toString()}`);
    setOpen(false);
    setQuery('');
  }, [navigate]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, flatResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && flatResults[selectedIndex]) {
      e.preventDefault();
      selectResult(flatResults[selectedIndex]);
    }
  }, [flatResults, selectedIndex, selectResult]);

  // Scroll selected into view
  useEffect(() => {
    const el = listRef.current?.querySelector('[data-selected="true"]');
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  let flatIdx = 0;

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
              onKeyDown={handleKeyDown}
              placeholder="Buscar área, pacote, recurso, fornecedor..."
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          {Object.keys(grouped).length > 0 && (
            <div ref={listRef} className="max-h-64 overflow-y-auto p-2">
              {Object.entries(grouped).map(([type, items]) => (
                <div key={type}>
                  <p className="px-3 py-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{type}s</p>
                  {items.map((r, i) => {
                    const thisIdx = flatIdx++;
                    const isSelected = thisIdx === selectedIndex;
                    return (
                      <button
                        key={`${type}-${i}`}
                        data-selected={isSelected}
                        onClick={() => selectResult(r)}
                        className={`flex items-center gap-3 w-full px-3 py-2 rounded-md text-xs transition-colors text-left ${isSelected ? 'bg-accent text-foreground' : 'hover:bg-accent'}`}
                      >
                        <span className="flex-1 truncate">{r.value}</span>
                      </button>
                    );
                  })}
                </div>
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
