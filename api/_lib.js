import crypto from 'node:crypto';

export const CONFIG_PATH = 'site/config.json';

export function tokenFor(password) {
  return crypto.createHash('sha256').update(`rebecca-lab:${password}`).digest('hex');
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

// Senha padrão do painel, guardada só como hash (nunca em texto puro).
// Se a variável ADMIN_PASSWORD for definida na Vercel, ela substitui esta.
const DEFAULT_TOKEN = '3dd4b7554ffe1c02fb7dc2648865e22fae9a30cab49cb2ecb5c0713b20db1adf';

export function adminToken() {
  const pw = process.env.ADMIN_PASSWORD;
  return pw ? tokenFor(pw) : DEFAULT_TOKEN;
}

export function checkPassword(password) {
  return safeEqual(tokenFor(password ?? ''), adminToken());
}

export function isAuthorized(req) {
  return safeEqual(req.headers['x-admin-token'] || '', adminToken());
}

export const hasBlob = () => !!(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);

export function send(res, status, body) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).json(body);
}
