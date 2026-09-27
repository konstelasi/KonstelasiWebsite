import en from './en.json';
import idStrings from './id.json';

export type Lang = 'en' | 'id';
export const langs: Lang[] = ['en', 'id'];
export const defaultLang: Lang = 'en';

export type UiStrings = typeof en;

// Typed against the English file, so `astro check` fails when the two files
// drift apart in shape (a key missing from one of them, say).
const id: UiStrings = idStrings;

const strings: Record<Lang, UiStrings> = { en, id };

export function ui(lang: Lang): UiStrings {
  return strings[lang];
}

/** BCP 47 tags for `<html lang>`, `hreflang` and `og:locale`. */
export const htmlLang: Record<Lang, string> = { en: 'en', id: 'id' };
export const ogLocale: Record<Lang, string> = { en: 'en_US', id: 'id_ID' };

/**
 * The URL of a site path in a given language. `path` is always written in
 * its English form with leading and trailing slashes, such as `/about/`.
 */
export function localePath(lang: Lang, path: string): string {
  return lang === defaultLang ? path : `/${lang}${path}`;
}

/** Strips the language prefix, giving the English form of a URL path. */
export function basePath(pathname: string): string {
  const stripped = pathname.replace(/^\/id(?=\/|$)/, '');
  return stripped === '' ? '/' : stripped;
}

export function langFromPath(pathname: string): Lang {
  return /^\/id(\/|$)/.test(pathname) ? 'id' : 'en';
}

export function otherLang(lang: Lang): Lang {
  return lang === 'en' ? 'id' : 'en';
}

const dateFormats: Record<Lang, Intl.DateTimeFormat> = {
  en: new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' }),
  id: new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' }),
};

export function formatDate(lang: Lang, date: Date): string {
  return dateFormats[lang].format(date);
}
