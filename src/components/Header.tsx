import React, { useState, useEffect, useRef } from 'react';
import { PhoenixLogo } from './PhoenixLogo';
import {
  MessageSquare,
  Search,
  Menu,
  X,
  ChevronDown,
  ChevronRight,
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ReviewsData } from '../types';
import { trackWhatsAppClick } from '../utils/analytics';

interface HeaderProps {
  onSearch?: (term: string) => void;
  onSelectCategory?: (category: string) => void;
  reviewsData?: ReviewsData;
}

const WHATSAPP_URL =
  'https://wa.me/5511983239782?text=Ol%C3%A1!%20Gostaria%20de%20informa%C3%A7%C3%B5es%20e%20or%C3%A7amento%20de%20materiais%20el%C3%A9tricos%20com%20a%20Phoenix%20El%C3%A9trica.';

export const navCategories = [
  { label: 'Fios e Cabos', category: 'Cabos e Fios de Cobre', targetId: 'fios-cabos' },
  { label: 'Disjuntores e Quadros', category: 'Disjuntores e Proteção Elétrica', targetId: 'disjuntores-quadros' },
  { label: 'Iluminação LED', category: 'Iluminação Industrial e Residencial', targetId: 'iluminacao-led' },
  { label: 'Infraestrutura', category: 'Infraestrutura e Eletrodutos', targetId: 'infraestrutura' },
  { label: 'Tomadas e Acabamentos', category: 'Tomadas e Linhas de Acabamento', targetId: 'tomadas-acabamentos' },
  { label: 'Automação e Comandos', category: 'Automação e Comandos Elétricos', targetId: 'automacao-comandos' }
];

const navLinks = [
  { label: 'Diferenciais', targetId: 'diferenciais' },
  { label: 'Avaliações', targetId: 'avaliacoes' },
  { label: 'Contato', targetId: 'contato' }
];

