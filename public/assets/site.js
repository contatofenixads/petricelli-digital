import { DEFAULT_CONFIG, FONTS, SECTION_IDS, deepMerge, clone } from './defaults.js';
import { icon } from './icons.js';

const isPreview = new URLSearchParams(location.search).has('preview');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
let cfg = clone(DEFAULT_CONFIG);
let cleanups = [];
let firstRender = true;

/* ---------- utilidades ---------- */
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rich = (s) => esc(s)
  .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  .replace(/\*(.+?)\*/g, '<em class="hl">$1</em>')
  .replace(/\n/g, '<br>');
const paras = (s) => String(s || '').split(/\n\s*\n/).map((p) => `<p>${rich(p)}</p>`).join('');

function waLink() {
  const w = cfg.whatsapp;
  return `https://wa.me/${String(w.number || '').replace(/\D/g, '')}?text=${encodeURIComponent(w.message || '')}`;
}
function href(h) {
  if (!h) return '#';
  if (h.trim().toLowerCase() === 'whatsapp') return waLink();
  return h;
}
const ext = (h) => (/^https?:/i.test(h) ? ' target="_blank" rel="noopener"' : '');

function btn(text, link, kind = 'primary', ic = 'arrow-right') {
  if (!text) return '';
  const h = href(link);
  return `<a class="btn btn-${kind}" href="${esc(h)}"${ext(h)}><span>${esc(text)}</span>${ic ? `<span class="arrow">${icon(ic)}</span>` : ''}</a>`;
}

function ficon(item = {}, opts = {}) {
  const style = opts.style || cfg.theme.iconStyle;
  const pulse = opts.pulse ?? cfg.effects.iconPulse;
  const inner = item.image ? `<img src="${esc(item.image)}" alt="">` : icon(item.icon || 'sparkles');
  const vars = [`--c:${esc(item.color || 'var(--primary)')}`];
  if (opts.size) vars.push(`--s:${Number(opts.size)}px`);
  return `<div class="ficon ${style}${pulse ? ' pulse' : ''}" style="${vars.join(';')}">${inner}</div>`;
}

function kicker(text) {
  return text ? `<span class="kicker reveal"><span class="dot"></span>${esc(text)}</span>` : '';
}
function head(s, center = true) {
  return `<div class="sec-head${center ? ' center' : ''}">${kicker(s.kicker)}${s.title ? `<h2 class="reveal">${rich(s.title)}</h2>` : ''}${s.subtitle ? `<p class="sec-sub reveal">${rich(s.subtitle)}</p>` : ''}</div>`;
}
function initials(name) {
  return String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}
function hexToRgb(hex) {
  const m = String(hex).replace('#', '').match(/^([\da-f]{2})([\da-f]{2})([\da-f]{2})/i);
  return m ? m.slice(1).map((x) => parseInt(x, 16)) : [0, 0, 0];
}
function isLight(hex) {
  const [r, g, b] = hexToRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6;
}

/* ---------- tema ---------- */
function loadFonts() {
  const t = cfg.theme;
  const wanted = [...new Set([t.headingFont, t.bodyFont, t.accentFont])];
  for (const name of wanted) {
    const f = FONTS.find((x) => x.name === name);
    if (!f) continue;
    const id = 'font-' + name.replace(/\s+/g, '-');
    if (document.getElementById(id)) continue;
    const l = document.createElement('link');
    l.id = id;
    l.rel = 'stylesheet';
    l.href = `https://fonts.googleapis.com/css2?family=${name.replace(/\s+/g, '+')}:${f.spec}&display=swap`;
    document.head.appendChild(l);
  }
}

