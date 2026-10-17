#!/usr/bin/env bash
# Regenerate the Next build, check both builds compile, and pack the zips:
#   zips/parley-astro.zip, zips/parley-next.zip, zips/parley-code.zip (both).
# Dev-only files (tools, launch kit, baselines, env files) never ship.
set -euo pipefail
cd "$(dirname "$0")/.."

node tools/astro-to-next.mjs
node tools/collect-css.mjs
npx astro build > /dev/null
(cd next && npx next build > /dev/null)

stage=$(mktemp -d); trap 'rm -rf "$stage"' EXIT
mkdir -p "$stage/astro" "$stage/next"
rsync -a --exclude node_modules --exclude dist --exclude .astro --exclude .baseline-dist --exclude next --exclude tools \
  --exclude launch --exclude buyer-docs --exclude zips --exclude .claude --exclude .vercel --exclude .vercelignore \
  --exclude .git --exclude '.env*' --exclude .DS_Store --exclude LICENSE ./ "$stage/astro/"
rsync -a --exclude node_modules --exclude .next --exclude out --exclude '.env*' --exclude .vercel --exclude .DS_Store \
  --exclude next-env.d.ts --exclude tsconfig.tsbuildinfo next/ "$stage/next/"
# The Astro README in the zip drops the repo-only bits (deploy button, next/ folder notes).
sed -e '1s/.*/# Parley for Astro/' -e '/^\[!\[Deploy with Vercel\]/d' -e '/^<!-- repo-only -->/,/^<!-- \/repo-only -->/d' README.md > "$stage/astro/README.md"
# Generated-file banners point at the generator, which zip buyers do not get:
# say what the files are instead.
find "$stage/next/src" -type f \( -name '*.tsx' -o -name '*.ts' -o -name '*.js' \) -exec sed -i '' -E '1s#^// GENERATED (from|by) .*#// Parley for Next.js. Generated from the Parley Astro source; edit freely.#' {} +
sed -i '' -E '1s#^/\* GENERATED .*\*/#/* Parley for Next.js: every style in one sheet. Tokens first. */#' "$stage/next/src/styles/site.css"

# Nothing that identifies the demo deployment ships.
if grep -rIl 'polar_cl_\|G-ZDTVFGHC5K\|apollostudio' "$stage"; then echo "demo-only values in bundle" >&2; exit 1; fi

rm -rf zips && mkdir zips
for s in astro next; do
  d="$stage/pack-$s"; mkdir -p "$d"
  cp -R "$stage/$s" "$d/"; cp LICENSE buyer-docs/LICENSES.txt "$d/"
  sed '/^| `/d; /^| Folder/d; /^| ---/d; s/^Two builds of the same site.*/The Parley site for '"$( [ $s = astro ] && echo Astro || echo Next.js )"'. Start with the README in the folder./' buyer-docs/README.md > "$d/README.md"
  (cd "$d" && zip -rq "$OLDPWD/zips/parley-$s.zip" . -x '*.DS_Store')
done
d="$stage/pack-all"; mkdir -p "$d"; cp -R "$stage/astro" "$stage/next" "$d/"; cp buyer-docs/README.md buyer-docs/LICENSES.txt LICENSE "$d/"
(cd "$d" && zip -rq "$OLDPWD/zips/parley-code.zip" . -x '*.DS_Store')
ls -lh zips | awk 'NR>1 {printf "  %-20s %s\n", $9, $5}'
