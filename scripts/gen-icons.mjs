// Generator for the favicons in public/. Run from the project root with
// `node scripts/gen-icons.mjs` after the logo changes.
//
// favicon.svg is the logo with its own colour scheme, black on light browser
// tabs and white on dark ones. The PNGs are fallbacks for browsers and home
// screens that don't take an SVG icon, so they put the black mark on a white
// rounded square that reads on either.
import { readFileSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';

const source = readFileSync('src/assets/konstelasi-logo.svg', 'utf8').replace(/<!--[\s\S]*?-->\s*/g, '');

const adaptive = source.replace(
  /(<svg[^>]*>)/,
  '$1<style>svg{color:#000}@media (prefers-color-scheme: dark){svg{color:#fff}}</style>',
);
writeFileSync('public/favicon.svg', adaptive);
console.log('wrote public/favicon.svg');

const black = Buffer.from(source.replace(/currentColor/g, '#000000'));

async function icon(size, padding, radius, out) {
  const inner = size - padding * 2;
  const mark = await sharp(black, { density: 300 }).resize(inner, inner).png().toBuffer();
  const plate = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">` +
      `<rect width="${size}" height="${size}" rx="${radius}" fill="#ffffff"/></svg>`,
  );
  await sharp(plate)
    .composite([{ input: mark, top: padding, left: padding }])
    .png()
    .toFile(out);
  console.log(`wrote ${out}`);
}

await icon(32, 3, 7, 'public/favicon-32.png');
await icon(180, 22, 0, 'public/apple-touch-icon.png');
