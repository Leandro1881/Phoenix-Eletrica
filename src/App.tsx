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
import { MessageSquare, Bot, Sparkles } from 'lucide-react';
import { ReviewsData } from './types';
import { trackWhatsAppClick } from './utils/analytics';

export default function App() {
  const [selectedMaterial, setSelectedMaterial] = useState<string>('');
  const [isLeadsModalOpen, setIsLeadsModalOpen] = useState(false);
  const [isAiAssistantOpen, setIsAiAssistantOpen] = useState(false);
  const [, setLeadsCount] = useState<number>(0);
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

  // Consulta quantidade de leads salvos no banco SQLite
  const refreshLeadsCount = async () => {
    try {
      const res = await fetch('/api/orcamentos');
      if (res.ok) {
        const data = await res.json();
        setLeadsCount(data.total || data.leads?.length || 0);
      }
    } catch (e) {
      console.warn('Erro ao consultar contagem de leads:', e);
    }
  };

  useEffect(() => {
    refreshLeadsCount();
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
    <div className="min-h-screen bg-[#f4f6f9] text-slate-800 flex flex-col font-['Plus_Jakarta_Sans',sans-serif] selection:bg-[#004b9c] selection:text-white w-full max-w-full overflow-x-hidden">
      
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
          onLeadSubmitted={refreshLeadsCount}
          onOpenAiAssistant={() => setIsAiAssistantOpen(true)}
        />

        {/* Avaliações Positivas no Google (Contagem e Média Dinâmica) */}
        <GoogleReviews 
          reviewsData={reviewsData}
          onReviewAdded={refreshReviews}
        />

        {/* Diferenciais Competitivos: Por que Comprar na Phoenix Elétrica */}
        <Features />
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
          className="inline-flex items-center gap-2.5 bg-[#003882] hover:bg-[#002f6c] text-white p-3.5 sm:px-5 sm:py-3.5 rounded-full sm:rounded-2xl shadow-2xl shadow-blue-950/60 hover:shadow-blue-900/40 transition-all hover:scale-105 active:scale-95 cursor-pointer border border-blue-400/30 group"
          title="Assistente Técnico de IA da Phoenix Elétrica"
          aria-label="Abrir Assistente de IA"
        >
          <div className="relative flex items-center justify-center">
            <Bot className="w-5 h-5 text-yellow-300 group-hover:rotate-12 transition-transform" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-[#003882] animate-pulse" />
          </div>
          <span className="hidden sm:inline font-bold text-sm">Assistente de IA</span>
        </button>
      </div>

      {/* Botão Flutuante Oficial do WhatsApp para Clientes com rastreamento (Lado Direito) com Onda Infinita de Pulse */}
      <div className="fixed bottom-6 right-6 z-30 pointer-events-none">
        <div className="relative pointer-events-auto flex items-center justify-center">
          {/* Ondas sutis se expandindo atrás do botão (efeito radar / pulse) */}
          <span className="absolute -inset-1.5 rounded-full sm:rounded-2xl bg-emerald-500/40 animate-ping pointer-events-none" style={{ animationDuration: '2.5s' }} />
          <span className="absolute -inset-3 rounded-full sm:rounded-2xl bg-emerald-400/20 animate-pulse pointer-events-none" />

          <a
            href="https://wa.me/5511983239782?text=Ol%C3%A1!%20Gostaria%20de%20um%20or%C3%A7amento%20com%20a%20Phoenix%20El%C3%A9trica."
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackWhatsAppClick('Botão Flutuante (WhatsApp)', 'WhatsApp da Loja')}
            className="relative inline-flex items-center gap-2.5 bg-[#25D366] hover:bg-[#20ba5a] text-white p-3.5 sm:px-5 sm:py-3.5 rounded-full sm:rounded-2xl shadow-2xl shadow-emerald-950/60 hover:shadow-emerald-600/50 transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer animate-whatsapp-pulse"
            title="Chamar no WhatsApp da Phoenix Elétrica"
          >
            <MessageSquare className="w-5 h-5 fill-current" />
            <span className="hidden sm:inline font-bold text-sm">WhatsApp da Loja</span>
          </a>
        </div>
      </div>

    </div>
  );
}
