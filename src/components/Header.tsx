import React, { useState, useEffect } from 'react';
import { PhoenixLogo } from './PhoenixLogo';
import { 
  MessageSquare, 
  Search, 
  PhoneCall, 
  Star, 
  MapPin, 
  Menu, 
  X, 
  ChevronRight, 
  FileText, 
  Sparkles,
  Layers
} from 'lucide-react';
import { ReviewsData } from '../types';
import { trackWhatsAppClick } from '../utils/analytics';

interface HeaderProps {
  onSearch?: (term: string) => void;
  onSelectCategory?: (category: string) => void;
  reviewsData?: ReviewsData;
}

export const Header: React.FC<HeaderProps> = ({ onSearch, onSelectCategory, reviewsData }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  const totalReviews = reviewsData?.total || 16;
  const ratingAverage = reviewsData ? reviewsData.ratingAverage.toFixed(1).replace('.', ',') : '4,8';

  // Monitora a rolagem para aplicar efeito glassmorphism e compactação suave
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 25);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Fecha o menu mobile com a tecla ESC e trava o scroll quando aberto
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsMobileMenuOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);

    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isMobileMenuOpen]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      if (onSearch) onSearch(searchTerm);
      const el = document.getElementById('orcamento');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
      setIsMobileMenuOpen(false);
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
    setIsMobileMenuOpen(false);
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
    <header className={`sticky top-0 z-40 w-full transition-all duration-300 ${
      isScrolled 
        ? 'bg-white/92 backdrop-blur-md shadow-md border-b border-slate-200/80' 
        : 'bg-white shadow-xs border-b border-slate-200'
    }`}>
      
      {/* 1. Barra Superior Institucional (Telefones, Endereço e Avaliações Google Oficiais) */}
      <div className={`bg-[#003882] text-white text-xs px-4 sm:px-6 lg:px-8 border-b border-blue-900 transition-all duration-300 ${
        isScrolled ? 'py-1 text-[10px] sm:text-[11px]' : 'py-1.5 text-[11px] sm:text-xs'
      }`}>
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
          
          {/* Telefones Oficiais */}
          <div className="flex items-center gap-3 overflow-hidden">
            <a 
              href="tel:1133527777" 
              className="font-semibold tracking-wider flex items-center gap-1.5 hover:text-yellow-300 transition-colors whitespace-nowrap hover:scale-[1.02] active:scale-[0.98]"
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
              className="hidden sm:inline text-slate-200 hover:text-yellow-300 transition-colors whitespace-nowrap hover:scale-[1.02] active:scale-[0.98]"
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
              className="flex items-center gap-1 bg-blue-900/80 hover:bg-blue-800 px-2 py-0.5 rounded border border-blue-700/60 font-semibold whitespace-nowrap transition-colors hover:scale-[1.02] active:scale-[0.98]"
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

      {/* 2. Barra Principal com Logotipo, Busca, Televendas e Botão Hambúrguer Mobile */}
      <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-2 sm:gap-4 transition-all duration-300 ${
        isScrolled ? 'py-1.5 sm:py-2.5' : 'py-2.5 sm:py-3.5'
      }`}>
        
        {/* Lado Esquerdo: Botão Hambúrguer Mobile + Logotipo Phoenix Elétrica Oficial */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          
          {/* Botão Hambúrguer (Aparece no Mobile < lg) */}
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen((prev) => !prev)}
            className="lg:hidden p-1.5 -ml-1 text-[#003882] hover:bg-slate-100 rounded-lg transition-colors cursor-pointer flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-[#004b9c]"
            aria-label={isMobileMenuOpen ? "Fechar menu de navegação" : "Abrir menu de navegação"}
            aria-expanded={isMobileMenuOpen}
          >
            {isMobileMenuOpen ? (
              <X className="w-6 h-6 text-[#d31010]" />
            ) : (
              <Menu className="w-6 h-6 text-[#003882]" />
            )}
          </button>

          <a href="#" className="flex items-center group shrink-0 transition-transform duration-200 hover:scale-[1.02]" title="Phoenix Elétrica - Distribuidora">
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
              className="absolute right-1 px-3 sm:px-4 py-1.5 bg-[#004b9c] hover:bg-[#003882] text-white text-xs font-semibold rounded-md flex items-center gap-1.5 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
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
            className="inline-flex items-center gap-1.5 sm:gap-2 bg-[#25D366] hover:bg-[#20ba5a] text-white text-xs sm:text-sm font-bold px-2.5 sm:px-4 py-2 sm:py-2.5 rounded-lg shadow-sm hover:shadow-md transition-all hover:scale-[1.03] active:scale-[0.98] shrink-0"
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

      {/* 3. Navegação por Departamentos Desktop (Visível apenas em telas grandes >= lg) com Efeito de Sublinhado Expansivo */}
      <div className="hidden lg:block bg-[#004b9c] text-white text-xs font-semibold border-t border-blue-800/60 shadow-inner">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* VERSÃO DESKTOP (>= lg): Barra com microinteração de sublinhado do centro para as bordas */}
          <nav className="flex items-center justify-between">
            <div className="flex items-center divide-x divide-blue-800/80 whitespace-nowrap overflow-x-auto scrollbar-none">
              <button 
                type="button"
                onClick={() => handleCategoryClick('categorias', '')}
                className="relative py-2.5 px-3.5 bg-[#003882] text-yellow-300 hover:bg-[#002f6c] transition-colors flex items-center gap-1 font-bold text-xs shrink-0 cursor-pointer after:content-[''] after:absolute after:bottom-0.5 after:left-1/2 after:-translate-x-1/2 after:w-0 hover:after:w-4/5 after:h-0.5 after:bg-yellow-400 after:transition-all after:duration-300 after:origin-center"
              >
                <span>TODOS OS PRODUTOS</span>
              </button>

              {navCategories.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleCategoryClick(item.targetId, item.category)}
                  className="relative py-2.5 px-3.5 xl:px-4 text-slate-100 hover:text-white hover:bg-blue-800/70 transition-colors uppercase tracking-tight text-xs cursor-pointer shrink-0 after:content-[''] after:absolute after:bottom-0.5 after:left-1/2 after:-translate-x-1/2 after:w-0 hover:after:w-4/5 after:h-0.5 after:bg-yellow-400 after:transition-all after:duration-300 after:origin-center"
                >
                  {item.label}
                </button>
              ))}
            </div>

            {/* Selo Comercial Alinhado que Não Ultrapassa a Margem */}
            <div className="hidden 2xl:flex items-center gap-2 text-blue-100 text-xs py-2 pl-4 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-semibold text-white">Atacado & Varejo com Entrega Rápida</span>
            </div>
          </nav>

        </div>
      </div>

      {/* =========================================================================
          4. MENU HAMBÚRGUER MOBILE COMPLETO (Drawer Lateral com Todos os Itens)
          ========================================================================= */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          {/* Fundo Escuro com Fechamento ao Clicar Fora */}
          <div 
            className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs transition-opacity animate-fadeIn"
            onClick={() => setIsMobileMenuOpen(false)}
            aria-hidden="true"
          />

          {/* Drawer Lateral Deslizante */}
          <div className="relative w-80 max-w-[85vw] bg-white h-full shadow-2xl flex flex-col z-10 animate-slideRight">
            
            {/* Topo do Menu Mobile */}
            <div className="p-4 bg-[#003882] text-white flex items-center justify-between border-b border-blue-900">
              <div className="flex items-center gap-2.5">
                <PhoenixLogo variant="compact" size="sm" />
                <div>
                  <div className="font-extrabold text-sm tracking-tight leading-tight">PHOENIX ELÉTRICA</div>
                  <div className="text-[10px] text-blue-200 font-semibold uppercase tracking-wider">Distribuidora de Materiais</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-1.5 rounded-lg bg-blue-900/80 hover:bg-red-600 text-white transition-colors cursor-pointer"
                aria-label="Fechar Menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Conteúdo com Rolagem do Menu Mobile */}
            <div className="flex-1 overflow-y-auto p-4 space-y-5 text-slate-800">
              
              {/* Botão de Destaque Máximo: Solicitar Orçamento / Cotação */}
              <div>
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    const el = document.getElementById('orcamento');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="w-full flex items-center justify-between p-3.5 rounded-xl bg-gradient-to-r from-[#003882] via-[#004b9c] to-[#d31010] text-white font-extrabold text-xs sm:text-sm shadow-md hover:shadow-lg transition-all cursor-pointer text-left group"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4 text-yellow-300" />
                    </div>
                    <div>
                      <div className="leading-tight font-black">SOLICITAR ORÇAMENTO</div>
                      <div className="text-[10px] text-blue-100 font-normal">Envie sua lista ou anexe PDF</div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-white/80 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>

              {/* Seção: Departamentos de Produtos */}
              <div className="space-y-1">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-2 pb-1 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-[#004b9c]" />
                  <span>Departamentos de Materiais</span>
                </div>
                
                <button
                  type="button"
                  onClick={() => handleCategoryClick('categorias', '')}
                  className="w-full flex items-center justify-between p-2.5 rounded-lg hover:bg-slate-100 text-slate-900 font-bold text-xs transition-colors cursor-pointer text-left"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#d31010] shrink-0" />
                    <span>Ver Todos os Produtos</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>

                {navCategories.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleCategoryClick(item.targetId, item.category)}
                    className="w-full flex items-center justify-between p-2.5 rounded-lg hover:bg-blue-50 text-slate-700 hover:text-[#003882] text-xs font-semibold transition-colors cursor-pointer text-left"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0" />
                      <span>{item.label}</span>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
                  </button>
                ))}
              </div>

              {/* Seção: Informações & Confiança */}
              <div className="space-y-1 pt-3 border-t border-slate-200">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-2 pb-1 flex items-center gap-1.5">
                  <Star className="w-3.5 h-3.5 text-yellow-500 fill-current" />
                  <span>Institucional & Confiança</span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    const el = document.getElementById('avaliacoes');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="w-full flex items-center justify-between p-2.5 rounded-lg hover:bg-slate-100 text-slate-700 text-xs font-medium transition-colors cursor-pointer text-left"
                >
                  <div className="flex items-center gap-2.5">
                    <Star className="w-4 h-4 text-yellow-500 fill-current shrink-0" />
                    <span>Avaliações no Google (Nota 4,8)</span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    const el = document.getElementById('diferenciais');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="w-full flex items-center justify-between p-2.5 rounded-lg hover:bg-slate-100 text-slate-700 text-xs font-medium transition-colors cursor-pointer text-left"
                >
                  <div className="flex items-center gap-2.5">
                    <Sparkles className="w-4 h-4 text-[#004b9c] shrink-0" />
                    <span>Diferenciais da Distribuidora</span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                </button>

                <a
                  href="https://maps.google.com/?q=R.+Anhaia,+740+-+Bom+Retiro,+S%C3%A3o+Paulo+-+SP,+01130-000"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-between p-2.5 rounded-lg hover:bg-slate-100 text-slate-700 text-xs font-medium transition-colors cursor-pointer text-left"
                >
                  <div className="flex items-center gap-2.5">
                    <MapPin className="w-4 h-4 text-[#d31010] shrink-0" />
                    <span>Loja Física no Bom Retiro - SP</span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                </a>
              </div>

              {/* Canais Oficiais de Atendimento */}
              <div className="pt-3 border-t border-slate-200 space-y-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-2 flex items-center gap-1.5">
                  <PhoneCall className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Canais de Atendimento</span>
                </div>

                <a
                  href="https://wa.me/5511983239782?text=Ol%C3%A1!%20Gostaria%20de%20informa%C3%A7%C3%B5es%20e%20or%C3%A7amento%20de%20materiais%20el%C3%A9tricos%20com%20a%20Phoenix%20El%C3%A9trica."
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => trackWhatsAppClick('Menu Hambúrguer Mobile', 'WhatsApp Menu Mobile')}
                  className="w-full flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#20ba5a] text-white p-3 rounded-lg text-xs font-extrabold shadow-sm transition-colors"
                >
                  <MessageSquare className="w-4 h-4 fill-current shrink-0" />
                  <span>CHAMAR NO WHATSAPP</span>
                </a>

                <a
                  href="tel:1133527777"
                  className="w-full flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-[#003882] border border-slate-300 p-2.5 rounded-lg text-xs font-bold transition-colors"
                >
                  <PhoneCall className="w-4 h-4 text-[#004b9c] shrink-0" />
                  <span>TELEVENDAS: (11) 3352-7777</span>
                </a>
              </div>

            </div>

            {/* Rodapé do Menu Mobile */}
            <div className="p-3 bg-slate-50 border-t border-slate-200 text-center text-[11px] text-slate-600">
              <span className="font-semibold text-slate-800">Phoenix Elétrica</span> · R. Anhaia, 740 - Bom Retiro, SP
            </div>

          </div>
        </div>
      )}

    </header>
  );
};
