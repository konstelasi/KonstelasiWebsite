import { type Lang, htmlLang, localePath } from '../i18n';
import { posts, slugOf } from './content';
import { staticPages } from './pages';

const SITE = 'https://konstelasi.co.id';

function escape(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * The RSS feed of the blog in one language. Each item carries the post's
 * description, not its full text, so readers open the post on the site.
 */
export async function blogFeed(lang: Lang): Promise<Response> {
  const meta = staticPages['/blog/'][lang];
  const index = `${SITE}${localePath(lang, '/blog/')}`;
  const items = (await posts(lang)).map((post) => {
    const link = `${SITE}${localePath(lang, `/blog/${slugOf(post)}/`)}`;
    return `    <item>
      <title>${escape(post.data.title)}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <pubDate>${post.data.published.toUTCString()}</pubDate>
      <description>${escape(post.data.description)}</description>
    </item>`;
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escape(`${meta.title} | Konstelasi`)}</title>
    <link>${index}</link>
    <atom:link href="${index}rss.xml" rel="self" type="application/rss+xml" />
    <description>${escape(meta.description)}</description>
    <language>${htmlLang[lang]}</language>
${items.join('\n')}
  </channel>
</rss>
`;
  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
}
