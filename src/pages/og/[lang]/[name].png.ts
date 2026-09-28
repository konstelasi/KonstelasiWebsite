/**
 * Link preview images, one per page and language, drawn at build time with
 * Satori and rasterised with resvg. They land in dist/og/ as plain PNGs.
 *
 * Satori needs raw TTF files rather than the woff2 the site serves, so the
 * two Poppins weights live in src/assets/fonts/ (OFL, see OFL.txt there).
 */
import type { APIRoute, GetStaticPaths } from 'astro';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import sharp from 'sharp';
import { ogPages, type OgPage } from '../../../lib/og-pages';

export const getStaticPaths: GetStaticPaths = async () => {
  const pages = await ogPages();
  return pages.map((page) => ({ params: { lang: page.lang, name: page.name }, props: { page } }));
};

const root = process.cwd();
const fonts = [
  { name: 'Poppins', data: readFileSync(join(root, 'src/assets/fonts/Poppins-Regular.ttf')), weight: 400 as const, style: 'normal' as const },
  { name: 'Poppins', data: readFileSync(join(root, 'src/assets/fonts/Poppins-SemiBold.ttf')), weight: 600 as const, style: 'normal' as const },
];

// The logo is black, so it's inverted once for the dark card.
const logo = await sharp(join(root, 'src/assets/konstelasi-logo-black.png')).resize(96, 96).negate({ alpha: false }).png().toBuffer();
const logoUri = `data:image/png;base64,${logo.toString('base64')}`;

// A fragment of the home page constellation, bleeding off the right edge.
const sky = `<svg xmlns="http://www.w3.org/2000/svg" width="520" height="630" viewBox="0 0 520 630">
  <g fill="none" stroke-width="2">
    <path d="M120 170 L340 110 L420 360 L180 450 Z" stroke="#b39ddb"/>
    <path d="M120 170 L60 330 M180 450 L300 560 M340 110 L500 210 M420 360 L500 520" stroke="#3f3f3f"/>
  </g>
  <g fill="#ededed"><circle cx="120" cy="170" r="7"/><circle cx="340" cy="110" r="7"/><circle cx="420" cy="360" r="7"/><circle cx="180" cy="450" r="7"/></g>
  <g fill="#8a8a8a"><circle cx="60" cy="330" r="4"/><circle cx="300" cy="560" r="4"/><circle cx="500" cy="210" r="4"/><circle cx="500" cy="520" r="4"/></g>
</svg>`;
const skyUri = `data:image/svg+xml;base64,${Buffer.from(sky).toString('base64')}`;

type Node = { type: string; props: Record<string, unknown> };

// Satori only needs a React-element-shaped tree, so no React import.
function h(type: string, props: Record<string, unknown>, ...children: Array<Node | string>): Node {
  return { type, props: { ...props, children: children.length === 1 ? children[0] : children } };
}

function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, text.lastIndexOf(' ', max))}…`;
}

function card(page: OgPage): Node {
  return h(
    'div',
    {
      style: {
        width: '1200px',
        height: '630px',
        display: 'flex',
        position: 'relative',
        backgroundColor: '#090909',
        fontFamily: 'Poppins',
        color: '#ededed',
      },
    },
    h('img', { src: skyUri, width: 520, height: 630, style: { position: 'absolute', right: -60, top: 0 } }),
    h(
      'div',
      {
        style: {
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          width: '800px',
          height: '100%',
          padding: '64px 72px',
        },
      },
      h(
        'div',
        { style: { display: 'flex', alignItems: 'center', fontSize: 30, fontWeight: 600 } },
        h('img', { src: logoUri, width: 44, height: 44, style: { marginRight: 18 } }),
        'Konstelasi',
      ),
      h(
        'div',
        { style: { display: 'flex', flexDirection: 'column' } },
        h(
          'div',
          { style: { display: 'flex', fontSize: page.title.length > 32 ? 58 : 72, fontWeight: 600, lineHeight: 1.05, letterSpacing: '-0.03em' } },
          page.title,
        ),
        h(
          'div',
          { style: { display: 'flex', marginTop: 26, fontSize: 26, lineHeight: 1.45, color: '#aaaaaa' } },
          clip(page.subtitle, 120),
        ),
      ),
    ),
  );
}

export const GET: APIRoute = async ({ props }) => {
  const svg = await satori(card((props as { page: OgPage }).page) as never, { width: 1200, height: 630, fonts });
  const png = new Resvg(svg).render().asPng();
  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } });
};
