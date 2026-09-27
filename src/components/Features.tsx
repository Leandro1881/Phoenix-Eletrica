import React from 'react';
import { Truck, CheckCircle2, ShieldCheck, BadgePercent, Headphones, Building2 } from 'lucide-react';

export const Features: React.FC = () => {
  return (
    <section id="diferenciais" className="py-12 sm:py-16 bg-[#f4f6f9] border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header da Seção */}
        <div className="text-center max-w-3xl mx-auto mb-12 space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-[#d31010]">
            Tradição & Confiabilidade
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#003882] tracking-tight">
            Por que Comprar na Phoenix Elétrica?
          </h2>
          <p className="text-slate-600 text-xs sm:text-sm">
            Estrutura sólida para fornecer materiais elétricos de primeira linha sem atrasos na sua obra.
          </p>
        </div>

        {/* Grade de Diferenciais */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          <div className="p-6 rounded-lg bg-white border border-slate-200 shadow-2xs hover:border-[#004b9c] transition-colors space-y-2.5">
            <div className="w-10 h-10 rounded bg-blue-50 text-[#004b9c] flex items-center justify-center">
              <Truck className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Logística Própria e Pontual</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Frota dedicada para entregar no canteiro da sua obra, indústria ou empresa com agilidade e conferência rigorosa de cada item.
            </p>
          </div>

          <div className="p-6 rounded-lg bg-white border border-slate-200 shadow-2xs hover:border-[#004b9c] transition-colors space-y-2.5">
            <div className="w-10 h-10 rounded bg-blue-50 text-[#004b9c] flex items-center justify-center">
              <BadgePercent className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Preço Direto de Distribuidora</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Volume e negociação direto com as principais indústrias nacionais. Descontos progressivos na compra de rolos e lotes completos.
            </p>
          </div>

          <div className="p-6 rounded-lg bg-white border border-slate-200 shadow-2xs hover:border-[#004b9c] transition-colors space-y-2.5">
            <div className="w-10 h-10 rounded bg-blue-50 text-[#004b9c] flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Faturamento no Boleto para CNPJ</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Condições comerciais para construtoras, engenharias e instaladores. Prazos especiais e emissão ágil de Nota Fiscal.
            </p>
          </div>

          <div className="p-6 rounded-lg bg-white border border-slate-200 shadow-2xs hover:border-[#004b9c] transition-colors space-y-2.5">
            <div className="w-10 h-10 rounded bg-blue-50 text-[#004b9c] flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900">100% Normatizado (Inmetro & NBR)</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Segurança absoluta contra condutores desbitolados. Todos os cabos e disjuntores possuem certificação compulsória e laudos técnicos.
            </p>
          </div>

          <div className="p-6 rounded-lg bg-white border border-slate-200 shadow-2xs hover:border-[#004b9c] transition-colors space-y-2.5">
            <div className="w-10 h-10 rounded bg-blue-50 text-[#004b9c] flex items-center justify-center">
              <Headphones className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Consultoria Técnica com Especialistas</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Envie sua lista de materiais ou projeto elétrico. Nossa equipe analisa e indica os modelos compatíveis com o melhor custo-benefício.
            </p>
          </div>

          <div className="p-6 rounded-lg bg-white border border-slate-200 shadow-2xs hover:border-[#004b9c] transition-colors space-y-2.5">
            <div className="w-10 h-10 rounded bg-blue-50 text-[#004b9c] flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Estoque Amplo a Pronta Entrega</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Mais de 15.000 itens disponíveis: cabos flexíveis, quadros, eletrodutos, barramentos, automação e iluminação LED de alta eficiência.
            </p>
          </div>

        </div>

      </div>
    </section>
  );
};
