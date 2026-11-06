---
trigger: always_on
---

# Konstelasi Website Rules

Rules for this repository that the shared files in this folder leave open. They add to the shared rules and win on a conflict. The shared files are synced from agent-rules and never edited, so anything specific to this site goes here.

## Versioning

1. Before 1.0.0, every version is a plain `0.x.y`. Bump `x` for a change that adds or alters behaviour and `y` for a fix.
2. Never use a pre-release label (`alpha`, `beta`, `rc` or any other suffix) in a version header, a tag, a commit or a release title. `0.2.0` is followed by `0.2.1` or `0.3.0`, never by `0.2.0-alpha.1`.
3. `1.0.0` is the first version that promises stability. Stay on `0.x.y` until the maintainer says the project has reached it.

## Commits

1. Quote environment variables in backticks along with identifiers, file names and paths (`BLOG_API_URL`, `deploy.sh`, `public/.htaccess`). Text a visitor sees on the page, such as a button label or a heading, stays plain.
2. `KonstelasiBlog/` is a separate git repository nested in the project root. When one piece of work changes both, write one message per repository and never stage its files here.
3. Match the style of recent `git log` entries before writing a message.

## Writing scope

The writing guides cover all of these here, in English and in Indonesian:

- `README.md` and any other Markdown written for people.
- Page copy in `src/views/` and `src/components/`, the UI strings in `src/i18n/` and the collections in `src/content/`.
- Blog posts, the blog admin's labels and validation messages, and RSS feed text.
- Page titles, meta descriptions and OG image text.
- What `deploy.sh` and the other scripts print to the terminal.

`npm run verify:copy` enforces the dash rule across `src/`, `scripts/` and `README.md`, and the heading rule in Markdown headings, frontmatter titles and `<h1>` to `<h6>` text. Review checks the rest. Indonesian copy follows the Indonesian copy section of `CLAUDE.md`.