/* ---------- tema Dark / Clean ---------- */
const MODE_KEY = 'petricelli-theme';
let savedMode = null;
try { savedMode = localStorage.getItem(MODE_KEY); } catch { /* sem armazenamento */ }
function themeMode() {
  const s = cfg.themeSwitch || {};
  if (s.enabled === false) return 'dark';
  if (savedMode === 'dark' || savedMode === 'clean') return savedMode;
  return s.default === 'clean' ? 'clean' : 'dark';
}
function palette() {
  return themeMode() === 'clean' ? { ...cfg.theme, ...(cfg.themeClean || {}) } : cfg.theme;
}
function setThemeMode(m) {
  savedMode = m;
  try { localStorage.setItem(MODE_KEY, m); } catch { /* sem armazenamento */ }
  applyTheme();
  document.querySelectorAll('.theme-switch').forEach(syncSwitch);
  restartParticles();
}
function syncSwitch(el) {
  const m = themeMode();
  el.dataset.mode = m;
  el.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === m)));
}
function themeSwitchHtml() {
  const s = cfg.themeSwitch || {};
  if (s.enabled === false) return '';
  return `<div class="theme-switch" role="group" aria-label="Tema da página">
    <span class="ts-thumb" aria-hidden="true"></span>
    <button type="button" data-mode="dark" aria-pressed="false">${icon('moon')}<span>${esc(s.darkLabel || 'Dark')}</span></button>
    <button type="button" data-mode="clean" aria-pressed="false">${icon('sun')}<span>${esc(s.cleanLabel || 'Clean')}</span></button>
  </div>`;
}

function applyTheme() {
  const t = palette(), e = cfg.effects;
  const root = document.documentElement.style;
  const set = (k, v) => root.setProperty(k, v);
  ['bg', 'surface', 'text', 'muted', 'primary', 'secondary', 'accent'].forEach((k) => set('--' + k, t[k]));
  set('--surface-2', t.surface2);
  set('--cta-bg', t.ctaGradient ? `linear-gradient(120deg, ${t.ctaBg1}, ${t.ctaBg2})` : t.ctaBg1);
  set('--cta-1', t.ctaBg1);
  set('--cta-2', t.ctaGradient ? t.ctaBg2 : t.ctaBg1);
  set('--cta-text', t.ctaText);
  set('--radius', t.radius + 'px');
  set('--btn-radius', { pill: '999px', rounded: '14px', square: '6px' }[t.ctaStyle] || '999px');
  set('--font-h', `'${t.headingFont}', system-ui, sans-serif`);
  set('--font-b', `'${t.bodyFont}', system-ui, sans-serif`);
  set('--font-a', `'${t.accentFont}', Georgia, serif`);
  set('--h-weight', t.headingWeight);
  set('--base', t.baseSize + 'px');
  set('--h-scale', t.headingScale);
  set('--pulse', e.pulseIntensity);
  set('--float-speed', Math.max(0.1, e.floatSpeed));
  const light = isLight(t.bg);
  document.body.className = [
    light ? 'theme-light' : 'theme-dark',
    themeMode() === 'clean' ? 'mode-clean' : 'mode-dark',
    'hl-' + (t.highlightStyle || 'serif'),
    e.animations && !reducedMotion ? '' : 'no-anim',
    e.ctaShine ? 'fx-shine' : '',
    e.reveal && !isPreview ? 'fx-reveal' : '',
    e.grain ? 'fx-grain' : '',
  ].filter(Boolean).join(' ');
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t.bg);
}

function applyMeta() {
  const m = cfg.meta;
  document.title = m.title || cfg.brand.name;
  const setMeta = (sel, attr, val) => { const el = document.querySelector(sel); if (el) el.setAttribute(attr, val || ''); };
  setMeta('meta[name="description"]', 'content', m.description);
  setMeta('meta[property="og:title"]', 'content', m.title);
  setMeta('meta[property="og:description"]', 'content', m.description);
  if (m.ogImage) setMeta('meta[property="og:image"]', 'content', m.ogImage);
  if (m.favicon) setMeta('link[rel="icon"]', 'href', m.favicon);
}

/* ---------- seções ---------- */
function renderAnnouncement() {
  const a = cfg.announcement;
  if (!a.enabled || !a.text) return '';
  const h = href(a.link);
  return `<div class="announce" style="--a1:${esc(a.bg1)};--a2:${esc(a.bg2)};--at:${esc(a.textColor)}">
    <div class="container announce-in"><span class="announce-dot"></span><span>${rich(a.text)}</span>
    ${a.linkText ? `<a href="${esc(h)}"${ext(h)}>${esc(a.linkText)} ${icon('arrow-right')}</a>` : ''}</div></div>`;
}

