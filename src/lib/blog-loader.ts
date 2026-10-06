import type { Loader } from 'astro/loaders';
import { langs } from '../i18n';

/**
 * Loads blog posts from the blog admin's API, in place of the Markdown files
 * in `src/content/blog/`. Each post becomes two entries, `en/<slug>` and
 * `id/<slug>`, the same ids the file loader gives, so the routes and views
 * read them unchanged. `src/content.config.ts` decides which loader runs.
 *
 * Any failure stops the build, so a deploy never ships an empty blog.
 */

interface ApiText {
  title: string;
  description: string;
  body: string;
}

interface ApiPost {
  slug: string;
  published_at: string;
  author: string;
  en: ApiText;
  id: ApiText;
}

export function blogLoader(apiUrl: string): Loader {
  return {
    name: 'konstelasi-blog-api',
    async load({ store, parseData, renderMarkdown, generateDigest, logger }) {
      const base = apiUrl.replace(/\/+$/, '');
      const url = `${base}/api/posts`;

      let posts: ApiPost[];
      try {
        const res = await fetch(url, { headers: { Accept: 'application/json' } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        posts = await res.json();
      } catch (err) {
        throw new Error(`Could not load blog posts from ${url} (${(err as Error).message}). Is the blog admin running, and is BLOG_API_URL right?`);
      }
      if (!Array.isArray(posts)) throw new Error(`${url} did not return a list of posts`);

      store.clear();
      for (const post of posts) {
        for (const lang of langs) {
          const text = post[lang];
          if (!text?.title || !text.body) throw new Error(`post "${post.slug}" has no ${lang} text`);
          const id = `${lang}/${post.slug}`;
          const data = await parseData({
            id,
            data: { title: text.title, description: text.description, published: post.published_at, author: post.author },
          });
          store.set({
            id,
            data,
            body: text.body,
            rendered: await renderMarkdown(text.body),
            digest: generateDigest({ ...text, published: post.published_at, author: post.author }),
          });
        }
      }
      logger.info(`${posts.length} posts from ${base}`);
    },
  };
}
