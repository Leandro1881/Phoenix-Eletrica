import React, { useState } from 'react';
import { 
  BarChart3, TrendingUp, Users, MessageSquare, FileText, 
  Calendar, ArrowUpRight, Smartphone, Monitor, MapPin, 
  CheckCircle2, Flame, Award, Filter, RefreshCw 
} from 'lucide-react';
import { ExecutiveDashboardData, MonthlyExecutiveMetric } from '../types';

interface ExecutiveDashboardProps {
  data: ExecutiveDashboardData | null;
  isLoading: boolean;
  onRefresh: () => void;
}

export const ExecutiveDashboard: React.FC<ExecutiveDashboardProps> = ({ data, isLoading, onRefresh }) => {
  const [selectedMonthKey, setSelectedMonthKey] = useState<string>('todos');

  if (isLoading && !data) {
    return (
      <div className="py-20 text-center space-y-3">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto text-[#004b9c]" />
        <p className="text-sm font-semibold text-slate-700">Carregando métricas consolidadas do lojista...</p>
        <p className="text-xs text-slate-500">Agrupando acessos, orçamentos e cliques por mês...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="py-16 text-center bg-white rounded-xl border border-slate-200">
        <p className="text-sm font-bold text-slate-700">Não foi possível carregar as métricas executivas.</p>
        <button
          onClick={onRefresh}
          className="mt-3 px-4 py-2 bg-[#004b9c] text-white text-xs font-bold rounded shadow-xs cursor-pointer"
        >
          Tentar Novamente
        </button>
      </div>
    );
  }

  // Filtragem por mês selecionado
  const isAllMonths = selectedMonthKey === 'todos';
  const selectedMonthData: MonthlyExecutiveMetric | undefined = isAllMonths
    ? undefined
    : data.historicoMensal.find((m) => m.chave === selectedMonthKey);

  const displayAcessos = isAllMonths ? data.resumoGeral.totalAcessos : (selectedMonthData?.visitas || 0);
  const displayOrcamentos = isAllMonths ? data.resumoGeral.totalOrcamentos : (selectedMonthData?.orcamentos || 0);
  const displayCliques = isAllMonths ? data.resumoGeral.totalCliquesWhatsapp : (selectedMonthData?.cliquesWhatsapp || 0);
  const displayTotalAcoes = displayOrcamentos + displayCliques;
  const displayConversao = isAllMonths ? data.resumoGeral.taxaConversaoGeral : (selectedMonthData?.conversao || 0);
  const displayTaxaOrcamento = isAllMonths 
    ? (data.resumoGeral.taxaOrcamentos ?? (displayAcessos > 0 ? Number(((displayOrcamentos / displayAcessos) * 100).toFixed(1)) : 0))
    : (selectedMonthData?.taxaOrcamento ?? (displayAcessos > 0 ? Number(((displayOrcamentos / displayAcessos) * 100).toFixed(1)) : 0));
  const displayTaxaWhatsapp = isAllMonths 
    ? (data.resumoGeral.taxaCliquesWhatsapp ?? (displayAcessos > 0 ? Number(((displayCliques / displayAcessos) * 100).toFixed(1)) : 0))
    : (selectedMonthData?.taxaWhatsapp ?? (displayAcessos > 0 ? Number(((displayCliques / displayAcessos) * 100).toFixed(1)) : 0));

  // Calcula o valor máximo para a escala visual do gráfico de barras
  const maxVisitas = Math.max(...data.historicoMensal.map((m) => m.visitas), 10);
  const maxInteracoes = Math.max(...data.historicoMensal.map((m) => m.orcamentos + m.cliquesWhatsapp), 5);

  return (
    <div className="space-y-6">
      
      {/* Barra de Filtro Executivo e Status */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
              Visão Geral Executiva · Phoenix Elétrica
            </h3>
            <span className="text-[11px] font-bold bg-blue-50 text-[#003882] px-2 py-0.5 rounded border border-blue-200">
              Mês a Mês
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Métricas consolidadas de tráfego, orçamentos gerados e conversão para o WhatsApp oficial.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-xs font-semibold text-slate-600">Período:</span>
            <select
              value={selectedMonthKey}
              onChange={(e) => setSelectedMonthKey(e.target.value)}
              className="bg-transparent text-xs font-bold text-[#003882] outline-none cursor-pointer"
            >
              <option value="todos">Todos os Meses (Consolidado)</option>
              {data.historicoMensal.map((m) => (
                <option key={m.chave} value={m.chave}>
                  {m.mes} {m.chave === '2026-09' ? '(Mês Atual)' : ''}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={onRefresh}
            className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
            title="Recarregar métricas"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 4 Cards de Métricas Principais (KPIs Executivos) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: Total de Acessos */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Total de Acessos
            </span>
            <div className="w-9 h-9 rounded-lg bg-blue-50 text-[#003882] border border-blue-100 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="my-2">
            <div className="text-3xl font-black text-slate-900 tracking-tight">
              {displayAcessos.toLocaleString('pt-BR')}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
              <span className="text-emerald-600 font-bold flex items-center">
                <ArrowUpRight className="w-3.5 h-3.5" />
                {data.resumoGeral.acessosHoje} hoje
              </span>
              <span>· {data.distribuicaoDispositivos.percentualMobile}% mobile</span>
            </div>
          </div>
          <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-400">
            {isAllMonths ? 'Acessos acumulados no SQLite' : `Acessos registrados em ${selectedMonthData?.mes}`}
          </div>
        </div>

        {/* Card 2: Total de Orçamentos (Leads) */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Orçamentos no Banco
            </span>
            <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
          </div>
          <div className="my-2">
            <div className="text-3xl font-black text-[#003882] tracking-tight">
              {displayOrcamentos.toLocaleString('pt-BR')}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
              <span className="text-emerald-600 font-bold flex items-center">
                <ArrowUpRight className="w-3.5 h-3.5" />
                {data.resumoGeral.orcamentosHoje} hoje
              </span>
              <span>· Leads com lista de material</span>
            </div>
          </div>
          <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-400">
            {isAllMonths ? 'Cadastros com lista e telefone' : `Cotações recebidas em ${selectedMonthData?.mes}`}
          </div>
        </div>

        {/* Card 3: Cliques no WhatsApp */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Cliques no WhatsApp
            </span>
            <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center">
              <MessageSquare className="w-5 h-5" />
            </div>
          </div>
          <div className="my-2">
            <div className="text-3xl font-black text-emerald-600 tracking-tight">
              {displayCliques.toLocaleString('pt-BR')}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
              <span className="text-emerald-600 font-bold flex items-center">
                <ArrowUpRight className="w-3.5 h-3.5" />
                {data.resumoGeral.cliquesWhatsappHoje} hoje
              </span>
              <span>· Aberturas no WhatsApp</span>
            </div>
          </div>
          <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-400">
            {isAllMonths ? 'Todos os botões rastreados' : `Cliques capturados em ${selectedMonthData?.mes}`}
          </div>
        </div>

        {/* Card 4: Taxa de Conversão Executiva */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Taxa de Conversão
            </span>
            <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="my-2">
            <div className="text-3xl font-black text-indigo-600 tracking-tight">
              {displayConversao}%
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
              <span className="text-indigo-600 font-bold">{displayTotalAcoes} ações comerciais</span>
              <span>· {displayAcessos} acessos</span>
            </div>
          </div>
          <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-400 flex justify-between items-center">
            <span>Orçamentos: <strong className="text-amber-600">{displayTaxaOrcamento}%</strong></span>
            <span>·</span>
            <span>WhatsApp: <strong className="text-emerald-600">{displayTaxaWhatsapp}%</strong></span>
          </div>
        </div>

      </div>

      {/* Gráfico Visual Mensal: Acessos vs Orçamentos vs Cliques */}
      <div className="bg-white p-5 sm:p-6 rounded-xl border border-slate-200 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h4 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-[#004b9c]" />
              <span>Evolução Mensal Comparativa (Últimos 6 Meses)</span>
            </h4>
            <p className="text-xs text-slate-500">
              Comparativo direto entre visitantes únicos, solicitações de orçamentos e cliques no WhatsApp.
            </p>
          </div>

          {/* Legenda */}
          <div className="flex items-center gap-4 text-xs font-semibold">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-[#004b9c]" />
              <span className="text-slate-600">Acessos</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-amber-500" />
              <span className="text-slate-600">Orçamentos</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-[#25D366]" />
              <span className="text-slate-600">WhatsApp</span>
            </div>
          </div>
        </div>

        {/* Tabela / Barras Mês a Mês */}
        <div className="space-y-4 pt-2">
          {data.historicoMensal.map((item) => {
            const percVisitas = Math.min(100, Math.max(8, (item.visitas / maxVisitas) * 100));
            const percOrcamentos = Math.min(100, Math.max(6, (item.orcamentos / maxInteracoes) * 100));
            const percCliques = Math.min(100, Math.max(6, (item.cliquesWhatsapp / maxInteracoes) * 100));

            return (
              <div 
                key={item.chave} 
                className={`p-3 rounded-lg border transition-all ${
                  selectedMonthKey === item.chave 
                    ? 'bg-blue-50/60 border-[#004b9c]' 
                    : 'bg-slate-50/80 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between text-xs mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-sm">{item.mes}</span>
                    <span className="text-[10px] font-mono bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-600">
                      Conversão: <strong className="text-[#004b9c]">{item.conversao}%</strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5 text-[11px] text-slate-600 font-mono font-medium">
                    <span>{item.visitas} acessos</span>
                    <span>·</span>
                    <span className="text-amber-700 font-bold">{item.orcamentos} orçamentos ({item.taxaOrcamento ?? Math.round((item.orcamentos/Math.max(1,item.visitas))*100)}%)</span>
                    <span>·</span>
                    <span className="text-emerald-700 font-bold">{item.cliquesWhatsapp} WhatsApp ({item.taxaWhatsapp ?? Math.round((item.cliquesWhatsapp/Math.max(1,item.visitas))*100)}%)</span>
                  </div>
                </div>

                {/* Barras de Progresso Triplas */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400 w-16">Acessos:</span>
                    <div className="flex-1 bg-slate-200 h-2.5 rounded-full overflow-hidden">
                      <div 
                        className="bg-[#004b9c] h-full rounded-full transition-all duration-500" 
                        style={{ width: `${percVisitas}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400 w-16">Orçamentos:</span>
                    <div className="flex-1 bg-slate-200 h-2 rounded-full overflow-hidden">
                      <div 
                        className="bg-amber-500 h-full rounded-full transition-all duration-500" 
                        style={{ width: `${percOrcamentos}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400 w-16">WhatsApp:</span>
                    <div className="flex-1 bg-slate-200 h-2 rounded-full overflow-hidden">
                      <div 
                        className="bg-[#25D366] h-full rounded-full transition-all duration-500" 
                        style={{ width: `${percCliques}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Grid de 2 Colunas: Materiais Mais Solicitados vs Origem & Cidades */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Coluna 1: Materiais Mais Solicitados (Ranking) */}
        <div className="lg:col-span-7 bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h4 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <Flame className="w-4 h-4 text-[#d31010]" />
                <span>Lista de Materiais Mais Solicitados</span>
              </h4>
              <p className="text-xs text-slate-500">
                Demanda categorizada a partir das listas de compras dos orçamentos recebidos.
              </p>
            </div>
            <span className="text-xs font-bold text-slate-400">Total: {data.resumoGeral.totalOrcamentos} pedidos</span>
          </div>

          <div className="space-y-3.5">
            {data.materiaisMaisSolicitados.map((item, idx) => (
              <div key={item.nome} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center ${
                      idx === 0 ? 'bg-amber-100 text-amber-800' :
                      idx === 1 ? 'bg-slate-200 text-slate-700' :
                      idx === 2 ? 'bg-orange-100 text-orange-800' : 'bg-slate-100 text-slate-600'
                    }`}>
                      #{idx + 1}
                    </span>
                    <span className="font-bold text-slate-800">{item.nome}</span>
                  </div>
                  <div className="flex items-center gap-2 font-mono">
                    <span className="text-xs font-bold text-[#003882]">{item.totalSolicitacoes} cotações</span>
                    <span className="text-[11px] text-slate-500">({item.porcentagem}%)</span>
                  </div>
                </div>

                {/* Barra de porcentagem */}
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-[#003882] to-[#004b9c] rounded-full transition-all duration-500"
                    style={{ width: `${Math.max(5, item.porcentagem)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Coluna 2: Origem dos Cliques no WhatsApp & Cidades */}
        <div className="lg:col-span-5 space-y-5">
          
          {/* Origem dos Cliques no WhatsApp */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
            <h4 className="text-sm font-extrabold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-2">
              <MessageSquare className="w-4 h-4 text-emerald-600" />
              <span>Onde os Clientes Clicam no WhatsApp</span>
            </h4>
            
            <div className="space-y-2.5">
              {data.origemCliquesWhatsapp.map((origem) => (
                <div key={origem.origem} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700">{origem.origem}</span>
                    <span className="font-mono text-emerald-700 font-bold">{origem.total} cliques ({origem.porcentagem}%)</span>
                  </div>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-emerald-500 rounded-full"
                      style={{ width: `${Math.max(6, origem.porcentagem)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Principais Cidades dos Orçamentos */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
            <h4 className="text-sm font-extrabold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-2">
              <MapPin className="w-4 h-4 text-[#d31010]" />
              <span>Regiões com Maior Volume de Orçamentos</span>
            </h4>

            <div className="space-y-2">
              {data.principaisCidades.map((cid, i) => (
                <div key={cid.cidade} className="flex items-center justify-between text-xs p-2 rounded bg-slate-50 border border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-slate-400">0{i+1}.</span>
                    <span className="font-bold text-slate-800">{cid.cidade}</span>
                  </div>
                  <span className="font-mono text-xs font-semibold text-[#003882]">
                    {cid.total} pedidos ({cid.porcentagem}%)
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Dispositivos */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-around text-center text-xs">
            <div className="space-y-1">
              <Smartphone className="w-5 h-5 mx-auto text-emerald-600" />
              <div className="font-bold text-slate-800">{data.distribuicaoDispositivos.mobile} acessos</div>
              <div className="text-[10px] text-slate-500 uppercase font-semibold">Mobile ({data.distribuicaoDispositivos.percentualMobile}%)</div>
            </div>
            <div className="h-8 w-px bg-slate-200" />
            <div className="space-y-1">
              <Monitor className="w-5 h-5 mx-auto text-[#003882]" />
              <div className="font-bold text-slate-800">{data.distribuicaoDispositivos.desktop} acessos</div>
              <div className="text-[10px] text-slate-500 uppercase font-semibold">Desktop ({100 - data.distribuicaoDispositivos.percentualMobile}%)</div>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};

export const AdminDashboard = ExecutiveDashboard;
export default ExecutiveDashboard;
