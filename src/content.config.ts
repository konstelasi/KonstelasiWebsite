import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

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
 * Blog posts carried over from the old site. Like the portfolio, they are
 * kept but not published: no route reads them and nothing links to them
 * until the blog is built.
 */
const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    published: z.coerce.date(),
    author: z.string(),
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
