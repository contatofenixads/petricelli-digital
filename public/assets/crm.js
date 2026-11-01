// CRM Petricelli Digital — clientes, orçamentos, catálogo, financeiro, contas, relatórios e configurações.
import { icon } from './icons.js';
import { brl, fmtDate, quoteTotals, QUOTE_STATUS, UNITS, UNIT_SHORT, totalDays, isMonthly, lineTotal } from './quote-calc.js';

/* ======================================================================
   utilidades
   ====================================================================== */
const $ = (s, el = document) => el.querySelector(s);
function ic(name) {
  const t = document.createElement('template');
  t.innerHTML = icon(name);
  return t.content.firstChild;
}
function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (['value', 'checked', 'disabled', 'selected', 'readOnly'].includes(k)) el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  const add = (k) => {
    if (k === null || k === undefined || k === false) return;
    if (Array.isArray(k)) return k.forEach(add);
    el.append(k instanceof Node ? k : document.createTextNode(String(k)));
  };
  kids.forEach(add);
  return el;
}
// Como replaceChildren, mas ignora null/false (útil para itens condicionais).
const fill = (el, ...kids) => el.replaceChildren(...kids.flat().filter((k) => k !== null && k !== undefined && k !== false));
const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* sem armazenamento */ } },
  del: (k) => { try { localStorage.removeItem(k); } catch { /* sem armazenamento */ } },
};
const todayISO = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
const addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const addMonths = (iso, n) => { const d = new Date(iso + 'T12:00:00'); const day = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() + n); d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate())); return d.toISOString().slice(0, 10); };
const monthKey = (iso) => String(iso || '').slice(0, 7);
const monthLabel = (key, opts = { month: 'long', year: 'numeric' }) => new Date(key + '-15T12:00:00').toLocaleDateString('pt-BR', opts);
const initials = (s) => String(s || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const slugify = (s) => norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
const clone = (o) => JSON.parse(JSON.stringify(o));
const sum = (arr, f) => arr.reduce((s, x) => s + (Number(f(x)) || 0), 0);

function toast(msg, kind = 'ok') {
  const el = h('div', { class: 'toast ' + kind }, ic(kind === 'err' ? 'alert' : 'check'), h('span', {}, msg));
  $('#toasts').append(el);
  setTimeout(() => el.classList.add('out'), 3600);
  setTimeout(() => el.remove(), 4000);
}
async function copy(text, msg = 'Link copiado.') {
  try { await navigator.clipboard.writeText(text); toast(msg); }
  catch { window.prompt('Copie o link:', text); }
}

/* ======================================================================
   estado e API
   ====================================================================== */
const S = { token: store.get('crm_token'), me: null, d: {}, roles: {}, menu: false };
const can = (p) => !!S.me?.perms?.includes(p);

async function api(r, action, extra = {}) {
  const res = await fetch('/api/crm', {
    method: 'POST', cache: 'no-store',
    headers: { 'content-type': 'application/json', 'x-admin-token': S.token || '' },
    body: JSON.stringify({ r, action, ...extra }),
  });
  const j = await res.json().catch(() => ({}));
  if (res.status === 401) { logout(); throw new Error(j.error || 'Sessão expirada.'); }
  if (!res.ok) throw new Error(j.error || 'Não foi possível salvar.');
  return j;
}
async function saveItem(col, item) {
  const { item: saved } = await api(col, 'save', { item });
  const list = S.d[col] || (S.d[col] = []);
  const i = list.findIndex((x) => x.id === saved.id);
  if (i >= 0) list[i] = saved; else list.unshift(saved);
  return saved;
}
async function deleteItem(col, id) {
  await api(col, 'delete', { id });
  S.d[col] = (S.d[col] || []).filter((x) => x.id !== id);
}

/* ======================================================================
   endereços dos subdomínios
   ====================================================================== */
function domainBase() {
  const list = S.d.settings?.domains?.list || [];
  const host = location.hostname;
  const match = list.find((d) => host === d || host.endsWith('.' + d));
  return match ? (S.d.settings.domains.primary || match) : null;
}
const quoteUrl = (q) => (domainBase() ? `https://orcamento.${domainBase()}/${q.slug}` : `${location.origin}/o/${q.slug}`);
const editorUrl = () => (domainBase() ? `https://editar.${domainBase()}/` : `${location.origin}/editar`);
const siteUrl = () => (domainBase() ? `https://${domainBase()}/` : `${location.origin}/`);

/* ======================================================================
   componentes
   ====================================================================== */
function pill(label, tone = '') { return h('span', { class: 'pill ' + tone }, label); }
function emptyState(iconName, title, text, action) {
  return h('div', { class: 'empty' }, ic(iconName), h('strong', {}, title), text && h('span', {}, text), action);
}
function pageHead(title, sub, ...actions) {
  return h('div', { class: 'page-head' }, h('div', {}, h('h1', {}, title), sub && h('p', {}, sub)), h('div', { class: 'page-actions' }, actions));
}
function field(label, control, hint) {
  return h('label', { class: 'field' }, h('span', {}, label), control, hint && h('small', {}, hint));
}
// Controles ligados a um objeto: alteram obj[key] conforme o usuário digita.
function inp(obj, key, attrs = {}, onChange) {
  return h('input', { type: 'text', ...attrs, value: obj[key] ?? '', oninput: (e) => { obj[key] = attrs.type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value; onChange?.(); } });
}
function area(obj, key, attrs = {}, onChange) {
  const el = h('textarea', { ...attrs, oninput: (e) => { obj[key] = e.target.value; onChange?.(); } });
  el.value = obj[key] ?? '';
  return el;
}
function sel(obj, key, options, onChange) {
  return h('select', { onchange: (e) => { obj[key] = e.target.value; onChange?.(e.target.value); } },
    options.map((o) => { const [v, l] = Array.isArray(o) ? o : [o, o]; return h('option', { value: v, selected: String(obj[key] ?? '') === String(v) }, l); }));
}
function money(obj, key, onChange) {
  return h('div', { class: 'prefix' }, h('em', {}, 'R$'), inp(obj, key, { type: 'number', step: '0.01', min: '0', inputmode: 'decimal', placeholder: '0,00' }, onChange));
}
function sw(obj, key, label, onChange) {
  return h('label', { class: 'switch' }, h('input', { type: 'checkbox', checked: obj[key] !== false, onchange: (e) => { obj[key] = e.target.checked; onChange?.(e.target.checked); } }), label);
}

let closeOpen = null;
function drawer({ title, body, actions = [], onClose }) {
  closeOpen?.();
  const overlay = h('div', { class: 'overlay' });
  const panel = h('aside', { class: 'drawer', role: 'dialog', 'aria-label': title },
    h('div', { class: 'drawer-head' }, h('h2', {}, title), h('button', { class: 'icon-btn', 'aria-label': 'Fechar', onclick: () => close() }, ic('x'))),
    h('div', { class: 'drawer-body' }, body),
    actions.length ? h('div', { class: 'drawer-foot' }, actions) : null);
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  function close() { overlay.remove(); panel.remove(); removeEventListener('keydown', onKey); closeOpen = null; onClose?.(); }
  overlay.onclick = close;
  addEventListener('keydown', onKey);
  document.body.append(overlay, panel);
  closeOpen = close;
  setTimeout(() => panel.querySelector('input, select, textarea')?.focus(), 60);
  return close;
}
function confirmBox({ title, text, ok = 'Confirmar', danger = false }) {
  return new Promise((resolve) => {
    const overlay = h('div', { class: 'overlay', style: 'z-index:94' });
    const done = (v) => { overlay.remove(); box.remove(); resolve(v); };
    const box = h('div', { class: 'modal', role: 'alertdialog' },
      h('h2', {}, title), text && h('p', {}, text),
      h('div', { class: 'acts' }, h('button', { class: 'btn', onclick: () => done(false) }, 'Cancelar'),
        h('button', { class: 'btn ' + (danger ? 'danger' : 'primary'), onclick: () => done(true) }, ok)));
    overlay.onclick = () => done(false);
    document.body.append(overlay, box);
    box.querySelector('.acts button:last-child').focus();
  });
}
async function withBusy(btn, fn) {
  btn.disabled = true;
  try { await fn(); } catch (err) { toast(err.message, 'err'); } finally { btn.disabled = false; }
}

/* ======================================================================
   regras de negócio
   ====================================================================== */
const CLIENT_STATUS = { lead: ['Lead', 'info'], negociacao: ['Em negociação', 'warn'], ativo: ['Cliente ativo', 'ok'], inativo: ['Inativo', ''] };
const SOURCES = ['Instagram', 'Indicação', 'WhatsApp', 'Google', 'Site', 'Evento', 'Outro'];
const METHODS = ['Pix', 'Transferência', 'Cartão de crédito', 'Cartão de débito', 'Boleto', 'Dinheiro'];
const ACC_TYPES = ['Conta corrente', 'Conta poupança', 'Carteira', 'Cartão de crédito', 'Investimento'];

function txStatus(t) {
  if (t.paidAt) return 'pago';
  if (t.dueDate && t.dueDate < todayISO()) return 'atrasado';
  return 'pendente';
}
function txPill(t) {
  const s = txStatus(t);
  if (s === 'pago') return pill(t.type === 'despesa' ? 'Pago' : 'Recebido', 'ok');
  if (s === 'atrasado') return pill('Atrasado', 'bad');
  return pill('Pendente', 'warn');
}
const txDate = (t) => t.paidAt || t.dueDate || '';
const clientName = (id) => S.d.clients?.find((c) => c.id === id)?.name || '';
const accountName = (id) => S.d.accounts?.find((a) => a.id === id)?.name || '';
function accountBalance(acc) {
  const tx = (S.d.transactions || []).filter((t) => t.accountId === acc.id && t.paidAt);
  return (Number(acc.initialBalance) || 0) + sum(tx.filter((t) => t.type === 'receita'), (t) => t.amount) - sum(tx.filter((t) => t.type === 'despesa'), (t) => t.amount);
}
function quotePill(q) {
  const st = QUOTE_STATUS[q.status] || QUOTE_STATUS.rascunho;
  const expired = q.validUntil && q.validUntil < todayISO() && !['aprovado', 'recusado'].includes(q.status);
  return expired ? pill('Vencido', 'warn') : pill(st.label, st.tone);
}
function quoteValue(q) {
  const t = quoteTotals(q, q.chosenPlan);
  const parts = [];
  if (t.once) parts.push(brl(t.once));
  if (t.monthly) parts.push(brl(t.monthly) + '/mês');
  if (!parts.length && t.hasPlans) return 'Planos à escolha';
  return parts.join(' + ') || brl(0);
}

/* ======================================================================
   login
   ====================================================================== */
function renderLogin(msg = '') {
  const user = h('input', { class: 'input', id: 'crm-user', autocomplete: 'username', placeholder: 'Usuário', value: store.get('crm_user') || 'admin', required: true });
  const pass = h('input', { class: 'input', id: 'crm-pass', type: 'password', autocomplete: 'current-password', placeholder: 'Senha', required: true });
  const err = h('p', { class: 'login-err' }, msg);
  const btn = h('button', { class: 'btn primary', type: 'submit' }, 'Entrar', ic('arrow-right'));
  const form = h('form', {
    class: 'card login-card',
    onsubmit: async (e) => {
      e.preventDefault();
      err.textContent = '';
      btn.disabled = true;
      try {
        const r = await fetch('/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: user.value, password: pass.value }) });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || 'Não foi possível entrar.');
        S.token = j.token;
        store.set('crm_token', j.token);
        store.set('crm_user', user.value);
        await boot();
      } catch (ex) { err.textContent = ex.message; btn.disabled = false; }
    },
  },
  h('div', { class: 'brand-mark' }, 'P'),
  h('div', {}, h('h1', {}, 'Petricelli Digital'), h('p', {}, 'Acesse o painel administrativo.')),
  field('Usuário', user), field('Senha', pass), btn, err);
  fill($('#app'), h('main', { class: 'login' }, form));
  pass.focus();
}
function logout() {
  S.token = null; S.me = null;
  store.del('crm_token');
  closeOpen?.();
  renderLogin();
}

/* ======================================================================
   estrutura (menu lateral)
   ====================================================================== */
const NAV = [
  { group: 'Visão geral' },
  { id: 'painel', label: 'Painel', icon: 'home', perm: null },
  { group: 'Comercial' },
  { id: 'clientes', label: 'Clientes', icon: 'users', perm: 'crm', count: () => S.d.clients?.length },
  { id: 'orcamentos', label: 'Orçamentos', icon: 'file-text', perm: 'crm', count: () => S.d.quotes?.filter((q) => ['enviado', 'visualizado'].includes(q.status)).length },
  { id: 'catalogo', label: 'Serviços e planos', icon: 'package', perm: 'crm' },
  { group: 'Financeiro' },
  { id: 'financeiro', label: 'Lançamentos', icon: 'dollar', perm: 'financeiro' },
  { id: 'contas', label: 'Contas', icon: 'wallet', perm: 'financeiro' },
  { id: 'relatorios', label: 'Relatórios', icon: 'chart', perm: 'financeiro' },
  { group: 'Sistema' },
  { id: 'config', label: 'Configurações', icon: 'settings', perm: 'config' },
];

function parseRoute() {
  const [page = 'painel', a = '', b = ''] = location.hash.replace(/^#\/?/, '').split('/');
  return { page, a, b };
}

function renderShell() {
  const { page } = parseRoute();
  const company = S.d.settings?.company || {};
  const items = [];
  let pendingGroup = null;
  for (const n of NAV) {
    if (n.group) { pendingGroup = n.group; continue; }
    if (n.perm && !can(n.perm)) continue;
    if (pendingGroup) { items.push(h('div', { class: 'nav-label' }, pendingGroup)); pendingGroup = null; }
    const c = n.count?.();
    items.push(h('a', { href: '#/' + n.id, class: page === n.id ? 'on' : '', onclick: () => { S.menu = false; } }, ic(n.icon), n.label, c ? h('span', { class: 'count' }, c) : null));
  }
  if (can('site')) items.push(h('a', { href: editorUrl(), target: '_blank', rel: 'noopener' }, ic('palette'), 'Editar o site', h('span', { class: 'count' }, ic('external'))));
  items.push(h('a', { href: siteUrl(), target: '_blank', rel: 'noopener' }, ic('globe'), 'Ver o site'));

  const mark = company.logo ? h('span', { class: 'brand-mark' }, h('img', { src: company.logo, alt: '' })) : h('span', { class: 'brand-mark' }, initials(company.name || 'P')[0]);
  const side = h('aside', { class: 'side' },
    h('a', { class: 'brand', href: '#/painel' }, mark, h('span', {}, h('strong', {}, company.name || 'Petricelli Digital'), h('small', {}, 'Gestão'))),
    h('nav', { class: 'nav' }, items),
    h('div', { class: 'side-foot' },
      h('div', { class: 'me' }, h('span', { class: 'avatar' }, initials(S.me.name)), h('div', {}, h('strong', {}, S.me.name), h('small', {}, S.roles[S.me.role]?.label || '')),
        h('button', { class: 'icon-btn', title: 'Sair', 'aria-label': 'Sair', onclick: logout }, ic('logout')))));
  const topbar = h('div', { class: 'topbar' },
    h('button', { class: 'icon-btn', 'aria-label': 'Abrir menu', onclick: () => { S.menu = !S.menu; shell.classList.toggle('menu', S.menu); } }, ic('menu')),
    h('strong', {}, company.name || 'Petricelli Digital'),
    h('span', { class: 'avatar' }, initials(S.me.name)));
  const main = h('main', { class: 'main', id: 'main' });
  const shell = h('div', { class: 'shell' + (S.menu ? ' menu' : '') }, side, h('div', {}, topbar, main));
  shell.addEventListener('click', (e) => { if (S.menu && e.target === shell) { S.menu = false; shell.classList.remove('menu'); } });
  fill($('#app'), shell);
  return main;
}

function render() {
  if (!S.me) return;
  closeOpen?.();
  const main = renderShell();
  const { page, a, b } = parseRoute();
  const nav = NAV.find((n) => n.id === page);
  if (!nav || (nav.perm && !can(nav.perm))) { location.hash = '#/painel'; return; }
  const pages = { painel: pageDashboard, clientes: pageClients, orcamentos: pageQuotes, catalogo: pageCatalog, financeiro: pageFinance, contas: pageAccounts, relatorios: pageReports, config: pageSettings };
  pages[page](main, a, b);
  scrollTo(0, 0);
}
addEventListener('hashchange', render);

/* ======================================================================
   painel
   ====================================================================== */
function pageDashboard(main) {
  const today = todayISO(), mk = monthKey(today);
  const tx = S.d.transactions || [];
  const quotes = S.d.quotes || [];
  const kpis = [];
  if (can('financeiro')) {
    const inMonth = tx.filter((t) => t.paidAt && monthKey(t.paidAt) === mk);
    const received = sum(inMonth.filter((t) => t.type === 'receita'), (t) => t.amount);
    const spent = sum(inMonth.filter((t) => t.type === 'despesa'), (t) => t.amount);
    const toReceive = tx.filter((t) => t.type === 'receita' && !t.paidAt);
    const late = toReceive.filter((t) => t.dueDate && t.dueDate < today);
    const balance = sum(S.d.accounts || [], accountBalance);
    kpis.push(
      kpi('Recebido no mês', brl(received), monthLabel(mk), 'trending-up', 'ok'),
      kpi('A receber', brl(sum(toReceive, (t) => t.amount)), late.length ? `${late.length} em atraso · ${brl(sum(late, (t) => t.amount))}` : `${toReceive.length} lançamento(s)`, 'calendar', late.length ? 'bad' : ''),
      kpi('Despesas no mês', brl(spent), 'pagas em ' + monthLabel(mk, { month: 'long' }), 'trending-down', 'warn'),
      kpi('Saldo em contas', brl(balance), `${(S.d.accounts || []).length} conta(s)`, 'wallet'),
    );
  }
  if (can('crm')) {
    const open = quotes.filter((q) => ['enviado', 'visualizado'].includes(q.status));
    const won = quotes.filter((q) => q.status === 'aprovado').length, lost = quotes.filter((q) => q.status === 'recusado').length;
    kpis.push(
      kpi('Orçamentos em aberto', String(open.length), open.length ? sum(open, (q) => quoteTotals(q).once) ? brl(sum(open, (q) => quoteTotals(q).once)) + ' em propostas' : 'aguardando resposta' : 'nenhum aguardando', 'file-text'),
      kpi('Taxa de aprovação', won + lost ? Math.round((won / (won + lost)) * 100) + '%' : '—', `${won} aprovado(s) · ${lost} recusado(s)`, 'award', 'ok'),
    );
  }
  const hello = new Date().getHours() < 12 ? 'Bom dia' : new Date().getHours() < 18 ? 'Boa tarde' : 'Boa noite';
  main.append(pageHead(`${hello}, ${S.me.name.split(' ')[0]}`, new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }),
    can('crm') && h('a', { class: 'btn', href: '#/clientes/novo' }, ic('user'), 'Novo cliente'),
    can('crm') && h('a', { class: 'btn primary', href: '#/orcamentos/novo' }, ic('plus'), 'Novo orçamento')));
  if (!S.storage) main.append(h('div', { class: 'callout warn', style: 'margin-bottom:16px' }, ic('alert'), h('div', {}, h('strong', {}, 'Armazenamento não conectado'), 'Os dados não serão salvos até você criar um Blob Store com acesso "Private" na Vercel e conectar ao projeto.')));
  if (S.me.id === 'master' && can('config')) main.append(h('div', { class: 'callout', style: 'margin-bottom:16px' }, ic('key'), h('div', {}, h('strong', {}, 'Você está usando a senha inicial'), 'Crie uma senha só sua em ', h('a', { href: '#/config/seguranca', style: 'text-decoration:underline' }, 'Configurações → Segurança'), '.')));
  main.append(h('div', { class: 'kpis' }, kpis));

  const left = h('div', { class: 'grid' }), right = h('div', { class: 'grid' });
  if (can('financeiro')) {
    left.append(h('section', { class: 'card' },
      h('div', { class: 'card-head' }, h('div', {}, h('h2', {}, 'Entradas e saídas'), h('p', {}, 'Valores pagos nos últimos 6 meses')),
        h('div', { class: 'legend' }, h('span', {}, h('i', { style: 'background:#7C3AED' }), 'Receitas'), h('span', {}, h('i', { style: 'background:#F0A5C8' }), 'Despesas'))),
      h('div', { class: 'card-pad' }, cashChart(tx, 6))));
    const upcoming = tx.filter((t) => !t.paidAt).sort((x, y) => String(x.dueDate).localeCompare(String(y.dueDate))).slice(0, 6);
    right.append(h('section', { class: 'card' },
      h('div', { class: 'card-head' }, h('h2', {}, 'Próximos vencimentos'), h('a', { class: 'btn sm ghost', href: '#/financeiro' }, 'Ver tudo')),
      upcoming.length ? h('div', { class: 'list' }, upcoming.map((t) => {
        const d = new Date((t.dueDate || today) + 'T12:00:00');
        return h('div', { class: 'list-item' },
          h('div', { class: 'date-chip' + (txStatus(t) === 'atrasado' ? ' late' : '') }, h('b', {}, d.getDate()), h('small', {}, d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''))),
          h('div', { class: 'grow' }, h('strong', {}, t.description), h('small', {}, clientName(t.clientId) || t.category || '')),
          h('span', { class: 'money ' + (t.type === 'receita' ? 'in' : 'out') }, (t.type === 'receita' ? '+' : '−') + brl(t.amount)));
      })) : emptyState('check', 'Tudo em dia', 'Nenhuma conta pendente.')));
  }
  if (can('crm')) {
    const recent = [...quotes].sort((x, y) => String(y.updatedAt || y.createdAt).localeCompare(String(x.updatedAt || x.createdAt))).slice(0, 6);
    (can('financeiro') ? left : left).append(h('section', { class: 'card' },
      h('div', { class: 'card-head' }, h('h2', {}, 'Orçamentos recentes'), h('a', { class: 'btn sm ghost', href: '#/orcamentos' }, 'Ver todos')),
      recent.length ? h('div', { class: 'table-wrap' }, h('table', { class: 't' }, h('tbody', {}, recent.map((q) => h('tr', { class: 'click', onclick: () => { location.hash = '#/orcamentos/' + q.id; } },
        h('td', {}, h('span', { class: 'strong' }, q.clientName || 'Sem cliente'), h('span', { class: 'sub' }, `${q.number} · ${q.title || ''}`)),
        h('td', { class: 'right' }, h('span', { class: 'money' }, quoteValue(q))),
        h('td', { class: 'right' }, quotePill(q)))))))
        : emptyState('file-text', 'Nenhum orçamento ainda', 'Crie o primeiro e envie o link para o cliente.', h('a', { class: 'btn primary sm', href: '#/orcamentos/novo' }, ic('plus'), 'Novo orçamento'))));
    const leads = (S.d.clients || []).slice(0, 5);
    right.append(h('section', { class: 'card' },
      h('div', { class: 'card-head' }, h('h2', {}, 'Clientes recentes'), h('a', { class: 'btn sm ghost', href: '#/clientes' }, 'Ver todos')),
      leads.length ? h('div', { class: 'list' }, leads.map((c) => h('a', { class: 'list-item', href: '#/clientes/' + c.id },
        h('span', { class: 'avatar' }, initials(c.name)),
        h('div', { class: 'grow' }, h('strong', {}, c.name), h('small', {}, c.company || c.phone || c.email || '')),
        pill(...(CLIENT_STATUS[c.status] || CLIENT_STATUS.lead))))) : emptyState('users', 'Nenhum cliente cadastrado')));
  }
  main.append(h('div', { class: 'two' }, left, right));
}
function kpi(label, value, sub, iconName, tone = '') {
  return h('div', { class: 'card kpi ' + tone }, h('div', { class: 'k-label' }, h('span', { class: 'k-ico' }, ic(iconName)), label), h('div', { class: 'k-val' }, value), h('div', { class: 'k-sub' }, sub));
}
function cashChart(tx, months) {
  const keys = [];
  for (let i = months - 1; i >= 0; i--) keys.push(monthKey(addMonths(todayISO().slice(0, 8) + '15', -i)));
  const data = keys.map((k) => ({
    k,
    inc: sum(tx.filter((t) => t.paidAt && monthKey(t.paidAt) === k && t.type === 'receita'), (t) => t.amount),
    exp: sum(tx.filter((t) => t.paidAt && monthKey(t.paidAt) === k && t.type === 'despesa'), (t) => t.amount),
  }));
  const max = Math.max(1, ...data.flatMap((d) => [d.inc, d.exp]));
  const step = Math.pow(10, Math.floor(Math.log10(max)));
  const top = Math.ceil(max / step) * step;
  const W = 640, H = 230, L = 64, B = 28, T = 10, ch = H - B - T, cw = (W - L - 8) / months;
  const y = (v) => T + ch - (v / top) * ch;
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('class', 'chart');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Receitas e despesas pagas por mês');
  const el = (tag, attrs, text) => { const e = document.createElementNS(ns, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); if (text !== undefined) e.textContent = text; svg.append(e); return e; };
  for (let i = 0; i <= 4; i++) {
    const v = (top / 4) * i;
    el('line', { x1: L, x2: W - 4, y1: y(v), y2: y(v), stroke: '#E9E3F1', 'stroke-dasharray': i ? '3 4' : '' });
    el('text', { x: L - 8, y: y(v) + 4, 'text-anchor': 'end' }, v >= 1000 ? `R$ ${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil` : `R$ ${v.toLocaleString('pt-BR')}`);
  }
  data.forEach((d, i) => {
    const x = L + i * cw + cw / 2, bw = Math.min(22, cw / 3.2);
    el('rect', { x: x - bw - 2, y: y(d.inc), width: bw, height: Math.max(0, T + ch - y(d.inc)), rx: 4, fill: '#7C3AED' }).append(Object.assign(document.createElementNS(ns, 'title'), { textContent: `Receitas: ${brl(d.inc)}` }));
    el('rect', { x: x + 2, y: y(d.exp), width: bw, height: Math.max(0, T + ch - y(d.exp)), rx: 4, fill: '#F0A5C8' }).append(Object.assign(document.createElementNS(ns, 'title'), { textContent: `Despesas: ${brl(d.exp)}` }));
    el('text', { x, y: H - 8, 'text-anchor': 'middle' }, monthLabel(d.k, { month: 'short' }).replace('.', ''));
  });
  return svg;
}

