#!/usr/bin/env bash
# Create the AMO "Source code" zip (readable source + build tooling).
# Upload this under Developer Hub → Source code (in addition to the add-on zip).
set -euo pipefail

cd "$(dirname "$0")"

VERSION="$(node -p "require('./package.json').version")"
OUT="web-ext-artifacts/meanbox-${VERSION}-source.zip"

mkdir -p web-ext-artifacts
rm -f "${OUT}"

# Self-contained source tree for reviewers (no node_modules, no built artifacts).
zip -r "${OUT}" . \
  -x 'node_modules/*' \
  -x 'node_modules/**' \
  -x 'web-ext-artifacts/*' \
  -x 'web-ext-artifacts/**' \
  -x '.DS_Store' \
  -x '*/.DS_Store' \
  -x '.git/*' \
  -x '.web-extension-id'

echo "==> Source package ready for AMO upload:"
echo "    ${OUT}"
ls -la "${OUT}"
