import React, { useState } from 'react';
import { Plus, Zap, Shield, Lightbulb, Box, Cpu, ToggleLeft, CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Category } from '../types';

interface CategoriesProps {
  onSelectCategory: (item: string) => void;
}

interface CategoryWithImages extends Category {
  icon: React.FC<{ className?: string }>;
  images: { url: string; label: string }[];
}

const CATEGORIES_DATA: CategoryWithImages[] = [
  {
    id: 'fios-cabos',
    title: 'Fios e Cabos Normatizados',
    description: 'Cabos flexíveis 750V (1,5mm² a 16mm²), cabos de potência 0,6/1kV, comando e fiação antichama com certificação Inmetro.',
    items: ['Cabos flexíveis 1,5 a 10mm²', 'Cabos de cobre 0,6/1kV', 'Cabos de rede e telefonia', 'Fios antichama NBR NM 247-3'],
    sampleMaterial: 'Cabos Flexíveis 750V (2.5mm² azul, vermelho e verde)',
    color: 'blue',
    badge: 'Mais Vendido',
    icon: Zap,
    images: [
      {
        url: 'https://images.unsplash.com/photo-1544724569-5f546fd6f2b5?auto=format&fit=crop&w=600&q=80',
        label: 'Rolos de Fios Flexíveis'
      },
      {
        url: 'https://images.unsplash.com/photo-1558346490-a72e53ae2d4f?auto=format&fit=crop&w=600&q=80',
        label: 'Cabos de Cobre Normatizados'
      },
      {
        url: 'https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?auto=format&fit=crop&w=600&q=80',
        label: 'Bobinas de Potência 1kV'
      }
    ]
  },
  {
    id: 'disjuntores-quadros',
    title: 'Disjuntores & Quadros de Distribuição',
    description: 'Mini disjuntores monopolares, bipolares e tripolares (Curva B e C), caixas moldadas, DRs (diferencial residual), DPS e caixas de comando.',
    items: ['Mini disjuntores DIN Curva C 10A a 63A', 'Interruptores DR (IDR) 30mA', 'Protetores contra surtos DPS Classe II', 'Quadros de embutir e sobrepor até 72 DIN'],
    sampleMaterial: 'Disjuntores monopolares 20A Curva C e Quadro de Embutir 18 DIN',
    color: 'blue',
    badge: 'Segurança NR-10',
    icon: Shield,
    images: [
      {
        url: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=600&q=80',
        label: 'Disjuntores DIN e Barramentos'
      },
      {
        url: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=600&q=80',
        label: 'Quadros de Distribuição'
      },
      {
        url: 'https://images.unsplash.com/photo-1581092446327-9b52bd1570c2?auto=format&fit=crop&w=600&q=80',
        label: 'Módulos de Proteção DR & DPS'
      }
    ]
  },
  {
    id: 'iluminacao-led',
    title: 'Iluminação Técnica & Industrial',
    description: 'Luminárias industriais High Bay, refletores de alta potência IP65/IP66, painéis LED de sobrepor/embutir e iluminação linear comercial.',
    items: ['Refletores LED 50W a 400W IP66', 'Luminárias industriais UFO High Bay', 'Painéis LED 60x60 e luminárias tubulares', 'Fitas LED de alta densidade e drivers'],
    sampleMaterial: 'Refletores LED 100W IP66 Branco Frio e Painéis LED 60x60',
    color: 'blue',
    badge: 'Eficiência A+',
    icon: Lightbulb,
    images: [
      {
        url: 'https://images.unsplash.com/photo-1565814636199-ae8133055c1c?auto=format&fit=crop&w=600&q=80',
        label: 'Luminárias Industriais High Bay'
      },
      {
        url: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=600&q=80',
        label: 'Painéis LED e Iluminação Comercial'
      },
      {
        url: 'https://images.unsplash.com/photo-1524484485831-a92ffc0de03f?auto=format&fit=crop&w=600&q=80',
        label: 'Refletores Externos IP66'
      }
    ]
  },
  {
    id: 'infraestrutura',
    title: 'Infraestrutura & Eletrodutos',
    description: 'Eletrocalhas galvanizadas a fogo, perfilados perfurados, eletrodutos corrugados reforçados, tubos de PVC rígido e caixas de passagem.',
    items: ['Eletrocalhas perfuradas galvanizadas', 'Eletrodutos corrugados reforçados 25mm e 32mm', 'Tubos rígidos roscáveis e soldáveis', 'Caixas de passagem e conduletes alumínio'],
    sampleMaterial: 'Eletrodutos corrugados reforçados e Caixas de Passagem 4x2 / 4x4',
    color: 'blue',
    badge: 'Construção Civil',
    icon: Box,
    images: [
      {
        url: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=600&q=80',
        label: 'Eletrocalhas Galvanizadas'
      },
      {
        url: 'https://images.unsplash.com/photo-1581092580497-e0d23cbdf1dc?auto=format&fit=crop&w=600&q=80',
        label: 'Eletrodutos e Tubulações'
      },
      {
        url: 'https://images.unsplash.com/photo-1581094794329-c8112a89af12?auto=format&fit=crop&w=600&q=80',
        label: 'Perfilados e Caixas de Passagem'
      }
    ]
  },
  {
    id: 'tomadas-acabamentos',
    title: 'Tomadas, Interruptores & Acabamentos',
    description: 'Conjuntos modulares 4x2 e 4x4, tomadas 10A e 20A, interruptores simples/paralelos, placas, módulos USB e caixas de piso.',
    items: ['Módulos de tomada 10A e 20A 250V', 'Interruptores simples, paralelos e intermediários', 'Placas 4x2 e 4x4 com suporte e acabamento', 'Tomadas para móveis e caixas de piso'],
    sampleMaterial: 'Conjuntos 4x2 com tomadas 20A e Placas modulares brancas',
    color: 'blue',
    badge: 'Acabamentos',
    icon: ToggleLeft,
    images: [
      {
        url: 'https://images.unsplash.com/photo-1585338107529-13afc5f02586?auto=format&fit=crop&w=600&q=80',
        label: 'Tomadas e Interruptores Modulares'
      },
      {
        url: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=600&q=80',
        label: 'Placas 4x2 e 4x4'
      },
      {
        url: 'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=600&q=80',
        label: 'Acabamentos de Alta Resistência'
      }
    ]
  },
  {
    id: 'automacao-comandos',
    title: 'Automação, Comandos & Ferramentas',
    description: 'Contatores de potência e comando, relés térmicos, inversores de frequência, botoeiras, multímetros e ferramentas especializadas para eletricistas.',
    items: ['Contatores tripolares de 9A a 150A', 'Relés térmicos e protetores de motor', 'Botoeiras de emergência e sinalizadores', 'Multímetros True-RMS e alicates decapadores'],
    sampleMaterial: 'Contatores tripolares e Relés Térmicos de Sobrecarga',
    color: 'blue',
    badge: 'Industrial & Técnico',
    icon: Cpu,
    images: [
      {
        url: 'https://images.unsplash.com/photo-1581092335878-2d9ff86ca2bf?auto=format&fit=crop&w=600&q=80',
        label: 'Contatores e Relés de Força'
      },
      {
        url: 'https://images.unsplash.com/photo-1581092162384-8987c1d64718?auto=format&fit=crop&w=600&q=80',
        label: 'Instrumentos de Medição e Teste'
      },
      {
        url: 'https://images.unsplash.com/photo-1581092795360-fd1ca04f0952?auto=format&fit=crop&w=600&q=80',
        label: 'Chaves e Comandos Industriais'
      }
    ]
  }
];

