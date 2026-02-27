export interface OPEXRecord {
  base: 'ORÇ26' | 'REAL26';
  centroCusto: string;
  descricaoCCusto: string;
  areaGrupo1: string;
  diretoria: string;
  responsavelArea: string;
  contaContabil: string;
  descricaoConta: string;
  recurso: string;
  pacote: string;
  debito: number;
  credito: number;
  executado: number;
  mes: number;
  tipo: 'Opex sem Folha' | 'Folha Total' | string;
  dataLcto: string;
  numeroLote: string;
  historico: string;
  nomeFornecedor: string;
  descPedido: string;
  fornecedorGerencial: string;
}

export interface MonthlyData {
  mes: number;
  mesNome: string;
  orcado: number;
  realizado: number;
  variacao: number;
  variacaoPercent: number;
}

export interface SummaryData {
  orcadoYTD: number;
  realizadoYTD: number;
  variacao: number;
  variacaoPercent: number;
  orcadoAnual: number;
  mesesComReal: number[];
  projecaoAnual: number;
}

export interface GroupedData {
  nome: string;
  orcado: number;
  realizado: number;
  variacao: number;
  variacaoPercent: number;
  semaforo: 'green' | 'yellow' | 'red';
}

export const MESES_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export const DIRETORIAS = [
  'PRESIDÊNCIA',
  'OPERAÇÕES',
  'COMERCIAL',
  'TÉCNICA & INOVAÇÃO',
  'ADM & FINANCEIRA',
  'GENTE',
];

export const PACOTES = [
  'PACOTE PESSOAL',
  'PACOTE APOIO TERCEIROS',
  'PACOTE INFRAESTRUTURA',
  'PACOTE MANUTENÇÃO E LOCAÇÃO EQUIPAMENTOS',
  'PACOTE LOGISTICA DE FRETES',
  'PACOTE LOGISTICA DE VIAGENS',
  'PACOTE MARKETING E COMUNICAÇÃO',
  'PACOTE TI',
  'PACOTE COMERCIAL',
  'PACOTE USO E CONSUMO',
  'PACOTE FISCAL',
  'PACOTE CONTROLADORIA',
];
