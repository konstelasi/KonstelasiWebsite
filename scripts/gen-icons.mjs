// Generator for the favicon and the Apple touch icon in public/. Run from the
// project root with `node scripts/gen-icons.mjs` after the logo changes.
// The logo is black on transparent, which disappears on a dark browser tab,
// so both icons put it on a white rounded square.
import sharp from 'sharp';

const logo = 'src/assets/konstelasi-logo-black.png';

async function icon(size, padding, radius, out) {
  const inner = size - padding * 2;
  const mark = await sharp(logo).resize(inner, inner).png().toBuffer();
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
