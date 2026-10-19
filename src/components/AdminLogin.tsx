import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, ArrowLeft, Check, Copy, Download, KeyRound, Lock, RefreshCw, ShieldCheck, Smartphone } from 'lucide-react';
import { loginAdmin, verifyAdminCode } from '../utils/adminAuth';
import { PhoenixLogo } from './PhoenixLogo';

interface AdminLoginProps {
  onAuthenticated: (usuario: string) => void;
  onNavigateHome: () => void;
}

type Stage =
  | { kind: 'password' }
  | { kind: 'code'; mfaToken: string }
  | { kind: 'enroll'; mfaToken: string; qr: string; secret: string }
  | { kind: 'recovery'; usuario: string; codes: string[] };

const inputClass =
  'w-full bg-white/[0.06] focus:bg-white/[0.1] border border-white/15 focus:border-yellow-400/70 focus:ring-2 focus:ring-yellow-400/20 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-400 outline-none transition-all';

const Steps: React.FC<{ current: 1 | 2 }> = ({ current }) => (
  <ol className="flex items-center justify-center gap-2 text-[11px] font-bold uppercase tracking-wider" aria-label="Etapas do login">
    {['Senha', 'Código 2FA'].map((label, i) => {
      const n = i + 1;
      const active = n === current;
      const done = n < current;
      return (
        <li key={label} className="flex items-center gap-2">
          <span
            className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] ${
              done ? 'bg-emerald-500 text-white' : active ? 'bg-yellow-400 text-[#00224d]' : 'bg-white/10 text-slate-400'
            }`}
            aria-current={active ? 'step' : undefined}
          >
            {done ? <Check className="w-3.5 h-3.5" /> : n}
          </span>
          <span className={active ? 'text-white' : 'text-slate-400'}>{label}</span>
          {n === 1 && <span className="w-8 h-px bg-white/15" />}
        </li>
      );
    })}
  </ol>
);

export const AdminLogin: React.FC<AdminLoginProps> = ({ onAuthenticated, onNavigateHome }) => {
  const [stage, setStage] = useState<Stage>({ kind: 'password' });
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [codigo, setCodigo] = useState('');
  const [useRecovery, setUseRecovery] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [savedCodes, setSavedCodes] = useState(false);
  const codeRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (stage.kind === 'code' || stage.kind === 'enroll') setTimeout(() => codeRef.current?.focus(), 50);
  }, [stage.kind]);

  const copy = (key: string, text: string) => {
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const handlePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!usuario.trim() || !senha) return setError('Informe usuário e senha.');
    setBusy(true);
    const result = await loginAdmin(usuario.trim(), senha);
    setBusy(false);
    setSenha('');
    if ('error' in result) return setError(result.error);
    setCodigo('');
    setStage(result.step === 'enroll' ? { kind: 'enroll', mfaToken: result.mfaToken, qr: result.qr, secret: result.secret } : { kind: 'code', mfaToken: result.mfaToken });
  };

  const handleCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (stage.kind !== 'code' && stage.kind !== 'enroll') return;
    setError(null);
    setBusy(true);
    const result = await verifyAdminCode(stage.mfaToken, codigo.trim());
    setBusy(false);
    if ('error' in result) {
      setCodigo('');
      setError(result.error);
      if (result.restart) setStage({ kind: 'password' });
      return;
    }
    if (result.recoveryCodes?.length) {
      setStage({ kind: 'recovery', usuario: result.usuario, codes: result.recoveryCodes });
      return;
    }
    onAuthenticated(result.usuario);
  };

  const downloadCodes = (codes: string[]) => {
    const blob = new Blob(
      [`Phoenix Elétrica - códigos de recuperação do painel\nCada código funciona uma única vez.\n\n${codes.join('\n')}\n`],
      { type: 'text/plain;charset=utf-8' }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'phoenix-codigos-recuperacao.txt';
    a.click();
    URL.revokeObjectURL(url);
    setSavedCodes(true);
  };

  const codeForm = (
    <form onSubmit={handleCode} className="space-y-4">
      <div>
        <label htmlFor="admin-codigo" className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
          {useRecovery ? 'Código de recuperação' : 'Código de 6 dígitos'}
        </label>
        <input
          id="admin-codigo"
          ref={codeRef}
          value={codigo}
          onChange={(e) => setCodigo(useRecovery ? e.target.value.toUpperCase().slice(0, 11) : e.target.value.replace(/\D/g, '').slice(0, 6))}
          inputMode={useRecovery ? 'text' : 'numeric'}
          autoComplete="one-time-code"
          placeholder={useRecovery ? 'XXXXX-XXXXX' : '000000'}
          className={`${inputClass} text-center font-mono tracking-[0.5em] text-lg`}
          required
        />
      </div>
      <button
        type="submit"
        disabled={busy || (!useRecovery && codigo.length !== 6)}
        className="w-full inline-flex items-center justify-center gap-2 bg-yellow-400 hover:bg-yellow-300 text-[#00224d] font-extrabold text-sm py-3 rounded-xl transition-all disabled:opacity-40 cursor-pointer"
      >
        {busy ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
        <span>{busy ? 'Verificando...' : 'Confirmar e entrar'}</span>
      </button>
      {stage.kind === 'code' && (
        <button
          type="button"
          onClick={() => {
            setUseRecovery((v) => !v);
            setCodigo('');
          }}
          className="w-full text-xs text-slate-400 hover:text-white underline-offset-4 hover:underline cursor-pointer"
        >
          {useRecovery ? 'Usar o código do aplicativo' : 'Perdi o celular: usar código de recuperação'}
        </button>
      )}
    </form>
  );

  return (
    <div className="min-h-screen bg-[#00122e] bg-[radial-gradient(ellipse_at_top,rgba(0,75,156,0.55),transparent_60%)] text-white flex flex-col items-center justify-between p-4">
      <div className="w-full max-w-md pt-4 flex items-center justify-between">
        <button
          type="button"
          onClick={onNavigateHome}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-300 hover:text-white transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar para a loja</span>
        </button>
        <span className="inline-flex items-center gap-1.5 text-[11px] text-emerald-300/90">
          <Lock className="w-3.5 h-3.5" />
          Conexão protegida
        </span>
      </div>

      <main className="w-full max-w-md my-8">
        <div className="rounded-3xl bg-white/[0.04] border border-white/10 shadow-2xl shadow-black/40 backdrop-blur-xl overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-[#004b9c] via-yellow-400 to-[#d31010]" />
          <div className="p-6 sm:p-8 space-y-6">
            <div className="text-center space-y-3">
              <div className="inline-block rounded-2xl bg-white px-3 py-2">
                <PhoenixLogo variant="horizontal" size="sm" />
              </div>
              <h1 className="text-xl font-black tracking-tight">Painel do Lojista</h1>
              {stage.kind !== 'recovery' && <Steps current={stage.kind === 'password' ? 1 : 2} />}
            </div>

            {error && (
              <div role="alert" className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-400/30 text-red-200 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 mt-px" />
                <span>{error}</span>
              </div>
            )}

            {stage.kind === 'password' && (
              <form onSubmit={handlePassword} className="space-y-4">
                <div>
                  <label htmlFor="admin-usuario" className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                    Usuário
                  </label>
                  <input
                    id="admin-usuario"
                    value={usuario}
                    onChange={(e) => setUsuario(e.target.value)}
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    autoFocus
                    required
                    maxLength={60}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor="admin-senha" className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                    Senha
                  </label>
                  <input
                    id="admin-senha"
                    type="password"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    autoComplete="current-password"
                    required
                    maxLength={128}
                    className={inputClass}
                  />
                </div>
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full inline-flex items-center justify-center gap-2 bg-yellow-400 hover:bg-yellow-300 text-[#00224d] font-extrabold text-sm py-3 rounded-xl transition-all disabled:opacity-50 cursor-pointer"
                >
                  {busy ? <RefreshCw className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                  <span>{busy ? 'Validando...' : 'Continuar'}</span>
                </button>
              </form>
            )}

            {stage.kind === 'code' && (
              <div className="space-y-4">
                <p className="text-xs text-slate-300 text-center flex items-center justify-center gap-2">
                  <Smartphone className="w-4 h-4 text-yellow-300" />
                  Abra o aplicativo autenticador no celular e digite o código.
                </p>
                {codeForm}
              </div>
            )}

            {stage.kind === 'enroll' && (
              <div className="space-y-5">
                <div className="rounded-2xl bg-yellow-400/10 border border-yellow-400/30 p-3 text-xs text-yellow-100">
                  <strong>Primeiro acesso:</strong> ative a verificação em duas etapas. A partir de agora, o painel pede a senha e um código do seu celular.
                </div>
                <ol className="space-y-2 text-xs text-slate-300 list-decimal pl-4">
                  <li>Instale o <strong>Google Authenticator</strong> ou <strong>Microsoft Authenticator</strong> no celular.</li>
                  <li>No aplicativo, toque em <strong>+</strong> e leia o QR Code abaixo.</li>
                  <li>Digite o código de 6 dígitos que aparecer.</li>
                </ol>
                <div className="flex flex-col items-center gap-3">
                  <img src={stage.qr} alt="QR Code para cadastrar o painel no aplicativo autenticador" width={200} height={200} className="rounded-xl bg-white p-2" />
                  <button
                    type="button"
                    onClick={() => copy('secret', stage.secret)}
                    className="inline-flex items-center gap-1.5 text-[11px] font-mono text-slate-300 hover:text-white bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 cursor-pointer"
                    title="Copiar chave para digitar manualmente no aplicativo"
                  >
                    {copied === 'secret' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span className="break-all">{stage.secret.replace(/(.{4})/g, '$1 ').trim()}</span>
                  </button>
                </div>
                {codeForm}
              </div>
            )}

            {stage.kind === 'recovery' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-emerald-300 text-sm font-bold justify-center">
                  <ShieldCheck className="w-5 h-5" />
                  Verificação em duas etapas ativada
                </div>
                <p className="text-xs text-slate-300">
                  Guarde estes <strong>códigos de recuperação</strong> em lugar seguro (fora do celular). Se perder o celular, cada código permite entrar uma vez. Eles não serão mostrados de novo.
                </p>
                <div className="grid grid-cols-2 gap-2 font-mono text-sm bg-black/30 border border-white/10 rounded-xl p-3">
                  {stage.codes.map((c) => (
                    <span key={c} className="text-center tracking-wider">{c}</span>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      copy('codes', stage.codes.join('\n'));
                      setSavedCodes(true);
                    }}
                    className="inline-flex items-center justify-center gap-1.5 text-xs font-bold bg-white/10 hover:bg-white/15 rounded-xl py-2.5 cursor-pointer"
                  >
                    {copied === 'codes' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    Copiar
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadCodes(stage.codes)}
                    className="inline-flex items-center justify-center gap-1.5 text-xs font-bold bg-white/10 hover:bg-white/15 rounded-xl py-2.5 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    Baixar .txt
                  </button>
                </div>
                <button
                  type="button"
                  disabled={!savedCodes}
                  onClick={() => onAuthenticated(stage.usuario)}
                  className="w-full bg-yellow-400 hover:bg-yellow-300 text-[#00224d] font-extrabold text-sm py-3 rounded-xl transition-all disabled:opacity-40 cursor-pointer"
                >
                  {savedCodes ? 'Já guardei, entrar no painel' : 'Copie ou baixe os códigos para continuar'}
                </button>
              </div>
            )}
          </div>
        </div>
      </main>

      <footer className="pb-4 text-center text-[11px] text-slate-500">
        Acesso restrito e monitorado · Phoenix Elétrica
      </footer>
    </div>
  );
};
