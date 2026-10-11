import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { existsSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { blogLoader } from './lib/blog-loader';

/*
 * Every collection keeps one file per language under `en/` and `id/`, with
 * the same file name in both. An entry's id is therefore `en/stardust` or
 * `id/stardust`, and `src/lib/content.ts` splits it into language and slug.
 */

const products = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/products' }),
  schema: z.object({
    name: z.string(),
    order: z.number(),
    status: z.enum(['stable', 'ongoing', 'pending']),
    version: z.string(),
    /** One sentence for lists and link previews. */
    summary: z.string(),
    /** A longer opening paragraph for the product page. */
    lead: z.string(),
    source: z.url(),
    website: z.url().optional(),
    license: z.string().default('MIT'),
  }),
});

const services = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/services' }),
  schema: z.object({
    name: z.string(),
    order: z.number(),
    /** One sentence for the home page diagram and link previews. */
    summary: z.string(),
    headline: z.string(),
    intro: z.string(),
    problems: z.object({
      heading: z.string(),
      items: z.array(z.string()).min(1),
    }),
    solution: z.object({
      heading: z.string(),
      text: z.string(),
    }),
    cases: z
      .object({
        heading: z.string(),
        items: z.array(z.object({ title: z.string(), text: z.string() })).min(1),
      })
      .optional(),
    process: z.object({
      heading: z.string(),
      steps: z.array(z.object({ title: z.string(), text: z.string() })).min(1),
    }),
    closing: z.string(),
  }),
});

/**
 * Where the blog posts come from: the blog admin's API, at the live blog
 * unless `BLOG_API_URL` says otherwise, in the shell or in a local `.env`
 * (a local copy of the admin is `http://localhost:8000`). A variable set in
 * the shell wins, so `deploy.sh` decides the source of a deploy whatever
 * `.env` says. If the API cannot be reached the build stops.
 */
const LIVE_BLOG_API = 'https://blog.konstelasi.co.id';

function blogApiUrl(): string {
  if (process.env.BLOG_API_URL !== undefined) return process.env.BLOG_API_URL;
  const fromFile = existsSync('.env') ? parseEnv(readFileSync('.env', 'utf8')).BLOG_API_URL : undefined;
  return fromFile ?? LIVE_BLOG_API;
}

/** Blog posts, published at `/blog/<slug>/`, newest first on `/blog/`. */
const blog = defineCollection({
  loader: blogLoader(blogApiUrl()),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    published: z.coerce.date(),
    author: z.string(),
    /** Shared by both languages, each entry holding the name in its own. */
    tags: z.array(z.object({ slug: z.string(), name: z.string() })).default([]),
  }),
});

const legal = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/legal' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    updated: z.coerce.date(),
  }),
});

/**
 * Case studies for `src/templates/PortfolioPage.astro`. Nothing is published
 * yet, so the folder is empty and no route reads it. README.md explains how
 * to publish the first entry.
 */
const portfolio = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/portfolio' }),
  schema: z.object({
    title: z.string(),
    client: z.string(),
    year: z.number(),
    kind: z.enum(['web', 'app', 'ai', 'automation']),
    summary: z.string(),
    stack: z.array(z.string()).default([]),
    link: z.url().optional(),
  }),
});

export const collections = { products, services, blog, legal, portfolio };
