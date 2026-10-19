// Dados de SEO de cada página do site.
// Usado pelo navegador (React) e pelo servidor (server.ts), que monta o <head>
// de cada endereço, o sitemap.xml e responde 404 para endereços desconhecidos.

export const SITE_URL = 'https://phoenixel.com.br';

// Data da última alteração de conteúdo (vai para o <lastmod> do sitemap)
export const LAST_MODIFIED = '2026-10-18';

export interface SeoPage {
  path: string;
  title: string; // até 60 caracteres, palavra-chave no início
  description: string; // até 160 caracteres
  breadcrumb?: { name: string; path: string }[];
  noindex?: boolean;
}

export interface CategoryPage extends SeoPage {
  categoryId: string; // id usado em CATEGORIES_DATA (Categories.tsx)
  name: string;
  h1: string;
  intro: string;
}

const HOME: SeoPage = {
  path: '/',
  title: 'Materiais Elétricos em SP | Phoenix Elétrica Distribuidora',
  description:
    'Distribuidora de materiais elétricos no Bom Retiro, SP: fios e cabos, disjuntores, quadros e LED. Faturamento para CNPJ e cotação rápida no WhatsApp.'
};

export const QUOTE_PAGE: SeoPage = {
  path: '/cotacao',
  title: 'Faça sua Cotação de Materiais Elétricos | Phoenix Elétrica',
  description:
    'Envie sua lista de materiais elétricos e receba o orçamento da Phoenix Elétrica no WhatsApp. Atendemos construtoras, indústrias e instaladores em SP.',
  breadcrumb: [
    { name: 'Início', path: '/' },
    { name: 'Faça sua cotação', path: '/cotacao' }
  ]
};

const category = (
  slug: string,
  categoryId: string,
  name: string,
  title: string,
  description: string,
  h1: string,
  intro: string
): CategoryPage => ({
  path: `/${slug}`,
  categoryId,
  name,
  title,
  description,
  h1,
  intro,
  breadcrumb: [
    { name: 'Início', path: '/' },
    { name, path: `/${slug}` }
  ]
});

