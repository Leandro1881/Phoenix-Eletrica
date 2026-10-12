import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, MessageSquare, Star, Package, Clock, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence, animate, useInView } from 'motion/react';
import { ReviewsData } from '../types';
import { trackWhatsAppClick } from '../utils/analytics';

interface HeroProps {
  onScrollToQuote: () => void;
  onSelectCategory?: (category: string) => void;
  reviewsData?: ReviewsData;
}

const SLIDE_DURATION_MS = 6500;

const SLIDES = [
  {
    title: (
      <>
        Material elétrico com <span className="text-brand-yellow">preço de distribuidora</span>.
      </>
    ),
    subtitle: 'Fios, disjuntores, quadros e LED para sua obra ou reforma.',
    image: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=1600&q=80'
  },
  {
    title: (
      <>
        Faturamento para CNPJ e <span className="text-brand-yellow">entrega na obra</span>.
      </>
    ),
    subtitle: 'Condições especiais para empresas e compras recorrentes.',
    image: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=1600&q=80'
  },
  {
    title: (
      <>
        Do cabo ao refletor LED, <span className="text-brand-yellow">tudo em um pedido</span>.
      </>
    ),
    subtitle: 'Mais de 15 mil itens a pronta entrega no Bom Retiro.',
    image: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1600&q=80'
  }
];

// Bordas internas da grade 2x2 (mobile) / 4x1 (desktop)
const STAT_BORDERS = ['border-r border-b lg:border-b-0', 'border-b lg:border-b-0 lg:border-r', 'border-r', ''];

const MARQUEE_ITEMS = [
  'Cabos flexíveis',
  'Disjuntores DIN',
  'Quadros de distribuição',
  'Refletores LED',
  'Eletrocalhas',
  'Eletrodutos',
  'Tomadas e interruptores',
  'Contatores',
  'DR e DPS',
  'Painéis LED'
];

// Contador animado que dispara quando entra na tela
const CountUp: React.FC<{ to: number; decimals?: number; suffix?: string }> = ({ to, decimals = 0, suffix = '' }) => {
  const ref = useRef<HTMLSpanElement | null>(null);
  const inView = useInView(ref, { once: true });
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const controls = animate(0, to, {
      duration: 1.6,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setValue(v)
    });
    return () => controls.stop();
  }, [inView, to]);

  const formatted = value.toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
  return (
    <span ref={ref}>
      {formatted}
      {suffix}
    </span>
  );
};

