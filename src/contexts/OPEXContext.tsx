import React, { createContext, useContext, useState, useCallback, useEffect, useMemo, type ReactNode } from 'react';
import type { OPEXRecord } from '@/types/opex';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

type PeriodoView = 'ytd' | 'mensal';

interface OPEXContextType {
  records: OPEXRecord[];
  setRecords: (records: OPEXRecord[]) => void;
  clearRecords: () => void;
  hasData: boolean;
  loading: boolean;
  tipoFilter: 'all' | 'Opex sem Folha' | 'Folha Total';
  setTipoFilter: (f: 'all' | 'Opex sem Folha' | 'Folha Total') => void;
  filteredRecords: OPEXRecord[];
  periodoView: PeriodoView;
  setPeriodoView: (p: PeriodoView) => void;
  mesSelecionado: number | null;
  setMesSelecionado: (m: number | null) => void;
  reloadFromDB: () => Promise<void>;
}

const OPEXContext = createContext<OPEXContextType | null>(null);

function mapDbToRecord(row: any): OPEXRecord {
  return {
    base: row.base as OPEXRecord['base'],
    centroCusto: row.centro_custo || '',
    descricaoCCusto: row.descricao_ccusto || '',
    areaGrupo1: row.area_grupo1 || '',
    diretoria: row.diretoria || '',
    responsavelArea: row.responsavel_area || '',
    contaContabil: row.conta_contabil || '',
    descricaoConta: row.descricao_conta || '',
    recurso: row.recurso || '',
    pacote: row.pacote || '',
    debito: Number(row.debito) || 0,
    credito: Number(row.credito) || 0,
    executado: Number(row.executado) || 0,
    mes: Number(row.mes),
    tipo: row.tipo || '',
    dataLcto: row.data_lcto || '',
    numeroLote: row.numero_lote || '',
    historico: row.historico || '',
    nomeFornecedor: row.nome_fornecedor || '',
    descPedido: row.desc_pedido || '',
    fornecedorGerencial: row.fornecedor_gerencial || '',
  };
}

export function OPEXProvider({ children }: { children: ReactNode }) {
  const [records, setRecordsState] = useState<OPEXRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [tipoFilter, setTipoFilter] = useState<'all' | 'Opex sem Folha' | 'Folha Total'>('all');
  const [periodoView, setPeriodoView] = useState<PeriodoView>('ytd');
  const [mesSelecionado, setMesSelecionado] = useState<number | null>(null);
  const { session } = useAuth();

  const reloadFromDB = useCallback(async () => {
    setLoading(true);
    try {
      let allRows: any[] = [];
      let from = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('opex_records')
          .select('*')
          .order('id')
          .range(from, from + pageSize - 1);

        if (error) {
          console.error('[OPEX] DB load error:', error);
          break;
        }

        if (data && data.length > 0) {
          allRows = allRows.concat(data);
          from += pageSize;
          hasMore = data.length === pageSize;
        } else {
          hasMore = false;
        }
      }

      const mapped = allRows.map(mapDbToRecord);
      console.log('[OPEX] Loaded from DB:', mapped.length, 'records',
        'REAL meses:', [...new Set(mapped.filter(r => r.base === 'REAL26').map(r => r.mes))].sort());
      setRecordsState(mapped);
    } catch (e) {
      console.error('[OPEX] Failed to load from DB:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reloadFromDB();
  }, [reloadFromDB]);

  const setRecords = useCallback((recs: OPEXRecord[]) => {
    console.log('[OPEX] Setting records:', recs.length,
      'REAL meses:', [...new Set(recs.filter(r => r.base === 'REAL26').map(r => r.mes))].sort());
    setRecordsState(recs);
  }, []);

  const clearRecords = useCallback(async () => {
    setRecordsState([]);
    try {
      await supabase.from('opex_records').delete().gt('id', 0);
      await supabase.from('opex_uploads').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    } catch (e) {
      console.error('[OPEX] Failed to clear DB:', e);
    }
  }, []);

  const filteredRecords = useMemo(() => {
    let recs = records;

    // Filter by access level
    if (session?.tipo === 'diretoria' && session.diretoria) {
      recs = recs.filter(r => r.diretoria === session.diretoria);
    } else if (session?.tipo === 'area' && session.area) {
      recs = recs.filter(r => r.areaGrupo1 === session.area);
    }
    // CEO: no filter

    // Filter by tipo (Folha/Opex)
    if (tipoFilter !== 'all') {
      recs = recs.filter(r => r.tipo === tipoFilter);
    }

    return recs;
  }, [records, session, tipoFilter]);

  return (
    <OPEXContext.Provider value={{
      records, setRecords, clearRecords, hasData: records.length > 0, loading,
      tipoFilter, setTipoFilter, filteredRecords,
      periodoView, setPeriodoView, mesSelecionado, setMesSelecionado,
      reloadFromDB,
    }}>
      {children}
    </OPEXContext.Provider>
  );
}

export function useOPEX() {
  const ctx = useContext(OPEXContext);
  if (!ctx) throw new Error('useOPEX must be used within OPEXProvider');
  return ctx;
}
