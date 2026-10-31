import { checkPassword, isAuthorized, adminToken, send } from './_lib.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Método não permitido.' });
  const body = req.body || {};
  // Verificação de uma sessão existente.
  if (body.token) {
    req.headers['x-admin-token'] = body.token;
    return isAuthorized(req) ? send(res, 200, { ok: true }) : send(res, 401, { error: 'Sessão inválida.' });
  }
  if (!checkPassword(body.password)) {
    await new Promise((r) => setTimeout(r, 700));
    return send(res, 401, { error: 'Senha incorreta.' });
  }
  return send(res, 200, { token: adminToken() });
}
