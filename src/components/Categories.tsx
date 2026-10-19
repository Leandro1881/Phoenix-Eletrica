import React, { useEffect, useRef, useState } from 'react';
import { Plus, Zap, Shield, Lightbulb, Box, Cpu, ToggleLeft, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Category } from '../types';
import { categoryPathById } from '../seo/pages';
import { unsplashSrcSet } from '../utils/images';

interface CategoriesProps {
  onSelectCategory: (item: string) => void;
}

export interface CategoryWithImages extends Category {
  icon: React.FC<{ className?: string }>;
  images: { url: string; label: string }[];
}

export const CATEGORIES_DATA: CategoryWithImages[] = [
  {
    id: 'fios-cabos',
    title: 'Fios e Cabos',
    description: 'Cabos flexíveis 750V (1,5mm² a 16mm²), cabos de potência 0,6/1kV, comando e fiação antichama com certificação Inmetro.',
    items: ['Cabos flexíveis 1,5 a 10mm²', 'Cabos de cobre 0,6/1kV', 'Cabos de rede e telefonia', 'Fios antichama NBR NM 247-3'],
    sampleMaterial: 'Cabos Flexíveis 750V (2.5mm² azul, vermelho e verde)',
    color: 'blue',
    badge: 'Mais Vendido',
    icon: Zap,
    images: [
      {
        url: 'https://images.unsplash.com/photo-1558346490-a72e53ae2d4f?auto=format&fit=crop&w=800&q=80',
        label: 'Cabos e conexões'
      },
      {
        url: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=800&q=80',
        label: 'Cabeamento em obra'
      },
      {
        url: 'https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?auto=format&fit=crop&w=800&q=80',
        label: 'Rede de energia'
      }
    ]
  },
  {
    id: 'disjuntores-quadros',
    title: 'Disjuntores e Quadros',
    description: 'Mini disjuntores monopolares, bipolares e tripolares (Curva B e C), caixas moldadas, DRs (diferencial residual), DPS e caixas de comando.',
    items: ['Mini disjuntores DIN Curva C 10A a 63A', 'Interruptores DR (IDR) 30mA', 'Protetores contra surtos DPS Classe II', 'Quadros de embutir e sobrepor até 72 DIN'],
    sampleMaterial: 'Disjuntores monopolares 20A Curva C e Quadro de Embutir 18 DIN',
    color: 'blue',
    badge: 'Segurança NR-10',
    icon: Shield,
    images: [
      {
        url: 'https://images.unsplash.com/photo-1544724569-5f546fd6f2b5?auto=format&fit=crop&w=800&q=80',
        label: 'Disjuntores DIN em quadro'
      },
      {
        url: 'https://images.unsplash.com/photo-1621905251918-48416bd8575a?auto=format&fit=crop&w=800&q=80',
        label: 'Montagem de quadro'
      },
      {
        url: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=800&q=80',
        label: 'Manutenção de quadro'
      }
    ]
  },
  {
    id: 'iluminacao-led',
    title: 'Iluminação LED',
    description: 'Luminárias industriais High Bay, refletores de alta potência IP65/IP66, painéis LED de sobrepor/embutir e iluminação linear comercial.',
    items: ['Refletores LED 50W a 400W IP66', 'Luminárias industriais UFO High Bay', 'Painéis LED 60x60 e luminárias tubulares', 'Fitas LED de alta densidade e drivers'],
    sampleMaterial: 'Refletores LED 100W IP66 Branco Frio e Painéis LED 60x60',
    color: 'blue',
    badge: 'Eficiência A+',
    icon: Lightbulb,
    images: [
      {
        url: 'https://images.unsplash.com/photo-1540932239986-30128078f3c5?auto=format&fit=crop&w=800&q=80',
        label: 'Pendentes'
      },
      {
        url: 'https://images.unsplash.com/photo-1524484485831-a92ffc0de03f?auto=format&fit=crop&w=800&q=80',
        label: 'Iluminação comercial'
      },
      {
        url: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=800&q=80',
        label: 'Luminárias'
      }
    ]
  },
  {
    id: 'infraestrutura',
    title: 'Infraestrutura',
    description: 'Eletrocalhas galvanizadas a fogo, perfilados perfurados, eletrodutos corrugados reforçados, tubos de PVC rígido e caixas de passagem.',
    items: ['Eletrocalhas perfuradas galvanizadas', 'Eletrodutos corrugados reforçados 25mm e 32mm', 'Tubos rígidos roscáveis e soldáveis', 'Caixas de passagem e conduletes alumínio'],
    sampleMaterial: 'Eletrodutos corrugados reforçados e Caixas de Passagem 4x2 / 4x4',
    color: 'blue',
    badge: 'Construção Civil',
    icon: Box,
    images: [
      {
        url: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=800&q=80',
        label: 'Infraestrutura de obra'
      },
      {
        url: 'https://images.unsplash.com/photo-1581092446327-9b52bd1570c2?auto=format&fit=crop&w=800&q=80',
        label: 'Projeto de instalação'
      },
      {
        url: 'https://images.unsplash.com/photo-1581092580497-e0d23cbdf1dc?auto=format&fit=crop&w=800&q=80',
        label: 'Planta elétrica'
      }
    ]
  },
  {
    id: 'tomadas-acabamentos',
    title: 'Tomadas e Acabamentos',
    description: 'Conjuntos modulares 4x2 e 4x4, tomadas 10A e 20A, interruptores simples/paralelos, placas, módulos USB e caixas de piso.',
    items: ['Módulos de tomada 10A e 20A 250V', 'Interruptores simples, paralelos e intermediários', 'Placas 4x2 e 4x4 com suporte e acabamento', 'Tomadas para móveis e caixas de piso'],
    sampleMaterial: 'Conjuntos 4x2 com tomadas 20A e Placas modulares brancas',
    color: 'blue',
    badge: 'Acabamentos',
    icon: ToggleLeft,
    images: [
      {
        url: 'https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=800&q=80',
        label: 'Ambientes comerciais'
      },
      {
        url: 'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=800&q=80',
        label: 'Acabamento residencial'
      },
      {
        url: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=800&q=80',
        label: 'Projetos de interiores'
      }
    ]
  },
  {
    id: 'automacao-comandos',
    title: 'Automação e Comandos',
    description: 'Contatores de potência e comando, relés térmicos, inversores de frequência, botoeiras, multímetros e ferramentas especializadas para eletricistas.',
    items: ['Contatores tripolares de 9A a 150A', 'Relés térmicos e protetores de motor', 'Botoeiras de emergência e sinalizadores', 'Multímetros True-RMS e alicates decapadores'],
    sampleMaterial: 'Contatores tripolares e Relés Térmicos de Sobrecarga',
    color: 'blue',
    badge: 'Industrial & Técnico',
    icon: Cpu,
    images: [
      {
        url: 'https://images.unsplash.com/photo-1513828583688-c52646db42da?auto=format&fit=crop&w=800&q=80',
        label: 'Motores e comandos'
      },
      {
        url: 'https://images.unsplash.com/photo-1517420704952-d9f39e95b43e?auto=format&fit=crop&w=800&q=80',
        label: 'Medição e testes'
      },
      {
        url: 'https://images.unsplash.com/photo-1586864387789-628af9feed72?auto=format&fit=crop&w=800&q=80',
        label: 'Ferramentas'
      }
    ]
  }
];

