#!/usr/bin/env bash
# Build for Cloudflare Pages (git-connected deploys).
# Dashboard config: build command = bash tools/pages-build.sh · output dir = dist
set -euo pipefail
cd "$(dirname "$0")/.."

rm -rf dist
mkdir -p dist/js
cp index.html favicon.svg og-image.png README.md dist/
cp js/*.js dist/js/

echo "dist/ ready: $(ls dist) + js/$(ls dist/js | tr '\n' ' ')"
