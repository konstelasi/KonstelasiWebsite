import { type Lang, langs, ui } from '../i18n';
import { entriesIn, slugOf } from './content';
import { staticPages } from './pages';
import { ogName } from './og';
import { tagPath, tagsIn, tagMeta } from './tags';

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
      // The card already names Konstelasi beside the logo, so the home card
      // leads with the tagline alone.
      const title = path === '/' ? ui(lang).site.tagline : meta[lang].title;
      pages.push({ lang, name: ogName(path), title, subtitle: meta[lang].description });
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
    for (const tag of await tagsIn(lang)) {
      const meta = tagMeta(lang, tag);
      pages.push({ lang, name: ogName(tagPath(tag.slug)), title: meta.title, subtitle: meta.description });
    }
    for (const l of await entriesIn('legal', lang)) {
      pages.push({ lang, name: ogName(`/${slugOf(l)}/`), title: l.data.title, subtitle: l.data.description });
    }
  }
  return pages;
}
