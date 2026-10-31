// Servidor local para testar o site e o painel sem a Vercel.
// Uso: npm run dev   (senha do painel: variável ADMIN_PASSWORD ou "123456789")
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const PORT = Number(process.env.PORT) || 3000;
const ROOT = path.resolve('public');
const DATA = path.resolve('data/config.json');
const PASSWORD = process.env.ADMIN_PASSWORD || '123456789';
const TOKEN = crypto.createHash('sha256').update(`rebecca-lab:${PASSWORD}`).digest('hex');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon' };

const json = (res, status, body) => { res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(JSON.stringify(body)); };
async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  try { return JSON.parse(Buffer.concat(chunks).toString() || '{}'); } catch { return {}; }
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const authed = req.headers['x-admin-token'] === TOKEN;

  if (url.pathname === '/api/login' && req.method === 'POST') {
    const b = await readBody(req);
    if (b.token) return b.token === TOKEN ? json(res, 200, { ok: true }) : json(res, 401, { error: 'Sessão inválida.' });
    return b.password === PASSWORD ? json(res, 200, { token: TOKEN }) : json(res, 401, { error: 'Senha incorreta.' });
  }
  if (url.pathname === '/api/config') {
    if (req.method === 'GET') {
      const config = await fs.readFile(DATA, 'utf8').then(JSON.parse).catch(() => null);
      return json(res, 200, { config, storage: true });
    }
    if (!authed) return json(res, 401, { error: 'Não autorizado.' });
    const b = await readBody(req);
    await fs.mkdir(path.dirname(DATA), { recursive: true });
    await fs.writeFile(DATA, JSON.stringify(b.config, null, 2));
    return json(res, 200, { ok: true });
  }
  if (url.pathname === '/api/upload' && req.method === 'POST') {
    if (!authed) return json(res, 401, { error: 'Não autorizado.' });
    const b = await readBody(req);
    const m = String(b.dataUrl || '').match(/^data:image\/([\w+.-]+);base64,(.+)$/);
    if (!m) return json(res, 400, { error: 'Formato inválido.' });
    const ext = m[1] === 'svg+xml' ? 'svg' : m[1] === 'jpeg' ? 'jpg' : m[1];
    const file = `${Date.now()}-${crypto.randomBytes(3).toString('hex')}.${ext}`;
    await fs.mkdir(path.join(ROOT, 'uploads'), { recursive: true });
    await fs.writeFile(path.join(ROOT, 'uploads', file), Buffer.from(m[2], 'base64'));
    return json(res, 200, { url: `/uploads/${file}` });
  }

  let p = decodeURIComponent(url.pathname);
  if (p === '/') p = '/index.html';
  if (p === '/admin') p = '/admin.html';
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  try {
    const data = await fs.readFile(file);
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404); res.end('Não encontrado');
  }
}).listen(PORT, () => console.log(`Petricelli Digital rodando em http://localhost:${PORT}  (painel: /admin)`));
