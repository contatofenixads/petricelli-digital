// API do CRM: clientes, orçamentos, catálogo, financeiro, contas, configurações, usuários e domínios.
import {
  ROLES, USERS_PATH, getSession, hasStorage, hashPassword, loadUsers, publicUser,
  readJSON, requirePerm, send, slugify, uid, writeJSON,
} from './_lib.js';

const COLLECTIONS = {
  clients: 'crm',
  catalog: 'crm',
  quotes: 'crm',
  transactions: 'financeiro',
  accounts: 'financeiro',
};
const colPath = (name) => `crm/${name}.json`;
const SETTINGS_PATH = 'crm/settings.json';
const SECRETS_PATH = 'system/secrets.json';

export const DEFAULT_SETTINGS = {
  company: {
    name: 'Petricelli Digital', tagline: 'Comunicação & Audiovisual', owner: 'Sabrina Petricelli',
    document: '', email: '', phone: '', whatsapp: '', instagram: '@petricelli.digital', website: '',
    address: '', pix: '', logo: '',
  },
  quote: {
    validityDays: 15,
    intro: 'Preparei esta proposta pensando no momento do seu negócio. Aqui você encontra o que vamos entregar, os prazos e o investimento.',
    paymentTerms: '50% na aprovação e 50% na entrega. Pagamento via Pix ou transferência bancária.',
    notes: 'Alterações fora do escopo serão orçadas à parte. Os prazos começam a contar após a aprovação e o envio dos materiais.',
    footer: 'Obrigada pela confiança! Qualquer dúvida, é só me chamar no WhatsApp.',
  },
  finance: {
    incomeCategories: ['Serviços', 'Mensalidades', 'Produção audiovisual', 'Consultoria', 'Outras receitas'],
    expenseCategories: ['Equipamentos', 'Softwares e assinaturas', 'Anúncios', 'Impostos', 'Transporte', 'Freelancers', 'Pró-labore', 'Outras despesas'],
  },
  domains: {
    list: ['petricellidigital.com.br', 'petricellidigital.com'],
    primary: 'petricellidigital.com.br',
  },
};

const SEED = {
  catalog: [
    { kind: 'servico', name: 'Gestão de redes sociais', description: 'Planejamento mensal, criação de posts, legendas e agendamento no Instagram.', price: 0, unit: 'mensal', deliveryDays: 7, category: 'Social media', active: true },
    { kind: 'servico', name: 'Produção de conteúdo audiovisual', description: 'Roteiro, captação e edição de vídeos curtos para Reels e Stories.', price: 0, unit: 'único', deliveryDays: 10, category: 'Audiovisual', active: true },
    { kind: 'servico', name: 'Ensaio de marca pessoal', description: 'Sessão de fotos profissionais com direção de poses e tratamento das imagens.', price: 0, unit: 'único', deliveryDays: 15, category: 'Audiovisual', active: true },
    { kind: 'servico', name: 'Consultoria de posicionamento', description: 'Diagnóstico do perfil, bio, destaques e linha editorial com plano de ação.', price: 0, unit: 'único', deliveryDays: 5, category: 'Consultoria', active: true },
    { kind: 'plano', name: 'Essencial', description: 'Para quem está começando a aparecer com constância.', price: 0, unit: 'mensal', deliveryDays: 7, category: 'Planos', active: true, features: '12 posts por mês\nLegendas estratégicas\nCalendário editorial\nRelatório mensal' },
    { kind: 'plano', name: 'Profissional', description: 'Presença completa com vídeos e bastidores.', price: 0, unit: 'mensal', deliveryDays: 7, category: 'Planos', active: true, featured: true, features: '16 posts por mês\n4 Reels editados\nStories semanais\nRelatório mensal com metas' },
    { kind: 'plano', name: 'Premium', description: 'Gestão total com captação audiovisual no seu negócio.', price: 0, unit: 'mensal', deliveryDays: 7, category: 'Planos', active: true, features: '20 posts por mês\n8 Reels editados\n1 diária de captação\nReunião mensal de estratégia' },
  ],
  accounts: [
    { name: 'Conta principal', type: 'Conta corrente', initialBalance: 0, color: '#7C3AED', active: true },
  ],
};

