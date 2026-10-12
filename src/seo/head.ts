import { SITE_URL, SeoPage, breadcrumbJsonLd } from './pages';

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const urlOf = (page: SeoPage) => `${SITE_URL}${page.path || '/'}`;

// Servidor: reescreve o <head> do index.html para a página pedida, para que
// buscadores e prévias de WhatsApp/redes sociais leiam os dados certos sem JavaScript.
export const renderHead = (html: string, page: SeoPage): string => {
  const title = escapeHtml(page.title);
  const description = escapeHtml(page.description);
  let out = html
    .replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`)
    .replace(/(<meta name="description" content=")[^"]*(")/, `$1${description}$2`)
    .replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${title}$2`)
    .replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${description}$2`)
    .replace(/(<meta name="twitter:title" content=")[^"]*(")/, `$1${title}$2`)
    .replace(/(<meta name="twitter:description" content=")[^"]*(")/, `$1${description}$2`);

  if (page.noindex) {
    out = out
      .replace(/<meta name="robots" content="[^"]*" \/>/, '<meta name="robots" content="noindex, nofollow" />')
      .replace(/\s*<link rel="canonical" href="[^"]*" \/>/, '')
      .replace(/\s*<meta property="og:url" content="[^"]*" \/>/, '');
  } else {
    out = out
      .replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${urlOf(page)}$2`)
      .replace(/(<meta property="og:url" content=")[^"]*(")/, `$1${urlOf(page)}$2`);
  }

  const crumbs = breadcrumbJsonLd(page);
  if (crumbs) {
    out = out.replace(
      '</head>',
      `  <script type="application/ld+json">${JSON.stringify(crumbs).replace(/</g, '\\u003c')}</script>\n  </head>`
    );
  }
  return out;
};

// Navegador: mantém título, descrição, canonical e robots coerentes com a página
// (cobre o modo de desenvolvimento, em que o servidor não reescreve o <head>).
export const applyHead = (page: SeoPage) => {
  document.title = page.title;
  document.querySelector('meta[name="description"]')?.setAttribute('content', page.description);
  document
    .querySelector('meta[name="robots"]')
    ?.setAttribute('content', page.noindex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large');
  if (!page.noindex) document.querySelector('link[rel="canonical"]')?.setAttribute('href', urlOf(page));
};
