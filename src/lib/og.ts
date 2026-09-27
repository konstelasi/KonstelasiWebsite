import type { Lang } from '../i18n';

/**
 * Where the generated link-preview image of a page lives. `path` is the
 * page's English URL path, so `/software/stardust/` in Indonesian becomes
 * `/og/id/software-stardust.png`. `src/pages/og/[lang]/[name].png.ts` writes
 * the files under the same names.
 */
export function ogImagePath(lang: Lang, path: string): string {
  return `/og/${lang}/${ogName(path)}.png`;
}

export function ogName(path: string): string {
  const trimmed = path.replace(/^\/+|\/+$/g, '');
  return trimmed === '' ? 'home' : trimmed.replace(/\//g, '-');
}
