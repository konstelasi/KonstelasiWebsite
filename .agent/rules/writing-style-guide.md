---
trigger: always_on
---

# Writing Style Guide

How text is written across this site and its blog. The goal is text that reads as if a person wrote it, because a reader who spots machine-written patterns stops trusting the content behind them.

## Scope

This guide covers every text a person reads:

- `README.md` and any other Markdown document written for people.
- Page copy in `src/views/` and `src/components/`, the shared UI strings in `src/i18n/`, and the content collections in `src/content/`.
- Blog posts, the blog admin's labels and validation messages, and RSS feed text.
- Page titles, meta descriptions and OG image text.
- Code comments and docblocks.
- Commit messages, which also follow [commit-style-guide.md](commit-style-guide.md).
- What `deploy.sh` and the other scripts print to the terminal.
- Release notes, the changelog (see [changelog-guide.md](changelog-guide.md)), social posts, and video scripts and their on-screen text.

It applies in every language the text is published in, Indonesian included.

It does **not** cover files written for AI agents. That means every `CLAUDE.md`, `AGENTS.md` and this `.agent/rules/` directory. Those stay optimised for agents, so the patterns below are fine there.

Code is always exempt, wherever it appears. That includes identifiers, signatures, commands, SQL, JSON, YAML and anything inside backticks.

## Banned

`npm run verify:copy` enforces the dash rule across `src/`, `scripts/` and `README.md`, and the heading rule in Markdown headings, frontmatter titles and `<h1>` to `<h6>` text. The other rules are checked by review.

These are strong signals of machine-written text. Don't use them in covered text.

### The em dash and the en dash

Never use `—` (em dash) or `–` (en dash). Pick whichever of these fits the sentence:

- Split it into two sentences.
- Use a comma.
- Put the aside in parentheses.
- Name the relationship with a word such as "so", "because", "which means" or "with".

| Instead of | Write |
| :-- | :-- |
| Static pages, rebuilt on every publish — no server to patch, no cache to warm. | Static pages, rebuilt on every publish, with no server to patch and no cache to warm. |
| Posts come from the API — the build stops if it is down. | The build stops if the API is down, because posts come from it. |
| Open Monday–Friday | Open Monday to Friday |

The ordinary hyphen `-` is not affected. Hyphenated words such as "end-to-end", "on-screen", "read-only" and "multi-worker" stay as they are. A hyphen standing in for a dash, as in "pages - no server" or "pages -- no server", is the same pattern and is banned too.

An empty table cell stays empty or says "n/a". It never holds a dash.

### Colons and semicolons in headings and titles

A heading, page title, release title, slide title, video title or post title never contains `:` or `;`. People keep titles clean, and a split "Name: subtitle" title is one of the most recognisable machine patterns.

| Instead of | Write |
| :-- | :-- |
| Our Services: Software and Cloud | Software and cloud services |
| Deployments: How They Work | How deployments work |

### Colons anywhere in social posts and video

LinkedIn and other social copy, video narration and on-screen video text don't use colons at all, prose included. Those channels have a stricter rule than everything else.

## Use sparingly

These are normal in human writing too, so they're not banned. Reach for something else first.

### Colons in prose

A colon that introduces a list or explanation in the middle of a paragraph is acceptable, but a full stop usually reads better.

| Instead of | Write |
| :-- | :-- |
| A minimal publishing walkthrough: write the post, add both languages, pick the tags, save, and wait for the rebuild. | This walkthrough goes from an empty draft to a live post. You'll write the post, add both languages, pick the tags, then save and wait for the rebuild. |

Structural colons are fine. That covers `key: value` in a config example, a time such as 14:30, and a ratio such as 80:20. Before a code block, prefer a sentence ending in a full stop ("Run the build once.") over one ending in a colon.

### Semicolons

Use two sentences, or join the clauses with a word.

