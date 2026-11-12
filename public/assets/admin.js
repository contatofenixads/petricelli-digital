import { DEFAULT_CONFIG, PRESETS, FONTS, SECTION_IDS, SECTION_LABELS, deepMerge, clone } from './defaults.js';
import { icon, ICON_NAMES } from './icons.js';

/* ---------- utilidades ---------- */
const $ = (s, el = document) => el.querySelector(s);
function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'value') el.value = v;
    else if (k === 'checked') el.checked = !!v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    el.append(kid instanceof Node ? kid : document.createTextNode(kid));
  }
  return el;
}
const ic = (n) => h('span', { class: 'ico', html: icon(n) });
const store = {
  get: (k) => { try { return sessionStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { sessionStorage.setItem(k, v); } catch { /* ignora */ } },
  del: (k) => { try { sessionStorage.removeItem(k); } catch { /* ignora */ } },
};
const getPath = (obj, path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
function setPath(obj, path, val) {
  const ks = path.split('.');
  let o = obj;
  ks.slice(0, -1).forEach((k) => { if (o[k] == null) o[k] = {}; o = o[k]; });
  o[ks.at(-1)] = val;
}

const state = {
  cfg: null, saved: '', token: store.get('rl_token'), tab: 'brand', storage: null,
  device: 'desktop', open: new Set(), view: 'edit',
};

/* ---------- definição dos campos ---------- */
const T = (path, label, x = {}) => ({ type: 'text', path, label, ...x });
const TA = (path, label, x = {}) => ({ type: 'textarea', path, label, ...x });
const C = (path, label) => ({ type: 'color', path, label });
const TG = (path, label, x = {}) => ({ type: 'toggle', path, label, ...x });
const R = (path, label, min, max, step = 1, unit = '', x = {}) => ({ type: 'range', path, label, min, max, step, unit, ...x });
const S = (path, label, options, x = {}) => ({ type: 'select', path, label, options, ...x });
const IMG = (path, label, x = {}) => ({ type: 'image', path, label, ...x });
const ICN = (path, label = 'Ícone') => ({ type: 'icon', path, label });
const L = (path, label, x = {}) => ({ type: 'link', path, label, ...x });
const N = (path, label, x = {}) => ({ type: 'number', path, label, ...x });
const HD = (label) => ({ type: 'heading', label });
const INFO = (text) => ({ type: 'info', text });
const LIST = (path, label, fields, newItem, titleKey, x = {}) => ({ type: 'list', path, label, fields, newItem, titleKey, ...x });
const EN = (path) => TG(path, 'Exibir esta seção');

const RICH = 'Use *palavra* para destacar e **palavra** para negrito.';
const LINK_HINT = 'Digite "whatsapp" para abrir seu WhatsApp, "#secao" para rolar até uma seção, ou cole uma URL.';
const ICON_STYLES = [['glass', 'Vidro (glass)'], ['solid', 'Sólido'], ['gradient', 'Gradiente'], ['outline', 'Contorno']];
const fontOptions = FONTS.map((f) => [f.name, f.name]);

const TABS = [
  { group: 'Aparência' },
  {
    id: 'brand', label: 'Marca & logo', icon: 'sparkles', section: 'top', desc: 'Nome, logotipo e favicon da sua marca.',
    fields: [
      T('brand.name', 'Nome da marca'),
      T('brand.tagline', 'Slogan curto (abaixo do nome)'),
      T('brand.person', 'Nome da profissional'),
      S('brand.logoType', 'Tipo de logo', [['text', 'Ícone + texto'], ['image', 'Imagem (PNG/SVG)']], { rerender: true }),
      { ...ICN('brand.logoIcon', 'Ícone do logo'), show: (c) => c.brand.logoType !== 'image' },
      { ...IMG('brand.logoImage', 'Imagem do logo'), show: (c) => c.brand.logoType === 'image' },
      { ...R('brand.logoHeight', 'Altura do logo', 20, 90, 1, 'px'), show: (c) => c.brand.logoType === 'image' },
      IMG('meta.favicon', 'Favicon (ícone da aba)', { hint: 'Imagem quadrada, de preferência PNG ou SVG.' }),
    ],
  },
  {
    id: 'colors', label: 'Cores & estilo', icon: 'palette', section: 'inicio', desc: 'Escolha um tema pronto ou personalize cada cor.',
    fields: [
      { type: 'presets' },
      HD('Base'),
      C('theme.bg', 'Fundo da página'), C('theme.surface', 'Superfície (cards)'), C('theme.surface2', 'Superfície secundária'),
      C('theme.text', 'Texto principal'), C('theme.muted', 'Texto secundário'),
      HD('Cores da marca'),
      C('theme.primary', 'Primária'), C('theme.secondary', 'Secundária'), C('theme.accent', 'Destaque'),
      HD('Botões (CTA)'),
      TG('theme.ctaGradient', 'Botão com gradiente', { rerender: true }),
      C('theme.ctaBg1', 'Cor do botão'),
      { ...C('theme.ctaBg2', 'Segunda cor do gradiente'), show: (c) => c.theme.ctaGradient },
      C('theme.ctaText', 'Cor do texto do botão'),
      S('theme.ctaStyle', 'Formato do botão', [['pill', 'Pílula (redondo)'], ['rounded', 'Arredondado'], ['square', 'Quadrado']]),
      TG('effects.ctaShine', 'Brilho passando no botão'),
      HD('Formas e detalhes'),
      R('theme.radius', 'Arredondamento dos cantos', 0, 40, 1, 'px'),
      S('theme.iconStyle', 'Estilo dos ícones', ICON_STYLES),
      S('theme.highlightStyle', 'Estilo das palavras destacadas', [['serif', 'Itálico elegante + gradiente'], ['gradient', 'Gradiente'], ['solid', 'Cor primária'], ['underline', 'Sublinhado marca-texto'], ['marker', 'Marcador']]),
    ],
  },
  {
    id: 'type', label: 'Tipografia', icon: 'type', section: 'inicio', desc: 'Fontes do Google Fonts carregadas automaticamente.',
    fields: [
      S('theme.headingFont', 'Fonte dos títulos', fontOptions),
      S('theme.headingWeight', 'Peso dos títulos', [[400, 'Regular'], [500, 'Médio'], [600, 'Semi-negrito'], [700, 'Negrito'], [800, 'Extra-negrito']], { num: true }),
      S('theme.bodyFont', 'Fonte do texto', fontOptions),
      S('theme.accentFont', 'Fonte de destaque (itálico)', fontOptions, { hint: 'Usada nas palavras destacadas e na assinatura.' }),
      R('theme.baseSize', 'Tamanho base do texto', 14, 20, 1, 'px'),
      R('theme.headingScale', 'Escala dos títulos', 0.75, 1.35, 0.05, 'x'),
    ],
  },
  {
    id: 'effects', label: 'Efeitos & animações', icon: 'wand', section: 'inicio', desc: 'Ligue ou desligue cada efeito visual.',
    fields: [
      TG('effects.animations', 'Animações ativas (geral)'),
      TG('effects.reveal', 'Elementos surgem ao rolar a página'),
      TG('effects.blobs', 'Luzes coloridas no fundo'),
      TG('effects.particles', 'Bolhas de laboratório no topo'),
      TG('effects.cursorGlow', 'Brilho que segue o mouse'),
      TG('effects.grain', 'Textura granulada'),
      TG('effects.tilt', 'Cards com efeito 3D ao passar o mouse'),
      TG('effects.iconPulse', 'Ícones das seções pulsando'),
      R('effects.pulseIntensity', 'Intensidade do pulsar', 0, 2, 0.1, 'x'),
      R('effects.floatSpeed', 'Velocidade da flutuação', 0.3, 2.5, 0.1, 'x'),
    ],
  },
  { id: 'sections', label: 'Seções & ordem', icon: 'layout', section: 'top', desc: 'Mostre, esconda e reorganize as seções.', fields: [{ type: 'sections' }] },
  { group: 'Conteúdo' },
  {
    id: 'announcement', label: 'Banner do topo', icon: 'megaphone', section: 'top', desc: 'Faixa de aviso acima do menu.',
    fields: [
      TG('announcement.enabled', 'Exibir banner'),
      T('announcement.text', 'Texto', { hint: RICH }),
      T('announcement.linkText', 'Texto do botão'),
      L('announcement.link', 'Link do botão'),
      C('announcement.bg1', 'Cor 1 do fundo'), C('announcement.bg2', 'Cor 2 do fundo'), C('announcement.textColor', 'Cor do texto'),
    ],
  },
  {
    id: 'nav', label: 'Menu', icon: 'list', section: 'top', desc: 'Links do menu e botão de ação.',
    fields: [
      TG('nav.sticky', 'Menu fixo ao rolar'),
      T('nav.ctaText', 'Texto do botão do menu'),
      L('nav.ctaLink', 'Link do botão do menu'),
      LIST('nav.links', 'Links do menu', [T('label', 'Texto'), L('href', 'Link')], { label: 'Novo link', href: '#' }, 'label'),
    ],
  },
  {
    id: 'hero', label: 'Topo (hero)', icon: 'star', section: 'inicio', desc: 'A primeira impressão: título, foto e chamadas.',
    fields: [
      T('hero.badge', 'Etiqueta acima do título'),
      TA('hero.title', 'Título principal', { hint: RICH, rows: 3 }),
      TA('hero.subtitle', 'Subtítulo', { rows: 4 }),
      HD('Botões'),
      T('hero.cta1Text', 'Botão principal — texto'), L('hero.cta1Link', 'Botão principal — link'),
      T('hero.cta2Text', 'Botão secundário — texto'), L('hero.cta2Link', 'Botão secundário — link'),
      HD('Foto'),
      IMG('hero.image', 'Foto da Sabrina', { hint: 'Ideal: foto vertical ou quadrada, fundo limpo.' }),
      S('hero.imageShape', 'Formato da foto', [['blob', 'Orgânico animado'], ['circle', 'Círculo'], ['rounded', 'Arredondado'], ['arch', 'Arco']]),
      HD('Prova social'),
      T('hero.proofText', 'Texto de prova social', { hint: RICH }),
      T('hero.proofAvatars', 'Iniciais nos avatares (separe por vírgula)'),
      LIST('hero.cards', 'Cards flutuantes (até 2)', [ICN('icon'), C('color', 'Cor do ícone'), T('value', 'Número'), T('label', 'Descrição')], { icon: 'star', color: '#8B5CF6', value: '+100%', label: 'descrição' }, 'value', { max: 2 }),
    ],
  },
  {
    id: 'floating', label: 'Ícones flutuantes', icon: 'atom', section: 'inicio', desc: 'Os ícones que orbitam a foto no topo.',
    fields: [
      TG('floatingIcons.enabled', 'Exibir ícones flutuantes'),
      S('floatingIcons.style', 'Estilo', ICON_STYLES),
      R('floatingIcons.size', 'Tamanho', 36, 100, 1, 'px'),
      R('floatingIcons.radius', 'Distância do centro', 30, 55, 1, '%'),
      TG('floatingIcons.pulse', 'Efeito pulsar'),
      TG('floatingIcons.rotate', 'Órbita girando'),
      R('floatingIcons.rotateSpeed', 'Duração de uma volta', 20, 240, 5, 's'),
      TG('floatingIcons.showLabels', 'Mostrar nomes abaixo dos ícones'),
      LIST('floatingIcons.items', 'Ícones', [ICN('icon'), C('color', 'Cor'), IMG('image', 'Imagem própria (substitui o ícone)'), T('label', 'Nome')], { icon: 'sparkles', color: '#8B5CF6', image: '', label: 'Novo' }, 'label'),
    ],
  },
  {
    id: 'logos', label: 'Carrossel de logos', icon: 'grid', section: 'logos', desc: 'Faixa infinita com plataformas, clientes ou parceiros.',
    fields: [
      EN('logos.enabled'),
      T('logos.title', 'Nome da seção', { hint: 'Ex.: Clientes e parceiros, Marcas que confiam no nosso trabalho. ' + RICH }),
      S('logos.mode', 'O que mostrar', [['logos', 'Logos de clientes e parceiros (imagens)'], ['icons', 'Ícones e nomes (plataformas e ferramentas)']], { rerender: true }),
      INFO('Envie os logos em PNG com fundo transparente ou SVG. Sem imagem, o nome aparece escrito no lugar do logo.'),
      HD('Movimento'),
      R('logos.velocity', 'Velocidade', 10, 200, 5, ' px/s', { hint: 'Quanto maior, mais rápido o carrossel passa.' }),
      S('logos.direction', 'Direção', [['left', 'Da direita para a esquerda'], ['right', 'Da esquerda para a direita']]),
      TG('logos.pauseOnHover', 'Pausar quando o mouse passar por cima'),
      HD('Tamanho e aparência'),
      R('logos.size', 'Tamanho dos logos', 24, 240, 2, ' px', { def: 72, show: (c) => c.logos.mode === 'logos', hint: 'Altura de cada logo. Imagens de qualquer tamanho (ex.: 1080 × 1080) são redimensionadas automaticamente.' }),
      S('logos.shape', 'Formato da área do logo', [['auto', 'Proporção original da imagem'], ['square', 'Quadrado (ideal para logos 1080 × 1080)'], ['wide', 'Retângulo (largura 2× a altura)']], { show: (c) => c.logos.mode === 'logos' }),
      R('logos.radius', 'Cantos arredondados', 0, 50, 1, '%', { def: 0, show: (c) => c.logos.mode === 'logos', hint: '50% no formato quadrado deixa o logo redondo.' }),
      R('logos.gap', 'Espaço entre os logos', 16, 200, 4, ' px', { def: 56, show: (c) => c.logos.mode === 'logos' }),
      TG('logos.grayscale', 'Logos em tons de cinza (colorem ao passar o mouse)'),
      TG('logos.framed', 'Colocar cada logo dentro de um cartão', { show: (c) => c.logos.mode === 'logos' }),
      { type: 'custom', show: (c) => c.logos.mode === 'logos', render: () => logosLivePreview() },
      LIST('logos.items', 'Logos', [
        T('name', 'Nome da marca'),
        IMG('image', 'Imagem do logo'),
        R('zoom', 'Zoom deste logo', 50, 300, 5, '%', { def: 100, show: (c) => c.logos.mode === 'logos', hint: 'Aumente para cortar a borda vazia de logos quadrados e deixá-los do tamanho dos outros.' }),
        { ...ICN('icon'), show: (c) => c.logos.mode !== 'logos' },
        L('link', 'Link ao clicar (opcional)', { hint: 'Site ou Instagram da marca. Deixe vazio para não ter link.' }),
      ], { name: 'Nova marca', icon: 'star', image: '', link: '', zoom: 100 }, 'name'),
    ],
  },
  {
    id: 'stats', label: 'Números', icon: 'hash', section: 'numeros', desc: 'Contadores animados.',
    fields: [
      EN('stats.enabled'),
      LIST('stats.items', 'Números', [T('prefix', 'Antes do número'), N('value', 'Número'), T('suffix', 'Depois do número'), T('label', 'Descrição')], { prefix: '+', value: 100, suffix: '', label: 'descrição' }, 'label'),
    ],
  },
  {
    id: 'about', label: 'Sobre a Sabrina', icon: 'heart', section: 'sobre', desc: 'Apresentação da profissional.',
    fields: [
      EN('about.enabled'),
      T('about.kicker', 'Etiqueta'), T('about.title', 'Título', { hint: RICH }),
      TA('about.text', 'Texto', { rows: 8, hint: 'Deixe uma linha em branco entre parágrafos. ' + RICH }),
      IMG('about.image', 'Foto'),
      T('about.badgeValue', 'Selo — número'), T('about.badgeLabel', 'Selo — texto'),
      LIST('about.highlights', 'Destaques', [ICN('icon'), T('text', 'Texto')], { icon: 'check', text: 'Novo destaque' }, 'text'),
      T('about.signature', 'Assinatura'),
      T('about.ctaText', 'Texto do botão'), L('about.ctaLink', 'Link do botão'),
    ],
  },
  {
    id: 'services', label: 'Serviços', icon: 'layers', section: 'servicos', desc: 'Cards de serviços com ícones.',
    fields: [
      EN('services.enabled'),
      T('services.kicker', 'Etiqueta'), T('services.title', 'Título', { hint: RICH }), TA('services.subtitle', 'Subtítulo', { rows: 2 }),
      S('services.columns', 'Colunas', [[2, '2 colunas'], [3, '3 colunas'], [4, '4 colunas']], { num: true }),
      LIST('services.items', 'Serviços', [ICN('icon'), C('color', 'Cor'), T('title', 'Título'), TA('text', 'Descrição', { rows: 3 })], { icon: 'star', color: '#8B5CF6', title: 'Novo serviço', text: 'Descrição do serviço.' }, 'title'),
    ],
  },
  {
    id: 'method', label: 'Método', icon: 'flask', section: 'metodo', desc: 'Etapas do seu processo.',
    fields: [
      EN('method.enabled'),
      T('method.kicker', 'Etiqueta'), T('method.title', 'Título', { hint: RICH }), TA('method.subtitle', 'Subtítulo', { rows: 2 }),
      LIST('method.steps', 'Etapas', [ICN('icon'), T('title', 'Título'), TA('text', 'Descrição', { rows: 3 })], { icon: 'check', title: 'Nova etapa', text: 'Descrição.' }, 'title'),
    ],
  },
  {
    id: 'results', label: 'Resultados (carrossel)', icon: 'trending-up', section: 'resultados', desc: 'Cases em carrossel.',
    fields: [
      EN('results.enabled'),
      T('results.kicker', 'Etiqueta'), T('results.title', 'Título', { hint: RICH }), TA('results.subtitle', 'Subtítulo', { rows: 2 }),
      TG('results.autoplay', 'Passar sozinho'), R('results.interval', 'Tempo por slide', 2, 15, 1, 's'),
      LIST('results.items', 'Cases', [IMG('image', 'Imagem'), ICN('icon', 'Ícone (se não houver imagem)'), T('tag', 'Segmento'), T('metric', 'Resultado'), T('metricLabel', 'Descrição do resultado'), T('title', 'Título'), TA('text', 'Texto', { rows: 3 })], { image: '', icon: 'chart', tag: 'Segmento', metric: '+100%', metricLabel: 'resultado', title: 'Novo case', text: 'Descrição.' }, 'title'),
    ],
  },
  {
    id: 'testimonials', label: 'Depoimentos (carrossel)', icon: 'message', section: 'depoimentos', desc: 'Depoimentos de clientes em carrossel.',
    fields: [
      EN('testimonials.enabled'),
      T('testimonials.kicker', 'Etiqueta'), T('testimonials.title', 'Título', { hint: RICH }),
      TG('testimonials.autoplay', 'Passar sozinho'), R('testimonials.interval', 'Tempo por slide', 2, 15, 1, 's'),
      LIST('testimonials.items', 'Depoimentos', [IMG('avatar', 'Foto'), T('name', 'Nome'), T('role', 'Cargo / empresa'), R('rating', 'Estrelas', 1, 5, 1), TA('text', 'Depoimento', { rows: 4 })], { avatar: '', name: 'Nome', role: 'Empresa', rating: 5, text: 'Depoimento.' }, 'name'),
    ],
  },
  {
    id: 'pricing', label: 'Planos', icon: 'dollar', section: 'planos', desc: 'Pacotes e preços.',
    fields: [
      EN('pricing.enabled'),
      T('pricing.kicker', 'Etiqueta'), T('pricing.title', 'Título', { hint: RICH }), TA('pricing.subtitle', 'Subtítulo', { rows: 2 }),
      LIST('pricing.items', 'Planos', [T('name', 'Nome'), T('price', 'Preço'), T('period', 'Período (ex: /mês)'), TA('description', 'Descrição', { rows: 2 }), TA('features', 'Itens inclusos (um por linha)', { rows: 5 }), T('ctaText', 'Texto do botão'), L('ctaLink', 'Link do botão'), TG('featured', 'Plano em destaque'), T('badge', 'Selo (ex: Mais escolhido)')], { name: 'Novo plano', price: 'R$ 0', period: '/mês', description: '', features: 'Item 1\nItem 2', ctaText: 'Quero este', ctaLink: 'whatsapp', featured: false, badge: '' }, 'name'),
    ],
  },
  {
    id: 'faq', label: 'Perguntas frequentes', icon: 'help', section: 'faq', desc: 'Acordeão de dúvidas.',
    fields: [
      EN('faq.enabled'),
      T('faq.kicker', 'Etiqueta'), T('faq.title', 'Título', { hint: RICH }),
      LIST('faq.items', 'Perguntas', [T('q', 'Pergunta'), TA('a', 'Resposta', { rows: 4 })], { q: 'Nova pergunta?', a: 'Resposta.' }, 'q'),
    ],
  },
  {
    id: 'finalCta', label: 'Chamada final', icon: 'rocket', section: 'contato', desc: 'O grande banner de conversão no fim da página.',
    fields: [
      EN('finalCta.enabled'),
      TA('finalCta.title', 'Título', { rows: 2, hint: RICH }), TA('finalCta.subtitle', 'Subtítulo', { rows: 3 }),
      T('finalCta.ctaText', 'Texto do botão'), L('finalCta.ctaLink', 'Link do botão'),
      T('finalCta.note', 'Observação abaixo do botão'),
      IMG('finalCta.bgImage', 'Imagem de fundo (opcional)'),
      TG('finalCta.showIcons', 'Ícones flutuantes decorativos'),
    ],
  },
  {
    id: 'footer', label: 'Rodapé', icon: 'layout', section: 'contato', desc: 'Contatos, redes sociais e links finais.',
    fields: [
      TA('footer.text', 'Texto', { rows: 2 }),
      T('footer.email', 'E-mail'), T('footer.phone', 'Telefone'),
      T('footer.instagram', 'Instagram (URL)'), T('footer.tiktok', 'TikTok (URL)'), T('footer.linkedin', 'LinkedIn (URL)'), T('footer.youtube', 'YouTube (URL)'),
      T('footer.copyright', 'Direitos autorais'),
      LIST('footer.links', 'Links', [T('label', 'Texto'), L('href', 'Link')], { label: 'Novo link', href: '#' }, 'label'),
    ],
  },
  {
    id: 'whatsapp', label: 'WhatsApp', icon: 'whatsapp', section: 'contato', desc: 'Botão flutuante e destino de todos os links "whatsapp".',
    fields: [
      TG('whatsapp.enabled', 'Exibir botão flutuante'),
      T('whatsapp.number', 'Número com DDI e DDD', { hint: 'Ex: 5511999999999 (somente números).' }),
      TA('whatsapp.message', 'Mensagem inicial', { rows: 3 }),
      T('whatsapp.label', 'Texto ao passar o mouse'),
      S('whatsapp.position', 'Posição', [['right', 'Direita'], ['left', 'Esquerda']]),
      C('whatsapp.color', 'Cor'),
      TG('whatsapp.pulse', 'Efeito pulsar'),
    ],
  },
  { group: 'Sistema' },
  {
    id: 'seo', label: 'SEO & compartilhamento', icon: 'search', section: 'top', desc: 'Como o site aparece no Google e no WhatsApp.',
    fields: [
      T('meta.title', 'Título da página'),
      TA('meta.description', 'Descrição', { rows: 3 }),
      IMG('meta.ogImage', 'Imagem de compartilhamento (1200×630)'),
    ],
  },
  { id: 'backup', label: 'Backup & sessão', icon: 'save', section: 'top', desc: 'Exporte, importe ou restaure a configuração.', fields: [{ type: 'backup' }] },
];

/* ---------- endereços (subdomínios) ---------- */
const SUB_RE = /^(editar|admin|orcamento)\./;
const siteUrl = () => (SUB_RE.test(location.hostname) ? `${location.protocol}//${location.host.replace(SUB_RE, '')}/` : '/');
const crmUrl = () => (SUB_RE.test(location.hostname) ? `${location.protocol}//${location.host.replace(SUB_RE, 'admin.')}/` : '/crm');

/* ---------- API ---------- */
async function api(path, body) {
  return fetch(path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'content-type': 'application/json', 'x-admin-token': state.token || '' },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store',
  });
}

