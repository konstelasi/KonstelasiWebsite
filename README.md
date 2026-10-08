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
npm run verify:budget     # gzipped JavaScript per page against its budget
```

`verify:links` and `verify:budget` read the built site, so run `npm run build` first. The build prints two warnings that are expected: the portfolio collection has no entries yet, and there is no `src/icons/` folder because every icon comes from Lucide.

## How it's put together

English lives at the root and Indonesian under `/id/`, and every page exists in both. A route file in `src/pages/` only picks a language and renders a view from `src/views/`, where the page's copy sits in both languages side by side.

Products, services and the Konstelasi Chat privacy policy are Markdown files in `src/content/`, one per language, with the same file name in `en/` and `id/`. The product and service pages share one template each, and every page draws its own diagram from `src/components/diagrams/`. Shared interface text (navigation, footer, the theme and language switches) is in `src/i18n/`.

Colours are tokens in `src/styles/tokens.css`, defined for the light and the dark theme. The site follows the visitor's system setting until they use the toggle, and the choice is remembered in the browser.

Link preview images are drawn at build time by `src/pages/og/[lang]/[name].png.ts`. The list of pages they're drawn for is `src/lib/og-pages.ts`, so a new page needs an entry there. The favicons are made from the logo by `node scripts/gen-icons.mjs`, which only needs rerunning if the logo changes.

## Motion

The site is built around one idea, a living constellation. A WebGL star field sits behind every page, drifting with the scroll and leaning toward the pointer. On the home page it assembles into the Konstelasi mark, breaks apart as you scroll, and regroups into the services system while that section is pinned. The 404 page draws its number in stars that scatter from the pointer.

Around it, GSAP drives the rest. Headings enter by line, word or letter, the products orbit the mark, a comet runs down the essay, diagrams build with the scroll, packets of data cross the service diagrams, and the values on About slide past as a pinned strip. Lenis smooths the scrolling on mouse and trackpad.

Visitors who ask their system for reduced motion get a still site with every drawing in its finished state, and the same happens without JavaScript. Without WebGL, the SVG versions of the home drawings take over. The code is in `src/motion/` for the shared parts, and in a `*-motion.ts` file next to each page or component for the rest.

## Blog

Posts are Markdown files in `src/content/blog/`, one per language under `en/` and `id/` with the same file name. The index is at `/blog/` and each post at `/blog/<slug>/`, with the Indonesian pages under `/id/blog/`. A new post needs both files before it can be published, because every page on the site exists in both languages. Each language has an RSS feed, `/blog/rss.xml` and `/id/blog/rss.xml`, which the old WordPress feed addresses redirect to.

The posts will move into the blog admin in `KonstelasiBlog/`, a separate repository at blog.konstelasi.co.id. Until it is live the Markdown files are the source, and `deploy.sh` always builds from them.

To preview posts from a local copy of the admin, set `BLOG_API_URL` in a `.env` file at the root of this repository (or in the shell), and keep `php artisan serve` running in `KonstelasiBlog/`.

```
BLOG_API_URL=http://localhost:8000
```

The dev server reads the posts once when it starts. After editing a post in the admin, type `s` and press Enter in the terminal running `npm run dev` to load them again. Remove the line to go back to the Markdown files.

## Kept but not published

The **portfolio** has a template, `src/templates/PortfolioPage.astro`, and a `portfolio` collection with no entries. To publish the first case study:

1. Add `src/content/portfolio/en/<slug>.md` and its Indonesian twin `src/content/portfolio/id/<slug>.md`, with the frontmatter that `src/content.config.ts` describes.
2. Add `src/pages/portfolio/[slug].astro` and `src/pages/id/portfolio/[slug].astro`. They work like the product routes in `src/pages/software/`, rendering the template instead of a view.
3. Add the pages to `src/lib/og-pages.ts`, and link to them from Labs or the home page.

## Old URLs

The old WordPress site used the same paths for most pages, so they carry over unchanged. The ones that moved are redirected with a 301 in `public/.htaccess`, which Apache reads on the host.

The blog kept its `/blog/` address and its post slugs. WordPress put the date in a post's URL, such as `/2025/12/24/<slug>/`, so each old post has a rule that sends it to `/blog/<slug>/`, and `/category/blog/` goes to `/blog/`.

## Deploying

`deploy.sh` builds the site, runs the four `verify:` checks on the result, uploads it over SSH and unpacks it on the host. It reads the host, port, user and key from a `konstelasi` alias in your own `~/.ssh/config`, so no credential lives in this repository.

```bash
bash deploy.sh             # staging, kept out of search engines
bash deploy.sh production  # public_html, the main domain's document root
```

Set `DEPLOY_HOST` to use a different alias from `~/.ssh/config`. On Windows, run it from Git Bash, because `npm run deploy` may find the WSL `bash.exe` first.

Production deploys into `public_html`, because the main domain's document root is fixed there. `deploy.sh` refuses to run while a WordPress `wp-config.php` is still in the target folder, so a build can never be unpacked over an old install.
