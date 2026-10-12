import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

async function generateOgImage() {
  const width = 1200;
  const height = 630;

  const svgContent = `
  <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <!-- Fundo Gradiente Corporativo -->
      <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#00183b" />
        <stop offset="50%" stop-color="#002b66" />
        <stop offset="100%" stop-color="#051226" />
      </linearGradient>

      <!-- Gradiente Dourado / Âmbar para Elétrica -->
      <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#fbbf24" />
        <stop offset="100%" stop-color="#f59e0b" />
      </linearGradient>

      <!-- Gradiente Azul Cyan Neon -->
      <linearGradient id="cyanGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#38bdf8" />
        <stop offset="100%" stop-color="#0284c7" />
      </linearGradient>

      <!-- Glow filter -->
      <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="8" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>

    <!-- Background -->
    <rect width="${width}" height="${height}" fill="url(#bgGrad)" />

    <!-- Circuit Patterns Decorativos -->
    <g opacity="0.12" stroke="#38bdf8" stroke-width="2" fill="none">
      <path d="M-100 120 L300 120 L400 220 L700 220 L800 120 L1300 120" />
      <path d="M-100 280 L200 280 L350 430 L900 430 L1050 280 L1300 280" />
      <path d="M200 630 L400 430 L600 430 L750 580 L1100 580" />
      <circle cx="300" cy="120" r="6" fill="#38bdf8" />
      <circle cx="700" cy="220" r="6" fill="#fbbf24" />
      <circle cx="350" cy="430" r="6" fill="#38bdf8" />
      <circle cx="900" cy="430" r="6" fill="#fbbf24" />
      <circle cx="400" cy="430" r="6" fill="#38bdf8" />
    </g>

    <!-- Círculo de Luz / Destaque de Fundo -->
    <circle cx="1020" cy="240" r="280" fill="#004b9c" opacity="0.45" filter="url(#glow)" />
    <circle cx="150" cy="500" r="200" fill="#f59e0b" opacity="0.1" filter="url(#glow)" />

    <!-- Moldura de Borda Fina de Luxo -->
    <rect x="24" y="24" width="${width - 48}" height="${height - 48}" rx="20" fill="none" stroke="#ffffff" stroke-width="1.5" stroke-opacity="0.15" />

    <!-- Tagline / Selo de Categoria -->
    <g transform="translate(80, 85)">
      <rect x="0" y="0" width="340" height="42" rx="21" fill="#004b9c" fill-opacity="0.6" stroke="#38bdf8" stroke-width="1.5" />
      <circle cx="22" cy="21" r="5" fill="#38bdf8" filter="url(#glow)" />
      <text x="38" y="27" font-family="Arial, Helvetica, sans-serif" font-size="14" font-weight="700" fill="#e0f2fe" letter-spacing="2">DISTRIBUIDORA DE MATERIAIS</text>
    </g>

    <!-- Ícone da Phoenix / Raio Elétrico -->
    <g transform="translate(80, 160)">
      <!-- Logo Container -->
      <rect x="0" y="0" width="76" height="76" rx="18" fill="url(#cyanGrad)" />
      <!-- Raio -->
      <path d="M42 14 L24 42 L38 42 L34 62 L52 34 L38 34 Z" fill="#ffffff" />
      
      <!-- Título Principal -->
      <text x="96" y="44" font-family="Arial, Helvetica, sans-serif" font-size="44" font-weight="900" fill="#ffffff" letter-spacing="1">PHOENIX</text>
      <text x="96" y="70" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="700" fill="#fbbf24" letter-spacing="6">MATERIAIS ELÉTRICOS</text>
    </g>

    <!-- Chamada Principal / Slogan -->
    <g transform="translate(80, 290)">
      <text x="0" y="0" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="800" fill="#ffffff">
        Distribuição Completa para sua Obra
      </text>
      <text x="0" y="42" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="400" fill="#94a3b8">
        Cabos elétricos, disjuntores, iluminação LED e infraestrutura.
      </text>
    </g>

    <!-- 3 Badges de Vantagens / Diferenciais -->
    <g transform="translate(80, 395)">
      <!-- Badge 1: Cotação no WhatsApp -->
      <g transform="translate(0, 0)">
        <rect x="0" y="0" width="310" height="64" rx="14" fill="#0f2b48" stroke="#25d366" stroke-width="1.5" stroke-opacity="0.8" />
        <circle cx="34" cy="32" r="14" fill="#25d366" fill-opacity="0.2" />
        <!-- Ícone WhatsApp / Chat -->
        <text x="24" y="38" font-family="Arial, Helvetica, sans-serif" font-size="18">💬</text>
        <text x="60" y="27" font-family="Arial, Helvetica, sans-serif" font-size="15" font-weight="700" fill="#ffffff">Cotação Rápida WhatsApp</text>
        <text x="60" y="48" font-family="Arial, Helvetica, sans-serif" font-size="13" font-weight="400" fill="#86efac">Atendimento ágil de balcão</text>
      </g>

      <!-- Badge 2: Entrega Rápida -->
      <g transform="translate(330, 0)">
        <rect x="0" y="0" width="310" height="64" rx="14" fill="#0f2b48" stroke="#38bdf8" stroke-width="1.5" stroke-opacity="0.8" />
        <circle cx="34" cy="32" r="14" fill="#38bdf8" fill-opacity="0.2" />
        <text x="24" y="38" font-family="Arial, Helvetica, sans-serif" font-size="18">🚚</text>
        <text x="60" y="27" font-family="Arial, Helvetica, sans-serif" font-size="15" font-weight="700" fill="#ffffff">Pronta Entrega</text>
        <text x="60" y="48" font-family="Arial, Helvetica, sans-serif" font-size="13" font-weight="400" fill="#7dd3fc">Agilidade para Grande SP e região</text>
      </g>

      <!-- Badge 3: Normatizado -->
      <g transform="translate(660, 0)">
        <rect x="0" y="0" width="310" height="64" rx="14" fill="#0f2b48" stroke="#f59e0b" stroke-width="1.5" stroke-opacity="0.8" />
        <circle cx="34" cy="32" r="14" fill="#f59e0b" fill-opacity="0.2" />
        <text x="24" y="38" font-family="Arial, Helvetica, sans-serif" font-size="18">🛡️</text>
        <text x="60" y="27" font-family="Arial, Helvetica, sans-serif" font-size="15" font-weight="700" fill="#ffffff">Normas NBR 5410</text>
        <text x="60" y="48" font-family="Arial, Helvetica, sans-serif" font-size="13" font-weight="400" fill="#fcd34d">Marcas líderes certificadas</text>
      </g>
    </g>

    <!-- Rodapé / Barra de Localização e Site -->
    <g transform="translate(80, 520)">
      <line x1="0" y1="0" x2="1040" y2="0" stroke="#ffffff" stroke-opacity="0.15" stroke-width="1" />
      <text x="0" y="34" font-family="Arial, Helvetica, sans-serif" font-size="16" font-weight="700" fill="#38bdf8">
        📍 São Paulo - SP
      </text>
      <text x="220" y="34" font-family="Arial, Helvetica, sans-serif" font-size="16" font-weight="500" fill="#94a3b8">
        • Atendimento a Construtoras, Indústrias e Eletricistas
      </text>
      <text x="1040" y="34" text-anchor="end" font-family="Arial, Helvetica, sans-serif" font-size="16" font-weight="800" fill="#fbbf24">
        SOLICITE SEU ORÇAMENTO
      </text>
    </g>
  </svg>
  `;

  const outputPath = path.resolve('public', 'og-image.png');
  await sharp(Buffer.from(svgContent))
    .png({ quality: 90, compressionLevel: 8 })
    .toFile(outputPath);

  console.log(`OpenGraph image generated at: ${outputPath}`);
}

generateOgImage().catch(console.error);
