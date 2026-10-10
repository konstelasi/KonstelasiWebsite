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

Posts are written in the blog admin at blog.konstelasi.co.id, whose code is `KonstelasiBlog/`, a separate repository. The index is at `/blog/` and each post at `/blog/<slug>/`, with the Indonesian pages under `/id/blog/`. Every post has both languages, because every page on the site exists in both. Each language has an RSS feed, `/blog/rss.xml` and `/id/blog/rss.xml`, which the old WordPress feed addresses redirect to.

### Publishing a post

Sign in at `https://blog.konstelasi.co.id/admin`, write the post in both languages and publish it. That is all. The pages are static files, so the site has to be rebuilt to show a change, and the admin does that by itself: saving, publishing, unpublishing or deleting a published post asks GitHub to run the **Deploy** workflow. It builds the site from the blog's API and uploads it, the same as `bash deploy.sh` on a laptop, and the change is live about two or three minutes later. Progress is in the repository's Actions tab, and GitHub emails the repository admins if a run fails.

Edits to a draft change nothing public, so they start no rebuild. Several saves in a row cost at most two builds, because a run that is waiting replaces the one before it.

A push to `main` deploys the same way, so pushing code is the one press and needs no SSH passphrase. A push that changes only Markdown files deploys nothing. Work that is not ready for the live site belongs on another branch until it is merged. You can still deploy by hand with `bash deploy.sh`, or press Run workflow on the Deploy workflow in the Actions tab. If the blog's API cannot be reached, the build stops and nothing is uploaded, so the site never ships without its posts. A post's slug is its address, and it locks once the post is published.

### Setting the automatic rebuild up

The workflow is `.github/workflows/deploy.yml`. It needs five repository secrets (`DEPLOY_SSH_HOST`, `DEPLOY_SSH_PORT`, `DEPLOY_SSH_USER`, `DEPLOY_SSH_KEY` and `DEPLOY_KNOWN_HOSTS`), which `scripts/setup-ci-deploy.sh` creates with a new SSH key used only by GitHub. The blog's host `.env` needs `GITHUB_DISPATCH_TOKEN`, a fine-grained GitHub token that has only Actions read and write access on this repository. Both are one time steps.

### Previewing against a local admin

By default the build and the dev server read the live blog. To preview posts from a local copy of the admin instead, set `BLOG_API_URL` in a `.env` file at the root of this repository (or in the shell), and keep `php artisan serve` running in `KonstelasiBlog/`.

```
BLOG_API_URL=http://localhost:8000
```

The dev server reads the posts once when it starts. After editing a post in the admin, type `s` and press Enter in the terminal running `npm run dev` to load them again. `deploy.sh` ignores this setting and always builds from the live blog.

## Kept but not published

The **portfolio** has a template, `src/templates/PortfolioPage.astro`, and a `portfolio` collection with no entries. To publish the first case study:

1. Add `src/content/portfolio/en/<slug>.md` and its Indonesian twin `src/content/portfolio/id/<slug>.md`, with the frontmatter that `src/content.config.ts` describes.
2. Add `src/pages/portfolio/[slug].astro` and `src/pages/id/portfolio/[slug].astro`. They work like the product routes in `src/pages/software/`, rendering the template instead of a view.
3. Add the pages to `src/lib/og-pages.ts`, and link to them from Labs or the home page.

## Old URLs

The old WordPress site used the same paths for most pages, so they carry over unchanged. The ones that moved are redirected with a 301 in `public/.htaccess`, which Apache reads on the host.

`www.konstelasi.co.id` redirects to `konstelasi.co.id` with a 301 and keeps the path, so search engines see one address for every page.

The blog kept its `/blog/` address and its post slugs. WordPress put the date in a post's URL, such as `/2025/12/24/<slug>/`, so each old post has a rule that sends it to `/blog/<slug>/`, and `/category/blog/` goes to `/blog/`.

## Deploying

`deploy.sh` builds the site, runs the four `verify:` checks on the result, uploads it over SSH and unpacks it on the host. It reads the host, port, user and key from a `konstelasi` alias in your own `~/.ssh/config`, so no credential lives in this repository.

```bash
bash deploy.sh          # production: public_html, the main domain's document root
bash deploy.sh staging  # the staging subdomain, kept out of search engines
```

The script unlocks your SSH key itself, asking for the passphrase once per run, so a fresh terminal needs nothing else. If you have no `konstelasi` alias, put `export DEPLOY_HOST=<your alias>` in `~/.bashrc` once. On Windows, run it from Git Bash, because `npm run deploy` may find the WSL `bash.exe` first.

Production deploys into `public_html`, because the main domain's document root is fixed there. `deploy.sh` refuses to run while a WordPress `wp-config.php` is still in the target folder, so a build can never be unpacked over an old install.

Before unpacking, the script clears `_astro/`, `blog/`, `id/blog/` and `og/` in the target folder, because the build writes every file in them. That is how a post that is set back to draft or deleted in the blog admin disappears from the site, instead of staying online as an old page. Anything else in the folder is left alone, so keep hand-placed files out of those four.
