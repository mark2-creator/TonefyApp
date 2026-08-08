#!/usr/bin/env bash
# Downloads the photographs the transition previews are rendered from.
#
# Cached in ~/.cache/tonefy/transition-src, outside both repos: they are inputs to a
# build step rather than source, and ~2MB of stock jpegs does not belong in git. The
# generated previews ARE committed, so a normal checkout never needs to run this -
# only a machine that wants to regenerate them.
#
# Source is Lorem Picsum, which serves Unsplash photographs. The Unsplash License
# permits commercial use and does not require attribution; authors.json is kept
# anyway so credit can be given if you want to.
set -euo pipefail
DIR="$HOME/.cache/tonefy/transition-src"
COUNT="${1:-140}"
mkdir -p "$DIR"
cd "$DIR"
curl -s -L --max-time 30 "https://picsum.photos/v2/list?page=1&limit=100" -o p1.json
curl -s -L --max-time 30 "https://picsum.photos/v2/list?page=2&limit=100" -o p2.json
python3 - "$COUNT" <<'PY'
import json, sys
n = int(sys.argv[1])
ids, authors = [], {}
for f in ('p1.json', 'p2.json'):
    for e in json.load(open(f)):
        ids.append(e['id']); authors[e['id']] = e['author']
open('ids.txt', 'w').write('\n'.join(ids[:n]))
json.dump(authors, open('authors.json', 'w'), indent=1)
print(f'{len(ids[:n])} ids')
PY
xargs -P 8 -I{} sh -c 'test -s img_{}.jpg || curl -s -L --max-time 40 -o img_{}.jpg "https://picsum.photos/id/{}/320/180"' < ids.txt
# A 404 or a truncated download leaves a file that is not an image. It would fail the
# render later with a confusing ffmpeg error rather than here with an obvious one.
for f in img_*.jpg; do
  file -b --mime-type "$f" | grep -q image/jpeg || { echo "discarding non-jpeg: $f"; rm -f "$f"; }
done
echo "$(ls img_*.jpg | wc -l) photos in $DIR"