| Instead of | Write |
| :-- | :-- |
| The loader reads posts from the API; a dead API stops the build; a missing `tags` field counts as none. | The loader reads posts from the API. A dead API stops the build, and a missing `tags` field counts as none. |

## Patterns to avoid

Each of these is fine once. Repeated, or all together, they make text read as generated. None is banned.

- **A bold label and a colon on every bullet.** One or two items with a bold lead is fine. A whole list shaped like that reads as a template. Write the bullet as a sentence instead, or put the term in bold inside it.
- **"Not just X, it's Y" and "not X, but Y"** used as a hook.
- **Lists of exactly three** ("fast, safe, and simple") when the real count is two or four.
- **Filler openers** such as "It's worth noting that", "Note that", "Here's the thing", "Let's dive in", "In summary".
- **Emoji** in headings or as bullet markers.
- **A summary sentence at the end of every paragraph** that restates what the paragraph just said.
- **Stacked hedging** ("may potentially", "can generally help to").
- **Perfectly parallel bullets**, all the same length and shape.
- **"Whether you're X or Y"** openers.

### Overclaiming and inflated words

A strong claim is a legitimate marketing tool, and one well-placed overclaim is fine. Overuse is what reads as generated text. Watch for two shapes in particular:

- **The stacked slogan.** Two or more overclaims packed into one line, such as "Blazing-fast hosting with unparalleled reliability". This is the formula to avoid.
- **One in every sentence.** If each sentence carries its own superlative, none of them lands.

Use one where it matters most, and let a concrete fact sit right beside it. The words below are the ones to count. Like everything in this section, any of them is fine once and a problem when it becomes a habit.

- **Overclaims.** Unparalleled, unprecedented, unmatched, unrivalled, revolutionary, groundbreaking, game-changing, game-changer, cutting-edge, state-of-the-art, next-generation, best-in-class, world-class, industry-leading, enterprise-grade, bulletproof, blazing fast, lightning-fast, effortless, ultimate, perfect, flawless, limitless, infinitely.
- **Words generated text reaches for.** Delve, seamless, seamlessly, robust, powerful, leverage, comprehensive, unlock, empower, elevate, supercharge, harness, streamline, transformative, holistic, pivotal, crucial, paramount, myriad, plethora, tapestry, landscape, realm, journey, "in today's fast-paced world".

| Instead of | Write |
| :-- | :-- |
| Blazing-fast pages with unparalleled reliability. | Every page is a plain file served by Apache, so a post goes live about 45 seconds after you save it. |

## Voice

- **About 80% formal and 20% conversational.** Think of a well-written post by an engineer explaining their own project. Address the reader as "you", use contractions where they read naturally, and say "we" when speaking as the company.
- **Adjust by text type.** Page copy, blog posts and social posts sit at the conversational end of that range. The README, error messages and the policy page sit nearer fully formal. Code comments are plain and short and say why rather than what. Commit messages are brief (see [commit-style-guide.md](commit-style-guide.md)).
- **Vary the rhythm.** Mix long sentences with short ones. Don't give every section the same intro, bullets and wrap-up shape. Mix prose with lists instead of turning everything into bullets. A little unevenness is what makes text read as human.
- **Never introduce errors on purpose.** Variation means sentence length, structure and punctuation choices. It never means typos or broken grammar.
- **Error and validation messages** say what happened and, where it helps, what to do next, in one or two plain sentences.
- **Indonesian copy** is composed natively and never translated word by word. See the Indonesian copy section of `CLAUDE.md`.

## Before handing text over

1. Search the changed text for `—` and `–`, and for a spaced hyphen used as a dash. There should be none.
2. Check every heading and title for `:` and `;`.
3. Look at each semicolon and each colon in prose, and rewrite it unless it's clearly the best choice.
4. Skim "Patterns to avoid" and the overclaim list against the draft.
5. Read the draft as its reader would. If any part sounds like a template, rewrite it.
