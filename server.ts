import 'dotenv/config';
import express from 'express';
import compression from 'compression';
import helmet from 'helmet';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import initSqlJs, { Database } from 'sql.js';
import crypto from 'crypto';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { Storage } from '@google-cloud/storage';
import QRCode from 'qrcode';
import {
  decryptSecret,
  encryptSecret,
  generateRecoveryCodes,
  generateTotpSecret,
  hashRecoveryCode,
  totpUri,
  verifyTotp
} from './lib/totp';
import { hasValidSignature } from './lib/fileSignature';
import { findPage, sitemapXml, NOT_FOUND, ADMIN_PAGE } from './src/seo/pages';
import { renderHead } from './src/seo/head';
import {
  AGENT_SYSTEM_PROMPT,
  AGENT_RESPONSE_SCHEMA,
  AgentMessage,
  AgentReply,
  CONFIRMED_TEXT,
  buildStateInstruction,
  fallbackReply,
  finalizeReply,
  isConfirmation,
  sanitizeItems,
  sanitizeStage
} from './src/ai/quoteAgent';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
// Em produção (Cloud Run) aponta para um bucket privado montado como disco, para os dados sobreviverem a reinícios
const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'phoenix_eletrica.db');

let db: Database | null = null;

// =========================================================================
// Limites do assistente de IA (controle de custo e abuso)
// =========================================================================
const CHAT_MAX_HISTORY = 20;
const GEMINI_MODELS = ['gemini-3.8-flash', 'gemini-3.5-flash'];
const GEMINI_TIMEOUT_MS = 12000;
const CHAT_MAX_CHARS_PER_MESSAGE = 2000;
// Resposta em JSON com a lista inteira: precisa de mais espaço que um texto simples
const CHAT_MAX_OUTPUT_TOKENS = 2048;
const CHAT_IP_WINDOW_MS = 10 * 60 * 1000;
const CHAT_IP_MAX_REQUESTS = Number(process.env.CHAT_IP_MAX_REQUESTS || 20);
const CHAT_DAILY_MAX_REQUESTS = Number(process.env.CHAT_DAILY_MAX_REQUESTS || 1000);

const chatRequestsByIp = new Map<string, number[]>();
let chatDailyCount = { day: new Date().toISOString().slice(0, 10), total: 0 };

// Retorna a mensagem de bloqueio, ou null se a requisição pode seguir
function checkChatRateLimit(ip: string): string | null {
  const now = Date.now();
  const today = new Date(now).toISOString().slice(0, 10);
  if (chatDailyCount.day !== today) {
    chatDailyCount = { day: today, total: 0 };
    chatRequestsByIp.clear();
  }

  if (chatDailyCount.total >= CHAT_DAILY_MAX_REQUESTS) {
    return 'O assistente atingiu o limite diário de atendimentos. Envie sua lista pelo formulário ou WhatsApp.';
  }

  const recent = (chatRequestsByIp.get(ip) || []).filter((t) => now - t < CHAT_IP_WINDOW_MS);
  if (recent.length >= CHAT_IP_MAX_REQUESTS) {
    chatRequestsByIp.set(ip, recent);
    return 'Muitas mensagens em pouco tempo. Aguarde alguns minutos e tente novamente.';
  }

  recent.push(now);
  chatRequestsByIp.set(ip, recent);
  chatDailyCount.total += 1;
  return null;
}

// =========================================================================
// Limite de requisições por IP nas rotas públicas que gravam dados
// (cada gravação regrava o banco inteiro no bucket, então abuso custa caro)
// =========================================================================
const rateLimitBuckets = new Map<string, number[]>();

function rateLimit(name: string, windowMs: number, max: number, message: string) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const key = `${name}:${req.ip || 'desconhecido'}`;
    const now = Date.now();
    const recent = (rateLimitBuckets.get(key) || []).filter((t) => now - t < windowMs);
    if (recent.length >= max) {
      rateLimitBuckets.set(key, recent);
      res.setHeader('Retry-After', String(Math.ceil(windowMs / 1000)));
      return res.status(429).json({ status: 'error', message });
    }
    recent.push(now);
    rateLimitBuckets.set(key, recent);
    next();
  };
}

// Limpa IPs sem acesso recente para o mapa não crescer sem fim
setInterval(() => {
  const now = Date.now();
  for (const [key, times] of rateLimitBuckets) {
    if (!times.length || now - times[times.length - 1] > 60 * 60 * 1000) rateLimitBuckets.delete(key);
  }
}, 10 * 60 * 1000).unref();

const TOO_MANY = 'Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.';
const limitUpload = rateLimit('upload', 10 * 60 * 1000, 10, TOO_MANY);
const limitOrcamento = rateLimit('orcamento', 10 * 60 * 1000, 5, TOO_MANY);
const limitLead = rateLimit('lead', 10 * 60 * 1000, 10, TOO_MANY);
const limitEvento = rateLimit('evento', 10 * 60 * 1000, 60, TOO_MANY);
const limitAdmin = rateLimit('admin', 60 * 1000, 60, TOO_MANY);
// Teto geral por IP em toda a API (robôs e varreduras)
const limitApi = rateLimit('api', 60 * 1000, 120, TOO_MANY);

// Corta o texto no tamanho máximo do campo
const clip = (value: unknown, max: number) => String(value ?? '').trim().substring(0, max);

// =========================================================================
// Gravação do banco no disco (bucket montado)
// =========================================================================
let dbSaveTimer: NodeJS.Timeout | null = null;

function saveDbNow() {
  if (dbSaveTimer) {
    clearTimeout(dbSaveTimer);
    dbSaveTimer = null;
  }
  if (db) fs.writeFileSync(DB_PATH, Buffer.from(db.export()));
}

// Visitas e cliques: agrupa as gravações (no máximo 1 a cada 30 s) em vez de regravar o banco a cada acesso
function saveDbSoon() {
  if (dbSaveTimer) return;
  dbSaveTimer = setTimeout(() => {
    dbSaveTimer = null;
    try {
      saveDbNow();
    } catch (err) {
      console.error('Erro ao gravar banco:', err);
    }
  }, 30 * 1000);
}

// Cloud Run avisa com SIGTERM antes de desligar a instância: grava o que estiver pendente
process.on('SIGTERM', () => {
  try {
    if (dbSaveTimer) saveDbNow();
  } catch (err) {
    console.error('Erro ao gravar banco no desligamento:', err);
  }
  process.exit(0);
});

// =========================================================================
// Upload de anexos (Google Cloud Storage quando GCS_BUCKET está definido)
// =========================================================================
const UPLOAD_MAX_BYTES = 15 * 1024 * 1024;
const UPLOAD_DAILY_MAX = Number(process.env.UPLOAD_DAILY_MAX || 300);
let uploadDailyCount = { day: new Date().toISOString().slice(0, 10), total: 0 };
const UPLOAD_CONTENT_TYPES: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.csv': 'text/csv',
  '.txt': 'text/plain',
  '.rtf': 'application/rtf',
  '.odt': 'application/vnd.oasis.opendocument.text',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp'
};

// Link de anexo aceito no orçamento: só arquivos enviados pelo próprio /api/upload
// (impede gravar links externos maliciosos que o lojista abriria pelo painel)
function isAllowedArquivoUrl(url: string): boolean {
  const bucketName = process.env.GCS_BUCKET || 'phoenix-eletrica-anexos';
  if (url.startsWith(`https://storage.googleapis.com/${bucketName}/orcamentos/orcamento-`)) return true;
  // Desenvolvimento sem bucket: arquivo salvo na pasta local /uploads
  return process.env.NODE_ENV !== 'production' && /^https?:\/\/[^/]+\/uploads\/orcamento-[\w.-]+$/.test(url);
}

let storageClient: Storage | null = null;
function getStorage(): Storage {
  // Credenciais: GOOGLE_APPLICATION_CREDENTIALS (arquivo JSON) em dev; conta de serviço automática no Cloud Run
  if (!storageClient) storageClient = new Storage();
  return storageClient;
}

// =========================================================================
// Autenticação do painel administrativo (validada no servidor)
// Sessão em cookie HttpOnly (JavaScript da página não lê), 2FA obrigatório (TOTP),
// bloqueio por tentativas, revogação de sessões e proteção contra CSRF.
// =========================================================================
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const ADMIN_SESSION_TTL_MS = 8 * 60 * 60 * 1000;
// Sem uso por 1 hora, a sessão expira
const ADMIN_IDLE_MS = 60 * 60 * 1000;
const MFA_TOKEN_TTL_MS = 5 * 60 * 1000;
const MFA_MAX_ATTEMPTS = 5;
const ADMIN_SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || '';
const ADMIN_SECRET_OK = ADMIN_SESSION_SECRET.length >= 32;
// Em desenvolvimento sem segredo, usa um aleatório (login cai a cada reinício)
const SIGNING_SECRET = ADMIN_SECRET_OK ? ADMIN_SESSION_SECRET : crypto.randomBytes(32).toString('hex');
// Em produção, sem segredo forte o login do painel fica desligado (falha fechada)
const ADMIN_LOGIN_ENABLED = ADMIN_SECRET_OK || !IS_PRODUCTION;
const SESSION_COOKIE = IS_PRODUCTION ? '__Host-phx_sess' : 'phx_sess';
// Cabeçalho exigido nas rotas do painel: outro site não consegue enviá-lo (bloqueia CSRF)
const ADMIN_CSRF_HEADER = 'x-phoenix-admin';

// Endereço secreto do painel (ex.: /gestao-8f3k2m9q1x). Sem ADMIN_PATH válido, o painel não abre em produção.
const ADMIN_PATH = (() => {
  const raw = String(process.env.ADMIN_PATH || '').trim().toLowerCase().replace(/\/+$/, '');
  if (/^\/[a-z0-9-]{12,64}$/.test(raw)) return raw;
  if (raw) console.warn('⚠ [ADMIN] ADMIN_PATH inválido: use /letras-numeros com 12 a 64 caracteres.');
  return IS_PRODUCTION ? '' : '/painel-local-dev';
})();

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_FAILURES_IP = 5;
const LOGIN_MAX_FAILURES_USER = 10;
const LOGIN_LOCK_MS = 30 * 60 * 1000;
const loginFailuresByIp = new Map<string, number[]>();
const mfaAttempts = new Map<string, number>();

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return ['scrypt', salt, hash].join('$');
}

// Hash descartável: usuário inexistente gasta o mesmo tempo (não revela quais usuários existem)
const DUMMY_PASSWORD_HASH = hashPassword(crypto.randomBytes(16).toString('hex'));

function verifyPassword(password: string, stored: string): boolean {
  if (stored.startsWith('scrypt$')) {
    const [, salt, hash] = stored.split('$');
    const candidate = crypto.scryptSync(password, salt, 64);
    const expected = Buffer.from(hash, 'hex');
    return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
  }
  // Senha antiga em texto puro (migrada para hash no próximo login bem-sucedido)
  const a = Buffer.from(password);
  const b = Buffer.from(stored);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const COMMON_PASSWORDS = ['123456789012', 'senha1234567', 'phoenix12345', 'phoenixeletrica', 'admin1234567', 'qwertyuiop12', 'password1234'];

// Regra de senha forte; devolve a mensagem de erro ou null
function passwordPolicyError(password: string, usuario: string): string | null {
  if (password.length < 12) return 'A senha deve ter no mínimo 12 caracteres.';
  if (password.length > 128) return 'A senha deve ter no máximo 128 caracteres.';
  const lower = password.toLowerCase();
  if (usuario && lower.includes(usuario.toLowerCase())) return 'A senha não pode conter o nome de usuário.';
  if (COMMON_PASSWORDS.some((c) => lower.includes(c))) return 'Senha muito comum. Escolha outra.';
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(password)).length;
  if (classes < 3) return 'Use pelo menos 3 destes: letra minúscula, maiúscula, número e símbolo.';
  return null;
}

