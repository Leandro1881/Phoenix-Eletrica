import React, { useState, useEffect } from 'react';
import { 
  Database, RefreshCw, Calendar, Phone, MapPin, Package, 
  ExternalLink, Eye, ShieldCheck, Lock, LogOut, Key, Trash2, 
  Download, Search, CheckCircle2, AlertCircle, ArrowLeft, BarChart3,
  Home, Paperclip
} from 'lucide-react';
import { adminFetch, ADMIN_LOGOUT_EVENT, clearAdminSession, getAdminToken, getAdminUser, loginAdmin } from '../utils/adminAuth';
import { Lead, VisitasStats, ExecutiveDashboardData } from '../types';
import { AdminDashboard } from './AdminDashboard';
import { LeadsModal } from './LeadsModal';
import { PhoenixLogo } from './PhoenixLogo';


interface AdminPageProps {
  onNavigateHome: () => void;
}

export const AdminPage: React.FC<AdminPageProps> = ({ onNavigateHome }) => {
  // Sessão validada pelo servidor (token em sessionStorage)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => !!getAdminToken());
  const [adminUser, setAdminUser] = useState<string>(() => getAdminUser() || 'admin');
  const [isLeadsModalOpen, setIsLeadsModalOpen] = useState<boolean>(false);

  // Formulário de Login
  const [loginUser, setLoginUser] = useState<string>('admin');
  const [loginPass, setLoginPass] = useState<string>('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);

  // Estados de Troca de Senha
  const [senhaAtual, setSenhaAtual] = useState<string>('');
  const [novaSenha, setNovaSenha] = useState<string>('');
  const [novaSenhaConfirm, setNovaSenhaConfirm] = useState<string>('');
  const [passFeedback, setPassFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isChangingPass, setIsChangingPass] = useState<boolean>(false);

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

  // Login validado no servidor
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    const inputUser = loginUser.trim();
    const inputPass = loginPass.trim();

    if (!inputUser || !inputPass) {
      setLoginError('Por favor, informe seu usuário e sua senha.');
      return;
    }

    setIsLoggingIn(true);
    const result = await loginAdmin(inputUser, inputPass);
    setIsLoggingIn(false);
    if ('error' in result) {
      setLoginError(result.error);
      return;
    }
    setIsAuthenticated(true);
    setAdminUser(result.usuario);
    setLoginPass('');
  };

  // Handler de Logout
  const handleLogout = () => {
    clearAdminSession();
    setIsAuthenticated(false);
    setLoginPass('');
    setLoginError(null);
  };

  // Sessão expirada em qualquer requisição: volta para a tela de login
  useEffect(() => {
    const onLogout = () => setIsAuthenticated(false);
    window.addEventListener(ADMIN_LOGOUT_EVENT, onLogout);
    return () => window.removeEventListener(ADMIN_LOGOUT_EVENT, onLogout);
  }, []);

  // Handler de Troca de Senha
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassFeedback(null);

    if (!senhaAtual || !novaSenha || !novaSenhaConfirm) {
      setPassFeedback({ type: 'error', message: 'Preencha todos os campos do formulário.' });
      return;
    }

    if (novaSenha !== novaSenhaConfirm) {
      setPassFeedback({ type: 'error', message: 'A nova senha e a confirmação não conferem.' });
      return;
    }

    if (novaSenha.length < 10) {
      setPassFeedback({ type: 'error', message: 'A nova senha deve ter no mínimo 10 caracteres.' });
      return;
    }

    setIsChangingPass(true);
    try {
      const res = await adminFetch('/api/admin/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senhaAtual, novaSenha })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setPassFeedback({ type: 'success', message: 'Senha atualizada com sucesso no banco de dados e no sistema!' });
        setSenhaAtual('');
        setNovaSenha('');
        setNovaSenhaConfirm('');
      } else {
        setPassFeedback({ type: 'error', message: data.message || 'Falha ao alterar senha no servidor.' });
      }
    } catch (err: any) {
      setPassFeedback({ type: 'error', message: 'Erro ao conectar ao servidor. A senha não foi alterada.' });
    } finally {
      setIsChangingPass(false);
    }
  };

  // Excluir Lead
  const handleDeleteLead = async (id: number) => {
    if (!window.confirm(`Deseja realmente excluir o lead #${id}?`)) return;

    try {
      const res = await adminFetch(`/api/orcamentos/${id}`, { method: 'DELETE' });
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

    const headers = ['ID', 'Data/Hora', 'Cliente', 'Telefone', 'Cidade', 'Materiais Solicitados', 'Opt-in Marketing (LGPD)'];
    const rows = leads.map((l) => [
      l.id,
      `"${l.data_solicitacao}"`,
      `"${l.nome.replace(/"/g, '""')}"`,
      `"${l.telefone}"`,
      `"${l.cidade.replace(/"/g, '""')}"`,
      `"${l.materiais.replace(/"/g, '""')}"`,
      l.aceita_marketing === 1 || l.aceita_marketing === true ? '"Sim (Autorizado)"' : '"Não (Não Autorizado)"'
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

  // =========================================================================
  // TELA 1: PÁGINA DE LOGIN EM /admin (QUANDO NÃO AUTENTICADO)
  // =========================================================================
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#f0f4f9] flex flex-col justify-between items-center p-4">
        
        {/* Topo Limpo */}
        <div className="w-full max-w-md pt-6 flex items-center justify-between">
          <button
            onClick={onNavigateHome}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#003882] hover:text-[#00224d] transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Voltar para a Loja</span>
          </button>
          <span className="text-[11px] font-mono text-slate-400">/admin</span>
        </div>

        {/* Card Central de Login */}
        <div className="w-full max-w-md my-auto">
          <div className="bg-white border border-slate-300 rounded-2xl shadow-xl overflow-hidden relative">
            <div className="h-1.5 bg-gradient-to-r from-[#003882] via-[#004b9c] to-[#d31010]" />

            <div className="p-6 sm:p-8 space-y-6">
              
              {/* Logo e Cabeçalho */}
              <div className="text-center space-y-2">
                <div className="w-14 h-14 rounded-2xl bg-blue-50 text-[#003882] border border-blue-200 flex items-center justify-center mx-auto shadow-2xs">
                  <Lock className="w-7 h-7" />
                </div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                  Painel do Lojista
                </h1>
                <p className="text-xs text-slate-500 max-w-xs mx-auto">
                  Acesso executivo restrito aos administradores da <strong>Phoenix Elétrica</strong>.
                </p>
              </div>

              {/* Alerta de Erro */}
              {loginError && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                  <span>{loginError}</span>
                </div>
              )}

              {/* Formulário de Login */}
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                    Usuário Master
                  </label>
                  <input
                    type="text"
                    value={loginUser}
                    onChange={(e) => setLoginUser(e.target.value)}
                    placeholder="admin"
                    required
                    autoFocus
                    className="w-full bg-slate-50 focus:bg-white border border-slate-300 focus:border-[#004b9c] focus:ring-2 focus:ring-blue-100 rounded-lg px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                    Senha de Acesso
                  </label>
                  <input
                    type="password"
                    value={loginPass}
                    onChange={(e) => setLoginPass(e.target.value)}
                    placeholder="Digite sua senha"
                    required
                    className="w-full bg-slate-50 focus:bg-white border border-slate-300 focus:border-[#004b9c] focus:ring-2 focus:ring-blue-100 rounded-lg px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 outline-none transition-all"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoggingIn}
                  className="w-full inline-flex items-center justify-center gap-2 bg-[#004b9c] hover:bg-[#003882] text-white font-bold text-sm py-3 px-4 rounded-lg shadow-sm transition-all cursor-pointer disabled:opacity-50"
                >
                  {isLoggingIn ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Validando Acesso...</span>
                    </>
                  ) : (
                    <>
                      <Key className="w-4 h-4" />
                      <span>Entrar no Painel Executivo</span>
                    </>
                  )}
                </button>
              </form>

            </div>
          </div>
        </div>

        {/* Rodapé da Tela de Login */}
        <div className="py-4 text-center text-xs text-slate-400">
          © 2026 Phoenix Elétrica · Distribuidora de Materiais Elétricos
        </div>

      </div>
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
  // TELA 2: PAINEL ADMINISTRATIVO COMPLETO (/admin AUTENTICADO)
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
              <span>Segurança & Senha Master</span>
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
                  onClick={() => setIsLeadsModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-50 hover:bg-blue-100 text-[#003882] border border-blue-200 text-xs font-bold shadow-2xs transition-colors cursor-pointer"
                  title="Abrir no modo LeadsModal"
                >
                  <Database className="w-3.5 h-3.5" />
                  <span>Modo LeadsModal</span>
                </button>

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
                                {lead.arquivo_url && (
                                  <a
                                    href={lead.arquivo_url.replace('http://localhost:3000', typeof window !== 'undefined' ? window.location.origin : '')}
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
          <div className="max-w-lg mx-auto bg-white p-6 sm:p-8 rounded-xl border border-slate-200 shadow-2xs space-y-5">
            <div className="flex items-center gap-3 border-b border-slate-200 pb-4">
              <div className="w-12 h-12 rounded-xl bg-blue-50 text-[#003882] flex items-center justify-center">
                <Key className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-base font-extrabold text-slate-900">Alterar Senha do Administrador</h4>
                <p className="text-xs text-slate-500">Altere a credencial master do usuário <strong className="text-slate-700">{adminUser}</strong>.</p>
              </div>
            </div>

            {passFeedback && (
              <div className={`p-3.5 rounded-lg text-xs flex items-center gap-2 ${
                passFeedback.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'
              }`}>
                {passFeedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                <span>{passFeedback.message}</span>
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Senha Atual:</label>
                <input
                  type="password"
                  value={senhaAtual}
                  onChange={(e) => setSenhaAtual(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:border-[#004b9c] outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Nova Senha (Mínimo 6 dígitos):</label>
                <input
                  type="password"
                  value={novaSenha}
                  onChange={(e) => setNovaSenha(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:border-[#004b9c] outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Confirmar Nova Senha:</label>
                <input
                  type="password"
                  value={novaSenhaConfirm}
                  onChange={(e) => setNovaSenhaConfirm(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:border-[#004b9c] outline-none"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isChangingPass}
                  className="w-full py-3 px-4 bg-[#004b9c] hover:bg-[#003882] text-white font-bold rounded-lg shadow-sm transition-colors cursor-pointer"
                >
                  {isChangingPass ? 'Atualizando senha no banco SQLite...' : 'Salvar Nova Senha'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* LeadsModal: Renderizado exclusivamente após autenticação bem-sucedida */}
        <LeadsModal
          isOpen={isLeadsModalOpen}
          onClose={() => {
            setIsLeadsModalOpen(false);
            fetchAllData();
          }}
        />

      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-500">
        Painel do Lojista · Phoenix Elétrica Distribuidora · Base de Dados SQLite
      </footer>

    </div>
  );
};
