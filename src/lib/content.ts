import { getCollection, type CollectionEntry, type DataEntryMap } from 'astro:content';
import type { Lang } from '../i18n';

type Key = keyof DataEntryMap;

/** `en/stardust` gives `{ lang: 'en', slug: 'stardust' }`. */
export function splitId(id: string): { lang: Lang; slug: string } {
  const [lang, ...rest] = id.split('/');
  if (lang !== 'en' && lang !== 'id') throw new Error(`content id "${id}" has no en/ or id/ prefix`);
  return { lang, slug: rest.join('/') };
}

export function slugOf(entry: { id: string }): string {
  return splitId(entry.id).slug;
}

/** Every entry of a collection in one language. */
export async function entriesIn<C extends Key>(collection: C, lang: Lang): Promise<CollectionEntry<C>[]> {
  const all = (await getCollection(collection)) as CollectionEntry<C>[];
  return all.filter((e) => splitId(e.id).lang === lang);
}

/** Blog posts in one language, newest first. */
export async function posts(lang: Lang): Promise<CollectionEntry<'blog'>[]> {
  const list = await entriesIn('blog', lang);
  return list.sort((a, b) => b.data.published.getTime() - a.data.published.getTime());
}

/** Products and services in their display order. */
export async function ordered<C extends 'products' | 'services'>(collection: C, lang: Lang): Promise<CollectionEntry<C>[]> {
  const list = await entriesIn(collection, lang);
  return list.sort((a, b) => a.data.order - b.data.order);
}
