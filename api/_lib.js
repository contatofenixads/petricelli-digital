// Biblioteca compartilhada das funções da API: armazenamento, usuários e sessões.
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

export const CONFIG_PATH = 'site/config.json';

/* ---------- armazenamento ----------
 * Na Vercel: Blob Store PRIVADO (dados do CRM nunca ficam públicos).
 * Localmente: pasta definida em LOCAL_DATA_DIR (usada pelo dev-server).
 */
const LOCAL = process.env.LOCAL_DATA_DIR;
export const hasStorage = () => !!(LOCAL || process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
export const hasBlob = hasStorage;

let blobMod;
const blob = async () => (blobMod ||= await import('@vercel/blob'));
const localPath = (p) => path.join(LOCAL, p.replace(/\.\.+/g, '.'));

export class StorageError extends Error {}

function explain(err) {
  const m = String(err?.message || err);
  if (/public/i.test(m) && /private/i.test(m)) {
    return new StorageError('O armazenamento conectado é público. Crie um Blob Store com acesso "Private" e conecte ao projeto.');
  }
  return new StorageError('Falha no armazenamento: ' + m);
}

export async function readJSON(p, fallback = null) {
  if (!hasStorage()) return fallback;
  if (LOCAL) {
    try { return JSON.parse(await fs.readFile(localPath(p), 'utf8')); } catch { return fallback; }
  }
  try {
    const { get } = await blob();
    const r = await get(p, { access: 'private', useCache: false });
    if (!r || r.statusCode !== 200) return fallback;
    return await new Response(r.stream).json();
  } catch (err) {
    if (/not.?found/i.test(String(err?.name) + String(err?.message))) return fallback;
    throw explain(err);
  }
}

export async function writeJSON(p, data) {
  if (!hasStorage()) throw new StorageError('Armazenamento não conectado. Crie um Blob Store (Private) na Vercel e conecte ao projeto.');
  const body = JSON.stringify(data);
  if (LOCAL) {
    await fs.mkdir(path.dirname(localPath(p)), { recursive: true });
    await fs.writeFile(localPath(p), body);
    return;
  }
  try {
    const { put } = await blob();
    await put(p, body, { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json', cacheControlMaxAge: 60 });
  } catch (err) { throw explain(err); }
}

// Arquivos (imagens enviadas). Retorna o caminho interno do arquivo salvo.
export async function putFile(p, buffer, contentType) {
  if (!hasStorage()) throw new StorageError('Armazenamento de imagens não conectado.');
  if (LOCAL) {
    const name = p.replace(/(\.[^.]+)$/, '-' + crypto.randomBytes(4).toString('hex') + '$1');
    await fs.mkdir(path.dirname(localPath(name)), { recursive: true });
    await fs.writeFile(localPath(name), buffer);
    return name;
  }
  try {
    const { put } = await blob();
    const r = await put(p, buffer, { access: 'private', addRandomSuffix: true, contentType });
    return r.pathname;
  } catch (err) { throw explain(err); }
}

export async function getFile(p) {
  if (!hasStorage()) return null;
  if (LOCAL) {
    try {
      const buf = await fs.readFile(localPath(p));
      const ext = p.split('.').pop().toLowerCase();
      const type = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', svg: 'image/svg+xml', avif: 'image/avif', ico: 'image/x-icon' }[ext] || 'application/octet-stream';
      return { body: buf, contentType: type };
    } catch { return null; }
  }
  try {
    const { get } = await blob();
    const r = await get(p, { access: 'private' });
    if (!r || r.statusCode !== 200) return null;
    return { body: Buffer.from(await new Response(r.stream).arrayBuffer()), contentType: r.blob.contentType };
  } catch { return null; }
}

/* ---------- senhas ---------- */
// Senha mestra inicial (123456789), guardada só como hash. ADMIN_PASSWORD na Vercel tem prioridade.
const DEFAULT_TOKEN = '3dd4b7554ffe1c02fb7dc2648865e22fae9a30cab49cb2ecb5c0713b20db1adf';
export function tokenFor(password) {
  return crypto.createHash('sha256').update(`rebecca-lab:${password}`).digest('hex');
}
function safeEqual(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
const masterToken = () => (process.env.ADMIN_PASSWORD ? tokenFor(process.env.ADMIN_PASSWORD) : DEFAULT_TOKEN);

export function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(pw), salt, 32).toString('hex');
  return { salt, hash };
}
function verifyPassword(pw, user) {
  if (!user?.salt || !user?.hash) return false;
  return safeEqual(crypto.scryptSync(String(pw), user.salt, 32).toString('hex'), user.hash);
}

/* ---------- usuários e perfis ---------- */
export const USERS_PATH = 'system/users.json';
export const ROLES = {
  admin: { label: 'Administrador', perms: ['site', 'crm', 'financeiro', 'config'] },
  comercial: { label: 'Comercial', perms: ['crm'] },
  financeiro: { label: 'Financeiro', perms: ['crm', 'financeiro'] },
  editor: { label: 'Editor do site', perms: ['site'] },
};
const MASTER = { id: 'master', username: 'admin', name: 'Administrador', role: 'admin', active: true };

export const loadUsers = () => readJSON(USERS_PATH, []);
export const publicUser = (u) => ({ id: u.id, username: u.username, name: u.name, role: u.role, active: u.active !== false, perms: ROLES[u.role]?.perms || [] });

// Login: usuários cadastrados; enquanto não houver nenhum, vale o usuário "admin" com a senha mestra.
// A variável ADMIN_PASSWORD (se existir) sempre funciona como acesso de recuperação do "admin".
export async function authenticate(username, password) {
  const uname = String(username || 'admin').trim().toLowerCase();
  const users = await loadUsers().catch(() => []);
  const u = users.find((x) => x.username === uname);
  if (u) return u.active !== false && verifyPassword(password, u) ? u : null;
  const isMaster = uname === 'admin' && safeEqual(tokenFor(password ?? ''), masterToken());
  if (!isMaster) return null;
  if (users.length === 0 || process.env.ADMIN_PASSWORD) return MASTER;
  return null;
}

/* ---------- sessões assinadas ---------- */
let secretCache;
async function secret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  if (secretCache) return secretCache;
  if (hasStorage()) {
    try {
      let s = await readJSON('system/secret.json');
      if (!s?.secret) { s = { secret: crypto.randomBytes(32).toString('hex') }; await writeJSON('system/secret.json', s); }
      return (secretCache = s.secret);
    } catch { /* cai no padrão abaixo */ }
  }
  return crypto.createHash('sha256').update('petricelli-sem-armazenamento:' + masterToken()).digest('hex');
}
const b64 = (s) => Buffer.from(s).toString('base64url');

export async function createSession(user) {
  const payload = b64(JSON.stringify({ id: user.id, u: user.username, exp: Date.now() + 1000 * 60 * 60 * 24 * 7 }));
  const sig = crypto.createHmac('sha256', await secret()).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export async function getSession(req) {
  const raw = req.headers['x-admin-token'] || String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const [payload, sig] = String(raw || '').split('.');
  if (!payload || !sig) return null;
  const good = crypto.createHmac('sha256', await secret()).update(payload).digest('base64url');
  if (!safeEqual(sig, good)) return null;
  let data;
  try { data = JSON.parse(Buffer.from(payload, 'base64url').toString()); } catch { return null; }
  if (!data.exp || data.exp < Date.now()) return null;
  if (data.id === 'master') return publicUser(MASTER);
  const users = await loadUsers().catch(() => []);
  const u = users.find((x) => x.id === data.id);
  return u && u.active !== false ? publicUser(u) : null;
}

export async function requirePerm(req, res, perm) {
  const user = await getSession(req);
  if (!user) { send(res, 401, { error: 'Sessão expirada. Entre novamente.' }); return null; }
  if (perm && !user.perms.includes(perm)) { send(res, 403, { error: 'Seu usuário não tem acesso a esta área.' }); return null; }
  return user;
}

// Compatibilidade com o editor do site.
export const isAuthorized = async (req) => !!(await getSession(req))?.perms.includes('site');

/* ---------- utilidades ---------- */
export function send(res, status, body) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).json(body);
}
export const uid = () => Date.now().toString(36) + crypto.randomBytes(3).toString('hex');
export function slugify(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}
