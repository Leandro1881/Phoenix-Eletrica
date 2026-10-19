// Sessão do painel administrativo. Fica num cookie HttpOnly emitido pelo servidor:
// o JavaScript da página não consegue ler (um script malicioso não rouba a sessão).
export const ADMIN_LOGOUT_EVENT = 'phoenix-admin-logout';

// Remove resquícios dos logins antigos, que guardavam token ou senha no navegador
try {
  localStorage.removeItem('phoenix_admin_auth');
  localStorage.removeItem('phoenix_admin_password');
  localStorage.removeItem('phoenix_admin_token');
  sessionStorage.removeItem('phoenix_admin_token');
  sessionStorage.removeItem('phoenix_admin_user');
} catch (_) {}

// Cabeçalho exigido pelo servidor nas rotas do painel (outro site não consegue enviá-lo)
const ADMIN_HEADERS = { 'X-Phoenix-Admin': '1', 'Content-Type': 'application/json' };

// fetch do painel; sessão expirada (401) volta para a tela de login
export const adminFetch = async (url: string, init: RequestInit = {}): Promise<Response> => {
  const headers = new Headers(init.headers);
  Object.entries(ADMIN_HEADERS).forEach(([k, v]) => headers.set(k, v));
  const res = await fetch(url, { ...init, headers, credentials: 'same-origin' });
  if (res.status === 401) {
    window.dispatchEvent(new Event(ADMIN_LOGOUT_EVENT));
  }
  return res;
};

const postJson = async (url: string, body: unknown) => {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: ADMIN_HEADERS,
      credentials: 'same-origin',
      body: JSON.stringify(body)
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, data };
  } catch (_) {
    return { ok: false, data: { message: 'Não foi possível conectar ao servidor.' } };
  }
};

export type LoginStep =
  | { step: 'mfa'; mfaToken: string }
  | { step: 'enroll'; mfaToken: string; qr: string; secret: string }
  | { error: string };

// Etapa 1: usuário e senha
export const loginAdmin = async (usuario: string, senha: string): Promise<LoginStep> => {
  const { ok, data } = await postJson('/api/admin/login', { usuario, senha });
  if (ok && data.success && data.mfaToken) {
    return data.step === 'enroll'
      ? { step: 'enroll', mfaToken: data.mfaToken, qr: data.qr, secret: data.secret }
      : { step: 'mfa', mfaToken: data.mfaToken };
  }
  return { error: data.message || 'Usuário ou senha incorretos.' };
};

// Etapa 2: código de 6 dígitos do aplicativo (ou código de recuperação)
export const verifyAdminCode = async (
  mfaToken: string,
  codigo: string
): Promise<{ usuario: string; recoveryCodes?: string[] } | { error: string; restart?: boolean }> => {
  const { ok, data } = await postJson('/api/admin/login/2fa', { mfaToken, codigo });
  if (ok && data.success) return { usuario: data.usuario, recoveryCodes: data.recoveryCodes };
  return { error: data.message || 'Código incorreto.', restart: !!data.restart };
};

// Esqueci a senha: usuário + código do aplicativo (ou de recuperação) + nova senha
export const resetAdminPassword = async (usuario: string, codigo: string, novaSenha: string): Promise<{ message: string } | { error: string }> => {
  const { ok, data } = await postJson('/api/admin/reset-password', { usuario, codigo, novaSenha });
  if (ok && data.success) return { message: data.message || 'Senha redefinida.' };
  return { error: data.message || 'Não foi possível redefinir a senha.' };
};

// Sessão ativa? Devolve o usuário ou null
export const fetchAdminSession = async (): Promise<{ usuario: string; codigosRecuperacao: number } | null> => {
  try {
    const res = await fetch('/api/admin/session', { headers: ADMIN_HEADERS, credentials: 'same-origin' });
    if (!res.ok) return null;
    const data = await res.json();
    return data.success ? { usuario: data.usuario, codigosRecuperacao: data.codigosRecuperacao } : null;
  } catch (_) {
    return null;
  }
};

export const logoutAdmin = async (everywhere = false) => {
  await postJson(everywhere ? '/api/admin/logout-all' : '/api/admin/logout', {});
};