/* ======================================================================
   clientes
   ====================================================================== */
const ui = { clientFilter: 'todos', clientSearch: '', quoteFilter: 'todos', quoteSearch: '', finMonth: monthKey(todayISO()), finType: 'todos', finStatus: 'todos', catKind: 'servico' };

function pageClients(main, a) {
  const tbody = h('tbody');
  const draw = () => {
    const q = norm(ui.clientSearch);
    const list = (S.d.clients || []).filter((c) => (ui.clientFilter === 'todos' || (c.status || 'lead') === ui.clientFilter)
      && (!q || norm([c.name, c.company, c.email, c.phone, c.instagram, c.city].join(' ')).includes(q)));
    fill(tbody, ...list.map((c) => {
      const cq = (S.d.quotes || []).filter((x) => x.clientId === c.id);
      const won = sum(cq.filter((x) => x.status === 'aprovado'), (x) => quoteTotals(x, x.chosenPlan).once);
      return h('tr', { class: 'click', onclick: () => clientDrawer(c) },
        h('td', {}, h('div', { style: 'display:flex;gap:10px;align-items:center' }, h('span', { class: 'avatar' }, initials(c.name)), h('div', {}, h('span', { class: 'strong' }, c.name), h('span', { class: 'sub' }, c.company || '')))),
        h('td', {}, c.phone || '—', h('span', { class: 'sub' }, c.email || c.instagram || '')),
        h('td', {}, pill(...(CLIENT_STATUS[c.status] || CLIENT_STATUS.lead))),
        h('td', {}, c.source || '—'),
        h('td', { class: 'right num' }, cq.length),
        h('td', { class: 'right' }, h('span', { class: 'money' }, won ? brl(won) : '—')));
    }));
    if (!list.length) fill(tbody, h('tr', {}, h('td', { colspan: 6 }, emptyState('users', ui.clientSearch || ui.clientFilter !== 'todos' ? 'Nenhum cliente encontrado' : 'Nenhum cliente ainda', 'Cadastre clientes para criar orçamentos e lançamentos.'))));
  };
  const seg = h('div', { class: 'seg' }, [['todos', 'Todos'], ...Object.entries(CLIENT_STATUS).map(([k, v]) => [k, v[0]])].map(([k, l]) =>
    h('button', { class: ui.clientFilter === k ? 'on' : '', onclick: (e) => { ui.clientFilter = k; seg.querySelectorAll('button').forEach((b) => b.classList.remove('on')); e.target.classList.add('on'); draw(); } }, l)));
  main.append(
    pageHead('Clientes', `${(S.d.clients || []).length} cadastrado(s)`, h('button', { class: 'btn primary', onclick: () => clientDrawer({ status: 'lead' }) }, ic('plus'), 'Novo cliente')),
    h('section', { class: 'card' },
      h('div', { class: 'toolbar' }, h('label', { class: 'search' }, ic('search'), h('input', { placeholder: 'Buscar por nome, empresa, telefone…', value: ui.clientSearch, oninput: (e) => { ui.clientSearch = e.target.value; draw(); } })), seg),
      h('div', { class: 'table-wrap' }, h('table', { class: 't' }, h('thead', {}, h('tr', {}, h('th', {}, 'Cliente'), h('th', {}, 'Contato'), h('th', {}, 'Status'), h('th', {}, 'Origem'), h('th', { class: 'right' }, 'Orçamentos'), h('th', { class: 'right' }, 'Aprovado'))), tbody))));
  draw();
  if (a === 'novo') clientDrawer({ status: 'lead' });
  else if (a) { const c = S.d.clients?.find((x) => x.id === a); if (c) clientDrawer(c); }
}

