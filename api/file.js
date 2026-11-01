import { getFile } from './_lib.js';

// Entrega as imagens enviadas pelos painéis (ficam no armazenamento privado).
export default async function handler(req, res) {
  const p = String(req.query?.p || '');
  if (!/^uploads\/[\w.-]+$/.test(p)) { res.statusCode = 404; return res.end('Não encontrado'); }
  const f = await getFile(p);
  if (!f) { res.statusCode = 404; return res.end('Não encontrado'); }
  res.setHeader('Content-Type', f.contentType);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  if (f.contentType === 'image/svg+xml') res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'");
  res.end(f.body);
}