async function loadCol(name) {
  let list = await readJSON(colPath(name), null);
  if (list === null) {
    list = (SEED[name] || []).map((x) => ({ id: uid(), createdAt: new Date().toISOString(), ...x }));
    if (list.length && hasStorage()) await writeJSON(colPath(name), list);
  }
  return Array.isArray(list) ? list : [];
}

function deepMerge(base, over) {
  if (!over || typeof over !== 'object' || Array.isArray(over)) return over === undefined ? base : over;
  const out = { ...base };
  for (const k of Object.keys(over)) {
    out[k] = base && typeof base[k] === 'object' && !Array.isArray(base[k]) ? deepMerge(base[k], over[k]) : over[k];
  }
  return out;
}
export const loadSettings = async () => deepMerge(DEFAULT_SETTINGS, await readJSON(SETTINGS_PATH, {}));

function cleanItem(item) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('Registro inválido.');
  if (JSON.stringify(item).length > 300_000) throw new Error('Registro grande demais.');
  const out = { ...item };
  delete out.__proto__;
  return out;
}

function nextQuoteNumber(quotes) {
  const year = new Date().getFullYear();
  const nums = quotes.map((q) => String(q.number || '').match(new RegExp(`^ORC-${year}-(\\d+)$`))).filter(Boolean).map((m) => +m[1]);
  return `ORC-${year}-${String((nums.length ? Math.max(...nums) : 0) + 1).padStart(3, '0')}`;
}

async function saveInCollection(name, raw, user) {
  const item = cleanItem(raw);
  const list = await loadCol(name);
  const now = new Date().toISOString();
  const idx = item.id ? list.findIndex((x) => x.id === item.id) : -1;

  if (name === 'quotes') {
    item.slug = slugify(item.slug || item.clientCompany || item.clientName || item.title || 'orcamento') || 'orcamento';
    let slug = item.slug, n = 2;
    while (list.some((q) => q.slug === slug && q.id !== item.id)) slug = `${item.slug}-${n++}`;
    item.slug = slug;
    if (!item.number) item.number = idx >= 0 ? list[idx].number : nextQuoteNumber(list);
    // Campos controlados pela página pública não são sobrescritos por engano.
    if (idx >= 0) for (const k of ['views', 'viewedAt', 'approvedAt', 'approvedBy', 'approvedNote', 'chosenPlan', 'rejectedAt', 'rejectReason']) {
      if (item[k] === undefined && list[idx][k] !== undefined) item[k] = list[idx][k];
    }
  }
  if (name === 'clients' && !String(item.name || '').trim()) throw new Error('Informe o nome do cliente.');
  if (name === 'transactions') {
    item.amount = Math.abs(Number(item.amount) || 0);
    if (!item.description) throw new Error('Informe a descrição do lançamento.');
  }

  if (idx >= 0) list[idx] = { ...list[idx], ...item, updatedAt: now, updatedBy: user.name };
  else list.unshift({ ...item, id: item.id || uid(), createdAt: now, createdBy: user.name });
  await writeJSON(colPath(name), list);
  return idx >= 0 ? list[idx] : list[0];
}

/* ---------- domínios ---------- */
const SUBS = [
  { sub: '', role: 'Site de vendas' },
  { sub: 'www', role: 'Site de vendas' },
  { sub: 'admin', role: 'CRM (este painel)' },
  { sub: 'editar', role: 'Editor do site' },
  { sub: 'orcamento', role: 'Orçamentos dos clientes' },
];
const hostsFor = (domains) => domains.flatMap((d) => SUBS.map((s) => ({ host: s.sub ? `${s.sub}.${d}` : d, domain: d, ...s })));

async function checkHost(host) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 6000);
  try {
    const r = await fetch(`https://${host}/api/crm?r=health`, { signal: ctrl.signal, cache: 'no-store' });
    const j = await r.json().catch(() => ({}));
    return j.app === 'petricelli' ? { status: 'ok', label: 'Funcionando' } : { status: 'other', label: 'Aponta para outro site' };
  } catch (err) {
    return { status: 'off', label: ctrl.signal.aborted ? 'Sem resposta' : 'Ainda não aponta para cá' };
  } finally { clearTimeout(t); }
}

