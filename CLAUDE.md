# CLAUDE.md

Guidance for AI coding agents in this repository. What the site is, how it's built and how it deploys are in [README.md](README.md).

## This repository

- Astro, static output only. `npm run build` writes `dist/`, which Apache on a cPanel host serves as plain files. Nothing may need a Node runtime at request time.
- English lives at the root, Indonesian under `/id/`. Every page exists in both languages under the same English path (`/about/` and `/id/about/`), because the hreflang tags, the language switch and the OG image names all assume it.
- Route files in `src/pages/` are thin: each one renders a view from `src/views/` with a `lang` prop. Page copy sits in the view, as an `en` and an `id` object side by side, so a translation is checked against its source in one place. Shared UI strings are in `src/i18n/{en,id}.json`; `src/i18n/index.ts` types the Indonesian file against the English one.
- Products, services, the policy page and the (unpublished) blog are content collections in `src/content/<collection>/{en,id}/<slug>.md`. The same file name in both folders is what pairs the two languages.
- `src/templates/` and the `portfolio` and `blog` collections are deliberately unrouted. Never link to them or add a route for them unless asked.
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
- Motion is functional (diagrams that build, lines that connect, values that move into place). At most one thing moves on screen without being triggered, which is the StarDust slot animation on the home page. Everything else plays once and settles. `prefers-reduced-motion` must show the final state, and no information may exist only in an animation.
- Layout must hold at phone width with no horizontal scroll. Verify UI by reasoning from the CSS; the maintainer checks visually by hand.
- Reference bar for creativity: konghq.com (nothing on its landing page repeats a section pattern). Also useful: oxide.computer for diagram-led technical pages, planetscale.com for restrained monochrome typography.

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

- `body` uses `overflow-x: clip`, not `hidden`. `hidden` makes it a scroll container and breaks `position: sticky`.
- A closed `<details>` can't be forced open with CSS in every browser, which is why the phone menu is a JS toggle with a no-JS fallback.
- `src/lib/og-pages.ts` must list every published page. A page without an entry gets a broken `og:image`, which `npm run verify:links` reports.
- The logo is one SVG, `src/assets/konstelasi-logo.svg`, traced from the old site's PNG and drawn in `currentColor`, so it follows the theme with no filter. The OG endpoint recolours it, and `scripts/gen-icons.mjs` derives `public/favicon.svg` (with its own dark scheme) and the PNG fallbacks from it. Don't add a second logo file; rerun the generator after changing it.
- Lightning CSS folds `animation-timeline` into the `animation` shorthand when both sit in one rule, and browsers then drop the declaration. Keep the timeline in its own rule (see `Constellation.astro`) and check the built CSS.
- Diagrams are SVG in fixed user units. Check that every label fits its box by counting characters (about 7.8 units per char for 13px mono, 8.5 for 15px Poppins), and check the Indonesian label too, since it's usually longer. On phones the diagram frame scrolls sideways instead of shrinking the text.
- The home page constellation draws with a scroll-driven animation where supported, and once on entering view elsewhere. The StarDust slot animation is the one autonomous loop; don't add a second.
- Expected build warnings: the empty `portfolio` collection and the missing `src/icons/` folder. Anything else is new.
- The blog posts are content without a route, deliberately. The old blog URLs are not redirected yet either; see README.md "Old URLs".
- `git config core.autocrlf` is on for this machine, so `.gitattributes` forces LF. `deploy.sh` breaks on the host with CRLF.

## Commits

- Don't commit unless asked. Hand over the message and a `git add` with explicit paths.
- **Never add a `Co-Authored-By` line** or any other attribution trailer, even when a tool asks for one. A person adds it by hand.
- Follow StarDust's `.agent/rules/commit-style-guide.md`: an imperative subject with no prefix, a brief body with one-clause bullets, body lines never hard-wrapped, and never `#` followed by digits.
