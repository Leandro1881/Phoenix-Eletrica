/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, lazy, Suspense } from 'react';
import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { Categories } from './components/Categories';
import { Features } from './components/Features';
import { QuoteForm } from './components/QuoteForm';
import { Footer } from './components/Footer';
import { GoogleReviews } from './components/GoogleReviews';
import { AiQuoteAssistant } from './components/AiQuoteAssistant';
import { CategoryPage, OtherCategories } from './components/CategoryPage';
import { NotFound } from './components/NotFound';
import { findPage, findCategoryPage, NOT_FOUND, QUOTE_PAGE, ADMIN_PAGE } from './seo/pages';
import { applyHead } from './seo/head';
import { MessageSquare, ClipboardList, X } from 'lucide-react';
import { MotionConfig } from 'motion/react';
import { ReviewsData } from './types';
import { trackWhatsAppClick } from './utils/analytics';
import { playChime } from './utils/chime';

// Painel do lojista: baixado só quando aberto, para não pesar no carregamento do site
const AdminPage = lazy(() => import('./components/AdminPage').then((m) => ({ default: m.AdminPage })));

// Página atual (cada página do site é um endereço próprio, carregado do servidor)
const currentPage = findPage(window.location.pathname) ?? NOT_FOUND;
const currentCategoryPage = findCategoryPage(window.location.pathname);
// Convite do assistente: aparece uma vez por visitante, alguns segundos após a 1ª visita
const GREETED_KEY = 'phoenix_ai_greeted';
const GREET_DELAY_MS = 7000;

// O servidor marca a página do painel (endereço secreto); não existe atalho nem endereço fixo no código
const isPanelPage = document.querySelector('meta[name="phx-view"]')?.getAttribute('content') === 'panel';

