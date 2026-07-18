#!/usr/bin/env bash
set -euo pipefail

# The game engine exists in two copies that must stay identical: src/lib/*.ts (used by
# the Next.js client and the checked-in fuzz test) and supabase/functions/poker/*.ts
# (the actual live Deno edge function). They can't share one file directly — Deno needs
# explicit .ts extensions on relative imports, Next.js/TypeScript needs them omitted —
# so this script is the single place that copies+rewrites src -> supabase instead of
# doing it by hand with cp/sed every time (which is how drift bugs happen).
#
# Usage: npm run sync:engine
# After running, review the diff, then redeploy the edge function (see README.md).

cd "$(dirname "$0")/.."

SRC_DIR="src/lib"
DST_DIR="supabase/functions/poker"

for f in engine.ts cards.ts types.ts; do
  cp "$SRC_DIR/$f" "$DST_DIR/$f"
  sed -i \
    -e 's#from "\./types"#from "./types.ts"#' \
    -e 's#from "\./cards"#from "./cards.ts"#' \
    "$DST_DIR/$f"
done

echo "Synced engine.ts, cards.ts, types.ts into $DST_DIR"
echo "Review with: git diff $DST_DIR"
echo "Then redeploy the edge function (all 5 files: index.ts, db.ts, engine.ts, cards.ts, types.ts)."
