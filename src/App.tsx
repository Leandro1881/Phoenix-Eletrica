/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { Categories } from './components/Categories';
import { Features } from './components/Features';
import { QuoteForm } from './components/QuoteForm';
import { Footer } from './components/Footer';
import { LeadsModal } from './components/LeadsModal';
import { AdminPage } from './components/AdminPage';
import { GoogleReviews } from './components/GoogleReviews';
import { AiQuoteAssistant } from './components/AiQuoteAssistant';
import { MessageSquare, Bot } from 'lucide-react';
import { MotionConfig } from 'motion/react';
import { ReviewsData } from './types';
import { trackWhatsAppClick } from './utils/analytics';

export default function App() {
  const [selectedMaterial, setSelectedMaterial] = useState<string>('');
  const [isLeadsModalOpen, setIsLeadsModalOpen] = useState(false);
  const [isAiAssistantOpen, setIsAiAssistantOpen] = useState(false);
  const [reviewsData, setReviewsData] = useState<ReviewsData>({
    total: 16,
    ratingAverage: 4.8,
    reviews: []
  });

  // Estado de Rota Dedicada para /admin
  const [isAdminRoute, setIsAdminRoute] = useState<boolean>(() => {
    return (
      window.location.pathname === '/admin' ||
      window.location.pathname.startsWith('/admin') ||
      window.location.hash === '#/admin' ||
      window.location.hash === '#admin-page'
    );
  });

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

  // Monitora alterações de URL (navegação por rotas /admin e /)
  useEffect(() => {
    const handleLocationChange = () => {
      const isAdm = (
        window.location.pathname === '/admin' ||
        window.location.pathname.startsWith('/admin') ||
        window.location.hash === '#/admin' ||
        window.location.hash === '#admin-page'
      );
      setIsAdminRoute(isAdm);
    };

    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('hashchange', handleLocationChange);
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('hashchange', handleLocationChange);
    };
  }, []);

  // Atalho secreto de teclado: Ctrl + Shift + A ou Alt + L
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.altKey && (e.key === 'l' || e.key === 'L')) ||
        (e.ctrlKey && e.shiftKey && (e.key === 'a' || e.key === 'A'))
      ) {
        e.preventDefault();
        setIsLeadsModalOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Verifica se o lojista acessou com ?admin=true ou #admin na URL
  useEffect(() => {
    const checkAdminUrl = () => {
      if (window.location.search.includes('admin') || window.location.hash === '#admin' || window.location.hash === '#painel') {
        setIsLeadsModalOpen(true);
      }
    };
    checkAdminUrl();
    window.addEventListener('hashchange', checkAdminUrl);
    return () => window.removeEventListener('hashchange', checkAdminUrl);
  }, []);

  // Navegação suave entre a Loja e a Página /admin
  const navigateToAdmin = () => {
    history.pushState(null, '', '/admin');
    setIsAdminRoute(true);
    setIsLeadsModalOpen(false);
  };

  const navigateToHome = () => {
    history.pushState(null, '', '/');
    setIsAdminRoute(false);
  };

  const handleCloseAdminModal = () => {
    setIsLeadsModalOpen(false);
    if (window.location.hash.includes('admin') || window.location.hash.includes('painel')) {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
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
    handleScrollToQuote();
    setIsAiAssistantOpen(false);
  };

  // Se a rota atual for /admin, renderiza a Página Dedicada do Administrador
  if (isAdminRoute) {
    return <AdminPage onNavigateHome={navigateToHome} />;
  }

  return (
    <MotionConfig reducedMotion="user">
    <div className="min-h-screen bg-surface text-slate-800 flex flex-col font-sans antialiased selection:bg-brand-blue selection:text-white w-full max-w-full overflow-x-clip">
      
      {/* Header com Logo Phoenix Elétrica e Botão WhatsApp Oficial */}
      <Header 
        onSearch={(term) => setSelectedMaterial(term)}
        onSelectCategory={handleSelectCategory}
        reviewsData={reviewsData}
      />

      {/* Main Content */}
      <main className="flex-1">
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
      </main>

      {/* Footer limpo sem botões para clientes; gatilho secreto via 3 cliques no copyright */}
      <Footer onSecretAdminTrigger={() => setIsLeadsModalOpen(true)} />

      {/* Painel do Lojista Protegido com Login e Senha */}
      <LeadsModal
        isOpen={isLeadsModalOpen}
        onClose={handleCloseAdminModal}
        onOpenFullScreen={navigateToAdmin}
      />

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

      {/* Botão Flutuante do Assistente de IA Phoenix (Lado Esquerdo - Parecido com o WhatsApp) */}
      <div className="fixed bottom-6 left-6 z-40">
        <button
          type="button"
          onClick={() => setIsAiAssistantOpen((prev) => !prev)}
          className="inline-flex items-center gap-2.5 bg-brand-navy hover:bg-brand-navy-2 text-white p-3.5 sm:px-5 sm:py-3.5 rounded-full shadow-2xl shadow-brand-navy/40 transition-all hover:-translate-y-0.5 active:scale-95 cursor-pointer ring-1 ring-white/15 group"
          title="Assistente Técnico de IA da Phoenix Elétrica"
          aria-label="Abrir Assistente de IA"
        >
          <div className="relative flex items-center justify-center">
            <Bot className="w-5 h-5 text-brand-yellow group-hover:rotate-12 transition-transform" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-brand-navy animate-pulse" />
          </div>
          <span className="hidden sm:inline font-bold text-sm">Assistente de IA</span>
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
