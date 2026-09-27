import type { Lang } from '../i18n';

/**
 * Title and description of each page that isn't built from a collection.
 * The views read their `<title>` from here, and the OG image endpoint draws
 * from the same list, so the two can't disagree.
 */
export interface PageMeta {
  title: string;
  description: string;
}

export const staticPages: Record<string, Record<Lang, PageMeta>> = {
  '/': {
    en: {
      title: 'Konstelasi, software and AI from Yogyakarta',
      description: 'We build custom web and mobile apps, automate the work between your tools, and set up private AI that answers from your own data.',
    },
    id: {
      title: 'Konstelasi, software dan AI dari Yogyakarta',
      description: 'Kami membangun aplikasi web dan mobile custom, mengotomatiskan pekerjaan di antara alat-alat Anda, dan memasang AI privat yang menjawab dari data Anda sendiri.',
    },
  },
  '/about/': {
    en: {
      title: 'About us',
      description: 'Who we are, what we believe in, and the people behind Konstelasi.',
    },
    id: {
      title: 'Tentang kami',
      description: 'Siapa kami, apa yang kami pegang, dan orang-orang di balik Konstelasi.',
    },
  },
  '/labs/': {
    en: {
      title: 'Labs',
      description: 'Our research, our open-source work, and the software we build for ourselves first.',
    },
    id: {
      title: 'Labs',
      description: 'Riset kami, karya open source kami, dan software yang pertama-tama kami bangun untuk diri sendiri.',
    },
  },
  '/contact-us/': {
    en: {
      title: 'Contact',
      description: 'Email, phone and WhatsApp details for Konstelasi in Yogyakarta, with our working hours.',
    },
    id: {
      title: 'Kontak',
      description: 'Email, telepon, dan WhatsApp Konstelasi di Yogyakarta, beserta jam kerja kami.',
    },
  },
};