async function vercel(pathname, token, init = {}) {
  const r = await fetch('https://api.vercel.com' + pathname, {
    ...init, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...(init.headers || {}) },
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j?.error?.message || `Erro ${r.status} na Vercel`), { status: r.status, code: j?.error?.code });
  return j;
}
async function findProject(token) {
  const id = process.env.VERCEL_PROJECT_ID;
  const name = id || 'petricelli-digital';
  try { const p = await vercel(`/v9/projects/${name}`, token); return { project: p.id, team: '' }; } catch { /* tenta times */ }
  const { teams = [] } = await vercel('/v2/teams?limit=50', token);
  for (const t of teams) {
    try { const p = await vercel(`/v9/projects/${name}?teamId=${t.id}`, token); return { project: p.id, team: t.id }; } catch { /* próximo */ }
  }
  throw new Error('Projeto não encontrado com este token. Confira se o token tem acesso ao time do projeto.');
}

async function domainsAction(action, body, res) {
  const settings = await loadSettings();
  const secrets = await readJSON(SECRETS_PATH, {});
  const hosts = hostsFor(settings.domains.list);

  if (action === 'check') {
    const results = await Promise.all(hosts.map(async (h) => ({ host: h.host, ...(await checkHost(h.host)) })));
    return send(res, 200, { results });
  }
  if (action === 'token') {
    const token = String(body.token || '').trim();
    if (token) await vercel('/v2/user', token).catch(() => { throw new Error('Token inválido na Vercel.'); });
    await writeJSON(SECRETS_PATH, { ...secrets, vercelToken: token || undefined });
    return send(res, 200, { ok: true, hasToken: !!token });
  }
  if (!secrets.vercelToken) return send(res, 400, { error: 'Cadastre o token da Vercel primeiro.' });
  const { project, team } = await findProject(secrets.vercelToken);
  const q = team ? `?teamId=${team}` : '';

  if (action === 'vercel-add') {
    const out = [];
    for (const h of hosts) {
      try {
        await vercel(`/v10/projects/${project}/domains${q}`, secrets.vercelToken, { method: 'POST', body: JSON.stringify({ name: h.host }) });
        out.push({ host: h.host, ok: true, label: 'Adicionado' });
      } catch (err) {
        const exists = /already|exist/i.test(err.message) || err.code === 'domain_already_in_use' || err.status === 409;
        out.push({ host: h.host, ok: exists, label: exists ? 'Já estava no projeto' : err.message });
      }
    }
    return send(res, 200, { results: out });
  }
  if (action === 'vercel-status') {
    const out = [];
    for (const h of hosts) {
      try {
        const c = await vercel(`/v6/domains/${h.host}/config${q}`, secrets.vercelToken);
        out.push({ host: h.host, ok: !c.misconfigured, label: c.misconfigured ? 'DNS pendente' : 'DNS correto' });
      } catch (err) { out.push({ host: h.host, ok: false, label: err.message }); }
    }
    return send(res, 200, { results: out });
  }
  return send(res, 400, { error: 'Ação desconhecida.' });
}

/* ---------- usuários ---------- */
async function usersAction(action, body, me, res) {
  let users = await loadUsers();
  if (action === 'save') {
    const it = body.item || {};
    const username = slugify(it.username).replace(/-/g, '.');
    if (!username) throw new Error('Informe o usuário de acesso.');
    if (!ROLES[it.role]) throw new Error('Escolha um perfil de acesso.');
    if (users.some((u) => u.username === username && u.id !== it.id)) throw new Error('Este usuário já existe.');
    if (me.id === 'master' && !users.length && it.role !== 'admin') throw new Error('Antes de cadastrar a equipe, crie sua própria senha em Configurações → Segurança. Isso transforma o acesso "admin" em um usuário administrador.');
    const idx = it.id ? users.findIndex((u) => u.id === it.id) : -1;
    if (idx < 0 && String(it.password || '').length < 6) throw new Error('A senha precisa ter pelo menos 6 caracteres.');
    if (it.password && String(it.password).length < 6) throw new Error('A senha precisa ter pelo menos 6 caracteres.');
    const base = idx >= 0 ? users[idx] : { id: uid(), createdAt: new Date().toISOString() };
    const next = { ...base, username, name: String(it.name || username).slice(0, 80), role: it.role, active: it.active !== false };
    if (it.password) Object.assign(next, hashPassword(it.password));
    if (idx >= 0) users[idx] = next; else users.push(next);
    if (!users.some((u) => u.role === 'admin' && u.active !== false)) throw new Error('Mantenha pelo menos um administrador ativo.');
    await writeJSON(USERS_PATH, users);
    return send(res, 200, { users: users.map(publicUser) });
  }
  if (action === 'delete') {
    if (body.id === me.id) throw new Error('Você não pode excluir o próprio usuário.');
    users = users.filter((u) => u.id !== body.id);
    if (!users.some((u) => u.role === 'admin' && u.active !== false)) throw new Error('Mantenha pelo menos um administrador ativo.');
    await writeJSON(USERS_PATH, users);
    return send(res, 200, { users: users.map(publicUser) });
  }
  return send(res, 400, { error: 'Ação desconhecida.' });
}

