#!/usr/bin/env bash
# Meanbox Chrome extension — zip for Chrome Web Store / sideload.
# Produces: dist/meanbox-<version>.zip
set -euo pipefail

cd "$(dirname "$0")"

VERSION="$(node -p "require('./package.json').version")"
OUT_DIR="dist"
ZIP_NAME="meanbox-${VERSION}.zip"

echo "==> Meanbox Chrome extension pack"
echo "    cwd: $(pwd)"
echo "    version: ${VERSION}"

if [[ ! -f manifest.json ]]; then
  echo "error: manifest.json not found" >&2
  exit 1
fi

mkdir -p "${OUT_DIR}"
rm -f "${OUT_DIR}/${ZIP_NAME}"

# Package only runtime files (no tests, docs, or tooling).
zip -r "${OUT_DIR}/${ZIP_NAME}" \
  manifest.json \
  background.js \
  content.js \
  content.css \
  popup.html \
  popup.js \
  options.html \
  options.js \
  sidebar.html \
  sidebar.js \
  shared.css \
  icons \
  brand \
  lib/api.js \
  lib/article.js \
  lib/config.js \
  lib/gadgets.js \
  lib/localHistory.js \
  lib/parse.js \
  lib/paths.js \
  lib/syncLocalHistory.js \
  lib/ui.js \
  -x "*.DS_Store" "lib/*.test.js"

echo "==> Done"
echo "    Artifact: ${OUT_DIR}/${ZIP_NAME}"
ls -la "${OUT_DIR}/${ZIP_NAME}"
