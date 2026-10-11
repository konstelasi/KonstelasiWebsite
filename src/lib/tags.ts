import type { CollectionEntry } from 'astro:content';
import type { Lang } from '../i18n';
import { posts } from './content';
import type { PageMeta } from './pages';

/**
 * A tag gets its own page at `/blog/tag/<slug>/` only when this many posts
 * carry it. A page with one post is thin, and the post already links to its
 * tags. The blog admin's tag list shows live post counts so an editor can see
 * which tags have a page. Posts in both languages share their tags, so the
 * same tags pass in English and in Indonesian and every tag page has a twin.
 */
export const MIN_TAG_POSTS = 2;

export interface Tag {
  slug: string;
  /** The name in the language asked for. */
  name: string;
  /** Its posts in that language, newest first. */
  posts: CollectionEntry<'blog'>[];
}

/** The English path of a tag page, in the form every route and link starts from. */
export function tagPath(slug: string): string {
  return `/blog/tag/${slug}/`;
}

/** The tags that have a page, most used first and then by name. */
export async function tagsIn(lang: Lang): Promise<Tag[]> {
  const bySlug = new Map<string, Tag>();
  for (const post of await posts(lang)) {
    for (const { slug, name } of post.data.tags) {
      const tag = bySlug.get(slug) ?? { slug, name, posts: [] };
      tag.posts.push(post);
      bySlug.set(slug, tag);
    }
  }
  return [...bySlug.values()]
    .filter((tag) => tag.posts.length >= MIN_TAG_POSTS)
    .sort((a, b) => b.posts.length - a.posts.length || a.name.localeCompare(b.name, lang));
}

/** Title and description of a tag page, shared by the page and its link preview. */
export function tagMeta(lang: Lang, tag: Tag): PageMeta {
  const count = tag.posts.length;
  return {
    en: {
      title: `${tag.name} posts`,
      description: `The ${count} posts we have written about ${tag.name}, newest first.`,
    },
    id: {
      title: `Tulisan tentang ${tag.name}`,
      description: `${count} tulisan kami tentang ${tag.name}, dari yang terbaru.`,
    },
  }[lang];
}
