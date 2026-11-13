#!/bin/sh
# Vercel "Ignored Build Step": exit 0 = niet bouwen, exit 1 = wel bouwen.
# Niet bouwen als sinds de vorige uitrol enkel databankmigraties (db/), documentatie of tests veranderden.
vorige="$VERCEL_GIT_PREVIOUS_SHA"
[ -z "$vorige" ] && exit 1
git cat-file -e "$vorige" 2>/dev/null || git fetch --depth=50 origin "$VERCEL_GIT_COMMIT_REF" >/dev/null 2>&1
git cat-file -e "$vorige" 2>/dev/null || exit 1
if git diff --quiet "$vorige" HEAD -- . ':(exclude)db' ':(exclude)docs' ':(exclude)*.md' ':(exclude)tests'; then
  echo "Enkel db/, docs of tests gewijzigd: niet opnieuw bouwen."; exit 0
fi
exit 1
