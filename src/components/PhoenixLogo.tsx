import React from 'react';

interface PhoenixLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'full' | 'compact' | 'horizontal';
}

export const PhoenixLogo: React.FC<PhoenixLogoProps> = ({ 
  className = '', 
  size = 'md',
  variant = 'full'
}) => {
  // Configurações de proporção baseadas no tamanho
  const sizeConfig = {
    sm: { height: 42, iconSize: 34, fontSize: 'text-xs', redPx: 'px-2 py-0.5' },
    md: { height: 56, iconSize: 44, fontSize: 'text-sm', redPx: 'px-3 py-1' },
    lg: { height: 72, iconSize: 58, fontSize: 'text-base', redPx: 'px-4 py-1.5' },
    xl: { height: 96, iconSize: 76, fontSize: 'text-lg', redPx: 'px-5 py-2' }
  };

  const currentSize = sizeConfig[size];

  if (variant === 'horizontal') {
    return (
      <div className={`inline-flex items-center gap-2 sm:gap-2.5 select-none ${className}`}>
        {/* Ícone da Lâmpada + Raio Phoenix */}
        <div className="relative shrink-0 w-8 h-8 sm:w-10 sm:h-10 lg:w-11 lg:h-11">
          <svg viewBox="0 0 120 120" className="w-full h-full drop-shadow-sm" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Faísca / Explosão Elétrica em Azul (Fundo) */}
            <path 
              d="M 45 15 L 52 32 L 68 18 L 65 38 L 85 30 L 75 48 L 98 46 L 82 60 L 95 72 L 78 72 L 80 88 L 66 78 L 60 96 L 50 80 L 36 94 L 38 74 L 18 78 L 30 62 L 12 50 L 32 44 L 22 26 L 40 34 Z" 
              fill="none" 
              stroke="#0022cc" 
              strokeWidth="2.5" 
              strokeLinejoin="round" 
            />

            {/* Raio Amarelo Elétrico */}
            <path 
              d="M 76 18 L 62 46 L 74 46 L 36 98 L 48 58 L 36 58 Z" 
              fill="#FFEA00" 
              stroke="#0022cc" 
              strokeWidth="1.8" 
              strokeLinejoin="round" 
            />

            {/* Lâmpada Redonda - Anel Azul */}
            <circle 
              cx="58" 
              cy="54" 
              r="24" 
              fill="#FFFFFF" 
              stroke="#0022cc" 
              strokeWidth="6.5" 
            />

            {/* Base da Lâmpada (Rosca / Bocal a 45°) */}
            <g transform="translate(68, 65) rotate(42)">
              {/* Rosca com filetes metálicos */}
              <path d="M 0 0 L 16 0 L 15 5 L 1 5 Z" fill="#0022cc" />
              <path d="M 1 6 L 15 6 L 14 10 L 2 10 Z" fill="#0022cc" />
              <path d="M 2 11 L 14 11 L 13 15 L 3 15 Z" fill="#0022cc" />
              <path d="M 3 16 L 13 16 L 12 19 L 4 19 Z" fill="#0022cc" />
              {/* Contato inferior arredondado */}
              <path d="M 4 20 Q 8 24 12 20 Z" fill="#0022cc" />
            </g>

            {/* Marca Registrada ® */}
            <circle cx="98" cy="62" r="5" fill="none" stroke="#0022cc" strokeWidth="1" />
            <text x="98" y="64.5" fill="#0022cc" fontSize="6.5" fontFamily="sans-serif" fontWeight="bold" textAnchor="middle">R</text>
          </svg>
        </div>

        {/* Retângulo Vermelho com Nome Oficial */}
        <div className="flex flex-col">
          <div className="bg-[#d31010] text-white font-bold tracking-tight px-2 sm:px-3 py-0.5 sm:py-1 rounded shadow-[0_2px_4px_rgba(0,0,0,0.25)] border-t border-red-400">
            <span className="text-sm sm:text-base lg:text-lg font-['Plus_Jakarta_Sans',sans-serif] tracking-tight whitespace-nowrap">
              Phoenix Elétrica
            </span>
          </div>
          <span className="text-[9px] sm:text-[10px] text-slate-500 font-semibold tracking-wider uppercase mt-0.5 whitespace-nowrap hidden sm:inline">
            Materiais Elétricos & Distribuição
          </span>
        </div>
      </div>
    );
  }

  // Versão padrão (completa com lâmpada, raio e plaqueta vermelha empilhada)
  return (
    <div className={`inline-flex flex-col items-center select-none ${className}`}>
      {/* Símbolo Lâmpada + Raio */}
      <div className="relative" style={{ width: currentSize.iconSize * 1.3, height: currentSize.iconSize * 1.15 }}>
        <svg viewBox="0 0 120 110" className="w-full h-full drop-shadow-sm" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Faísca / Estrela Elétrica em Azul (Fundo) */}
          <path 
            d="M 45 8 L 54 26 L 70 12 L 67 32 L 87 24 L 77 42 L 100 40 L 84 54 L 97 66 L 80 66 L 82 82 L 68 72 L 62 90 L 52 74 L 38 88 L 40 68 L 20 72 L 32 56 L 14 44 L 34 38 L 24 20 L 42 28 Z" 
            fill="none" 
            stroke="#0022cc" 
            strokeWidth="2.8" 
            strokeLinejoin="round" 
          />

          {/* Raio Amarelo Elétrico */}
          <path 
            d="M 76 12 L 62 40 L 74 40 L 36 92 L 48 52 L 36 52 Z" 
            fill="#FFEA00" 
            stroke="#0022cc" 
            strokeWidth="2" 
            strokeLinejoin="round" 
          />

          {/* Lâmpada Redonda - Círculo Azul */}
          <circle 
            cx="58" 
            cy="48" 
            r="23" 
            fill="#FFFFFF" 
            stroke="#0022cc" 
            strokeWidth="6" 
          />

          {/* Base da Lâmpada (Rosca / Bocal) */}
          <g transform="translate(68, 58) rotate(42)">
            <path d="M 0 0 L 16 0 L 15 5 L 1 5 Z" fill="#0022cc" />
            <path d="M 1 6 L 15 6 L 14 10 L 2 10 Z" fill="#0022cc" />
            <path d="M 2 11 L 14 11 L 13 15 L 3 15 Z" fill="#0022cc" />
            <path d="M 3 16 L 13 16 L 12 19 L 4 19 Z" fill="#0022cc" />
            <path d="M 4 20 Q 8 24 12 20 Z" fill="#0022cc" />
          </g>

          {/* Símbolo de Marca Registrada ® */}
          <circle cx="98" cy="56" r="5" fill="none" stroke="#0022cc" strokeWidth="1" />
          <text x="98" y="58.5" fill="#0022cc" fontSize="6.5" fontFamily="sans-serif" fontWeight="bold" textAnchor="middle">R</text>
        </svg>
      </div>

      {/* Caixa Retangular Vermelha Tradicional do Logotipo */}
      <div className={`bg-[#d31010] text-white font-bold tracking-tight ${currentSize.redPx} rounded shadow-[0_2px_5px_rgba(0,0,0,0.3)] border-t border-red-400 mt-[-6px] z-10`}>
        <span className={`${currentSize.fontSize} font-['Plus_Jakarta_Sans',sans-serif] whitespace-nowrap`}>
          Phoenix Elétrica
        </span>
      </div>
    </div>
  );
};
