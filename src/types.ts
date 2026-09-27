export interface Lead {
  id: number;
  nome: string;
  email?: string;
  telefone: string;
  cidade: string;
  materiais: string;
  arquivo_nome?: string;
  arquivo_tamanho?: string;
  arquivo_url?: string;
  aceita_marketing?: boolean | number;
  data_solicitacao: string;
}

export interface Visita {
  id: number;
  data_hora: string;
  dispositivo: string;
  navegador: string;
  origem: string;
  pagina: string;
}

export interface VisitasStats {
  total: number;
  hoje: number;
  mobile: number;
  desktop: number;
  visitas: Visita[];
}

export interface Category {
  id: string;
  title: string;
  description: string;
  items: string[];
  sampleMaterial: string;
  color: string;
  badge: string;
}

export interface GoogleReview {
  id: number;
  autor: string;
  cargo: string;
  nota: number;
  data_texto: string;
  comentario: string;
  verificado: boolean;
  data_criacao?: string;
}

export interface ReviewsData {
  total: number;
  ratingAverage: number;
  reviews: GoogleReview[];
}

export interface MonthlyExecutiveMetric {
  mes: string;
  chave: string;
  visitas: number;
  orcamentos: number;
  cliquesWhatsapp: number;
  totalContatos: number;
  taxaOrcamento: number;
  taxaWhatsapp: number;
  conversao: number;
}

export interface MaterialDemandItem {
  nome: string;
  categoria: string;
  totalSolicitacoes: number;
  porcentagem: number;
}

export interface ExecutiveDashboardData {
  resumoGeral: {
    totalAcessos: number;
    totalOrcamentos: number;
    totalCliquesWhatsapp: number;
    totalAcoesComerciais: number;
    taxaConversaoGeral: number;
    taxaOrcamentos: number;
    taxaCliquesWhatsapp: number;
    acessosHoje: number;
    orcamentosHoje: number;
    cliquesWhatsappHoje: number;
  };
  historicoMensal: MonthlyExecutiveMetric[];
  materiaisMaisSolicitados: MaterialDemandItem[];
  principaisCidades: { cidade: string; total: number; porcentagem: number }[];
  distribuicaoDispositivos: {
    mobile: number;
    desktop: number;
    percentualMobile: number;
  };
  origemCliquesWhatsapp: {
    origem: string;
    total: number;
    porcentagem: number;
  }[];
}

