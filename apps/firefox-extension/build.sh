#!/usr/bin/env bash
# Meanbox Firefox add-on — reproducible package build for AMO reviewers.
# Produces: web-ext-artifacts/meanbox-<version>.zip
set -euo pipefail

cd "$(dirname "$0")"

echo "==> Meanbox Firefox extension build"
echo "    cwd: $(pwd)"
echo "    OS:  $(uname -s) $(uname -r) ($(uname -m))"
echo "    Node: $(node -v)"
echo "    npm:  $(npm -v)"

if [[ ! -f package.json ]]; then
  echo "error: package.json not found (run this script from apps/firefox-extension/)" >&2
  exit 1
fi

if [[ ! -f package-lock.json ]]; then
  echo "error: package-lock.json missing (required for reproducible npm ci)" >&2
  exit 1
fi

echo "==> Installing dependencies (npm ci --no-workspaces)"
# --no-workspaces: this package is self-contained for AMO; ignore parent monorepo workspaces if present.
npm ci --no-workspaces --ignore-scripts

echo "==> Packaging add-on (web-ext build)"
npm run build

ARTIFACT="$(ls -1 web-ext-artifacts/meanbox-*.zip 2>/dev/null | grep -v -- '-source.zip$' | sort | tail -n 1 || true)"
if [[ -z "${ARTIFACT}" ]]; then
  echo "error: expected zip missing under web-ext-artifacts/" >&2
  exit 1
fi

echo "==> Done"
echo "    Artifact: ${ARTIFACT}"
ls -la "${ARTIFACT}"
