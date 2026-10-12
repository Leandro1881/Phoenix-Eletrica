import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import initSqlJs, { Database } from 'sql.js';
import crypto from 'crypto';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { Storage } from '@google-cloud/storage';

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
const CHAT_MAX_OUTPUT_TOKENS = 1024;
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
// Upload de anexos (Google Cloud Storage quando GCS_BUCKET está definido)
// =========================================================================
const UPLOAD_MAX_BYTES = 15 * 1024 * 1024;
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

let storageClient: Storage | null = null;
function getStorage(): Storage {
  // Credenciais: GOOGLE_APPLICATION_CREDENTIALS (arquivo JSON) em dev; conta de serviço automática no Cloud Run
  if (!storageClient) storageClient = new Storage();
  return storageClient;
}

// =========================================================================
// Autenticação do painel administrativo (validada no servidor)
// =========================================================================
const ADMIN_SESSION_TTL_MS = 8 * 60 * 60 * 1000;
// Com ADMIN_SESSION_SECRET definido, o login vale entre reinícios/instâncias; sem ele, cada reinício pede login de novo
const ADMIN_SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_FAILURES = 5;
const loginFailuresByIp = new Map<string, number[]>();

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return ['scrypt', salt, hash].join('$');
}

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

function signAdminToken(usuario: string): string {
  const payload = Buffer.from(JSON.stringify({ u: usuario, exp: Date.now() + ADMIN_SESSION_TTL_MS })).toString('base64url');
  const sig = crypto.createHmac('sha256', ADMIN_SESSION_SECRET).update(payload).digest('base64url');
  return payload + '.' + sig;
}

function verifyAdminToken(token: string): { u: string } | null {
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const expected = crypto.createHmac('sha256', ADMIN_SESSION_SECRET).update(payload).digest('base64url');
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return data.exp > Date.now() ? { u: data.u } : null;
  } catch {
    return null;
  }
}

function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const session = token ? verifyAdminToken(token) : null;
  if (!session) {
    return res.status(401).json({ success: false, message: 'Sessão expirada. Faça login novamente.' });
  }
  (req as any).adminUser = session.u;
  next();
}

function tooManyLoginFailures(ip: string): boolean {
  const now = Date.now();
  const recent = (loginFailuresByIp.get(ip) || []).filter((t) => now - t < LOGIN_WINDOW_MS);
  loginFailuresByIp.set(ip, recent);
  return recent.length >= LOGIN_MAX_FAILURES;
}

function registerLoginFailure(ip: string) {
  const list = loginFailuresByIp.get(ip) || [];
  list.push(Date.now());
  loginFailuresByIp.set(ip, list);
}

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

// Normaliza especificações técnicas e corrige typos de teclado mobile (ex: 15.mm2 -> 1,5mm²)
function normalizeSpec(text: string): string {
  let s = text.trim();
  s = s.replace(/\b15\.?mm[²2]?\b/gi, '1,5mm²');
  s = s.replace(/\b1[.,]5\s*mm[²2]?\b/gi, '1,5mm²');
  s = s.replace(/\b25\.?mm[²2]?\b/gi, '2,5mm²');
  s = s.replace(/\b2[.,]5\s*mm[²2]?\b/gi, '2,5mm²');
  s = s.replace(/\b4\.?0?\s*mm[²2]?\b/gi, '4mm²');
  s = s.replace(/\b6\.?0?\s*mm[²2]?\b/gi, '6mm²');
  s = s.replace(/\b10\.?0?\s*mm[²2]?\b/gi, '10mm²');
  s = s.replace(/\b16\.?0?\s*mm[²2]?\b/gi, '16mm²');
  s = s.replace(/²+/g, '²');
  s = s.replace(/\bcore\s+/gi, 'cor ');
  return s;
}