const scrollToId = (id: string) => {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

export const Header: React.FC<HeaderProps> = ({ onSearch, onSelectCategory }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isProductsOpen, setIsProductsOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);


  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 24);
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // ESC fecha menus; trava o scroll com o drawer aberto
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMobileMenuOpen(false);
        setIsSearchOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = isMobileMenuOpen ? 'hidden' : 'unset';
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isMobileMenuOpen]);

  useEffect(() => {
    if (isSearchOpen) searchInputRef.current?.focus();
  }, [isSearchOpen]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;
    onSearch?.(searchTerm);
    scrollToId('orcamento');
    setIsMobileMenuOpen(false);
    setIsSearchOpen(false);
  };

  const handleCategoryClick = (targetId: string, category: string) => {
    setIsMobileMenuOpen(false);
    setIsProductsOpen(false);
    onSelectCategory?.(category);
    const targetEl = document.getElementById(targetId);
    if (targetEl) {
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      targetEl.classList.add('ring-2', 'ring-brand-blue');
      setTimeout(() => targetEl.classList.remove('ring-2', 'ring-brand-blue'), 1500);
    } else {
      scrollToId('categorias');
    }
  };

  const goTo = (id: string) => {
    setIsMobileMenuOpen(false);
    scrollToId(id);
  };

  return (
    <>
    <header className="sticky top-0 z-40 w-full">
      {/* Barra principal */}
      <div
        className={`transition-[background-color,box-shadow,border-color] duration-300 border-b ${
          isScrolled
            ? 'bg-white/85 backdrop-blur-xl border-slate-200/80 shadow-[0_8px_30px_-12px_rgba(8,22,52,0.18)]'
            : 'bg-white border-slate-100'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-[72px] flex items-center justify-between gap-4">
          <a href="#" className="shrink-0 transition-transform duration-200 hover:scale-[1.02]" title="Phoenix Elétrica">
            <PhoenixLogo variant="horizontal" size="md" />
          </a>

          {/* Navegação desktop */}
          <nav className="hidden lg:flex items-center gap-8 text-sm font-semibold text-slate-700">
            <div
              className="relative"
              onMouseEnter={() => setIsProductsOpen(true)}
              onMouseLeave={() => setIsProductsOpen(false)}
            >
              <button
                type="button"
                onClick={() => setIsProductsOpen((p) => !p)}
                className="flex items-center gap-1 py-2 hover:text-brand-blue transition-colors cursor-pointer"
                aria-expanded={isProductsOpen}
              >
                Produtos
                <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isProductsOpen ? 'rotate-180' : ''}`} />
              </button>
              <AnimatePresence>
                {isProductsOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    transition={{ duration: 0.18 }}
                    className="absolute left-1/2 -translate-x-1/2 top-full pt-3 w-72"
                  >
                    <div className="rounded-2xl bg-white p-2 shadow-2xl shadow-slate-900/10 ring-1 ring-slate-200">
                      {navCategories.map((item) => (
                        <button
                          key={item.targetId}
                          type="button"
                          onClick={() => handleCategoryClick(item.targetId, item.category)}
                          className="group w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left text-sm text-slate-700 hover:bg-brand-blue-soft hover:text-brand-blue transition-colors cursor-pointer"
                        >
                          {item.label}
                          <ArrowRight className="w-4 h-4 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            {navLinks.map((link) => (
              <button
                key={link.targetId}
                type="button"
                onClick={() => scrollToId(link.targetId)}
                className="nav-link-underline py-2 hover:text-brand-blue transition-colors cursor-pointer"
              >
                {link.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            {/* Busca expansível */}
            <div className="hidden md:flex items-center">
              <AnimatePresence initial={false} mode="wait">
                {isSearchOpen ? (
                  <motion.form
                    key="search-form"
                    onSubmit={handleSearchSubmit}
                    initial={{ width: 40, opacity: 0 }}
                    animate={{ width: 260, opacity: 1 }}
                    exit={{ width: 40, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="relative"
                  >
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      onBlur={() => !searchTerm && setIsSearchOpen(false)}
                      placeholder="Buscar cabo, disjuntor, LED..."
                      className="w-full h-10 pl-10 pr-3 rounded-full bg-slate-100 text-sm text-slate-800 placeholder-slate-400 outline-none focus:ring-2 focus:ring-brand-blue/30"
                    />
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  </motion.form>
                ) : (
                  <motion.button
                    key="search-btn"
                    type="button"
                    onClick={() => setIsSearchOpen(true)}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="w-10 h-10 rounded-full flex items-center justify-center text-slate-600 hover:bg-slate-100 hover:text-brand-blue transition-colors cursor-pointer"
                    aria-label="Buscar produtos"
                  >
                    <Search className="w-5 h-5" />
                  </motion.button>
                )}
              </AnimatePresence>
            </div>

            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackWhatsAppClick('Cabeçalho / Topo', 'WhatsApp Comercial Header')}
              className="w-10 h-10 rounded-full flex items-center justify-center bg-[#25D366]/10 text-[#1a9e4b] hover:bg-[#25D366] hover:text-white transition-colors"
              title="Chamar no WhatsApp"
              aria-label="Chamar no WhatsApp"
            >
              <MessageSquare className="w-5 h-5" />
            </a>

            <button
              type="button"
              onClick={() => scrollToId('orcamento')}
              className="hidden sm:inline-flex items-center gap-2 h-10 px-5 rounded-full bg-brand-blue hover:bg-brand-blue-dark text-white text-sm font-bold shadow-lg shadow-brand-blue/25 transition-all hover:-translate-y-0.5 cursor-pointer"
            >
              Orçamento
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden w-10 h-10 rounded-full flex items-center justify-center text-brand-navy hover:bg-slate-100 transition-colors cursor-pointer"
              aria-label="Abrir menu"
              aria-expanded={isMobileMenuOpen}
            >
              <Menu className="w-6 h-6" />
            </button>
          </div>
        </div>
      </div>

      {/* Drawer mobile */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-brand-navy/60 backdrop-blur-sm"
              onClick={() => setIsMobileMenuOpen(false)}
              aria-hidden="true"
            />
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="absolute right-0 top-0 h-full w-[86vw] max-w-sm bg-white shadow-2xl flex flex-col"
            >
              <div className="flex items-center justify-between p-4 border-b border-slate-100">
                <PhoenixLogo variant="horizontal" size="sm" />
                <button
                  type="button"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-slate-100 text-slate-600 cursor-pointer"
                  aria-label="Fechar menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-6">
                <form onSubmit={handleSearchSubmit} className="relative">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar produtos..."
                    className="w-full h-11 pl-10 pr-3 rounded-xl bg-slate-100 text-sm outline-none focus:ring-2 focus:ring-brand-blue/30"
                  />
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                </form>

                <div>
                  <div className="px-2 pb-2 text-[11px] font-bold uppercase tracking-widest text-slate-400">Produtos</div>
                  {navCategories.map((item, i) => (
                    <motion.button
                      key={item.targetId}
                      type="button"
                      initial={{ opacity: 0, x: 16 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.05 * i }}
                      onClick={() => handleCategoryClick(item.targetId, item.category)}
                      className="w-full flex items-center justify-between px-2 py-3 rounded-xl text-sm font-medium text-slate-700 hover:bg-brand-blue-soft hover:text-brand-blue cursor-pointer"
                    >
                      {item.label}
                      <ChevronRight className="w-4 h-4 text-slate-300" />
                    </motion.button>
                  ))}
                </div>

                <div>
                  <div className="px-2 pb-2 text-[11px] font-bold uppercase tracking-widest text-slate-400">Empresa</div>
                  {navLinks.map((link) => (
                    <button
                      key={link.targetId}
                      type="button"
                      onClick={() => goTo(link.targetId)}
                      className="w-full flex items-center justify-between px-2 py-3 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-100 cursor-pointer"
                    >
                      {link.label}
                      <ChevronRight className="w-4 h-4 text-slate-300" />
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-4 border-t border-slate-100 space-y-2">
                <button
                  type="button"
                  onClick={() => goTo('orcamento')}
                  className="w-full h-12 rounded-xl bg-brand-blue text-white font-bold text-sm flex items-center justify-center gap-2 cursor-pointer"
                >
                  Solicitar orçamento
                  <ArrowRight className="w-4 h-4" />
                </button>
                <a
                  href={WHATSAPP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => trackWhatsAppClick('Menu Hambúrguer Mobile', 'WhatsApp Menu Mobile')}
                  className="w-full h-12 rounded-xl bg-[#25D366] text-white font-bold text-sm flex items-center justify-center gap-2"
                >
                  <MessageSquare className="w-4 h-4 fill-current" />
                  WhatsApp (11) 98323-9782
                </a>
              </div>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
    </header>
    </>
  );
};