function logoHtml() {
  const b = cfg.brand;
  if (b.logoType === 'image' && b.logoImage) {
    return `<img src="${esc(b.logoImage)}" alt="${esc(b.name)}" style="height:${Number(b.logoHeight) || 36}px;width:auto">`;
  }
  return `<span class="logo-mark">${icon(b.logoIcon || 'flask')}</span><span class="logo-text"><strong>${esc(b.name)}</strong>${b.tagline ? `<small>${esc(b.tagline)}</small>` : ''}</span>`;
}

function renderNav() {
  const n = cfg.nav;
  const links = n.links.map((l) => { const h = href(l.href); return `<a href="${esc(h)}"${ext(h)}>${esc(l.label)}</a>`; }).join('');
  return `<header class="nav${n.sticky ? ' sticky' : ''}"><div class="container nav-in">
    <a href="#inicio" class="logo">${logoHtml()}</a>
    <nav class="nav-links">${links}</nav>
    <div class="nav-cta">${themeSwitchHtml()}${btn(n.ctaText, n.ctaLink, 'primary', '')}
      <button class="nav-toggle" aria-label="Abrir menu">${icon('menu')}</button></div></div>
    <div class="mobile-menu"><div class="container">${links}${btn(n.ctaText, n.ctaLink, 'primary')}</div></div>
  </header>`;
}

function renderHero() {
  const h = cfg.hero, f = cfg.floatingIcons;
  const items = f.enabled ? f.items : [];
  const n = items.length || 1;
  const r = Number(f.radius) || 46;
  const orbit = items.map((it, i) => {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    const x = 50 + r * Math.cos(a), y = 50 + r * Math.sin(a);
    return `<div class="orbit-item" style="left:${x.toFixed(2)}%;top:${y.toFixed(2)}%;--d:${(-i * 0.7).toFixed(2)}s">
      <div class="counter"><div class="floaty">${ficon(it, { style: f.style, size: f.size, pulse: f.pulse })}
      ${f.showLabels && it.label ? `<span class="ficon-label">${esc(it.label)}</span>` : ''}</div></div></div>`;
  }).join('');
  const img = h.image || '/assets/rebecca-placeholder.svg';
  const avatars = String(h.proofAvatars || '').split(',').map((s) => s.trim()).filter(Boolean).slice(0, 5)
    .map((s, i) => `<span class="av" style="--i:${i}">${esc(s.slice(0, 2))}</span>`).join('');
  const cards = (h.cards || []).slice(0, 2).map((c, i) => `<div class="hero-card hc-${i}">${ficon({ icon: c.icon, color: c.color }, { size: 42, pulse: false })}
    <div><strong>${esc(c.value)}</strong><span>${esc(c.label)}</span></div></div>`).join('');
  return `<section class="hero" id="inicio">
    <canvas class="particles" aria-hidden="true"></canvas>
    <div class="container hero-grid">
      <div class="hero-copy">
        ${kicker(h.badge)}
        <h1 class="reveal">${rich(h.title)}</h1>
        <p class="lead reveal">${rich(h.subtitle)}</p>
        <div class="hero-ctas reveal">${btn(h.cta1Text, h.cta1Link, 'primary')}${btn(h.cta2Text, h.cta2Link, 'ghost', 'chevron-down')}</div>
        ${h.proofText ? `<div class="proof reveal">${avatars ? `<div class="avatars">${avatars}</div>` : ''}<div><div class="stars">${'★'.repeat(5)}</div><span>${rich(h.proofText)}</span></div></div>` : ''}
      </div>
      <div class="hero-visual reveal${f.rotate ? ' rotating' : ''}" style="--orbit-speed:${Number(f.rotateSpeed) || 90}s">
        <div class="glow-ring"></div>
        <div class="orbit-path"></div>
        <div class="portrait shape-${esc(h.imageShape || 'blob')}"><img src="${esc(img)}" alt="${esc(cfg.brand.person)}"></div>
        <div class="orbit">${orbit}</div>
        ${cards}
      </div>
    </div>
  </section>`;
}