// Token assinado (HMAC-SHA256). p = finalidade: 'sess' (sessão) ou 'mfa' (etapa do código 2FA)
interface AdminTokenData {
  p: 'sess' | 'mfa';
  u: string;
  v: number;
  exp: number;
  la?: number;
  e?: 1;
  jti: string;
}

function signAdminToken(data: Omit<AdminTokenData, 'jti'> & { jti?: string }): string {
  const full: AdminTokenData = { ...data, jti: data.jti || crypto.randomBytes(12).toString('base64url') };
  const payload = Buffer.from(JSON.stringify(full)).toString('base64url');
  const sig = crypto.createHmac('sha256', SIGNING_SECRET).update(payload).digest('base64url');
  return payload + '.' + sig;
}

function verifyAdminToken(token: string, purpose: AdminTokenData['p']): AdminTokenData | null {
  const [payload, sig, extra] = String(token || '').split('.');
  if (!payload || !sig || extra !== undefined) return null;
  const expected = crypto.createHmac('sha256', SIGNING_SECRET).update(payload).digest('base64url');
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString()) as AdminTokenData;
    if (data.p !== purpose || typeof data.u !== 'string' || !(data.exp > Date.now())) return null;
    return data;
  } catch {
    return null;
  }
}

function getCookie(req: express.Request, name: string): string {
  const header = req.headers.cookie || '';
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx > 0 && part.slice(0, idx).trim() === name) return decodeURIComponent(part.slice(idx + 1).trim());
  }
  return '';
}

function setSessionCookie(res: express.Response, token: string, expiresAt: number) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: 'strict',
    path: '/',
    maxAge: Math.max(0, expiresAt - Date.now())
  });
}

function clearSessionCookie(res: express.Response) {
  res.clearCookie(SESSION_COOKIE, { httpOnly: true, secure: IS_PRODUCTION, sameSite: 'strict', path: '/' });
}

interface AdminRow {
  id: number;
  usuario: string;
  senha: string;
  totpSecret: string | null;
  totpPendente: string | null;
  totpAtivo: boolean;
  totpUltimoPasso: number | null;
  recuperacao: string[];
  sessaoVersao: number;
  falhasLogin: number;
  bloqueadoAte: number;
}

function getAdminRow(usuario: string): AdminRow | null {
  if (!db || !usuario) return null;
  const res = db.exec(
    `SELECT id, usuario, senha, totp_secret, totp_pendente, totp_ativo, totp_ultimo_passo, recuperacao, sessao_versao, falhas_login, bloqueado_ate
     FROM admin_auth WHERE LOWER(usuario) = LOWER(?) LIMIT 1`,
    [usuario.trim()]
  );
  const row = res[0]?.values[0];
  if (!row) return null;
  let recuperacao: string[] = [];
  try {
    recuperacao = JSON.parse(String(row[7] || '[]'));
  } catch {}
  return {
    id: Number(row[0]),
    usuario: String(row[1]),
    senha: String(row[2]),
    totpSecret: row[3] ? String(row[3]) : null,
    totpPendente: row[4] ? String(row[4]) : null,
    totpAtivo: Number(row[5]) === 1,
    totpUltimoPasso: row[6] === null || row[6] === undefined ? null : Number(row[6]),
    recuperacao: Array.isArray(recuperacao) ? recuperacao : [],
    sessaoVersao: Number(row[8] || 1),
    falhasLogin: Number(row[9] || 0),
    bloqueadoAte: Number(row[10] || 0)
  };
}

// Histórico de acessos do painel (o lojista vê na aba Segurança)
function logAdminEvent(req: express.Request, usuario: string, evento: string, sucesso: boolean) {
  try {
    if (!db) return;
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    db.run(
      `INSERT INTO admin_acessos (data_hora, usuario, ip, navegador, evento, sucesso) VALUES (?, ?, ?, ?, ?, ?)`,
      [now, usuario.substring(0, 60), String(req.ip || '').substring(0, 60), String(req.headers['user-agent'] || '').substring(0, 160), evento, sucesso ? 1 : 0]
    );
    db.run(`DELETE FROM admin_acessos WHERE id NOT IN (SELECT id FROM admin_acessos ORDER BY id DESC LIMIT 300)`);
  } catch (err) {
    console.error('Erro ao registrar acesso do painel:', err);
  }
}

function issueSession(res: express.Response, row: AdminRow) {
  const exp = Date.now() + ADMIN_SESSION_TTL_MS;
  setSessionCookie(res, signAdminToken({ p: 'sess', u: row.usuario, v: row.sessaoVersao, exp, la: Date.now() }), exp);
}

function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.get(ADMIN_CSRF_HEADER) !== '1') {
    return res.status(403).json({ success: false, message: 'Requisição recusada.' });
  }
  const session = verifyAdminToken(getCookie(req, SESSION_COOKIE), 'sess');
  const now = Date.now();
  const row = session ? getAdminRow(session.u) : null;
  // Sessão revogada (troca de senha, "sair de todos") ou 2FA desligado: não vale mais
  if (!session || !row || row.sessaoVersao !== session.v || !row.totpAtivo || now - (session.la || 0) > ADMIN_IDLE_MS) {
    clearSessionCookie(res);
    return res.status(401).json({ success: false, message: 'Sessão expirada. Faça login novamente.' });
  }
  // Renova o tempo de inatividade a cada 5 minutos de uso (o limite total de 8 h não muda)
  if (now - (session.la || 0) > 5 * 60 * 1000) {
    setSessionCookie(res, signAdminToken({ ...session, la: now, jti: undefined }), session.exp);
  }
  (req as any).adminUser = row.usuario;
  next();
}

function tooManyLoginFailures(ip: string): boolean {
  const now = Date.now();
  const recent = (loginFailuresByIp.get(ip) || []).filter((t) => now - t < LOGIN_WINDOW_MS);
  loginFailuresByIp.set(ip, recent);
  return recent.length >= LOGIN_MAX_FAILURES_IP;
}

function registerLoginFailure(ip: string, row: AdminRow | null) {
  const list = loginFailuresByIp.get(ip) || [];
  list.push(Date.now());
  loginFailuresByIp.set(ip, list);
  // Bloqueio por usuário: protege contra tentativas vindas de muitos IPs diferentes
  if (row && db) {
    const falhas = row.falhasLogin + 1;
    const bloqueio = falhas >= LOGIN_MAX_FAILURES_USER ? Date.now() + LOGIN_LOCK_MS : row.bloqueadoAte;
    db.run(`UPDATE admin_auth SET falhas_login = ?, bloqueado_ate = ? WHERE id = ?`, [falhas >= LOGIN_MAX_FAILURES_USER ? 0 : falhas, bloqueio, row.id]);
  }
}

// Dados pessoais mascarados nos logs (LGPD): logs não precisam do telefone ou e-mail completo
const maskPhone = (v: string) => (v ? v.replace(/\d(?=\d{2})/g, '*') : '');
const maskEmail = (v: string) => (v ? v.replace(/^(.).*?(@.*)$/, '$1***$2') : '');
const maskName = (v: string) => (v ? v.split(/\s+/)[0].substring(0, 20) : '');

// Token fixo devolvido pelas chaves de teste do Cloudflare Turnstile
const TURNSTILE_TEST_TOKEN = 'XXXX.DUMMY.TOKEN.XXXX';

// =========================================================================
// Avaliações reais do Google (Places API - New)
// Requer GOOGLE_PLACES_API_KEY no .env. GOOGLE_PLACE_ID é opcional: se ausente,
// o ID é descoberto uma vez via Text Search pelo nome + endereço da loja.
// =========================================================================
const GOOGLE_REVIEWS_URL =
  'https://www.google.com/search?q=phoenix+eletrica#lrd=0x94ce586e18db2857:0x44a861fb89d1d1f5,1,,,,';
const GOOGLE_PLACE_QUERY = 'Phoenix Elétrica, R. Anhaia, 740 - Bom Retiro, São Paulo - SP';
const GOOGLE_REVIEWS_CACHE_MS = 6 * 60 * 60 * 1000;

let googleReviewsCache: { data: any; expiresAt: number } | null = null;
let resolvedPlaceId: string | null = process.env.GOOGLE_PLACE_ID || null;

async function fetchGooglePlaceReviews(): Promise<any | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return null;

  if (googleReviewsCache && googleReviewsCache.expiresAt > Date.now()) {
    return googleReviewsCache.data;
  }

  try {
    if (!resolvedPlaceId) {
      const searchRes = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'places.id'
        },
        body: JSON.stringify({ textQuery: GOOGLE_PLACE_QUERY, languageCode: 'pt-BR' })
      });
      const searchJson: any = await searchRes.json();
      resolvedPlaceId = searchJson?.places?.[0]?.id || null;
      if (!resolvedPlaceId) {
        console.warn('[Google Places] Loja não encontrada via Text Search:', searchJson?.error?.message || '');
        return googleReviewsCache?.data || null;
      }
    }

    const detailsRes = await fetch(
      `https://places.googleapis.com/v1/places/${resolvedPlaceId}?languageCode=pt-BR`,
      {
        headers: {
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'rating,userRatingCount,reviews,googleMapsUri'
        }
      }
    );
    const place: any = await detailsRes.json();
    if (!detailsRes.ok) {
      console.warn('[Google Places] Falha ao consultar avaliações:', place?.error?.message || detailsRes.status);
      return googleReviewsCache?.data || null;
    }

    const reviews = (place.reviews || []).map((r: any, idx: number) => ({
      id: idx + 1,
      autor: r.authorAttribution?.displayName || 'Cliente Google',
      cargo: 'Avaliação no Google',
      nota: r.rating || 5,
      data_texto: r.relativePublishTimeDescription || '',
      comentario: r.text?.text || r.originalText?.text || '',
      verificado: true,
      foto: r.authorAttribution?.photoUri || undefined,
      link: r.authorAttribution?.uri || undefined
    })).filter((r: any) => r.comentario);

    const data = {
      total: Number(place.userRatingCount || 0),
      ratingAverage: Number(place.rating || 0),
      reviews,
      source: 'google',
      googleUrl: GOOGLE_REVIEWS_URL
    };

    googleReviewsCache = { data, expiresAt: Date.now() + GOOGLE_REVIEWS_CACHE_MS };
    return data;
  } catch (err) {
    console.warn('[Google Places] Erro de rede ao buscar avaliações:', err);
    return googleReviewsCache?.data || null;
  }
}

