import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Copy, KeyRound, LogOut, RefreshCw, ShieldCheck, History, XCircle } from 'lucide-react';
import { adminFetch, fetchAdminSession, logoutAdmin } from '../utils/adminAuth';

interface AdminSecurityProps {
  adminUser: string;
  onLoggedOut: () => void;
}

interface Acesso {
  data_hora: string;
  usuario: string;
  ip: string;
  navegador: string;
  evento: string;
  sucesso: boolean;
}

type Feedback = { type: 'success' | 'error'; message: string } | null;

const fieldClass =
  'w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:border-[#004b9c] focus:ring-2 focus:ring-blue-100 outline-none text-sm';

const FeedbackBox: React.FC<{ feedback: Feedback }> = ({ feedback }) =>
  feedback ? (
    <div
      role={feedback.type === 'error' ? 'alert' : 'status'}
      className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
        feedback.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'
      }`}
    >
      {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
      <span>{feedback.message}</span>
    </div>
  ) : null;

// Navegador e sistema resumidos a partir do user-agent
const shortAgent = (ua: string) => {
  const browser = /edg/i.test(ua) ? 'Edge' : /chrome/i.test(ua) ? 'Chrome' : /firefox/i.test(ua) ? 'Firefox' : /safari/i.test(ua) ? 'Safari' : 'Outro';
  const os = /android/i.test(ua) ? 'Android' : /iphone|ipad/i.test(ua) ? 'iOS' : /windows/i.test(ua) ? 'Windows' : /mac os/i.test(ua) ? 'macOS' : /linux/i.test(ua) ? 'Linux' : '';
  return [browser, os].filter(Boolean).join(' · ');
};

export const AdminSecurity: React.FC<AdminSecurityProps> = ({ adminUser, onLoggedOut }) => {
  const [codigosRestantes, setCodigosRestantes] = useState<number | null>(null);
  const [acessos, setAcessos] = useState<Acesso[]>([]);

  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [codigoSenha, setCodigoSenha] = useState('');
  const [passFeedback, setPassFeedback] = useState<Feedback>(null);
  const [busyPass, setBusyPass] = useState(false);

  const [codigoRec, setCodigoRec] = useState('');
  const [novosCodigos, setNovosCodigos] = useState<string[] | null>(null);
  const [recFeedback, setRecFeedback] = useState<Feedback>(null);

  const load = async () => {
    const session = await fetchAdminSession();
    if (session) setCodigosRestantes(session.codigosRecuperacao);
    const res = await adminFetch('/api/admin/acessos');
    if (res.ok) setAcessos((await res.json()).acessos || []);
  };

  useEffect(() => {
    load();
  }, []);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassFeedback(null);
    if (novaSenha !== confirmacao) return setPassFeedback({ type: 'error', message: 'A nova senha e a confirmação não conferem.' });
    setBusyPass(true);
    const res = await adminFetch('/api/admin/change-password', {
      method: 'POST',
      body: JSON.stringify({ senhaAtual, novaSenha, codigo: codigoSenha })
    });
    const data = await res.json().catch(() => ({}));
    setBusyPass(false);
    setCodigoSenha('');
    if (res.ok && data.success) {
      setPassFeedback({ type: 'success', message: data.message });
      setSenhaAtual('');
      setNovaSenha('');
      setConfirmacao('');
      load();
    } else {
      setPassFeedback({ type: 'error', message: data.message || 'Não foi possível alterar a senha.' });
    }
  };

  const handleNewCodes = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecFeedback(null);
    const res = await adminFetch('/api/admin/recovery-codes', { method: 'POST', body: JSON.stringify({ codigo: codigoRec }) });
    const data = await res.json().catch(() => ({}));
    setCodigoRec('');
    if (res.ok && data.success) {
      setNovosCodigos(data.recoveryCodes);
      setCodigosRestantes(data.recoveryCodes.length);
      setRecFeedback({ type: 'success', message: 'Novos códigos gerados. Os anteriores deixaram de valer.' });
    } else {
      setRecFeedback({ type: 'error', message: data.message || 'Código incorreto.' });
    }
  };

  const handleLogoutAll = async () => {
    if (!window.confirm('Encerrar todas as sessões abertas, inclusive esta?')) return;
    await logoutAdmin(true);
    onLoggedOut();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {/* Situação da conta */}
      <section className="bg-white p-5 sm:p-6 rounded-xl border border-slate-200 shadow-2xs space-y-4 lg:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900">Conta protegida</h2>
              <p className="text-xs text-slate-500">
                Usuário <strong className="text-slate-700">{adminUser}</strong> · verificação em duas etapas ativa
                {codigosRestantes !== null && <> · {codigosRestantes} códigos de recuperação restantes</>}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogoutAll}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-bold cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            Encerrar todas as sessões
          </button>
        </div>
        {codigosRestantes !== null && codigosRestantes <= 2 && (
          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
            Poucos códigos de recuperação restantes. Gere novos abaixo.
          </p>
        )}
      </section>

      {/* Trocar senha */}
      <section className="bg-white p-5 sm:p-6 rounded-xl border border-slate-200 shadow-2xs space-y-4">
        <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-[#004b9c]" />
          Alterar senha
        </h3>
        <FeedbackBox feedback={passFeedback} />
        <form onSubmit={handleChangePassword} className="space-y-3 text-xs">
          <label className="block">
            <span className="block font-bold text-slate-700 mb-1">Senha atual</span>
            <input type="password" autoComplete="current-password" value={senhaAtual} onChange={(e) => setSenhaAtual(e.target.value)} required maxLength={128} className={fieldClass} />
          </label>
          <label className="block">
            <span className="block font-bold text-slate-700 mb-1">Nova senha</span>
            <input type="password" autoComplete="new-password" value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} required minLength={12} maxLength={128} className={fieldClass} />
            <span className="block mt-1 text-slate-500">Mínimo 12 caracteres, com pelo menos 3 destes: minúscula, maiúscula, número e símbolo.</span>
          </label>
          <label className="block">
            <span className="block font-bold text-slate-700 mb-1">Confirmar nova senha</span>
            <input type="password" autoComplete="new-password" value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} required maxLength={128} className={fieldClass} />
          </label>
          <label className="block">
            <span className="block font-bold text-slate-700 mb-1">Código do aplicativo (6 dígitos)</span>
            <input inputMode="numeric" autoComplete="one-time-code" value={codigoSenha} onChange={(e) => setCodigoSenha(e.target.value.replace(/\D/g, '').slice(0, 6))} required className={`${fieldClass} font-mono tracking-widest`} />
          </label>
          <button type="submit" disabled={busyPass} className="w-full py-2.5 bg-[#004b9c] hover:bg-[#003882] text-white font-bold rounded-lg disabled:opacity-50 cursor-pointer">
            {busyPass ? 'Salvando...' : 'Salvar nova senha'}
          </button>
          <p className="text-slate-500">Ao trocar a senha, as outras sessões abertas são encerradas.</p>
        </form>
      </section>

      {/* Códigos de recuperação */}
      <section className="bg-white p-5 sm:p-6 rounded-xl border border-slate-200 shadow-2xs space-y-4">
        <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
          <RefreshCw className="w-4 h-4 text-[#004b9c]" />
          Códigos de recuperação
        </h3>
        <p className="text-xs text-slate-500">Servem para entrar se você perder o celular. Gerar novos invalida os anteriores.</p>
        <FeedbackBox feedback={recFeedback} />
        {novosCodigos ? (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2 font-mono text-sm bg-slate-50 border border-slate-200 rounded-lg p-3">
              {novosCodigos.map((c) => (
                <span key={c} className="text-center">{c}</span>
              ))}
            </div>
            <button
              type="button"
              onClick={() => navigator.clipboard?.writeText(novosCodigos.join('\n')).catch(() => {})}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#004b9c] hover:underline cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" />
              Copiar códigos
            </button>
          </div>
        ) : (
          <form onSubmit={handleNewCodes} className="space-y-3 text-xs">
            <label className="block">
              <span className="block font-bold text-slate-700 mb-1">Código do aplicativo (6 dígitos)</span>
              <input inputMode="numeric" autoComplete="one-time-code" value={codigoRec} onChange={(e) => setCodigoRec(e.target.value.replace(/\D/g, '').slice(0, 6))} required className={`${fieldClass} font-mono tracking-widest`} />
            </label>
            <button type="submit" className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-lg cursor-pointer">
              Gerar novos códigos
            </button>
          </form>
        )}
      </section>

      {/* Histórico de acessos */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden lg:col-span-2">
        <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50 flex items-center gap-2 text-xs font-bold text-slate-700">
          <History className="w-4 h-4" />
          Histórico de acessos ao painel
        </div>
        <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto text-xs">
          {acessos.length ? (
            acessos.map((a, i) => (
              <div key={i} className="px-5 py-2.5 flex flex-wrap items-center gap-x-4 gap-y-1">
                {a.sucesso ? <CheckCircle2 className="w-4 h-4 text-emerald-600" aria-label="Sucesso" /> : <XCircle className="w-4 h-4 text-red-600" aria-label="Falha" />}
                <span className="font-mono text-slate-500">{a.data_hora}</span>
                <span className="font-semibold text-slate-800">{a.evento}</span>
                <span className="text-slate-500">{a.usuario}</span>
                <span className="text-slate-400 font-mono">{a.ip}</span>
                <span className="text-slate-400">{shortAgent(a.navegador)}</span>
              </div>
            ))
          ) : (
            <div className="p-8 text-center text-slate-400">Nenhum acesso registrado.</div>
          )}
        </div>
      </section>
    </div>
  );
};
