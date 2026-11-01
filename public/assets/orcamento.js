// Orçamento virtual: o cliente abre pelo link, revisa e aprova (ou recusa).
import { DEFAULT_CONFIG } from './defaults.js';
import { icon } from './icons.js';
import { brl, fmtDate, quoteTotals, UNIT_SHORT, UNITS, totalDays, isMonthly, lineTotal } from './quote-calc.js';

const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ic = (n) => icon(n);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

const parts = location.pathname.split('/').filter(Boolean);
const slug = (parts[0] === 'o' || parts[0] === 'orcamento' ? parts[1] : parts[0]) || '';
const params = new URLSearchParams(location.search);
const staffToken = params.get('t') || '';

let data = null;
let chosen = '';

/* ---------- tema (mesmo do site: Dark e Clean) ---------- */
const MODE_KEY = 'petricelli-theme';
let mode = null;
try { mode = localStorage.getItem(MODE_KEY); } catch { /* sem armazenamento */ }
function palette() {
  const site = data?.site || {};
  const dark = { ...DEFAULT_CONFIG.theme, ...(site.theme || {}) };
  const clean = { ...dark, ...DEFAULT_CONFIG.themeClean, ...(site.themeClean || {}) };
  return mode === 'clean' ? clean : dark;
}
function isLight(hex) {
  const m = String(hex).replace('#', '');
  const n = parseInt(m.length === 3 ? m.split('').map((c) => c + c).join('') : m, 16);
  return ((n >> 16 & 255) * 0.299 + (n >> 8 & 255) * 0.587 + (n & 255) * 0.114) / 255 > 0.6;
}
function applyTheme() {
  const t = palette();
  const r = document.documentElement.style;
  ['bg', 'surface', 'text', 'muted', 'primary', 'secondary', 'accent'].forEach((k) => t[k] && r.setProperty('--' + k, t[k]));
  r.setProperty('--surface-2', t.surface2);
  r.setProperty('--cta-bg', t.ctaGradient === false ? t.ctaBg1 : `linear-gradient(120deg, ${t.ctaBg1}, ${t.ctaBg2})`);
  r.setProperty('--cta-text', t.ctaText || '#fff');
  document.body.classList.toggle('theme-light', isLight(t.bg));
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t.bg);
  document.querySelectorAll('.theme-switch').forEach((el) => {
    el.dataset.mode = mode === 'clean' ? 'clean' : 'dark';
    el.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === el.dataset.mode)));
  });
}
const themeSwitch = () => `<div class="theme-switch no-print" role="group" aria-label="Tema da página"><span class="ts-thumb" aria-hidden="true"></span>
  <button type="button" data-mode="dark" aria-label="Tema escuro">${ic('moon')}</button><button type="button" data-mode="clean" aria-label="Tema claro">${ic('sun')}</button></div>`;

/* ---------- carregamento ---------- */
async function load() {
  if (!slug) return renderMissing('Abra o link completo que você recebeu para ver a sua proposta.');
  try {
    const r = await fetch(`/api/quote?slug=${encodeURIComponent(slug)}${staffToken ? '&t=' + encodeURIComponent(staffToken) : ''}`, { cache: 'no-store' });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return renderMissing(j.error || 'Orçamento não encontrado.');
    data = j;
    chosen = j.quote.chosenPlan || (j.quote.plans || []).find((p) => p.featured)?.name || (j.quote.plans?.length === 1 ? j.quote.plans[0].name : '');
    render();
  } catch {
    renderMissing('Não foi possível carregar a proposta agora. Verifique sua conexão e tente novamente.');
  }
}

function renderMissing(msg) {
  applyTheme();
  $('#app').innerHTML = `<div class="bg" aria-hidden="true"><span></span><span></span><span></span></div>
    <main class="missing"><div class="card"><div class="logo-mark" style="width:56px;height:56px;font-size:1.4rem">P</div>
    <h1 style="font-size:1.6rem">Proposta indisponível</h1><p style="color:var(--muted)">${esc(msg)}</p></div></main>`;
  $('#loader').classList.add('done');
}