function clientDrawer(orig) {
  const c = clone(orig);
  const isNew = !c.id;
  const body = h('div', { class: 'form' },
    h('div', { class: 'row' }, field('Nome *', inp(c, 'name', { placeholder: 'Nome do contato', required: true })), field('Empresa', inp(c, 'company', { placeholder: 'Nome da empresa' }))),
    h('div', { class: 'row' }, field('WhatsApp / telefone', inp(c, 'phone', { type: 'tel', placeholder: '(11) 99999-9999' })), field('E-mail', inp(c, 'email', { type: 'email', placeholder: 'email@empresa.com' }))),
    h('div', { class: 'row' }, field('Instagram', inp(c, 'instagram', { placeholder: '@perfil' })), field('CPF / CNPJ', inp(c, 'document'))),
    h('div', { class: 'row' }, field('Cidade', inp(c, 'city')), field('Segmento', inp(c, 'segment', { placeholder: 'Ex.: Estética, Restaurante' }))),
    h('div', { class: 'row' }, field('Status', sel(c, 'status', Object.entries(CLIENT_STATUS).map(([k, v]) => [k, v[0]]))), field('Origem', sel(c, 'source', [['', 'Selecione'], ...SOURCES]))),
    field('Observações', area(c, 'notes', { rows: 4, placeholder: 'Preferências, histórico de conversas, combinados…' })));
  if (!isNew) {
    const cq = (S.d.quotes || []).filter((q) => q.clientId === c.id);
    const ct = (S.d.transactions || []).filter((t) => t.clientId === c.id);
    body.append(h('div', { class: 'section-title', style: 'margin-top:8px' }, ic('file-text'), 'Orçamentos'),
      cq.length ? h('div', { class: 'list card' }, cq.map((q) => h('a', { class: 'list-item', href: '#/orcamentos/' + q.id }, h('div', { class: 'grow' }, h('strong', {}, q.title || q.number), h('small', {}, `${q.number} · ${quoteValue(q)}`)), quotePill(q)))) : h('p', { class: 'hint' }, 'Nenhum orçamento para este cliente.'));
    if (can('financeiro')) body.append(h('div', { class: 'section-title', style: 'margin-top:8px' }, ic('dollar'), 'Financeiro'),
      ct.length ? h('div', { class: 'list card' }, ct.slice(0, 8).map((t) => h('div', { class: 'list-item' }, h('div', { class: 'grow' }, h('strong', {}, t.description), h('small', {}, fmtDate(txDate(t)))), h('span', { class: 'money ' + (t.type === 'receita' ? 'in' : 'out') }, brl(t.amount)), txPill(t)))) : h('p', { class: 'hint' }, 'Nenhum lançamento vinculado.'));
  }
  const saveBtn = h('button', { class: 'btn primary', onclick: () => withBusy(saveBtn, async () => {
    if (!String(c.name || '').trim()) throw new Error('Informe o nome do cliente.');
    await saveItem('clients', c);
    toast(isNew ? 'Cliente cadastrado.' : 'Cliente atualizado.');
    close(); render();
  }) }, ic('check'), 'Salvar');
  const close = drawer({
    title: isNew ? 'Novo cliente' : c.name,
    body,
    onClose: () => { if (parseRoute().a) history.replaceState(null, '', '#/clientes'); },
    actions: [
      !isNew && h('button', { class: 'btn danger', onclick: async () => {
        if (!(await confirmBox({ title: 'Excluir cliente?', text: `${c.name} será removido. Orçamentos e lançamentos continuam salvos.`, ok: 'Excluir', danger: true }))) return;
        try { await deleteItem('clients', c.id); toast('Cliente excluído.'); close(); render(); } catch (err) { toast(err.message, 'err'); }
      } }, ic('trash'), 'Excluir'),
      h('span', { class: 'spacer' }),
      !isNew && h('a', { class: 'btn', href: '#/orcamentos/novo/' + c.id }, ic('file-text'), 'Criar orçamento'),
      saveBtn,
    ].filter(Boolean),
  });
}

/* ======================================================================
   catálogo (serviços e planos)
   ====================================================================== */
function pageCatalog(main) {
  const grid = h('div', { class: 'cat-grid' });
  const draw = () => {
    const list = (S.d.catalog || []).filter((x) => (x.kind || 'servico') === ui.catKind);
    fill(grid, ...list.map((it) => h('article', { class: 'card cat' + (it.active === false ? ' off' : '') },
      h('div', { class: 'cat-top' }, h('div', {}, h('h3', {}, it.name), h('span', { class: 'hint' }, it.category || '')), it.featured ? pill('Destaque', 'brand') : null),
      it.description && h('p', {}, it.description),
      h('div', { class: 'price' }, Number(it.price) ? brl(it.price) : h('span', { style: 'color:var(--warn);font-size:1rem' }, 'Definir valor'), ' ', h('small', {}, UNIT_SHORT[it.unit] || '')),
      it.features && h('ul', {}, String(it.features).split('\n').filter(Boolean).map((f) => h('li', {}, ic('check'), f))),
      h('small', { class: 'hint' }, it.deliveryDays ? `Prazo: ${it.deliveryDays} dia(s)` : 'Sem prazo definido'),
      h('div', { class: 'cat-foot' },
        sw(it, 'active', it.active === false ? 'Inativo' : 'Ativo', async (v) => { try { await saveItem('catalog', { ...it, active: v }); draw(); toast(v ? 'Item ativado.' : 'Item desativado.'); } catch (err) { toast(err.message, 'err'); } }),
        h('div', { class: 'line-tools' },
          h('button', { class: 'icon-btn', title: 'Duplicar', onclick: async () => { const { id, createdAt, ...rest } = it; await saveItem('catalog', { ...rest, name: it.name + ' (cópia)' }); draw(); toast('Item duplicado.'); } }, ic('copy')),
          h('button', { class: 'icon-btn', title: 'Editar', onclick: () => catalogDrawer(it, draw) }, ic('pen')),
          h('button', { class: 'icon-btn danger', title: 'Excluir', onclick: async () => {
            if (!(await confirmBox({ title: 'Excluir item?', text: `"${it.name}" sai do catálogo. Orçamentos já enviados não mudam.`, ok: 'Excluir', danger: true }))) return;
            await deleteItem('catalog', it.id); draw(); toast('Item excluído.');
          } }, ic('trash')))))));
    if (!list.length) fill(grid, h('div', { class: 'card', style: 'grid-column:1/-1' }, emptyState('package', ui.catKind === 'plano' ? 'Nenhum plano cadastrado' : 'Nenhum serviço cadastrado', 'Cadastre o que você oferece para montar orçamentos em segundos.')));
  };
  const seg = h('div', { class: 'seg' }, [['servico', 'Serviços'], ['plano', 'Planos']].map(([k, l]) =>
    h('button', { class: ui.catKind === k ? 'on' : '', onclick: (e) => { ui.catKind = k; seg.querySelectorAll('button').forEach((b) => b.classList.remove('on')); e.target.classList.add('on'); draw(); } }, l)));
  main.append(pageHead('Serviços e planos', 'O que você oferece, com valores e prazos. Itens inativos não aparecem para novos orçamentos.',
    h('button', { class: 'btn primary', onclick: () => catalogDrawer({ kind: ui.catKind, unit: ui.catKind === 'plano' ? 'mensal' : 'único', active: true }, draw) }, ic('plus'), ui.catKind === 'plano' ? 'Novo plano' : 'Novo serviço')),
  h('div', { style: 'margin-bottom:16px' }, seg), grid);
  draw();
}
function catalogDrawer(orig, after) {
  const it = clone(orig);
  const isNew = !it.id;
  const featuresField = field('O que está incluso', area(it, 'features', { rows: 5, placeholder: 'Um item por linha' }), 'Aparece como lista de benefícios no orçamento.');
  const body = h('div', { class: 'form' },
    h('div', { class: 'row' }, field('Tipo', sel(it, 'kind', [['servico', 'Serviço'], ['plano', 'Plano']], (v) => { featuresField.hidden = v !== 'plano'; })), field('Categoria', inp(it, 'category', { placeholder: 'Ex.: Audiovisual' }))),
    field('Nome *', inp(it, 'name', { placeholder: 'Ex.: Gestão de redes sociais' })),
    field('Descrição', area(it, 'description', { rows: 3, placeholder: 'Explique em uma ou duas frases o que o cliente recebe.' })),
    h('div', { class: 'row' }, field('Valor', money(it, 'price')), field('Cobrança', sel(it, 'unit', Object.entries(UNITS).map(([k, v]) => [k, v[0].toUpperCase() + v.slice(1)]))), field('Prazo (dias)', inp(it, 'deliveryDays', { type: 'number', min: '0' }))),
    featuresField,
    h('div', { style: 'display:flex;gap:20px;flex-wrap:wrap' }, sw(it, 'active', 'Ativo'), h('label', { class: 'switch' }, h('input', { type: 'checkbox', checked: !!it.featured, onchange: (e) => { it.featured = e.target.checked; } }), 'Destacar como recomendado')));
  featuresField.hidden = it.kind !== 'plano';
  const saveBtn = h('button', { class: 'btn primary', onclick: () => withBusy(saveBtn, async () => {
    if (!String(it.name || '').trim()) throw new Error('Informe o nome.');
    await saveItem('catalog', it); toast('Catálogo atualizado.'); close(); after?.();
  }) }, ic('check'), 'Salvar');
  const close = drawer({ title: isNew ? (it.kind === 'plano' ? 'Novo plano' : 'Novo serviço') : it.name, body, actions: [h('span', { class: 'spacer' }), saveBtn] });
}

/* ======================================================================
   orçamentos — lista
   ====================================================================== */
