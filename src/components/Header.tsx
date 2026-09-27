import React, { useState } from 'react';
import { PhoenixLogo } from './PhoenixLogo';
import { MessageSquare, Search, PhoneCall, Star, MapPin } from 'lucide-react';
import { ReviewsData } from '../types';
import { trackWhatsAppClick } from '../utils/analytics';

interface HeaderProps {
  onSearch?: (term: string) => void;
  onSelectCategory?: (category: string) => void;
  reviewsData?: ReviewsData;
}

export const Header: React.FC<HeaderProps> = ({ onSearch, onSelectCategory, reviewsData }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const totalReviews = reviewsData?.total || 16;
  const ratingAverage = reviewsData ? reviewsData.ratingAverage.toFixed(1).replace('.', ',') : '4,8';

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      if (onSearch) onSearch(searchTerm);
      const el = document.getElementById('orcamento');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const navCategories = [
    { label: 'Cabos Elétricos', category: 'Cabos e Fios de Cobre', targetId: 'fios-cabos' },
    { label: 'Disjuntores', category: 'Disjuntores e Proteção Elétrica', targetId: 'disjuntores-quadros' },
    { label: 'Iluminação & LED', category: 'Iluminação Industrial e Residencial', targetId: 'iluminacao-led' },
    { label: 'Infraestrutura', category: 'Infraestrutura e Eletrodutos', targetId: 'infraestrutura' },
    { label: 'Tomadas', category: 'Tomadas e Linhas de Acabamento', targetId: 'tomadas-acabamentos' },
    { label: 'Automação & Comandos', category: 'Automação e Comandos Elétricos', targetId: 'automacao-comandos' },
  ];

  const handleCategoryClick = (targetId: string, category: string) => {
    if (onSelectCategory) onSelectCategory(category);
    const targetEl = document.getElementById(targetId);
    if (targetEl) {
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      targetEl.classList.add('ring-2', 'ring-[#004b9c]');
      setTimeout(() => {
        targetEl.classList.remove('ring-2', 'ring-[#004b9c]');
      }, 1500);
    } else {
      const el = document.getElementById('categorias');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-white shadow-sm border-b border-slate-200 w-full">
      
      {/* 1. Barra Superior Institucional (Telefones, Endereço e Avaliações Google Oficiais) */}
      <div className="bg-[#003882] text-white text-xs py-1.5 px-3 sm:px-6 lg:px-8 border-b border-blue-900">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 text-[11px] sm:text-xs">
          
          {/* Telefones Oficiais */}
          <div className="flex items-center gap-3 overflow-hidden">
            <a 
              href="tel:1133527777" 
              className="font-semibold tracking-wider flex items-center gap-1.5 hover:text-yellow-300 transition-colors whitespace-nowrap"
              title="Ligar para o televendas"
            >
              <PhoneCall className="w-3.5 h-3.5 text-yellow-300 shrink-0" />
              <span>TELEVENDAS: <strong>(11) 3352-7777</strong></span>
            </a>
            <span className="text-blue-300 hidden md:inline">|</span>
            <a 
              href="https://wa.me/5511983239782"
              target="_blank"
              rel="noopener noreferrer" 
              className="hidden sm:inline text-slate-200 hover:text-yellow-300 transition-colors whitespace-nowrap"
            >
              WHATSAPP: <strong className="text-yellow-300">(11) 98323-9782</strong>
            </a>
          </div>

          {/* Endereço no Bom Retiro & Badge Google Avaliações */}
          <div className="flex items-center gap-3 text-[11px] text-blue-100 shrink-0">
            <a 
              href="https://maps.google.com/?q=R.+Anhaia,+740+-+Bom+Retiro,+S%C3%A3o+Paulo+-+SP,+01130-000"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden lg:flex items-center gap-1 text-slate-200 hover:text-yellow-300 transition-colors"
              title="Ver no Google Maps"
            >
              <MapPin className="w-3.5 h-3.5 text-yellow-300 shrink-0" />
              <span>R. Anhaia, 740 - Bom Retiro, SP</span>
            </a>
            <span className="hidden lg:inline text-blue-300">|</span>
            
            {/* Única Badge de Avaliação no topo do site com link direto para o Google Oficial fornecido */}
            <a
              href="https://www.google.com/search?q=phoenix+eletrica#lrd=0x94ce586e18db2857:0x44a861fb89d1d1f5,1,,,,"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 bg-blue-900/80 hover:bg-blue-800 px-2 py-0.5 rounded border border-blue-700/60 font-semibold whitespace-nowrap transition-colors"
              title="Ver as 16 avaliações verificadas no Google (Nota 4,8)"
            >
              <span className="text-yellow-400 font-bold">4,8</span>
              <div className="flex text-yellow-400">
                <Star className="w-3 h-3 fill-current" />
              </div>
              <span className="text-[10px] text-blue-100 hidden xs:inline">16 avaliações no Google</span>
              <span className="text-[10px] text-blue-100 xs:hidden">Google 4,8 (16)</span>
            </a>
          </div>

        </div>
      </div>

      {/* 2. Barra Principal (Clean: Sem botão hambúrguer, apenas Logo e WhatsApp) */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2 sm:py-3.5 flex items-center justify-between gap-2 sm:gap-4">
        
        {/* Lado Esquerdo: Logotipo Phoenix Elétrica Oficial (Sem o menu hambúrguer) */}
        <div className="flex items-center shrink-0">
          <a href="#" className="flex items-center group shrink-0" title="Phoenix Elétrica - Distribuidora">
            <PhoenixLogo variant="horizontal" size="md" />
          </a>
        </div>

        {/* Campo de Busca de Produtos (Desktop >= md) com Folga Ampla */}
        <div className="hidden md:block flex-1 max-w-lg lg:max-w-xl mx-2 lg:mx-4">
          <form onSubmit={handleSearchSubmit} className="relative flex items-center">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar cabos, disjuntores, LED..."
              className="w-full bg-slate-50 hover:bg-white focus:bg-white text-slate-800 placeholder-slate-400 text-xs sm:text-sm pl-4 pr-28 sm:pr-32 py-2 sm:py-2.5 rounded-lg border border-slate-300 focus:border-[#004b9c] focus:ring-2 focus:ring-blue-100 outline-none transition-all shadow-inner"
            />
            <button
              type="submit"
              className="absolute right-1 px-3 sm:px-4 py-1.5 bg-[#004b9c] hover:bg-[#003882] text-white text-xs font-semibold rounded-md flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Buscar</span>
            </button>
          </form>
        </div>

        {/* Lado Direito: Televendas e Botão de WhatsApp */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <div className="hidden xl:flex flex-col text-right leading-tight">
            <span className="text-[11px] text-slate-500 font-medium">Televendas Comercial</span>
            <a href="tel:1133527777" className="text-xs font-bold text-[#003882] hover:underline">
              (11) 3352-7777
            </a>
          </div>

          <a
            href="https://wa.me/5511983239782?text=Ol%C3%A1!%20Gostaria%20de%20informa%C3%A7%C3%B5es%20e%20or%C3%A7amento%20de%20materiais%20el%C3%A9tricos%20com%20a%20Phoenix%20El%C3%A9trica."
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackWhatsAppClick('Cabeçalho / Topo', 'WhatsApp Comercial Header')}
            className="inline-flex items-center gap-1.5 sm:gap-2 bg-[#25D366] hover:bg-[#20ba5a] text-white text-xs sm:text-sm font-bold px-2.5 sm:px-4 py-2 sm:py-2.5 rounded-lg shadow-sm hover:shadow transition-all shrink-0"
            title="Chamar no WhatsApp Comercial"
          >
            <MessageSquare className="w-4 h-4 fill-current shrink-0" />
            <span className="hidden sm:inline whitespace-nowrap">WhatsApp Comercial</span>
            <span className="sm:hidden font-bold text-xs">WhatsApp</span>
          </a>
        </div>

      </div>

      {/* Busca em Telas Pequenas (< md) */}
      <div className="md:hidden px-3 pb-2 pt-0.5 border-t border-slate-100">
        <form onSubmit={handleSearchSubmit} className="relative flex items-center">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar cabos, disjuntores, LED..."
            className="w-full bg-slate-50 focus:bg-white text-slate-800 placeholder-slate-400 text-xs pl-3.5 pr-24 py-2 rounded-lg border border-slate-300 focus:border-[#004b9c] outline-none"
          />
          <button
            type="submit"
            className="absolute right-1 px-3 py-1 bg-[#004b9c] hover:bg-[#003882] text-white text-xs font-semibold rounded-md flex items-center gap-1 cursor-pointer"
          >
            <Search className="w-3 h-3" />
            <span>Buscar</span>
          </button>
        </form>
      </div>

      {/* 3. Navegação por Departamentos (Direcionamento Preciso para a Seção Clicada) */}
      <div className="bg-[#004b9c] text-white text-xs font-semibold border-t border-blue-800/60 shadow-inner">
        <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8">
          
          {/* VERSÃO MOBILE (< lg): Pílulas que se ajustam 100% à tela e direcionam ao item exato */}
          <div className="lg:hidden flex flex-wrap items-center justify-center sm:justify-start gap-1.5 py-2 px-1">
            <button 
              type="button"
              onClick={() => handleCategoryClick('categorias', '')}
              className="px-2.5 sm:px-3 py-1 rounded-full bg-[#003882] text-yellow-300 font-bold text-[11px] border border-blue-700 shadow-xs cursor-pointer"
            >
              TODOS
            </button>

            {navCategories.map((item, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleCategoryClick(item.targetId, item.category)}
                className="px-2.5 sm:px-3 py-1 rounded-full bg-blue-900/70 hover:bg-blue-800 text-slate-100 hover:text-white text-[11px] font-medium border border-blue-700/60 transition-colors cursor-pointer"
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* VERSÃO DESKTOP (>= lg): Barra Clássica com clique preciso */}
          <nav className="hidden lg:flex items-center justify-between">
            <div className="flex items-center divide-x divide-blue-800/80 whitespace-nowrap">
              <button 
                type="button"
                onClick={() => handleCategoryClick('categorias', '')}
                className="py-2.5 px-3.5 bg-[#003882] text-yellow-300 hover:bg-[#002f6c] transition-colors flex items-center gap-1 font-bold text-xs shrink-0 cursor-pointer"
              >
                <span>TODOS OS PRODUTOS</span>
              </button>

              {navCategories.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleCategoryClick(item.targetId, item.category)}
                  className="py-2.5 px-4 text-slate-100 hover:text-white hover:bg-blue-800/70 transition-colors uppercase tracking-tight text-xs cursor-pointer shrink-0"
                >
                  {item.label}
                </button>
              ))}
            </div>

            {/* Informação Institucional à Direita (Aparece a partir de xl para não empurrar ou cortar itens em lg) */}
            <div className="hidden xl:flex items-center gap-3 text-blue-100 text-xs py-2 pl-4 shrink-0">
              <span className="flex items-center gap-1 text-slate-200">
                <MapPin className="w-3.5 h-3.5 text-yellow-300" />
                <span>Loja: R. Anhaia, 740 - Bom Retiro</span>
              </span>
              <span className="text-blue-400">·</span>
              <span className="font-semibold text-yellow-300">
                (11) 3352-7777
              </span>
            </div>
          </nav>

        </div>
      </div>

    </header>
  );
};