// Inicialização do Banco SQLite
async function setupDatabase() {
  try {
    const SQL = await initSqlJs();
    if (fs.existsSync(DB_PATH)) {
      const fileBuffer = fs.readFileSync(DB_PATH);
      db = new SQL.Database(fileBuffer);
      console.log('✓ [SQLite] Banco de dados existente carregado de', DB_PATH);
    } else {
      db = new SQL.Database();
      console.log('✓ [SQLite] Novo banco em memória criado.');
    }

    db.run(`
      CREATE TABLE IF NOT EXISTS clientes_orcamento (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        telefone TEXT NOT NULL,
        cidade TEXT NOT NULL,
        materiais TEXT NOT NULL,
        aceita_marketing INTEGER NOT NULL DEFAULT 0,
        data_solicitacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Migração automática se a tabela já existir sem a coluna aceita_marketing ou email (ALTER TABLE)
    try {
      db.run(`ALTER TABLE clientes_orcamento ADD COLUMN aceita_marketing INTEGER NOT NULL DEFAULT 0`);
    } catch (_) {}
    try {
      db.run(`ALTER TABLE clientes_orcamento ADD COLUMN email TEXT DEFAULT ''`);
    } catch (_) {}
    try {
      db.run(`ALTER TABLE clientes_orcamento ADD COLUMN arquivo_nome TEXT DEFAULT ''`);
    } catch (_) {}
    try {
      db.run(`ALTER TABLE clientes_orcamento ADD COLUMN arquivo_tamanho TEXT DEFAULT ''`);
    } catch (_) {}
    try {
      db.run(`ALTER TABLE clientes_orcamento ADD COLUMN arquivo_url TEXT DEFAULT ''`);
    } catch (_) {}

    db.run(`
      CREATE TABLE IF NOT EXISTS visitas_site (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        data_hora TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        dispositivo TEXT,
        navegador TEXT,
        origem TEXT,
        pagina TEXT
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS avaliacoes_google (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        autor TEXT NOT NULL,
        cargo TEXT NOT NULL,
        nota INTEGER NOT NULL,
        data_texto TEXT NOT NULL,
        comentario TEXT NOT NULL,
        verificado INTEGER DEFAULT 1,
        data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS admin_auth (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario TEXT UNIQUE NOT NULL,
        senha TEXT NOT NULL,
        data_modificacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS cliques_whatsapp (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        origem_botao TEXT NOT NULL,
        rotulo TEXT,
        data_hora TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Colunas do 2FA, bloqueio por tentativas e revogação de sessões (bancos antigos ganham as colunas aqui)
    const adminColumns = [
      `totp_secret TEXT`,
      `totp_pendente TEXT`,
      `totp_ativo INTEGER DEFAULT 0`,
      `totp_ultimo_passo INTEGER`,
      `recuperacao TEXT DEFAULT '[]'`,
      `sessao_versao INTEGER DEFAULT 1`,
      `falhas_login INTEGER DEFAULT 0`,
      `bloqueado_ate INTEGER DEFAULT 0`
    ];
    for (const col of adminColumns) {
      try {
        db.run(`ALTER TABLE admin_auth ADD COLUMN ${col}`);
      } catch (_) {}
    }

    db.run(`
      CREATE TABLE IF NOT EXISTS admin_acessos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        data_hora TEXT NOT NULL,
        usuario TEXT,
        ip TEXT,
        navegador TEXT,
        evento TEXT NOT NULL,
        sucesso INTEGER NOT NULL
      )
    `);

    // Cria o login do painel a partir de ADMIN_USER / ADMIN_PASSWORD (nunca senha fixa no código)
    const adminCheck = db.exec(`SELECT COUNT(*) as total FROM admin_auth`);
    const totalAdmin = adminCheck[0]?.values[0]?.[0] || 0;
    if (totalAdmin === 0) {
      const adminUser = String(process.env.ADMIN_USER || '').trim();
      const adminPassword = process.env.ADMIN_PASSWORD || '';
      const policyError = adminPassword ? passwordPolicyError(adminPassword, adminUser) : 'ADMIN_PASSWORD ausente.';
      // Sem usuário padrão ("admin"): o nome também precisa ser definido
      if (adminUser.length >= 4 && !policyError) {
        db.run(`INSERT INTO admin_auth (usuario, senha) VALUES (?, ?)`, [adminUser, hashPassword(adminPassword)]);
      } else {
        console.warn(`⚠ [ADMIN] Defina ADMIN_USER (mín. 4 caracteres) e ADMIN_PASSWORD forte para criar o login do painel. ${policyError || ''}`);
      }
    }

    // Celular perdido sem códigos de recuperação: ADMIN_RESET_2FA=<usuario> desliga o 2FA desse usuário
    // no próximo início (o próximo login cadastra um novo celular). Remova a variável depois.
    const reset2fa = String(process.env.ADMIN_RESET_2FA || '').trim();
    if (reset2fa) {
      db.run(
        `UPDATE admin_auth SET totp_secret = NULL, totp_pendente = NULL, totp_ativo = 0, totp_ultimo_passo = NULL, recuperacao = '[]', sessao_versao = sessao_versao + 1 WHERE LOWER(usuario) = LOWER(?)`,
        [reset2fa]
      );
      console.warn(`⚠ [ADMIN] 2FA reiniciado para "${reset2fa}". Remova ADMIN_RESET_2FA do serviço.`);
    }

    // Login esquecido: ADMIN_RESET_USER + ADMIN_RESET_PASSWORD trocam o usuário e a senha do primeiro login
    // do painel no próximo início e desligam o 2FA dele. Remova as duas variáveis depois do primeiro acesso,
    // senão cada reinício volta a aplicar esta senha.
    const resetUser = String(process.env.ADMIN_RESET_USER || '').trim();
    const resetPassword = process.env.ADMIN_RESET_PASSWORD || '';
    if (resetUser || resetPassword) {
      const resetError = resetUser.length < 4
        ? 'ADMIN_RESET_USER precisa de no mínimo 4 caracteres.'
        : passwordPolicyError(resetPassword, resetUser);
      if (resetError) {
        console.warn(`⚠ [ADMIN] Reset de login ignorado: ${resetError}`);
      } else {
        const primeiro = db.exec(`SELECT MIN(id) FROM admin_auth`)[0]?.values[0]?.[0] as number | null | undefined;
        if (primeiro) {
          db.run(`DELETE FROM admin_auth WHERE LOWER(usuario) = LOWER(?) AND id <> ?`, [resetUser, primeiro]);
          db.run(
            `UPDATE admin_auth SET usuario = ?, senha = ?, totp_secret = NULL, totp_pendente = NULL, totp_ativo = 0, totp_ultimo_passo = NULL, recuperacao = '[]', sessao_versao = sessao_versao + 1, data_modificacao = CURRENT_TIMESTAMP WHERE id = ?`,
            [resetUser, hashPassword(resetPassword), primeiro]
          );
        } else {
          db.run(`INSERT INTO admin_auth (usuario, senha) VALUES (?, ?)`, [resetUser, hashPassword(resetPassword)]);
        }
        console.warn(`⚠ [ADMIN] Login do painel redefinido para "${resetUser}". Remova ADMIN_RESET_USER e ADMIN_RESET_PASSWORD do serviço.`);
      }
    }

    // Sem dados de exemplo: pedidos, visitas e cliques vêm apenas do uso real do site

    // Remove avaliações de exemplo antigas (não eram avaliações reais do Google)
    db.run(
      `DELETE FROM avaliacoes_google WHERE autor IN ('Carlos Alberto', 'Roberto Santos', 'Eduardo Lima') AND data_texto LIKE 'Há %'`
    );

    // Persiste no arquivo
    const data = db.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
    console.log('✓ [SQLite] Tabelas clientes_orcamento, visitas_site e avaliacoes_google prontas.');
  } catch (error) {
    console.error('Erro ao inicializar SQLite:', error);
  }
}

async function startServer() {
  // Serviço desativado: manda todo acesso para o endereço oficial e não abre o banco.
  // Evita dois servidores gravando no mesmo arquivo SQLite do bucket.
  const REDIRECT_TO_ORIGIN = (process.env.REDIRECT_TO_ORIGIN || '').replace(/\/+$/, '');
  if (!REDIRECT_TO_ORIGIN) {
    await setupDatabase();
  }

  const app = express();
  // Compressão gzip/brotli das respostas (HTML, JS, CSS, JSON): páginas mais rápidas
  app.use(compression());
  // Atrás de 1 proxy (Cloud Run / load balancer): req.ip passa a ser o IP real do visitante
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  // Cabeçalhos de segurança. A CSP só vale em produção (o Vite de desenvolvimento usa scripts inline)
  const isProduction = process.env.NODE_ENV === 'production';
  app.use(helmet({
    contentSecurityPolicy: isProduction ? {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", 'https://challenges.cloudflare.com'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
        imgSrc: ["'self'", 'data:', 'blob:', 'https://images.unsplash.com', 'https://storage.googleapis.com', 'https://*.googleusercontent.com'],
        connectSrc: ["'self'", 'https://rl4eobl3ypivmz3vzx6npkj6e40ldowj.lambda-url.us-east-2.on.aws', 'https://challenges.cloudflare.com'],
        frameSrc: ['https://challenges.cloudflare.com'],
        frameAncestors: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        upgradeInsecureRequests: []
      }
    } : false,
    // HSTS de 1 ano só no domínio principal (sem includeSubDomains: outros subdomínios podem não ter HTTPS)
    strictTransportSecurity: isProduction ? { maxAge: 31536000, includeSubDomains: false } : false,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    frameguard: { action: 'sameorigin' },
    // Imagens como og-image.png precisam abrir em outros sites (WhatsApp, Facebook)
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    // Popups de WhatsApp abertos pelo site continuam funcionando
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' }
  }));

  if (REDIRECT_TO_ORIGIN) {
    const redirectStatus = Number(process.env.REDIRECT_STATUS || 302);
    app.use((req, res) => res.redirect(redirectStatus, REDIRECT_TO_ORIGIN + req.originalUrl));
  }

  // Domínio oficial único para SEO: www e *.run.app vão com 301 para CANONICAL_HOST.
  // Só redireciona quando o host é diferente, então não há loop.
  const CANONICAL_HOST = (process.env.CANONICAL_HOST || '').toLowerCase();
  if (CANONICAL_HOST) {
    app.use((req, res, next) => {
      const host = (req.get('host') || '').toLowerCase().split(':')[0];
      if (!host || host === CANONICAL_HOST || host === 'localhost' || host === '127.0.0.1') return next();
      res.redirect(301, `https://${CANONICAL_HOST}${req.originalUrl}`);
    });
  }

  // Permissões do navegador que o site não usa ficam desligadas
  app.use((_req, res, next) => {
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()');
    next();
  });

  // Nunca serve arquivos internos (.env, .git, código-fonte, banco, mapas de código), mesmo por engano
  if (isProduction) {
    const BLOCKED_PATH = /(^|\/)\.(?!well-known\/)|\.(map|ts|tsx|env|db|sqlite|sql|log|bak|old|py|ya?ml|lock|ini|pem|key)$|(^|\/)(package(-lock)?\.json|tsconfig\.json|dockerfile|server\.(ts|js)|node_modules|src|lib|backend|phoenix_eletrica)(\/|\.|$)/i;
    app.use((req, res, next) => {
      let p = req.path;
      try {
        p = decodeURIComponent(p);
      } catch {
        return res.status(400).send('Endereço inválido');
      }
      return BLOCKED_PATH.test(p) ? res.status(404).send('Não encontrado') : next();
    });
  }

  // API: teto de requisições por IP e bloqueio de chamadas vindas de outros sites (CSRF)
  app.use('/api', limitApi, (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    // Navegador avisa quando a chamada vem de outro site
    if (req.get('sec-fetch-site') === 'cross-site') {
      return res.status(403).json({ status: 'error', message: 'Origem não permitida.' });
    }
    const origin = req.get('origin');
    if (origin) {
      let sameHost = false;
      try {
        sameHost = new URL(origin).host === req.get('host');
      } catch {}
      if (!sameHost) return res.status(403).json({ status: 'error', message: 'Origem não permitida.' });
    }
    // Só JSON: formulários HTML de outros sites não conseguem enviar este tipo sem permissão (CORS)
    if (!req.is('application/json')) {
      return res.status(415).json({ status: 'error', message: 'Envie os dados em JSON.' });
    }
    next();
  });

  // Corpo das requisições: 100kb em geral; só o upload aceita o arquivo em base64 (15MB viram ~20MB)
  const jsonSmall = express.json({ limit: '100kb' });
  const jsonUpload = express.json({ limit: '21mb' });
  app.use((req, res, next) => (req.path === '/api/upload' ? jsonUpload : jsonSmall)(req, res, next));

  // Diretório de Uploads para Anexos de Orçamentos (PDF, Word, Excel, etc.)
  const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
  app.use('/uploads', express.static(UPLOADS_DIR, {
    setHeaders: (res, filePath) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      const ext = path.extname(filePath).toLowerCase();
      if (ext === '.pdf' || ['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) {
        // PDFs e imagens abrem direto no navegador
        res.setHeader('Content-Disposition', 'inline');
      } else {
        // Demais formatos (e qualquer arquivo antigo fora da lista) só como download
        res.setHeader('Content-Disposition', 'attachment');
      }
    }
  }));

  // Rota de Health Check
  app.get('/api/health', (req, res) => {
    // Sem detalhes internos: só diz se o serviço está no ar
    res.status(db ? 200 : 503).json({ status: db ? 'ok' : 'starting' });
  });

  // Rota POST: Upload de Arquivo de Orçamento (PDF, Word, etc.)
  app.post('/api/upload', limitUpload, async (req, res) => {
    try {
      const { fileBase64 } = req.body;
      const fileName = clip(req.body.fileName, 200);
      const fileSize = clip(req.body.fileSize, 30);

      if (!fileName || !fileBase64) {
        return res.status(400).json({
          status: 'error',
          message: 'fileName e fileBase64 são obrigatórios para o upload.'
        });
      }

      // Só aceita formatos de lista/orçamento (bloqueia .html, .svg, .js etc., que permitiriam XSS)
      const cleanExt = path.extname(String(fileName)).toLowerCase();
      const contentType = UPLOAD_CONTENT_TYPES[cleanExt];
      if (!contentType) {
        return res.status(400).json({
          status: 'error',
          message: 'Formato não permitido. Envie PDF, Word, Excel, CSV, TXT ou imagem (PNG, JPG, WEBP).'
        });
      }

      const base64Data = String(fileBase64).replace(/^data:[^;]+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      if (buffer.length > UPLOAD_MAX_BYTES) {
        return res.status(413).json({ status: 'error', message: 'Arquivo acima de 15MB.' });
      }
      if (buffer.length === 0) {
        return res.status(400).json({ status: 'error', message: 'Arquivo vazio.' });
      }
      // Conteúdo precisa bater com a extensão (bloqueia arquivo disfarçado, ex.: página HTML renomeada para .pdf)
      if (!hasValidSignature(cleanExt, buffer)) {
        console.warn(`[UPLOAD] Recusado: conteúdo não confere com ${cleanExt}.`);
        return res.status(400).json({ status: 'error', message: 'O conteúdo do arquivo não confere com o formato. Envie o arquivo original.' });
      }
      // Teto diário de uploads no site todo (protege o armazenamento contra abuso)
      const today = new Date().toISOString().slice(0, 10);
      if (uploadDailyCount.day !== today) uploadDailyCount = { day: today, total: 0 };
      if (uploadDailyCount.total >= UPLOAD_DAILY_MAX) {
        return res.status(429).json({ status: 'error', message: 'Limite diário de envios atingido. Envie a lista pelo WhatsApp.' });
      }
      uploadDailyCount.total += 1;

      const rawBaseName = path.basename(String(fileName), path.extname(String(fileName)));
      const safeBaseName = rawBaseName.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 50);
      // Sufixo aleatório: o link não pode ser adivinhado por quem não o recebeu
      const safeFileName = `orcamento-${Date.now()}-${crypto.randomBytes(6).toString('hex')}-${safeBaseName}${cleanExt}`;

      let fileUrl: string;
      const bucketName = process.env.GCS_BUCKET;

      if (bucketName) {
        // Produção e dev: Google Cloud Storage gera um link público permanente
        const objectName = `orcamentos/${safeFileName}`;
        await getStorage().bucket(bucketName).file(objectName).save(buffer, {
          contentType,
          resumable: false,
          metadata: {
            contentDisposition: cleanExt === '.pdf' || contentType.startsWith('image/') ? 'inline' : 'attachment',
            cacheControl: 'public, max-age=31536000'
          }
        });
        fileUrl = `https://storage.googleapis.com/${bucketName}/${objectName}`;
      } else {
        // Sem bucket configurado: disco local (link só funciona onde o servidor está acessível)
        fs.writeFileSync(path.join(UPLOADS_DIR, safeFileName), buffer);
        const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'https';
        const forwardedHost = (req.headers['x-forwarded-host'] as string) || req.get('host') || `localhost:${PORT}`;
        const baseUrl = (process.env.PUBLIC_BASE_URL || `${proto}://${forwardedHost}`).replace(/\/$/, '');
        fileUrl = `${baseUrl}/uploads/${safeFileName}`;
      }

      console.log(`✓ [UPLOAD CONCLUÍDO] ${cleanExt} (${fileSize || 'N/A'})`);

      return res.status(200).json({
        status: 'success',
        fileName,
        safeFileName,
        url: fileUrl,
        size: fileSize || ''
      });
    } catch (err: any) {
      console.error('Erro no upload de arquivo:', err);
      return res.status(500).json({
        status: 'error',
        message: 'Falha ao processar o upload do arquivo'
      });
    }
  });

  // Rota POST: Assistente IA de orçamento.
  // Devolve a resposta, a lista estruturada de itens e a etapa da conversa (coletando, aguardando_confirmacao, confirmado).
  app.post('/api/chat-assistant', async (req, res) => {
    try {
      const { messages: rawMessages } = req.body;
      if (!Array.isArray(rawMessages) || rawMessages.length === 0) {
        return res.status(400).json({
          status: 'error',
          message: 'Histórico de mensagens é obrigatório.'
        });
      }

      // Limita tamanho do histórico e de cada mensagem para controlar o custo por chamada
      const messages: AgentMessage[] = rawMessages
        .slice(-CHAT_MAX_HISTORY)
        .map((m: any) => ({
          role: (m?.role === 'assistant' || m?.sender === 'assistant' ? 'assistant' : 'user') as AgentMessage['role'],
          text: String(m?.text || m?.content || '').slice(0, CHAT_MAX_CHARS_PER_MESSAGE)
        }))
        .filter((m) => m.text.trim());
      if (!messages.length || messages[messages.length - 1].role !== 'user') {
        return res.status(400).json({ status: 'error', message: 'A última mensagem deve ser do cliente.' });
      }

      const limitMessage = checkChatRateLimit(req.ip || 'desconhecido');
      if (limitMessage) {
        return res.status(429).json({ status: 'error', message: limitMessage });
      }

      // Lista e etapa atuais vêm do navegador (é a lista que o cliente está vendo)
      const prevItems = sanitizeItems(req.body.items);
      const prevStage = sanitizeStage(req.body.stage);
      const lastText = messages[messages.length - 1].text;

      const send = (provider: string, reply: AgentReply, model?: string) =>
        res.status(200).json({ status: 'success', provider, model, ...reply });

      // OK na etapa de confirmação: resposta fixa, sem gastar chamada de IA
      if (prevStage === 'aguardando_confirmacao' && isConfirmation(lastText)) {
        return send('rules', { text: CONFIRMED_TEXT, items: prevItems, stage: 'confirmado' });
      }

      const systemInstruction = AGENT_SYSTEM_PROMPT + buildStateInstruction(prevItems, prevStage);

      // Resposta do modelo em JSON; qualquer formato inválido é descartado (passa ao próximo modelo)
      const parseModelJson = (raw: string): AgentReply | null => {
        try {
          const data = JSON.parse(raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''));
          if (typeof data?.resposta !== 'string' || !Array.isArray(data?.itens)) return null;
          return finalizeReply(clip(data.resposta, 3000), sanitizeItems(data.itens), sanitizeStage(data.etapa), prevItems, prevStage);
        } catch {
          return null;
        }
      };

      // 1. Gemini (chave apenas no servidor, nunca com prefixo VITE_)
      const geminiApiKey = process.env.GEMINI_API_KEY;
      if (geminiApiKey) {
        const ai = new GoogleGenAI({ apiKey: geminiApiKey });
        // Gemini exige que a primeira mensagem em contents seja do usuário
        const firstUserIdx = messages.findIndex((m) => m.role === 'user');
        const contents = messages.slice(firstUserIdx).map((m) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.text }]
        }));

        // Tenta os modelos em ordem: se um estiver sobrecarregado (503) ou lento, passa ao próximo
        for (const model of GEMINI_MODELS) {
          try {
            const geminiResponse = await ai.models.generateContent({
              model,
              contents,
              config: {
                systemInstruction,
                temperature: 0.1,
                maxOutputTokens: CHAT_MAX_OUTPUT_TOKENS,
                responseMimeType: 'application/json',
                responseJsonSchema: AGENT_RESPONSE_SCHEMA,
                thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
                httpOptions: { timeout: GEMINI_TIMEOUT_MS }
              }
            });
            const reply = geminiResponse.text ? parseModelJson(geminiResponse.text) : null;
            if (reply) return send('gemini', reply, model);
            console.warn(`[Gemini] ${model} devolveu resposta fora do formato.`);
          } catch (modelError: any) {
            console.warn(`[Gemini] ${model} falhou (${modelError?.status || 'timeout'}):`, String(modelError?.message || modelError).slice(0, 160));
            // Chave inválida, sem permissão ou sem créditos: outros modelos também falhariam
            if ([400, 401, 402, 403].includes(modelError?.status)) break;
          }
        }
      }

      // 2. OpenAI (apenas no servidor)
      const openAiApiKey = process.env.OPENAI_API_KEY;
      if (openAiApiKey) {
        try {
          const openAiRes = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${openAiApiKey}`
            },
            body: JSON.stringify({
              model: 'gpt-4o-mini',
              messages: [
                {
                  role: 'system',
                  content: `${systemInstruction}\n\nResponda somente com um JSON neste formato: {"resposta": "...", "etapa": "coletando", "itens": [{"produto": "...", "especificacao": "...", "quantidade": "..."}]}`
                },
                ...messages.map((m) => ({ role: m.role, content: m.text }))
              ],
              temperature: 0.1,
              max_tokens: CHAT_MAX_OUTPUT_TOKENS,
              response_format: { type: 'json_object' }
            }),
            signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS)
          });

          if (openAiRes.ok) {
            const data: any = await openAiRes.json();
            const reply = parseModelJson(String(data.choices?.[0]?.message?.content || ''));
            if (reply) return send('openai', reply, 'gpt-4o-mini');
          } else {
            console.warn(`[OpenAI] Falhou com status ${openAiRes.status}.`);
          }
        } catch (openAiError: any) {
          console.warn('Erro ao processar chamada OpenAI no servidor:', openAiError?.message || openAiError);
        }
      }

      // 3. Sem IA disponível: anota o que o cliente escreve e segue o mesmo fluxo de confirmação
      return send('fallback', fallbackReply(messages, prevItems, prevStage));
    } catch (err: any) {
      console.error('Erro na rota /api/chat-assistant:', err);
      return res.status(500).json({
        status: 'error',
        message: 'Erro interno ao processar conversa com o assistente.'
      });
    }
  });

  // Rota POST: Integração e Proxy com AWS Lambda para captação de leads (Resolve problemas de CORS no navegador)
  app.post('/api/lambda-lead', limitLead, async (req, res) => {
    try {
      const { nome, email, token } = req.body;
      const cleanNome = clip(nome, 120);
      const cleanEmail = clip(email, 160);
      const cleanToken = clip(token, 4096);

      if (!cleanNome || !cleanEmail) {
        return res.status(400).json({
          status: 'error',
          message: 'Os campos nome e email são obrigatórios.'
        });
      }

      if (!cleanToken) {
        return res.status(400).json({
          status: 'error',
          message: 'Verificação de segurança (Cloudflare Turnstile) ausente.'
        });
      }

      // Chaves de teste do Turnstile (1x0000...AA) geram sempre este token fictício, que a Lambda
      // (validada com a secret real) recusa. Aceito apenas fora de produção, para testes locais.
      if (cleanToken === TURNSTILE_TEST_TOKEN) {
        if (process.env.NODE_ENV === 'production') {
          return res.status(403).json({
            status: 'error',
            message: 'Chave de teste do Turnstile não é aceita em produção.'
          });
        }
        console.warn('[Turnstile] Token de teste aceito em desenvolvimento (Lambda não acionada).');
        return res.status(200).json({
          status: 'success',
          message: 'Lead aceito em modo de teste do Turnstile (desenvolvimento)',
          data: { testMode: true }
        });
      }

      const AWS_LAMBDA_URL = 'https://rl4eobl3ypivmz3vzx6npkj6e40ldowj.lambda-url.us-east-2.on.aws/';
      const lambdaResponse = await fetch(AWS_LAMBDA_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          nome: cleanNome,
          email: cleanEmail,
          token: cleanToken
        })
      });

      const lambdaText = await lambdaResponse.text();
      let lambdaData: any = {};
      try {
        lambdaData = JSON.parse(lambdaText);
      } catch (_) {
        lambdaData = { raw: lambdaText };
      }

      if (!lambdaResponse.ok) {
        console.warn(`[AWS Lambda Proxy] Resposta com status ${lambdaResponse.status}:`, lambdaText.substring(0, 200));
        return res.status(lambdaResponse.status).json({
          status: 'error',
          message: 'Erro retornado pela AWS Lambda',
          // Só a mensagem amigável da Lambda segue para o navegador
          detail: typeof lambdaData?.mensagem === 'string' ? { mensagem: lambdaData.mensagem.substring(0, 300) } : undefined
        });
      }

      console.log(`✓ [AWS Lambda Proxy] Lead enviado (${maskEmail(cleanEmail)}).`);
      return res.status(200).json({
        status: 'success',
        message: 'Lead enviado com sucesso para AWS Lambda'
      });
    } catch (err: any) {
      console.error('Erro no proxy AWS Lambda:', err);
      return res.status(500).json({
        status: 'error',
        message: 'Falha na conexão com a AWS Lambda.'
      });
    }
  });

  // Rota POST: Inserir novo orçamento (Lead com verificação LGPD e suporte a anexo)
  app.post('/api/orcamentos', limitOrcamento, (req, res) => {
    try {
      const { nome, email, telefone, cidade, materiais, aceita_marketing, arquivo_nome, arquivo_tamanho, arquivo_url } = req.body;

      const cleanNome = clip(nome, 120);
      const cleanTelefone = clip(telefone, 30);
      const cleanCidade = clip(cidade, 100);
      const cleanArquivoNome = clip(arquivo_nome, 200);
      const cleanArquivoTamanho = clip(arquivo_tamanho, 30);
      const rawArquivoUrl = clip(arquivo_url, 500);
      const cleanArquivoUrl = rawArquivoUrl && isAllowedArquivoUrl(rawArquivoUrl) ? rawArquivoUrl : '';
      if (rawArquivoUrl && !cleanArquivoUrl) {
        console.warn('[ORÇAMENTO] Link de anexo recusado (fora do bucket de anexos).');
      }
      let cleanMateriais = clip(materiais, 10000);

      if (!cleanMateriais && cleanArquivoNome) {
        cleanMateriais = `[Arquivo em Anexo: ${cleanArquivoNome}]`;
      }

      if (!cleanNome || !cleanTelefone || !cleanCidade || !cleanMateriais) {
        return res.status(400).json({
          status: 'error',
          message: 'Campos nome, telefone, cidade e lista de materiais (ou anexo) são obrigatórios.'
        });
      }

      // Converte consentimento explícito LGPD para 1 (True) ou 0 (False)
      const optInMarketing = (aceita_marketing === true || aceita_marketing === 1 || aceita_marketing === '1') ? 1 : 0;
      const cleanEmail = clip(email, 160);

      const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

      if (db) {
        try {
          db.run(
            `INSERT INTO clientes_orcamento (nome, email, telefone, cidade, materiais, aceita_marketing, arquivo_nome, arquivo_tamanho, arquivo_url, data_solicitacao) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [cleanNome, cleanEmail, cleanTelefone, cleanCidade, cleanMateriais, optInMarketing, cleanArquivoNome, cleanArquivoTamanho, cleanArquivoUrl, now]
          );
        } catch (_) {
          try {
            db.run(
              `INSERT INTO clientes_orcamento (nome, email, telefone, cidade, materiais, aceita_marketing, arquivo_nome, arquivo_tamanho, data_solicitacao) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [cleanNome, cleanEmail, cleanTelefone, cleanCidade, cleanMateriais, optInMarketing, cleanArquivoNome, cleanArquivoTamanho, now]
            );
          } catch (__) {
            db.run(
              `INSERT INTO clientes_orcamento (nome, telefone, cidade, materiais, aceita_marketing, data_solicitacao) VALUES (?, ?, ?, ?, ?, ?)`,
              [cleanNome, cleanTelefone, cleanCidade, cleanMateriais, optInMarketing, now]
            );
          }
        }

        // Obtém o último ID inserido (antes de exportar: export pode zerar last_insert_rowid)
        const result = db.exec('SELECT last_insert_rowid() as id');

        // Orçamento é dado importante: grava no arquivo SQLite na hora
        saveDbNow();
        const leadId = result[0]?.values[0]?.[0] || Date.now();

        console.log(`[NOVO ORÇAMENTO REGISTRADO] ID: ${leadId} - Cliente: ${maskName(cleanNome)} - Tel: ${maskPhone(cleanTelefone)} - Anexo: ${cleanArquivoNome ? 'sim' : 'não'}`);

        return res.status(200).json({
          status: 'success',
          message: 'Orçamento registrado com sucesso',
          id: leadId,
          data_solicitacao: now,
          lead: { 
            nome: cleanNome, 
            telefone: cleanTelefone, 
            cidade: cleanCidade, 
            materiais: cleanMateriais, 
            arquivo_nome: cleanArquivoNome, 
            arquivo_tamanho: cleanArquivoTamanho,
            arquivo_url: cleanArquivoUrl,
            aceita_marketing: optInMarketing 
          }
        });
      } else {
        // Fallback se DB ainda não inicializou
        return res.status(200).json({
          status: 'success',
          message: 'Orçamento recebido',
          id: Date.now(),
          data_solicitacao: now
        });
      }
    } catch (err: any) {
      console.error('Erro ao registrar orçamento:', err);
      return res.status(500).json({
        status: 'error',
        message: 'Erro interno ao salvar no banco de dados'
      });
    }
  });

  // Rota GET: Listar orçamentos recebidos (Painel Administrativo)
  app.get('/api/orcamentos', limitAdmin, requireAdmin, (req, res) => {
    try {
      if (!db) {
        return res.json({ total: 0, leads: [] });
      }

      let result;
      try {
        result = db.exec(
          `SELECT id, nome, email, telefone, cidade, materiais, aceita_marketing, arquivo_nome, arquivo_tamanho, arquivo_url, data_solicitacao FROM clientes_orcamento ORDER BY id DESC LIMIT 50`
        );
      } catch (_) {
        try {
          result = db.exec(
            `SELECT id, nome, email, telefone, cidade, materiais, aceita_marketing, arquivo_nome, arquivo_tamanho, data_solicitacao FROM clientes_orcamento ORDER BY id DESC LIMIT 50`
          );
        } catch (__) {
          result = db.exec(
            `SELECT id, nome, telefone, cidade, materiais, aceita_marketing, data_solicitacao FROM clientes_orcamento ORDER BY id DESC LIMIT 50`
          );
        }
      }

      if (!result || result.length === 0) {
        return res.json({ total: 0, leads: [] });
      }

      const columns = result[0].columns;
      const values = result[0].values;

      const leads = values.map((row: any[]) => {
        const item: Record<string, any> = {};
        columns.forEach((col: string, idx: number) => {
          item[col] = row[idx];
        });
        return item;
      });

      return res.json({ total: leads.length, leads });
    } catch (err: any) {
      console.error('Erro ao consultar leads:', err);
      return res.status(500).json({ status: 'error', message: 'Erro interno no servidor.' });
    }
  });

  // Rota POST: Login do lojista, etapa 1 (usuário e senha). Devolve a etapa do 2FA, nunca a sessão direto.
  app.post('/api/admin/login', limitAdmin, async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    try {
      if (req.get(ADMIN_CSRF_HEADER) !== '1') {
        return res.status(403).json({ success: false, message: 'Requisição recusada.' });
      }
      if (!ADMIN_LOGIN_ENABLED || !db) {
        return res.status(503).json({ success: false, message: 'Login do painel indisponível.' });
      }

      const ip = req.ip || 'desconhecido';
      if (tooManyLoginFailures(ip)) {
        return res.status(429).json({ success: false, message: 'Muitas tentativas. Aguarde 15 minutos.' });
      }

      const usuario = clip(req.body?.usuario, 60);
      const senha = typeof req.body?.senha === 'string' ? req.body.senha.substring(0, 128) : '';
      if (!usuario || !senha) {
        return res.status(400).json({ success: false, message: 'Informe usuário e senha.' });
      }

      const row = getAdminRow(usuario);
      if (row && row.bloqueadoAte > Date.now()) {
        logAdminEvent(req, usuario, 'login bloqueado', false);
        saveDbSoon();
        return res.status(429).json({ success: false, message: 'Acesso bloqueado temporariamente por excesso de tentativas. Tente mais tarde.' });
      }

      // Usuário inexistente também calcula um hash: a resposta leva o mesmo tempo
      const passwordOk = verifyPassword(senha, row ? row.senha : DUMMY_PASSWORD_HASH) && !!row;
      if (!row || !passwordOk) {
        registerLoginFailure(ip, row);
        logAdminEvent(req, usuario, 'senha incorreta', false);
        saveDbSoon();
        return res.status(401).json({ success: false, message: 'Usuário ou senha incorretos.' });
      }

      const updates: string[] = ['falhas_login = 0', 'bloqueado_ate = 0'];
      const params: any[] = [];
      if (!row.senha.startsWith('scrypt$')) {
        updates.push('senha = ?');
        params.push(hashPassword(senha));
      }

      // Primeiro acesso sem 2FA: gera o segredo e mostra o QR Code para cadastrar o celular
      let enroll: { qr: string; secret: string } | null = null;
      if (!row.totpAtivo) {
        const secret = generateTotpSecret();
        updates.push('totp_pendente = ?');
        params.push(encryptSecret(secret, SIGNING_SECRET));
        enroll = { qr: await QRCode.toDataURL(totpUri(secret, row.usuario), { margin: 1, width: 220 }), secret };
      }

      db.run(`UPDATE admin_auth SET ${updates.join(', ')} WHERE id = ?`, [...params, row.id]);
      logAdminEvent(req, row.usuario, 'senha correta (aguardando 2FA)', true);
      saveDbNow();

      const mfaToken = signAdminToken({ p: 'mfa', u: row.usuario, v: row.sessaoVersao, exp: Date.now() + MFA_TOKEN_TTL_MS, ...(enroll ? { e: 1 as const } : {}) });
      return res.json({ success: true, step: enroll ? 'enroll' : 'mfa', mfaToken, ...(enroll || {}) });
    } catch (err: any) {
      console.error('Erro no login admin:', err);
      return res.status(500).json({ success: false, message: 'Erro interno ao validar login.' });
    }
  });

  // Rota POST: Login do lojista, etapa 2 (código do aplicativo autenticador ou código de recuperação)
  app.post('/api/admin/login/2fa', limitAdmin, (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    try {
      if (req.get(ADMIN_CSRF_HEADER) !== '1') {
        return res.status(403).json({ success: false, message: 'Requisição recusada.' });
      }
      const ip = req.ip || 'desconhecido';
      if (tooManyLoginFailures(ip)) {
        return res.status(429).json({ success: false, message: 'Muitas tentativas. Aguarde 15 minutos.' });
      }

      const pending = verifyAdminToken(clip(req.body?.mfaToken, 2048), 'mfa');
      const codigo = clip(req.body?.codigo, 20);
      const row = pending ? getAdminRow(pending.u) : null;
      if (!pending || !row || row.sessaoVersao !== pending.v || !db) {
        return res.status(401).json({ success: false, message: 'Etapa expirada. Faça login novamente.', restart: true });
      }

      // Cada etapa aceita poucas tentativas de código
      const attempts = (mfaAttempts.get(pending.jti) || 0) + 1;
      mfaAttempts.set(pending.jti, attempts);
      setTimeout(() => mfaAttempts.delete(pending.jti), MFA_TOKEN_TTL_MS).unref();
      if (attempts > MFA_MAX_ATTEMPTS) {
        return res.status(429).json({ success: false, message: 'Muitas tentativas de código. Faça login novamente.', restart: true });
      }

      let recoveryCodes: string[] | undefined;

      if (pending.e) {
        // Cadastro do celular: confere o primeiro código e ativa o 2FA
        const secret = row.totpPendente ? decryptSecret(row.totpPendente, SIGNING_SECRET) : null;
        const step = secret ? verifyTotp(secret, codigo, null) : null;
        if (!secret || step === null) {
          registerLoginFailure(ip, null);
          logAdminEvent(req, row.usuario, 'código 2FA incorreto (cadastro)', false);
          saveDbSoon();
          return res.status(401).json({ success: false, message: 'Código incorreto. Confira o horário do celular e tente de novo.' });
        }
        recoveryCodes = generateRecoveryCodes();
        db.run(
          `UPDATE admin_auth SET totp_secret = ?, totp_pendente = NULL, totp_ativo = 1, totp_ultimo_passo = ?, recuperacao = ? WHERE id = ?`,
          [row.totpPendente, step, JSON.stringify(recoveryCodes.map(hashRecoveryCode)), row.id]
        );
        logAdminEvent(req, row.usuario, '2FA ativado', true);
      } else {
        const secret = row.totpSecret ? decryptSecret(row.totpSecret, SIGNING_SECRET) : null;
        const step = secret ? verifyTotp(secret, codigo, row.totpUltimoPasso) : null;
        if (step !== null) {
          db.run(`UPDATE admin_auth SET totp_ultimo_passo = ? WHERE id = ?`, [step, row.id]);
          logAdminEvent(req, row.usuario, 'login com 2FA', true);
        } else {
          // Código de recuperação (uso único)
          const hash = hashRecoveryCode(codigo);
          const isRecovery = /^[A-F0-9]{5}-?[A-F0-9]{5}$/i.test(codigo) && row.recuperacao.includes(hash);
          if (!isRecovery) {
            registerLoginFailure(ip, null);
            logAdminEvent(req, row.usuario, 'código 2FA incorreto', false);
            saveDbSoon();
            return res.status(401).json({ success: false, message: 'Código incorreto.' });
          }
          db.run(`UPDATE admin_auth SET recuperacao = ? WHERE id = ?`, [JSON.stringify(row.recuperacao.filter((h) => h !== hash)), row.id]);
          logAdminEvent(req, row.usuario, 'login com código de recuperação', true);
        }
      }

      saveDbNow();
      mfaAttempts.delete(pending.jti);
      loginFailuresByIp.delete(ip);
      issueSession(res, row);
      return res.json({ success: true, usuario: row.usuario, recoveryCodes });
    } catch (err: any) {
      console.error('Erro na verificação 2FA:', err);
      return res.status(500).json({ success: false, message: 'Erro interno ao validar código.' });
    }
  });

  // Rota GET: Sessão atual do painel (usuário, códigos de recuperação restantes)
  app.get('/api/admin/session', limitAdmin, requireAdmin, (req, res) => {
    const row = getAdminRow((req as any).adminUser);
    return res.json({ success: true, usuario: row?.usuario, codigosRecuperacao: row?.recuperacao.length || 0 });
  });

  // Rota GET: Histórico de acessos ao painel
  app.get('/api/admin/acessos', limitAdmin, requireAdmin, (_req, res) => {
    const result = db?.exec(`SELECT data_hora, usuario, ip, navegador, evento, sucesso FROM admin_acessos ORDER BY id DESC LIMIT 40`);
    const acessos = (result?.[0]?.values || []).map((r: any[]) => ({
      data_hora: r[0],
      usuario: r[1],
      ip: r[2],
      navegador: r[3],
      evento: r[4],
      sucesso: Number(r[5]) === 1
    }));
    return res.json({ success: true, acessos });
  });

  // Rota POST: Sair (apaga o cookie desta sessão)
  app.post('/api/admin/logout', limitAdmin, (req, res) => {
    if (req.get(ADMIN_CSRF_HEADER) !== '1') {
      return res.status(403).json({ success: false, message: 'Requisição recusada.' });
    }
    clearSessionCookie(res);
    return res.json({ success: true });
  });

  // Rota POST: Encerrar todas as sessões abertas (outros computadores e celulares)
  app.post('/api/admin/logout-all', limitAdmin, requireAdmin, (req, res) => {
    const usuario = (req as any).adminUser as string;
    db!.run(`UPDATE admin_auth SET sessao_versao = sessao_versao + 1 WHERE LOWER(usuario) = LOWER(?)`, [usuario]);
    logAdminEvent(req, usuario, 'encerrou todas as sessões', true);
    saveDbNow();
    clearSessionCookie(res);
    return res.json({ success: true });
  });

  // Rota POST: Alterar senha do admin (exige senha atual e código 2FA; derruba as outras sessões)
  app.post('/api/admin/change-password', limitAdmin, requireAdmin, (req, res) => {
    try {
      const usuario = (req as any).adminUser as string;
      const senhaAtual = typeof req.body?.senhaAtual === 'string' ? req.body.senhaAtual.substring(0, 128) : '';
      const novaSenha = typeof req.body?.novaSenha === 'string' ? req.body.novaSenha : '';
      const codigo = clip(req.body?.codigo, 20);
      const row = getAdminRow(usuario);
      if (!row || !senhaAtual || !novaSenha || !codigo) {
        return res.status(400).json({ success: false, message: 'Preencha a senha atual, a nova senha e o código do aplicativo.' });
      }

      const policyError = passwordPolicyError(novaSenha, usuario);
      if (policyError) return res.status(400).json({ success: false, message: policyError });

      if (!verifyPassword(senhaAtual, row.senha)) {
        logAdminEvent(req, usuario, 'troca de senha: senha atual incorreta', false);
        saveDbSoon();
        return res.status(401).json({ success: false, message: 'Senha atual incorreta.' });
      }
      const secret = row.totpSecret ? decryptSecret(row.totpSecret, SIGNING_SECRET) : null;
      const step = secret ? verifyTotp(secret, codigo, row.totpUltimoPasso) : null;
      if (step === null) {
        logAdminEvent(req, usuario, 'troca de senha: código 2FA incorreto', false);
        saveDbSoon();
        return res.status(401).json({ success: false, message: 'Código do aplicativo incorreto.' });
      }

      db!.run(
        `UPDATE admin_auth SET senha = ?, totp_ultimo_passo = ?, sessao_versao = sessao_versao + 1, data_modificacao = CURRENT_TIMESTAMP WHERE id = ?`,
        [hashPassword(novaSenha), step, row.id]
      );
      logAdminEvent(req, usuario, 'senha alterada', true);
      saveDbNow();
      // Esta sessão continua; as outras caem
      issueSession(res, getAdminRow(usuario)!);
      return res.json({ success: true, message: 'Senha alterada. Outras sessões abertas foram encerradas.' });
    } catch (err: any) {
      console.error('Erro ao alterar senha admin:', err);
      return res.status(500).json({ success: false, message: 'Erro ao alterar senha.' });
    }
  });

  // Rota POST: Gerar novos códigos de recuperação (os antigos deixam de valer)
  app.post('/api/admin/recovery-codes', limitAdmin, requireAdmin, (req, res) => {
    const usuario = (req as any).adminUser as string;
    const row = getAdminRow(usuario);
    const secret = row?.totpSecret ? decryptSecret(row.totpSecret, SIGNING_SECRET) : null;
    const step = secret ? verifyTotp(secret, clip(req.body?.codigo, 20), row!.totpUltimoPasso) : null;
    if (!row || step === null) {
      return res.status(401).json({ success: false, message: 'Código do aplicativo incorreto.' });
    }
    const codes = generateRecoveryCodes();
    db!.run(`UPDATE admin_auth SET recuperacao = ?, totp_ultimo_passo = ? WHERE id = ?`, [JSON.stringify(codes.map(hashRecoveryCode)), step, row.id]);
    logAdminEvent(req, usuario, 'novos códigos de recuperação', true);
    saveDbNow();
    return res.json({ success: true, recoveryCodes: codes });
  });

  // Rota DELETE: Excluir lead pelo lojista
  app.delete('/api/orcamentos/:id', limitAdmin, requireAdmin, (req, res) => {
    try {
      // Só aceita ID numérico
      const id = Number(req.params.id);
      if (!Number.isSafeInteger(id) || id <= 0) {
        return res.status(400).json({ success: false, message: 'ID inválido.' });
      }
      if (!db) {
        return res.status(500).json({ success: false, message: 'Banco de dados não disponível.' });
      }

      db.run(`DELETE FROM clientes_orcamento WHERE id = ?`, [id]);
      logAdminEvent(req, (req as any).adminUser, `excluiu orçamento #${id}`, true);
      saveDbNow();

      return res.json({ success: true, message: 'Lead excluído com sucesso.' });
    } catch (err: any) {
      console.error('Erro ao excluir lead:', err);
      return res.status(500).json({ success: false, message: 'Erro ao excluir lead.' });
    }
  });

  // Rota POST: Registrar clique no botão do WhatsApp em qualquer ponto do site
  app.post('/api/eventos/clique-whatsapp', limitEvento, (req, res) => {
    try {
      const { origem, rotulo } = req.body || {};
      const origemBotao = String(origem || 'Botão Flutuante (WhatsApp)').substring(0, 100);
      const rotuloFinal = String(rotulo || 'WhatsApp Oficial').substring(0, 100);
      const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

      if (db) {
        db.run(
          `INSERT INTO cliques_whatsapp (origem_botao, rotulo, data_hora) VALUES (?, ?, ?)`,
          [origemBotao, rotuloFinal, now]
        );
        saveDbSoon();
      }

      return res.status(200).json({ success: true, timestamp: now });
    } catch (err: any) {
      console.error('Erro ao registrar clique whatsapp:', err);
      return res.status(200).json({ success: false });
    }
  });

  // Rota GET: Métricas Executivas e Dashboard Mensal Consolidado
  app.get('/api/admin/dashboard', limitAdmin, requireAdmin, (req, res) => {
    try {
      if (!db) {
        return res.status(500).json({ error: 'Banco de dados não disponível' });
      }

      const hojeDate = new Date().toISOString().substring(0, 10);

      // 1. Totais Gerais
      const totalVisitasRes = db.exec(`SELECT COUNT(*) FROM visitas_site`);
      const totalVisitas = Number(totalVisitasRes[0]?.values[0]?.[0] || 0);

      const totalOrcamentosRes = db.exec(`SELECT COUNT(*) FROM clientes_orcamento`);
      const totalOrcamentos = Number(totalOrcamentosRes[0]?.values[0]?.[0] || 0);

      const totalCliquesRes = db.exec(`SELECT COUNT(*) FROM cliques_whatsapp`);
      const totalCliques = Number(totalCliquesRes[0]?.values[0]?.[0] || 0);

      const totalAcoesComerciais = totalOrcamentos + totalCliques;

      const visitasHojeRes = db.exec(`SELECT COUNT(*) FROM visitas_site WHERE data_hora LIKE '${hojeDate}%'`);
      const visitasHoje = Number(visitasHojeRes[0]?.values[0]?.[0] || 0);

      const orcamentosHojeRes = db.exec(`SELECT COUNT(*) FROM clientes_orcamento WHERE data_solicitacao LIKE '${hojeDate}%'`);
      const orcamentosHoje = Number(orcamentosHojeRes[0]?.values[0]?.[0] || 0);

      const cliquesHojeRes = db.exec(`SELECT COUNT(*) FROM cliques_whatsapp WHERE data_hora LIKE '${hojeDate}%'`);
      const cliquesHoje = Number(cliquesHojeRes[0]?.values[0]?.[0] || 0);

      // Taxas calculadas de forma realista e padronizada (limitada a 100% no percentual global)
      const taxaOrcamentos = totalVisitas > 0 ? Number(((totalOrcamentos / totalVisitas) * 100).toFixed(1)) : 0;
      const taxaCliquesWhatsapp = totalVisitas > 0 ? Number(((totalCliques / totalVisitas) * 100).toFixed(1)) : 0;
      const taxaConversaoGeral = totalVisitas > 0 
        ? Math.min(100, Number((((totalOrcamentos + totalCliques) / totalVisitas) * 100).toFixed(1)))
        : 0;

      // 2. Histórico Mensal (Últimos 6 meses)
      const mesesNomes: Record<string, string> = {
        '01': 'Jan', '02': 'Fev', '03': 'Mar', '04': 'Abr', '05': 'Mai', '06': 'Jun',
        '07': 'Jul', '08': 'Ago', '09': 'Set', '10': 'Out', '11': 'Nov', '12': 'Dez'
      };

      const agora = new Date();
      const mesesChaves: { chave: string; rotulo: string }[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(agora.getFullYear(), agora.getMonth() - i, 1);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const chave = `${y}-${m}`;
        const rotulo = `${mesesNomes[m]}/${y}`;
        mesesChaves.push({ chave, rotulo });
      }

      const historicoMensal = mesesChaves.map(({ chave, rotulo }) => {
        const vRes = db!.exec(`SELECT COUNT(*) FROM visitas_site WHERE data_hora LIKE '${chave}%'`);
        const visitas = Number(vRes[0]?.values[0]?.[0] || 0);

        const oRes = db!.exec(`SELECT COUNT(*) FROM clientes_orcamento WHERE data_solicitacao LIKE '${chave}%'`);
        const orcamentos = Number(oRes[0]?.values[0]?.[0] || 0);

        const cRes = db!.exec(`SELECT COUNT(*) FROM cliques_whatsapp WHERE data_hora LIKE '${chave}%'`);
        const cliquesWhatsapp = Number(cRes[0]?.values[0]?.[0] || 0);

        const totalContatos = orcamentos + cliquesWhatsapp;
        const taxaOrcamento = visitas > 0 ? Number(((orcamentos / visitas) * 100).toFixed(1)) : 0;
        const taxaWhatsapp = visitas > 0 ? Number(((cliquesWhatsapp / visitas) * 100).toFixed(1)) : 0;
        const conversao = visitas > 0 
          ? Math.min(100, Number(((totalContatos / visitas) * 100).toFixed(1)))
          : 0;

        return {
          mes: rotulo,
          chave,
          visitas,
          orcamentos,
          cliquesWhatsapp,
          totalContatos,
          taxaOrcamento,
          taxaWhatsapp,
          conversao
        };
      });

      // 3. Materiais Mais Solicitados (Agrupamento semântico nas solicitações)
      const todosMateriaisRes = db.exec(`SELECT materiais FROM clientes_orcamento`);
      const materiaisRows = todosMateriaisRes[0]?.values || [];
      const totalOrcamentosCount = Math.max(1, materiaisRows.length);

      const categoriasMateriais = [
        { nome: 'Fios & Cabos Normatizados (Flexíveis, Rolo e Metro)', categoria: 'Condutores', regex: /cabo|fio|flexivel|750v|metro|rolo/i, count: 0 },
        { nome: 'Disjuntores DIN & DPS (Proteção de Circuitos)', categoria: 'Proteção Elétrica', regex: /disjuntor|dps|bipolar|tripolar|monopolar|steck/i, count: 0 },
        { nome: 'Infraestrutura (Eletrodutos, Canaletas & Caixas PVC)', categoria: 'Infraestrutura', regex: /eletroduto|canaleta|caixa|4x2|pvc|tigre|perfilado|eletrocalha/i, count: 0 },
        { nome: 'Iluminação Técnica & LED (Refletores & Painéis)', categoria: 'Iluminação', regex: /refletor|led|luminaria|painel|spot|embutir|sobrepor/i, count: 0 },
        { nome: 'Automação & Comandos (Contatores, Relés e Inversores)', categoria: 'Industrial', regex: /contator|rele|inversor|comando|botoeira|motor/i, count: 0 },
        { nome: 'Tomadas & Interruptores (Conjuntos 10A e 20A)', categoria: 'Acabamentos', regex: /tomada|interruptor|modulo|placa|2p\+t/i, count: 0 },
        { nome: 'Quadros de Distribuição & Barramentos', categoria: 'Quadros & Painéis', regex: /quadro|distribuicao|barramento|neutro|terra/i, count: 0 }
      ];

      materiaisRows.forEach((row: any[]) => {
        const text = String(row[0] || '').toLowerCase();
        categoriasMateriais.forEach((cat) => {
          if (cat.regex.test(text)) {
            cat.count += 1;
          }
        });
      });

      const materiaisMaisSolicitados = categoriasMateriais
        .map((cat) => ({
          nome: cat.nome,
          categoria: cat.categoria,
          totalSolicitacoes: cat.count,
          porcentagem: Number(((cat.count / totalOrcamentosCount) * 100).toFixed(1))
        }))
        .sort((a, b) => b.totalSolicitacoes - a.totalSolicitacoes);

      // 4. Principais Cidades dos Orçamentos
      const cidadesRes = db.exec(
        `SELECT cidade, COUNT(*) as qtd FROM clientes_orcamento GROUP BY cidade ORDER BY qtd DESC LIMIT 6`
      );
      const cidadesRows = cidadesRes[0]?.values || [];
      const principaisCidades = cidadesRows.map((row: any[]) => ({
        cidade: String(row[0]),
        total: Number(row[1]),
        porcentagem: Number(((Number(row[1]) / totalOrcamentosCount) * 100).toFixed(1))
      }));

      // 5. Origem dos Cliques no WhatsApp
      const origemCliquesRes = db.exec(
        `SELECT origem_botao, COUNT(*) as qtd FROM cliques_whatsapp GROUP BY origem_botao ORDER BY qtd DESC`
      );
      const origemRows = origemCliquesRes[0]?.values || [];
      const totalCliquesCount = Math.max(1, totalCliques);
      const origemCliquesWhatsapp = origemRows.map((row: any[]) => ({
        origem: String(row[0]),
        total: Number(row[1]),
        porcentagem: Number(((Number(row[1]) / totalCliquesCount) * 100).toFixed(1))
      }));

      // 6. Distribuição de Dispositivos (Mobile vs Desktop)
      const mobRes = db.exec(`SELECT COUNT(*) FROM visitas_site WHERE dispositivo LIKE '%Mobile%'`);
      const mobileVisitas = Number(mobRes[0]?.values[0]?.[0] || 0);
      const desktopVisitas = Math.max(0, totalVisitas - mobileVisitas);
      const percentualMobile = totalVisitas > 0 ? Number(((mobileVisitas / totalVisitas) * 100).toFixed(1)) : 50;

      return res.json({
        resumoGeral: {
          totalAcessos: totalVisitas,
          totalOrcamentos: totalOrcamentos,
          totalCliquesWhatsapp: totalCliques,
          totalAcoesComerciais,
          taxaConversaoGeral,
          taxaOrcamentos,
          taxaCliquesWhatsapp,
          acessosHoje: visitasHoje,
          orcamentosHoje,
          cliquesWhatsappHoje: cliquesHoje
        },
        historicoMensal,
        materiaisMaisSolicitados,
        principaisCidades,
        distribuicaoDispositivos: {
          mobile: mobileVisitas,
          desktop: desktopVisitas,
          percentualMobile
        },
        origemCliquesWhatsapp
      });
    } catch (err: any) {
      console.error('Erro no dashboard executivo:', err);
      return res.status(500).json({ error: 'Erro ao gerar métricas do dashboard' });
    }
  });

  // Rota POST: Registrar novo acesso/visita ao site (chamado silenciosamente no carregamento da página)
  app.post('/api/visitas', limitEvento, (req, res) => {
    try {
      const userAgent = req.headers['user-agent'] || 'Desconhecido';
      const isMobile = /mobile|iphone|ipad|android/i.test(userAgent);
      const dispositivo = isMobile ? 'Mobile / Celular' : 'Desktop / Computador';
      
      let navegador = 'Outro';
      if (/chrome/i.test(userAgent) && !/edg/i.test(userAgent)) navegador = 'Chrome';
      else if (/safari/i.test(userAgent) && !/chrome/i.test(userAgent)) navegador = 'Safari';
      else if (/firefox/i.test(userAgent)) navegador = 'Firefox';
      else if (/edg/i.test(userAgent)) navegador = 'Edge';

      const origem = req.body?.origem || req.headers.referer || 'Acesso Direto';
      const pagina = clip(req.body?.pagina || '/', 200);
      const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

      if (db) {
        db.run(
          `INSERT INTO visitas_site (data_hora, dispositivo, navegador, origem, pagina) VALUES (?, ?, ?, ?, ?)`,
          [now, dispositivo, navegador, String(origem).substring(0, 150), pagina]
        );

        // Gravação agrupada no disco SQLite (no máximo 1 a cada 30 s)
        saveDbSoon();
      }

      return res.status(200).json({ status: 'ok', time: now });
    } catch (err: any) {
      console.error('Erro ao registrar visita:', err);
      return res.status(200).json({ status: 'ignored' });
    }
  });

  // Rota GET: Listar estatísticas e acessos do site (Painel do Lojista)
  app.get('/api/visitas', limitAdmin, requireAdmin, (req, res) => {
    try {
      if (!db) {
        return res.json({ total: 0, hoje: 0, mobile: 0, desktop: 0, visitas: [] });
      }

      // Total geral
      const totalRes = db.exec(`SELECT COUNT(*) as total FROM visitas_site`);
      const total = totalRes[0]?.values[0]?.[0] || 0;

      // Hoje
      const hojeDate = new Date().toISOString().substring(0, 10);
      const hojeRes = db.exec(`SELECT COUNT(*) FROM visitas_site WHERE data_hora LIKE '${hojeDate}%'`);
      const hoje = hojeRes[0]?.values[0]?.[0] || 0;

      // Dispositivos
      const mobRes = db.exec(`SELECT COUNT(*) FROM visitas_site WHERE dispositivo LIKE '%Mobile%'`);
      const mobile = mobRes[0]?.values[0]?.[0] || 0;
      const desktop = Number(total) - Number(mobile);

      // Últimas 50 visitas detalhadas
      const listRes = db.exec(
        `SELECT id, data_hora, dispositivo, navegador, origem, pagina FROM visitas_site ORDER BY id DESC LIMIT 50`
      );

      const visitas: any[] = [];
      if (listRes && listRes.length > 0) {
        const cols = listRes[0].columns;
        const vals = listRes[0].values;
        vals.forEach((row: any[]) => {
          const item: Record<string, any> = {};
          cols.forEach((c: string, i: number) => {
            item[c] = row[i];
          });
          visitas.push(item);
        });
      }

      return res.json({
        total,
        hoje,
        mobile,
        desktop: desktop < 0 ? 0 : desktop,
        visitas
      });
    } catch (err: any) {
      console.error('Erro ao consultar estatísticas de visitas:', err);
      return res.status(500).json({ status: 'error', message: 'Erro interno no servidor.' });
    }
  });

  // Rota GET: Avaliações reais do Google (Places API) com fallback para as cadastradas no banco
  app.get('/api/avaliacoes', async (req, res) => {
    try {
      const googleData = await fetchGooglePlaceReviews();
      if (googleData) {
        return res.json(googleData);
      }

      if (!db) {
        return res.json({ total: 16, ratingAverage: 4.8, reviews: [] });
      }

      // Conta novas avaliações adicionadas além das 16 verificadas oficiais
      const countRes = db.exec(`SELECT COUNT(*) as total FROM avaliacoes_google`);
      const dbCount = Number(countRes[0]?.values[0]?.[0] || 0);
      
      // Total oficial verificado do Google: 16 avaliações
      const total = Math.max(16, dbCount);
      const ratingAverage = 4.8;

      // Todas as avaliações mais recentes primeiro
      const listRes = db.exec(
        `SELECT id, autor, cargo, nota, data_texto, comentario, verificado, data_criacao 
         FROM avaliacoes_google 
         ORDER BY id DESC`
      );

      const reviews: any[] = [];
      if (listRes && listRes.length > 0) {
        const cols = listRes[0].columns;
        const vals = listRes[0].values;
        vals.forEach((row: any[]) => {
          const item: Record<string, any> = {};
          cols.forEach((c: string, i: number) => {
            item[c] = row[i];
          });
          item.verificado = Boolean(item.verificado);
          reviews.push(item);
        });
      }

      return res.json({
        total: Number(total),
        ratingAverage,
        reviews,
        source: 'local',
        googleUrl: GOOGLE_REVIEWS_URL
      });
    } catch (err: any) {
      console.error('Erro ao consultar avaliações do Google:', err);
      return res.status(500).json({ status: 'error', message: 'Erro interno no servidor.' });
    }
  });

  // Rota POST: Adicionar nova avaliação (dinâmica, soma na contagem geral)
  app.post('/api/avaliacoes', limitAdmin, requireAdmin, (req, res) => {
    try {
      const autor = clip(req.body?.autor, 80);
      const cargo = clip(req.body?.cargo, 80);
      const nota = req.body?.nota;
      const comentario = clip(req.body?.comentario, 2000);

      if (!autor || !nota || !comentario) {
        return res.status(400).json({
          status: 'error',
          message: 'Autor, nota e comentário são obrigatórios.'
        });
      }

      const ratingNum = Math.min(5, Math.max(1, parseInt(nota, 10) || 5));
      const roleStr = cargo || 'Cliente Verificado';
      const dateText = 'Recente';

      if (db) {
        db.run(
          `INSERT INTO avaliacoes_google (autor, cargo, nota, data_texto, comentario, verificado) VALUES (?, ?, ?, ?, ?, 1)`,
          [autor, roleStr, ratingNum, dateText, comentario]
        );

        // Persiste imediatamente no arquivo SQLite
        saveDbNow();

        // Recalcula total e média
        const totalRes = db.exec(`SELECT COUNT(*) as total FROM avaliacoes_google`);
        const total = totalRes[0]?.values[0]?.[0] || 0;

        const avgRes = db.exec(`SELECT AVG(nota) as media FROM avaliacoes_google`);
        const rawAvg = avgRes[0]?.values[0]?.[0];
        const ratingAverage = rawAvg ? Number(Number(rawAvg).toFixed(1)) : 4.8;

        return res.status(201).json({
          status: 'success',
          message: 'Avaliação adicionada com sucesso e somada à contagem oficial!',
          total: Number(total),
          ratingAverage
        });
      }

      return res.status(500).json({ status: 'error', message: 'Banco indisponível' });
    } catch (err: any) {
      console.error('Erro ao salvar avaliação:', err);
      return res.status(500).json({ status: 'error', message: 'Erro interno no servidor.' });
    }
  });

  // Rota estática dedicada para og-image.png (WhatsApp, Facebook, Twitter, LinkedIn)
  const ogImagePath = path.join(__dirname, 'public', 'og-image.png');
  app.get('/og-image.png', (req, res) => {
    if (fs.existsSync(ogImagePath)) {
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
      return res.sendFile(ogImagePath);
    }
    return res.status(404).send('Imagem de pré-visualização não encontrada');
  });

  // Sitemap gerado a partir das páginas cadastradas em src/seo/pages.ts
  app.get('/sitemap.xml', (_req, res) => {
    res.type('application/xml').setHeader('Cache-Control', 'public, max-age=3600');
    res.send(sitemapXml());
  });

  // llms.txt: resumo do site para assistentes de IA (/llm.txt também funciona)
  const llmsPath = path.join(__dirname, 'public', 'llms.txt');
  app.get('/llm.txt', (_req, res) => res.type('text/plain; charset=utf-8').setHeader('Cache-Control', 'public, max-age=86400').sendFile(llmsPath));

  // Página do painel: só no endereço secreto. Marca a página para o app abrir o painel em vez da loja.
  const panelHtml = (html: string) =>
    renderHead(html, ADMIN_PAGE).replace('</head>', '  <meta name="phx-view" content="panel" />\n  </head>');
  const sendPanel = (res: express.Response, html: string) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
    res.setHeader('X-Frame-Options', 'DENY');
    res.send(panelHtml(html));
  };
  if (!ADMIN_PATH) console.warn('⚠ [ADMIN] ADMIN_PATH não definido: painel desativado.');

  // Serve arquivos da pasta /public (ícones, robots.txt): cache de 1 dia
  app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1d' }));

  // Modo de Desenvolvimento com Vite Middleware
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    if (ADMIN_PATH) {
      app.get(ADMIN_PATH, async (req, res, next) => {
        try {
          const raw = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf-8');
          sendPanel(res, await vite.transformIndexHtml(req.originalUrl, raw));
        } catch (err) {
          next(err);
        }
      });
    }
    app.use(vite.middlewares);
  } else {
    // Modo de Produção
    const distPath = path.join(__dirname, 'dist');
    const indexHtml = fs.readFileSync(path.join(distPath, 'index.html'), 'utf-8');
    // index: false para que "/" também passe pela montagem do <head> abaixo
    // Arquivos de /assets têm hash no nome: cache de 1 ano sem revalidar
    app.use('/assets', express.static(path.join(distPath, 'assets'), { maxAge: '1y', immutable: true }));
    app.use(express.static(distPath, { index: false, maxAge: '1d' }));

    if (ADMIN_PATH) app.get(ADMIN_PATH, (_req, res) => sendPanel(res, indexHtml));

    app.all('/api/*', (_req, res) => {
      res.status(404).json({ status: 'error', message: 'Rota não encontrada' });
    });

    app.get('*', (req, res) => {
      // Endereço com barra no final: redireciona para a versão sem barra
      if (req.path.length > 1 && req.path.endsWith('/')) {
        const query = req.originalUrl.slice(req.path.length);
        return res.redirect(301, req.path.replace(/\/+$/, '') + query);
      }
      // Arquivo inexistente (ex.: /imagem.png): 404 simples
      if (path.extname(req.path)) {
        return res.status(404).send('Arquivo não encontrado');
      }
      const page = findPage(req.path);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.status(page ? 200 : 404).send(renderHead(indexHtml, page || NOT_FOUND));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n======================================================`);
    console.log(`⚡ Phoenix Elétrica Full-Stack iniciado na porta ${PORT}`);
    console.log(`🌐 Acesso Web: http://localhost:${PORT}`);
    console.log(`📁 Banco SQLite: ${DB_PATH}`);
    console.log(`======================================================\n`);
  });
}

startServer();
