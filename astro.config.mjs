// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import icon from 'astro-icon';

/**
 * Static output. `npm run build` writes `dist/`, a folder of plain files that
 * Apache on the cPanel host serves as is. Nothing here may need a Node runtime.
 *
 * `trailingSlash: 'always'` with `build.format: 'directory'` is functional.
 * Every route is emitted as `<route>/index.html`, which a plain file server
 * resolves through its normal index lookup. The old WordPress URLs all end in
 * a slash too, so existing links keep landing without a redirect.
 */
export default defineConfig({
  site: 'https://konstelasi.co.id',
  trailingSlash: 'always',
  build: { format: 'directory' },
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'id'],
    routing: { prefixDefaultLocale: false },
  },
  integrations: [
    icon(),
    sitemap({
      i18n: { defaultLocale: 'en', locales: { en: 'en', id: 'id' } },
      filter: (page) => !/\/404\/?$/.test(page),
    }),
  ],
});
