import React, { useState } from 'react';
import {
  BarChart3, TrendingUp, Users, MessageSquare, FileText,
  Smartphone, Monitor, MapPin, Flame, Filter, RefreshCw, Inbox
} from 'lucide-react';
import { ExecutiveDashboardData, MonthlyExecutiveMetric } from '../types';

interface ExecutiveDashboardProps {
  data: ExecutiveDashboardData | null;
  isLoading: boolean;
  onRefresh: () => void;
}

const fmt = (n: number) => n.toLocaleString('pt-BR');

// Chave do mês atual no formato do servidor (AAAA-MM)
const currentMonthKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const hasActivity = (m: MonthlyExecutiveMetric) => m.visitas + m.orcamentos + m.cliquesWhatsapp > 0;

// Largura da barra: zero fica vazio; valor pequeno ainda aparece (mín. 3%)
const barWidth = (value: number, max: number) => (value <= 0 || max <= 0 ? 0 : Math.max(3, (value / max) * 100));

const Card: React.FC<{ className?: string; children: React.ReactNode }> = ({ className = '', children }) => (
  <section className={`bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${className}`}>{children}</section>
);

const CardHeader: React.FC<{ icon: React.ReactNode; title: string; subtitle?: string; aside?: React.ReactNode }> = ({ icon, title, subtitle, aside }) => (
  <header className="flex items-start justify-between gap-3 px-5 pt-5 pb-4">
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0">{icon}</div>
      <div>
        <h4 className="text-sm font-extrabold text-slate-900 leading-tight">{title}</h4>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
    </div>
    {aside}
  </header>
);

const Empty: React.FC<{ text: string; hint?: string }> = ({ text, hint }) => (
  <div className="mx-5 mb-5 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 py-8 px-4 text-center">
    <Inbox className="w-6 h-6 mx-auto text-slate-300" />
    <p className="mt-2 text-xs font-bold text-slate-600">{text}</p>
    {hint && <p className="mt-0.5 text-[11px] text-slate-400">{hint}</p>}
  </div>
);

const Bar: React.FC<{ value: number; max: number; color: string; label: string }> = ({ value, max, color, label }) => (
  <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden" role="img" aria-label={label} title={label}>
    <div className={`h-full rounded-full ${color} transition-[width] duration-500`} style={{ width: `${barWidth(value, max)}%` }} />
  </div>
);

