import React from 'react';
import { Truck, PackageCheck, ShieldCheck, BadgePercent, Headphones, Building2 } from 'lucide-react';
import { motion } from 'motion/react';

const FEATURES_DATA = [
  { icon: Truck, title: 'Entrega na obra', description: 'Frota própria e conferência item a item.' },
  { icon: BadgePercent, title: 'Preço de distribuidora', description: 'Desconto progressivo em rolos e lotes.' },
  { icon: Building2, title: 'Boleto para CNPJ', description: 'Prazos especiais e NF na hora.' },
  { icon: ShieldCheck, title: 'Inmetro e NBR', description: 'Cabos e disjuntores certificados.' },
  { icon: Headphones, title: 'Apoio técnico', description: 'Ajudamos a dimensionar seu projeto.' },
  { icon: PackageCheck, title: 'Estoque amplo', description: 'Mais de 15 mil itens a pronta entrega.' }
];

export const Features: React.FC = () => {
  return (
    <section id="diferenciais" className="relative py-20 sm:py-24 bg-brand-navy text-white overflow-hidden scroll-mt-20">
      <div className="absolute inset-0 bg-grid opacity-50" />
      <div className="absolute left-1/2 -translate-x-1/2 -top-40 w-[700px] h-[400px] rounded-full bg-brand-blue/40 blur-[140px]" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-xl mx-auto mb-14"
        >
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-brand-yellow">Por que a Phoenix</span>
          <h2 className="mt-2 text-3xl sm:text-4xl font-extrabold tracking-tight">
            Estrutura para sua obra não parar
          </h2>
        </motion.div>

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5">
          {FEATURES_DATA.map((item, idx) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 28 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-30px' }}
                transition={{ duration: 0.5, delay: idx * 0.07 }}
                className="group relative rounded-2xl sm:rounded-3xl bg-white/[0.04] ring-1 ring-white/10 p-5 sm:p-7 overflow-hidden transition-all duration-500 hover:bg-white/[0.08] hover:ring-brand-yellow/40 hover:-translate-y-1"
              >
                <div className="absolute -right-10 -bottom-10 w-32 h-32 rounded-full bg-brand-yellow/0 group-hover:bg-brand-yellow/10 blur-2xl transition-colors duration-500" />
                <div className="relative w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-brand-yellow/10 text-brand-yellow flex items-center justify-center ring-1 ring-brand-yellow/20 transition-all duration-500 group-hover:bg-brand-yellow group-hover:text-brand-navy group-hover:rotate-[-6deg]">
                  <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <h3 className="relative mt-4 sm:mt-5 text-sm sm:text-lg font-bold">{item.title}</h3>
                <p className="relative mt-1 text-xs sm:text-sm text-blue-100/65">{item.description}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
