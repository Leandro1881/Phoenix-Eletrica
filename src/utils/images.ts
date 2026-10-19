// srcset para fotos do Unsplash: o navegador escolhe a largura certa para a tela
// (celular baixa a versão menor). O Unsplash já entrega WebP/AVIF com auto=format.
export const unsplashSrcSet = (url: string, widths: number[]) =>
  widths.map((w) => `${url.replace(/([?&])w=\d+/, `$1w=${w}`)} ${w}w`).join(', ');

// Foto do primeiro slide do topo da página inicial (pré-carregada pelo servidor em "/")
export const HERO_FIRST_IMAGE = 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=1600&q=80';
export const HERO_SRCSET_WIDTHS = [640, 1024, 1600];
export const HERO_SIZES = '(min-width: 1024px) 62vw, 100vw';
