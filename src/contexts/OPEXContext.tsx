import React, { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { OPEXRecord } from '@/types/opex';

interface OPEXContextType {
  records: OPEXRecord[];
  setRecords: (records: OPEXRecord[]) => void;
  hasData: boolean;
  tipoFilter: 'all' | 'Opex sem Folha' | 'Folha Total';
  setTipoFilter: (f: 'all' | 'Opex sem Folha' | 'Folha Total') => void;
  filteredRecords: OPEXRecord[];
}

const OPEXContext = createContext<OPEXContextType | null>(null);

export function OPEXProvider({ children }: { children: ReactNode }) {
  const [records, setRecordsState] = useState<OPEXRecord[]>(() => {
    try {
      const saved = localStorage.getItem('opex-data');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [tipoFilter, setTipoFilter] = useState<'all' | 'Opex sem Folha' | 'Folha Total'>('all');

  const setRecords = useCallback((recs: OPEXRecord[]) => {
    setRecordsState(recs);
    localStorage.setItem('opex-data', JSON.stringify(recs));
  }, []);

  const filteredRecords = tipoFilter === 'all' ? records : records.filter(r => r.tipo === tipoFilter);

  return (
    <OPEXContext.Provider value={{ records, setRecords, hasData: records.length > 0, tipoFilter, setTipoFilter, filteredRecords }}>
      {children}
    </OPEXContext.Provider>
  );
}

export function useOPEX() {
  const ctx = useContext(OPEXContext);
  if (!ctx) throw new Error('useOPEX must be used within OPEXProvider');
  return ctx;
}
