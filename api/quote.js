// Página pública do orçamento: leitura pelo link (slug) e aprovação/recusa pelo cliente.
import { CONFIG_PATH, getSession, readJSON, send, writeJSON } from './_lib.js';
import { loadSettings } from './crm.js';

const QUOTES = 'crm/quotes.json';
const PUBLIC_FIELDS = [
  'number', 'slug', 'title', 'clientName', 'clientCompany', 'intro', 'items', 'plans', 'steps', 'discount', 'discountType',
  'paymentTerms', 'notes', 'deliveryText', 'validUntil', 'status', 'approvedAt', 'approvedBy', 'chosenPlan', 'rejectedAt',
  'createdAt', 'updatedAt', 'showPix', 'cover',
];

export default async function handler(req, res) {
  const slug = String(req.query?.slug || req.body?.slug || '').toLowerCase().replace(/[^a-z0-9-]/g, '');
  if (!slug) return send(res, 404, { error: 'Orçamento não encontrado.' });

  try {
    const quotes = await readJSON(QUOTES, []);
    const q = quotes.find((x) => x.slug === slug);
    if (req.query?.t && !req.headers['x-admin-token']) req.headers['x-admin-token'] = String(req.query.t);
    const staff = await getSession(req);
    const isStaff = !!staff?.perms.includes('crm');
    if (!q || (!isStaff && (q.active === false || q.status === 'rascunho'))) {
      return send(res, 404, { error: 'Este orçamento não está disponível. Fale com a Petricelli Digital para receber um link atualizado.' });
    }

    if (req.method === 'GET') {
      if (!isStaff && req.query?.view !== '0') {
        q.views = (q.views || 0) + 1;
        q.viewedAt = new Date().toISOString();
        if (q.status === 'enviado') q.status = 'visualizado';
        await writeJSON(QUOTES, quotes).catch(() => {});
      }
      const settings = await loadSettings();
      const site = await readJSON(CONFIG_PATH, null).catch(() => null);
      const quote = Object.fromEntries(PUBLIC_FIELDS.map((k) => [k, q[k]]));
      const expired = q.validUntil && new Date(q.validUntil + 'T23:59:59') < new Date() && !['aprovado', 'recusado'].includes(q.status);
      return send(res, 200, {
        quote: { ...quote, expired },
        company: { ...settings.company, pix: q.showPix === false ? '' : settings.company.pix },
        footer: settings.quote.footer,
        site: site ? { theme: site.theme, brand: site.brand, themeClean: site.themeClean } : null,
        preview: isStaff,
      });
    }

    if (req.method === 'POST') {
      const { action, name = '', note = '', plan = '' } = req.body || {};
      if (['aprovado', 'recusado'].includes(q.status)) return send(res, 409, { error: 'Este orçamento já foi respondido.' });
      if (q.validUntil && new Date(q.validUntil + 'T23:59:59') < new Date()) return send(res, 410, { error: 'O prazo de validade deste orçamento terminou. Peça um link atualizado.' });
      const who = String(name).trim().slice(0, 80);
      if (!who) return send(res, 400, { error: 'Informe seu nome para confirmar.' });
      if (action === 'approve') {
        if (Array.isArray(q.plans) && q.plans.length > 1 && !q.plans.some((p) => p.name === plan)) return send(res, 400, { error: 'Escolha um dos planos.' });
        Object.assign(q, { status: 'aprovado', approvedAt: new Date().toISOString(), approvedBy: who, approvedNote: String(note).slice(0, 1000), chosenPlan: plan || q.plans?.[0]?.name || '' });
      } else if (action === 'reject') {
        Object.assign(q, { status: 'recusado', rejectedAt: new Date().toISOString(), approvedBy: who, rejectReason: String(note).slice(0, 1000) });
      } else return send(res, 400, { error: 'Ação inválida.' });
      await writeJSON(QUOTES, quotes);
      return send(res, 200, { ok: true, status: q.status, approvedAt: q.approvedAt, chosenPlan: q.chosenPlan });
    }
    return send(res, 405, { error: 'Método não permitido.' });
  } catch (err) {
    console.error('quote', err);
    return send(res, 500, { error: 'Não foi possível carregar o orçamento agora. Tente novamente em instantes.' });
  }
}
