// Cálculos e formatação compartilhados entre o CRM e a página do orçamento.
export const UNITS = { 'único': 'pagamento único', mensal: 'por mês', hora: 'por hora', diaria: 'por diária' };
export const UNIT_SHORT = { 'único': '', mensal: '/mês', hora: '/hora', diaria: '/diária' };
export const isMonthly = (u) => u === 'mensal';

export const brl = (n) => (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function lineTotal(it) {
  return (Number(it.qty) || 0) * (Number(it.price) || 0);
}

// Totais: itens únicos (com desconto) e itens mensais; o plano escolhido soma conforme a unidade.
export function quoteTotals(q, chosenPlanName) {
  const items = Array.isArray(q.items) ? q.items : [];
  let once = 0, monthly = 0;
  for (const it of items) {
    if (isMonthly(it.unit)) monthly += lineTotal(it); else once += lineTotal(it);
  }
  const d = Number(q.discount) || 0;
  const discount = d > 0 ? Math.min(once, q.discountType === 'valor' ? d : (once * d) / 100) : 0;
  const plans = Array.isArray(q.plans) ? q.plans : [];
  const plan = plans.find((p) => p.name === chosenPlanName) || (plans.length === 1 ? plans[0] : null);
  let planOnce = 0, planMonthly = 0;
  if (plan) { if (isMonthly(plan.unit)) planMonthly = Number(plan.price) || 0; else planOnce = Number(plan.price) || 0; }
  return {
    subtotalOnce: once, discount, once: once - discount + planOnce, monthly: monthly + planMonthly,
    plan, hasPlans: plans.length > 0,
  };
}

export const fmtDate = (iso, opts = { day: '2-digit', month: '2-digit', year: 'numeric' }) => {
  if (!iso) return '—';
  const d = new Date(iso.length === 10 ? iso + 'T12:00:00' : iso);
  if (isNaN(d)) return '—';
  return opts.timeStyle ? d.toLocaleString('pt-BR', opts) : d.toLocaleDateString('pt-BR', opts);
};

export const QUOTE_STATUS = {
  rascunho: { label: 'Rascunho', tone: '' },
  enviado: { label: 'Enviado', tone: 'info' },
  visualizado: { label: 'Visualizado', tone: 'brand' },
  aprovado: { label: 'Aprovado', tone: 'ok' },
  recusado: { label: 'Recusado', tone: 'bad' },
};

export function totalDays(q) {
  const steps = Array.isArray(q.steps) ? q.steps : [];
  if (steps.length) return steps.reduce((s, x) => s + (Number(x.days) || 0), 0);
  const items = Array.isArray(q.items) ? q.items : [];
  return items.reduce((m, x) => Math.max(m, Number(x.deliveryDays) || 0), 0);
}