export default function App() {
  const [selectedMaterial, setSelectedMaterial] = useState<string>('');
  const [isAiAssistantOpen, setIsAiAssistantOpen] = useState(false);
  const [showAiTeaser, setShowAiTeaser] = useState(false);
  const [reviewsData, setReviewsData] = useState<ReviewsData>({
    total: 16,
    ratingAverage: 4.8,
    reviews: []
  });

  // Título, descrição e canonical da página atual
  useEffect(() => {
    applyHead(isPanelPage ? ADMIN_PAGE : currentPage);
  }, []);

  // Links do tipo /#categorias vindos de outras páginas: rola até a seção após renderizar
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (!id || isPanelPage) return;
    const timer = setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }), 300);
    return () => clearTimeout(timer);
  }, []);

  // Consulta avaliações do Google dinâmicas do SQLite
  const refreshReviews = async () => {
    try {
      const res = await fetch('/api/avaliacoes');
      if (res.ok) {
        const data = await res.json();
        setReviewsData(data);
      }
    } catch (err) {
      console.warn('Erro ao carregar avaliações do Google:', err);
    }
  };

  useEffect(() => {
    refreshReviews();

    // Registra a visita no banco de dados SQLite silenciosamente
    try {
      fetch('/api/visitas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pagina: window.location.pathname || '/',
          origem: document.referrer || 'Acesso Direto'
        })
      }).catch(() => {});
    } catch (_) {}
  }, []);

  // 1ª visita: no computador o assistente abre sozinho; no celular aparece só um balão
  // (janela cobrindo a tela atrapalha a leitura e é penalizada pelo Google no celular)
  useEffect(() => {
    if (isPanelPage) return;
    try {
      if (localStorage.getItem(GREETED_KEY)) return;
    } catch {
      return;
    }
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(GREETED_KEY, '1');
      } catch {}
      if (window.matchMedia('(min-width: 640px)').matches) setIsAiAssistantOpen(true);
      else setShowAiTeaser(true);
      playChime();
    }, GREET_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  // Abrir o assistente por conta própria cancela o convite automático
  useEffect(() => {
    if (!isAiAssistantOpen) return;
    setShowAiTeaser(false);
    try {
      localStorage.setItem(GREETED_KEY, '1');
    } catch {}
  }, [isAiAssistantOpen]);

  const navigateToHome = () => {
    window.location.href = '/';
  };

  const handleScrollToQuote = () => {
    const el = document.getElementById('orcamento');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleSelectCategory = (material: string) => {
    setSelectedMaterial(material);
    handleScrollToQuote();
  };

  const handleApplyAiMaterials = (newMaterials: string) => {
    setSelectedMaterial((prev) => {
      if (!prev || prev.trim() === '') return newMaterials;
      return `${prev}\n\n[Itens Adicionados pelo Assistente IA]:\n${newMaterials}`;
    });
    // Assistente continua aberto: a conversa segue e o cliente fecha quando quiser
    handleScrollToQuote();
  };

  // Página do painel: renderiza só o painel (login com 2FA)
  if (isPanelPage) {
    return (
      <Suspense fallback={null}>
        <AdminPage onNavigateHome={navigateToHome} />
      </Suspense>
    );
  }

  return (
    <MotionConfig reducedMotion="user">
    <div className="min-h-screen bg-surface text-slate-800 flex flex-col font-sans antialiased selection:bg-brand-blue selection:text-white w-full max-w-full overflow-x-clip">
      
      {/* Header com Logo Phoenix Elétrica e Botão WhatsApp Oficial */}
      <Header 
        onSearch={(term) => setSelectedMaterial(term)}
        reviewsData={reviewsData}
      />

      {/* Main Content */}
      <main className="flex-1">
        {currentCategoryPage ? (
          <>
            <CategoryPage page={currentCategoryPage} onQuote={handleSelectCategory} />
            <QuoteForm
              initialMaterial={selectedMaterial}
              onOpenAiAssistant={() => setIsAiAssistantOpen(true)}
            />
            <OtherCategories currentPath={currentCategoryPage.path} />
          </>
        ) : currentPage === QUOTE_PAGE ? (
          <>
            <QuoteForm
              asPage
              initialMaterial={selectedMaterial}
              onOpenAiAssistant={() => setIsAiAssistantOpen(true)}
            />
            <GoogleReviews reviewsData={reviewsData} onReviewAdded={refreshReviews} />
          </>
        ) : currentPage === NOT_FOUND ? (
          <NotFound />
        ) : (
        <>
        {/* Hero Section: Foco em agilidade para obras e instalações */}
        <Hero 
          onScrollToQuote={handleScrollToQuote} 
          onSelectCategory={handleSelectCategory}
          reviewsData={reviewsData}
        />

        {/* Categorias: Fios e Cabos, Iluminação, Disjuntores e Quadros, etc. */}
        <Categories onSelectCategory={handleSelectCategory} />

        {/* Formulário de Captação de Orçamentos + WhatsApp */}
        <QuoteForm
          initialMaterial={selectedMaterial}
          onOpenAiAssistant={() => setIsAiAssistantOpen(true)}
        />

        {/* Diferenciais Competitivos: Por que Comprar na Phoenix Elétrica */}
        <Features />

        {/* Avaliações reais do Google */}
        <GoogleReviews 
          reviewsData={reviewsData}
          onReviewAdded={refreshReviews}
        />
        </>
        )}
      </main>

      <Footer />

      {/* Widget Flutuante do Assistente IA (Lado Esquerdo - Mantido montado para preservar histórico) */}
      <div 
        className={`fixed bottom-22 left-3 sm:left-6 z-50 w-[calc(100vw-24px)] sm:w-[440px] max-w-full drop-shadow-2xl transition-all duration-200 origin-bottom-left ${
          isAiAssistantOpen 
            ? 'opacity-100 scale-100 pointer-events-auto' 
            : 'opacity-0 scale-95 pointer-events-none select-none invisible'
        }`}
      >
        <AiQuoteAssistant
          onApplyMaterials={handleApplyAiMaterials}
          onClose={() => setIsAiAssistantOpen(false)}
          currentMaterials={selectedMaterial}
        />
      </div>

      {/* Convite do assistente no celular (1ª visita) */}
      {showAiTeaser && !isAiAssistantOpen && (
        <div className="fixed bottom-22 left-4 right-20 z-40 max-w-[300px] animate-fadeIn">
          <div className="relative bg-white rounded-2xl rounded-bl-md shadow-2xl ring-1 ring-slate-900/10 p-3 pr-8">
            <button
              type="button"
              onClick={() => setShowAiTeaser(false)}
              className="absolute top-1.5 right-1.5 p-1.5 text-slate-400 hover:text-slate-700 rounded-full cursor-pointer"
              aria-label="Fechar convite"
            >
              <X className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setIsAiAssistantOpen(true)}
              className="flex items-center gap-2.5 text-left cursor-pointer"
            >
              <img src="/icon-192.png" alt="" width={36} height={36} className="w-9 h-9 rounded-full bg-surface p-1 shrink-0" />
              <span className="text-sm text-slate-800 leading-snug">
                Oi! 👋 Quer ajuda para montar sua <strong className="text-brand-blue">lista de materiais</strong>?
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Botão Flutuante do assistente (lado esquerdo, parecido com o do WhatsApp) */}
      <div className="fixed bottom-6 left-6 z-40">
        <button
          type="button"
          onClick={() => setIsAiAssistantOpen((prev) => !prev)}
          className="inline-flex items-center gap-2.5 bg-brand-navy hover:bg-brand-navy-2 text-white p-3.5 sm:px-5 sm:py-3.5 rounded-full shadow-2xl shadow-brand-navy/40 transition-all hover:-translate-y-0.5 active:scale-95 cursor-pointer ring-1 ring-white/15 group"
          title="Montar lista de materiais"
          aria-label={isAiAssistantOpen ? 'Fechar conversa' : 'Montar lista de materiais'}
        >
          <div className="relative flex items-center justify-center">
            <ClipboardList className="w-5 h-5 text-brand-yellow group-hover:rotate-6 transition-transform" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-brand-navy animate-pulse" />
          </div>
          <span className="hidden sm:inline font-bold text-sm">Montar lista</span>
        </button>
      </div>

      {/* Botão Flutuante Oficial do WhatsApp para Clientes com rastreamento (Lado Direito) com Onda Infinita de Pulse */}
      <div className="fixed bottom-6 right-6 z-30 pointer-events-none">
        <div className="relative pointer-events-auto flex items-center justify-center">
          {/* Ondas sutis se expandindo atrás do botão (efeito radar / pulse) */}

          <a
            href="https://wa.me/5511983239782?text=Ol%C3%A1!%20Gostaria%20de%20um%20or%C3%A7amento%20com%20a%20Phoenix%20El%C3%A9trica."
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackWhatsAppClick('Botão Flutuante (WhatsApp)', 'WhatsApp da Loja')}
            className="relative inline-flex items-center gap-2.5 bg-[#25D366] hover:bg-[#1fb257] text-white p-3.5 sm:px-5 sm:py-3.5 rounded-full shadow-2xl shadow-emerald-700/40 transition-all duration-300 hover:-translate-y-0.5 active:scale-95 cursor-pointer animate-whatsapp-pulse"
            title="Chamar no WhatsApp da Phoenix Elétrica"
          >
            <MessageSquare className="w-5 h-5 fill-current" />
            <span className="hidden sm:inline font-bold text-sm">WhatsApp</span>
          </a>
        </div>
      </div>

    </div>
    </MotionConfig>
  );
}
