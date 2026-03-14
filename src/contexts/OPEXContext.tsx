import React, { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { OPEXRecord } from '@/types/opex';

type PeriodoView = 'ytd' | 'anual' | 'mensal';

interface OPEXContextType {
  records: OPEXRecord[];
  setRecords: (records: OPEXRecord[]) => void;
  clearRecords: () => void;
  hasData: boolean;
  tipoFilter: 'all' | 'Opex sem Folha' | 'Folha Total';
  setTipoFilter: (f: 'all' | 'Opex sem Folha' | 'Folha Total') => void;
  filteredRecords: OPEXRecord[];
  periodoView: PeriodoView;
  setPeriodoView: (p: PeriodoView) => void;
  mesSelecionado: number | null;
  setMesSelecionado: (m: number | null) => void;
}

const OPEXContext = createContext<OPEXContextType | null>(null);

export function OPEXProvider({ children }: { children: ReactNode }) {
  const [records, setRecordsState] = useState<OPEXRecord[]>(() => {
    try {
      const saved = localStorage.getItem('opex-data');
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed) || parsed.length === 0) return [];
      if (!parsed[0].base || !parsed[0].mes) {
        localStorage.removeItem('opex-data');
        return [];
      }
      return parsed;
    } catch {
      localStorage.removeItem('opex-data');
      return [];
    }
  });
  const [tipoFilter, setTipoFilter] = useState<'all' | 'Opex sem Folha' | 'Folha Total'>('all');
  const [periodoView, setPeriodoView] = useState<PeriodoView>('ytd');
  const [mesSelecionado, setMesSelecionado] = useState<number | null>(null);

  const setRecords = useCallback((recs: OPEXRecord[]) => {
    console.log('[OPEX] Setting records:', recs.length,
      'REAL meses:', [...new Set(recs.filter(r => r.base === 'REAL26').map(r => r.mes))].sort());

    const dataStr = JSON.stringify(recs);
    const sizeInMB = new Blob([dataStr]).size / (1024 * 1024);

    if (sizeInMB > 50) {
      throw new Error(`Dataset muito grande (${sizeInMB.toFixed(1)}MB). Máximo: 50MB.`);
    }

    setRecordsState(recs);
    try {
      localStorage.setItem('opex-data', dataStr);
    } catch (e) {
      if (e instanceof DOMException && e.name === 'QuotaExceededError') {
        localStorage.removeItem('opex-data');
        console.warn('localStorage quota exceeded, data kept in memory only.');
      }
    }
  }, []);

  const clearRecords = useCallback(() => {
    setRecordsState([]);
    localStorage.removeItem('opex-data');
  }, []);

  const filteredRecords = tipoFilter === 'all' ? records : records.filter(r => r.tipo === tipoFilter);

  return (
    <OPEXContext.Provider value={{ records, setRecords, clearRecords, hasData: records.length > 0, tipoFilter, setTipoFilter, filteredRecords, periodoView, setPeriodoView, mesSelecionado, setMesSelecionado }}>
      {children}
    </OPEXContext.Provider>
  );
}

export function useOPEX() {
  const ctx = useContext(OPEXContext);
  if (!ctx) throw new Error('useOPEX must be used within OPEXProvider');
  return ctx;
}
