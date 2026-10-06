import { type Lang, langs } from '../i18n';
import { entriesIn, slugOf } from './content';
import { staticPages } from './pages';
import { ogName } from './og';

export interface OgPage {
  lang: Lang;
  name: string;
  title: string;
  subtitle: string;
}

/**
 * Every published page, with the text its link preview shows. A new route
 * needs an entry here, or its `og:image` points at nothing. The link check
 * (`npm run verify:links`) reports that case.
 */
export async function ogPages(): Promise<OgPage[]> {
  const pages: OgPage[] = [];
  for (const lang of langs) {
    for (const [path, meta] of Object.entries(staticPages)) {
      pages.push({ lang, name: ogName(path), title: meta[lang].title, subtitle: meta[lang].description });
    }
    for (const p of await entriesIn('products', lang)) {
      pages.push({ lang, name: ogName(`/software/${slugOf(p)}/`), title: p.data.name, subtitle: p.data.summary });
    }
    for (const s of await entriesIn('services', lang)) {
      pages.push({ lang, name: ogName(`/service/${slugOf(s)}/`), title: s.data.name, subtitle: s.data.summary });
    }
    for (const b of await entriesIn('blog', lang)) {
      pages.push({ lang, name: ogName(`/blog/${slugOf(b)}/`), title: b.data.title, subtitle: b.data.description });
    }
    for (const l of await entriesIn('legal', lang)) {
      pages.push({ lang, name: ogName(`/${slugOf(l)}/`), title: l.data.title, subtitle: l.data.description });
    }
  }
  return pages;
}
