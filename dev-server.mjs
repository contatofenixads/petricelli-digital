// Servidor local que imita a Vercel: arquivos de /public, funções de /api e os subdomínios do vercel.json.
// Uso: npm run dev   → http://localhost:3000 (site), /crm (CRM), /editar (editor), /o/<slug> (orçamento)
// Para testar subdomínios: http://admin.localhost:3000, http://editar.localhost:3000, http://orcamento.localhost:3000/<slug>
// Senha inicial: usuário "admin", senha 123456789. Os dados ficam na pasta data/.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';

process.env.LOCAL_DATA_DIR ||= path.resolve('data');
const PORT = Number(process.env.PORT) || 3000;
const ROOT = path.resolve('public');
const VERCEL = JSON.parse(await fs.readFile('vercel.json', 'utf8'));
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon' };

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString();
  try { return raw ? JSON.parse(raw) : {}; } catch { return {}; }
}

function hostMatches(value, host) {
  if (!/[\\*]/.test(value)) return value === host;
  try { return new RegExp('^' + value + '$').test(host); } catch { return false; }
}
function matchSource(source, pathname) {
  if (source === '/') return pathname === '/';
  const m = source.match(/^\/(?:([\w-]+)\/)?:(\w+)$/);
  if (!m) return source === pathname;
  const parts = pathname.split('/').filter(Boolean);
  return m[1] ? parts.length === 2 && parts[0] === m[1] : parts.length === 1;
}

async function fileFor(pathname) {
  const tries = [pathname, pathname + '.html', path.join(pathname, 'index.html')];
  for (const t of tries) {
    const p = path.join(ROOT, path.normalize(t));
    if (!p.startsWith(ROOT)) return null;
    const st = await fs.stat(p).catch(() => null);
    if (st?.isFile()) return p;
  }
  return null;
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const host = String(req.headers.host || '').replace(/:\d+$/, '');

  // Funções da API
  const api = url.pathname.match(/^\/api\/([\w-]+)$/);
  if (api && !api[1].startsWith('_')) {
    try {
      const mod = await import(path.resolve('api', api[1] + '.js') + '?v=' + Date.now());
      req.query = Object.fromEntries(url.searchParams);
      req.body = req.method === 'POST' ? await readBody(req) : undefined;
      res.status = (c) => { res.statusCode = c; return res; };
      res.json = (b) => { if (!res.getHeader('content-type')) res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(b)); };
      return await mod.default(req, res);
    } catch (err) {
      console.error(err);
      res.statusCode = 500; return res.end(String(err));
    }
  }

  // Arquivos (têm prioridade, como na Vercel) e depois os rewrites
  let file = url.pathname === '/' ? null : await fileFor(url.pathname);
  if (!file) {
    for (const r of VERCEL.rewrites || []) {
      if (!matchSource(r.source, url.pathname)) continue;
      if (r.has && !r.has.every((h) => h.type === 'host' && hostMatches(h.value, host))) continue;
      file = await fileFor(r.destination);
      break;
    }
  }
  if (!file) { res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }); return res.end('Página não encontrada'); }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
  res.end(await fs.readFile(file));
}).listen(PORT, () => console.log(`Petricelli Digital rodando em http://localhost:${PORT}  (CRM: /crm · editor: /editar · senha inicial: admin / 123456789)`));