function renderLogos() {
  const l = cfg.logos;
  const item = (x) => `<div class="logo-item">${x.image ? `<img src="${esc(x.image)}" alt="${esc(x.name)}">` : `${x.icon ? icon(x.icon) : ''}<span>${esc(x.name)}</span>`}</div>`;
  const list = l.items.map(item).join('');
  return `<section class="logos" id="logos">
    ${l.title ? `<div class="container"><p class="logos-title reveal">${rich(l.title)}</p></div>` : ''}
    <div class="marquee${l.grayscale ? ' gray' : ''}" style="--speed:${Number(l.speed) || 30}s"><div class="marquee-track">${list}${list}</div></div>
  </section>`;
}

function renderStats() {
  const items = cfg.stats.items.map((s, i) => `<div class="stat reveal tilt" style="--i:${i}">
    <div class="stat-num">${esc(s.prefix)}<span class="count" data-to="${Number(s.value) || 0}">${esc(s.value)}</span>${esc(s.suffix)}</div>
    <p>${esc(s.label)}</p></div>`).join('');
  return `<section class="stats" id="numeros"><div class="container"><div class="stats-grid">${items}</div></div></section>`;
}

function renderAbout() {
  const a = cfg.about;
  const img = a.image || '/assets/rebecca-placeholder.svg';
  const hl = a.highlights.map((x) => `<li>${ficon({ icon: x.icon }, { size: 44 })}<span>${rich(x.text)}</span></li>`).join('');
  return `<section class="about" id="sobre"><div class="container about-grid">
    <div class="about-media reveal">
      <div class="about-img"><img src="${esc(img)}" alt="${esc(cfg.brand.person)}"></div>
      ${a.badgeValue ? `<div class="about-badge"><strong>${esc(a.badgeValue)}</strong><span>${esc(a.badgeLabel)}</span></div>` : ''}
      <div class="about-float">${ficon({ icon: 'flask', color: 'var(--accent)' }, { size: 58 })}</div>
    </div>
    <div class="about-copy">
      ${kicker(a.kicker)}
      <h2 class="reveal">${rich(a.title)}</h2>
      <div class="about-text reveal">${paras(a.text)}</div>
      ${hl ? `<ul class="highlights reveal">${hl}</ul>` : ''}
      <div class="about-foot reveal">${a.signature ? `<span class="signature">${esc(a.signature)}</span>` : ''}${btn(a.ctaText, a.ctaLink, 'primary')}</div>
    </div>
  </div></section>`;
}

function renderServices() {
  const s = cfg.services;
  const cards = s.items.map((x, i) => `<article class="card service reveal tilt" style="--i:${i};--c:${esc(x.color || 'var(--primary)')}">
    ${ficon({ icon: x.icon, color: x.color })}
    <h3>${esc(x.title)}</h3><p>${rich(x.text)}</p></article>`).join('');
  return `<section class="services" id="servicos"><div class="container">${head(s)}
    <div class="services-grid cols-${Number(s.columns) || 3}">${cards}</div></div></section>`;
}

function renderMethod() {
  const m = cfg.method;
  const steps = m.steps.map((x, i) => `<div class="step reveal" style="--i:${i}">
    <div class="step-top">${ficon({ icon: x.icon })}<span class="step-n">${String(i + 1).padStart(2, '0')}</span></div>
    <h3>${esc(x.title)}</h3><p>${rich(x.text)}</p></div>`).join('');
  return `<section class="method" id="metodo"><div class="container">${head(m)}
    <div class="steps" style="--n:${m.steps.length}">${steps}</div></div></section>`;
}

function carousel(slides, opts) {
  return `<div class="carousel reveal" data-autoplay="${opts.autoplay ? 1 : 0}" data-interval="${(Number(opts.interval) || 5) * 1000}">
    <div class="carousel-track">${slides}</div>
    <div class="carousel-nav"><button class="c-btn c-prev" aria-label="Anterior">${icon('chevron-left')}</button>
    <div class="dots"></div><button class="c-btn c-next" aria-label="Próximo">${icon('chevron-right')}</button></div></div>`;
}