const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1544724569-5f546fd6f2b5?auto=format&fit=crop&w=600&q=80';

const CategoryCard: React.FC<{
  cat: CategoryWithImages;
  index: number;
  isAdded: boolean;
  onAdd: () => void;
}> = ({ cat, index, isAdded, onAdd }) => {
  const [imageIndex, setImageIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const Icon = cat.icon;

  // Troca as fotos em fade enquanto o card está em foco
  useEffect(() => {
    if (!isHovered) return;
    const timer = setInterval(() => setImageIndex((i) => (i + 1) % cat.images.length), 1800);
    return () => clearInterval(timer);
  }, [isHovered, cat.images.length]);

  return (
    <motion.article
      id={cat.id}
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.55, delay: (index % 3) * 0.1, ease: [0.22, 1, 0.36, 1] }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="group snap-start shrink-0 w-[82%] sm:w-[60%] md:w-auto scroll-mt-28 flex flex-col rounded-3xl bg-white ring-1 ring-slate-200/80 overflow-hidden transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_30px_60px_-25px_rgba(18,44,158,0.35)] hover:ring-brand-blue/30"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-brand-navy">
        <AnimatePresence initial={false}>
          <motion.img
            key={imageIndex}
            src={cat.images[imageIndex].url}
            srcSet={unsplashSrcSet(cat.images[imageIndex].url, [400, 800])}
            sizes="(min-width: 768px) 33vw, 82vw"
            alt={`${cat.title} - ${cat.images[imageIndex].label}`}
            width={800}
            height={600}
            loading="lazy"
            decoding="async"
            onError={(e) => {
              if (e.currentTarget.src !== FALLBACK_IMAGE) e.currentTarget.src = FALLBACK_IMAGE;
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.7 }}
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-[1.5s] group-hover:scale-110"
          />
        </AnimatePresence>
        <div className="absolute inset-0 bg-gradient-to-t from-brand-navy via-brand-navy/30 to-transparent" />

        <span className="absolute top-4 left-4 rounded-full bg-white/15 backdrop-blur-md px-3 py-1 text-[11px] font-semibold text-white ring-1 ring-white/20">
          {cat.badge}
        </span>

        <div className="absolute bottom-0 inset-x-0 p-5 flex items-end justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-yellow text-brand-navy flex items-center justify-center shrink-0 transition-transform duration-500 group-hover:rotate-[-8deg] group-hover:scale-110">
              <Icon className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-white leading-tight">
              <a href={categoryPathById(cat.id)} className="hover:text-brand-yellow transition-colors">
                {cat.title}
              </a>
            </h3>
          </div>
          <div className="flex gap-1 pb-1">
            {cat.images.map((_, i) => (
              <span
                key={i}
                className={`h-1 rounded-full transition-all duration-500 ${i === imageIndex ? 'w-4 bg-brand-yellow' : 'w-1 bg-white/50'}`}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col p-5">
        <ul className="space-y-2 text-sm text-slate-600 flex-1">
          {cat.items.slice(0, 3).map((item) => (
            <li key={item} className="flex items-center gap-2.5">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-blue shrink-0" />
              <span className="line-clamp-1">{item}</span>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={onAdd}
          className={`mt-5 w-full inline-flex items-center justify-center gap-2 h-11 rounded-xl text-sm font-bold transition-all duration-300 cursor-pointer ${
            isAdded
              ? 'bg-emerald-500 text-white'
              : 'bg-brand-blue-soft text-brand-blue hover:bg-brand-blue hover:text-white'
          }`}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={isAdded ? 'added' : 'add'}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              className="inline-flex items-center gap-2"
            >
              {isAdded ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {isAdded ? 'Adicionado à cotação' : 'Adicionar à cotação'}
            </motion.span>
          </AnimatePresence>
        </button>
      </div>
    </motion.article>
  );
};

export const Categories: React.FC<CategoriesProps> = ({ onSelectCategory }) => {
  const [addedCategoryId, setAddedCategoryId] = useState<string | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);

  const handleAdd = (catId: string, material: string) => {
    onSelectCategory(material);
    setAddedCategoryId(catId);
    setTimeout(() => setAddedCategoryId(null), 2000);
  };

  const scrollTrack = (dir: 1 | -1) => {
    const track = trackRef.current;
    if (track) track.scrollBy({ left: dir * track.clientWidth * 0.8, behavior: 'smooth' });
  };

  return (
    <section id="categorias" className="pt-20 pb-20 sm:pb-24 bg-surface scroll-mt-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.5 }}
          className="flex items-end justify-between gap-6 mb-10"
        >
          <div>
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-brand-red">Produtos</span>
            <h2 className="mt-2 text-3xl sm:text-4xl font-extrabold text-brand-navy tracking-tight">
              Linhas a pronta entrega
            </h2>
            <p className="mt-2 text-slate-500 max-w-md">Escolha uma linha e ela entra direto na sua cotação.</p>
          </div>

          <div className="flex md:hidden gap-2 shrink-0">
            <button
              type="button"
              onClick={() => scrollTrack(-1)}
              aria-label="Anterior"
              className="w-10 h-10 rounded-full bg-white ring-1 ring-slate-200 flex items-center justify-center text-slate-600 active:scale-95 cursor-pointer"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => scrollTrack(1)}
              aria-label="Próximo"
              className="w-10 h-10 rounded-full bg-white ring-1 ring-slate-200 flex items-center justify-center text-slate-600 active:scale-95 cursor-pointer"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </motion.div>

        {/* Carrossel com snap no mobile, grade no desktop */}
        <div
          ref={trackRef}
          className="flex md:grid md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6 overflow-x-auto md:overflow-visible snap-x snap-mandatory scrollbar-none -mx-4 px-4 md:mx-0 md:px-0 pb-4 md:pb-0"
        >
          {CATEGORIES_DATA.map((cat, idx) => (
            <CategoryCard
              key={cat.id}
              cat={cat}
              index={idx}
              isAdded={addedCategoryId === cat.id}
              onAdd={() => handleAdd(cat.id, cat.sampleMaterial)}
            />
          ))}
        </div>
      </div>
    </section>
  );
};