export const CATEGORY_PAGES: CategoryPage[] = [
  category(
    'fios-e-cabos',
    'fios-cabos',
    'Fios e Cabos',
    'Fios e Cabos Elétricos em SP | Phoenix Elétrica',
    'Cabos flexíveis 750V, cabos 0,6/1kV, fios antichama e cabos de rede com certificação Inmetro. Pronta entrega no Bom Retiro, SP. Peça sua cotação.',
    'Fios e cabos elétricos em São Paulo',
    'Cabos flexíveis 750V de 1,5 a 16 mm², cabos de potência 0,6/1kV, cabos de comando e fios antichama para obras residenciais, comerciais e industriais. Todos com certificação Inmetro e a pronta entrega na loja do Bom Retiro.'
  ),
  category(
    'disjuntores-e-quadros',
    'disjuntores-quadros',
    'Disjuntores e Quadros',
    'Disjuntores e Quadros de Distribuição em SP | Phoenix',
    'Mini disjuntores DIN curva B e C, DR, DPS e quadros de embutir e sobrepor. Proteção elétrica a pronta entrega no Bom Retiro, SP. Faça sua cotação.',
    'Disjuntores e quadros de distribuição em São Paulo',
    'Mini disjuntores monopolares, bipolares e tripolares (curva B e C), disjuntores em caixa moldada, interruptores DR, protetores contra surtos (DPS) e quadros de distribuição de embutir e sobrepor para montar a proteção completa da instalação.'
  ),
  category(
    'iluminacao-led',
    'iluminacao-led',
    'Iluminação LED',
    'Iluminação LED: Refletores e Painéis em SP | Phoenix',
    'Refletores LED IP66, luminárias industriais High Bay, painéis LED 60x60 e fitas LED. Iluminação comercial e industrial em SP. Peça sua cotação.',
    'Iluminação LED comercial e industrial em São Paulo',
    'Refletores LED de 50 W a 400 W com proteção IP66, luminárias industriais High Bay, painéis LED de embutir e sobrepor, luminárias tubulares e fitas LED com drivers, para galpões, lojas, escritórios e áreas externas.'
  ),
  category(
    'infraestrutura-eletrica',
    'infraestrutura',
    'Infraestrutura Elétrica',
    'Eletrocalhas e Eletrodutos em SP | Phoenix Elétrica',
    'Eletrocalhas galvanizadas, perfilados, eletrodutos corrugados e rígidos, caixas de passagem e conduletes. Infraestrutura elétrica para obras em SP.',
    'Infraestrutura elétrica: eletrocalhas e eletrodutos',
    'Eletrocalhas perfuradas galvanizadas, perfilados, eletrodutos corrugados reforçados, tubos de PVC rígido roscáveis e soldáveis, caixas de passagem e conduletes de alumínio para a infraestrutura de obras de todos os portes.'
  ),
  category(
    'tomadas-e-interruptores',
    'tomadas-acabamentos',
    'Tomadas e Interruptores',
    'Tomadas e Interruptores em SP | Phoenix Elétrica',
    'Tomadas 10A e 20A, interruptores simples e paralelos, placas 4x2 e 4x4, módulos USB e caixas de piso. Acabamentos elétricos em SP. Peça sua cotação.',
    'Tomadas, interruptores e acabamentos elétricos',
    'Conjuntos modulares 4x2 e 4x4, módulos de tomada 10 A e 20 A, interruptores simples, paralelos e intermediários, placas com suporte, módulos USB e caixas de piso para acabamento residencial e comercial.'
  ),
  category(
    'automacao-e-comandos',
    'automacao-comandos',
    'Automação e Comandos',
    'Contatores e Comandos Elétricos em SP | Phoenix',
    'Contatores de 9A a 150A, relés térmicos, inversores de frequência, botoeiras e multímetros True-RMS. Automação e comandos elétricos em SP.',
    'Automação e comandos elétricos em São Paulo',
    'Contatores tripolares de 9 A a 150 A, relés térmicos e protetores de motor, inversores de frequência, botoeiras de emergência, sinalizadores e instrumentos como multímetros True-RMS para painéis e manutenção industrial.'
  )
];

// Painel do lojista: o endereço é secreto (ADMIN_PATH no servidor) e não aparece no código do site
export const ADMIN_PAGE: SeoPage = {
  path: '',
  title: 'Painel | Phoenix Elétrica',
  description: 'Área restrita.',
  noindex: true
};

export const NOT_FOUND: SeoPage = {
  path: '',
  title: 'Página não encontrada | Phoenix Elétrica',
  description: 'O endereço acessado não existe no site da Phoenix Elétrica.',
  noindex: true
};

// Páginas públicas, na ordem do sitemap
export const PUBLIC_PAGES: SeoPage[] = [HOME, QUOTE_PAGE, ...CATEGORY_PAGES];

const normalize = (pathname: string) => {
  const p = pathname.toLowerCase().replace(/\/+$/, '');
  return p === '' ? '/' : p;
};

// Página correspondente ao endereço; undefined quando o endereço não existe
export const findPage = (pathname: string): SeoPage | undefined => {
  const p = normalize(pathname);
  return PUBLIC_PAGES.find((page) => page.path === p);
};

export const findCategoryPage = (pathname: string): CategoryPage | undefined =>
  CATEGORY_PAGES.find((page) => page.path === normalize(pathname));

export const categoryPathById = (categoryId: string): string | undefined =>
  CATEGORY_PAGES.find((page) => page.categoryId === categoryId)?.path;

// JSON-LD da trilha de navegação (BreadcrumbList) de uma página
export const breadcrumbJsonLd = (page: SeoPage) =>
  page.breadcrumb && {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: page.breadcrumb.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: `${SITE_URL}${item.path === '/' ? '/' : item.path}`
    }))
  };

export const sitemapXml = () =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  PUBLIC_PAGES.map(
    (page) =>
      `  <url>\n    <loc>${SITE_URL}${page.path === '/' ? '/' : page.path}</loc>\n    <lastmod>${LAST_MODIFIED}</lastmod>\n  </url>\n`
  ).join('') +
  `</urlset>\n`;
