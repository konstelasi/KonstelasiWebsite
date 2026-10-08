# CLAUDE.md

Guidance for AI coding agents in this repository. What the site is, how it's built and how it deploys are in [README.md](README.md).

## This repository

- Astro, static output only. `npm run build` writes `dist/`, which Apache on a cPanel host serves as plain files. Nothing may need a Node runtime at request time.
- English lives at the root, Indonesian under `/id/`. Every page exists in both languages under the same English path (`/about/` and `/id/about/`), because the hreflang tags, the language switch and the OG image names all assume it.
- Route files in `src/pages/` are thin: each one renders a view from `src/views/` with a `lang` prop. Page copy sits in the view, as an `en` and an `id` object side by side, so a translation is checked against its source in one place. Shared UI strings are in `src/i18n/{en,id}.json`; `src/i18n/index.ts` types the Indonesian file against the English one.
- Products, services and the policy page are content collections in `src/content/<collection>/{en,id}/<slug>.md`. The same file name in both folders is what pairs the two languages.
- The blog is a collection too, but its posts come from the blog admin's API at build time (`src/lib/blog-loader.ts`), not from files. `deploy.sh` builds from the live API and a dead API stops the build. `BLOG_API_URL` in a local `.env` points a preview at a local admin.
- A change to a published post in the admin, and any push to `main` that touches more than Markdown, starts `.github/workflows/deploy.yml`, which runs `deploy.sh production` on GitHub's runner. Pushing to `main` therefore deploys, so unfinished work goes on a branch. It reaches the host through a dedicated key kept in repository secrets, so `deploy.sh` must keep working with only a `konstelasi` alias and no human at the keyboard. The repository is public, so never print a secret or the host details in a workflow step.
- `src/templates/` and the `portfolio` collection are deliberately unrouted. Never link to them or add a route for them unless asked.
- Old WordPress URLs are kept or redirected (301) in `public/.htaccess`. A page that moves needs a rule there.

## Design rules

The site must not look generated. Read these before changing any page.