function renderResults() {
  const r = cfg.results;
  const slides = r.items.map((x) => `<article class="slide case card">
    <div class="case-media">${x.image ? `<img src="${esc(x.image)}" alt="">` : `<div class="case-ph">${ficon({ icon: x.icon || 'chart' }, { size: 72 })}</div>`}
      ${x.tag ? `<span class="case-tag">${esc(x.tag)}</span>` : ''}</div>
    <div class="case-body"><div class="case-metric"><strong>${esc(x.metric)}</strong><span>${esc(x.metricLabel)}</span></div>
      <h3>${esc(x.title)}</h3><p>${rich(x.text)}</p></div></article>`).join('');
  return `<section class="results" id="resultados"><div class="container">${head(r)}${carousel(slides, r)}</div></section>`;
}

function renderTestimonials() {
  const t = cfg.testimonials;
  const slides = t.items.map((x) => `<article class="slide testi card">
    <div class="testi-top"><span class="quote">${icon('quote')}</span><span class="stars">${'★'.repeat(Math.max(0, Math.min(5, Number(x.rating) || 5)))}</span></div>
    <p class="testi-text">${rich(x.text)}</p>
    <div class="testi-who">${x.avatar ? `<img src="${esc(x.avatar)}" alt="">` : `<span class="av">${esc(initials(x.name))}</span>`}
      <div><strong>${esc(x.name)}</strong><span>${esc(x.role)}</span></div></div></article>`).join('');
  return `<section class="testimonials" id="depoimentos"><div class="container">${head(t)}${carousel(slides, t)}</div></section>`;
}

function renderPricing() {
  const p = cfg.pricing;
  const cards = p.items.map((x, i) => {
    const feats = String(x.features || '').split('\n').map((s) => s.trim()).filter(Boolean)
      .map((s) => `<li><span class="tick">${icon('check')}</span>${rich(s)}</li>`).join('');
    return `<article class="card plan reveal${x.featured ? ' featured' : ''}" style="--i:${i}">
      ${x.badge ? `<span class="plan-badge">${icon('sparkles')}${esc(x.badge)}</span>` : ''}
      <h3>${esc(x.name)}</h3><p class="plan-desc">${rich(x.description)}</p>
      <div class="plan-price"><strong>${esc(x.price)}</strong>${x.period ? `<span>${esc(x.period)}</span>` : ''}</div>
      <ul>${feats}</ul>${btn(x.ctaText, x.ctaLink, x.featured ? 'primary' : 'ghost')}</article>`;
  }).join('');
  return `<section class="pricing" id="planos"><div class="container">${head(p)}<div class="plans">${cards}</div></div></section>`;
}

function renderFaq() {
  const f = cfg.faq;
  const items = f.items.map((x, i) => `<details class="faq-item reveal" style="--i:${i}"${i === 0 ? ' open' : ''}>
    <summary><span>${esc(x.q)}</span><span class="faq-ic">${icon('plus')}</span></summary>
    <div class="faq-a">${paras(x.a)}</div></details>`).join('');
  return `<section class="faq" id="faq"><div class="container faq-grid">${head(f, false)}<div class="faq-list">${items}</div></div></section>`;
}

function renderFinalCta() {
  const c = cfg.finalCta;
  const deco = c.showIcons ? cfg.floatingIcons.items.slice(0, 6).map((it, i) => `<div class="cta-deco d${i}">${ficon(it, { size: 52, style: 'glass' })}</div>`).join('') : '';
  const bg = c.bgImage ? ` style="--cta-img:url('${esc(c.bgImage)}')"` : '';
  return `<section class="final-cta" id="contato"><div class="container">
    <div class="cta-box reveal${c.bgImage ? ' has-img' : ''}"${bg}>${deco}
      <div class="cta-inner"><h2>${rich(c.title)}</h2><p>${rich(c.subtitle)}</p>${btn(c.ctaText, c.ctaLink, 'light')}
      ${c.note ? `<small>${esc(c.note)}</small>` : ''}</div></div></div></section>`;
}

