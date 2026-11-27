#!/bin/sh
set -eu

source_html=$1
bundled_html=$2
if [ ! -f "$source_html" ] || ! grep -q 'data-transport="offline"' "$source_html"; then
  echo 'Build the offline room from the repository root with npm run whatsapp:export -- apple/Resources/reading-room.html' >&2
  exit 1
fi

mkdir -p "$(dirname "$bundled_html")"
# Keep the self-contained bundle offline even if a future script requests a remote resource.
# Native navigation delegates handle the single external Bookser link in the system browser.
csp="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; media-src data: blob:; connect-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'"
awk -v policy="$csp" '
  !inserted && /<head>/ {
    sub(/<head>/, "<head><meta http-equiv=\"Content-Security-Policy\" content=\"" policy "\">")
    inserted = 1
  }
  { print }
  END { if (!inserted) exit 1 }
' "$source_html" > "$bundled_html"
