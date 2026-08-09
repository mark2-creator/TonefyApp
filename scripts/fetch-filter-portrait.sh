#!/usr/bin/env bash
# The single portrait every filter tile is rendered from.
#
# A face, because these grades are built for skin - the previous source was a laptop
# on a desk, on which a portrait film stock and a bleach bypass look identical. Kept
# outside both repos: it is an input to a build step, and the generated tiles are what
# gets committed.
#
# Unsplash photograph via Lorem Picsum (id 64). That licence permits commercial use
# and requires no attribution.
set -euo pipefail
DIR="$HOME/.cache/tonefy/filter-src"
mkdir -p "$DIR"
curl -s -L --max-time 60 -o "$DIR/portrait.jpg" "https://picsum.photos/id/64/900/1200"
file -b --mime-type "$DIR/portrait.jpg" | grep -q image/jpeg \
  || { echo "download failed - not a jpeg"; rm -f "$DIR/portrait.jpg"; exit 1; }
echo "portrait saved to $DIR/portrait.jpg"
