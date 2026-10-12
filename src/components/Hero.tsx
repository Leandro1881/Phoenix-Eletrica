import React from 'react';
import { ArrowRight, Zap, CheckCircle2, MessageSquare, MapPin, Phone } from 'lucide-react';
import { motion } from 'motion/react';
import { ReviewsData } from '../types';

interface HeroProps {
  onScrollToQuote: () => void;
  onSelectCategory?: (category: string) => void;
  reviewsData?: ReviewsData;
}

export const Hero: React.FC<HeroProps> = ({ onScrollToQuote }) => {
  return (
    <section className="bg-[#f4f6f9] py-6 sm:py-8 border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Banner Principal Comercial em Largura Total */}
        <motion.div 
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="bg-white rounded-lg border border-slate-200 shadow-sm p-5 sm:p-8 relative overflow-hidden"
        >
          
          {/* Faixa decorativa superior com as cores da Phoenix (Azul e Vermelho) */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#003882] via-[#004b9c] to-[#d31010]" />

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 lg:gap-8 items-stretch">
            
            {/* Textos de Impacto Comercial */}
            <div className="xl:col-span-8 flex flex-col justify-between space-y-3.5 sm:space-y-4">
              
              <div className="inline-flex items-center gap-1.5 sm:gap-2 bg-blue-50 border border-blue-200 text-[#003882] px-2.5 sm:px-3 py-1 rounded text-[11px] sm:text-xs font-bold tracking-wide">
                <span>DISTRIBUIDORA DE MATERIAIS ELÉTRICOS</span>
                <span className="text-slate-300">·</span>
                <span className="text-[#d31010]">ATACADO & VAREJO</span>
              </div>

              <h1 className="text-xl sm:text-2xl md:text-3xl xl:text-4xl font-extrabold text-slate-900 tracking-tight leading-snug sm:leading-tight">
                Tudo em Material Elétrico para sua Obra e Reforma{' '}
                <span className="text-[#004b9c]">com Preço de Distribuidora.</span>
              </h1>

              <p className="text-slate-600 text-xs sm:text-sm leading-relaxed max-w-2xl">
                Fios e cabos normatizados, disjuntores DIN, quadros, eletrodutos e iluminação LED completa. 
                Atendimento ágil para construtoras, instaladores, indústrias e clientes finais.
              </p>

              {/* Vantagens com Ícones Clássicos */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5 text-xs text-slate-700 pt-1">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#004b9c] shrink-0" />
                  <span><strong>Faturamento para CNPJ</strong> com condições especiais</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#004b9c] shrink-0" />
                  <span><strong>Entrega rápida</strong> em canteiros de obra</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#004b9c] shrink-0" />
                  <span>Produtos 100% certificados pelo <strong>Inmetro / NBR</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#004b9c] shrink-0" />
                  <span>Descontos progressivos na compra de <strong>rolos fechados</strong></span>
                </div>
              </div>

              {/* Botões de Ação com Efeito de Escala e Microinteração */}
              <div className="pt-2 sm:pt-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3">
                <button
                  onClick={onScrollToQuote}
                  className="inline-flex items-center justify-center gap-2 bg-[#004b9c] hover:bg-[#003882] text-white font-bold text-xs sm:text-sm px-6 py-3 rounded-md shadow-sm transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                >
                  <span>SOLICITAR ORÇAMENTO</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <a
                  href="https://wa.me/5511983239782?text=Ol%C3%A1!%20Gostaria%20de%20um%20or%C3%A7amento%20de%20materiais%20el%C3%A9tricos%20com%20a%20Phoenix%20El%C3%A9trica."
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#20ba5a] text-white font-bold text-xs sm:text-sm px-5 py-3 rounded-md shadow-sm transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                >
                  <MessageSquare className="w-4 h-4 fill-current" />
                  <span>Chamar no WhatsApp</span>
                </a>
              </div>

            </div>

            {/* Destaque Visual Comercial Direto (Box com Loja Física e Contato Comercial) */}
            <div className="xl:col-span-4 bg-[#f8fafc] border border-blue-100 rounded-lg p-5 sm:p-6 text-center space-y-3 flex flex-col justify-between hover:shadow-md hover:border-blue-200 transition-all duration-300">
              <div className="w-12 h-12 rounded-full bg-blue-100 text-[#003882] flex items-center justify-center mx-auto transition-transform duration-300 group-hover:scale-110">
                <Zap className="w-6 h-6 text-[#003882] fill-current" />
              </div>

              <div>
                <span className="text-[11px] font-bold text-[#d31010] uppercase tracking-wider block">
                  CANAL CORPORATIVO
                </span>
                <h3 className="text-base font-bold text-slate-800">
                  Cotações para Engenharia & Construtoras
                </h3>
              </div>

              <p className="text-xs text-slate-500 leading-snug">
                Tem uma lista em PDF ou planilha Excel? Nosso time técnico analisa e envia a proposta com o melhor preço.
              </p>

              {/* Informações da Loja e Contatos Oficiais */}
              <div className="pt-3.5 border-t border-slate-200/80 flex flex-col items-center justify-center space-y-2 text-xs">
                <div className="flex items-center justify-center gap-2 text-slate-700 w-full max-w-sm">
                  <MapPin className="w-4 h-4 text-[#d31010] shrink-0" />
                  <span className="text-xs text-center">
                    <strong>Loja Física:</strong> R. Anhaia, 740 - Bom Retiro, São Paulo - SP
                  </span>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 pt-0.5">
                  <a 
                    href="tel:1133527777" 
                    className="flex items-center gap-1.5 text-slate-700 hover:text-[#003882] transition-colors"
                  >
                    <Phone className="w-4 h-4 text-[#003882] shrink-0" />
                    <span className="text-xs">
                      <strong>Televendas:</strong> (11) 3352-7777
                    </span>
                  </a>

                  <span className="text-slate-300 hidden sm:inline">·</span>

                  <a 
                    href="https://wa.me/5511983239782" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="flex items-center gap-1.5 text-slate-700 hover:text-emerald-600 transition-colors"
                  >
                    <MessageSquare className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="text-xs">
                      <strong>WhatsApp:</strong> (11) 98323-9782
                    </span>
                  </a>
                </div>
              </div>
            </div>

          </div>

        </motion.div>

      </div>
    </section>
  );
};
