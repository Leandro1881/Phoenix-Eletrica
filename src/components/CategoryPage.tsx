import React from 'react';
import { ArrowRight, Check, ChevronRight, MessageSquare } from 'lucide-react';
import { CATEGORIES_DATA } from './Categories';
import { CATEGORY_PAGES, CategoryPage as CategoryPageData } from '../seo/pages';
import { trackWhatsAppClick } from '../utils/analytics';

interface CategoryPageProps {
  page: CategoryPageData;
  onQuote: (material: string) => void;
}

// Página própria de cada linha de produtos (ex.: /fios-e-cabos), com h1, texto e
// links internos para as outras linhas. O formulário de cotação vem logo abaixo (App.tsx).
export const CategoryPage: React.FC<CategoryPageProps> = ({ page, onQuote }) => {
  const cat = CATEGORIES_DATA.find((c) => c.id === page.categoryId);
  if (!cat) return null;
  const Icon = cat.icon;
  const image = cat.images[0];
  const whatsappUrl = `https://wa.me/5511983239782?text=${encodeURIComponent(
    `Olá! Gostaria de um orçamento de ${page.name.toLowerCase()} com a Phoenix Elétrica.`
  )}`;

  return (
    <>
      <section className="relative bg-brand-navy text-white overflow-hidden">
        <div className="absolute inset-0 bg-grid opacity-40" />
        <div className="absolute -left-32 top-10 w-[420px] h-[420px] rounded-full bg-brand-blue/40 blur-[120px]" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-16 sm:pb-20">
          <nav aria-label="Trilha de navegação" className="text-sm text-blue-100/70">
            <ol className="flex items-center gap-1.5">
              <li>
                <a href="/" className="hover:text-white transition-colors">Início</a>
              </li>
              <li aria-hidden="true">
                <ChevronRight className="w-3.5 h-3.5" />
              </li>
              <li aria-current="page" className="text-white font-semibold">{page.name}</li>
            </ol>
          </nav>

          <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-7">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-brand-yellow ring-1 ring-white/15">
                <Icon className="w-3.5 h-3.5" />
                {cat.badge}
              </span>
              <h1 className="mt-5 text-3xl sm:text-5xl font-extrabold tracking-tight leading-[1.1]">{page.h1}</h1>
              <p className="mt-5 text-base sm:text-lg text-blue-100/85 max-w-2xl">{page.intro}</p>

              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={() => onQuote(cat.sampleMaterial)}
                  className="group inline-flex items-center justify-center gap-2 h-14 px-8 rounded-full bg-brand-yellow hover:bg-[#ffe14d] text-brand-navy font-extrabold text-sm sm:text-base transition-all hover:-translate-y-0.5 cursor-pointer"
                >
                  Cotar {page.name.toLowerCase()}
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </button>
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => trackWhatsAppClick(`Página ${page.name}`, 'WhatsApp Categoria')}
                  className="inline-flex items-center justify-center gap-2 h-14 px-7 rounded-full bg-white/10 hover:bg-white/15 text-white font-bold text-sm sm:text-base ring-1 ring-white/25 transition-all hover:-translate-y-0.5"
                >
                  <MessageSquare className="w-5 h-5 text-[#25D366] fill-current" />
                  Falar no WhatsApp
                </a>
              </div>
            </div>

            <div className="lg:col-span-5">
              <img
                src={image.url}
                alt={`${page.name}: ${image.label}`}
                width={800}
                height={600}
                fetchPriority="high"
                decoding="async"
                className="w-full aspect-[4/3] object-cover rounded-3xl ring-1 ring-white/15 shadow-2xl"
              />
            </div>
          </div>
        </div>
        <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-brand-blue via-brand-yellow to-brand-red" />
      </section>

      <section className="py-16 sm:py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-2 gap-10">
          <div>
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-brand-red">Pronta entrega</span>
            <h2 className="mt-2 text-2xl sm:text-3xl font-extrabold text-brand-navy tracking-tight">
              {page.name} no estoque da Phoenix
            </h2>
            <p className="mt-4 text-slate-600 leading-relaxed">{cat.description}</p>
          </div>
          <ul className="grid gap-3 self-center">
            {cat.items.map((item) => (
              <li key={item} className="flex items-start gap-3 rounded-2xl bg-surface px-4 py-3.5 ring-1 ring-slate-200/70">
                <Check className="w-5 h-5 text-brand-blue shrink-0 mt-0.5" />
                <span className="text-slate-700 font-medium">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
};

// Links internos para as demais linhas (vai depois do formulário de cotação)
export const OtherCategories: React.FC<{ currentPath: string }> = ({ currentPath }) => (
  <section className="pb-20 bg-surface">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <h2 className="text-2xl sm:text-3xl font-extrabold text-brand-navy tracking-tight">Outras linhas de produtos</h2>
      <ul className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {CATEGORY_PAGES.filter((p) => p.path !== currentPath).map((p) => (
          <li key={p.path}>
            <a
              href={p.path}
              className="group flex items-center justify-between rounded-2xl bg-white px-5 py-4 ring-1 ring-slate-200 font-semibold text-slate-700 hover:ring-brand-blue hover:text-brand-blue transition-all"
            >
              {p.name}
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </a>
          </li>
        ))}
      </ul>
    </div>
  </section>
);
