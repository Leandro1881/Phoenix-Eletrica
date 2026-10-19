// Gera os ícones do site (aba do navegador, resultados do Google, atalho no celular)
// a partir de public/favicon.svg. Rodar quando o símbolo mudar:
//   node scripts/generate-favicons.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const publicDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const svg = fs.readFileSync(path.join(publicDir, 'favicon.svg'));

const png = (size) => sharp(svg, { density: 384 }).resize(size, size).png().toBuffer();

// .ico com imagens PNG embutidas (formato aceito por todos os navegadores atuais)
const buildIco = (images) => {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = 6 + 16 * images.length;
  const entries = images.map(({ size, data }) => {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0);
    e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(data.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += data.length;
    return e;
  });
  return Buffer.concat([header, ...entries, ...images.map((i) => i.data)]);
};

const icoSizes = [16, 32, 48];
const icoImages = await Promise.all(icoSizes.map(async (size) => ({ size, data: await png(size) })));
fs.writeFileSync(path.join(publicDir, 'favicon.ico'), buildIco(icoImages));

for (const [name, size] of [
  ['apple-touch-icon.png', 180],
  ['icon-192.png', 192],
  ['icon-512.png', 512]
]) {
  fs.writeFileSync(path.join(publicDir, name), await png(size));
}

console.log('Ícones gerados em public/');
