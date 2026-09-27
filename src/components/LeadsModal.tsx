import React, { useState, useEffect } from 'react';
import { 
  X, Database, RefreshCw, Calendar, Phone, MapPin, Package, 
  ExternalLink, Eye, Smartphone, Monitor, Globe, BarChart2, 
  ShieldCheck, Lock, LogOut, Key, Trash2, Download, Search, CheckCircle2, AlertCircle,
  BarChart3, Maximize2, Paperclip
} from 'lucide-react';
import { Lead, VisitasStats, ExecutiveDashboardData } from '../types';
import { ExecutiveDashboard } from './ExecutiveDashboard';

interface LeadsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenFullScreen?: () => void;
}

export const LeadsModal: React.FC<LeadsModalProps> = ({ isOpen, onClose, onOpenFullScreen }) => {
  // Estado de Autenticação Administrativa via localStorage
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem('phoenix_admin_auth') === 'true';
  });
  const [adminUser, setAdminUser] = useState<string>(() => {
    return localStorage.getItem('phoenix_admin_user') || 'admin';
  });
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
  const [activeTab, setActiveTab] = useState<'dashboard' | 'leads' | 'visitas' | 'seguranca' | 'como_monitorar'>('dashboard');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [visitasStats, setVisitasStats] = useState<VisitasStats | null>(null);
  const [dashboardData, setDashboardData] = useState<ExecutiveDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchLead, setSearchLead] = useState('');

  // Verifica se já estava logado no localStorage
  useEffect(() => {
    const authSaved = localStorage.getItem('phoenix_admin_auth');
    const userSaved = localStorage.getItem('phoenix_admin_user');
    if (authSaved === 'true') {
      setIsAuthenticated(true);
      if (userSaved) setAdminUser(userSaved);
    }
  }, [isOpen]);

  const fetchData = async () => {
    if (!isAuthenticated) return;
    setIsLoading(true);
    setError(null);
    try {
      // 1. Carrega Métricas Executivas
      const resDash = await fetch('/api/admin/dashboard');
      if (resDash.ok) {
        const dData = await resDash.json();
        setDashboardData(dData);
      }

      // 2. Carrega Leads
      const resLeads = await fetch('/api/orcamentos');
      if (resLeads.ok) {
        const data = await resLeads.json();
        setLeads(data.leads || []);
      }

      // 3. Carrega Estatísticas de Visitas/Acessos
      const resVisitas = await fetch('/api/visitas');
      if (resVisitas.ok) {
        const dataVisitas = await resVisitas.json();
        setVisitasStats(dataVisitas);
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao conectar à API');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && isAuthenticated) {
      fetchData();
    }
  }, [isOpen, isAuthenticated]);

  // Handler de Login do Administrador
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    const inputUser = loginUser.trim();
    const inputPass = loginPass.trim();

    if (!inputUser || !inputPass) {
      setLoginError('Preencha o usuário e a senha.');
      return;
    }

    setIsLoggingIn(true);
    try {
      const envPass = (import.meta as any).env?.VITE_ADMIN_PASSWORD || 'phoenix@2024';
      const envUser = (import.meta as any).env?.VITE_ADMIN_USER || 'admin';
      const storedPass = localStorage.getItem('phoenix_admin_password') || envPass;
      const storedUser = localStorage.getItem('phoenix_admin_user') || envUser;

      let backendSuccess = false;
      let returnedUser = inputUser;
      try {
        const res = await fetch('/api/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ usuario: inputUser, senha: inputPass })
        });
        const data = await res.json();
        if (res.ok && data.success) {
          backendSuccess = true;
          if (data.usuario) returnedUser = data.usuario;
          if (data.token) {
            localStorage.setItem('phoenix_admin_token', data.token);
          }
        }
      } catch (_) {}

      const isLocalValid = (inputPass === storedPass) &&
        (inputUser.toLowerCase() === storedUser.toLowerCase() || inputUser.toLowerCase() === 'admin');

      if (backendSuccess || isLocalValid) {
        setIsAuthenticated(true);
        setAdminUser(returnedUser);
        localStorage.setItem('phoenix_admin_auth', 'true');
        localStorage.setItem('phoenix_admin_user', returnedUser);
        localStorage.setItem('phoenix_admin_password', inputPass);
        setLoginPass('');
      } else {
        setLoginError('Credenciais inválidas.');
      }
    } catch (err: any) {
      setLoginError('Falha ao conectar com o servidor de autenticação.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Handler de Logout
  const handleLogout = () => {
    localStorage.removeItem('phoenix_admin_auth');
    localStorage.removeItem('phoenix_admin_user');
    localStorage.removeItem('phoenix_admin_token');
    setIsAuthenticated(false);
    setLoginPass('');
    setLoginError(null);
  };

  // Handler de Troca de Senha
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassFeedback(null);

    if (!senhaAtual || !novaSenha || !novaSenhaConfirm) {
      setPassFeedback({ type: 'error', message: 'Preencha todos os campos.' });
      return;
    }

    if (novaSenha !== novaSenhaConfirm) {
      setPassFeedback({ type: 'error', message: 'A confirmação de senha não confere.' });
      return;
    }

    if (novaSenha.length < 6) {
      setPassFeedback({ type: 'error', message: 'A nova senha deve ter no mínimo 6 dígitos.' });
      return;
    }

    setIsChangingPass(true);
    try {
      const res = await fetch('/api/admin/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usuario: adminUser,
          senhaAtual,
          novaSenha
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setPassFeedback({ type: 'success', message: 'Senha atualizada com sucesso!' });
        setSenhaAtual('');
        setNovaSenha('');
        setNovaSenhaConfirm('');
      } else {
        setPassFeedback({ type: 'error', message: data.message || 'Falha ao alterar senha.' });
      }
    } catch (err: any) {
      setPassFeedback({ type: 'error', message: 'Erro ao conectar à API de alteração de senha.' });
    } finally {
      setIsChangingPass(false);
    }
  };

  // Excluir Lead
  const handleDeleteLead = async (id: number) => {
    if (!window.confirm(`Deseja realmente excluir o lead #${id}?`)) return;

    try {
      const res = await fetch(`/api/orcamentos/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setLeads((prev) => prev.filter((l) => l.id !== id));
      }
    } catch (e) {
      alert('Erro ao excluir lead.');
    }
  };

  // Exportar Leads para CSV
  const handleExportCSV = () => {
    if (leads.length === 0) {
      alert('Não há orçamentos para exportar.');
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
    link.setAttribute('download', `leads_phoenix_eletrica_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isOpen) return null;

  // =========================================================================
  // TELA 1: TELA DE LOGIN DO ADMINISTRADOR (QUANDO NÃO AUTENTICADO)
  // =========================================================================
  if (!isAuthenticated) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-fadeIn">
        <div className="bg-white border border-slate-300 rounded-xl w-full max-w-md shadow-2xl overflow-hidden relative">
          
          {/* Faixa decorativa superior */}
          <div className="h-1.5 bg-gradient-to-r from-[#003882] via-[#004b9c] to-[#d31010]" />

          <div className="p-6 sm:p-8 space-y-6">
            
            {/* Ícone e Cabeçalho */}
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-full bg-blue-50 text-[#003882] border border-blue-200 flex items-center justify-center mx-auto shadow-xs">
                <Lock className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">
                Painel do Lojista
              </h3>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                Acesso exclusivo para administradores da <strong>Phoenix Elétrica</strong>.
              </p>
            </div>

            {/* Alerta de Erro */}
            {loginError && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs animate-shake">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{loginError}</span>
              </div>
            )}

            {/* Formulário de Login */}
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Usuário
                </label>
                <input
                  type="text"
                  value={loginUser}
                  onChange={(e) => setLoginUser(e.target.value)}
                  placeholder="admin"
                  required
                  autoFocus
                  className="w-full bg-slate-50 focus:bg-white border border-slate-300 focus:border-[#004b9c] focus:ring-2 focus:ring-blue-100 rounded-md px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Senha Master
                </label>
                <input
                  type="password"
                  value={loginPass}
                  onChange={(e) => setLoginPass(e.target.value)}
                  placeholder="Digite sua senha"
                  required
                  className="w-full bg-slate-50 focus:bg-white border border-slate-300 focus:border-[#004b9c] focus:ring-2 focus:ring-blue-100 rounded-md px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 outline-none transition-all"
                />
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded p-2.5 text-[11px] text-slate-500">
                <span className="font-semibold text-slate-700 block mb-0.5">Credenciais padrão iniciais:</span>
                Usuário: <code className="font-mono text-[#003882] font-bold">admin</code> · Senha: <code className="font-mono text-[#003882] font-bold">phoenix@2024</code>
              </div>

              <div className="pt-2 flex items-center gap-3">
                <button
                  type="submit"
                  disabled={isLoggingIn}
                  className="flex-1 inline-flex items-center justify-center gap-2 bg-[#004b9c] hover:bg-[#003882] text-white font-bold text-xs sm:text-sm py-2.5 px-4 rounded-md shadow-sm transition-all cursor-pointer disabled:opacity-50"
                >
                  {isLoggingIn ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Validando...</span>
                    </>
                  ) : (
                    <>
                      <Key className="w-4 h-4" />
                      <span>Entrar no Painel</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 text-xs text-slate-600 hover:text-slate-900 rounded border border-slate-300 hover:bg-slate-100 transition-colors font-medium"
                >
                  Fechar
                </button>
              </div>
            </form>

          </div>
        </div>
      </div>
    );
  }

  // Filtro de busca de leads
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
  // TELA 2: PAINEL COMPLETO DO LOJISTA (QUANDO AUTENTICADO)
  // =========================================================================
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white border border-slate-300 rounded-xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Modal Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-[#003882] text-white">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded bg-white/10 text-yellow-300 flex items-center justify-center">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold">
                  Painel Administrativo: Phoenix Elétrica
                </h3>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-400/40 font-semibold">
                  Autenticado: {adminUser}
                </span>
              </div>
              <p className="text-[11px] text-blue-200">
                Banco de Dados SQLite (<code className="font-mono text-yellow-300">phoenix_eletrica.db</code>)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onOpenFullScreen && (
              <button
                onClick={onOpenFullScreen}
                className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-blue-100 hover:text-white transition-colors cursor-pointer text-xs"
                title="Abrir painel em página inteira (/admin)"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span>Página Inteira (/admin)</span>
              </button>
            )}

            <button
              onClick={fetchData}
              disabled={isLoading}
              className="p-1.5 sm:px-2.5 sm:py-1 rounded bg-white/10 hover:bg-white/20 text-blue-100 hover:text-white transition-colors cursor-pointer text-xs flex items-center gap-1.5"
              title="Atualizar dados"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Atualizar</span>
            </button>

            <button
              onClick={handleLogout}
              className="px-2.5 py-1 rounded bg-red-600/80 hover:bg-red-600 text-white transition-colors cursor-pointer text-xs flex items-center gap-1.5"
              title="Sair da sessão administrativa"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sair</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded hover:bg-white/10 text-blue-100 hover:text-white transition-colors cursor-pointer"
              title="Fechar janela"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Abas de Navegação */}
        <div className="bg-[#f0f4f8] px-4 sm:px-6 pt-3 border-b border-slate-200 flex flex-wrap items-center gap-2">
          
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-3 sm:px-4 py-2.5 text-xs font-bold rounded-t-lg transition-colors border-t border-x cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'dashboard'
                ? 'bg-white text-[#003882] border-slate-300 border-b-white -mb-px shadow-xs'
                : 'bg-transparent text-slate-600 border-transparent hover:text-slate-900'
            }`}
          >
            <BarChart3 className="w-4 h-4 text-amber-500" />
            <span>Dashboard Executivo (Mês a Mês)</span>
          </button>

          <button
            onClick={() => setActiveTab('leads')}
            className={`px-3 sm:px-4 py-2.5 text-xs font-bold rounded-t-lg transition-colors border-t border-x cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'leads'
                ? 'bg-white text-[#003882] border-slate-300 border-b-white -mb-px shadow-xs'
                : 'bg-transparent text-slate-600 border-transparent hover:text-slate-900'
            }`}
          >
            <Package className="w-4 h-4 text-[#004b9c]" />
            <span>Orçamentos Recebidos</span>
            <span className="text-[10px] bg-blue-100 text-[#003882] px-1.5 py-0.5 rounded-full font-mono font-bold">
              {leads.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('visitas')}
            className={`px-3 sm:px-4 py-2.5 text-xs font-bold rounded-t-lg transition-colors border-t border-x cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'visitas'
                ? 'bg-white text-[#003882] border-slate-300 border-b-white -mb-px shadow-xs'
                : 'bg-transparent text-slate-600 border-transparent hover:text-slate-900'
            }`}
          >
            <Eye className="w-4 h-4 text-[#d31010]" />
            <span>Acessos ao Site</span>
            {visitasStats && (
              <span className="text-[10px] bg-red-100 text-[#d31010] px-1.5 py-0.5 rounded-full font-mono font-bold">
                {visitasStats.total}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('seguranca')}
            className={`px-3 sm:px-4 py-2.5 text-xs font-bold rounded-t-lg transition-colors border-t border-x cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'seguranca'
                ? 'bg-white text-[#003882] border-slate-300 border-b-white -mb-px shadow-xs'
                : 'bg-transparent text-slate-600 border-transparent hover:text-slate-900'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Segurança & Senha</span>
          </button>

          <button
            onClick={() => setActiveTab('como_monitorar')}
            className={`px-3 sm:px-4 py-2.5 text-xs font-bold rounded-t-lg transition-colors border-t border-x cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'como_monitorar'
                ? 'bg-white text-[#003882] border-slate-300 border-b-white -mb-px shadow-xs'
                : 'bg-transparent text-slate-600 border-transparent hover:text-slate-900'
            }`}
          >
            <BarChart2 className="w-4 h-4 text-slate-600" />
            <span>Guia Analytics</span>
          </button>

        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4 bg-[#f8fafc]">
          
          {error && (
            <div className="p-3.5 rounded bg-red-50 border border-red-200 text-red-700 text-xs">
              {error}
            </div>
          )}

          {/* =========================================================================
              ABA 1: DASHBOARD EXECUTIVO CONSOLIDADO
              ========================================================================= */}
          {activeTab === 'dashboard' && (
            <ExecutiveDashboard
              data={dashboardData}
              isLoading={isLoading}
              onRefresh={fetchData}
            />
          )}

          {/* =========================================================================
              ABA 1: ORÇAMENTOS RECEBIDOS (LEADS)
              ========================================================================= */}
          {activeTab === 'leads' && (
            <>
              {/* Barra de Ações: Busca + Exportar CSV */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-lg border border-slate-200">
                <div className="relative flex-1 max-w-sm">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Filtrar por nome, telefone, material..."
                    value={searchLead}
                    onChange={(e) => setSearchLead(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded focus:bg-white focus:border-[#004b9c] outline-none"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleExportCSV}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-2xs transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Exportar (.CSV)</span>
                  </button>
                </div>
              </div>

              {isLoading && leads.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-sm">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#004b9c]" />
                  <span>Carregando orçamentos do banco SQLite...</span>
                </div>
              ) : filteredLeads.length === 0 ? (
                <div className="py-12 text-center text-slate-500 bg-white rounded-lg border border-slate-200">
                  <p className="font-medium text-slate-700">Nenhum orçamento encontrado.</p>
                  <p className="text-xs text-slate-500 mt-1">Quando os clientes preencherem o formulário no site, eles aparecerão aqui instantaneamente.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredLeads.map((lead) => {
                    const cleanPhone = lead.telefone.replace(/\D/g, '');
                    const whatsappUrl = `https://wa.me/55${cleanPhone}?text=Ol%C3%A1%20${encodeURIComponent(lead.nome)}!%20Aqui%20%C3%A9%20da%20Phoenix%20El%C3%A9trica.%20Recebemos%20sua%20solicita%C3%A7%C3%A3o%20de%20or%C3%A7amento%20e%20j%C3%A1%20estamos%20com%20sua%20lista.`;

                    return (
                      <div 
                        key={lead.id} 
                        className="p-4 rounded-lg bg-white border border-slate-200 shadow-2xs hover:border-[#004b9c] transition-colors space-y-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-bold text-[#003882] bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                              #{lead.id}
                            </span>
                            <h4 className="text-sm font-bold text-slate-900">{lead.nome}</h4>
                            {lead.aceita_marketing === 1 || lead.aceita_marketing === true ? (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1" title="Cliente autorizou envio de e-mails de marketing">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                Opt-in Ativo
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
                              className="inline-flex items-center gap-1 text-[#25D366] hover:text-[#20ba5a] font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200"
                              title="Iniciar conversa no WhatsApp com este cliente"
                            >
                              <Phone className="w-3.5 h-3.5" />
                              <span>{lead.telefone}</span>
                              <ExternalLink className="w-3 h-3 ml-0.5" />
                            </a>

                            <button
                              onClick={() => handleDeleteLead(lead.id)}
                              className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors"
                              title="Excluir este orçamento"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 text-xs">
                          <div className="sm:col-span-3 text-slate-500">
                            <div className="flex items-center gap-1 text-slate-700 font-semibold mb-0.5">
                              <MapPin className="w-3.5 h-3.5 text-[#d31010]" />
                              <span>Localidade:</span>
                            </div>
                            <span className="text-slate-800">{lead.cidade}</span>
                          </div>

                          <div className="sm:col-span-9">
                            <div className="flex items-center justify-between mb-0.5">
                              <span className="text-slate-700 font-semibold block">Lista de Materiais Solicitada:</span>
                              {lead.arquivo_nome && (
                                <div className="flex items-center gap-1.5 flex-wrap">
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
                            <div className="p-2.5 rounded bg-slate-50 border border-slate-200 text-slate-800 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
                              {lead.materiais}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* =========================================================================
              ABA 2: VISITAS & TRÁFEGO
              ========================================================================= */}
          {activeTab === 'visitas' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="bg-white p-4 rounded-lg border border-slate-200 text-center">
                  <div className="text-2xl font-extrabold text-[#003882]">{visitasStats?.total || 0}</div>
                  <div className="text-xs text-slate-500 uppercase font-semibold">Total de Visitas</div>
                </div>

                <div className="bg-white p-4 rounded-lg border border-slate-200 text-center">
                  <div className="text-2xl font-extrabold text-[#d31010]">{visitasStats?.hoje || 0}</div>
                  <div className="text-xs text-slate-500 uppercase font-semibold">Visitas Hoje</div>
                </div>

                <div className="bg-white p-4 rounded-lg border border-slate-200 text-center">
                  <div className="text-2xl font-extrabold text-emerald-600">{visitasStats?.mobile || 0}</div>
                  <div className="text-xs text-slate-500 uppercase font-semibold">Celular / Mobile</div>
                </div>

                <div className="bg-white p-4 rounded-lg border border-slate-200 text-center">
                  <div className="text-2xl font-extrabold text-indigo-600">{visitasStats?.desktop || 0}</div>
                  <div className="text-xs text-slate-500 uppercase font-semibold">Desktop / PC</div>
                </div>
              </div>

              {/* Tabela de Últimos Acessos */}
              <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between text-xs font-bold text-slate-700">
                  <span>Últimos Registros de Acesso</span>
                  <span className="text-slate-400 font-normal">Gravados em SQLite</span>
                </div>
                <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto text-xs">
                  {visitasStats?.visitas && visitasStats.visitas.length > 0 ? (
                    visitasStats.visitas.map((v) => (
                      <div key={v.id} className="p-3 flex items-center justify-between hover:bg-slate-50">
                        <div className="flex items-center gap-3">
                          <span className="text-slate-400 font-mono text-[11px]">{v.data_hora}</span>
                          <span className="font-semibold text-slate-800">{v.dispositivo}</span>
                          <span className="text-slate-500">· {v.navegador}</span>
                        </div>
                        <span className="text-[11px] text-slate-400 truncate max-w-xs">{v.origem}</span>
                      </div>
                    ))
                  ) : (
                    <div className="p-6 text-center text-slate-400">Nenhuma visita registrada ainda.</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* =========================================================================
              ABA 3: SEGURANÇA & ALTERAR SENHA MASTER
              ========================================================================= */}
          {activeTab === 'seguranca' && (
            <div className="max-w-lg mx-auto bg-white p-6 rounded-lg border border-slate-200 space-y-4">
              <div className="flex items-center gap-3 border-b border-slate-200 pb-3">
                <div className="w-10 h-10 rounded-full bg-blue-50 text-[#003882] flex items-center justify-center">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Alterar Senha do Administrador</h4>
                  <p className="text-xs text-slate-500">Defina uma nova senha segura para o usuário <strong className="text-slate-700">{adminUser}</strong>.</p>
                </div>
              </div>

              {passFeedback && (
                <div className={`p-3 rounded text-xs flex items-center gap-2 ${
                  passFeedback.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'
                }`}>
                  {passFeedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                  <span>{passFeedback.message}</span>
                </div>
              )}

              <form onSubmit={handleChangePassword} className="space-y-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Senha Atual:</label>
                  <input
                    type="password"
                    value={senhaAtual}
                    onChange={(e) => setSenhaAtual(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded focus:bg-white focus:border-[#004b9c] outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Nova Senha (Mínimo 6 dígitos):</label>
                  <input
                    type="password"
                    value={novaSenha}
                    onChange={(e) => setNovaSenha(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded focus:bg-white focus:border-[#004b9c] outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Confirmar Nova Senha:</label>
                  <input
                    type="password"
                    value={novaSenhaConfirm}
                    onChange={(e) => setNovaSenhaConfirm(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded focus:bg-white focus:border-[#004b9c] outline-none"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isChangingPass}
                    className="w-full py-2.5 px-4 bg-[#004b9c] hover:bg-[#003882] text-white font-bold rounded shadow-2xs transition-colors cursor-pointer"
                  >
                    {isChangingPass ? 'Salvando nova senha...' : 'Salvar Nova Senha'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* =========================================================================
              ABA 4: COMO MONITORAR COM GOOGLE ANALYTICS
              ========================================================================= */}
          {activeTab === 'como_monitorar' && (
            <div className="bg-white p-5 rounded-lg border border-slate-200 text-xs text-slate-700 space-y-3">
              <h4 className="text-sm font-bold text-[#003882]">Como Integrar com Google Analytics 4 (GA4):</h4>
              <p>O site já possui rastreamento interno em SQLite gravando todas as páginas e dispositivos. Para conectar o Google Analytics oficial:</p>
              <ol className="list-decimal pl-4 space-y-1.5 text-slate-600">
                <li>Acesse <strong>analytics.google.com</strong> e crie uma propriedade para o domínio da Phoenix Elétrica.</li>
                <li>Copie o seu ID de Medição (ex: <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">G-XXXXXXXXXX</code>).</li>
                <li>Adicione a tag no cabeçalho HTML (<code className="bg-slate-100 px-1 py-0.5 rounded font-mono">&lt;head&gt;</code>).</li>
              </ol>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