function pageQuotes(main, a, b) {
  if (a) return quoteEditor(main, a === 'novo' ? null : a, a === 'novo' ? b : null);
  const tbody = h('tbody');
  const draw = () => {
    const q = norm(ui.quoteSearch);
    const list = (S.d.quotes || []).filter((x) => (ui.quoteFilter === 'todos' || x.status === ui.quoteFilter)
      && (!q || norm([x.number, x.clientName, x.clientCompany, x.title, x.slug].join(' ')).includes(q)));
    fill(tbody, ...list.map((x) => h('tr', { class: 'click', onclick: (e) => { if (!e.target.closest('button, label, a')) location.hash = '#/orcamentos/' + x.id; } },
      h('td', {}, h('span', { class: 'strong' }, x.clientName || 'Sem cliente'), h('span', { class: 'sub' }, `${x.number} · ${x.title || 'Sem título'}`)),
      h('td', { class: 'right' }, h('span', { class: 'money' }, quoteValue(x))),
      h('td', {}, quotePill(x)),
      h('td', { class: 'num' }, fmtDate(x.validUntil)),
      h('td', { class: 'right num' }, h('span', { title: x.viewedAt ? 'Última visita: ' + fmtDate(x.viewedAt, { dateStyle: 'short', timeStyle: 'short' }) : '' }, x.views || 0)),
      h('td', {}, sw(x, 'active', '', async (v) => { try { await saveItem('quotes', { ...x, active: v }); toast(v ? 'Link ativado.' : 'Link desativado: o cliente não consegue mais abrir.'); } catch (err) { toast(err.message, 'err'); } })),
      h('td', {}, h('div', { class: 'actions' },
        h('button', { class: 'icon-btn', title: 'Copiar link', onclick: () => copy(quoteUrl(x)) }, ic('link')),
        h('a', { class: 'icon-btn', title: 'Abrir como cliente', href: quoteUrl(x) + '?t=' + encodeURIComponent(S.token), target: '_blank', rel: 'noopener' }, ic('eye')),
        h('button', { class: 'icon-btn', title: 'Duplicar', onclick: () => duplicateQuote(x) }, ic('copy')),
        h('button', { class: 'icon-btn danger', title: 'Excluir', onclick: async () => {
          if (!(await confirmBox({ title: 'Excluir orçamento?', text: `${x.number} será apagado e o link deixa de funcionar.`, ok: 'Excluir', danger: true }))) return;
          await deleteItem('quotes', x.id); toast('Orçamento excluído.'); draw();
        } }, ic('trash')))))));
    if (!list.length) fill(tbody, h('tr', {}, h('td', { colspan: 7 }, emptyState('file-text', 'Nenhum orçamento encontrado', 'Monte um orçamento com seus serviços e envie o link para o cliente.', h('a', { class: 'btn primary sm', href: '#/orcamentos/novo' }, ic('plus'), 'Novo orçamento')))));
  };
  const seg = h('div', { class: 'seg' }, [['todos', 'Todos'], ...Object.entries(QUOTE_STATUS).map(([k, v]) => [k, v.label])].map(([k, l]) =>
    h('button', { class: ui.quoteFilter === k ? 'on' : '', onclick: (e) => { ui.quoteFilter = k; seg.querySelectorAll('button').forEach((bb) => bb.classList.remove('on')); e.target.classList.add('on'); draw(); } }, l)));
  main.append(pageHead('Orçamentos', 'Cada orçamento tem um link próprio para o cliente ver e aprovar.', h('a', { class: 'btn primary', href: '#/orcamentos/novo' }, ic('plus'), 'Novo orçamento')),
    h('section', { class: 'card' },
      h('div', { class: 'toolbar' }, h('label', { class: 'search' }, ic('search'), h('input', { placeholder: 'Buscar por cliente, número ou título…', value: ui.quoteSearch, oninput: (e) => { ui.quoteSearch = e.target.value; draw(); } })), seg),
      h('div', { class: 'table-wrap' }, h('table', { class: 't' }, h('thead', {}, h('tr', {}, h('th', {}, 'Cliente / orçamento'), h('th', { class: 'right' }, 'Valor'), h('th', {}, 'Status'), h('th', {}, 'Validade'), h('th', { class: 'right' }, 'Visitas'), h('th', {}, 'Link ativo'), h('th', {}))), tbody))));
  draw();
}
async function duplicateQuote(x) {
  const { id, number, slug, views, viewedAt, approvedAt, approvedBy, approvedNote, chosenPlan, rejectedAt, rejectReason, createdAt, updatedAt, ...rest } = clone(x);
  const saved = await saveItem('quotes', { ...rest, status: 'rascunho', title: (rest.title || '') + ' (cópia)', validUntil: addDays(todayISO(), Number(S.d.settings.quote.validityDays) || 15) });
  toast('Orçamento duplicado como rascunho.');
  location.hash = '#/orcamentos/' + saved.id;
}

/* ======================================================================
   orçamentos — editor
   ====================================================================== */
