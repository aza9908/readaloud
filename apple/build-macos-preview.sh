#!/bin/sh
set -eu

# From any directory: sh path/to/apple/build-macos-preview.sh path/to/Bookser.app
apple_dir=$(cd "$(dirname "$0")" && pwd)
repo_dir=$(dirname "$apple_dir")
output=${1:-"$apple_dir/build/Bookser.app"}
case "$output" in /*) ;; *) output="$PWD/$output" ;; esac
if [ -e "$output" ]; then
  echo "Choose a new output path. An item already exists at $output" >&2
  exit 1
fi
case "$output" in *.app) ;; *) echo "The output path must end in .app" >&2; exit 1 ;; esac

build_dir=$(mktemp -d "${TMPDIR:-/tmp}/bookser-apple.XXXXXX")
trap 'rm -rf "$build_dir"' EXIT
app="$build_dir/Bookser.app"
mkdir -p "$app/Contents/MacOS" "$app/Contents/Resources"
(cd "$repo_dir" && npm run whatsapp:export -- apple/Resources/reading-room.html)
sh "$apple_dir/embed-reading-room.sh" "$apple_dir/Resources/reading-room.html" "$app/Contents/Resources/reading-room.html"

xcrun --sdk macosx swiftc -O -parse-as-library -swift-version 5 -target "$(uname -m)-apple-macosx13.0" \
  -module-cache-path "$build_dir/module-cache" "$apple_dir/App/BookserApp.swift" "$apple_dir/App/ReadingRoomSession.swift" \
  -o "$app/Contents/MacOS/Bookser"

for strings in "$apple_dir"/App/*.lproj; do cp -R "$strings" "$app/Contents/Resources/"; done
catalog="$apple_dir/App/Assets.xcassets/AppIcon.appiconset"
# Modern ICNS resources are a table of tagged PNGs. Package the same PNGs
# as the Xcode asset catalog without requiring the Xcode asset compiler.
/usr/bin/python3 - "$catalog" "$app/Contents/Resources/AppIcon.icns" <<'PY'
from pathlib import Path
import struct
import sys

def chunk(kind, content):
    return kind.encode("ascii") + struct.pack(">I", len(content) + 8) + content

sizes = {"icp4": 16, "icp5": 32, "icp6": 64, "ic07": 128, "ic08": 256,
         "ic09": 512, "ic10": 1024, "ic11": 32, "ic12": 64, "ic13": 256, "ic14": 512}
catalog = Path(sys.argv[1])
images = [chunk(kind, (catalog / f"mac-{size}.png").read_bytes()) for kind, size in sizes.items()]
Path(sys.argv[2]).write_bytes(chunk("icns", b"".join(images)))
PY
cp "$apple_dir/MacPreview-Info.plist" "$app/Contents/Info.plist"
codesign --sign - --entitlements "$apple_dir/App/BookserMac.entitlements" "$app"
codesign --verify --strict "$app"
mkdir -p "$(dirname "$output")"
ditto "$app" "$output"
echo "Built $output"
