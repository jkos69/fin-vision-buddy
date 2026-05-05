export interface CapexRecord {
  base: 'orc' | 'real';
  tipo: string; // 'Capex' | 'FOLHA'
  centro_custo: string;
  desc_centro_custo: string;
  area: string;
  diretoria: string;
  responsavel_area: string;
  nome_projeto: string;
  projeto_novo: string;
  sponsor_projeto: string;
  cod_fornecedor: string;
  razao_social: string;
  nome_fantasia: string;
  conta_contabil: string;
  desc_conta_contabil: string;
  grupo_pacotes: string;
  grupo_contas_1: string;
  grupo_contas_2: string;
  item_contabil: string;
  executado: number;
  mes_num: number;
  historico: string;
  data_lancamento: string;
  nf_numero: string;
  pedido_numero: string;
  desc_pedido: string;
}

export interface CapexProjectSummary {
  nome: string;
  diretoria: string;
  sponsor: string;
  status: string;
  orcado: number;
  realizado: number;
  variacaoPercent: number;
  saldo: number;
}

export const CAPEX_MES_MAP: Record<string, number> = {
  JAN: 1, FEV: 2, MAR: 3, ABR: 4, MAI: 5, JUN: 6,
  JUL: 7, AGO: 8, SET: 9, OUT: 10, NOV: 11, DEZ: 12,
};
