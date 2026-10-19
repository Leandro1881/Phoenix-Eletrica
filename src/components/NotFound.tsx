import React from 'react';
import { ArrowRight, FileText, Home, MessageSquare, Zap } from 'lucide-react';
import { navCategories } from './Header';
import { trackWhatsAppClick } from '../utils/analytics';

// Página 404: endereço inexistente. Mostra caminhos úteis em vez de um beco sem saída.
export const NotFound: React.FC = () => (
  <section className="relative overflow-hidden px-4 py-20 sm:py-28" aria-labelledby="titulo-404">
    <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,rgba(0,75,156,0.10),transparent_65%)]" />
    <div className="max-w-3xl mx-auto text-center">
      <div className="relative inline-flex items-center justify-center" aria-hidden="true">
        <span className="text-[7rem] sm:text-[10rem] font-black leading-none tracking-tighter text-brand-navy/10 select-none">404</span>
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-brand-yellow text-brand-navy flex items-center justify-center shadow-lg rotate-6">
            <Zap className="w-9 h-9 sm:w-11 sm:h-11 fill-current" />
          </span>
        </span>
      </div>

      <span className="mt-4 block text-xs font-bold uppercase tracking-[0.2em] text-brand-red">Erro 404</span>
      <h1 id="titulo-404" className="mt-2 text-3xl sm:text-4xl font-extrabold text-brand-navy tracking-tight">
        Este circuito não fecha
      </h1>
      <p className="mt-3 text-slate-600 max-w-xl mx-auto">
        A página que você procurou não existe ou mudou de endereço. Mas a gente continua no ar: escolha um caminho abaixo ou fale direto com o balcão.
      </p>

      <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
        <a href="/" className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-full bg-brand-navy text-white font-bold hover:bg-brand-navy-2 transition-colors">
          <Home className="w-4 h-4" />
          Página inicial
        </a>
        <a href="/cotacao" className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-full bg-brand-yellow text-brand-navy font-bold hover:brightness-95 transition">
          <FileText className="w-4 h-4" />
          Pedir cotação
        </a>
        <a
          href="https://wa.me/5511983239782?text=Ol%C3%A1!%20Gostaria%20de%20um%20or%C3%A7amento%20com%20a%20Phoenix%20El%C3%A9trica."
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackWhatsAppClick('Página 404', 'WhatsApp da Loja')}
          className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-full bg-[#25D366] text-white font-bold hover:bg-[#1fb257] transition-colors"
        >
          <MessageSquare className="w-4 h-4 fill-current" />
          WhatsApp
        </a>
      </div>

      <nav aria-label="Categorias de produtos" className="mt-14 text-left">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 text-center mb-4">Ou veja nossas categorias</h2>
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {navCategories.map((c) => (
            <li key={c.path}>
              <a
                href={c.path}
                className="group flex items-center justify-between gap-3 rounded-xl bg-white border border-slate-200 px-4 py-3 text-sm font-semibold text-brand-navy hover:border-brand-blue hover:shadow-sm transition"
              >
                <span>{c.label}</span>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-brand-blue group-hover:translate-x-0.5 transition" />
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  </section>
);
