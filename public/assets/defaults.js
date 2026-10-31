// Configuração padrão do site. Tudo aqui pode ser alterado pelo painel /admin.
// Use *texto* para destacar palavras e **texto** para negrito.

export const FONTS = [
  { name: 'Bricolage Grotesque', spec: 'wght@400;500;600;700;800' },
  { name: 'Plus Jakarta Sans', spec: 'wght@400;500;600;700;800' },
  { name: 'Instrument Serif', spec: 'ital@0;1' },
  { name: 'Inter', spec: 'wght@400;500;600;700;800' },
  { name: 'Manrope', spec: 'wght@400;500;600;700;800' },
  { name: 'Outfit', spec: 'wght@400;500;600;700;800' },
  { name: 'Poppins', spec: 'wght@400;500;600;700;800' },
  { name: 'Montserrat', spec: 'wght@400;500;600;700;800' },
  { name: 'DM Sans', spec: 'wght@400;500;600;700;800' },
  { name: 'Sora', spec: 'wght@400;500;600;700;800' },
  { name: 'Space Grotesk', spec: 'wght@400;500;600;700' },
  { name: 'Syne', spec: 'wght@400;500;600;700;800' },
  { name: 'Unbounded', spec: 'wght@400;500;600;700;800' },
  { name: 'Raleway', spec: 'wght@400;500;600;700;800' },
  { name: 'Archivo', spec: 'wght@400;500;600;700;800' },
  { name: 'Lexend', spec: 'wght@400;500;600;700;800' },
  { name: 'Nunito', spec: 'wght@400;500;600;700;800' },
  { name: 'Playfair Display', spec: 'ital,wght@0,400;0,600;0,700;0,800;1,400;1,600' },
  { name: 'Fraunces', spec: 'ital,wght@0,400;0,600;0,700;0,800;1,400;1,600' },
  { name: 'Cormorant Garamond', spec: 'ital,wght@0,400;0,500;0,600;0,700;1,400;1,500' },
  { name: 'Lora', spec: 'ital,wght@0,400;0,600;0,700;1,400;1,600' },
  { name: 'DM Serif Display', spec: 'ital@0;1' },
];

export const PRESETS = {
  'Neon Lab': {
    bg: '#0B0912', surface: '#14111E', surface2: '#1C1828', text: '#F5F3FF', muted: '#A9A3BF',
    primary: '#8B5CF6', secondary: '#EC4899', accent: '#C6F432',
    ctaBg1: '#8B5CF6', ctaBg2: '#EC4899', ctaText: '#FFFFFF',
  },
  'Rosé Clean': {
    bg: '#FFF8F6', surface: '#FFFFFF', surface2: '#FBEDEA', text: '#1F1520', muted: '#6E5E68',
    primary: '#E0457B', secondary: '#FF8A5B', accent: '#7C3AED',
    ctaBg1: '#E0457B', ctaBg2: '#FF8A5B', ctaText: '#FFFFFF',
  },
  'Ocean Data': {
    bg: '#07111F', surface: '#0D1B2E', surface2: '#13243B', text: '#EAF4FF', muted: '#8FA6C1',
    primary: '#22D3EE', secondary: '#3B82F6', accent: '#A3E635',
    ctaBg1: '#22D3EE', ctaBg2: '#3B82F6', ctaText: '#04121F',
  },
  'Golden Luxe': {
    bg: '#0A0A0A', surface: '#141414', surface2: '#1D1B17', text: '#F7F2E8', muted: '#A39E92',
    primary: '#D4AF37', secondary: '#F5D98B', accent: '#FFFFFF',
    ctaBg1: '#D4AF37', ctaBg2: '#F5D98B', ctaText: '#1A1405',
  },
  'Mint Fresh': {
    bg: '#F4FBF8', surface: '#FFFFFF', surface2: '#E3F4EC', text: '#0F2A20', muted: '#4F6B60',
    primary: '#10B981', secondary: '#0EA5E9', accent: '#F59E0B',
    ctaBg1: '#10B981', ctaBg2: '#0EA5E9', ctaText: '#FFFFFF',
  },
};