function renderFooter() {
  const f = cfg.footer;
  const socials = [
    ['instagram', f.instagram], ['tiktok', f.tiktok], ['linkedin', f.linkedin], ['youtube', f.youtube],
    ['whatsapp', cfg.whatsapp.enabled ? waLink() : ''], ['mail', f.email ? `mailto:${f.email}` : ''],
  ].filter(([, v]) => v).map(([ic, v]) => `<a class="soc" href="${esc(v)}"${ext(v)} aria-label="${ic}">${ficon({ icon: ic }, { size: 42, pulse: false })}</a>`).join('');
  const links = f.links.map((l) => { const h = href(l.href); return `<a href="${esc(h)}"${ext(h)}>${esc(l.label)}</a>`; }).join('');
  return `<footer class="footer"><div class="container">
    <div class="foot-top"><div class="foot-brand"><a href="#inicio" class="logo">${logoHtml()}</a><p>${rich(f.text)}</p></div>
      <div class="foot-links">${links}</div><div class="foot-soc">${socials}</div></div>
    <div class="foot-bottom"><span>${esc(f.copyright)}</span>
      <span>${f.email ? esc(f.email) : ''}${f.email && f.phone ? ' · ' : ''}${esc(f.phone)}</span></div></div></footer>`;
}

function renderWhatsapp() {
  const w = cfg.whatsapp;
  if (!w.enabled) return '';
  return `<a class="wa-float ${w.position === 'left' ? 'left' : 'right'}${w.pulse ? ' pulse' : ''}" href="${esc(waLink())}" target="_blank" rel="noopener" style="--wa:${esc(w.color)}" aria-label="WhatsApp">
    <span class="wa-ic">${icon('whatsapp')}</span>${w.label ? `<span class="wa-label">${esc(w.label)}</span>` : ''}</a>`;
}

const RENDERERS = {
  hero: renderHero, logos: renderLogos, stats: renderStats, about: renderAbout, services: renderServices,
  method: renderMethod, results: renderResults, testimonials: renderTestimonials, pricing: renderPricing,
  faq: renderFaq, finalCta: renderFinalCta,
};
const ENABLE_KEY = { hero: 'hero', logos: 'logos', stats: 'stats', about: 'about', services: 'services', method: 'method', results: 'results', testimonials: 'testimonials', pricing: 'pricing', faq: 'faq', finalCta: 'finalCta' };

function sectionOrder() {
  const order = (cfg.order || []).filter((k) => RENDERERS[k]);
  for (const k of Object.keys(RENDERERS)) if (!order.includes(k)) order.push(k);
  return order;
}

/* ---------- comportamentos ---------- */
function initNav() {
  const nav = document.querySelector('.nav');
  if (!nav) return;
  const onScroll = () => nav.classList.toggle('scrolled', scrollY > 20);
  onScroll();
  addEventListener('scroll', onScroll, { passive: true });
  cleanups.push(() => removeEventListener('scroll', onScroll));
  nav.querySelector('.nav-toggle')?.addEventListener('click', () => nav.classList.toggle('open'));
  nav.querySelectorAll('.theme-switch').forEach((el) => {
    syncSwitch(el);
    el.addEventListener('click', (ev) => {
      const b = ev.target.closest('button[data-mode]');
      if (b && b.dataset.mode !== themeMode()) setThemeMode(b.dataset.mode);
    });
  });
  nav.querySelectorAll('.mobile-menu a').forEach((a) => a.addEventListener('click', () => nav.classList.remove('open')));
}

