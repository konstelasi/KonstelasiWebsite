#!/usr/bin/env bash
# Manual deploy: build the site and push it to the cPanel host.
#
#   bash deploy.sh            # staging (the default)
#   bash deploy.sh production # public_html, the main domain's document root
#
# It assumes a `konstelasi` entry in your own ~/.ssh/config (host, port, user
# and key), so no credential of any kind lives in this repository. Set
# DEPLOY_HOST to use another alias. Run it from Git Bash on Windows, since
# `npm run` may find the WSL bash.exe first.
set -euo pipefail

TARGET="${1:-staging}"
REMOTE_HOST="${DEPLOY_HOST:-konstelasi}"

# Folders are relative to the remote $HOME, the default working directory of
# an SSH session, so the account's username never appears here. Staging is the
# document root of its own subdomain in cPanel. The main domain's document
# root is fixed to public_html, so production deploys there.
case "$TARGET" in
  staging)    REMOTE_DIR="konstelasi-staging" ;;
  production) REMOTE_DIR="public_html" ;;
  *)
    echo "Unknown target '$TARGET'. Use staging or production." >&2
    exit 1
    ;;
esac

ARCHIVE_NAME="konstelasi-deploy-$(date +%Y%m%d%H%M%S).tar.gz"

cleanup() {
  rm -f "$ARCHIVE_NAME"
}
trap cleanup EXIT

# Refuse to unpack a build over a WordPress install, which would leave the two
# mixed together. Exit code 1 means the file is absent, which is what we want.
# Anything else means ssh itself failed, so stop before spending time on a build.
status=0
ssh "$REMOTE_HOST" "[ -e '${REMOTE_DIR}/wp-config.php' ]" || status=$?
case "$status" in
  0)
    echo "Error: ~/${REMOTE_DIR} still holds WordPress. Move the WordPress files out first." >&2
    exit 1
    ;;
  1) ;;
  *)
    echo "Error: could not reach '${REMOTE_HOST}' over ssh (code ${status}). Is the key unlocked?" >&2
    exit 1
    ;;
esac

# The blog builds from the Markdown files in src/content/blog until the blog
# admin is live, whatever a local .env says. Setting this to the admin's URL
# is the switch to its API.
export BLOG_API_URL=""

echo "==> Building..."
npm ci
npm run build

if [ ! -d dist ]; then
  echo "Error: dist/ not found after build." >&2
  exit 1
fi

# The same checks the project asks for, so a broken link, a dash in the copy,
# a low contrast pair or an over-budget page never reaches the host.
echo "==> Verifying..."
npm run verify:copy
npm run verify:contrast
npm run verify:links
npm run verify:budget

if [ "$TARGET" = "staging" ]; then
  # Keep the staging copy out of search engines. The real robots.txt only
  # ships with a production deploy.
  printf 'User-agent: *\nDisallow: /\n' > dist/robots.txt
fi

echo "==> Packaging dist/ ..."
tar -czf "$ARCHIVE_NAME" -C dist .

echo "==> Uploading to ${REMOTE_HOST}:~/${ARCHIVE_NAME} ..."
scp "$ARCHIVE_NAME" "${REMOTE_HOST}:${ARCHIVE_NAME}"

echo "==> Extracting into ~/${REMOTE_DIR} ..."
# _astro/ is wiped first. Every file in it has a content hash in its name, so
# a plain overwrite would keep every earlier build's files forever. Anything
# else in the folder (cgi-bin, .well-known and other cPanel files) is left
# alone, and the archive overwrites only what the build produces.
ssh "$REMOTE_HOST" bash -s <<EOF
set -euo pipefail
trap 'rm -f "${ARCHIVE_NAME}"' EXIT
mkdir -p "${REMOTE_DIR}"
rm -rf "${REMOTE_DIR}/_astro"
tar -xzf "${ARCHIVE_NAME}" -C "${REMOTE_DIR}"
EOF

echo "==> Deployed to ${TARGET} (~/${REMOTE_DIR})"