/* ---------- página ---------- */
function render() {
  const { quote: q, company: c } = data;
  document.title = `Proposta ${q.number} · ${c.name}`;
  applyTheme();
  const t = quoteTotals(q, chosen);
  const days = totalDays(q);
  const who = q.clientCompany || q.clientName || 'você';
  const wa = String(c.whatsapp || c.phone || '').replace(/\D/g, '');
  const waLink = wa ? `https://wa.me/${wa.length <= 11 ? '55' + wa : wa}?text=${encodeURIComponent(`Olá! Estou vendo a proposta ${q.number} (${q.title || 'orçamento'}).`)}` : '';
  const logo = c.logo ? `<span class="logo-mark"><img src="${esc(c.logo)}" alt=""></span>` : `<span class="logo-mark">${esc((c.name || 'P')[0])}</span>`;
  const left = q.validUntil ? Math.ceil((new Date(q.validUntil + 'T23:59:59') - new Date()) / 86400000) : null;
  const validTxt = q.expired ? '<span class="warn">Prazo encerrado</span>' : left !== null ? `${fmtDate(q.validUntil)}${left <= 5 && left >= 0 ? ` <span class="warn">· ${left === 0 ? 'último dia' : `faltam ${left} dia${left > 1 ? 's' : ''}`}</span>` : ''}` : '—';
  let d = 0;
  const delay = () => `style="--d:${(d++ % 6) * 0.07}s"`;

  const items = (q.items || []).map((it, i) => `
    <article class="card item reveal" ${delay()}>
      <span class="item-n">${String(i + 1).padStart(2, '0')}</span>
      <div><h3>${esc(it.name)}</h3>${it.description ? `<p>${esc(it.description)}</p>` : ''}
        <div class="tags">${Number(it.qty) !== 1 ? `<span class="tag">${esc(it.qty)} × ${brl(it.price)}</span>` : ''}<span class="tag">${esc(UNITS[it.unit] || 'pagamento único')}</span>${it.deliveryDays ? `<span class="tag">${esc(it.deliveryDays)} dia(s)</span>` : ''}</div></div>
      <div class="price num">${brl(lineTotal(it))}<small>${UNIT_SHORT[it.unit] ? esc(UNIT_SHORT[it.unit].replace('/', 'por ')) : 'valor único'}</small></div>
    </article>`).join('');

  const plans = (q.plans || []).map((p) => `
    <button type="button" class="card plan reveal${p.featured ? ' featured' : ''}${chosen === p.name ? ' chosen' : ''}" data-plan="${esc(p.name)}" ${delay()} aria-pressed="${chosen === p.name}">
      ${p.featured ? '<span class="badge">Recomendado</span>' : ''}
      <h3>${esc(p.name)}</h3>
      <div class="p-price num">${brl(p.price)} <small>${esc(UNIT_SHORT[p.unit] || 'valor único')}</small></div>
      ${p.features ? `<ul>${String(p.features).split('\n').filter(Boolean).map((f) => `<li>${ic('check')}<span>${esc(f)}</span></li>`).join('')}</ul>` : ''}
      ${q.plans.length > 1 ? `<span class="pick"><span class="radio"></span>${chosen === p.name ? 'Plano escolhido' : 'Escolher este plano'}</span>` : ''}
    </button>`).join('');

  const steps = (q.steps || []).filter((s) => s.title).map((s, i) => `
    <div class="step reveal" ${delay()}><span class="dot">${i + 1}</span><strong>${esc(s.title)}</strong>${s.days ? `<span class="days">${esc(s.days)} dia(s)</span>` : '<span></span>'}</div>`).join('');

  const grandMain = t.once || !t.monthly ? brl(t.once) : brl(t.monthly);
  const grandSub = t.once && t.monthly ? `+ ${brl(t.monthly)} por mês` : !t.once && t.monthly ? 'por mês' : 'pagamento único';

  $('#app').innerHTML = `
    ${data.preview ? `<div class="preview-bar no-print">Pré-visualização interna · visitas não são contadas${q.status === 'rascunho' ? ' · este orçamento ainda é um rascunho e não abre para o cliente' : ''}</div>` : ''}
    <div class="bg" aria-hidden="true"><span></span><span></span><span></span></div>
    <header class="top"><div class="wrap top-in">
      <div class="logo">${logo}<span><strong>${esc(c.name)}</strong><small>${esc(c.tagline || '')}</small></span></div>
      <div class="top-actions">${themeSwitch()}${waLink ? `<a class="btn wa sm no-print" href="${waLink}" target="_blank" rel="noopener">${ic('whatsapp')}<span>Falar no WhatsApp</span></a>` : ''}</div>
    </div></header>
    <main>
      <section class="hero"><div class="wrap">
        <span class="eyebrow reveal"><b></b>Proposta comercial · ${esc(q.number)}</span>
        <h1 class="reveal" style="--d:.08s">Proposta para <span class="hl">${esc(who)}</span></h1>
        ${q.title ? `<p class="lead reveal" style="--d:.16s">${esc(q.title)}</p>` : ''}
        <div class="meta reveal" style="--d:.24s">
          <div><small>Emitida em</small><strong>${fmtDate(q.updatedAt || q.createdAt)}</strong></div>
          <div><small>Válida até</small><strong>${validTxt}</strong></div>
          ${days ? `<div><small>Prazo de execução</small><strong>${days} dia${days > 1 ? 's' : ''}</strong></div>` : ''}
          <div><small>Investimento</small><strong class="num">${t.hasPlans && !t.plan && !t.once ? 'Conforme o plano' : grandMain}</strong></div>
        </div>
      </div></section>

      ${q.intro ? `<section class="block"><div class="wrap"><div class="card letter reveal">
        <p>${esc(q.intro)}</p>
        <div class="sign">${logo}<div><strong>${esc(c.owner || c.name)}</strong><small>${esc(c.name)}${c.tagline ? ' · ' + esc(c.tagline) : ''}</small></div></div>
      </div></div></section>` : ''}

      ${items ? `<section class="block"><div class="wrap"><div class="label">Escopo</div><h2 class="reveal">O que vamos <span class="hl">entregar</span></h2><div class="items">${items}</div></div></section>` : ''}

      ${plans ? `<section class="block" id="planos"><div class="wrap"><div class="label">Planos</div><h2 class="reveal">${q.plans.length > 1 ? 'Escolha o seu <span class="hl">plano</span>' : 'Seu <span class="hl">plano</span>'}</h2><div class="plans">${plans}</div></div></section>` : ''}

      ${steps || q.deliveryText ? `<section class="block"><div class="wrap"><div class="label">Cronograma</div><h2 class="reveal">Etapas e <span class="hl">prazos</span></h2>
        ${steps ? `<div class="card" style="padding:clamp(16px,3vw,28px)"><div class="steps">${steps}</div></div>` : ''}
        ${q.deliveryText ? `<p class="reveal" style="margin-top:16px;color:var(--muted)">${ic('clock')} ${esc(q.deliveryText)}</p>` : ''}
      </div></section>` : ''}

      <section class="block"><div class="wrap"><div class="label">Investimento</div>
        <div class="invest">
          <div class="card totals reveal">
            ${t.subtotalOnce ? `<div class="trow"><span>Itens da proposta</span><span class="num">${brl(t.subtotalOnce)}</span></div>` : ''}
            ${t.discount ? `<div class="trow disc"><span>Desconto</span><span class="num">− ${brl(t.discount)}</span></div>` : ''}
            ${(q.items || []).some((x) => isMonthly(x.unit)) ? `<div class="trow"><span>Serviços mensais</span><span class="num">${brl(t.monthly - (t.plan && isMonthly(t.plan.unit) ? Number(t.plan.price) || 0 : 0))}/mês</span></div>` : ''}
            ${t.plan ? `<div class="trow"><span>Plano ${esc(t.plan.name)}</span><span class="num">${brl(t.plan.price)}${esc(UNIT_SHORT[t.plan.unit] || '')}</span></div>` : t.hasPlans ? '<div class="trow"><span>Plano</span><span>Escolha acima</span></div>' : ''}
            <div class="grand"><small>Total</small><strong class="num" id="grand">${grandMain}</strong><span>${grandSub}</span></div>
          </div>
          <div class="card terms reveal" style="--d:.1s">
            ${q.paymentTerms ? `<div><h3>${ic('wallet')}Forma de pagamento</h3><p>${esc(q.paymentTerms)}</p></div>` : ''}
            ${c.pix ? `<div><h3>${ic('zap')}Chave Pix</h3><div class="pix"><code>${esc(c.pix)}</code><button class="btn sm ghost no-print" data-copy="${esc(c.pix)}">${ic('copy')}Copiar</button></div></div>` : ''}
            ${q.notes ? `<div><h3>${ic('shield')}Observações</h3><p>${esc(q.notes)}</p></div>` : ''}
          </div>
        </div>
      </div></section>

      <section class="block" id="resposta"><div class="wrap"><div class="card decide reveal">${decisionHtml(q)}</div></div></section>
    </main>
    <footer><div class="wrap">
      ${data.footer ? `<p style="margin-bottom:24px;font-size:1.05rem;color:var(--text)">${esc(data.footer)}</p>` : ''}
      <div class="foot">
        <div class="contacts">${c.email ? `<span>${ic('mail')}${esc(c.email)}</span>` : ''}${c.phone || c.whatsapp ? `<span>${ic('phone')}${esc(c.phone || c.whatsapp)}</span>` : ''}${c.instagram ? `<span>${ic('instagram')}${esc(c.instagram)}</span>` : ''}${c.document ? `<span>CNPJ ${esc(c.document)}</span>` : ''}</div>
        <button class="btn sm ghost no-print" data-print>${ic('printer')}Imprimir ou salvar PDF</button>
      </div>
    </div></footer>`;
  bind();
  $('#loader').classList.add('done');
}