// Componente de Slider de Imagens para o topo de cada Card
const CategoryImageSlider: React.FC<{
  images: { url: string; label: string }[];
  categoryTitle: string;
}> = ({ images, categoryTitle }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  const prevSlide = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const nextSlide = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  };

  return (
    <div className="relative w-full h-44 sm:h-48 overflow-hidden rounded-t-lg bg-slate-900 group/slider select-none">
      <AnimatePresence mode="wait">
        <motion.img
          key={currentIndex}
          src={images[currentIndex].url}
          alt={`${categoryTitle} - ${images[currentIndex].label}`}
          loading="lazy"
          onError={(e) => {
            const target = e.currentTarget;
            if (!target.src.includes('photo-1544724569-5f546fd6f2b5')) {
              target.src = 'https://images.unsplash.com/photo-1544724569-5f546fd6f2b5?auto=format&fit=crop&w=600&q=80';
            }
          }}
          initial={{ opacity: 0.3, scale: 1.05 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0.2 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="w-full h-full object-cover object-center group-hover/slider:scale-105 transition-transform duration-700"
        />
      </AnimatePresence>

      {/* Gradiente escuro para legibilidade da legenda */}
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-black/20 pointer-events-none" />

      {/* Legenda do Produto Atual */}
      <div className="absolute bottom-2 left-3 right-14 pointer-events-none">
        <span className="text-[11px] font-semibold text-white drop-shadow-md truncate block">
          {images[currentIndex].label}
        </span>
      </div>

      {/* Setas de Navegação Discretas (aparecem suavemente ao passar o mouse) */}
      <button
        type="button"
        onClick={prevSlide}
        aria-label="Foto anterior"
        className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/50 hover:bg-black/80 text-white flex items-center justify-center opacity-80 sm:opacity-0 sm:group-hover/slider:opacity-100 transition-all backdrop-blur-xs cursor-pointer hover:scale-110 active:scale-95"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      <button
        type="button"
        onClick={nextSlide}
        aria-label="Próxima foto"
        className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/50 hover:bg-black/80 text-white flex items-center justify-center opacity-80 sm:opacity-0 sm:group-hover/slider:opacity-100 transition-all backdrop-blur-xs cursor-pointer hover:scale-110 active:scale-95"
      >
        <ChevronRight className="w-4 h-4" />
      </button>

      {/* Paginação com Dots */}
      <div className="absolute bottom-2.5 right-3 flex items-center gap-1.5 z-10">
        {images.map((_, idx) => (
          <button
            key={idx}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setCurrentIndex(idx);
            }}
            aria-label={`Ver foto ${idx + 1}`}
            className={`transition-all duration-300 rounded-full cursor-pointer ${
              currentIndex === idx
                ? 'w-4 h-1.5 bg-yellow-400'
                : 'w-1.5 h-1.5 bg-white/60 hover:bg-white'
            }`}
          />
        ))}
      </div>
    </div>
  );
};