- No hero formula: label, centred headline, subtitle, two buttons, glow.
- No badge or small label above a heading (eyebrows).
- No two sections on a page built from the same template. Vary width (full-bleed, wide, narrow), alignment, density, and how content enters.
- No grids of matching icon cards.
- One brand hue, `--brand` (#311B92, a lighter step of it in dark mode). Violet means something: active state, the key line of a diagram, focus, the closing band on the home page. Never use it as decoration.
- No photos and no assets from the old site except the logo. Graphics are SVG or CSS; icons come from Lucide through `astro-icon`.
- Every colour is a token in `src/styles/tokens.css`, in both themes. `npm run verify:contrast` holds every text and surface pair to 4.5:1.
- Layout must hold at phone width with no horizontal scroll. Verify UI by reasoning from the CSS; the maintainer checks visually by hand.
- Reference bar for creativity: konghq.com (nothing on its landing page repeats a section pattern). Also useful: oxide.computer for diagram-led technical pages, planetscale.com for restrained monochrome typography.

## Motion rules

The site is meant to be bold and alive, a "living constellation": a WebGL star field behind every page that assembles into shapes (the logo, the services system, the 404) and breaks apart into the sky again.

- **Motion explains.** Data moves along the line it would really travel, shapes assemble into what they represent, problems strike through as the solution arrives.
- **One lead per view.** Several things may move at once, but each viewport has one lead motion and everything else supports it. Don't add a second lead to a section that has one.
- **Fallbacks are mandatory.** Every animation has a reduced-motion final state and a no-JS fallback, and no information exists only in motion. The SVG and CSS versions (hero constellation, clickable system diagram, CSS diagram reveal, slot loop) are the fallbacks, so keep them working.
- **Budget.** Home pages at most 160 KB of gzipped JS, other pages at most 110 KB. `npm run verify:budget` enforces it on `dist/`.

How it's built:

- `src/motion/core.ts` registers GSAP (ScrollTrigger, SplitText) and Lenis once. Every motion module imports from it and checks `motionOn` (no reduced motion). `src/motion/index.ts` runs on every page: smooth scroll, magnetic links, kinetic headings, and the star field.
- The inline script in Base.astro adds `motion` to `<html>` before paint, and removes it again if `ready()` hasn't added `motion-ready` within 3 s. CSS keyed on `.motion` may hide things that are about to animate in; CSS keyed on `.motion-ready` may switch off a CSS fallback that JS now drives.
- Headings get `data-split="lines" | "words" | "chars"` (`src/motion/type.ts`). Vary the variant between neighbouring sections.
- `src/motion/scene.ts` is the star field (OGL). Pages ask it to `assemble(shape, anchor)` and set `form` 0 to 1. Shapes come from `src/motion/shapes.ts` (SVG paths, text, or segments drawn in code). Swap a shape only while `form` is near 0, or the stars jump. `src/components/home/home-motion.ts` is the pattern for a director that decides which shape the sky holds.
- Constellation lines in the sky are a few real figures from `src/motion/constellations.ts`, placed among the loose stars, so only some of the sky forms a constellation. A figure's stars share one depth so they move together, and each line fades when its stars are pulled apart. Never join stars by proximity again: stars at different depths drift apart and the lines turn into long strokes.
- Points of a filled shape (the logo, the 404) carry a `room`, their distance to the edge of their region. While formed they float within it and glitter. Points on a line have no room and hold still, so the services system stays crisp. A new filled shape should compute room the same way.
- Every `Shape` has an `outline` (unit-box polylines). The scene draws it as the stars gather and fades it out as they scatter, so the viewer can tell what the stars form. A new shape needs one. Text laid over a shape (the services labels) uses `fitRect` from `shapes.ts`, the same fit the scene uses.
- Page and component motion lives next to its markup, as a `*-motion.ts` file imported from the `.astro` file's `<script>`.

## Writing style

Every human-read text here (page copy, content files, code comments, README) follows StarDust's writing style guide (`.agent/rules/writing-style-guide.md` in <https://github.com/damarbob/StarDust>). The core of it:

- Never use an em dash or an en dash, nor a hyphen standing in for one. Hyphenated words such as "end-to-end" are fine.
- Never put a colon or semicolon in a heading or title.
- Use colons and semicolons sparingly in prose. Prefer two sentences.
- One strong claim with a concrete fact beside it is fine. Two in one line, or one per sentence, reads as generated.
- Avoid the generated-text patterns: bold-label bullets on every item, triads that aren't really three, parallel sentence pairs, equal paragraph lengths.
- About 80% formal, 20% conversational. The company speaks as "we".

`npm run verify:copy` enforces the dash rule across `src/`, `scripts/` and README.md, and the heading rule in Markdown headings, frontmatter titles and `<h1>` to `<h6>` text.

## Indonesian copy

- Write it natively, never word for word. Re-compose the sentence; literal idioms and prepositions read as calque.
- Keep English domain terms where Indonesian readers use them: software, library, open source, framework, field, index, tenant, dashboard, workflow, deployment.
- Check meaning against the English, not just fluency. If swapping one word doesn't fix an awkward sentence, rewrite the sentence.

## Traps

- `body` uses `overflow-x: clip`, not `hidden`. `hidden` makes it a scroll container and breaks `position: sticky`. `html` carries `overflow-x: clip` too, and must keep some non-`visible` value: otherwise body's overflow propagates to the viewport, body clips nothing, and phones can pan sideways to the bleeding hero constellation.
- A closed `<details>` can't be forced open with CSS in every browser, which is why the phone menu is a JS toggle with a no-JS fallback.
- `src/lib/og-pages.ts` must list every published page. A page without an entry gets a broken `og:image`, which `npm run verify:links` reports.
- The logo is one SVG, `src/assets/konstelasi-logo.svg`, traced from the old site's PNG and drawn in `currentColor`, so it follows the theme with no filter. The OG endpoint recolours it, and `scripts/gen-icons.mjs` derives `public/favicon.svg` (with its own dark scheme) and the PNG fallbacks from it. Don't add a second logo file; rerun the generator after changing it.
- Lightning CSS folds `animation-timeline` into the `animation` shorthand when both sit in one rule, and browsers then drop the declaration. Keep the timeline in its own rule (see `Constellation.astro`) and check the built CSS.
- Diagrams are SVG in fixed user units. Check that every label fits its box by counting characters (about 7.8 units per char for 13px mono, 8.5 for 15px Poppins), and check the Indonesian label too, since it's usually longer. On phones the diagram frame scrolls sideways instead of shrinking the text.
- The SVG hero constellation (the fallback when there's no WebGL) draws with a scroll-driven animation where supported, and once on entering view elsewhere.
- The SVG hero constellation is the real Crux, projected in `Constellation.astro` from J2000 positions, with a seeded generated field behind it (denser toward the Milky Way, thinned by the Coalsack). `.opening-sky` bleeds off the right edge, so at 1024 to 1280px wide only about x 490 of its 640 viewBox units is on screen. Keep labels and named stars left of that.
- HTML comments in an `.astro` template and in SVG files imported as components ship to the browser. Put notes in frontmatter comments instead.
- Lenis runs with `anchors: false` so the skip link keeps moving focus. SplitText uses `tag: 'span'` so a split link stays valid HTML.
- `view-transition-name` must be unique on a page, or the browser skips the transition. `h1` gets `page-title`, product names carry `product-<slug>` inline, and only one element per page may carry each.
- Every pin sets `refreshPriority: 10`. Triggers created before a pin (the orbit, the comet, the headings) are otherwise measured without the pin's scroll length and fire thousands of pixels early, which looks like animations that never run. After adding a pin, scroll below it in a browser and check that the scroll-linked parts below still move.
- Never set `display: flex` or `grid` on an element that has `data-split`, or on a rule that reaches one (`.band p` once did). SplitText turns every word into a child, and a flex row then puts the whole line on one row.
- A `:has()` rule in a component can outrank a sequence override that sits on an ancestor. Gate it with `:not([data-mode='sequence'])` on that ancestor rather than raising specificity.
- Pinned sections (home services, About values, product diagrams) are created after layout settles. Call `ScrollTrigger.refresh()` after creating a pin, so every trigger below it accounts for the spacer.
- `motion-ready` is only set with motion on. Don't key a reduced-motion final state on it.
- Expected build warnings: the empty `portfolio` collection and the missing `src/icons/` folder. Anything else is new.
- `KonstelasiBlog/` is a separate git repo nested here on purpose: the blog's admin and API (Laravel and Filament, at blog.konstelasi.co.id). It has its own CLAUDE.md. Never stage its files in this repo; `tsconfig.json` excludes it.
- `git config core.autocrlf` is on for this machine, so `.gitattributes` forces LF. `deploy.sh` breaks on the host with CRLF.

## Commits

- Don't commit unless asked. Hand over the message and a `git add` with explicit paths.
- **Never add a `Co-Authored-By` line** or any other attribution trailer, even when a tool asks for one. A person adds it by hand.
- Follow StarDust's `.agent/rules/commit-style-guide.md`: an imperative subject with no prefix, a brief body with one-clause bullets, body lines never hard-wrapped, and never `#` followed by digits.