function decisionHtml(q) {
  if (q.status === 'aprovado') return `<div class="done-ico">${ic('check')}</div><h2>Proposta aprovada</h2>
    <p>Aprovada por ${esc(q.approvedBy || 'você')} em ${fmtDate(q.approvedAt, { dateStyle: 'long' })}${q.chosenPlan ? `, com o plano ${esc(q.chosenPlan)}` : ''}. Em breve entraremos em contato com os próximos passos.</p>`;
  if (q.status === 'recusado') return `<div class="done-ico bad">${ic('x')}</div><h2>Proposta recusada</h2>
    <p>Obrigada pelo retorno! Se quiser ajustar algo, é só chamar no WhatsApp que preparamos uma nova versão.</p>`;
  if (q.expired) return `<div class="done-ico bad">${ic('clock')}</div><h2>Prazo encerrado</h2>
    <p>O prazo desta proposta terminou em ${fmtDate(q.validUntil)}. Fale com a gente para receber um link atualizado.</p>`;
  const needPlan = (q.plans || []).length > 1;
  return `<h2>Vamos <span class="hl">começar?</span></h2>
    <p>Ao aprovar, você confirma o escopo, os prazos e o investimento desta proposta.${needPlan ? ' Escolha um plano acima antes de aprovar.' : ''}</p>
    <form id="decide-form" novalidate>
      <label>Seu nome <input id="d-name" autocomplete="name" placeholder="Nome de quem está aprovando" value="${esc(q.clientName || '')}"></label>
      <label>Mensagem (opcional) <textarea id="d-note" rows="3" placeholder="Algum comentário ou ajuste?"></textarea></label>
      <p class="err" id="d-err" role="alert"></p>
      <div class="acts">
        <button type="submit" class="btn primary" data-act="approve">${ic('check')}Aprovar proposta</button>
        <button type="button" class="btn ghost" data-act="reject">Recusar</button>
      </div>
    </form>`;
}