export const Hero: React.FC<HeroProps> = ({ onScrollToQuote, reviewsData }) => {
  const [index, setIndex] = useState(0);

  // Avança sozinho; clicar num indicador reinicia a contagem a partir dele
  useEffect(() => {
    const timer = setTimeout(() => setIndex((i) => (i + 1) % SLIDES.length), SLIDE_DURATION_MS);
    return () => clearTimeout(timer);
  }, [index]);

  const slide = SLIDES[index];
  const rating = reviewsData?.ratingAverage || 0;

  const stats = [
    { icon: Package, value: <CountUp to={15000} suffix="+" />, label: 'itens em estoque' },
    rating > 0
      ? { icon: Star, value: <CountUp to={rating} decimals={1} />, label: `nota no Google (${reviewsData?.total})` }
      : { icon: Star, value: 'Google', label: 'avaliações verificadas' },
    { icon: Clock, value: <CountUp to={15} suffix=" min" />, label: 'retorno médio' },
    { icon: ShieldCheck, value: <CountUp to={100} suffix="%" />, label: 'Inmetro e NBR' }
  ];

  return (
    <section className="relative">
      <div
        className="relative bg-brand-navy overflow-hidden min-h-[560px] sm:min-h-[600px] lg:min-h-[640px] flex items-center"
      >
        {/* Imagens com crossfade + zoom lento */}
        <AnimatePresence initial={false}>
          <motion.div
            key={slide.image}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.1, ease: 'easeInOut' }}
            className="absolute inset-0 lg:left-[38%]"
          >
            <motion.img
              src={slide.image}
              alt=""
              initial={{ scale: 1.12 }}
              animate={{ scale: 1 }}
              transition={{ duration: SLIDE_DURATION_MS / 1000 + 1.5, ease: 'linear' }}
              className="w-full h-full object-cover"
            />
          </motion.div>
        </AnimatePresence>

        {/* Camadas de leitura */}
        <div className="absolute inset-0 bg-brand-navy/80 lg:bg-transparent lg:bg-gradient-to-r lg:from-brand-navy lg:from-40% lg:via-brand-navy/85 lg:via-55% lg:to-brand-navy/10" />
        <div className="absolute inset-0 bg-grid opacity-40 lg:[mask-image:linear-gradient(90deg,#000_35%,transparent_60%)]" />
        <div className="absolute -left-32 top-10 w-[420px] h-[420px] rounded-full bg-brand-blue/40 blur-[120px] animate-glow" />
        <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-brand-blue via-brand-yellow to-brand-red" />

        <div className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-28 sm:pb-32">
          <div className="max-w-2xl">
            <AnimatePresence mode="wait">
              <motion.div
                key={index}
                initial="hidden"
                animate="show"
                exit="exit"
                variants={{
                  hidden: {},
                  show: { transition: { staggerChildren: 0.1 } },
                  exit: { opacity: 0, y: -12, transition: { duration: 0.3 } }
                }}
              >
                <motion.h1
                  variants={{ hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } } }}
                  className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white tracking-tight leading-[1.05]"
                >
                  {slide.title}
                </motion.h1>
                <motion.p
                  variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}
                  className="mt-5 text-base sm:text-lg text-blue-100/85 max-w-lg"
                >
                  {slide.subtitle}
                </motion.p>
              </motion.div>
            </AnimatePresence>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.5 }}
              className="mt-9 flex flex-col sm:flex-row gap-3"
            >
              <button
                type="button"
                onClick={onScrollToQuote}
                className="group inline-flex items-center justify-center gap-2 h-14 px-8 rounded-full bg-brand-yellow hover:bg-[#ffe14d] text-brand-navy font-extrabold text-sm sm:text-base shadow-[0_10px_40px_-10px_rgba(255,214,10,0.7)] transition-all hover:-translate-y-0.5 cursor-pointer"
              >
                Solicitar orçamento
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
              <a
                href="https://wa.me/5511983239782?text=Ol%C3%A1!%20Gostaria%20de%20um%20or%C3%A7amento%20de%20materiais%20el%C3%A9tricos%20com%20a%20Phoenix%20El%C3%A9trica."
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackWhatsAppClick('Hero', 'WhatsApp Hero')}
                className="inline-flex items-center justify-center gap-2 h-14 px-7 rounded-full bg-white/10 hover:bg-white/15 backdrop-blur text-white font-bold text-sm sm:text-base ring-1 ring-white/25 transition-all hover:-translate-y-0.5"
              >
                <MessageSquare className="w-5 h-5 text-[#25D366] fill-current" />
                Falar no WhatsApp
              </a>
            </motion.div>

            {/* Indicadores com barra de progresso */}
            <div className="mt-12 flex items-center gap-3">
              {SLIDES.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-label={`Ir para destaque ${i + 1}`}
                  className="relative h-1 w-12 sm:w-16 rounded-full bg-white/20 overflow-hidden cursor-pointer"
                >
                  {i === index && (
                    <motion.span
                      key={index}
                      initial={{ width: '0%' }}
                      animate={{ width: '100%' }}
                      transition={{ duration: SLIDE_DURATION_MS / 1000, ease: 'linear' }}
                      className="absolute inset-y-0 left-0 bg-brand-yellow rounded-full"
                    />
                  )}
                  {i < index && <span className="absolute inset-0 bg-white/60 rounded-full" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Indicadores sobrepostos ao hero */}
      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 -mt-16">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="grid grid-cols-2 lg:grid-cols-4 rounded-3xl bg-white shadow-[0_30px_70px_-30px_rgba(8,22,52,0.4)] ring-1 ring-slate-200/70"
        >
          {stats.map((s, i) => {
            const Icon = s.icon;
            return (
              <div key={i} className={`group flex items-center gap-3 sm:gap-4 p-4 sm:p-6 border-slate-100 ${STAT_BORDERS[i]}`}>
                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-brand-blue-soft text-brand-blue flex items-center justify-center shrink-0 group-hover:bg-brand-blue group-hover:text-white transition-colors duration-300">
                  <Icon className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-xl sm:text-2xl font-extrabold text-brand-navy leading-none">{s.value}</div>
                  <div className="mt-1 text-xs text-slate-500 truncate">{s.label}</div>
                </div>
              </div>
            );
          })}
        </motion.div>
      </div>

      {/* Faixa com rolagem infinita das linhas de produto */}
      <div className="mt-12 fade-x overflow-hidden" aria-hidden="true">
        <div className="flex w-max animate-marquee">
          {[...MARQUEE_ITEMS, ...MARQUEE_ITEMS].map((item, i) => (
            <span key={i} className="flex items-center gap-6 px-6 text-sm font-semibold text-slate-400 whitespace-nowrap">
              {item}
              <span className="w-1.5 h-1.5 rotate-45 bg-brand-yellow" />
            </span>
          ))}
        </div>
      </div>
    </section>
  );
};