function initReveal() {
  const els = document.querySelectorAll('.reveal');
  if (!document.body.classList.contains('fx-reveal') || !('IntersectionObserver' in window)) {
    els.forEach((el) => el.classList.add('in'));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  els.forEach((el) => io.observe(el));
  cleanups.push(() => io.disconnect());
}

function initCounters() {
  const els = document.querySelectorAll('.count');
  const run = (el) => {
    const to = Number(el.dataset.to) || 0;
    const dec = (String(el.dataset.to).split('.')[1] || '').length;
    if (document.body.classList.contains('no-anim')) { el.textContent = to.toLocaleString('pt-BR', { minimumFractionDigits: dec }); return; }
    const t0 = performance.now(), dur = 1800;
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / dur), v = to * (1 - Math.pow(1 - p, 4));
      el.textContent = v.toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  if (!('IntersectionObserver' in window)) { els.forEach(run); return; }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => { if (en.isIntersecting) { run(en.target); io.unobserve(en.target); } });
  }, { threshold: 0.4 });
  els.forEach((el) => io.observe(el));
  cleanups.push(() => io.disconnect());
}

function initCarousels() {
  document.querySelectorAll('.carousel').forEach((c) => {
    const track = c.querySelector('.carousel-track');
    const slides = [...track.children];
    const dotsEl = c.querySelector('.dots');
    if (!slides.length) return;
    const step = () => slides[0].getBoundingClientRect().width + parseFloat(getComputedStyle(track).columnGap || 0);
    const pages = () => Math.max(1, Math.round((track.scrollWidth - track.clientWidth) / step()) + 1);
    const current = () => Math.round(track.scrollLeft / step());
    const go = (i) => {
      const n = pages();
      const idx = ((i % n) + n) % n;
      track.scrollTo({ left: idx * step(), behavior: 'smooth' });
    };
    const drawDots = () => {
      const n = pages();
      dotsEl.innerHTML = Array.from({ length: n }, (_, i) => `<button aria-label="Ir para ${i + 1}" class="${i === current() ? 'on' : ''}"></button>`).join('');
      dotsEl.querySelectorAll('button').forEach((b, i) => b.addEventListener('click', () => go(i)));
    };
    const onScroll = () => dotsEl.querySelectorAll('button').forEach((b, i) => b.classList.toggle('on', i === current()));
    track.addEventListener('scroll', onScroll, { passive: true });
    c.querySelector('.c-prev').addEventListener('click', () => go(current() - 1));
    c.querySelector('.c-next').addEventListener('click', () => go(current() + 1));
    drawDots();
    addEventListener('resize', drawDots);
    let timer = null, paused = false;
    if (c.dataset.autoplay === '1' && !document.body.classList.contains('no-anim')) {
      timer = setInterval(() => { if (!paused && !document.hidden) go(current() + 1); }, Number(c.dataset.interval) || 5000);
      c.addEventListener('mouseenter', () => (paused = true));
      c.addEventListener('mouseleave', () => (paused = false));
      c.addEventListener('touchstart', () => (paused = true), { passive: true });
    }
    cleanups.push(() => { clearInterval(timer); removeEventListener('resize', drawDots); });
  });
}

function initTilt() {
  if (!cfg.effects.tilt || document.body.classList.contains('no-anim') || matchMedia('(hover: none)').matches) return;
  document.querySelectorAll('.tilt, .card').forEach((el) => {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      el.style.setProperty('--mx', x * 100 + '%');
      el.style.setProperty('--my', y * 100 + '%');
      if (el.classList.contains('tilt')) el.style.transform = `perspective(900px) rotateX(${(0.5 - y) * 6}deg) rotateY(${(x - 0.5) * 8}deg) translateY(-4px)`;
    });
    el.addEventListener('pointerleave', () => { el.style.transform = ''; });
  });
}

function initCursorGlow() {
  const glow = document.querySelector('.cursor-glow');
  if (!glow) return;
  if (!cfg.effects.cursorGlow || document.body.classList.contains('no-anim') || matchMedia('(hover: none)').matches) { glow.hidden = true; return; }
  glow.hidden = false;
  let x = innerWidth / 2, y = innerHeight / 3, tx = x, ty = y, raf;
  const move = (e) => { tx = e.clientX; ty = e.clientY; };
  const loop = () => { x += (tx - x) * 0.12; y += (ty - y) * 0.12; glow.style.transform = `translate(${x}px, ${y}px)`; raf = requestAnimationFrame(loop); };
  addEventListener('pointermove', move, { passive: true });
  loop();
  cleanups.push(() => { removeEventListener('pointermove', move); cancelAnimationFrame(raf); });
}