/* ---------- handler ---------- */
export default async function handler(req, res) {
  const r = req.query?.r || req.body?.r;
  if (req.method === 'GET' && r === 'health') return send(res, 200, { app: 'petricelli', ok: true });

  try {
    if (req.method === 'GET' && r === 'bootstrap') {
      const me = await requirePerm(req, res, null);
      if (!me) return;
      const can = (p) => me.perms.includes(p);
      if (!can('crm') && !can('financeiro') && !can('config')) return send(res, 403, { error: 'Seu usuário só tem acesso ao editor do site.' });
      const out = { me, roles: ROLES, storage: hasStorage(), settings: await loadSettings() };
      for (const [name, perm] of Object.entries(COLLECTIONS)) if (can(perm)) out[name] = await loadCol(name);
      if (can('config')) {
        out.users = (await loadUsers()).map(publicUser);
        out.hasVercelToken = !!(await readJSON(SECRETS_PATH, {})).vercelToken;
        out.projectId = process.env.VERCEL_PROJECT_ID || '';
      }
      return send(res, 200, out);
    }

    if (req.method !== 'POST') return send(res, 405, { error: 'Método não permitido.' });
    const { action, item, id } = req.body || {};

    if (COLLECTIONS[r]) {
      const me = await requirePerm(req, res, COLLECTIONS[r]);
      if (!me) return;
      if (action === 'save') return send(res, 200, { item: await saveInCollection(r, item, me) });
      if (action === 'delete') {
        const list = (await loadCol(r)).filter((x) => x.id !== id);
        await writeJSON(colPath(r), list);
        return send(res, 200, { ok: true });
      }
      return send(res, 400, { error: 'Ação desconhecida.' });
    }

    if (r === 'settings') {
      const me = await requirePerm(req, res, 'config');
      if (!me) return;
      const current = await readJSON(SETTINGS_PATH, {});
      const next = deepMerge(current, cleanItem(item));
      await writeJSON(SETTINGS_PATH, next);
      return send(res, 200, { settings: deepMerge(DEFAULT_SETTINGS, next) });
    }

    if (r === 'users') {
      const me = await requirePerm(req, res, 'config');
      if (!me) return;
      return await usersAction(action, req.body, me, res);
    }

    if (r === 'domains') {
      const me = await requirePerm(req, res, 'config');
      if (!me) return;
      return await domainsAction(action, req.body, res);
    }

    if (r === 'me' && action === 'password') {
      const me = await getSession(req);
      if (!me) return send(res, 401, { error: 'Sessão expirada. Entre novamente.' });
      const nextPw = String(req.body.password || '');
      if (nextPw.length < 6) throw new Error('A nova senha precisa ter pelo menos 6 caracteres.');
      const users = await loadUsers();
      if (me.id === 'master') {
        // Primeira troca de senha: o "admin" vira um usuário de verdade e a senha inicial deixa de valer.
        users.push({ id: uid(), username: 'admin', name: req.body.name || 'Administrador', role: 'admin', active: true, createdAt: new Date().toISOString(), ...hashPassword(nextPw) });
      } else {
        const u = users.find((x) => x.id === me.id);
        if (!u) throw new Error('Usuário não encontrado.');
        Object.assign(u, hashPassword(nextPw));
      }
      await writeJSON(USERS_PATH, users);
      return send(res, 200, { ok: true, relogin: me.id === 'master' });
    }

    return send(res, 400, { error: 'Recurso desconhecido.' });
  } catch (err) {
    console.error('crm', r, err);
    return send(res, 400, { error: err.message || 'Falha na operação.' });
  }
}