function toast(msg, kind = 'ok') {
  const el = h('div', { class: 'toast ' + kind }, ic(kind === 'err' ? 'x' : kind === 'warn' ? 'help' : 'check'), h('span', {}, msg));
  $('#toasts').append(el);
  setTimeout(() => el.classList.add('out'), 3800);
  setTimeout(() => el.remove(), 4300);
}

/* ---------- login ---------- */
function renderLogin(msg = '') {
  const root = $('#admin');
  root.className = 'login-wrap';
  const err = h('p', { class: 'login-err' }, msg);
  const user = h('input', { type: 'text', placeholder: 'Usuário', autocomplete: 'username', value: 'admin', required: true, id: 'login-user' });
  const input = h('input', { type: 'password', placeholder: 'Senha', autocomplete: 'current-password', required: true, id: 'login-pass' });
  const submit = h('button', { class: 'abtn primary big', type: 'submit' }, 'Entrar', ic('arrow-right'));
  const form = h('form', {
    class: 'login-card',
    onsubmit: async (e) => {
      e.preventDefault();
      submit.disabled = true;
      err.textContent = '';
      try {
        const r = await fetch('/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: user.value, password: input.value }) });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || 'Não foi possível entrar.');
        if (!j.user?.perms?.includes('site')) throw new Error('Seu usuário não tem acesso ao editor do site.');
        state.token = j.token;
        store.set('rl_token', j.token);
        await boot();
      } catch (ex) {
        err.textContent = ex.message;
        submit.disabled = false;
      }
    },
  },
  h('div', { class: 'login-logo', html: icon('flask') }),
  h('h1', {}, 'Editor do site'),
  h('p', { class: 'login-sub' }, 'Entre para editar cores, textos, imagens e efeitos do site.'),
  user, input, submit, err,
  h('a', { class: 'login-back', href: siteUrl() }, ic('chevron-left'), 'Voltar ao site'));
  root.replaceChildren(h('div', { class: 'login-bg' }, h('span'), h('span')), form);
  input.focus();
}

/* ---------- editor ---------- */
function isDirty() { return JSON.stringify(state.cfg) !== state.saved; }
function refreshDirty() {
  const d = isDirty();
  const s = $('.save-state');
  if (s) { s.textContent = d ? 'Alterações não publicadas' : 'Tudo publicado'; s.classList.toggle('dirty', d); }
  $('.btn-save')?.toggleAttribute('disabled', !d);
}

let pvTimer;
function pushPreview() {
  clearTimeout(pvTimer);
  pvTimer = setTimeout(() => {
    const fr = $('#pv');
    fr?.contentWindow?.postMessage({ type: 'config', config: state.cfg }, location.origin);
  }, 120);
}
function scrollPreview(id) { $('#pv')?.contentWindow?.postMessage({ type: 'scrollTo', id }, location.origin); }

function update(path, value, rerender = false) {
  setPath(state.cfg, path, value);
  refreshDirty();
  pushPreview();
  if (rerender) renderEditor();
  else document.querySelectorAll('[data-live]').forEach((el) => el.refresh?.());
}

/* ---------- prévia dos logos em tamanho real (dentro do painel) ---------- */
function logosLivePreview() {
  const box = h('div', { class: 'logo-live', 'data-live': 'logos' });
  box.refresh = () => {
    const l = state.cfg.logos || {};
    const t = state.cfg.theme || {};
    const sz = Number(l.size) || 72;
    const r = Math.round((sz * Math.min(50, Math.max(0, Number(l.radius) || 0))) / 100);
    const boxW = l.shape === 'square' ? sz : l.shape === 'wide' ? sz * 2 : null;
    const row = h('div', { class: 'logo-live-row', style: `gap:${Number(l.gap) || 56}px;background:${t.bg || '#0B0912'};color:${t.text || '#fff'}` });
    (l.items || []).forEach((x) => {
      const z = Math.min(4, Math.max(0.2, (Number(x.zoom) || 100) / 100));
      const cell = h('div', { class: 'logo-live-cell' + (l.framed ? ' framed' : '') + (l.grayscale ? ' gray' : ''), style: `height:${sz}px` });
      if (x.image) {
        const frame = h('span', { style: `display:block;height:100%;overflow:hidden;border-radius:${r}px;${boxW ? `width:${boxW}px` : ''}` },
          h('img', { src: x.image, alt: x.name || '', style: `display:block;height:100%;${boxW ? 'width:100%' : `width:auto;max-width:${sz * 3.5}px`};object-fit:contain;transform:scale(${z})` }));
        cell.append(frame);
      } else {
        cell.append(h('span', { style: `font-weight:700;white-space:nowrap;font-size:${Math.round(sz * 0.42 * z)}px` }, x.name || ''));
      }
      row.append(cell);
    });
    box.replaceChildren(h('div', { class: 'logo-live-head' }, h('span', {}, 'Prévia em tamanho real'), h('small', {}, `${sz}px de altura`)), h('div', { class: 'logo-live-scroll' }, row));
  };
  box.refresh();
  return box;
}

function field(f, control, hint) {
  return h('div', { class: 'field' + (f.type === 'toggle' ? ' field-toggle' : '') },
    f.label && f.type !== 'toggle' ? h('label', {}, f.label) : null, control, hint ? h('small', {}, hint) : null);
}

function renderField(f, prefix = '', scope = state.cfg) {
  if (f.show && !f.show(state.cfg, scope)) return null;
  const p = prefix + (f.path || '');
  const val = f.path ? getPath(state.cfg, p) : undefined;
  switch (f.type) {
    case 'heading': return h('h4', { class: 'f-head' }, f.label);
    case 'info': return h('p', { class: 'f-info' }, f.text);
    case 'custom': return f.render(p, scope);
    case 'text':
    case 'link':
      return field(f, h('input', { type: 'text', value: val ?? '', list: f.type === 'link' ? 'link-suggestions' : null, oninput: (e) => update(p, e.target.value) }), f.type === 'link' ? (f.hint || LINK_HINT) : f.hint);
    case 'number':
      return field(f, h('input', { type: 'number', value: val ?? 0, step: 'any', oninput: (e) => update(p, e.target.value === '' ? 0 : Number(e.target.value)) }), f.hint);
    case 'textarea':
      return field(f, h('textarea', { rows: f.rows || 3, oninput: (e) => update(p, e.target.value) }, val ?? ''), f.hint);
    case 'range': {
      const v = val ?? f.def ?? f.min;
      const out = h('output', {}, `${v}${f.unit}`);
      const inp = h('input', { type: 'range', min: f.min, max: f.max, step: f.step, value: v, oninput: (e) => { out.textContent = e.target.value + f.unit; update(p, Number(e.target.value)); } });
      return field(f, h('div', { class: 'range' }, inp, out), f.hint);
    }
    case 'color': {
      const txt = h('input', { type: 'text', value: val, maxlength: 7, class: 'hex' });
      const pick = h('input', { type: 'color', value: /^#[\da-f]{6}$/i.test(val) ? val : '#000000' });
      pick.addEventListener('input', () => { txt.value = pick.value.toUpperCase(); update(p, txt.value); });
      txt.addEventListener('input', () => { if (/^#[\da-f]{6}$/i.test(txt.value)) { pick.value = txt.value; update(p, txt.value.toUpperCase()); } });
      return field(f, h('div', { class: 'color' }, h('label', { class: 'swatch' }, pick), txt), f.hint);
    }
    case 'toggle':
      return field(f, h('label', { class: 'switch' },
        h('input', { type: 'checkbox', checked: !!val, onchange: (e) => update(p, e.target.checked, f.rerender) }),
        h('span', { class: 'track' }), h('span', { class: 'sw-label' }, f.label)), f.hint);
    case 'select': {
      const sel = h('select', { onchange: (e) => update(p, f.num ? Number(e.target.value) : e.target.value, f.rerender) },
        f.options.map(([v, l]) => h('option', { value: v, selected: String(v) === String(val) }, l)));
      if (f.path === 'theme.headingFont' || f.path === 'theme.bodyFont' || f.path === 'theme.accentFont') sel.classList.add('font-select');
      return field(f, sel, f.hint);
    }
    case 'image': return field(f, imageControl(p, val), f.hint);
    case 'icon': {
      const b = h('button', { type: 'button', class: 'icon-btn', onclick: () => openIconPicker(val, (name) => update(p, name, true)) }, ic(val || 'sparkles'), h('span', {}, val || 'escolher'), ic('chevron-down'));
      return field(f, b, f.hint);
    }
    case 'list': return listControl(f, p, val || []);
    case 'presets': return presetsControl();
    case 'sections': return sectionsControl();
    case 'backup': return backupControl();
    default: return null;
  }
}

function imageControl(p, val) {
  const fileIn = h('input', { type: 'file', accept: 'image/*', hidden: true });
  const thumb = h('div', { class: 'img-thumb' + (val ? '' : ' empty') }, val ? h('img', { src: val, alt: '' }) : ic('image'));
  const url = h('input', { type: 'text', value: val && !val.startsWith('data:') ? val : '', placeholder: val?.startsWith('data:') ? 'Imagem embutida' : 'Cole uma URL ou envie um arquivo', oninput: (e) => update(p, e.target.value.trim()) });
  const up = h('button', { type: 'button', class: 'abtn small', onclick: () => fileIn.click() }, ic('upload'), 'Enviar');
  const rm = h('button', { type: 'button', class: 'abtn small ghost', title: 'Remover imagem', onclick: () => update(p, '', true) }, ic('trash'));
  fileIn.addEventListener('change', async () => {
    const file = fileIn.files[0];
    if (!file) return;
    up.disabled = true;
    up.lastChild.textContent = 'Enviando…';
    try {
      const u = await uploadImage(file);
      update(p, u, true);
    } catch (ex) {
      toast(ex.message, 'err');
      up.disabled = false;
      up.lastChild.textContent = 'Enviar';
    }
  });
  thumb.addEventListener('click', () => fileIn.click());
  return h('div', { class: 'img-ctl' }, thumb, h('div', { class: 'img-side' }, url, h('div', { class: 'img-actions' }, up, val ? rm : null)), fileIn);
}

function listControl(f, p, items) {
  const wrap = h('div', { class: 'list' });
  const headEl = h('div', { class: 'list-head' }, h('h4', { class: 'f-head' }, f.label), h('span', { class: 'count' }, String(items.length)));
  wrap.append(headEl);
  items.forEach((item, i) => {
    const ip = `${p}.${i}`;
    const open = state.open.has(ip);
    const title = String(item?.[f.titleKey] ?? `Item ${i + 1}`).replace(/\*/g, '').slice(0, 48) || `Item ${i + 1}`;
    const move = (dir) => {
      const arr = clone(items);
      const j = i + dir;
      if (j < 0 || j >= arr.length) return;
      [arr[i], arr[j]] = [arr[j], arr[i]];
      const wasOpen = state.open.has(ip);
      state.open.delete(ip);
      if (wasOpen) state.open.add(`${p}.${j}`);
      update(p, arr, true);
    };
    const card = h('div', { class: 'item' + (open ? ' open' : '') },
      h('div', { class: 'item-head', onclick: (e) => { if (e.target.closest('.item-actions')) return; open ? state.open.delete(ip) : state.open.add(ip); renderEditor(); } },
        item?.icon ? ic(item.icon) : h('span', { class: 'item-n' }, String(i + 1)),
        h('span', { class: 'item-title' }, title),
        h('div', { class: 'item-actions' },
          h('button', { type: 'button', title: 'Subir', onclick: () => move(-1), disabled: i === 0 }, ic('chevron-up')),
          h('button', { type: 'button', title: 'Descer', onclick: () => move(1), disabled: i === items.length - 1 }, ic('chevron-down')),
          h('button', { type: 'button', title: 'Duplicar', disabled: f.max && items.length >= f.max, onclick: () => { const arr = clone(items); arr.splice(i + 1, 0, clone(item)); update(p, arr, true); } }, ic('copy')),
          h('button', { type: 'button', title: 'Remover', class: 'danger', onclick: () => { if (!confirm('Remover este item?')) return; const arr = clone(items); arr.splice(i, 1); state.open.clear(); update(p, arr, true); } }, ic('trash'))),
        h('span', { class: 'item-caret' }, ic('chevron-down'))),
      open ? h('div', { class: 'item-body' }, f.fields.map((sf) => renderField(sf, ip + '.', item))) : null);
    wrap.append(card);
  });
  if (!f.max || items.length < f.max) {
    wrap.append(h('button', { type: 'button', class: 'abtn add', onclick: () => { const arr = clone(items); arr.push(clone(f.newItem)); state.open.add(`${p}.${arr.length - 1}`); update(p, arr, true); } }, ic('plus'), 'Adicionar'));
  }
  return wrap;
}

function presetsControl() {
  const grid = h('div', { class: 'presets' });
  for (const [name, pr] of Object.entries(PRESETS)) {
    const active = state.cfg.theme.preset === name;
    grid.append(h('button', {
      type: 'button', class: 'preset' + (active ? ' on' : ''),
      onclick: () => {
        Object.assign(state.cfg.theme, pr, { preset: name });
        state.cfg.announcement.bg1 = pr.ctaBg1;
        state.cfg.announcement.bg2 = pr.ctaBg2;
        state.cfg.announcement.textColor = pr.ctaText;
        update('theme.preset', name, true);
      },
    },
    h('span', { class: 'pv-swatch', style: `background:${pr.bg}` },
      h('i', { style: `background:linear-gradient(120deg, ${pr.ctaBg1}, ${pr.ctaBg2})` }),
      h('b', { style: `background:${pr.surface}` }), h('em', { style: `background:${pr.accent}` })),
    h('span', {}, name)));
  }
  return h('div', { class: 'field' }, h('label', {}, 'Temas prontos'), grid, h('small', {}, 'Clique para aplicar. Depois ajuste as cores abaixo como quiser.'));
}

function sectionsControl() {
  const order = [...(state.cfg.order || [])];
  for (const k of Object.keys(SECTION_LABELS)) if (!order.includes(k)) order.push(k);
  const list = h('div', { class: 'sec-list' });
  order.forEach((k, i) => {
    const enabled = state.cfg[k]?.enabled !== false;
    const move = (dir) => { const arr = [...order]; const j = i + dir; if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; update('order', arr, true); };
    list.append(h('div', { class: 'sec-row' + (enabled ? '' : ' off') },
      h('span', { class: 'item-n' }, String(i + 1)),
      h('button', { type: 'button', class: 'sec-name', onclick: () => scrollPreview(SECTION_IDS[k]) }, SECTION_LABELS[k]),
      h('label', { class: 'switch mini' }, h('input', { type: 'checkbox', checked: enabled, onchange: (e) => update(`${k}.enabled`, e.target.checked, true) }), h('span', { class: 'track' })),
      h('div', { class: 'item-actions' },
        h('button', { type: 'button', title: 'Subir', disabled: i === 0, onclick: () => move(-1) }, ic('chevron-up')),
        h('button', { type: 'button', title: 'Descer', disabled: i === order.length - 1, onclick: () => move(1) }, ic('chevron-down')))));
  });
  return h('div', {}, h('p', { class: 'f-info' }, 'O menu, o banner do topo e o rodapé ficam sempre nas suas posições.'), list);
}

function backupControl() {
  const imp = h('input', { type: 'file', accept: 'application/json', hidden: true });
  imp.addEventListener('change', async () => {
    try {
      const data = JSON.parse(await imp.files[0].text());
      state.cfg = deepMerge(DEFAULT_CONFIG, data.config || data);
      refreshDirty(); pushPreview(); renderEditor();
      toast('Configuração importada. Clique em Publicar para salvar.');
    } catch { toast('Arquivo inválido.', 'err'); }
  });
  return h('div', { class: 'backup' },
    h('div', { class: 'storage ' + (state.storage ? 'ok' : 'warn') }, ic(state.storage ? 'check' : 'help'),
      h('span', {}, state.storage ? 'Armazenamento conectado: as alterações publicadas ficam salvas na nuvem.' : 'Armazenamento não conectado. Conecte um Vercel Blob ao projeto para publicar alterações.')),
    h('button', { type: 'button', class: 'abtn', onclick: () => {
      const blob = new Blob([JSON.stringify(state.cfg, null, 2)], { type: 'application/json' });
      const a = h('a', { href: URL.createObjectURL(blob), download: `petricelli-digital-config-${new Date().toISOString().slice(0, 10)}.json` });
      a.click(); URL.revokeObjectURL(a.href);
    } }, ic('download'), 'Exportar configuração (.json)'),
    h('button', { type: 'button', class: 'abtn', onclick: () => imp.click() }, ic('upload'), 'Importar configuração'),
    h('button', { type: 'button', class: 'abtn', onclick: () => { if (!confirm('Descartar as alterações não publicadas?')) return; state.cfg = JSON.parse(state.saved); refreshDirty(); pushPreview(); renderEditor(); } }, ic('chevron-left'), 'Desfazer alterações não publicadas'),
    h('button', { type: 'button', class: 'abtn danger', onclick: () => { if (!confirm('Restaurar todo o conteúdo e visual originais? (Só vale depois de publicar.)')) return; state.cfg = clone(DEFAULT_CONFIG); refreshDirty(); pushPreview(); renderEditor(); } }, ic('trash'), 'Restaurar padrão de fábrica'),
    h('button', { type: 'button', class: 'abtn ghost', onclick: logout }, ic('logout'), 'Sair do painel'),
    imp);
}

/* ---------- seletor de ícones ---------- */
function openIconPicker(current, onPick) {
  const close = () => modal.remove();
  const grid = h('div', { class: 'icon-grid' });
  const draw = (q = '') => {
    grid.replaceChildren(...ICON_NAMES.filter((n) => n.includes(q.toLowerCase())).map((n) =>
      h('button', { type: 'button', class: n === current ? 'on' : '', title: n, onclick: () => { onPick(n); close(); } }, ic(n), h('span', {}, n))));
  };
  const search = h('input', { type: 'search', placeholder: 'Buscar ícone…', oninput: (e) => draw(e.target.value) });
  const modal = h('div', { class: 'modal', onclick: (e) => { if (e.target === modal) close(); } },
    h('div', { class: 'modal-card' },
      h('div', { class: 'modal-head' }, h('h3', {}, 'Escolher ícone'), h('button', { type: 'button', class: 'abtn small ghost', onclick: close }, ic('x'))),
      search, grid));
  draw();
  document.body.append(modal);
  search.focus();
}

/* ---------- upload ---------- */
const readDataUrl = (file) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
async function compress(file, max = 1800, q = 0.86) {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL('image/webp', q);
}
async function uploadImage(file) {
  if (!file.type.startsWith('image/')) throw new Error('Envie um arquivo de imagem.');
  const raw = /svg|gif/.test(file.type);
  const dataUrl = raw ? await readDataUrl(file) : await compress(file);
  if (dataUrl.length > 4_000_000) throw new Error('Imagem muito grande. Use uma imagem menor que 3 MB.');
  const r = await api('/api/upload', { name: file.name, dataUrl });
  const j = await r.json().catch(() => ({}));
  if (r.ok && j.url) { toast('Imagem enviada!'); return j.url; }
  if (r.status === 401) { logout(); throw new Error('Sessão expirada. Entre novamente.'); }
  if (r.status === 501) { toast('Armazenamento de imagens não conectado: a imagem foi embutida na configuração.', 'warn'); return dataUrl; }
  throw new Error(j.error || 'Falha ao enviar a imagem.');
}

/* ---------- salvar ---------- */
async function save() {
  const b = $('.btn-save');
  b.disabled = true;
  b.classList.add('loading');
  try {
    const r = await api('/api/config', { config: state.cfg });
    const j = await r.json().catch(() => ({}));
    if (r.status === 401) { logout(); toast('Sessão expirada. Entre novamente.', 'err'); return; }
    if (!r.ok) throw new Error(j.error || 'Não foi possível publicar.');
    state.saved = JSON.stringify(state.cfg);
    toast('Publicado! O site já está atualizado.');
  } catch (ex) {
    toast(ex.message, 'err');
  } finally {
    b.classList.remove('loading');
    refreshDirty();
  }
}

function logout() {
  state.token = null;
  store.del('rl_token');
  renderLogin();
}

/* ---------- layout ---------- */
function renderEditor() {
  const tab = TABS.find((t) => t.id === state.tab);
  $('.ed-title').replaceChildren(ic(tab.icon), tab.label);
  $('.ed-desc').textContent = tab.desc || '';
  const body = $('.ed-body');
  const top = body.scrollTop;
  body.replaceChildren(...tab.fields.map((f) => renderField(f)).filter(Boolean));
  body.scrollTop = top;
  document.querySelectorAll('.tab').forEach((b) => b.classList.toggle('on', b.dataset.id === state.tab));
}

function selectTab(id) {
  if (state.tab !== id) { state.tab = id; state.open.clear(); $('.ed-body').scrollTop = 0; }
  renderEditor();
  const t = TABS.find((x) => x.id === id);
  if (t?.section) scrollPreview(t.section);
  document.body.classList.remove('nav-open');
}

function setDevice(d) {
  state.device = d;
  $('.pv-frame').dataset.device = d;
  document.querySelectorAll('.dev').forEach((b) => b.classList.toggle('on', b.dataset.d === d));
}

function renderApp() {
  const root = $('#admin');
  root.className = 'adm view-' + state.view;
  const nav = h('nav', { class: 'tabs' });
  for (const t of TABS) {
    if (t.group) { nav.append(h('div', { class: 'tab-group' }, t.group)); continue; }
    nav.append(h('button', { type: 'button', class: 'tab', 'data-id': t.id, onclick: () => selectTab(t.id) }, ic(t.icon), h('span', {}, t.label)));
  }
  const datalist = h('datalist', { id: 'link-suggestions' }, ['whatsapp', ...Object.values(SECTION_IDS).map((s) => '#' + s)].map((v) => h('option', { value: v })));
  root.replaceChildren(
    h('aside', { class: 'side' },
      h('a', { class: 'brand', href: siteUrl(), target: '_blank' }, h('span', { class: 'brand-mark', html: icon('flask') }), h('span', {}, h('strong', {}, 'Petricelli Digital'), h('small', {}, 'Painel administrativo'))),
      nav,
      h('div', { class: 'side-foot' }, h('a', { class: 'abtn ghost small', href: siteUrl(), target: '_blank' }, ic('external'), 'Ver site'), h('a', { class: 'abtn ghost small', href: crmUrl() }, ic('layers'), 'CRM'), h('button', { type: 'button', class: 'abtn ghost small', onclick: logout }, ic('logout'), 'Sair'))),
    h('section', { class: 'editor' },
      h('header', { class: 'ed-header' },
        h('button', { type: 'button', class: 'menu-btn', onclick: () => document.body.classList.toggle('nav-open') }, ic('menu')),
        h('div', {}, h('h2', { class: 'ed-title' }), h('p', { class: 'ed-desc' }))),
      h('div', { class: 'ed-body' })),
    h('section', { class: 'preview' },
      h('header', { class: 'pv-bar' },
        h('div', { class: 'devices' },
          ...[['desktop', 'monitor'], ['tablet', 'tablet'], ['mobile', 'smartphone']].map(([d, i]) => h('button', { type: 'button', class: 'dev', 'data-d': d, title: d, onclick: () => setDevice(d) }, ic(i)))),
        h('span', { class: 'save-state' }),
        h('button', { type: 'button', class: 'abtn primary btn-save', onclick: save }, ic('rocket'), h('span', {}, 'Publicar'))),
      h('div', { class: 'pv-stage' }, h('div', { class: 'pv-frame' }, h('iframe', { id: 'pv', src: '/site?preview=1', title: 'Pré-visualização' })))),
    h('button', { type: 'button', class: 'view-toggle', onclick: () => { state.view = state.view === 'edit' ? 'preview' : 'edit'; root.className = 'adm view-' + state.view; } }, ic('eye'), h('span', {}, 'Editar / Ver')),
    datalist);
  setDevice(state.device);
  renderEditor();
  refreshDirty();
}

addEventListener('message', (e) => {
  if (e.origin === location.origin && e.data?.type === 'preview-ready') pushPreview();
});
addEventListener('beforeunload', (e) => { if (state.cfg && state.token && isDirty()) { e.preventDefault(); e.returnValue = ''; } });
addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's' && state.token && state.cfg) { e.preventDefault(); if (isDirty()) save(); }
});

/* ---------- início ---------- */
async function boot() {
  if (!state.token) return renderLogin();
  const check = await fetch('/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: state.token }) }).catch(() => null);
  if (!check || !check.ok) { store.del('rl_token'); state.token = null; return renderLogin(); }
  let saved = null;
  try {
    const r = await api('/api/config');
    const j = await r.json();
    saved = j.config;
    state.storage = !!j.storage;
  } catch { state.storage = false; }
  state.cfg = deepMerge(DEFAULT_CONFIG, saved || {});
  state.saved = JSON.stringify(state.cfg);
  renderApp();
  if (!state.storage) toast('Armazenamento ainda não conectado — veja a aba "Backup & sessão".', 'warn');
}

boot();
