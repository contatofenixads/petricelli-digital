import { getSession, putFile, send } from './_lib.js';

const ALLOWED = /^image\/(png|jpe?g|webp|gif|svg\+xml|avif|x-icon|vnd\.microsoft\.icon)$/;

// Recebe { name, dataUrl } e devolve { url } servida por /api/file.
export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Método não permitido.' });
  const user = await getSession(req);
  if (!user || !(user.perms.includes('site') || user.perms.includes('crm'))) return send(res, 401, { error: 'Não autorizado.' });

  const { name = 'imagem', dataUrl = '' } = req.body || {};
  const m = String(dataUrl).match(/^data:([^;]+);base64,(.+)$/);
  if (!m || !ALLOWED.test(m[1])) return send(res, 400, { error: 'Formato de imagem não suportado.' });

  const ext = { 'image/svg+xml': 'svg', 'image/jpeg': 'jpg', 'image/x-icon': 'ico', 'image/vnd.microsoft.icon': 'ico' }[m[1]] || m[1].split('/')[1];
  const base = String(name).replace(/\.[^.]+$/, '').normalize('NFD').replace(/[^\w-]+/g, '-').slice(0, 40) || 'imagem';
  try {
    const p = await putFile(`uploads/${base}.${ext}`, Buffer.from(m[2], 'base64'), m[1]);
    return send(res, 200, { url: '/api/file?p=' + encodeURIComponent(p) });
  } catch (err) {
    console.error('upload', err);
    return send(res, 500, { error: err.message });
  }
}