export const SECTION_IDS = {
  hero: 'inicio', logos: 'logos', stats: 'numeros', about: 'sobre', services: 'servicos',
  method: 'metodo', results: 'resultados', testimonials: 'depoimentos', pricing: 'planos',
  faq: 'faq', finalCta: 'contato',
};

export const SECTION_LABELS = {
  hero: 'Hero (topo)', logos: 'Carrossel de logos', stats: 'Números', about: 'Sobre a Sabrina',
  services: 'Serviços', method: 'Método', results: 'Resultados', testimonials: 'Depoimentos',
  pricing: 'Planos', faq: 'Perguntas frequentes', finalCta: 'CTA final',
};

export const DEFAULT_CONFIG = {
  meta: {
    title: 'Petricelli Digital · Comunicação & Audiovisual',
    description: 'Estratégia, tráfego pago e conteúdo tratados como ciência. Conheça o laboratório de marketing da Sabrina e cresça com método.',
    favicon: '',
    ogImage: '',
  },
  brand: {
    name: 'Petricelli Digital',
    tagline: 'Comunicação & Audiovisual',
    person: 'Sabrina',
    logoType: 'text',
    logoIcon: 'flask',
    logoImage: '',
    logoHeight: 38,
  },
  theme: {
    preset: 'Neon Lab',
    ...PRESETS['Neon Lab'],
    ctaGradient: true,
    ctaStyle: 'pill',
    radius: 24,
    iconStyle: 'glass',
    highlightStyle: 'serif',
    headingFont: 'Bricolage Grotesque',
    headingWeight: 700,
    bodyFont: 'Plus Jakarta Sans',
    accentFont: 'Instrument Serif',
    baseSize: 16,
    headingScale: 1,
  },
  // Tema Clean (claro e colorido), alternado pelo botão no topo da página.
  themeClean: {
    bg: '#FCF7FF', surface: '#FFFFFF', surface2: '#F4EAFB', text: '#1E1529', muted: '#665A75',
    primary: '#7C3AED', secondary: '#DB2777', accent: '#F59E0B',
    ctaBg1: '#7C3AED', ctaBg2: '#DB2777', ctaText: '#FFFFFF',
  },
  themeSwitch: { enabled: true, default: 'dark', darkLabel: 'Dark', cleanLabel: 'Clean' },
  effects: {
    animations: true,
    reveal: true,
    blobs: true,
    particles: true,
    cursorGlow: true,
    grain: true,
    tilt: true,
    iconPulse: true,
    ctaShine: true,
    pulseIntensity: 1,
    floatSpeed: 1,
  },
  order: ['hero', 'logos', 'stats', 'about', 'services', 'method', 'results', 'testimonials', 'pricing', 'faq', 'finalCta'],
  announcement: {
    enabled: true,
    text: '🔬 Agenda aberta para novos projetos — diagnóstico gratuito para as 10 primeiras marcas.',
    linkText: 'Quero minha vaga',
    link: 'whatsapp',
    bg1: '#8B5CF6',
    bg2: '#EC4899',
    textColor: '#FFFFFF',
  },
  nav: {
    sticky: true,
    ctaText: 'Agendar diagnóstico',
    ctaLink: 'whatsapp',
    links: [
      { label: 'Sobre', href: '#sobre' },
      { label: 'Serviços', href: '#servicos' },
      { label: 'Método', href: '#metodo' },
      { label: 'Resultados', href: '#resultados' },
      { label: 'Planos', href: '#planos' },
      { label: 'FAQ', href: '#faq' },
    ],
  },
  hero: {
    enabled: true,
    badge: 'Laboratório de Marketing Digital',
    title: 'Seu marketing tratado como *ciência*. Seus resultados, como *rotina*.',
    subtitle: 'Eu sou a Sabrina. Testo, meço e escalo estratégias de tráfego, conteúdo e conversão para marcas que querem crescer com previsibilidade — sem achismo.',
    cta1Text: 'Quero crescer com método',
    cta1Link: 'whatsapp',
    cta2Text: 'Ver resultados',
    cta2Link: '#resultados',
    image: '/assets/img/sabrina-hero.jpg',
    imageShape: 'blob',
    proofText: 'Mais de **120 marcas** já passaram pelo laboratório',
    proofAvatars: 'AM, JS, LC, RP',
    cards: [
      { icon: 'trending-up', color: '#C6F432', value: '+327%', label: 'ROAS médio em campanhas' },
      { icon: 'users', color: '#EC4899', value: '2.4M', label: 'pessoas alcançadas por mês' },
    ],
  },
  floatingIcons: {
    enabled: true,
    style: 'glass',
    size: 62,
    radius: 47,
    pulse: true,
    rotate: true,
    rotateSpeed: 90,
    showLabels: false,
    items: [
      { icon: 'instagram', color: '#E1306C', image: '', label: 'Instagram' },
      { icon: 'tiktok', color: '#25F4EE', image: '', label: 'TikTok' },
      { icon: 'google', color: '#4285F4', image: '', label: 'Google Ads' },
      { icon: 'chart', color: '#C6F432', image: '', label: 'Analytics' },
      { icon: 'facebook', color: '#1877F2', image: '', label: 'Meta Ads' },
      { icon: 'youtube', color: '#FF3355', image: '', label: 'YouTube' },
      { icon: 'whatsapp', color: '#25D366', image: '', label: 'WhatsApp' },
      { icon: 'target', color: '#F472B6', image: '', label: 'Conversão' },
    ],
  },
  logos: {
    enabled: true,
    title: 'Plataformas e ferramentas que fazem parte do laboratório',
    speed: 38,
    grayscale: true,
    items: [
      { name: 'Meta Ads', icon: 'facebook', image: '' },
      { name: 'Google Ads', icon: 'google', image: '' },
      { name: 'TikTok Ads', icon: 'tiktok', image: '' },
      { name: 'Instagram', icon: 'instagram', image: '' },
      { name: 'YouTube', icon: 'youtube', image: '' },
      { name: 'Google Analytics', icon: 'chart', image: '' },
      { name: 'LinkedIn Ads', icon: 'linkedin', image: '' },
      { name: 'WhatsApp Business', icon: 'whatsapp', image: '' },
    ],
  },
  stats: {
    enabled: true,
    items: [
      { prefix: '+', value: 120, suffix: '', label: 'marcas atendidas' },
      { prefix: '', value: 8, suffix: ' anos', label: 'de experiência em marketing' },
      { prefix: 'R$ ', value: 12, suffix: 'M+', label: 'em vendas geradas' },
      { prefix: '', value: 98, suffix: '%', label: 'de clientes satisfeitos' },
    ],
  },
  about: {
    enabled: true,
    kicker: 'Quem está por trás do laboratório',
    title: 'Prazer, eu sou a *Sabrina*.',
    text: 'Estrategista de marketing digital e fundadora da Petricelli Digital. Há anos transformo dados em decisões — e decisões em vendas.\n\nMinha abordagem é simples: cada campanha é um experimento. Formulamos hipóteses, testamos rápido, medimos tudo e escalamos apenas o que comprovadamente funciona. Sem fórmulas mágicas: só método, criatividade e muita análise.',
    image: '/assets/img/sabrina-sobre.jpg',
    badgeValue: '8+',
    badgeLabel: 'anos de experiência',
    highlights: [
      { icon: 'award', text: 'Especialista em Meta Ads e Google Ads' },
      { icon: 'flask', text: 'Metodologia própria de testes e validação' },
      { icon: 'heart', text: 'Atendimento próximo e personalizado' },
    ],
    signature: 'Sabrina',
    ctaText: 'Conversar com a Sabrina',
    ctaLink: 'whatsapp',
  },
  services: {
    enabled: true,
    kicker: 'O que acontece no laboratório',
    title: 'Serviços para cada *etapa* do seu crescimento',
    subtitle: 'Escolha um serviço isolado ou combine tudo em uma estratégia 360º.',
    columns: 3,
    items: [
      { icon: 'target', color: '#8B5CF6', title: 'Tráfego Pago', text: 'Campanhas em Meta, Google e TikTok Ads com testes contínuos de público, criativo e oferta.' },
      { icon: 'palette', color: '#EC4899', title: 'Social Media & Conteúdo', text: 'Planejamento editorial, roteiros e design que constroem autoridade e geram demanda.' },
      { icon: 'pen', color: '#F59E0B', title: 'Copy & Criativos', text: 'Textos e peças que param o scroll e levam o cliente certo até a compra.' },
      { icon: 'chart', color: '#10B981', title: 'Dados & Analytics', text: 'Dashboards claros, rastreamento correto e decisões baseadas em números reais.' },
      { icon: 'rocket', color: '#3B82F6', title: 'Lançamentos & Funis', text: 'Estratégias de lançamento, páginas de vendas e funis que convertem no automático.' },
      { icon: 'bulb', color: '#C6F432', title: 'Consultoria & Mentoria', text: 'Para quem quer aprender o método e estruturar um time de marketing interno.' },
    ],
  },
  method: {
    enabled: true,
    kicker: 'O Método Lab',
    title: 'Quatro etapas. Zero *achismo*.',
    subtitle: 'Um processo científico aplicado ao marketing — do diagnóstico à escala.',
    steps: [
      { icon: 'search', title: 'Diagnóstico', text: 'Raio-X completo do seu negócio, concorrência, público e números atuais.' },
      { icon: 'flask', title: 'Hipóteses', text: 'Mapeamos oportunidades e criamos experimentos priorizados por impacto.' },
      { icon: 'zap', title: 'Testes', text: 'Campanhas e conteúdos no ar com métricas claras de sucesso desde o dia 1.' },
      { icon: 'rocket', title: 'Escala', text: 'O que funciona ganha investimento. O que não funciona vira aprendizado.' },
    ],
  },
  results: {
    enabled: true,
    kicker: 'Resultados do laboratório',
    title: 'Experimentos que viraram *cases*',
    subtitle: 'Alguns exemplos do que o método é capaz de fazer.',
    autoplay: true,
    interval: 5,
    items: [
      { image: '', icon: 'cart', tag: 'E-commerce de moda', metric: '+327%', metricLabel: 'ROAS em 90 dias', title: 'De vendas instáveis a escala previsível', text: 'Reestruturação de campanhas e criativos com testes semanais de oferta.' },
      { image: '', icon: 'heart', tag: 'Clínica de estética', metric: '3,2x', metricLabel: 'mais agendamentos', title: 'Agenda cheia com tráfego local', text: 'Campanhas geolocalizadas e funil de WhatsApp com atendimento ágil.' },
      { image: '', icon: 'video', tag: 'Infoproduto', metric: 'R$ 480k', metricLabel: 'em um lançamento', title: 'Lançamento validado por dados', text: 'Pré-lançamento com conteúdo, captação segmentada e remarketing.' },
      { image: '', icon: 'users', tag: 'Restaurante', metric: '+18k', metricLabel: 'novos seguidores', title: 'Conteúdo que vira fila na porta', text: 'Estratégia de Reels e parcerias locais com mensuração de visitas.' },
    ],
  },
  testimonials: {
    enabled: true,
    kicker: 'Depoimentos',
    title: 'Quem já passou pelo *laboratório*',
    autoplay: true,
    interval: 6,
    items: [
      { avatar: '', name: 'Nome da Cliente', role: 'Empresa · Segmento', rating: 5, text: 'Pela primeira vez entendi para onde ia cada real investido. Os relatórios são claros e os resultados vieram já no segundo mês.' },
      { avatar: '', name: 'Nome do Cliente', role: 'Empresa · Segmento', rating: 5, text: 'A Sabrina trata cada campanha como um experimento. Testa, mede e ajusta. Nosso custo por lead caiu pela metade.' },
      { avatar: '', name: 'Nome da Cliente', role: 'Empresa · Segmento', rating: 5, text: 'Atendimento impecável e muito próximo. Ela realmente entende o negócio antes de propor qualquer coisa.' },
      { avatar: '', name: 'Nome do Cliente', role: 'Empresa · Segmento', rating: 5, text: 'Nosso lançamento foi o maior da história da empresa. Método, organização e criatividade do início ao fim.' },
    ],
  },
  pricing: {
    enabled: true,
    kicker: 'Planos',
    title: 'Escolha o seu *experimento*',
    subtitle: 'Todos os planos incluem diagnóstico inicial, onboarding e relatórios mensais.',
    items: [
      { name: 'Start', price: 'R$ 1.497', period: '/mês', description: 'Para quem está começando a investir em tráfego pago.', features: 'Gestão de 1 plataforma de anúncios\nAté 8 criativos por mês\nRelatório mensal de resultados\nSuporte via WhatsApp', ctaText: 'Começar agora', ctaLink: 'whatsapp', featured: false, badge: '' },
      { name: 'Growth', price: 'R$ 2.997', period: '/mês', description: 'Para marcas prontas para escalar com consistência.', features: 'Gestão de até 3 plataformas\nAté 20 criativos por mês\nSocial media (12 posts/mês)\nDashboard em tempo real\nReunião estratégica quinzenal', ctaText: 'Quero escalar', ctaLink: 'whatsapp', featured: true, badge: 'Mais escolhido' },
      { name: 'Lab Premium', price: 'Sob consulta', period: '', description: 'Estratégia 360º com acompanhamento direto da Sabrina.', features: 'Estratégia completa de marketing\nCriativos ilimitados\nLançamentos e funis de vendas\nConsultoria semanal\nPrioridade no atendimento', ctaText: 'Falar com a Sabrina', ctaLink: 'whatsapp', featured: false, badge: '' },
    ],
  },
  faq: {
    enabled: true,
    kicker: 'Dúvidas',
    title: 'Perguntas *frequentes*',
    items: [
      { q: 'Em quanto tempo vejo resultados?', a: 'Os primeiros dados aparecem já nas primeiras semanas. Resultados consistentes costumam surgir entre 30 e 90 dias, conforme o segmento e o investimento.' },
      { q: 'O valor do investimento em anúncios está incluso?', a: 'Não. O investimento em mídia é pago diretamente às plataformas (Meta, Google, TikTok). Eu te ajudo a definir o valor ideal para o seu momento.' },
      { q: 'Existe fidelidade ou contrato mínimo?', a: 'Trabalhamos com ciclos de 3 meses, tempo necessário para testar, aprender e escalar com segurança. Depois disso, a renovação é mensal.' },
      { q: 'Atende negócios de qualquer segmento?', a: 'Atendo negócios locais, e-commerces, prestadores de serviço e infoprodutores. No diagnóstico avaliamos juntos se o laboratório é o ideal para você.' },
      { q: 'Como funciona o diagnóstico gratuito?', a: 'É uma conversa de 30 minutos em que analiso seu cenário atual e aponto as 3 maiores oportunidades de crescimento — sem compromisso.' },
    ],
  },
  finalCta: {
    enabled: true,
    title: 'Pronta para colocar sua marca no *laboratório*?',
    subtitle: 'Agende um diagnóstico gratuito de 30 minutos e descubra as 3 maiores oportunidades de crescimento do seu negócio.',
    ctaText: 'Agendar diagnóstico gratuito',
    ctaLink: 'whatsapp',
    note: 'Sem compromisso · Resposta em até 24h',
    bgImage: '',
    showIcons: true,
  },
  footer: {
    text: 'Estratégia, dados e criatividade para marcas que querem crescer com método.',
    email: 'contato@petricellidigital.com.br',
    phone: '',
    instagram: 'https://www.instagram.com/petricelli.digital/',
    tiktok: '',
    linkedin: '',
    youtube: '',
    copyright: '© 2026 Petricelli Digital. Todos os direitos reservados.',
    links: [
      { label: 'Serviços', href: '#servicos' },
      { label: 'Planos', href: '#planos' },
      { label: 'Contato', href: 'whatsapp' },
    ],
  },
  whatsapp: {
    enabled: true,
    number: '5511999999999',
    message: 'Olá, Sabrina! Vim pelo site e quero saber mais sobre o laboratório.',
    label: 'Fale comigo',
    position: 'right',
    color: '#25D366',
    pulse: true,
  },
};

export function isObj(v) { return v && typeof v === 'object' && !Array.isArray(v); }

// Mescla a configuração salva por cima da padrão (listas são substituídas inteiras).
export function deepMerge(base, over) {
  if (!isObj(base) || !isObj(over)) return over === undefined ? clone(base) : clone(over);
  const out = clone(base);
  for (const k of Object.keys(over)) {
    out[k] = isObj(base[k]) && isObj(over[k]) ? deepMerge(base[k], over[k]) : clone(over[k]);
  }
  return out;
}

export function clone(v) { return v === undefined ? v : JSON.parse(JSON.stringify(v)); }
