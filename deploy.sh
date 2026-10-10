#!/usr/bin/env bash
# Manual deploy: build the site and push it to the cPanel host.
#
#   bash deploy.sh            # production: public_html, the main domain's document root
#   bash deploy.sh staging    # the staging subdomain, kept out of search engines
#
# It assumes a `konstelasi` entry in your own ~/.ssh/config (host, port, user
# and key), so no credential of any kind lives in this repository. Set
# DEPLOY_HOST to use another alias, for example in ~/.bashrc. The key is
# unlocked once per run, so a fresh terminal needs nothing else. Run it from
# Git Bash on Windows, since `npm run` may find the WSL bash.exe first.
set -euo pipefail

TARGET="${1:-production}"
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
  if [ "${AGENT_STARTED:-0}" = 1 ]; then ssh-agent -k > /dev/null 2>&1 || true; fi
}
trap cleanup EXIT

# Unlock the key once per run. When no agent holds a key, start a private one,
# ask for the passphrase a single time and stop the agent on exit. An agent
# you unlocked yourself is used as it is.
if ! ssh-add -l > /dev/null 2>&1; then
  eval "$(ssh-agent -s)" > /dev/null
  AGENT_STARTED=1
  key="$(ssh -G "$REMOTE_HOST" 2> /dev/null | awk '/^identityfile /{print $2; exit}')"
  ssh-add "${key/#\~/$HOME}" || { echo "Error: could not unlock the ssh key for '${REMOTE_HOST}'." >&2; exit 1; }
fi

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

# The blog pages are built from the blog admin's API, always the live one,
# whatever a local .env says (a .env may point at a local copy of the admin).
# If the API is unreachable the build stops, so a deploy never ships an empty
# blog.
export BLOG_API_URL="https://blog.konstelasi.co.id"

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
# Four folders are wiped first, because the build writes every file in them
# and a plain overwrite would keep what it no longer writes. _astro/ holds
# files with a content hash in their name, so every earlier build's files would
# stay forever. blog/ and id/blog/ hold one page per post, and og/ one social
# image per page, so a post set back to draft or deleted in the blog admin
# would stay online as an old page. Anything else in the folder (cgi-bin,
# .well-known and other cPanel files) is left alone, and the archive overwrites
# only what the build produces.
ssh "$REMOTE_HOST" bash -s <<EOF
set -euo pipefail
trap 'rm -f "${ARCHIVE_NAME}"' EXIT
mkdir -p "${REMOTE_DIR}"
rm -rf "${REMOTE_DIR}/_astro" "${REMOTE_DIR}/blog" "${REMOTE_DIR}/id/blog" "${REMOTE_DIR}/og"
tar -xzf "${ARCHIVE_NAME}" -C "${REMOTE_DIR}"
EOF

echo "==> Deployed to ${TARGET} (~/${REMOTE_DIR})"
