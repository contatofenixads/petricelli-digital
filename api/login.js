import { authenticate, createSession, getSession, publicUser, send } from './_lib.js';

// POST { username, password } → { token, user }   |   POST { token } → { ok, user }
export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Método não permitido.' });
  const body = req.body || {};
  try {
    if (body.token) {
      req.headers['x-admin-token'] = body.token;
      const user = await getSession(req);
      return user ? send(res, 200, { ok: true, user }) : send(res, 401, { error: 'Sessão inválida.' });
    }
    const user = await authenticate(body.username, body.password);
    if (!user) {
      await new Promise((r) => setTimeout(r, 700));
      return send(res, 401, { error: 'Usuário ou senha incorretos.' });
    }
    return send(res, 200, { token: await createSession(user), user: publicUser(user) });
  } catch (err) {
    console.error('login', err);
    return send(res, 500, { error: err.message || 'Falha ao entrar.' });
  }
}