function quoteEditor(main, id, clientId) {
  const st = S.d.settings.quote;
  const existing = id ? S.d.quotes.find((x) => x.id === id) : null;
  if (id && !existing) { main.append(emptyState('file-text', 'Orçamento não encontrado')); return; }
  const client = clientId ? S.d.clients.find((c) => c.id === clientId) : null;
  const q = existing ? clone(existing) : {
    status: 'rascunho', active: true, title: '', intro: st.intro, paymentTerms: st.paymentTerms, notes: st.notes,
    validUntil: addDays(todayISO(), Number(st.validityDays) || 15), items: [], plans: [], steps: [], discount: 0, discountType: 'percentual', showPix: true,
    clientId: client?.id || '', clientName: client?.name || '', clientCompany: client?.company || '', slug: client ? slugify(client.company || client.name) : '',
  };
  q.items ||= []; q.plans ||= []; q.steps ||= [];
  let slugTouched = !!existing;
  let dirty = false;

  const summary = h('div', { class: 'card q-block' });
  const touch = () => { dirty = true; drawSummary(); };

  // --- cliente
  const nameInput = inp(q, 'clientName', { placeholder: 'Nome de quem vai receber' }, () => { if (!slugTouched) { q.slug = slugify(q.clientCompany || q.clientName); slugInput.value = q.slug; } touch(); });
  const companyInput = inp(q, 'clientCompany', { placeholder: 'Empresa (opcional)' }, () => { if (!slugTouched) { q.slug = slugify(q.clientCompany || q.clientName); slugInput.value = q.slug; } touch(); });
  const slugInput = inp(q, 'slug', { placeholder: 'nome-do-cliente' }, () => { slugTouched = true; q.slug = slugify(q.slug); touch(); });
  slugInput.addEventListener('blur', () => { slugInput.value = q.slug = slugify(q.slug); drawSummary(); });
  const clientSel = sel(q, 'clientId', [['', '— Selecionar cliente cadastrado —'], ...(S.d.clients || []).map((c) => [c.id, c.company ? `${c.name} · ${c.company}` : c.name])], (v) => {
    const c = S.d.clients.find((x) => x.id === v);
    if (c) { q.clientName = nameInput.value = c.name; q.clientCompany = companyInput.value = c.company || ''; if (!slugTouched) { q.slug = slugInput.value = slugify(c.company || c.name); } }
    touch();
  });

  // --- itens
  const itemsBox = h('div', { class: 'lines' });
  const drawItems = () => {
    fill(itemsBox, ...q.items.map((it, i) => h('div', { class: 'line' },
      h('div', { class: 'line-top' }, inp(it, 'name', { class: 'input', placeholder: 'Nome do item', style: 'font-weight:600' }, touch),
        h('div', { class: 'line-tools' },
          h('button', { class: 'icon-btn', title: 'Subir', disabled: i === 0, onclick: () => { [q.items[i - 1], q.items[i]] = [q.items[i], q.items[i - 1]]; drawItems(); touch(); } }, ic('chevron-up')),
          h('button', { class: 'icon-btn', title: 'Descer', disabled: i === q.items.length - 1, onclick: () => { [q.items[i + 1], q.items[i]] = [q.items[i], q.items[i + 1]]; drawItems(); touch(); } }, ic('chevron-down')),
          h('button', { class: 'icon-btn danger', title: 'Remover', onclick: () => { q.items.splice(i, 1); drawItems(); touch(); } }, ic('trash')))),
      area(it, 'description', { class: 'input', rows: 2, placeholder: 'Descrição (o que está incluso)' }, touch),
      h('div', { class: 'line-grid' },
        field('Qtd.', inp(it, 'qty', { type: 'number', min: '0', step: '1' }, touch)),
        field('Valor unitário', money(it, 'price', touch)),
        field('Cobrança', sel(it, 'unit', Object.entries(UNITS).map(([k, v]) => [k, v[0].toUpperCase() + v.slice(1)]), touch)),
        field('Prazo (dias)', inp(it, 'deliveryDays', { type: 'number', min: '0' }, touch))))));
    if (!q.items.length) fill(itemsBox, h('p', { class: 'hint' }, 'Nenhum item ainda. Adicione serviços do catálogo ou um item personalizado.'));
  };
  const addFromCatalog = (kind) => {
    const list = (S.d.catalog || []).filter((x) => x.active !== false && (x.kind || 'servico') === kind);
    const close = drawer({
      title: kind === 'plano' ? 'Adicionar plano' : 'Adicionar serviço',
      body: list.length ? h('div', { class: 'picker' }, list.map((c) => h('button', { class: 'pick', onclick: () => {
        const base = { name: c.name, description: c.description || '', price: Number(c.price) || 0, unit: c.unit || 'único', deliveryDays: c.deliveryDays || '' };
        if (kind === 'plano') q.plans.push({ ...base, features: c.features || '', featured: !!c.featured }); else q.items.push({ ...base, qty: 1 });
        kind === 'plano' ? drawPlans() : drawItems(); touch(); close(); toast(`"${c.name}" adicionado.`);
      } }, h('div', { class: 'grow' }, h('strong', {}, c.name), h('small', {}, c.description || c.category || '')), h('span', { class: 'money' }, Number(c.price) ? brl(c.price) + (UNIT_SHORT[c.unit] || '') : 'Sem valor'))))
        : emptyState('package', 'Catálogo vazio', 'Cadastre seus serviços e planos em "Serviços e planos".'),
    });
  };

  // --- planos
  const plansBox = h('div', { class: 'lines' });
  const drawPlans = () => {
    fill(plansBox, ...q.plans.map((p, i) => h('div', { class: 'line' },
      h('div', { class: 'line-top' }, inp(p, 'name', { class: 'input', placeholder: 'Nome do plano', style: 'font-weight:600' }, touch),
        h('button', { class: 'icon-btn danger', title: 'Remover', onclick: () => { q.plans.splice(i, 1); drawPlans(); touch(); } }, ic('trash'))),
      area(p, 'features', { class: 'input', rows: 3, placeholder: 'O que está incluso (um por linha)' }, touch),
      h('div', { class: 'row' }, field('Valor', money(p, 'price', touch)), field('Cobrança', sel(p, 'unit', Object.entries(UNITS).map(([k, v]) => [k, v[0].toUpperCase() + v.slice(1)]), touch)),
        h('label', { class: 'switch', style: 'align-self:end;padding-bottom:8px' }, h('input', { type: 'checkbox', checked: !!p.featured, onchange: (e) => { p.featured = e.target.checked; touch(); } }), 'Recomendado')))));
    if (!q.plans.length) fill(plansBox, h('p', { class: 'hint' }, 'Opcional. Com dois ou mais planos, o cliente escolhe um ao aprovar.'));
  };

  // --- etapas
  const stepsBox = h('div', { class: 'lines' });
  const drawSteps = () => {
    fill(stepsBox, ...q.steps.map((s, i) => h('div', { class: 'line', style: 'grid-template-columns:1fr 110px auto;align-items:end' },
      field(`Etapa ${i + 1}`, inp(s, 'title', { placeholder: 'Ex.: Planejamento e roteiro' }, touch)),
      field('Dias', inp(s, 'days', { type: 'number', min: '0' }, touch)),
      h('button', { class: 'icon-btn danger', title: 'Remover', onclick: () => { q.steps.splice(i, 1); drawSteps(); touch(); } }, ic('trash')))));
    if (!q.steps.length) fill(stepsBox, h('p', { class: 'hint' }, 'Opcional. Mostra ao cliente uma linha do tempo de execução.'));
  };

  // --- resumo lateral
  function drawSummary() {
    const t = quoteTotals(q, q.chosenPlan);
    const days = totalDays(q);
    const url = q.slug ? quoteUrl(q) : '';
    fill(summary, 
      h('div', { style: 'display:flex;justify-content:space-between;align-items:center' }, h('div', { class: 'section-title' }, ic('dollar'), 'Resumo'), quotePill(q)),
      h('div', {},
        h('div', { class: 'total-row' }, h('span', {}, 'Itens (pagamento único)'), h('span', { class: 'num' }, brl(t.subtotalOnce))),
        t.discount ? h('div', { class: 'total-row' }, h('span', {}, 'Desconto'), h('span', { class: 'num', style: 'color:var(--ok)' }, '− ' + brl(t.discount))) : null,
        t.monthly ? h('div', { class: 'total-row' }, h('span', {}, 'Recorrente'), h('span', { class: 'num' }, brl(t.monthly) + '/mês')) : null,
        t.hasPlans ? h('div', { class: 'total-row' }, h('span', {}, 'Planos'), h('span', {}, `${q.plans.length} opção(ões)${q.chosenPlan ? ' · escolhido: ' + q.chosenPlan : ''}`)) : null,
        h('div', { class: 'total-row big' }, h('span', {}, 'Total'), h('span', { class: 'num' }, t.once || !t.monthly ? brl(t.once) : brl(t.monthly) + '/mês')),
        t.once && t.monthly ? h('div', { class: 'total-row' }, h('span', {}, '+ mensalidade'), h('span', { class: 'num' }, brl(t.monthly) + '/mês')) : null),
      days ? h('div', { class: 'stat-line' }, h('span', {}, 'Prazo total'), h('b', {}, `${days} dia(s)`)) : null,
      h('div', { class: 'stat-line' }, h('span', {}, 'Validade'), h('b', {}, fmtDate(q.validUntil))),
      existing ? h('div', { class: 'stat-line' }, h('span', {}, 'Visitas do cliente'), h('b', {}, `${existing.views || 0}${existing.viewedAt ? ' · última ' + fmtDate(existing.viewedAt) : ''}`)) : null,
      existing?.status === 'aprovado' ? h('div', { class: 'callout ok' }, ic('check'), h('div', {}, h('strong', {}, 'Aprovado por ' + (existing.approvedBy || 'cliente')), fmtDate(existing.approvedAt, { dateStyle: 'short', timeStyle: 'short' }), existing.chosenPlan ? ' · plano ' + existing.chosenPlan : '', existing.approvedNote ? h('div', { style: 'margin-top:4px' }, '“' + existing.approvedNote + '”') : null)) : null,
      existing?.status === 'recusado' ? h('div', { class: 'callout warn' }, ic('x'), h('div', {}, h('strong', {}, 'Recusado por ' + (existing.approvedBy || 'cliente')), existing.rejectReason || 'Sem motivo informado.')) : null,
      url ? h('div', { class: 'link-box' }, h('code', {}, url.replace(/^https?:\/\//, '')), h('button', { class: 'icon-btn', title: 'Copiar link', onclick: () => copy(url) }, ic('copy'))) : h('p', { class: 'hint' }, 'Informe o cliente para gerar o link.'),
      !q.active ? h('p', { class: 'hint', style: 'color:var(--warn)' }, 'Link desativado: o cliente não consegue abrir.') : null,
      q.status === 'rascunho' ? h('p', { class: 'hint' }, 'Rascunhos só abrem para você. Mude o status para "Enviado" ao mandar para o cliente.') : null,
    );
  }

  const save = async (opts = {}) => {
    if (!q.clientName && !q.clientCompany) throw new Error('Informe o cliente do orçamento.');
    if (!q.items.length && !q.plans.length) throw new Error('Adicione pelo menos um item ou plano.');
    if (opts.send && q.status === 'rascunho') q.status = 'enviado';
    q.slug = slugify(q.slug || q.clientCompany || q.clientName);
    const saved = await saveItem('quotes', q);
    Object.assign(q, saved);
    dirty = false;
    return saved;
  };
  const saveBtn = h('button', { class: 'btn', onclick: () => withBusy(saveBtn, async () => { const s = await save(); toast('Orçamento salvo.'); if (!id) location.hash = '#/orcamentos/' + s.id; else render(); }) }, ic('save'), 'Salvar');
  const sendBtn = h('button', { class: 'btn primary', onclick: () => withBusy(sendBtn, async () => { const s = await save({ send: true }); await copy(quoteUrl(s), 'Salvo e link copiado. É só colar no WhatsApp do cliente.'); if (!id) location.hash = '#/orcamentos/' + s.id; else render(); }) }, ic('send'), 'Salvar e copiar link');
  const previewBtn = h('button', { class: 'btn', onclick: () => withBusy(previewBtn, async () => { const s = dirty || !id ? await save() : q; window.open(quoteUrl(s) + '?t=' + encodeURIComponent(S.token), '_blank'); if (!id) location.hash = '#/orcamentos/' + s.id; }) }, ic('eye'), 'Visualizar');

  const statusSel = sel(q, 'status', Object.entries(QUOTE_STATUS).map(([k, v]) => [k, v.label]), touch);
  const discountBox = h('div', { class: 'row' },
    field('Desconto', inp(q, 'discount', { type: 'number', min: '0', step: '0.01' }, touch), 'Aplicado sobre os itens de pagamento único.'),
    field('Tipo de desconto', sel(q, 'discountType', [['percentual', 'Percentual (%)'], ['valor', 'Valor (R$)']], touch)));

  main.append(
    pageHead(existing ? `${existing.number}` : 'Novo orçamento', existing ? (q.clientCompany || q.clientName) : 'Monte a proposta e envie o link para o cliente.',
      h('a', { class: 'btn ghost', href: '#/orcamentos' }, ic('chevron-left'), 'Voltar'),
      existing && can('financeiro') && existing.status === 'aprovado' ? h('button', { class: 'btn', onclick: () => {
        const t = quoteTotals(existing, existing.chosenPlan);
        txDrawer({ type: 'receita', description: `${existing.number} · ${existing.title || existing.clientName}`, amount: t.once || t.monthly, dueDate: todayISO(), clientId: existing.clientId, quoteId: existing.id, category: 'Serviços', method: 'Pix' });
      } }, ic('dollar'), 'Lançar no financeiro') : null,
      previewBtn, saveBtn, sendBtn),
    h('div', { class: 'q-layout' },
      h('div', { class: 'grid' },
        h('section', { class: 'card q-block' }, h('div', { class: 'section-title' }, ic('user'), 'Cliente'),
          field('Cliente cadastrado', clientSel),
          h('div', { class: 'row' }, field('Nome do cliente', nameInput), field('Empresa', companyInput)),
          h('div', { class: 'row' }, field('Título da proposta', inp(q, 'title', { placeholder: 'Ex.: Gestão de Instagram e produção de Reels' }, touch)), field('Status', statusSel)),
          h('div', { class: 'row' },
            field('Endereço do link', h('div', { class: 'prefix' }, h('em', {}, (domainBase() ? `orcamento.${domainBase()}/` : '/o/')), slugInput), 'Personalize como quiser: só letras, números e hífen.'),
            field('Válido até', inp(q, 'validUntil', { type: 'date' }, touch))),
          sw(q, 'active', 'Link ativo (o cliente consegue abrir)', touch)),
        h('section', { class: 'card q-block' }, h('div', { class: 'section-title' }, ic('message'), 'Mensagem de abertura'),
          area(q, 'intro', { class: 'input', rows: 3 }, touch)),
        h('section', { class: 'card q-block' },
          h('div', { style: 'display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap' }, h('div', { class: 'section-title' }, ic('package'), 'Itens da proposta'),
            h('div', { class: 'page-actions' }, h('button', { class: 'btn sm', onclick: () => addFromCatalog('servico') }, ic('plus'), 'Do catálogo'),
              h('button', { class: 'btn sm', onclick: () => { q.items.push({ name: '', description: '', qty: 1, price: 0, unit: 'único' }); drawItems(); touch(); } }, ic('pen'), 'Item personalizado'))),
          itemsBox, discountBox),
        h('section', { class: 'card q-block' },
          h('div', { style: 'display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap' }, h('div', { class: 'section-title' }, ic('layers'), 'Planos para escolher'),
            h('div', { class: 'page-actions' }, h('button', { class: 'btn sm', onclick: () => addFromCatalog('plano') }, ic('plus'), 'Do catálogo'),
              h('button', { class: 'btn sm', onclick: () => { q.plans.push({ name: '', features: '', price: 0, unit: 'mensal' }); drawPlans(); touch(); } }, ic('pen'), 'Plano personalizado'))),
          plansBox),
        h('section', { class: 'card q-block' },
          h('div', { style: 'display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap' }, h('div', { class: 'section-title' }, ic('clock'), 'Etapas e prazos'),
            h('button', { class: 'btn sm', onclick: () => { q.steps.push({ title: '', days: '' }); drawSteps(); touch(); } }, ic('plus'), 'Adicionar etapa')),
          stepsBox,
          field('Prazo de entrega (texto livre)', inp(q, 'deliveryText', { placeholder: 'Ex.: Primeira entrega em até 7 dias úteis após a aprovação' }, touch))),
        h('section', { class: 'card q-block' }, h('div', { class: 'section-title' }, ic('shield'), 'Condições'),
          field('Forma de pagamento', area(q, 'paymentTerms', { rows: 2 }, touch)),
          field('Observações', area(q, 'notes', { rows: 3 }, touch)),
          h('label', { class: 'switch' }, h('input', { type: 'checkbox', checked: q.showPix !== false, onchange: (e) => { q.showPix = e.target.checked; touch(); } }), 'Mostrar a chave Pix da empresa no orçamento'))),
      h('div', { class: 'q-side' }, summary)));
  drawItems(); drawPlans(); drawSteps(); drawSummary();
}

/* ======================================================================
   financeiro
   ====================================================================== */
function pageFinance(main, a) {
  const tbody = h('tbody'), totals = h('div', { class: 'kpis' }), label = h('strong', {});
  const draw = () => {
    label.textContent = monthLabel(ui.finMonth).replace(/^./, (c) => c.toUpperCase());
    const all = (S.d.transactions || []).filter((t) => monthKey(t.dueDate || t.paidAt) === ui.finMonth);
    const list = all.filter((t) => (ui.finType === 'todos' || t.type === ui.finType) && (ui.finStatus === 'todos' || txStatus(t) === ui.finStatus))
      .sort((x, y) => String(x.dueDate || x.paidAt).localeCompare(String(y.dueDate || y.paidAt)));
    const inc = all.filter((t) => t.type === 'receita'), exp = all.filter((t) => t.type === 'despesa');
    fill(totals, 
      kpi('Receitas', brl(sum(inc, (t) => t.amount)), `${brl(sum(inc.filter((t) => t.paidAt), (t) => t.amount))} recebido`, 'trending-up', 'ok'),
      kpi('Despesas', brl(sum(exp, (t) => t.amount)), `${brl(sum(exp.filter((t) => t.paidAt), (t) => t.amount))} pago`, 'trending-down', 'warn'),
      kpi('Resultado previsto', brl(sum(inc, (t) => t.amount) - sum(exp, (t) => t.amount)), 'receitas − despesas do mês', 'chart'),
      kpi('Em atraso', brl(sum(all.filter((t) => txStatus(t) === 'atrasado'), (t) => t.amount)), `${all.filter((t) => txStatus(t) === 'atrasado').length} lançamento(s)`, 'alert', 'bad'));
    fill(tbody, ...list.map((t) => h('tr', { class: 'click', onclick: (e) => { if (!e.target.closest('button')) txDrawer(t); } },
      h('td', { class: 'num' }, fmtDate(t.dueDate || t.paidAt)),
      h('td', {}, h('span', { class: 'strong' }, t.description), h('span', { class: 'sub' }, [clientName(t.clientId), t.installment].filter(Boolean).join(' · '))),
      h('td', {}, t.category || '—'),
      h('td', {}, accountName(t.accountId) || '—', h('span', { class: 'sub' }, t.method || '')),
      h('td', { class: 'right' }, h('span', { class: 'money ' + (t.type === 'receita' ? 'in' : 'out') }, (t.type === 'receita' ? '+ ' : '− ') + brl(t.amount))),
      h('td', {}, txPill(t)),
      h('td', {}, h('div', { class: 'actions' },
        h('button', { class: 'btn sm', onclick: async () => {
          try { await saveItem('transactions', { ...t, paidAt: t.paidAt ? '' : todayISO() }); toast(t.paidAt ? 'Marcado como pendente.' : (t.type === 'receita' ? 'Recebimento registrado.' : 'Pagamento registrado.')); draw(); } catch (err) { toast(err.message, 'err'); }
        } }, t.paidAt ? 'Desfazer' : (t.type === 'receita' ? 'Receber' : 'Pagar')),
        h('button', { class: 'icon-btn danger', title: 'Excluir', onclick: async () => {
          if (!(await confirmBox({ title: 'Excluir lançamento?', text: t.description, ok: 'Excluir', danger: true }))) return;
          await deleteItem('transactions', t.id); toast('Lançamento excluído.'); draw();
        } }, ic('trash')))))));
    if (!list.length) fill(tbody, h('tr', {}, h('td', { colspan: 7 }, emptyState('dollar', 'Nenhum lançamento neste mês', 'Registre receitas e despesas para acompanhar o caixa.'))));
  };
  const segOf = (key, opts) => { const s = h('div', { class: 'seg' }, opts.map(([k, l]) => h('button', { class: ui[key] === k ? 'on' : '', onclick: (e) => { ui[key] = k; s.querySelectorAll('button').forEach((b) => b.classList.remove('on')); e.target.classList.add('on'); draw(); } }, l))); return s; };
  const shift = (n) => { ui.finMonth = monthKey(addMonths(ui.finMonth + '-15', n)); draw(); };
  main.append(
    pageHead('Lançamentos', 'Contas a receber e a pagar, mês a mês.',
      h('button', { class: 'btn', onclick: () => txDrawer({ type: 'despesa', dueDate: todayISO() }, draw) }, ic('trending-down'), 'Nova despesa'),
      h('button', { class: 'btn primary', onclick: () => txDrawer({ type: 'receita', dueDate: todayISO() }, draw) }, ic('plus'), 'Nova receita')),
    totals,
    h('section', { class: 'card' },
      h('div', { class: 'toolbar' },
        h('div', { class: 'month-nav' }, h('button', { class: 'icon-btn', 'aria-label': 'Mês anterior', onclick: () => shift(-1) }, ic('chevron-left')), label, h('button', { class: 'icon-btn', 'aria-label': 'Próximo mês', onclick: () => shift(1) }, ic('chevron-right'))),
        segOf('finType', [['todos', 'Tudo'], ['receita', 'Receitas'], ['despesa', 'Despesas']]),
        segOf('finStatus', [['todos', 'Todos'], ['pendente', 'Pendentes'], ['atrasado', 'Atrasados'], ['pago', 'Pagos']])),
      h('div', { class: 'table-wrap' }, h('table', { class: 't' }, h('thead', {}, h('tr', {}, h('th', {}, 'Vencimento'), h('th', {}, 'Descrição'), h('th', {}, 'Categoria'), h('th', {}, 'Conta'), h('th', { class: 'right' }, 'Valor'), h('th', {}, 'Status'), h('th', {}))), tbody))));
  draw();
  if (a === 'nova-receita') txDrawer({ type: 'receita', dueDate: todayISO() }, draw);
}

function txDrawer(orig, after) {
  const t = clone(orig);
  const isNew = !t.id;
  t.accountId ||= S.d.accounts?.[0]?.id || '';
  const rep = { times: 1 };
  const cats = () => (t.type === 'despesa' ? S.d.settings.finance.expenseCategories : S.d.settings.finance.incomeCategories);
  const catWrap = h('div');
  const drawCat = () => fill(catWrap, field('Categoria', sel(t, 'category', [['', 'Selecione'], ...cats()])));
  drawCat();
  const paid = { on: !!t.paidAt };
  const paidDate = inp(t, 'paidAt', { type: 'date' });
  const paidField = field(t.type === 'despesa' ? 'Data do pagamento' : 'Data do recebimento', paidDate);
  paidField.hidden = !paid.on;
  const body = h('div', { class: 'form' },
    field('Tipo', sel(t, 'type', [['receita', 'Receita (entrada)'], ['despesa', 'Despesa (saída)']], () => { t.category = ''; drawCat(); })),
    field('Descrição *', inp(t, 'description', { placeholder: t.type === 'despesa' ? 'Ex.: Assinatura do Canva' : 'Ex.: Gestão de redes — Bella Pele' })),
    h('div', { class: 'row' }, field('Valor *', money(t, 'amount')), field('Vencimento', inp(t, 'dueDate', { type: 'date' }))),
    h('div', { class: 'row' }, catWrap, field('Conta', sel(t, 'accountId', [['', 'Sem conta'], ...(S.d.accounts || []).map((a) => [a.id, a.name])]))),
    h('div', { class: 'row' }, field('Cliente', sel(t, 'clientId', [['', 'Nenhum'], ...(S.d.clients || []).map((c) => [c.id, c.name])])), field('Forma de pagamento', sel(t, 'method', [['', 'Selecione'], ...METHODS]))),
    h('label', { class: 'switch' }, h('input', { type: 'checkbox', checked: paid.on, onchange: (e) => { paid.on = e.target.checked; paidField.hidden = !paid.on; if (paid.on && !t.paidAt) { t.paidAt = t.dueDate || todayISO(); paidDate.value = t.paidAt; } } }), t.type === 'despesa' ? 'Já foi pago' : 'Já foi recebido'),
    paidField,
    isNew ? field('Repetir', sel(rep, 'times', [[1, 'Não repetir'], ...[2, 3, 4, 5, 6, 10, 12].map((n) => [n, `Mensalmente, ${n} vezes`])]), 'Útil para mensalidades e parcelas. Cada mês vira um lançamento.') : null,
    field('Observações', area(t, 'notes', { rows: 3 })));
  const saveBtn = h('button', { class: 'btn primary', onclick: () => withBusy(saveBtn, async () => {
    if (!String(t.description || '').trim()) throw new Error('Informe a descrição.');
    if (!(Number(t.amount) > 0)) throw new Error('Informe um valor maior que zero.');
    if (!paid.on) t.paidAt = '';
    const n = Number(rep.times) || 1;
    if (isNew && n > 1) {
      const base = t.dueDate || todayISO();
      for (let i = 0; i < n; i++) await saveItem('transactions', { ...t, dueDate: addMonths(base, i), paidAt: i === 0 ? t.paidAt : '', installment: `${i + 1}/${n}` });
    } else await saveItem('transactions', t);
    toast(isNew ? (n > 1 ? `${n} lançamentos criados.` : 'Lançamento criado.') : 'Lançamento atualizado.');
    close(); after ? after() : render();
  }) }, ic('check'), 'Salvar');
  const close = drawer({
    title: isNew ? (t.type === 'despesa' ? 'Nova despesa' : 'Nova receita') : 'Editar lançamento', body,
    actions: [!isNew && h('button', { class: 'btn danger', onclick: async () => {
      if (!(await confirmBox({ title: 'Excluir lançamento?', text: t.description, ok: 'Excluir', danger: true }))) return;
      await deleteItem('transactions', t.id); toast('Lançamento excluído.'); close(); after ? after() : render();
    } }, ic('trash'), 'Excluir'), h('span', { class: 'spacer' }), saveBtn].filter(Boolean),
  });
}

/* ======================================================================
   contas
   ====================================================================== */
function pageAccounts(main) {
  const accs = S.d.accounts || [];
  const total = sum(accs, accountBalance);
  main.append(pageHead('Contas', 'Saldo atual = saldo inicial + recebimentos − pagamentos registrados em cada conta.',
    h('button', { class: 'btn primary', onclick: () => accountDrawer({ type: 'Conta corrente', color: '#7C3AED', initialBalance: 0, active: true }) }, ic('plus'), 'Nova conta')),
  h('div', { class: 'kpis' }, kpi('Saldo total', brl(total), `${accs.length} conta(s)`, 'wallet', total < 0 ? 'bad' : 'ok')),
  accs.length ? h('div', { class: 'acc-grid' }, accs.map((acc) => {
    const bal = accountBalance(acc);
    const moves = (S.d.transactions || []).filter((t) => t.accountId === acc.id && t.paidAt).length;
    return h('article', { class: 'card acc', style: `--c:${acc.color || '#7C3AED'}` },
      h('div', { style: 'display:flex;justify-content:space-between;align-items:center' }, h('strong', {}, acc.name), h('button', { class: 'icon-btn', title: 'Editar', onclick: () => accountDrawer(acc) }, ic('pen'))),
      h('span', { class: 'hint' }, acc.type || ''),
      h('div', { class: 'bal', style: bal < 0 ? 'color:var(--bad)' : '' }, brl(bal)),
      h('small', { class: 'hint' }, `Saldo inicial ${brl(acc.initialBalance)} · ${moves} movimentação(ões)`));
  })) : h('div', { class: 'card' }, emptyState('wallet', 'Nenhuma conta cadastrada', 'Cadastre suas contas bancárias e carteiras.')));
}
function accountDrawer(orig) {
  const acc = clone(orig);
  const isNew = !acc.id;
  const body = h('div', { class: 'form' },
    field('Nome da conta *', inp(acc, 'name', { placeholder: 'Ex.: Nubank PJ' })),
    h('div', { class: 'row' }, field('Tipo', sel(acc, 'type', ACC_TYPES)), field('Saldo inicial', money(acc, 'initialBalance'))),
    field('Cor', h('input', { type: 'color', value: acc.color || '#7C3AED', oninput: (e) => { acc.color = e.target.value; }, style: 'height:42px;padding:4px' })));
  const saveBtn = h('button', { class: 'btn primary', onclick: () => withBusy(saveBtn, async () => {
    if (!String(acc.name || '').trim()) throw new Error('Informe o nome da conta.');
    await saveItem('accounts', acc); toast('Conta salva.'); close(); render();
  }) }, ic('check'), 'Salvar');
  const close = drawer({
    title: isNew ? 'Nova conta' : acc.name, body,
    actions: [!isNew && h('button', { class: 'btn danger', onclick: async () => {
      if (!(await confirmBox({ title: 'Excluir conta?', text: 'Os lançamentos continuam salvos, mas ficam sem conta.', ok: 'Excluir', danger: true }))) return;
      await deleteItem('accounts', acc.id); toast('Conta excluída.'); close(); render();
    } }, ic('trash'), 'Excluir'), h('span', { class: 'spacer' }), saveBtn].filter(Boolean),
  });
}

/* ======================================================================
   relatórios
   ====================================================================== */
const REPORTS = {
  geral: 'Resumo financeiro',
  categorias: 'Receitas e despesas por categoria',
  pendencias: 'Contas a receber e a pagar',
  orcamentos: 'Orçamentos e conversão',
  clientes: 'Clientes',
};
function periodRange(p, from, to) {
  const t = todayISO(), mk = monthKey(t);
  if (p === 'mes') return [mk + '-01', addDays(addMonths(mk + '-01', 1), -1)];
  if (p === 'mes-anterior') { const s = addMonths(mk + '-01', -1); return [s, addDays(mk + '-01', -1)]; }
  if (p === 'trimestre') return [addMonths(mk + '-01', -2), addDays(addMonths(mk + '-01', 1), -1)];
  if (p === 'ano') return [t.slice(0, 4) + '-01-01', t.slice(0, 4) + '-12-31'];
  return [from || mk + '-01', to || t];
}
function pageReports(main) {
  const f = { type: 'geral', period: 'mes', from: '', to: '' };
  const out = h('div');
  const custom = h('div', { class: 'row' }, field('De', inp(f, 'from', { type: 'date' })), field('Até', inp(f, 'to', { type: 'date' })));
  custom.hidden = true;
  const generate = () => { const r = buildReport(f); fill(out, r.el); out.dataset.csv = JSON.stringify(r.csv); };
  main.append(pageHead('Relatórios', 'Escolha o tipo e o período. Você pode imprimir, salvar em PDF ou exportar para planilha.'),
    h('section', { class: 'card card-pad no-print', style: 'margin-bottom:16px' }, h('div', { class: 'form' },
      h('div', { class: 'row' },
        field('Relatório', sel(f, 'type', Object.entries(REPORTS), generate)),
        field('Período', sel(f, 'period', [['mes', 'Este mês'], ['mes-anterior', 'Mês passado'], ['trimestre', 'Últimos 3 meses'], ['ano', 'Este ano'], ['custom', 'Personalizado']], (v) => { custom.hidden = v !== 'custom'; generate(); }))),
      custom,
      h('div', { class: 'page-actions' },
        h('button', { class: 'btn primary', onclick: generate }, ic('refresh'), 'Gerar relatório'),
        h('button', { class: 'btn', onclick: () => window.print() }, ic('printer'), 'Imprimir / PDF'),
        h('button', { class: 'btn', onclick: () => { const rows = JSON.parse(out.dataset.csv || '[]'); downloadCsv(rows, `relatorio-${f.type}-${todayISO()}.csv`); } }, ic('download'), 'Exportar planilha (CSV)')))),
    out);
  generate();
}
function downloadCsv(rows, name) {
  if (!rows.length) return toast('Nada para exportar neste período.', 'err');
  const csv = '﻿' + rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';')).join('\n');
  const a = h('a', { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })), download: name });
  document.body.append(a); a.click(); a.remove();
}
function buildReport(f) {
  const [from, to] = periodRange(f.period, f.from, f.to);
  const inRange = (d) => d && d >= from && d <= to;
  const company = S.d.settings.company;
  const tx = S.d.transactions || [];
  const table = (head, rows, alignRight = []) => h('div', { class: 'table-wrap' }, h('table', { class: 't' },
    h('thead', {}, h('tr', {}, head.map((x, i) => h('th', { class: alignRight.includes(i) ? 'right' : '' }, x)))),
    h('tbody', {}, rows.length ? rows.map((r) => h('tr', {}, r.map((c, i) => h('td', { class: alignRight.includes(i) ? 'right num' : '' }, c)))) : h('tr', {}, h('td', { colspan: head.length, class: 'hint' }, 'Nenhum registro no período.')))));
  const body = [];
  let csv = [];

  if (f.type === 'geral' || f.type === 'categorias') {
    const paid = tx.filter((t) => inRange(t.paidAt));
    const inc = paid.filter((t) => t.type === 'receita'), exp = paid.filter((t) => t.type === 'despesa');
    body.push(h('div', { class: 'kpis' }, kpi('Recebido', brl(sum(inc, (t) => t.amount)), `${inc.length} recebimento(s)`, 'trending-up', 'ok'),
      kpi('Pago', brl(sum(exp, (t) => t.amount)), `${exp.length} pagamento(s)`, 'trending-down', 'warn'),
      kpi('Resultado', brl(sum(inc, (t) => t.amount) - sum(exp, (t) => t.amount)), 'recebido − pago', 'chart')));
    const byCat = (list) => {
      const m = {};
      list.forEach((t) => { m[t.category || 'Sem categoria'] = (m[t.category || 'Sem categoria'] || 0) + Number(t.amount); });
      const total = sum(Object.values(m), (v) => v) || 1;
      return Object.entries(m).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, h('div', { class: 'bar-cell' }, h('i', { style: `width:${Math.round((v / total) * 140)}px` }), Math.round((v / total) * 100) + '%'), brl(v)]);
    };
    body.push(h('div', { class: 'two' }, h('div', {}, h('h3', {}, 'Receitas por categoria'), table(['Categoria', 'Participação', 'Valor'], byCat(inc), [2])),
      h('div', {}, h('h3', {}, 'Despesas por categoria'), table(['Categoria', 'Participação', 'Valor'], byCat(exp), [2]))));
    if (f.type === 'geral') body.push(h('div', {}, h('h3', {}, 'Movimentações'), table(['Data', 'Descrição', 'Categoria', 'Conta', 'Valor'],
      [...paid].sort((a, b) => a.paidAt.localeCompare(b.paidAt)).map((t) => [fmtDate(t.paidAt), t.description, t.category || '—', accountName(t.accountId) || '—', (t.type === 'receita' ? '+ ' : '− ') + brl(t.amount)]), [4])));
    csv = [['Data', 'Tipo', 'Descrição', 'Categoria', 'Conta', 'Cliente', 'Valor'], ...paid.map((t) => [t.paidAt, t.type, t.description, t.category, accountName(t.accountId), clientName(t.clientId), String(t.type === 'despesa' ? -t.amount : t.amount).replace('.', ',')])];
  }
  if (f.type === 'pendencias') {
    const open = tx.filter((t) => !t.paidAt && t.dueDate && t.dueDate <= to).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    const rec = open.filter((t) => t.type === 'receita'), pay = open.filter((t) => t.type === 'despesa');
    body.push(h('div', { class: 'kpis' }, kpi('A receber', brl(sum(rec, (t) => t.amount)), `${rec.filter((t) => t.dueDate < todayISO()).length} em atraso`, 'trending-up', 'ok'),
      kpi('A pagar', brl(sum(pay, (t) => t.amount)), `${pay.filter((t) => t.dueDate < todayISO()).length} em atraso`, 'trending-down', 'warn')));
    const rows = (list) => list.map((t) => [fmtDate(t.dueDate), t.description, clientName(t.clientId) || '—', t.dueDate < todayISO() ? 'Atrasado' : 'Pendente', brl(t.amount)]);
    body.push(h('div', {}, h('h3', {}, 'A receber'), table(['Vencimento', 'Descrição', 'Cliente', 'Situação', 'Valor'], rows(rec), [4])),
      h('div', {}, h('h3', {}, 'A pagar'), table(['Vencimento', 'Descrição', 'Cliente', 'Situação', 'Valor'], rows(pay), [4])));
    csv = [['Vencimento', 'Tipo', 'Descrição', 'Cliente', 'Situação', 'Valor'], ...open.map((t) => [t.dueDate, t.type, t.description, clientName(t.clientId), t.dueDate < todayISO() ? 'Atrasado' : 'Pendente', String(t.amount).replace('.', ',')])];
  }
  if (f.type === 'orcamentos') {
    const qs = (S.d.quotes || []).filter((q) => inRange(String(q.createdAt).slice(0, 10)));
    const won = qs.filter((q) => q.status === 'aprovado'), lost = qs.filter((q) => q.status === 'recusado');
    body.push(h('div', { class: 'kpis' }, kpi('Orçamentos criados', String(qs.length), `${qs.filter((q) => q.views).length} visualizado(s) pelo cliente`, 'file-text'),
      kpi('Aprovados', String(won.length), brl(sum(won, (q) => quoteTotals(q, q.chosenPlan).once)) + ' em valor único', 'check', 'ok'),
      kpi('Conversão', won.length + lost.length ? Math.round((won.length / (won.length + lost.length)) * 100) + '%' : '—', `${lost.length} recusado(s)`, 'award')));
    body.push(table(['Número', 'Cliente', 'Título', 'Status', 'Visitas', 'Valor'], qs.map((q) => [q.number, q.clientName || '—', q.title || '—', (QUOTE_STATUS[q.status] || {}).label || q.status, q.views || 0, quoteValue(q)]), [4, 5]));
    csv = [['Número', 'Cliente', 'Empresa', 'Título', 'Status', 'Criado em', 'Visitas', 'Valor único', 'Valor mensal'], ...qs.map((q) => { const t = quoteTotals(q, q.chosenPlan); return [q.number, q.clientName, q.clientCompany, q.title, q.status, String(q.createdAt).slice(0, 10), q.views || 0, String(t.once).replace('.', ','), String(t.monthly).replace('.', ',')]; })];
  }
  if (f.type === 'clientes') {
    const cs = S.d.clients || [];
    const novos = cs.filter((c) => inRange(String(c.createdAt).slice(0, 10)));
    body.push(h('div', { class: 'kpis' }, Object.entries(CLIENT_STATUS).map(([k, v]) => kpi(v[0], String(cs.filter((c) => (c.status || 'lead') === k).length), 'no total', 'users')),
      kpi('Novos no período', String(novos.length), fmtDate(from) + ' a ' + fmtDate(to), 'plus', 'ok')));
    body.push(table(['Cliente', 'Empresa', 'Status', 'Origem', 'Recebido no período'], cs.map((c) => [c.name, c.company || '—', (CLIENT_STATUS[c.status] || CLIENT_STATUS.lead)[0], c.source || '—',
      brl(sum(tx.filter((t) => t.clientId === c.id && t.type === 'receita' && inRange(t.paidAt)), (t) => t.amount))]), [4]));
    csv = [['Cliente', 'Empresa', 'Telefone', 'E-mail', 'Status', 'Origem', 'Cadastrado em'], ...cs.map((c) => [c.name, c.company, c.phone, c.email, c.status, c.source, String(c.createdAt).slice(0, 10)])];
  }
  const el = h('article', { class: 'card report' },
    h('header', { class: 'report-head' }, h('div', {}, h('small', { class: 'hint' }, company.name), h('h2', {}, REPORTS[f.type])),
      h('div', { style: 'text-align:right' }, h('strong', {}, `${fmtDate(from)} a ${fmtDate(to)}`), h('div', { class: 'hint' }, 'Gerado em ' + new Date().toLocaleString('pt-BR')))),
    body);
  return { el, csv };
}

