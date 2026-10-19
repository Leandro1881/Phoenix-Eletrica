import React, { useState, useEffect } from 'react';
import { 
  Database, RefreshCw, Calendar, Phone, MapPin, Package, 
  ExternalLink, Eye, ShieldCheck, Lock, LogOut, Key, Trash2, 
  Download, Search, CheckCircle2, AlertCircle, ArrowLeft, BarChart3,
  Home, Paperclip
} from 'lucide-react';
import { adminFetch, ADMIN_LOGOUT_EVENT, fetchAdminSession, logoutAdmin } from '../utils/adminAuth';
import { Lead, VisitasStats, ExecutiveDashboardData } from '../types';
import { AdminDashboard } from './AdminDashboard';
import { AdminLogin } from './AdminLogin';
import { AdminSecurity } from './AdminSecurity';


// Link de anexo só abre se for do armazenamento de anexos ou da própria loja (nunca javascript: ou site externo)
const safeFileUrl = (url?: string | null): string | undefined => {
  if (!url) return undefined;
  if (/^https:\/\/storage\.googleapis\.com\/[\w.-]+\/orcamentos\//.test(url)) return url;
  if (url.startsWith(window.location.origin + '/uploads/')) return url;
  return undefined;
};

interface AdminPageProps {
  onNavigateHome: () => void;
}

export const AdminPage: React.FC<AdminPageProps> = ({ onNavigateHome }) => {
  // Sessão em cookie HttpOnly validada pelo servidor; null enquanto confere
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [adminUser, setAdminUser] = useState<string>('');

  useEffect(() => {
    fetchAdminSession().then((session) => {
      setIsAuthenticated(!!session);
      if (session) setAdminUser(session.usuario);
    });
  }, []);

  // Estados do Painel
  const [activeTab, setActiveTab] = useState<'dashboard' | 'leads' | 'visitas' | 'seguranca'>('dashboard');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [visitasStats, setVisitasStats] = useState<VisitasStats | null>(null);
  const [dashboardData, setDashboardData] = useState<ExecutiveDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchLead, setSearchLead] = useState('');

  // Carrega todos os dados do painel
  const fetchAllData = async () => {
    if (!isAuthenticated) return;
    setIsLoading(true);
    setError(null);
    try {
      // 1. Dashboard Executivo Consolidado
      const resDash = await adminFetch('/api/admin/dashboard');
      if (resDash.ok) {
        const dData = await resDash.json();
        setDashboardData(dData);
      }

      // 2. Orçamentos Recebidos
      const resLeads = await adminFetch('/api/orcamentos');
      if (resLeads.ok) {
        const lData = await resLeads.json();
        setLeads(lData.leads || []);
      }

      // 3. Acessos ao Site
      const resVisitas = await adminFetch('/api/visitas');
      if (resVisitas.ok) {
        const vData = await resVisitas.json();
        setVisitasStats(vData);
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar dados do servidor');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchAllData();
    }
  }, [isAuthenticated]);

  const handleLogout = async () => {
    await logoutAdmin();
    setIsAuthenticated(false);
  };

  // Sessão expirada em qualquer requisição: volta para a tela de login
  useEffect(() => {
    const onLogout = () => setIsAuthenticated(false);
    window.addEventListener(ADMIN_LOGOUT_EVENT, onLogout);
    return () => window.removeEventListener(ADMIN_LOGOUT_EVENT, onLogout);
  }, []);

  // Excluir Lead
  const handleDeleteLead = async (id: number) => {
    if (!window.confirm(`Deseja realmente excluir o lead #${id}?`)) return;

    try {
      const res = await adminFetch(`/api/orcamentos/${id}`, { method: 'DELETE', body: '{}' });
      if (res.ok) {
        setLeads((prev) => prev.filter((l) => l.id !== id));
        fetchAllData();
      }
    } catch (e) {
      alert('Erro ao excluir lead.');
    }
  };

  // Exportar Leads para CSV
  const handleExportCSV = () => {
    if (leads.length === 0) {
      alert('Não há orçamentos registrados para exportar.');
      return;
    }

    // Célula começando com = + - @ vira fórmula no Excel: prefixa com apóstrofo (CSV injection)
    const cell = (value: unknown) => {
      let v = String(value ?? '');
      if (/^[=+\-@\t\r]/.test(v)) v = "'" + v;
      return '"' + v.replace(/"/g, '""') + '"';
    };
    const headers = ['ID', 'Data/Hora', 'Cliente', 'Telefone', 'Cidade', 'Materiais Solicitados', 'Opt-in Marketing (LGPD)'];
    const rows = leads.map((l) => [
      l.id,
      cell(l.data_solicitacao),
      cell(l.nome),
      cell(l.telefone),
      cell(l.cidade),
      cell(l.materiais),
      cell(l.aceita_marketing === 1 || l.aceita_marketing === true ? 'Sim (Autorizado)' : 'Não (Não Autorizado)')
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `orcamentos_phoenix_eletrica_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isAuthenticated === null) {
    return <div className="min-h-screen bg-[#00122e]" aria-busy="true" />;
  }

  if (!isAuthenticated) {
    return (
      <AdminLogin
        onNavigateHome={onNavigateHome}
        onAuthenticated={(usuario) => {
          setAdminUser(usuario);
          setIsAuthenticated(true);
        }}
      />
    );
  }

  // Filtro de orçamentos
  const filteredLeads = leads.filter((l) => {
    if (!searchLead) return true;
    const term = searchLead.toLowerCase();
    return (
      l.nome.toLowerCase().includes(term) ||
      l.telefone.includes(term) ||
      l.cidade.toLowerCase().includes(term) ||
      l.materiais.toLowerCase().includes(term)
    );
  });

  // =========================================================================
  // TELA 2: PAINEL ADMINISTRATIVO COMPLETO (AUTENTICADO)
  // =========================================================================
  return (
    <div className="min-h-screen bg-[#f1f5f9] text-slate-800 flex flex-col">
      
      {/* Header Executivo do Painel */}
      <header className="bg-[#00224d] text-white border-b-4 border-[#d31010] sticky top-0 z-40 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-4">
          
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-white/10 text-yellow-300 flex items-center justify-center border border-white/10">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-black tracking-tight text-white">
                  Painel do Lojista
                </h1>
                <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-400/40">
                  {adminUser}
                </span>
              </div>
              <p className="text-[11px] text-blue-200">
                Phoenix Elétrica · Distribuidora de Materiais Elétricos
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={fetchAllData}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-blue-100 hover:text-white text-xs font-semibold transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Atualizar Dados</span>
            </button>

            <button
              onClick={onNavigateHome}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-900/60 hover:bg-blue-900 text-blue-100 hover:text-white text-xs font-semibold border border-blue-700/60 transition-colors cursor-pointer"
            >
              <Home className="w-3.5 h-3.5" />
              <span>Ver Loja</span>
            </button>

            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sair</span>
            </button>
          </div>

        </div>

        {/* Barra de Abas do Painel */}
        <div className="bg-[#001838] px-4 sm:px-8 border-t border-blue-900/60">
          <div className="max-w-7xl mx-auto flex items-center gap-2 overflow-x-auto no-scrollbar">
            
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`px-4 py-3 text-xs font-bold tracking-wide border-b-2 transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'dashboard'
                  ? 'border-yellow-400 text-yellow-300 bg-white/5'
                  : 'border-transparent text-slate-300 hover:text-white'
              }`}
            >
              <BarChart3 className="w-4 h-4 text-yellow-400" />
              <span>Dashboard Executivo (Mês a Mês)</span>
            </button>

            <button
              onClick={() => setActiveTab('leads')}
              className={`px-4 py-3 text-xs font-bold tracking-wide border-b-2 transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'leads'
                  ? 'border-yellow-400 text-yellow-300 bg-white/5'
                  : 'border-transparent text-slate-300 hover:text-white'
              }`}
            >
              <Package className="w-4 h-4 text-blue-300" />
              <span>Orçamentos Recebidos</span>
              <span className="text-[10px] bg-blue-800 text-blue-200 px-1.5 py-0.5 rounded-full font-mono font-bold">
                {leads.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('visitas')}
              className={`px-4 py-3 text-xs font-bold tracking-wide border-b-2 transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'visitas'
                  ? 'border-yellow-400 text-yellow-300 bg-white/5'
                  : 'border-transparent text-slate-300 hover:text-white'
              }`}
            >
              <Eye className="w-4 h-4 text-emerald-400" />
              <span>Acessos & Visitas</span>
              {visitasStats && (
                <span className="text-[10px] bg-emerald-950 text-emerald-300 px-1.5 py-0.5 rounded-full font-mono font-bold">
                  {visitasStats.total}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('seguranca')}
              className={`px-4 py-3 text-xs font-bold tracking-wide border-b-2 transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'seguranca'
                  ? 'border-yellow-400 text-yellow-300 bg-white/5'
                  : 'border-transparent text-slate-300 hover:text-white'
              }`}
            >
              <ShieldCheck className="w-4 h-4 text-indigo-400" />
              <span>Segurança</span>
            </button>

          </div>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        
        {error && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
        )}

        {/* =========================================================================
            ABA 1: DASHBOARD EXECUTIVO POR MÊS (AdminDashboard)
            ========================================================================= */}
        {activeTab === 'dashboard' && (
          <AdminDashboard
            data={dashboardData}
            isLoading={isLoading}
            onRefresh={fetchAllData}
          />
        )}

        {/* =========================================================================
            ABA 2: ORÇAMENTOS RECEBIDOS (LEADS)
            ========================================================================= */}
        {activeTab === 'leads' && (
          <div className="space-y-4">
            
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Filtrar por nome, telefone, cidade ou material..."
                  value={searchLead}
                  onChange={(e) => setSearchLead(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:border-[#004b9c] outline-none"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportCSV}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-2xs transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Exportar Planilha (.CSV)</span>
                </button>
              </div>
            </div>

            {filteredLeads.length === 0 ? (
              <div className="py-16 text-center bg-white rounded-xl border border-slate-200">
                <p className="text-sm font-bold text-slate-700">Nenhum orçamento encontrado.</p>
                <p className="text-xs text-slate-500 mt-1">Os orçamentos enviados pelos clientes no site aparecerão aqui automaticamente.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredLeads.map((lead) => {
                  const cleanPhone = lead.telefone.replace(/\D/g, '');
                  const whatsappUrl = `https://wa.me/55${cleanPhone}?text=Ol%C3%A1%20${encodeURIComponent(lead.nome)}!%20Aqui%20%C3%A9%20da%20Phoenix%20El%C3%A9trica.%20Recebemos%20sua%20solicita%C3%A7%C3%A3o%20de%20or%C3%A7amento%20e%20j%C3%A1%20estamos%20com%20sua%20lista.`;

                  return (
                    <div 
                      key={lead.id} 
                      className="p-5 rounded-xl bg-white border border-slate-200 shadow-2xs hover:border-[#004b9c] transition-colors space-y-3.5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2.5">
                          <span className="text-xs font-mono font-bold text-[#003882] bg-blue-50 px-2.5 py-1 rounded border border-blue-200">
                            #{lead.id}
                          </span>
                          <h4 className="text-sm font-bold text-slate-900">{lead.nome}</h4>
                          {lead.aceita_marketing === 1 || lead.aceita_marketing === true ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1" title="Cliente autorizou envio de e-mails de marketing">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              LGPD: Opt-in Ativo
                            </span>
                          ) : (
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200 flex items-center gap-1" title="Cliente não autorizou e-mails de marketing">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                              Sem Opt-in
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            <span>{lead.data_solicitacao}</span>
                          </span>
                          
                          <a
                            href={whatsappUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-white font-bold bg-[#25D366] hover:bg-[#20ba5a] px-3 py-1 rounded-md shadow-2xs transition-colors"
                            title="Conversar com este cliente no WhatsApp"
                          >
                            <Phone className="w-3.5 h-3.5 fill-current" />
                            <span>{lead.telefone}</span>
                            <ExternalLink className="w-3 h-3 ml-0.5" />
                          </a>

                          <button
                            onClick={() => handleDeleteLead(lead.id)}
                            className="p-1.5 text-slate-400 hover:text-red-600 rounded transition-colors cursor-pointer"
                            title="Excluir este orçamento"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 text-xs">
                        <div className="sm:col-span-3 text-slate-500">
                          <div className="flex items-center gap-1 text-slate-700 font-semibold mb-0.5">
                            <MapPin className="w-3.5 h-3.5 text-[#d31010]" />
                            <span>Cidade / Região:</span>
                          </div>
                          <span className="text-slate-800 font-medium">{lead.cidade}</span>
                        </div>

                        <div className="sm:col-span-9">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-slate-700 font-semibold block">Materiais Solicitados:</span>
                            {lead.arquivo_nome && (
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                                  <Paperclip className="w-3 h-3 text-[#004b9c]" />
                                  <span>Anexo: {lead.arquivo_nome} {lead.arquivo_tamanho ? `(${lead.arquivo_tamanho})` : ''}</span>
                                </span>
                                {safeFileUrl(lead.arquivo_url) && (
                                  <a
                                    href={safeFileUrl(lead.arquivo_url)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-[11px] font-bold text-[#004b9c] hover:text-white hover:bg-[#004b9c] bg-white px-2 py-0.5 rounded border border-blue-300 transition-colors shadow-2xs"
                                    title="Abrir / Baixar arquivo do orçamento"
                                  >
                                    <Download className="w-3 h-3" />
                                    <span>Baixar Arquivo</span>
                                  </a>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-slate-800 font-mono text-xs leading-relaxed whitespace-pre-wrap">
                            {lead.materiais}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

          </div>
        )}

        {/* =========================================================================
            ABA 3: VISITAS & TRÁFEGO
            ========================================================================= */}
        {activeTab === 'visitas' && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs text-center">
                <div className="text-3xl font-black text-[#003882]">{visitasStats?.total || 0}</div>
                <div className="text-xs text-slate-500 uppercase font-bold mt-1">Total de Visitas</div>
              </div>

              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs text-center">
                <div className="text-3xl font-black text-[#d31010]">{visitasStats?.hoje || 0}</div>
                <div className="text-xs text-slate-500 uppercase font-bold mt-1">Acessos Hoje</div>
              </div>

              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs text-center">
                <div className="text-3xl font-black text-emerald-600">{visitasStats?.mobile || 0}</div>
                <div className="text-xs text-slate-500 uppercase font-bold mt-1">Acessos Mobile</div>
              </div>

              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs text-center">
                <div className="text-3xl font-black text-indigo-600">{visitasStats?.desktop || 0}</div>
                <div className="text-xs text-slate-500 uppercase font-bold mt-1">Acessos Desktop</div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between text-xs font-bold text-slate-700">
                <span>Registros Recentes de Acesso ao Site</span>
                <span className="text-slate-400 font-normal">Armazenados em SQLite</span>
              </div>
              <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto text-xs">
                {visitasStats?.visitas && visitasStats.visitas.length > 0 ? (
                  visitasStats.visitas.map((v) => (
                    <div key={v.id} className="p-3.5 flex items-center justify-between hover:bg-slate-50">
                      <div className="flex items-center gap-3">
                        <span className="text-slate-400 font-mono text-[11px]">{v.data_hora}</span>
                        <span className="font-bold text-slate-800">{v.dispositivo}</span>
                        <span className="text-slate-500">· {v.navegador}</span>
                      </div>
                      <span className="text-[11px] text-slate-400 truncate max-w-sm">{v.origem}</span>
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center text-slate-400">Nenhum acesso registrado.</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            ABA 4: SEGURANÇA & ALTERAR SENHA
            ========================================================================= */}
        {activeTab === 'seguranca' && (
          <AdminSecurity adminUser={adminUser} onLoggedOut={() => setIsAuthenticated(false)} />
        )}

      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-500">
        Painel do Lojista · Phoenix Elétrica · Acesso restrito e monitorado
      </footer>

    </div>
  );
};