function bind() {
  document.querySelectorAll('.theme-switch button').forEach((b) => b.addEventListener('click', () => {
    mode = b.dataset.mode;
    try { localStorage.setItem(MODE_KEY, mode); } catch { /* sem armazenamento */ }
    applyTheme();
  }));
  applyTheme();
  document.querySelectorAll('[data-plan]').forEach((b) => b.addEventListener('click', () => {
    if (['aprovado', 'recusado'].includes(data.quote.status) || data.quote.plans.length < 2) return;
    chosen = b.dataset.plan;
    const y = scrollY;
    render();
    scrollTo(0, y);
    document.querySelectorAll('.reveal').forEach((el) => el.classList.add('in'));
  }));
  document.querySelectorAll('[data-copy]').forEach((b) => b.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(b.dataset.copy); b.lastChild.textContent = 'Copiado!'; } catch { b.lastChild.textContent = 'Selecione e copie'; }
    setTimeout(() => { b.lastChild.textContent = 'Copiar'; }, 2200);
  }));
  $('[data-print]')?.addEventListener('click', () => print());
  const form = $('#decide-form');
  if (form) {
    const send = async (action) => {
      const err = $('#d-err');
      err.textContent = '';
      const name = $('#d-name').value.trim();
      if (!name) { err.textContent = 'Informe seu nome para confirmar.'; return $('#d-name').focus(); }
      if (action === 'approve' && data.quote.plans?.length > 1 && !chosen) { err.textContent = 'Escolha um dos planos acima.'; return $('#planos')?.scrollIntoView({ behavior: 'smooth' }); }
      if (data.preview) { err.textContent = 'Pré-visualização: a resposta só pode ser enviada pelo cliente.'; return; }
      form.querySelectorAll('button').forEach((b) => { b.disabled = true; });
      try {
        const r = await fetch('/api/quote', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ slug, action, name, note: $('#d-note').value, plan: chosen }) });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || 'Não foi possível enviar sua resposta.');
        Object.assign(data.quote, { status: j.status, approvedAt: j.approvedAt, approvedBy: name, chosenPlan: j.chosenPlan });
        $('.decide').innerHTML = decisionHtml(data.quote);
      } catch (ex) {
        err.textContent = ex.message;
        form.querySelectorAll('button').forEach((b) => { b.disabled = false; });
      }
    };
    form.addEventListener('submit', (e) => { e.preventDefault(); send('approve'); });
    form.querySelector('[data-act="reject"]').addEventListener('click', () => {
      const b = form.querySelector('[data-act="reject"]');
      if (b.dataset.confirm) return send('reject');
      b.dataset.confirm = '1';
      b.textContent = 'Confirmar recusa';
    });
  }
  // topo com fundo ao rolar
  const onScroll = () => $('.top')?.classList.toggle('scrolled', scrollY > 10);
  onScroll();
  if (!bind.scrollBound) { addEventListener('scroll', onScroll, { passive: true }); bind.scrollBound = true; }
  // revelação ao rolar
  if (!reduced && 'IntersectionObserver' in window) {
    document.body.classList.add('js-reveal');
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
    document.querySelectorAll('.reveal').forEach((el) => io.observe(el));
  }
}

applyTheme();
load();
