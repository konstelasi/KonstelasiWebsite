#!/usr/bin/env bash
# Manual deploy: build the site and push it to the cPanel host.
#
#   bash deploy.sh            # staging (the default)
#   bash deploy.sh production # the folder the main domain will point at
#
# It assumes a `konstelasi` entry in your own ~/.ssh/config (host, port, user
# and key), so no credential of any kind lives in this repository. Run it
# from Git Bash on Windows, since `npm run` may find the WSL bash.exe first.
set -euo pipefail

TARGET="${1:-staging}"
REMOTE_HOST="konstelasi"

# Folders are relative to the remote $HOME, the default working directory of
# an SSH session, so the account's username never appears here. Each one is
# the document root of a domain in cPanel. Going live means pointing the main
# domain at the production folder, with WordPress backed up and left in place.
case "$TARGET" in
  staging)    REMOTE_DIR="konstelasi-staging" ;;
  production) REMOTE_DIR="konstelasi-site" ;;
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

echo "==> Building..."
npm ci
npm run build

if [ ! -d dist ]; then
  echo "Error: dist/ not found after build." >&2
  exit 1
fi

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
mkdir -p "${REMOTE_DIR}"
rm -rf "${REMOTE_DIR}/_astro"
tar -xzf "${ARCHIVE_NAME}" -C "${REMOTE_DIR}"
rm -f "${ARCHIVE_NAME}"
EOF

echo "==> Deployed to ${TARGET} (~/${REMOTE_DIR})"