/* ======================================================================
   configurações
   ====================================================================== */
const SETTINGS_TABS = [
  ['empresa', 'Empresa', 'briefcase'], ['orcamentos', 'Orçamentos', 'file-text'], ['financeiro', 'Financeiro', 'dollar'],
  ['usuarios', 'Usuários e acessos', 'users'], ['dominios', 'Domínios', 'globe'], ['seguranca', 'Segurança', 'lock'],
];
function pageSettings(main, tab = 'empresa') {
  if (!SETTINGS_TABS.some(([k]) => k === tab)) tab = 'empresa';
  main.append(pageHead('Configurações', 'Dados da empresa, padrões, acessos e domínios.'),
    h('nav', { class: 'tabs' }, SETTINGS_TABS.map(([k, l, i]) => h('a', { href: '#/config/' + k, class: tab === k ? 'on' : '' }, ic(i), l))));
  ({ empresa: setCompany, orcamentos: setQuoteDefaults, financeiro: setFinance, usuarios: setUsers, dominios: setDomains, seguranca: setSecurity })[tab](main);
}
async function saveSettings(patch, btn) {
  await withBusy(btn, async () => {
    const { settings } = await api('settings', 'save', { item: patch });
    S.d.settings = settings;
    toast('Configurações salvas.');
  });
}
function setCompany(main) {
  const c = clone(S.d.settings.company);
  const logo = h('div', { style: 'display:flex;gap:14px;align-items:center' });
  const drawLogo = () => fill(logo, 
    h('span', { class: 'brand-mark', style: 'width:64px;height:64px;font-size:1.6rem;border-radius:16px' }, c.logo ? h('img', { src: c.logo, alt: 'Logo' }) : initials(c.name)[0]),
    h('div', { class: 'page-actions' },
      h('label', { class: 'btn sm' }, ic('upload'), 'Enviar logo', h('input', { type: 'file', accept: 'image/*', hidden: true, onchange: (e) => uploadImage(e.target.files[0], (url) => { c.logo = url; drawLogo(); }) })),
      c.logo && h('button', { class: 'btn sm ghost', onclick: () => { c.logo = ''; drawLogo(); } }, 'Remover')));
  drawLogo();
  const btn = h('button', { class: 'btn primary', onclick: () => saveSettings({ company: c }, btn).then(render) }, ic('check'), 'Salvar');
  main.append(h('section', { class: 'card card-pad' }, h('div', { class: 'form' },
    field('Logo (aparece no CRM e nos orçamentos)', logo),
    h('div', { class: 'row' }, field('Nome da empresa', inp(c, 'name')), field('Slogan', inp(c, 'tagline'))),
    h('div', { class: 'row' }, field('Responsável', inp(c, 'owner')), field('CNPJ / CPF', inp(c, 'document'))),
    h('div', { class: 'row' }, field('WhatsApp', inp(c, 'whatsapp', { placeholder: '5511999999999' }), 'Com DDI e DDD, só números. Usado no botão do orçamento.'), field('Telefone', inp(c, 'phone'))),
    h('div', { class: 'row' }, field('E-mail', inp(c, 'email', { type: 'email' })), field('Instagram', inp(c, 'instagram'))),
    h('div', { class: 'row' }, field('Site', inp(c, 'website', { placeholder: 'petricellidigital.com.br' })), field('Chave Pix', inp(c, 'pix'), 'Aparece nos orçamentos quando a opção estiver ligada.')),
    field('Endereço', inp(c, 'address')),
    h('div', { class: 'page-actions' }, btn))));
}
async function uploadImage(file, done) {
  if (!file) return;
  if (file.size > 3_000_000) return toast('Imagem muito grande. Use um arquivo de até 3 MB.', 'err');
  const dataUrl = await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(file); });
  try {
    const res = await fetch('/api/upload', { method: 'POST', headers: { 'content-type': 'application/json', 'x-admin-token': S.token }, body: JSON.stringify({ name: file.name, dataUrl }) });
    const j = await res.json();
    if (!res.ok) throw new Error(j.error || 'Falha no envio.');
    done(j.url);
    toast('Imagem enviada. Clique em Salvar para aplicar.');
  } catch (err) { toast(err.message, 'err'); }
}
function setQuoteDefaults(main) {
  const q = clone(S.d.settings.quote);
  const btn = h('button', { class: 'btn primary', onclick: () => saveSettings({ quote: q }, btn) }, ic('check'), 'Salvar');
  main.append(h('section', { class: 'card card-pad' }, h('div', { class: 'form' },
    h('p', { class: 'hint' }, 'Textos que já vêm preenchidos em cada novo orçamento. Você pode mudar em cada proposta.'),
    field('Validade padrão (dias)', inp(q, 'validityDays', { type: 'number', min: '1', style: 'max-width:160px' })),
    field('Mensagem de abertura', area(q, 'intro', { rows: 3 })),
    field('Forma de pagamento', area(q, 'paymentTerms', { rows: 2 })),
    field('Observações', area(q, 'notes', { rows: 3 })),
    field('Mensagem final (rodapé do orçamento)', area(q, 'footer', { rows: 2 })),
    h('div', { class: 'page-actions' }, btn))));
}
function setFinance(main) {
  const f = { inc: S.d.settings.finance.incomeCategories.join('\n'), exp: S.d.settings.finance.expenseCategories.join('\n') };
  const lines = (s) => s.split('\n').map((x) => x.trim()).filter(Boolean);
  const btn = h('button', { class: 'btn primary', onclick: () => saveSettings({ finance: { incomeCategories: lines(f.inc), expenseCategories: lines(f.exp) } }, btn) }, ic('check'), 'Salvar');
  main.append(h('section', { class: 'card card-pad' }, h('div', { class: 'form' },
    h('div', { class: 'row' }, field('Categorias de receita', area(f, 'inc', { rows: 8 }), 'Uma por linha.'), field('Categorias de despesa', area(f, 'exp', { rows: 8 }), 'Uma por linha.')),
    h('div', { class: 'page-actions' }, btn))));
}
function setUsers(main) {
  const users = S.d.users || [];
  const roleList = h('div', { class: 'grid', style: 'grid-template-columns:repeat(auto-fit,minmax(200px,1fr))' }, Object.entries(S.roles).map(([k, r]) => h('div', { class: 'card card-pad', style: 'box-shadow:none' },
    h('strong', {}, r.label), h('p', { class: 'hint' }, ({ admin: 'Acesso total: CRM, financeiro, editor do site, usuários e domínios.', comercial: 'Clientes, orçamentos e catálogo.', financeiro: 'Clientes, orçamentos, catálogo, financeiro e relatórios.', editor: 'Somente o editor do site (editar.).' })[k]))));
  main.append(
    !users.length ? h('div', { class: 'callout', style: 'margin-bottom:16px' }, ic('key'), h('div', {}, h('strong', {}, 'Nenhum usuário cadastrado ainda'), 'Hoje o acesso é pelo usuário "admin" com a senha inicial. Ao trocar a senha em Segurança ou cadastrar o primeiro usuário, a senha inicial deixa de funcionar.')) : null,
    h('section', { class: 'card', style: 'margin-bottom:16px' },
      h('div', { class: 'card-head' }, h('div', {}, h('h2', {}, 'Usuários'), h('p', {}, 'Quem pode entrar no CRM e no editor do site.')), h('button', { class: 'btn primary sm', onclick: () => userDrawer({ role: 'comercial', active: true }) }, ic('plus'), 'Novo usuário')),
      users.length ? h('div', { class: 'table-wrap' }, h('table', { class: 't' }, h('thead', {}, h('tr', {}, h('th', {}, 'Nome'), h('th', {}, 'Usuário'), h('th', {}, 'Perfil'), h('th', {}, 'Situação'), h('th', {}))),
        h('tbody', {}, users.map((u) => h('tr', { class: 'click', onclick: () => userDrawer(u) }, h('td', { class: 'strong' }, u.name), h('td', {}, u.username), h('td', {}, S.roles[u.role]?.label || u.role), h('td', {}, u.active ? pill('Ativo', 'ok') : pill('Bloqueado', 'bad')), h('td', { class: 'right' }, ic('chevron-right')))))))
        : emptyState('users', 'Só o acesso inicial', 'Cadastre usuários para cada pessoa da equipe.')),
    h('div', { class: 'section-title', style: 'margin-bottom:10px' }, ic('shield'), 'Perfis de acesso'), roleList);
}
function userDrawer(orig) {
  const u = { ...clone(orig), password: '' };
  const isNew = !u.id;
  const body = h('div', { class: 'form' },
    field('Nome', inp(u, 'name', { placeholder: 'Nome da pessoa' })),
    field('Usuário de acesso', inp(u, 'username', { placeholder: 'ex.: sabrina', autocomplete: 'off' }), 'Letras minúsculas, sem espaços.'),
    field('Perfil', sel(u, 'role', Object.entries(S.roles).map(([k, r]) => [k, r.label]))),
    field(isNew ? 'Senha' : 'Nova senha (deixe em branco para manter)', inp(u, 'password', { type: 'password', autocomplete: 'new-password' }), 'Mínimo de 6 caracteres.'),
    sw(u, 'active', 'Acesso liberado'));
  const saveBtn = h('button', { class: 'btn primary', onclick: () => withBusy(saveBtn, async () => {
    const { users } = await api('users', 'save', { item: u });
    S.d.users = users; toast('Usuário salvo.'); close(); render();
  }) }, ic('check'), 'Salvar');
  const close = drawer({
    title: isNew ? 'Novo usuário' : u.name, body,
    actions: [!isNew && h('button', { class: 'btn danger', onclick: async () => {
      if (!(await confirmBox({ title: 'Excluir usuário?', text: `${u.name} perde o acesso imediatamente.`, ok: 'Excluir', danger: true }))) return;
      try { const { users } = await api('users', 'delete', { id: u.id }); S.d.users = users; toast('Usuário excluído.'); close(); render(); } catch (err) { toast(err.message, 'err'); }
    } }, ic('trash'), 'Excluir'), h('span', { class: 'spacer' }), saveBtn].filter(Boolean),
  });
}
function setDomains(main) {
  const d = clone(S.d.settings.domains);
  const SUBS = [['', 'Site de vendas'], ['www', 'Site de vendas'], ['admin', 'CRM (este painel)'], ['editar', 'Editor do site'], ['orcamento', 'Orçamentos dos clientes']];
  const status = {};
  const hostsBody = h('tbody');
  const drawHosts = () => fill(hostsBody, ...d.list.flatMap((dom) => SUBS.map(([s, role]) => {
    const host = s ? `${s}.${dom}` : dom;
    const st = status[host];
    return h('tr', {}, h('td', {}, h('a', { href: 'https://' + host, target: '_blank', rel: 'noopener', class: 'strong' }, host)), h('td', {}, role),
      h('td', {}, st ? pill(st.label, st.status === 'ok' || st.ok ? 'ok' : st.status === 'other' ? 'warn' : 'bad') : h('span', { class: 'hint' }, 'Não verificado')));
  })));
  drawHosts();
  const listBox = h('div', { class: 'lines' });
  const drawList = () => fill(listBox, ...d.list.map((dom, i) => h('div', { style: 'display:flex;gap:8px;align-items:center' },
    h('input', { class: 'input', value: dom, oninput: (e) => { d.list[i] = e.target.value.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, ''); } }),
    h('label', { class: 'switch', title: 'Domínio usado nos links de orçamento' }, h('input', { type: 'radio', name: 'primary', checked: d.primary === dom, onchange: () => { d.primary = d.list[i]; } }), 'Principal'),
    h('button', { class: 'icon-btn danger', title: 'Remover', onclick: () => { d.list.splice(i, 1); drawList(); } }, ic('trash')))));
  drawList();
  const saveBtn = h('button', { class: 'btn primary', onclick: () => saveSettings({ domains: { ...d, list: d.list.filter(Boolean) } }, saveBtn).then(drawHosts) }, ic('check'), 'Salvar domínios');
  const checkBtn = h('button', { class: 'btn', onclick: () => withBusy(checkBtn, async () => {
    const { results } = await api('domains', 'check');
    results.forEach((r) => { status[r.host] = r; });
    drawHosts();
    toast(`${results.filter((r) => r.status === 'ok').length} de ${results.length} endereços funcionando.`);
  }) }, ic('refresh'), 'Verificar agora');

  const tokenObj = { token: '' };
  const tokenBox = h('div', { class: 'form' });
  const drawToken = () => fill(tokenBox, 
    S.hasVercelToken ? h('div', { class: 'callout ok' }, ic('check'), h('div', {}, h('strong', {}, 'Token da Vercel cadastrado'), 'O painel pode adicionar os domínios e conferir o DNS por você.')) : h('p', { class: 'hint' }, 'Opcional. Com um token da Vercel, este painel adiciona todos os endereços ao projeto com um clique. Crie em vercel.com → Account Settings → Tokens.'),
    h('div', { class: 'row' }, field(S.hasVercelToken ? 'Trocar token' : 'Token da Vercel', inp(tokenObj, 'token', { type: 'password', placeholder: 'Cole o token aqui', autocomplete: 'off' }))),
    h('div', { class: 'page-actions' },
      tokenSaveBtn,
      S.hasVercelToken && addBtn, S.hasVercelToken && dnsBtn,
      S.hasVercelToken && h('button', { class: 'btn ghost danger', onclick: () => withBusy(tokenSaveBtn, async () => { await api('domains', 'token', { token: '' }); S.hasVercelToken = false; drawToken(); toast('Token removido.'); }) }, 'Remover token')));
  const tokenSaveBtn = h('button', { class: 'btn', onclick: () => withBusy(tokenSaveBtn, async () => { if (!tokenObj.token) throw new Error('Cole o token.'); await api('domains', 'token', { token: tokenObj.token }); S.hasVercelToken = true; tokenObj.token = ''; drawToken(); toast('Token salvo com segurança.'); }) }, ic('key'), 'Salvar token');
  const addBtn = h('button', { class: 'btn primary', onclick: () => withBusy(addBtn, async () => {
    await api('settings', 'save', { item: { domains: { ...d, list: d.list.filter(Boolean) } } });
    const { results } = await api('domains', 'vercel-add');
    results.forEach((r) => { status[r.host] = { ok: r.ok, label: r.label }; });
    drawHosts(); toast(`${results.filter((r) => r.ok).length} de ${results.length} endereços no projeto da Vercel.`);
  }) }, ic('plus'), 'Adicionar todos na Vercel');
  const dnsBtn = h('button', { class: 'btn', onclick: () => withBusy(dnsBtn, async () => {
    const { results } = await api('domains', 'vercel-status');
    results.forEach((r) => { status[r.host] = { ok: r.ok, label: r.label }; });
    drawHosts(); toast('DNS conferido na Vercel.');
  }) }, ic('search'), 'Conferir DNS');
  drawToken();

  const dnsRows = d.list.flatMap((dom) => [['A', '@', '76.76.21.21', dom], ...['www', 'admin', 'editar', 'orcamento'].map((s) => ['CNAME', s, 'cname.vercel-dns.com', dom])]);
  main.append(
    h('section', { class: 'card', style: 'margin-bottom:16px' },
      h('div', { class: 'card-head' }, h('div', {}, h('h2', {}, 'Seus domínios'), h('p', {}, 'Cada domínio ganha os endereços abaixo automaticamente.')), h('button', { class: 'btn sm', onclick: () => { d.list.push(''); drawList(); } }, ic('plus'), 'Adicionar domínio')),
      h('div', { class: 'card-pad form' }, listBox, h('div', { class: 'page-actions' }, saveBtn))),
    h('section', { class: 'card', style: 'margin-bottom:16px' },
      h('div', { class: 'card-head' }, h('div', {}, h('h2', {}, 'Endereços'), h('p', {}, 'Situação de cada endereço.')), checkBtn),
      h('div', { class: 'table-wrap' }, h('table', { class: 't' }, h('thead', {}, h('tr', {}, h('th', {}, 'Endereço'), h('th', {}, 'Abre'), h('th', {}, 'Situação'))), hostsBody))),
    h('section', { class: 'card', style: 'margin-bottom:16px' },
      h('div', { class: 'card-head' }, h('div', {}, h('h2', {}, 'Passo 1 · Adicionar na Vercel'), h('p', {}, 'Os endereços precisam estar cadastrados no projeto.'))),
      h('div', { class: 'card-pad' }, tokenBox, h('p', { class: 'hint', style: 'margin-top:12px' }, 'Sem token: na Vercel, abra o projeto → Settings → Domains e adicione cada endereço da tabela acima.'))),
    h('section', { class: 'card' },
      h('div', { class: 'card-head' }, h('div', {}, h('h2', {}, 'Passo 2 · Apontar o DNS'), h('p', {}, 'Crie estes registros onde você comprou o domínio (zona DNS).'))),
      h('div', { class: 'table-wrap' }, h('table', { class: 't dns' }, h('thead', {}, h('tr', {}, h('th', {}, 'Domínio'), h('th', {}, 'Tipo'), h('th', {}, 'Nome'), h('th', {}, 'Valor'), h('th', {}))),
        h('tbody', {}, dnsRows.map(([type, name, value, dom]) => h('tr', {}, h('td', {}, dom), h('td', {}, type), h('td', { class: 'strong' }, name), h('td', {}, value), h('td', { class: 'right' }, h('button', { class: 'icon-btn', title: 'Copiar valor', onclick: () => copy(value, 'Valor copiado.') }, ic('copy')))))))),
      h('div', { class: 'card-pad' }, h('div', { class: 'callout' }, ic('help'), h('div', {}, h('strong', {}, 'Dicas'), 'Apague registros A ou CNAME antigos com o mesmo nome antes de criar os novos. Se a Vercel mostrar um valor diferente para algum registro, use o que ela mostrar. A propagação costuma levar de alguns minutos a algumas horas.')))));
}
function setSecurity(main) {
  const f = { password: '', confirm: '', name: S.me.name };
  const btn = h('button', { class: 'btn primary', onclick: () => withBusy(btn, async () => {
    if (f.password.length < 6) throw new Error('A nova senha precisa ter pelo menos 6 caracteres.');
    if (f.password !== f.confirm) throw new Error('As senhas não conferem.');
    const r = await api('me', 'password', { password: f.password, name: f.name });
    toast('Senha alterada.');
    if (r.relogin) { toast('Entre novamente com a nova senha.'); setTimeout(logout, 900); }
    else { f.password = f.confirm = ''; render(); }
  }) }, ic('key'), 'Trocar senha');
  main.append(h('section', { class: 'card card-pad', style: 'max-width:560px' }, h('div', { class: 'form' },
    h('div', { class: 'section-title' }, ic('lock'), 'Minha senha'),
    S.me.id === 'master' ? h('div', { class: 'callout warn' }, ic('alert'), h('div', {}, h('strong', {}, 'Você está com a senha inicial'), 'Ao salvar, o usuário "admin" passa a usar a nova senha e a senha inicial deixa de funcionar.')) : null,
    h('p', { class: 'hint' }, `Usuário: ${S.me.username}. A mesma senha vale para o CRM e para o editor do site.`),
    field('Nova senha', inp(f, 'password', { type: 'password', autocomplete: 'new-password' })),
    field('Repita a nova senha', inp(f, 'confirm', { type: 'password', autocomplete: 'new-password' })),
    h('div', { class: 'page-actions' }, btn))));
}

/* ======================================================================
   início
   ====================================================================== */
async function boot() {
  if (!S.token) return renderLogin();
  try {
    const r = await fetch('/api/crm?r=bootstrap', { headers: { 'x-admin-token': S.token }, cache: 'no-store' });
    const j = await r.json().catch(() => ({}));
    if (r.status === 401) { store.del('crm_token'); S.token = null; return renderLogin(); }
    if (!r.ok) { store.del('crm_token'); S.token = null; return renderLogin(j.error || 'Não foi possível abrir o painel.'); }
    S.me = j.me; S.roles = j.roles; S.storage = j.storage; S.hasVercelToken = j.hasVercelToken;
    S.d = { settings: j.settings, clients: j.clients || [], catalog: j.catalog || [], quotes: j.quotes || [], transactions: j.transactions || [], accounts: j.accounts || [], users: j.users || [] };
    if (!location.hash) location.hash = '#/painel';
    render();
  } catch {
    renderLogin('Sem conexão com o servidor. Tente novamente.');
  }
}
boot();