let stopParticles = null;
function restartParticles() { stopParticles?.(); stopParticles = null; initParticles(); }

function initParticles() {
  const canvas = document.querySelector('.particles');
  if (!canvas) return;
  if (!cfg.effects.particles || document.body.classList.contains('no-anim')) { canvas.hidden = true; return; }
  const ctx = canvas.getContext('2d');
  const pal = palette();
  const colors = [pal.primary, pal.secondary, pal.accent];
  let w, h, dots, raf, visible = true;
  const resize = () => {
    const dpr = Math.min(2, devicePixelRatio || 1);
    w = canvas.clientWidth; h = canvas.clientHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = Math.round(Math.min(60, (w * h) / 22000));
    dots = Array.from({ length: count }, () => ({
      x: Math.random() * w, y: Math.random() * h, r: 1 + Math.random() * 3.2,
      vy: 0.15 + Math.random() * 0.5, vx: (Math.random() - 0.5) * 0.2, c: colors[Math.floor(Math.random() * 3)],
      a: 0.15 + Math.random() * 0.45, ph: Math.random() * Math.PI * 2,
    }));
  };
  const draw = () => {
    if (visible) {
      ctx.clearRect(0, 0, w, h);
      for (const d of dots) {
        d.y -= d.vy; d.ph += 0.02; d.x += d.vx + Math.sin(d.ph) * 0.25;
        if (d.y < -10) { d.y = h + 10; d.x = Math.random() * w; }
        ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.globalAlpha = d.a; ctx.strokeStyle = d.c; ctx.lineWidth = 1.2; ctx.stroke();
        ctx.globalAlpha = d.a * 0.35; ctx.fillStyle = d.c; ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    raf = requestAnimationFrame(draw);
  };
  resize(); draw();
  const io = new IntersectionObserver(([en]) => (visible = en.isIntersecting));
  io.observe(canvas);
  addEventListener('resize', resize);
  const stop = () => { cancelAnimationFrame(raf); io.disconnect(); removeEventListener('resize', resize); };
  stopParticles = stop;
  cleanups.push(stop);
}

/* ---------- render ---------- */
function render() {
  cleanups.forEach((fn) => fn());
  cleanups = [];
  applyTheme();
  loadFonts();
  applyMeta();
  const scroll = scrollY;
  const sections = sectionOrder().filter((k) => cfg[ENABLE_KEY[k]]?.enabled !== false).map((k) => RENDERERS[k]()).join('');
  document.getElementById('app').innerHTML = `
    ${cfg.effects.blobs ? '<div class="bg-blobs" aria-hidden="true"><span></span><span></span><span></span></div>' : ''}
    <div class="cursor-glow" aria-hidden="true" hidden></div>
    ${renderAnnouncement()}${renderNav()}<main>${sections}</main>${renderFooter()}${renderWhatsapp()}`;
  if (!firstRender) scrollTo(0, scroll);
  firstRender = false;
  initNav(); initReveal(); initCounters(); initCarousels(); initTilt(); initCursorGlow(); initParticles();
  document.getElementById('loader')?.classList.add('done');
}

async function loadConfig() {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    const r = await fetch('/api/config', { signal: ctrl.signal, cache: 'no-store' });
    clearTimeout(timer);
    if (r.ok) {
      const j = await r.json();
      if (j && j.config) return deepMerge(DEFAULT_CONFIG, j.config);
    }
  } catch { /* usa o padrão */ }
  return clone(DEFAULT_CONFIG);
}

if (isPreview) {
  // Pré-visualização dentro do painel: recebe a configuração por postMessage.
  addEventListener('message', (e) => {
    if (e.origin !== location.origin || !e.data) return;
    if (e.data.type === 'config') { cfg = deepMerge(DEFAULT_CONFIG, e.data.config); render(); }
    if (e.data.type === 'scrollTo') {
      const el = e.data.id === 'top' ? document.body : document.getElementById(e.data.id);
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
  parent.postMessage({ type: 'preview-ready' }, location.origin);
} else {
  cfg = await loadConfig();
  render();
}

export { SECTION_IDS };
