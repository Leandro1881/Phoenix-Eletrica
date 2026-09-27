import React from 'react';
import { Plus, Zap, Shield, Lightbulb, Box, Cpu, Wrench, CheckCircle2, ToggleLeft } from 'lucide-react';
import { Category } from '../types';

interface CategoriesProps {
  onSelectCategory: (item: string) => void;
}

const CATEGORIES_DATA: (Category & { icon: React.FC<{ className?: string }> })[] = [
  {
    id: 'fios-cabos',
    title: 'Fios e Cabos Normatizados',
    description: 'Cabos flexíveis 750V (1,5mm² a 16mm²), cabos de potência 0,6/1kV, cabos de comando e fiação antichama com certificação Inmetro.',
    items: ['Cabos flexíveis 1,5 a 10mm²', 'Cabos de cobre 0,6/1kV', 'Cabos de rede e telefonia', 'Fios antichama NBR NM 247-3'],
    sampleMaterial: 'Cabos Flexíveis 750V (2.5mm² azul, vermelho e verde)',
    color: 'blue',
    badge: 'Mais Vendido',
    icon: Zap
  },
  {
    id: 'disjuntores-quadros',
    title: 'Disjuntores & Quadros de Distribuição',
    description: 'Mini disjuntores monopolares, bipolares e tripolares (Curva B e C), caixas moldadas, DRs (diferencial residual), DPS e caixas de comando.',
    items: ['Mini disjuntores DIN Curva C 10A a 63A', 'Interruptores DR (IDR) 30mA', 'Protetores contra surtos DPS Classe II', 'Quadros de embutir e sobrepor até 72 DIN'],
    sampleMaterial: 'Disjuntores monopolares 20A Curva C e Quadro de Embutir 18 DIN',
    color: 'blue',
    badge: 'Segurança NR-10',
    icon: Shield
  },
  {
    id: 'iluminacao-led',
    title: 'Iluminação Técnica & Industrial',
    description: 'Luminárias industriais High Bay, refletores de alta potência IP65/IP66, painéis LED de sobrepor/embutir e iluminação linear comercial.',
    items: ['Refletores LED 50W a 400W IP66', 'Luminárias industriais UFO High Bay', 'Painéis LED 60x60 e luminárias tubulares', 'Fitas LED de alta densidade e drivers'],
    sampleMaterial: 'Refletores LED 100W IP66 Branco Frio e Painéis LED 60x60',
    color: 'blue',
    badge: 'Eficiência A+',
    icon: Lightbulb
  },
  {
    id: 'infraestrutura',
    title: 'Infraestrutura & Eletrodutos',
    description: 'Eletrocalhas galvanizadas a fogo, perfilados perfurados, eletrodutos corrugados reforçados, tubos de PVC rígido e caixas de passagem.',
    items: ['Eletrocalhas perfuradas galvanizadas', 'Eletrodutos corrugados reforçados 25mm e 32mm', 'Tubos rígidos roscáveis e soldáveis', 'Caixas de passagem e conduletes alumínio'],
    sampleMaterial: 'Eletrodutos corrugados reforçados e Caixas de Passagem 4x2 / 4x4',
    color: 'blue',
    badge: 'Construção Civil',
    icon: Box
  },
  {
    id: 'tomadas-acabamentos',
    title: 'Tomadas, Interruptores & Linhas de Acabamento',
    description: 'Conjuntos modulares 4x2 e 4x4, tomadas 10A e 20A, interruptores simples/paralelos, placas, módulos USB e caixas de piso.',
    items: ['Módulos de tomada 10A e 20A 250V', 'Interruptores simples, paralelos e intermediários', 'Placas 4x2 e 4x4 com suporte e acabamento', 'Tomadas para móveis e caixas de piso'],
    sampleMaterial: 'Conjuntos 4x2 com tomadas 20A e Placas modulares brancas',
    color: 'blue',
    badge: 'Acabamentos',
    icon: ToggleLeft
  },
  {
    id: 'automacao-comandos',
    title: 'Automação, Comandos & Ferramentas',
    description: 'Contatores de potência e comando, relés térmicos, inversores de frequência, botoeiras, multímetros e ferramentas especializadas para eletricistas.',
    items: ['Contatores tripolares de 9A a 150A', 'Relés térmicos e protetores de motor', 'Botoeiras de emergência e sinalizadores', 'Multímetros True-RMS e alicates decapadores'],
    sampleMaterial: 'Contatores tripolares e Relés Térmicos de Sobrecarga',
    color: 'blue',
    badge: 'Industrial & Técnico',
    icon: Cpu
  }
];

export const Categories: React.FC<CategoriesProps> = ({ onSelectCategory }) => {
  return (
    <section id="categorias" className="py-12 sm:py-16 bg-white border-b border-slate-200 scroll-mt-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header da Seção */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 pb-4 border-b border-slate-200 gap-4">
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
        </div>

        {/* Grade de Categorias Conservadora e Limpa */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {CATEGORIES_DATA.map((cat) => {
            const Icon = cat.icon;

            return (
              <div
                key={cat.id}
                id={cat.id}
                className="scroll-mt-36 sm:scroll-mt-32 bg-[#f8fafc] border border-slate-200 rounded-lg p-5 flex flex-col justify-between hover:border-[#004b9c] hover:shadow-md transition-all group duration-300"
              >
                <div>
                  
                  {/* Topo do Card */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="w-10 h-10 rounded bg-blue-100/80 text-[#003882] flex items-center justify-center shrink-0 group-hover:bg-[#004b9c] group-hover:text-white transition-colors">
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
                  <p className="text-xs text-slate-600 leading-relaxed mb-4">
                    {cat.description}
                  </p>

                  {/* Lista de Itens */}
                  <div className="space-y-1.5 pt-3 border-t border-slate-200/80 mb-5">
                    <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-2">
                      Principais produtos da linha:
                    </div>
                    {cat.items.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-xs text-slate-600">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#004b9c] shrink-0" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>

                </div>

                {/* Botão de Ação Direto */}
                <button
                  type="button"
                  onClick={() => onSelectCategory(cat.sampleMaterial)}
                  className="w-full mt-2 inline-flex items-center justify-center gap-2 bg-white hover:bg-[#004b9c] text-[#003882] hover:text-white border border-[#004b9c] text-xs font-bold py-2.5 px-4 rounded transition-colors cursor-pointer shadow-2xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>Adicionar à Cotação</span>
                </button>

              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
};