export const Categories: React.FC<CategoriesProps> = ({ onSelectCategory }) => {
  const [addedCategoryId, setAddedCategoryId] = useState<string | null>(null);

  const handleAdd = (catId: string, material: string) => {
    onSelectCategory(material);
    setAddedCategoryId(catId);
    setTimeout(() => {
      setAddedCategoryId(null);
    }, 2000);
  };

  return (
    <section id="categorias" className="py-12 sm:py-16 bg-white border-b border-slate-200 scroll-mt-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header da Seção com Efeito Scroll Reveal */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.5 }}
          className="flex flex-col md:flex-row md:items-end justify-between mb-10 pb-4 border-b border-slate-200 gap-4"
        >
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#d31010] mb-1">
              <span>Catálogo Geral de Materiais</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#003882] tracking-tight">
              Principais Linhas em Pronta Entrega
            </h2>
            <p className="text-slate-600 text-xs sm:text-sm mt-1 max-w-2xl">
              Clique em <strong className="text-slate-800">+ Adicionar à Cotação</strong> em qualquer categoria para preencher automaticamente os itens no formulário de orçamento.
            </p>
          </div>

          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500 shrink-0">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Mais de 15.000 itens disponíveis para entrega imediata</span>
          </div>
        </motion.div>

        {/* Grade de Categorias com Carrossel de Imagens e Microinterações */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {CATEGORIES_DATA.map((cat, idx) => {
            const Icon = cat.icon;
            const isAdded = addedCategoryId === cat.id;

            return (
              <motion.div
                key={cat.id}
                id={cat.id}
                initial={{ opacity: 0, y: 28 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-30px" }}
                transition={{ duration: 0.45, delay: idx * 0.08 }}
                className="scroll-mt-36 sm:scroll-mt-32 bg-[#f8fafc] border border-slate-200 rounded-lg overflow-hidden flex flex-col justify-between hover:border-[#004b9c] shadow-xs hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300 group"
              >
                <div>
                  {/* 1. Carrossel de Imagens Superior */}
                  <CategoryImageSlider 
                    images={cat.images} 
                    categoryTitle={cat.title} 
                  />

                  {/* 2. Conteúdo Textual do Card */}
                  <div className="p-5">
                    {/* Topo: Ícone e Badge */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="w-9 h-9 rounded bg-blue-100/80 text-[#003882] flex items-center justify-center shrink-0 group-hover:bg-[#004b9c] group-hover:text-white transition-colors duration-300">
                        <Icon className="w-5 h-5" />
                      </div>

                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-50 text-[#003882] border border-blue-200">
                        {cat.badge}
                      </span>
                    </div>

                    {/* Título & Descrição */}
                    <h3 className="text-base font-bold text-slate-900 group-hover:text-[#004b9c] transition-colors mb-1.5">
                      {cat.title}
                    </h3>
                    <p className="text-xs text-slate-600 leading-relaxed mb-4 line-clamp-3">
                      {cat.description}
                    </p>

                    {/* Lista de Itens */}
                    <div className="space-y-1.5 pt-3 border-t border-slate-200/80 mb-2">
                      <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-2">
                        Principais produtos da linha:
                      </div>
                      {cat.items.map((item, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs text-slate-600">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#004b9c] shrink-0" />
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 3. Botão de Ação Direto com Efeito de Escala e Feedback */}
                <div className="p-5 pt-0">
                  <button
                    type="button"
                    onClick={() => handleAdd(cat.id, cat.sampleMaterial)}
                    className={`w-full inline-flex items-center justify-center gap-2 text-xs font-bold py-2.5 px-4 rounded-md transition-all duration-200 cursor-pointer shadow-xs hover:scale-[1.02] active:scale-[0.98] ${
                      isAdded
                        ? 'bg-emerald-600 text-white border border-emerald-600 shadow-md'
                        : 'bg-white hover:bg-[#004b9c] text-[#003882] hover:text-white border border-[#004b9c]'
                    }`}
                  >
                    {isAdded ? (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Item Adicionado ao Orçamento!</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        <span>Adicionar à Cotação</span>
                      </>
                    )}
                  </button>
                </div>

              </motion.div>
            );
          })}
        </div>

      </div>
    </section>
  );
};
