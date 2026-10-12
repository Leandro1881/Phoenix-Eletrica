// Sessão do painel administrativo. O token é emitido e validado pelo servidor;
// guardar no sessionStorage faz o login expirar ao fechar o navegador.
const TOKEN_KEY = 'phoenix_admin_token';
const USER_KEY = 'phoenix_admin_user';
export const ADMIN_LOGOUT_EVENT = 'phoenix-admin-logout';

// Remove resquícios do login antigo, que guardava a senha no navegador
try {
  localStorage.removeItem('phoenix_admin_auth');
  localStorage.removeItem('phoenix_admin_password');
  localStorage.removeItem('phoenix_admin_token');
} catch (_) {}

export const getAdminToken = (): string | null => {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch (_) {
    return null;
  }
};

export const getAdminUser = (): string => {
  try {
    return sessionStorage.getItem(USER_KEY) || '';
  } catch (_) {
    return '';
  }
};

export const setAdminSession = (token: string, usuario: string) => {
  try {
    sessionStorage.setItem(TOKEN_KEY, token);
    sessionStorage.setItem(USER_KEY, usuario);
  } catch (_) {}
};

export const clearAdminSession = () => {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
  } catch (_) {}
};

// fetch com o token do painel; sessão expirada (401) desloga em todas as telas abertas
export const adminFetch = async (url: string, init: RequestInit = {}): Promise<Response> => {
  const headers = new Headers(init.headers);
  const token = getAdminToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const res = await fetch(url, { ...init, headers });
  if (res.status === 401) {
    clearAdminSession();
    window.dispatchEvent(new Event(ADMIN_LOGOUT_EVENT));
  }
  return res;
};

// Login no servidor; devolve mensagem de erro ou null em caso de sucesso
export const loginAdmin = async (usuario: string, senha: string): Promise<{ usuario: string } | { error: string }> => {
  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario, senha })
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success && data.token) {
      setAdminSession(data.token, data.usuario || usuario);
      return { usuario: data.usuario || usuario };
    }
    return { error: data.message || 'Usuário ou senha incorretos.' };
  } catch (_) {
    return { error: 'Não foi possível conectar ao servidor.' };
  }
};
