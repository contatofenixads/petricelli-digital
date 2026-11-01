import { CONFIG_PATH, hasStorage, readJSON, requirePerm, send, writeJSON } from './_lib.js';

// Configuração do site de vendas (textos, cores, imagens). Leitura pública, escrita só com permissão "site".
export default async function handler(req, res) {
  if (req.method === 'GET') {
    if (!hasStorage()) return send(res, 200, { config: null, storage: false });
    try {
      return send(res, 200, { config: await readJSON(CONFIG_PATH), storage: true });
    } catch (err) {
      console.error('config:get', err);
      return send(res, 200, { config: null, storage: true, error: err.message });
    }
  }
  if (req.method === 'POST') {
    if (!(await requirePerm(req, res, 'site'))) return;
    const config = req.body?.config;
    if (!config || typeof config !== 'object') return send(res, 400, { error: 'Configuração inválida.' });
    try {
      await writeJSON(CONFIG_PATH, config);
      return send(res, 200, { ok: true });
    } catch (err) {
      console.error('config:put', err);
      return send(res, 500, { error: err.message });
    }
  }
  return send(res, 405, { error: 'Método não permitido.' });
}
