# Konstelasi website

The company site at [konstelasi.co.id](https://konstelasi.co.id), in English and Indonesian. It's a static site built with [Astro](https://astro.build), so the server only ever sends plain files.

## Running it

You need Node 22.12 or later.

```bash
npm install
npm run dev        # local server at http://localhost:4321
npm run build      # static output in dist/
npm run preview    # serve dist/ to check the real build
```

Before handing over a change, run the checks.

```bash
npm run check             # Astro and TypeScript diagnostics
npm run verify:contrast   # every text colour against every surface, both themes
npm run verify:copy       # dashes, and colons in headings and titles
npm run verify:links      # internal links, preview images and hreflang pairs
```

`verify:links` reads the built site, so run `npm run build` first. The build prints two warnings that are expected: the portfolio collection has no entries yet, and there is no `src/icons/` folder because every icon comes from Lucide.

## How it's put together

English lives at the root and Indonesian under `/id/`, and every page exists in both. A route file in `src/pages/` only picks a language and renders a view from `src/views/`, where the page's copy sits in both languages side by side.

Products, services and the Konstelasi Chat privacy policy are Markdown files in `src/content/`, one per language, with the same file name in `en/` and `id/`. The product and service pages share one template each, and every page draws its own diagram from `src/components/diagrams/`. Shared interface text (navigation, footer, the theme and language switches) is in `src/i18n/`.

Colours are tokens in `src/styles/tokens.css`, defined for the light and the dark theme. The site follows the visitor's system setting until they use the toggle, and the choice is remembered in the browser.

Link preview images are drawn at build time by `src/pages/og/[lang]/[name].png.ts`. The list of pages they're drawn for is `src/lib/og-pages.ts`, so a new page needs an entry there. The favicons are made from the logo by `node scripts/gen-icons.mjs`, which only needs rerunning if the logo changes.

## Kept but not published

Two parts of the site are written but have no route yet.

The **blog** posts from the old site are in `src/content/blog/`, in both languages. Nothing links to them and no page renders them until the blog itself is built.

The **portfolio** has a template, `src/templates/PortfolioPage.astro`, and a `portfolio` collection with no entries. To publish the first case study:

1. Add `src/content/portfolio/en/<slug>.md` and its Indonesian twin `src/content/portfolio/id/<slug>.md`, with the frontmatter that `src/content.config.ts` describes.
2. Add `src/pages/portfolio/[slug].astro` and `src/pages/id/portfolio/[slug].astro`. They work like the product routes in `src/pages/software/`, rendering the template instead of a view.
3. Add the pages to `src/lib/og-pages.ts`, and link to them from Labs or the home page.

## Old URLs

The old WordPress site used the same paths for most pages, so they carry over unchanged. The ones that moved are redirected with a 301 in `public/.htaccess`, which Apache reads on the host.

The old blog addresses (`/blog/`, `/category/blog/` and the two dated post URLs) are not redirected yet, because the blog isn't published. They need a rule, or the new blog, before the main domain switches over.

## Deploying

`deploy.sh` builds the site, uploads it over SSH and unpacks it on the host. It reads the host, port, user and key from a `konstelasi` alias in your own `~/.ssh/config`, so no credential lives in this repository.

```bash
bash deploy.sh             # staging, kept out of search engines
bash deploy.sh production  # the folder the main domain will point at
```

On Windows, run it from Git Bash, because `npm run deploy` may find the WSL `bash.exe` first. The main domain only switches to the production folder once staging has been checked, with the WordPress files and database backed up and left in place.