export const ExecutiveDashboard: React.FC<ExecutiveDashboardProps> = ({ data, isLoading, onRefresh }) => {
  const [selectedMonthKey, setSelectedMonthKey] = useState<string>('todos');

  if (isLoading && !data) {
    return (
      <div className="py-20 text-center space-y-3">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto text-[#004b9c]" />
        <p className="text-sm font-semibold text-slate-700">Carregando métricas...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="py-16 text-center bg-white rounded-2xl border border-slate-200">
        <p className="text-sm font-bold text-slate-700">Não foi possível carregar as métricas.</p>
        <button
          onClick={onRefresh}
          className="mt-3 px-4 py-2 bg-[#004b9c] text-white text-xs font-bold rounded-lg cursor-pointer"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  const nowKey = currentMonthKey();
  // Só meses com algum registro; o mais recente primeiro
  const months = data.historicoMensal.filter(hasActivity).slice().reverse();

  const isAllMonths = selectedMonthKey === 'todos';
  const selected: MonthlyExecutiveMetric | undefined = isAllMonths
    ? undefined
    : data.historicoMensal.find((m) => m.chave === selectedMonthKey);

  const acessos = isAllMonths ? data.resumoGeral.totalAcessos : selected?.visitas || 0;
  const orcamentos = isAllMonths ? data.resumoGeral.totalOrcamentos : selected?.orcamentos || 0;
  const cliques = isAllMonths ? data.resumoGeral.totalCliquesWhatsapp : selected?.cliquesWhatsapp || 0;
  const pct = (part: number) => (acessos > 0 ? Number(((part / acessos) * 100).toFixed(1)) : 0);
  const conversao = isAllMonths ? data.resumoGeral.taxaConversaoGeral : selected?.conversao || 0;
  const taxaOrcamento = (isAllMonths ? data.resumoGeral.taxaOrcamentos : selected?.taxaOrcamento) ?? pct(orcamentos);
  const taxaWhatsapp = (isAllMonths ? data.resumoGeral.taxaCliquesWhatsapp : selected?.taxaWhatsapp) ?? pct(cliques);
  const periodo = isAllMonths ? 'desde o início' : `em ${selected?.mes}`;

  // Cada métrica tem a própria escala: acessos são muito maiores que orçamentos e cliques
  const maxVisitas = Math.max(0, ...months.map((m) => m.visitas));
  const maxOrcamentos = Math.max(0, ...months.map((m) => m.orcamentos));
  const maxCliques = Math.max(0, ...months.map((m) => m.cliquesWhatsapp));

  const materiais = data.materiaisMaisSolicitados.filter((m) => m.totalSolicitacoes > 0);
  const maxMaterial = Math.max(0, ...materiais.map((m) => m.totalSolicitacoes));
  const origens = data.origemCliquesWhatsapp.filter((o) => o.total > 0);
  const maxOrigem = Math.max(0, ...origens.map((o) => o.total));
  const cidades = data.principaisCidades.filter((c) => c.total > 0);
  const disp = data.distribuicaoDispositivos;
  const totalDisp = disp.mobile + disp.desktop;

  const kpis = [
    {
      label: 'Acessos',
      value: fmt(acessos),
      icon: <Users className="w-4 h-4" />,
      tone: 'text-[#004b9c] bg-blue-50 border-blue-100',
      foot: `${fmt(data.resumoGeral.acessosHoje)} hoje${totalDisp ? ` · ${disp.percentualMobile}% no celular` : ''}`
    },
    {
      label: 'Orçamentos',
      value: fmt(orcamentos),
      icon: <FileText className="w-4 h-4" />,
      tone: 'text-amber-600 bg-amber-50 border-amber-100',
      foot: `${fmt(data.resumoGeral.orcamentosHoje)} hoje · ${taxaOrcamento}% dos acessos`
    },
    {
      label: 'Cliques no WhatsApp',
      value: fmt(cliques),
      icon: <MessageSquare className="w-4 h-4" />,
      tone: 'text-emerald-600 bg-emerald-50 border-emerald-100',
      foot: `${fmt(data.resumoGeral.cliquesWhatsappHoje)} hoje · ${taxaWhatsapp}% dos acessos`
    },
    {
      label: 'Conversão',
      value: `${conversao}%`,
      icon: <TrendingUp className="w-4 h-4" />,
      tone: 'text-indigo-600 bg-indigo-50 border-indigo-100',
      foot: `${fmt(orcamentos + cliques)} contatos em ${fmt(acessos)} acessos`
    }
  ];

  return (
    <div className="space-y-5">
      {/* Cabeçalho e filtro de período */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h3 className="text-lg font-black text-slate-900 tracking-tight">Visão geral</h3>
          <p className="text-xs text-slate-500">Acessos ao site, pedidos de orçamento e cliques no WhatsApp.</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span className="sr-only">Período</span>
            <select
              value={selectedMonthKey}
              onChange={(e) => setSelectedMonthKey(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-800 outline-none cursor-pointer"
            >
              <option value="todos">Todo o período</option>
              {months.map((m) => (
                <option key={m.chave} value={m.chave}>
                  {m.mes}{m.chave === nowKey ? ' (mês atual)' : ''}
                </option>
              ))}
            </select>
          </label>
          <button
            onClick={onRefresh}
            className="p-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer"
            title="Recarregar métricas"
            aria-label="Recarregar métricas"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Indicadores principais */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {kpis.map((k) => (
          <Card key={k.label} className="p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{k.label}</span>
              <span className={`w-7 h-7 rounded-lg border flex items-center justify-center ${k.tone}`}>{k.icon}</span>
            </div>
            <div className="mt-2 text-2xl sm:text-3xl font-black text-slate-900 tracking-tight tabular-nums">{k.value}</div>
            <div className="mt-1 text-[11px] text-slate-500 leading-snug">{k.foot}</div>
          </Card>
        ))}
      </div>
      <p className="-mt-2 text-[11px] text-slate-400">Valores {periodo}.</p>

      {/* Evolução mês a mês: só meses com registro */}
      <Card>
        <CardHeader
          icon={<BarChart3 className="w-4 h-4 text-[#004b9c]" />}
          title="Mês a mês"
          subtitle="Cada coluna tem a própria escala. Meses sem registro não aparecem."
        />
        {months.length === 0 ? (
          <Empty text="Ainda não há registros." hint="Os números aparecem aqui assim que o site receber acessos." />
        ) : (
          <div className="px-5 pb-5 overflow-x-auto">
            <table className="w-full min-w-[520px] text-xs">
              <thead>
                <tr className="text-[11px] uppercase tracking-wider text-slate-400">
                  <th scope="col" className="text-left font-bold pb-2 w-24">Mês</th>
                  <th scope="col" className="text-left font-bold pb-2 pl-3">
                    <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-[#004b9c]" />Acessos</span>
                  </th>
                  <th scope="col" className="text-left font-bold pb-2 pl-3">
                    <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-amber-500" />Orçamentos</span>
                  </th>
                  <th scope="col" className="text-left font-bold pb-2 pl-3">
                    <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-emerald-500" />WhatsApp</span>
                  </th>
                  <th scope="col" className="text-right font-bold pb-2 pl-3 w-20">Conversão</th>
                </tr>
              </thead>
              <tbody>
                {months.map((m) => {
                  const active = selectedMonthKey === m.chave;
                  return (
                    <tr
                      key={m.chave}
                      onClick={() => setSelectedMonthKey(active ? 'todos' : m.chave)}
                      className={`border-t border-slate-100 cursor-pointer transition-colors ${active ? 'bg-blue-50/60' : 'hover:bg-slate-50'}`}
                    >
                      <th scope="row" className="text-left py-3 pr-2 font-bold text-slate-900 whitespace-nowrap">
                        {m.mes}
                        {m.chave === nowKey && <span className="ml-1.5 text-[10px] font-semibold text-[#004b9c]">atual</span>}
                      </th>
                      {[
                        { v: m.visitas, max: maxVisitas, color: 'bg-[#004b9c]', name: 'acessos' },
                        { v: m.orcamentos, max: maxOrcamentos, color: 'bg-amber-500', name: 'orçamentos' },
                        { v: m.cliquesWhatsapp, max: maxCliques, color: 'bg-emerald-500', name: 'cliques no WhatsApp' }
                      ].map((c) => (
                        <td key={c.name} className="py-3 pl-3">
                          <div className="flex items-center gap-2">
                            <span className={`w-10 shrink-0 font-bold tabular-nums ${c.v ? 'text-slate-800' : 'text-slate-300'}`}>{fmt(c.v)}</span>
                            <Bar value={c.v} max={c.max} color={c.color} label={`${m.mes}: ${fmt(c.v)} ${c.name}`} />
                          </div>
                        </td>
                      ))}
                      <td className="py-3 pl-3 text-right font-bold tabular-nums text-slate-700">{m.conversao}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Materiais mais pedidos */}
        <Card className="lg:col-span-7">
          <CardHeader
            icon={<Flame className="w-4 h-4 text-[#d31010]" />}
            title="Materiais mais pedidos"
            subtitle="Categorias que mais aparecem nas listas dos orçamentos."
            aside={materiais.length > 0 ? <span className="text-[11px] font-bold text-slate-400 whitespace-nowrap">{fmt(data.resumoGeral.totalOrcamentos)} pedidos</span> : undefined}
          />
          {materiais.length === 0 ? (
            <Empty text="Nenhum orçamento recebido ainda." hint="O ranking aparece quando chegarem os primeiros pedidos." />
          ) : (
            <ol className="px-5 pb-5 space-y-3">
              {materiais.map((item, idx) => (
                <li key={item.nome} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`w-5 h-5 shrink-0 rounded-full text-[10px] font-bold flex items-center justify-center ${idx === 0 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>
                        {idx + 1}
                      </span>
                      <span className="font-semibold text-slate-800 truncate">{item.nome}</span>
                    </div>
                    <span className="shrink-0 tabular-nums text-slate-700">
                      <strong>{fmt(item.totalSolicitacoes)}</strong> <span className="text-slate-400">· {item.porcentagem}%</span>
                    </span>
                  </div>
                  <Bar value={item.totalSolicitacoes} max={maxMaterial} color="bg-[#004b9c]" label={`${item.nome}: ${item.totalSolicitacoes} pedidos`} />
                </li>
              ))}
            </ol>
          )}
        </Card>

        <div className="lg:col-span-5 space-y-5">
          {/* Origem dos cliques no WhatsApp */}
          <Card>
            <CardHeader icon={<MessageSquare className="w-4 h-4 text-emerald-600" />} title="Onde clicam no WhatsApp" />
            {origens.length === 0 ? (
              <Empty text="Nenhum clique no WhatsApp ainda." />
            ) : (
              <ul className="px-5 pb-5 space-y-2.5">
                {origens.map((o) => (
                  <li key={o.origem} className="space-y-1">
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <span className="text-slate-700 truncate">{o.origem}</span>
                      <span className="shrink-0 tabular-nums text-slate-700"><strong>{fmt(o.total)}</strong> <span className="text-slate-400">· {o.porcentagem}%</span></span>
                    </div>
                    <Bar value={o.total} max={maxOrigem} color="bg-emerald-500" label={`${o.origem}: ${o.total} cliques`} />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Regiões */}
          <Card>
            <CardHeader icon={<MapPin className="w-4 h-4 text-[#d31010]" />} title="Regiões dos orçamentos" />
            {cidades.length === 0 ? (
              <Empty text="Nenhuma região registrada ainda." />
            ) : (
              <ol className="px-5 pb-5 divide-y divide-slate-100">
                {cidades.map((c, i) => (
                  <li key={c.cidade} className="flex items-center justify-between gap-3 py-2 text-xs">
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="text-[11px] font-bold text-slate-400 tabular-nums">{i + 1}</span>
                      <span className="font-semibold text-slate-800 truncate">{c.cidade}</span>
                    </span>
                    <span className="shrink-0 tabular-nums text-slate-700"><strong>{fmt(c.total)}</strong> <span className="text-slate-400">· {c.porcentagem}%</span></span>
                  </li>
                ))}
              </ol>
            )}
          </Card>

          {/* Dispositivos */}
          {totalDisp > 0 && (
            <Card className="p-5">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="flex items-center gap-1.5 font-semibold text-slate-700">
                  <Smartphone className="w-4 h-4 text-emerald-600" /> Celular <strong className="tabular-nums">{disp.percentualMobile}%</strong>
                </span>
                <span className="flex items-center gap-1.5 font-semibold text-slate-700">
                  <strong className="tabular-nums">{100 - disp.percentualMobile}%</strong> Computador <Monitor className="w-4 h-4 text-[#004b9c]" />
                </span>
              </div>
              <div
                className="flex h-2.5 rounded-full overflow-hidden gap-0.5 bg-white"
                role="img"
                aria-label={`${fmt(disp.mobile)} acessos pelo celular e ${fmt(disp.desktop)} pelo computador`}
              >
                {disp.mobile > 0 && <div className="bg-emerald-500 rounded-full" style={{ width: `${(disp.mobile / totalDisp) * 100}%` }} title={`${fmt(disp.mobile)} pelo celular`} />}
                {disp.desktop > 0 && <div className="bg-[#004b9c] rounded-full" style={{ width: `${(disp.desktop / totalDisp) * 100}%` }} title={`${fmt(disp.desktop)} pelo computador`} />}
              </div>
              <div className="flex justify-between mt-1.5 text-[11px] text-slate-400 tabular-nums">
                <span>{fmt(disp.mobile)} acessos</span>
                <span>{fmt(disp.desktop)} acessos</span>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export const AdminDashboard = ExecutiveDashboard;
export default ExecutiveDashboard;
