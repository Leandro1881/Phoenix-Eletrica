// Autenticação em dois fatores (TOTP, RFC 6238): o mesmo código de 6 dígitos do
// Google Authenticator, Microsoft Authenticator, Authy etc. Sem bibliotecas externas.
import crypto from 'crypto';

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const STEP_SECONDS = 30;
const DIGITS = 6;

export function generateTotpSecret(): string {
  const bytes = crypto.randomBytes(20);
  let bits = '';
  for (const b of bytes) bits += b.toString(2).padStart(8, '0');
  let out = '';
  for (let i = 0; i + 5 <= bits.length; i += 5) out += BASE32[parseInt(bits.slice(i, i + 5), 2)];
  return out;
}

function base32Decode(secret: string): Buffer {
  const clean = secret.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = '';
  for (const ch of clean) bits += BASE32.indexOf(ch).toString(2).padStart(5, '0');
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

function hotp(key: Buffer, counter: number): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac('sha1', key).update(msg).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code = (hmac.readUInt32BE(offset) & 0x7fffffff) % 10 ** DIGITS;
  return code.toString().padStart(DIGITS, '0');
}

export const currentTotpStep = (now = Date.now()) => Math.floor(now / 1000 / STEP_SECONDS);

// Confere o código aceitando 1 passo de diferença (relógio do celular adiantado/atrasado).
// Devolve o passo usado, para impedir que o mesmo código seja reaproveitado (replay); null se inválido.
export function verifyTotp(secret: string, code: string, lastUsedStep: number | null): number | null {
  const clean = String(code || '').replace(/\D/g, '');
  if (clean.length !== DIGITS) return null;
  const key = base32Decode(secret);
  const step = currentTotpStep();
  for (const delta of [0, -1, 1]) {
    const candidateStep = step + delta;
    if (lastUsedStep !== null && candidateStep <= lastUsedStep) continue;
    const expected = Buffer.from(hotp(key, candidateStep));
    if (crypto.timingSafeEqual(expected, Buffer.from(clean))) return candidateStep;
  }
  return null;
}

export function totpUri(secret: string, account: string, issuer = 'Phoenix Elétrica'): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${DIGITS}&period=${STEP_SECONDS}`;
}

// Códigos de recuperação de uso único (para quando o celular for perdido)
export function generateRecoveryCodes(count = 8): string[] {
  return Array.from({ length: count }, () => {
    const raw = crypto.randomBytes(5).toString('hex').toUpperCase();
    return `${raw.slice(0, 5)}-${raw.slice(5)}`;
  });
}

export const hashRecoveryCode = (code: string) =>
  crypto.createHash('sha256').update(code.toUpperCase().replace(/[^A-F0-9]/g, '')).digest('hex');

// Segredo do 2FA guardado cifrado no banco (AES-256-GCM), com chave derivada do ADMIN_SESSION_SECRET
function encryptionKey(masterSecret: string): Buffer {
  return Buffer.from(crypto.hkdfSync('sha256', masterSecret, 'phoenix-totp-salt', 'phoenix-totp-v1', 32));
}

export function encryptSecret(plain: string, masterSecret: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(masterSecret), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), enc.toString('base64')].join('.');
}

export function decryptSecret(payload: string, masterSecret: string): string | null {
  try {
    const [version, iv, tag, enc] = payload.split('.');
    if (version !== 'v1') return null;
    const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(masterSecret), Buffer.from(iv, 'base64'));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(enc, 'base64')), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}