function formatCableItem(c: { quantity?: string; gauge?: string; color?: string; name?: string }): string {
  const parts: string[] = [];
  if (c.quantity) {
    parts.push(c.quantity);
    parts.push('de');
  }
  parts.push(c.name || 'cabo flexível');
  if (c.gauge) parts.push(c.gauge);
  if (c.color) parts.push(`- ${c.color}`);
  const raw = parts.join(' ').replace(/\s+/g, ' ').trim();
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function consolidateMaterials(rawCandidates: string[]): string[] {
  if (rawCandidates.length === 0) return [];
  if (rawCandidates.length === 1) {
    const single = normalizeSpec(rawCandidates[0]);
    if (/^\d+\s*rolos?$/i.test(single)) {
      return [`${single} de cabo flexível`];
    }
    return [single];
  }

  const result: string[] = [];
  let pendingCable: { quantity?: string; gauge?: string; color?: string; name?: string } | null = null;

  for (const item of rawCandidates) {
    const norm = normalizeSpec(item);
    const lower = norm.toLowerCase();

    const isDistinctNonCable = 
      lower.includes('iluminação') || lower.includes('led') || lower.includes('lâmpada') || 
      lower.includes('refletor') || lower.includes('fita') || lower.includes('eletroduto') || 
      lower.includes('tomada') || lower.includes('interruptor') || lower.includes('caixa 4x2') || 
      lower.includes('canaleta') || lower.includes('disjuntor') || lower.includes('wago');

    if (isDistinctNonCable) {
      if (pendingCable) {
        result.push(formatCableItem(pendingCable));
        pendingCable = null;
      }
      result.push(norm);
      continue;
    }

    const isCableRelated = 
      lower.includes('cabo') || lower.includes('fio') || lower.includes('rolo') || 
      /\b\d+([.,]\d+)?\s*mm[²2]?\b/i.test(lower) || 
      lower.includes('cor azul') || lower.includes('cor preta') || lower.includes('cor vermelho') ||
      lower.includes('azul') || lower.includes('preto') || lower.includes('vermelho') || 
      lower.includes('verde') || lower.includes('amarelo') || lower.includes('branco');

    if (isCableRelated) {
      if (!pendingCable) {
        pendingCable = {};
      }

      const qtyMatch = norm.match(/\b(\d+\s*(rolos?|metros?|m))\b/i);
      if (qtyMatch) {
        pendingCable.quantity = qtyMatch[1];
      }

      const gaugeMatch = norm.match(/(\d+([.,]\d+)?\s*mm[²2]?)/i);
      if (gaugeMatch) {
        pendingCable.gauge = gaugeMatch[1];
      }

      const colorMatch = norm.match(/\b(cor\s+)?(azul|preto|vermelho|verde|amarelo|branco|cinza)\b/i);
      if (colorMatch) {
        pendingCable.color = colorMatch[0].toLowerCase().startsWith('cor ') ? colorMatch[0] : `cor ${colorMatch[0]}`;
      }

      if (lower.includes('flexível') || lower.includes('flexivel')) {
        pendingCable.name = 'cabo flexível';
      }

      continue;
    }

    result.push(norm);
  }

  if (pendingCable) {
    result.push(formatCableItem(pendingCable));
  }

  return result.filter(Boolean);
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

    // Cria o login do painel a partir de ADMIN_USER / ADMIN_PASSWORD (nunca senha fixa no código)
    const adminCheck = db.exec(`SELECT COUNT(*) as total FROM admin_auth`);
    const totalAdmin = adminCheck[0]?.values[0]?.[0] || 0;
    if (totalAdmin === 0) {
      const adminUser = process.env.ADMIN_USER || 'admin';
      const adminPassword = process.env.ADMIN_PASSWORD;
      if (adminPassword && adminPassword.length >= 10) {
        db.run(`INSERT INTO admin_auth (usuario, senha) VALUES (?, ?)`, [adminUser, hashPassword(adminPassword)]);
      } else {
        console.warn('⚠ [ADMIN] Defina ADMIN_PASSWORD (mín. 10 caracteres) para habilitar o login do painel.');
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
  await setupDatabase();

  const app = express();
  // Atrás de 1 proxy (Cloud Run / load balancer): req.ip passa a ser o IP real do visitante
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

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
    res.json({
      status: 'ok',
      service: 'Phoenix Elétrica API',
      database: db ? 'connected' : 'initializing',
      time: new Date().toISOString()
    });
  });

  // Rota POST: Upload de Arquivo de Orçamento (PDF, Word, etc.)
  app.post('/api/upload', async (req, res) => {
    try {
      const { fileName, fileBase64, fileSize } = req.body;

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

      console.log(`✓ [UPLOAD CONCLUÍDO] ${safeFileName} (${fileSize || 'N/A'}) - URL: ${fileUrl}`);

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
        message: 'Falha ao processar o upload do arquivo',
        detail: err.message
      });
    }
  });

  // Rota POST: Assistente IA de Orçamento da Phoenix Elétrica (com Guardrails Estritos)
  app.post('/api/chat-assistant', async (req, res) => {
    try {
      const { messages: rawMessages } = req.body;
      if (!Array.isArray(rawMessages) || rawMessages.length === 0) {
        return res.status(400).json({
          status: 'error',
          message: 'Histórico de mensagens é obrigatório.'
        });
      }

      const limitMessage = checkChatRateLimit(req.ip || 'desconhecido');
      if (limitMessage) {
        return res.status(429).json({ status: 'error', message: limitMessage });
      }

      // Limita tamanho do histórico e de cada mensagem para controlar o custo por chamada
      const messages = rawMessages.slice(-CHAT_MAX_HISTORY).map((m: any) => ({
        ...m,
        text: String(m?.text || m?.content || '').slice(0, CHAT_MAX_CHARS_PER_MESSAGE)
      }));

      const PHOENIX_SYSTEM_PROMPT = `És um assistente técnico de vendas da Phoenix Elétrica, em São Paulo. A tua ÚNICA função é ajudar o cliente a montar uma lista de materiais elétricos clara para orçamento. REGRAS ESTRITAS: 1. NUNCA forneça preços, descontos ou prazos. Responda que o balcão calculará isso. 2. Se o assunto não for material elétrico/obras, responda EXATAMENTE: 'Sou especialista apenas em materiais elétricos. Como posso ajudar com a sua lista?'. 3. Sugira itens complementares lógicos (ex: fita isolante para cabos), mas se o cliente dispensar ou disser que não precisa, NÃO inclua na lista. 4. Mantenha as respostas curtas e objetivas. 5. Quando o cliente finalizar a lista, retorne a lista estruturada contendo ESTRITAMENTE os materiais confirmados ou pedidos pelo cliente na conversa (sem adicionar itens que o cliente não pediu ou dispensou), com marcadores (•), e confirme que está pronta para envio ao balcão.`;

      // 1. Prioridade para Gemini API (chave apenas no servidor, nunca com prefixo VITE_)
      const geminiApiKey = process.env.GEMINI_API_KEY;
      if (geminiApiKey) {
        try {
          const ai = new GoogleGenAI({ apiKey: geminiApiKey });
          
          // Gemini exige que a primeira mensagem em contents seja do usuário (role: user)
          const firstUserIdx = messages.findIndex((m: any) => (m.role === 'user' || m.sender === 'user'));
          const validMessages = firstUserIdx >= 0 ? messages.slice(firstUserIdx) : messages;

          const contents = validMessages.map((m: any) => ({
            role: (m.role === 'assistant' || m.sender === 'assistant') ? 'model' : 'user',
            parts: [{ text: String(m.text || m.content || '') }]
          }));

          // Tenta os modelos em ordem: se um estiver sobrecarregado (503) ou lento, passa ao próximo
          for (const model of GEMINI_MODELS) {
            try {
              const geminiResponse = await ai.models.generateContent({
                model,
                contents,
                config: {
                  systemInstruction: PHOENIX_SYSTEM_PROMPT,
                  temperature: 0.2,
                  maxOutputTokens: CHAT_MAX_OUTPUT_TOKENS,
                  thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
                  httpOptions: { timeout: GEMINI_TIMEOUT_MS }
                }
              });

              if (geminiResponse.text) {
                return res.status(200).json({
                  status: 'success',
                  provider: 'gemini',
                  model,
                  text: geminiResponse.text.trim()
                });
              }
            } catch (modelError: any) {
              console.warn(`[Gemini] ${model} falhou (${modelError?.status || 'timeout'}):`, String(modelError?.message || modelError).slice(0, 160));
              // Chave inválida ou sem permissão: outros modelos também falhariam
              if ([400, 401, 403].includes(modelError?.status)) break;
            }
          }
        } catch (geminiError: any) {
          console.warn('Erro ao processar chamada Gemini no servidor:', geminiError?.message || geminiError);
        }
      }

      // 2. Se houver OPENAI_API_KEY configurado (apenas no servidor)
      const openAiApiKey = process.env.OPENAI_API_KEY;
      if (openAiApiKey) {
        try {
          const openAiMessages = [
            { role: 'system', content: PHOENIX_SYSTEM_PROMPT },
            ...messages.map((m: any) => ({
              role: (m.role === 'assistant' || m.sender === 'assistant') ? 'assistant' : 'user',
              content: String(m.text || m.content || '')
            }))
          ];

          const openAiRes = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${openAiApiKey}`
            },
            body: JSON.stringify({
              model: 'gpt-4o-mini',
              messages: openAiMessages,
              temperature: 0.2,
              max_tokens: CHAT_MAX_OUTPUT_TOKENS,
            })
          });

          if (openAiRes.ok) {
            const data: any = await openAiRes.json();
            const text = data.choices?.[0]?.message?.content;
            if (text) {
              return res.status(200).json({
                status: 'success',
                provider: 'openai',
                text: text.trim()
              });
            }
          }
        } catch (openAiError: any) {
          console.warn('Erro ao processar chamada OpenAI no servidor:', openAiError?.message || openAiError);
        }
      }

      // 3. Fallback inteligente com Guardrails estritos e tratamento contextual de intenções
      const lastMsg = String(messages[messages.length - 1]?.text || messages[messages.length - 1]?.content || '').toLowerCase().trim();
      
      // Intent 1: Saudações educadas
      const isGreeting = 
        /^(oi|ola|olá|opa|bom dia|boa tarde|boa noite|como vai|tudo bem|e ai|e aí|salve|fala|oie)(\s+(como vai|tudo bem|amigo|phoenix|boa tarde|bom dia|boa noite))?[!?.]*$/i.test(lastMsg) ||
        lastMsg === 'oi como vai' || 
        lastMsg === 'ola tudo bem' || 
        lastMsg === 'olá tudo bem' || 
        lastMsg === 'tudo bem?' || 
        lastMsg === 'tudo bem' ||
        lastMsg === 'oi, tudo bem?' ||
        lastMsg === 'oi como voce esta';

      if (isGreeting) {
        return res.status(200).json({
          status: 'success',
          provider: 'guardrail-fallback',
          text: 'Olá! Tudo bem? Sou o assistente técnico de vendas da Phoenix Elétrica, em São Paulo. Me diga que tipo de obra ou reforma você vai fazer (ou quais materiais elétricos você já sabe que precisa) e eu te ajudo a estruturar uma lista completa para orçamento!'
        });
      }

      // Intent 2: Agradecimentos
      const isThanks = /^(obrigado|obrigada|valeu|muito obrigado|agradeço|show|beleza|blz|perfeito|otimo|ótimo)[!?.]*$/i.test(lastMsg);
      if (isThanks) {
        return res.status(200).json({
          status: 'success',
          provider: 'guardrail-fallback',
          text: 'À disposição! Se precisar adicionar mais algum material elétrico ou conferir a relação antes de falar com nosso balcão, estou por aqui.'
        });
      }

      // Intent 3: Guardrail 1 - Preço e Prazo
      if (
        lastMsg.includes('preço') || 
        lastMsg.includes('quanto custa') || 
        lastMsg.includes('valor') || 
        lastMsg.includes('desconto') || 
        lastMsg.includes('prazo') ||
        lastMsg.includes('entrega em quanto tempo') ||
        lastMsg.includes('quanto fica')
      ) {
        return res.status(200).json({
          status: 'success',
          provider: 'guardrail-fallback',
          text: 'Nossos preços, descontos e prazos de entrega são calculados diretamente pelo balcão técnico da Phoenix Elétrica. Vamos finalizar os materiais necessários da sua lista primeiro?'
        });
      }

      // Intent 4: Guardrail 5 - Finalização da Lista
      if (
        lastMsg.includes('finalizar') || 
        lastMsg.includes('só isso') || 
        lastMsg.includes('é isso') || 
        lastMsg.includes('concluir') || 
        lastMsg.includes('está pronta') ||
        lastMsg.includes('pode fechar') ||
        lastMsg === 'pronto' ||
        lastMsg === 'pode gerar'
      ) {
        // Extrai apenas os itens de materiais elétricos solicitados pelo cliente na conversa
        const ignorePatterns = [
          /^(oi|ola|olá|bom dia|boa tarde|boa noite|como vai|tudo bem|opa|salve)[!?.]*$/i,
          /^(finalizar|concluir|fechar|pode fechar|pode finalizar|está pronta|esta pronta|pronto|pronta|gerar lista)[!?.]*$/i,
          /^(nao|não|apenas|só|so|isso|apenas isso|so isso|só isso|somente isso|não precisa|nao precisa|dispensa|nenhum|nada|nada mais)[!?., ]*$/i,
          /^(nao|não)[, ]+(apenas|só|so|isso|apenas isso|so isso|só isso|somente isso|nada mais)[!?., ]*$/i,
          /^(sim|pode ser|ok|beleza|blz|perfeito|otimo|ótimo|obrigado|obrigada|valeu)[!?.]*$/i,
          /^(quanto custa|qual o preço|qual o preco|quanto fica)[!?.]*$/i
        ];

        const nonMaterialWords = ['isso', 'apenas', 'so', 'só', 'nada', 'nenhum', 'tudo', 'ok', 'sim', 'nao', 'não', 'pronto', 'obrigado', 'valeu'];

        const userMsgs = messages.filter((m: any) => m.role === 'user' || m.sender === 'user');
        const candidateItems: string[] = [];

        for (const m of userMsgs) {
          const raw = String(m.text || m.content || '').trim();
          if (!raw) continue;

          // Remove emojis gráficos reais no início (ex: 💡, 🔌, ⚡, 🏗️) sem remover números (como 3 rolos)
          let cleaned = raw.replace(/^[\p{Extended_Pictographic}\s]+/u, '').trim();
          const lowerCleaned = cleaned.toLowerCase();

          if (
            lowerCleaned.includes('finalizar') ||
            lowerCleaned.includes('fechar') ||
            lowerCleaned.includes('concluir') ||
            lowerCleaned.includes('só isso') ||
            lowerCleaned.includes('é isso') ||
            lowerCleaned.includes('está pronta') ||
            lowerCleaned.includes('esta pronta') ||
            ignorePatterns.some(pat => pat.test(lowerCleaned))
          ) {
            continue;
          }

          cleaned = cleaned
            .replace(/^(nao,\s*apenas|não,\s*apenas|nao\s+apenas|não\s+apenas|apenas|só|so)\s+/i, '')
            .replace(/^(preciso de|preciso|quero|vou precisar de|vou usar|coloque|adicione|adiciona|me vê|me ve|gostaria de|inclua|incluir)\s+/i, '')
            .trim();

          if (ignorePatterns.some(pat => pat.test(cleaned.toLowerCase()))) continue;

          if (nonMaterialWords.includes(cleaned.toLowerCase())) continue;

          if (cleaned.length > 2) {
            const formatted = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
            if (!candidateItems.some(it => it.toLowerCase() === formatted.toLowerCase())) {
              candidateItems.push(formatted);
            }
          }
        }

        if (candidateItems.length === 0) {
          const allUserText = userMsgs.map((m: any) => String(m.text || m.content || '')).join(' ').toLowerCase();
          if (allUserText.includes('fita')) candidateItems.push('Fita isolante');
          if (allUserText.includes('led') || allUserText.includes('iluminação') || allUserText.includes('lâmpada')) candidateItems.push('Iluminação LED');
          if (allUserText.includes('cabo') || allUserText.includes('fio')) candidateItems.push('Cabos elétricos conforme especificação');
          if (allUserText.includes('disjuntor')) candidateItems.push('Disjuntores termomagnéticos');
          if (allUserText.includes('tomada') || allUserText.includes('interruptor')) candidateItems.push('Conjuntos de tomadas / interruptores');
        }

        if (candidateItems.length === 0) {
          candidateItems.push('Materiais elétricos solicitados na conversa');
        }

        const consolidated = consolidateMaterials(candidateItems);
        const finalItems = consolidated.length > 0 ? consolidated : ['Materiais elétricos solicitados na conversa'];
        const bullets = finalItems.map(item => `• ${item}`).join('\n');

        return res.status(200).json({
          status: 'success',
          provider: 'guardrail-fallback',
          text: `Perfeito! Aqui está a sua lista final estruturada para o orçamento:\n\n${bullets}\n\nA lista está pronta para envio! Basta clicar em "Usar esta Lista no Orçamento" para enviar direto ao WhatsApp da Phoenix Elétrica.`
        });
      }

      // Termos elétricos e de infraestrutura
      const electricalTerms = [
        'cabo', 'fio', 'disjuntor', 'tomada', 'interruptor', 'led', 'lâmpada', 'lampada', 'refletor',
        'eletroduto', 'corrugado', 'fita', 'isolante', 'quadro', 'distribuição', 'distribuicao', 'trifásico',
        'bifásico', 'monofásico', 'dr', 'dps', 'barramento', 'canaleta', 'perfilado',
        'eletrocalha', 'reator', 'contator', 'relé', 'rele', 'conector', 'wago', 'obra', 'instalação',
        'instalacao', 'reforma', 'energia', 'volts', 'amperes', '110v', '220v', 'dimmer', 'sensor', 'fotocélula',
        'fotocelula', 'plafon', 'spot', 'soquete', 'chuveiro', 'lista', 'orçamento', 'orcamento', 'materiais', 'fiação',
        'fiacao', 'conduíte', 'conduite', 'caixinha', '4x2', '4x4', 'curva', 'luva'
      ];

      // Unidades de medidas e quantidades usadas em materiais elétricos
      const measurementAndQuantityTerms = [
        'rolo', 'rolos', 'metro', 'metros', 'm', 'mm', 'mm²', 'peça', 'peças', 'peca', 'pecas',
        'unidade', 'unidades', 'un', 'barra', 'barras', 'caixa', 'caixas', 'pacote', 'pacotes',
        'cento', 'kit', 'kits', 'bobina', 'bobinas', 'par', 'pares', 'circuito', 'circuitos'
      ];

      // Respostas conversacionais a perguntas anteriores (sim, não, apenas, etc.)
      const conversationalAnswerPatterns = [
        'sim', 'nao', 'não', 'apenas', 'so', 'só', 'somente', 'pode ser', 'não precisa', 'nao precisa',
        'dispensa', 'quero', 'vou querer', 'prefiro', 'coloque', 'adicione', 'inclua', 'pode colocar',
        'pode incluir', 'só isso', 'apenas isso', 'já tenho', 'ja tenho', 'de 100', 'de 50', 'de 25'
      ];

      // Atributos e especificações técnicas de materiais elétricos
      const electricalAttributes = [
        'azul', 'vermelho', 'preto', 'verde', 'amarelo', 'branco', 'cinza',
        'monopolar', 'bipolar', 'tripolar', 'tetrapolar', 'din', 'nema',
        '10a', '16a', '20a', '25a', '32a', '40a', '50a', '63a', '70a', '80a', '100a',
        '110v', '127v', '220v', '380v', 'bivolt', 'monofasico', 'bifasico', 'trifasico',
        'monofásico', 'bifásico', 'trifásico', '1,5', '2,5', '1.5', '2.5', '4', '6', '10', '16', '25', '35', '50', '70', '95', '120'
      ];

      const isElectrical = electricalTerms.some(term => lastMsg.includes(term));
      const hasQuantityOrUnit = measurementAndQuantityTerms.some(term => new RegExp(`\\b${term}\\b`, 'i').test(lastMsg));
      const hasConversationalAnswer = conversationalAnswerPatterns.some(term => lastMsg.includes(term));
      const hasElectricalAttribute = electricalAttributes.some(term => new RegExp(`\\b${term}\\b`, 'i').test(lastMsg));
      const hasNumbers = /\d+/.test(lastMsg);

      // Contexto prévio de materiais elétricos na conversa
      const previousHistoryText = messages
        .slice(0, -1)
        .map((m: any) => String(m.text || m.content || ''))
        .join(' ')
        .toLowerCase();
      const hadElectricalContext = electricalTerms.some(term => previousHistoryText.includes(term));

      const isContextualElectricalReply = 
        hadElectricalContext && 
        (hasQuantityOrUnit || hasConversationalAnswer || hasElectricalAttribute || hasNumbers);

      // Intent 5: Guardrail 2 - Assunto não relacionado a materiais elétricos
      if (!isElectrical && !isContextualElectricalReply) {
        return res.status(200).json({
          status: 'success',
          provider: 'guardrail-fallback',
          text: 'Sou especialista apenas em materiais elétricos. Como posso ajudar com a sua lista?'
        });
      }

      // Intent 6: Tratamento de respostas contextuais de quantidades e especificações (ex: "nao apenas 3 rolos, de 100 m")
      if (isContextualElectricalReply && !isElectrical) {
        if (lastMsg.includes('rolo') || lastMsg.includes('metro') || lastMsg.includes('100') || lastMsg.includes('50') || lastMsg.includes('cabo')) {
          const rawText = String(messages[messages.length - 1]?.text || messages[messages.length - 1]?.content || '').trim();
          const cleanQty = rawText
            .replace(/^(preciso de|quero|me vê|vou usar|adicione|adicionar)\s+/i, '')
            .replace(/^(nao,\s*apenas|não,\s*apenas|apenas|só|so)\s+/i, '')
            .trim();
          const hasNegation = lastMsg.includes('nao') || lastMsg.includes('não') || lastMsg.includes('apenas') || lastMsg.includes('dispensa');
          const negationNote = hasNegation ? ' (sem os itens complementares)' : '';

          return res.status(200).json({
            status: 'success',
            provider: 'guardrail-fallback',
            text: `Entendido! Anotei a quantidade: ${cleanQty} de cabo flexível${negationNote}. Quais bitolas ou cores você vai precisar para esses cabos (ex: 1,5mm² ou 2,5mm² nas cores azul, preto ou vermelho)? Se já estiver tudo definido, posso fechar a lista para o orçamento!`
          });
        }

        if (hasElectricalAttribute) {
          const rawText = String(messages[messages.length - 1]?.text || messages[messages.length - 1]?.content || '').trim();
          const normSpec = normalizeSpec(rawText);
          const allPrevText = messages.slice(0, -1).map((m: any) => String(m.text || m.content || '')).join(' ').toLowerCase();
          const prevQtyMatch = allPrevText.match(/\b(\d+\s*rolos?)\b/i);
          const qtyPrefix = prevQtyMatch ? `${prevQtyMatch[1]} de cabo flexível ` : '';

          return res.status(200).json({
            status: 'success',
            provider: 'guardrail-fallback',
            text: `Perfeito! Atualizei sua lista com: ${qtyPrefix}${normSpec}. Deseja adicionar mais algum material elétrico à sua relação ou podemos finalizar e gerar a lista para o balcão?`
          });
        }

        if (lastMsg.includes('nao') || lastMsg.includes('não') || lastMsg.includes('apenas') || lastMsg.includes('dispensa')) {
          return res.status(200).json({
            status: 'success',
            provider: 'guardrail-fallback',
            text: `Entendido, mantemos apenas os itens que você solicitou, sem os adicionais. Mais algum material elétrico que deseja incluir ou podemos finalizar a lista para o orçamento?`
          });
        }

        if (lastMsg.includes('sim') || lastMsg.includes('pode') || lastMsg.includes('quero') || lastMsg.includes('adicione')) {
          return res.status(200).json({
            status: 'success',
            provider: 'guardrail-fallback',
            text: `Excelente! Incluí os itens complementares de instalação na sua relação. Quantas peças ou metros estima para cada um? Se preferir, já podemos estruturar a lista para o balcão!`
          });
        }

        return res.status(200).json({
          status: 'success',
          provider: 'guardrail-fallback',
          text: `Anotado: ${String(messages[messages.length - 1]?.text || messages[messages.length - 1]?.content || '').trim()}. Deseja incluir mais algum item ou podemos fechar a sua lista de materiais elétricos para o balcão da Phoenix Elétrica?`
        });
      }

      // Intent 6.5: Reforma Elétrica Residencial ou Predial
      if (
        lastMsg.includes('reforma') || 
        lastMsg.includes('reformar') || 
        lastMsg.includes('fiação') || 
        lastMsg.includes('fiacao') || 
        lastMsg.includes('afiação') || 
        lastMsg.includes('afiacao') || 
        lastMsg.includes('casa') || 
        lastMsg.includes('apartamento') || 
        lastMsg.includes('residencial')
      ) {
        return res.status(200).json({
          status: 'success',
          provider: 'guardrail-fallback',
          text: `Excelente! Para a reforma ou troca de fiação de uma casa com total segurança e conforme as normas da NBR 5410, estruturei esta relação básica de materiais essenciais:\n\n` +
            `• Cabos flexíveis 750V 1,5mm² (iluminação - cores azul, vermelho/preto e verde)\n` +
            `• Cabos flexíveis 750V 2,5mm² (tomadas de uso geral TUGs - azul, vermelho e verde)\n` +
            `• Cabos flexíveis 750V 4mm² ou 6mm² (circuito independente de chuveiro elétrico e ar-condicionado)\n` +
            `• Quadro de distribuição de embutir (com barramento de cobre tipo pente)\n` +
            `• Disjuntor geral bipolar/tripolar e mini disjuntores DIN Curva C (10A, 16A, 20A e 32A)\n` +
            `• Dispositivo DR (IDR 30mA) para proteção obrigatória contra choques elétricos\n` +
            `• Protetor de Surtos DPS Classe II para proteger eletrodomésticos contra descargas atmosféricas\n` +
            `• Eletrodutos corrugados reforçados 25mm e 32mm para passagem dos condutores\n` +
            `• Caixas de embutir 4x2 e 4x4 e conjuntos de tomadas 10A e 20A com placas\n` +
            `• Fita isolante 3M antichama, passa-fio e conectores de emenda rápida\n\n` +
            `Quantos cômodos tem a sua casa ou qual a metragem aproximada para estimarmos as quantidades de rolos? Se preferir, você já pode clicar em "Usar Esta Lista no Orçamento" para cotar estes itens no balcão!`
        });
      }

      // Intent 7: Sugestões específicas conforme o material mencionado (Guardrail 3 e 4)
      if (lastMsg.includes('cabo') || lastMsg.includes('fio')) {
        if (hasNumbers || hasQuantityOrUnit) {
          return res.status(200).json({
            status: 'success',
            provider: 'guardrail-fallback',
            text: `Perfeito! Anotei: ${String(messages[messages.length - 1]?.text || messages[messages.length - 1]?.content || '').trim()}. Para a instalação desses cabos, você também vai precisar de fita isolante 3M, passa-fio, conectores de emenda (tipo Wago) e eletrodutos corrugados? Quais cores ou bitolas deseja especificar?`
          });
        }
        return res.status(200).json({
          status: 'success',
          provider: 'guardrail-fallback',
          text: 'Entendido. Para a passagem dos cabos, você também vai precisar de fita isolante 3M, passa-fio, conectores de emenda (tipo Wago) e eletrodutos corrugados? Quantos metros ou rolos estima para cada circuito?'
        });
      }

      if (lastMsg.includes('disjuntor') || lastMsg.includes('quadro')) {
        return res.status(200).json({
          status: 'success',
          provider: 'guardrail-fallback',
          text: 'Certo. Para o quadro de distribuição, recomendo incluir: Disjuntor Geral, Disjuntores parciais para circuitos, Dispositivo DR (diferencial residual contra choques), DPS contra surtos e barramento de cobre tipo pente. Deseja adicionar barramento e DR?'
        });
      }

      if (lastMsg.includes('iluminação') || lastMsg.includes('led') || lastMsg.includes('refletor') || lastMsg.includes('spot')) {
        return res.status(200).json({
          status: 'success',
          provider: 'guardrail-fallback',
          text: 'Ótimo. Para os pontos de iluminação, além das luminárias/refletores LED, vai precisar de sensores de presença, relés fotocélula, fita isolante e soquetes ou conectores rápidos? Deseja branco frio (6500K) ou branco quente (3000K)?'
        });
      }

      if (lastMsg.includes('tomada') || lastMsg.includes('interruptor')) {
        return res.status(200).json({
          status: 'success',
          provider: 'guardrail-fallback',
          text: 'Perfeito. Para as tomadas e interruptores, vai precisar de conjuntos modulares 10A e 20A (para micro-ondas e chuveiro), além das caixas de embutir 4x2 e 4x4 amarelas reforçadas. Quantas unidades de cada?'
        });
      }

      return res.status(200).json({
        status: 'success',
        provider: 'guardrail-fallback',
        text: 'Excelente. Anotei sua solicitação. Para complementar a sua instalação com segurança, recomendo adicionarmos fita isolante 3M e conectores adequados. Mais algum item de infraestrutura ou cabeamento que deseja incluir na lista antes de enviarmos ao balcão?'
      });

    } catch (err: any) {
      console.error('Erro na rota /api/chat-assistant:', err);
      return res.status(500).json({
        status: 'error',
        message: 'Erro interno ao processar conversa com o assistente.',
        detail: err.message
      });
    }
  });

  // Rota POST: Integração e Proxy com AWS Lambda para captação de leads (Resolve problemas de CORS no navegador)
  app.post('/api/lambda-lead', async (req, res) => {
    try {
      const { nome, email, token } = req.body;
      const cleanNome = String(nome || '').trim();
      const cleanEmail = String(email || '').trim();
      const cleanToken = String(token || '').trim();

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
        console.warn(`[AWS Lambda Proxy] Resposta com status ${lambdaResponse.status}:`, lambdaText);
        return res.status(lambdaResponse.status).json({
          status: 'error',
          message: 'Erro retornado pela AWS Lambda',
          detail: lambdaData
        });
      }

      console.log(`✓ [AWS Lambda Proxy] Lead enviado com sucesso para ${cleanEmail}:`, lambdaData);
      return res.status(200).json({
        status: 'success',
        message: 'Lead enviado com sucesso para AWS Lambda',
        data: lambdaData
      });
    } catch (err: any) {
      console.error('Erro no proxy AWS Lambda:', err);
      return res.status(500).json({
        status: 'error',
        message: 'Falha na conexão com a AWS Lambda.',
        detail: err.message
      });
    }
  });

  // Rota POST: Inserir novo orçamento (Lead com verificação LGPD e suporte a anexo)
  app.post('/api/orcamentos', (req, res) => {
    try {
      const { nome, email, telefone, cidade, materiais, aceita_marketing, arquivo_nome, arquivo_tamanho, arquivo_url } = req.body;

      const cleanNome = String(nome || '').trim();
      const cleanTelefone = String(telefone || '').trim();
      const cleanCidade = String(cidade || '').trim();
      const cleanArquivoNome = String(arquivo_nome || '').trim();
      const cleanArquivoTamanho = String(arquivo_tamanho || '').trim();
      const cleanArquivoUrl = String(arquivo_url || '').trim();
      let cleanMateriais = String(materiais || '').trim();

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
      const cleanEmail = String(email || '').trim();

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

        // Salva as alterações no arquivo SQLite físico
        const data = db.export();
        fs.writeFileSync(DB_PATH, Buffer.from(data));

        // Obtém o último ID inserido
        const result = db.exec('SELECT last_insert_rowid() as id');
        const leadId = result[0]?.values[0]?.[0] || Date.now();

        console.log(`[NOVO ORÇAMENTO REGISTRADO] ID: ${leadId} - Cliente: ${cleanNome} - Tel: ${cleanTelefone} - Anexo: ${cleanArquivoNome || 'Nenhum'} - URL: ${cleanArquivoUrl || 'Nenhum'}`);

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
        message: 'Erro interno ao salvar no banco de dados',
        detail: err.message
      });
    }
  });

  // Rota GET: Listar orçamentos recebidos (Painel Administrativo)
  app.get('/api/orcamentos', requireAdmin, (req, res) => {
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
      return res.status(500).json({ status: 'error', message: err.message });
    }
  });

  // Rota POST: Login administrativo do lojista
  app.post('/api/admin/login', (req, res) => {
    try {
      const ip = req.ip || 'desconhecido';
      if (tooManyLoginFailures(ip)) {
        return res.status(429).json({ success: false, message: 'Muitas tentativas. Aguarde 15 minutos.' });
      }

      const { usuario, senha } = req.body;
      if (!usuario || !senha || typeof usuario !== 'string' || typeof senha !== 'string') {
        return res.status(400).json({ success: false, message: 'Informe usuário e senha.' });
      }

      if (!db) {
        return res.status(500).json({ success: false, message: 'Banco de dados não disponível.' });
      }

      const check = db.exec(
        `SELECT id, usuario, senha FROM admin_auth WHERE LOWER(usuario) = LOWER(?) LIMIT 1`,
        [usuario.trim()]
      );

      const found = check && check.length > 0 && check[0].values.length > 0;
      const storedPassword = found ? String(check[0].values[0][2]) : '';
      if (!found || !verifyPassword(senha, storedPassword)) {
        registerLoginFailure(ip);
        return res.status(401).json({ success: false, message: 'Usuário ou senha incorretos.' });
      }

      const usuarioDb = String(check[0].values[0][1]);
      if (!storedPassword.startsWith('scrypt$')) {
        db.run(`UPDATE admin_auth SET senha = ? WHERE id = ?`, [hashPassword(senha), check[0].values[0][0]]);
        fs.writeFileSync(DB_PATH, Buffer.from(db.export()));
      }

      return res.json({
        success: true,
        token: signAdminToken(usuarioDb),
        usuario: usuarioDb,
        message: 'Autenticado com sucesso!'
      });
    } catch (err: any) {
      console.error('Erro no login admin:', err);
      return res.status(500).json({ success: false, message: 'Erro interno ao validar login.' });
    }
  });

  // Rota POST: Alterar senha do admin
  app.post('/api/admin/change-password', requireAdmin, (req, res) => {
    try {
      // Só pode trocar a senha do próprio usuário logado
      const usuario = (req as any).adminUser as string;
      const { senhaAtual, novaSenha } = req.body;
      if (!usuario || !senhaAtual || !novaSenha) {
        return res.status(400).json({ success: false, message: 'Todos os campos são obrigatórios.' });
      }

      if (String(novaSenha).length < 10) {
        return res.status(400).json({ success: false, message: 'A nova senha deve ter no mínimo 10 caracteres.' });
      }

      if (!db) {
        return res.status(500).json({ success: false, message: 'Banco de dados não disponível.' });
      }

      const check = db.exec(
        `SELECT id, senha FROM admin_auth WHERE LOWER(usuario) = LOWER(?) LIMIT 1`,
        [usuario.trim()]
      );

      if (!check || check.length === 0 || check[0].values.length === 0) {
        return res.status(401).json({ success: false, message: 'Usuário não encontrado.' });
      }

      const storedPassword = String(check[0].values[0][1]);
      if (!verifyPassword(String(senhaAtual), storedPassword)) {
        return res.status(401).json({ success: false, message: 'Senha atual incorreta.' });
      }

      db.run(
        `UPDATE admin_auth SET senha = ?, data_modificacao = CURRENT_TIMESTAMP WHERE LOWER(usuario) = LOWER(?)`,
        [hashPassword(String(novaSenha)), usuario.trim()]
      );

      const data = db.export();
      fs.writeFileSync(DB_PATH, Buffer.from(data));

      return res.json({ success: true, message: 'Senha alterada com sucesso!' });
    } catch (err: any) {
      console.error('Erro ao alterar senha admin:', err);
      return res.status(500).json({ success: false, message: 'Erro ao alterar senha.' });
    }
  });

  // Rota DELETE: Excluir lead pelo lojista
  app.delete('/api/orcamentos/:id', requireAdmin, (req, res) => {
    try {
      const id = req.params.id;
      if (!db) {
        return res.status(500).json({ success: false, message: 'Banco de dados não disponível.' });
      }

      db.run(`DELETE FROM clientes_orcamento WHERE id = ?`, [id]);
      const data = db.export();
      fs.writeFileSync(DB_PATH, Buffer.from(data));

      return res.json({ success: true, message: 'Lead excluído com sucesso.' });
    } catch (err: any) {
      console.error('Erro ao excluir lead:', err);
      return res.status(500).json({ success: false, message: 'Erro ao excluir lead.' });
    }
  });

  // Rota POST: Registrar clique no botão do WhatsApp em qualquer ponto do site
  app.post('/api/eventos/clique-whatsapp', (req, res) => {
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
        const data = db.export();
        fs.writeFileSync(DB_PATH, Buffer.from(data));
      }

      return res.status(200).json({ success: true, timestamp: now });
    } catch (err: any) {
      console.error('Erro ao registrar clique whatsapp:', err);
      return res.status(200).json({ success: false });
    }
  });

  // Rota GET: Métricas Executivas e Dashboard Mensal Consolidado
  app.get('/api/admin/dashboard', requireAdmin, (req, res) => {
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
      return res.status(500).json({ error: 'Erro ao gerar métricas do dashboard', details: err.message });
    }
  });

  // Rota POST: Registrar novo acesso/visita ao site (chamado silenciosamente no carregamento da página)
  app.post('/api/visitas', (req, res) => {
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
      const pagina = req.body?.pagina || '/';
      const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

      if (db) {
        db.run(
          `INSERT INTO visitas_site (data_hora, dispositivo, navegador, origem, pagina) VALUES (?, ?, ?, ?, ?)`,
          [now, dispositivo, navegador, String(origem).substring(0, 150), pagina]
        );

        // Salva periodicamente no disco SQLite
        const data = db.export();
        fs.writeFileSync(DB_PATH, Buffer.from(data));
      }

      return res.status(200).json({ status: 'ok', time: now });
    } catch (err: any) {
      console.error('Erro ao registrar visita:', err);
      return res.status(200).json({ status: 'ignored' });
    }
  });

  // Rota GET: Listar estatísticas e acessos do site (Painel do Lojista)
  app.get('/api/visitas', requireAdmin, (req, res) => {
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
      return res.status(500).json({ status: 'error', message: err.message });
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
      return res.status(500).json({ status: 'error', message: err.message });
    }
  });

  // Rota POST: Adicionar nova avaliação (dinâmica, soma na contagem geral)
  app.post('/api/avaliacoes', requireAdmin, (req, res) => {
    try {
      const { autor, cargo, nota, comentario } = req.body;

      if (!autor || !nota || !comentario) {
        return res.status(400).json({
          status: 'error',
          message: 'Autor, nota e comentário são obrigatórios.'
        });
      }

      const ratingNum = Math.min(5, Math.max(1, parseInt(nota, 10) || 5));
      const roleStr = cargo?.trim() || 'Cliente Verificado';
      const dateText = 'Recente';

      if (db) {
        db.run(
          `INSERT INTO avaliacoes_google (autor, cargo, nota, data_texto, comentario, verificado) VALUES (?, ?, ?, ?, ?, 1)`,
          [autor.trim(), roleStr, ratingNum, dateText, comentario.trim()]
        );

        // Persiste imediatamente no arquivo SQLite
        const data = db.export();
        fs.writeFileSync(DB_PATH, Buffer.from(data));

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
      return res.status(500).json({ status: 'error', message: err.message });
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

  // Serve arquivos da pasta /public
  app.use(express.static(path.join(__dirname, 'public')));

  // Modo de Desenvolvimento com Vite Middleware
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Modo de Produção
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
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
