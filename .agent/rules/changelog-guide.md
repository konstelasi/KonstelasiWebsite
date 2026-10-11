# Changelog Style Guide

This project follows a specific style for maintaining the `CHANGELOG.md` file to ensure the history is readable and consistent. It adheres to [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) and [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Versioning

1. **Before 1.0.0**, every version is a plain `0.x.y`. Bump `x` for a change that adds or alters behaviour and `y` for a fix.
2. **No pre-release labels.** Never write `alpha`, `beta`, `rc` or any other suffix, in a version header, a tag, a commit or a release title. `0.2.0` is followed by `0.2.1` or `0.3.0`, never by `0.2.0-alpha.1`.
3. **1.0.0** is the first version that promises stability. Until the maintainer says the project has reached it, stay on `0.x.y`.

## Structure

The changelog groups notable changes for each release.

### Version Headers

1. **Format**: Use `## [Version] - YYYY-MM-DD`.
2. **Example**: `## [0.2.0] - 2026-02-22`.

### Categories

Organize changes under these specific category headers:

- `### Added` for new features.
- `### Changed` for changes in existing functionality.
- `### Deprecated` for soon-to-be removed features.
- `### Removed` for now removed features.
- `### Fixed` for any bug fixes.
- `### Security` in case of vulnerabilities.

## Item Formatting

1. **Feature Grouping**: Group related changes under a bolded feature or domain name.
   - Format: `- **Feature Name**: Description of change`
2. **Sub-items**: If a feature has multiple distinct changes, use bulleted sub-items indented by two spaces.

   ```markdown
   - **Blog tags**:
     - Tag pages for any tag on two or more posts.
     - A topics row on the blog index.
   ```

3. **Commit Hashes**: Optional, and expected mainly for released versions where an entry maps cleanly onto one or two commits. Conclude the entry with the short hash(es) in parentheses when they add traceability.
   - Hashes should be exactly 7 characters.
   - If multiple commits apply, separate them with a comma and a space.
   - Example: `(cb4cb2c, 7942ab7)`
   - Omit them where an entry summarises a whole phase or a long-running branch, since per-bullet hashes would be noise rather than traceability.
4. **Language & Grammar**: Start descriptions with active, past-tense verbs (e.g., "Implemented", "Added", "Refactored", "Fixed") or concise descriptive noun phrases (e.g., "Tag pages for the blog"). End descriptions with a period.
5. **Code References**: Use backticks (`` ` ``) to quote code references, file names, paths, and variables (e.g., `deploy.sh`, `public/.htaccess`, `BLOG_API_URL`).

## Example

```markdown
## [0.2.0] - 2026-02-22

### Added

- **Blog tags**: Added tag pages for any tag on two or more published posts (a732a06, 0dc2aa7).
- **Deploy workflow**:
  - Rebuilt the site from GitHub Actions on every push to `main` (cb4cb2c).
  - Redirected `www` to the apex domain in `public/.htaccess` (796dfa0).

### Fixed

- **Blog cleanup**: Cleared the blog pages and social images on the host before each deploy (ecfbaa6, 6f0cfab).
```
