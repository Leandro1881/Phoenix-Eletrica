import React from 'react';
import { Truck, CheckCircle2, ShieldCheck, BadgePercent, Headphones, Building2 } from 'lucide-react';
import { motion } from 'motion/react';

const FEATURES_DATA = [
  {
    icon: Truck,
    title: 'Logística Própria e Pontual',
    description: 'Frota dedicada para entregar no canteiro da sua obra, indústria ou empresa com agilidade e conferência rigorosa de cada item.'
  },
  {
    icon: BadgePercent,
    title: 'Preço Direto de Distribuidora',
    description: 'Volume e negociação direto com as principais indústrias nacionais. Descontos progressivos na compra de rolos e lotes completos.'
  },
  {
    icon: Building2,
    title: 'Faturamento no Boleto para CNPJ',
    description: 'Condições comerciais para construtoras, engenharias e instaladores. Prazos especiais e emissão ágil de Nota Fiscal.'
  },
  {
    icon: ShieldCheck,
    title: '100% Normatizado (Inmetro & NBR)',
    description: 'Segurança absoluta contra condutores desbitolados. Todos os cabos e disjuntores possuem certificação compulsória e laudos técnicos.'
  },
  {
    icon: Headphones,
    title: 'Consultoria Técnica com Especialistas',
    description: 'Envie sua lista de materiais ou projeto elétrico. Nossa equipe analisa e indica os modelos compatíveis com o melhor custo-benefício.'
  },
  {
    icon: CheckCircle2,
    title: 'Estoque Amplo a Pronta Entrega',
    description: 'Mais de 15.000 itens disponíveis: cabos flexíveis, quadros, eletrodutos, barramentos, automação e iluminação LED de alta eficiência.'
  }
];

export const Features: React.FC = () => {
  return (
    <section id="diferenciais" className="py-12 sm:py-16 bg-[#f4f6f9] border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header da Seção com Efeito Scroll Reveal */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-3xl mx-auto mb-12 space-y-2"
        >
          <span className="text-xs font-bold uppercase tracking-wider text-[#d31010]">
            Tradição & Confiabilidade
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#003882] tracking-tight">
            Por que Comprar na Phoenix Elétrica?
          </h2>
          <p className="text-slate-600 text-xs sm:text-sm">
            Estrutura sólida para fornecer materiais elétricos de primeira linha sem atrasos na sua obra.
          </p>
        </motion.div>

        {/* Grade de Diferenciais com Efeito Cascata (Staggered Fade-in-up) e Flutuação no Hover */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES_DATA.map((item, idx) => {
            const Icon = item.icon;

            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 28 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-30px" }}
                transition={{ duration: 0.45, delay: idx * 0.08 }}
                className="p-6 rounded-lg bg-white border border-slate-200 shadow-xs hover:border-[#004b9c] hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300 space-y-2.5 group cursor-default"
              >
                <div className="w-10 h-10 rounded bg-blue-50 text-[#004b9c] group-hover:bg-[#003882] group-hover:text-white flex items-center justify-center transition-colors duration-300">
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-900 group-hover:text-[#004b9c] transition-colors">
                  {item.title}
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {item.description}
                </p>
              </motion.div>
            );
          })}
        </div>

      </div>
    </section>
  );
};
