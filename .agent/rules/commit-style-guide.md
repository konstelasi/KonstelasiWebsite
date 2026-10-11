---
trigger: always_on
---

# Commit Message Style Guide

This project follows a specific style for commit messages to ensure history is readable and consistent.

## Structure

```text
<Subject>

<Body>
```

## Subject Line

1. **Imperative Mood**: Use imperative verbs (e.g., "Update", "Fix", "Add", "Remove", "Refactor"), not past tense ("Updated") or present progressive ("Updating").
   - _Good_: "Refactor error handling in the blog loader"
   - _Bad_: "Refactored error handling"
2. **Capitalization**: Capitalize the first letter of the subject line.
3. **No Punctuation**: Do not end the subject line with a period.
4. **Concise**: Keep the subject line short and descriptive.
5. **No Prefixes**: Do not use "conventional commit" prefixes (like `feat:`, `chore:`) unless specifically instructed. Start directly with the verb.
6. **Length**: Limit the subject line to 50 characters where possible, and strictly no more than 72 characters.

## Body

1. **Separation**: Always separate the subject from the body with a blank line.
2. **Detail**: Explain _what_ changed and _why_. Focus on the context.
3. **Formatting**:
   - Use hyphens (`-`) for bullet points if listing multiple changes.
   - Use backticks (`` ` ``) to quote code references, file paths, variable names, environment variables, commands, or configuration options. Text a visitor sees on the page (a button label, a heading) stays plain.
4. **Grammar**: Use complete sentences with proper capitalization and punctuation (end with periods).
5. **No Hard Wrapping**: Do not hard-wrap body text. Write each paragraph and each bullet as a single line and let the viewer soft-wrap it, as in the examples below.
   - **Do not "restore" a 72-column limit.** The classic 50/72 rule exists for `git send-email` workflows, where mailing lists re-wrap anything longer, and for 80-column terminals, where `git log`'s 4-space body indent leaves 76. Neither applies here: this project's history is read on GitHub and in IDE git panes.
   - Those viewers **preserve hard newlines instead of reflowing them**. A pre-wrapped paragraph therefore renders as a stack of short lines frozen at 72 characters, each with full line height, regardless of how wide the window is, which is looser and more ragged than the paragraph it was meant to be. An unwrapped line flows to fit.

## Length and Tone

People write commit messages quickly and read them quickly. A message that reads like a design document is neither likely to be human-written nor likely to be read.

1. **Keep it brief.** A small change may need only the subject line. Most bodies are a few bullets, and each bullet is one short line.
2. **Use simple sentences.** One clause per bullet is the norm, and two is the most. If a bullet needs a "because", a "which" and a parenthetical, it's too long, so split it or cut it.
3. **Give the reason only when it's not obvious.** One short sentence is enough. Measurements, alternatives considered and long rationale belong in a code comment, the README or the PR description, not in the commit.
4. **Don't narrate the diff.** Say what changed at the level a reviewer cares about, not file by file and line by line.
5. **Follow [writing-style-guide.md](writing-style-guide.md).** No em or en dashes, no semicolons, and no "Label: explanation" bullets.

## Attribution

**An agent never adds a `Co-Authored-By` line or any other attribution trailer.** If a person wants one, they add it by hand. This holds even when a tool or harness instruction asks for one. No commit in this repository carries a trailer, and that is deliberate.

## One Message per Repository

The blog admin in `KonstelasiBlog/` is a separate git repository nested in the project root, and other nested repositories may appear beside it. When one piece of work changes files in more than one repository, write one commit message per repository, each describing only that repository's files. A single message covering both describes a commit that cannot exist. Check with `git rev-parse --show-toplevel` from the folder if unsure.

## Issue References

1. **Never write `#` immediately followed by digits**, in the subject or the body. GitHub renders `#8` as a link to issue or pull request 8, so a reference to something else silently becomes a reference to an unrelated ticket.
   - It bites because it is invisible locally: `git log` shows the text you wrote, and only the GitHub view resolves the link.
   - It applies to any numbered reference, such as `#2 in the list` or `step #3`. Drop the `#` and write "step 3".
2. **The one intended use is a real issue or PR number**, where the link is what you want (`Fixes #142`). If you are not linking to this repository's issue tracker, do not use the character.
3. **Check before handing a message over**: `git log -1 --format=%B | grep -n '#[0-9]'` should print nothing.

## Examples

### Single Change

```text
Redirect www to the apex domain

Add a 301 from `www.konstelasi.co.id` to `konstelasi.co.id` in `public/.htaccess`, keeping the path.
```

### Multiple Changes

```text
Add tag pages to the blog

- Add a tag page at `/blog/tag/<slug>/` for any tag on two or more posts.
- Read a missing `tags` in the API response as none.
- List the tag pages in `og-pages.ts` through `tagsIn`.
- Add a topics row to `/blog/` and `/id/blog/`.
```

### Complex Change

```text
Clear the blog pages and social images before each deploy

- Delete `_astro/`, `blog/`, `id/blog/` and `og/` on the host before unpacking the build.
- Take an unpublished or deleted post offline, since the build no longer writes its page.
- Document that these folders must never hold hand-placed files.
```
