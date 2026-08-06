import json, os, re, urllib.parse, urllib.request
from concurrent.futures import ThreadPoolExecutor

BASE = os.path.dirname(os.path.abspath(__file__))
STAGE = os.path.join(BASE, 'fontstage')
# A bare 'Mozilla/4.0' is what makes Google serve a plain static TTF. A longer
# legacy UA routes to /l/font?kit=, which is not a font file, and a modern one
# returns woff2 - neither of which ImageMagick or Android can load.
UA = 'Mozilla/4.0'
MAGIC = (b'\x00\x01\x00\x00', b'true', b'ttcf', b'OTTO')

def get(url):
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=45) as r:
        return r.read()

def css_ttf(family, weight):
    q = urllib.parse.quote(family)
    tries = []
    if weight != 400:
        tries.append((f'https://fonts.googleapis.com/css?family={q}:{weight}', weight))
    tries.append((f'https://fonts.googleapis.com/css?family={q}', 400))
    for url, w in tries:
        try:
            css = get(url).decode('utf8', 'replace')
        except Exception:
            continue
        m = re.findall(r'src:\s*url\((https://[^)]+)\)', css)
        if m:
            return m[-1], w
    return None, None

def pascal(name):
    return re.sub(r'[^A-Za-z0-9]', '', name)

def one(line):
    family, category, weight = line.split('|')
    weight = int(weight)
    url, got = css_ttf(family, weight)
    if not url:
        return {'name': family, 'error': 'no font url in css'}
    try:
        data = get(url)
    except Exception as e:
        return {'name': family, 'error': f'download: {e}'}
    if len(data) < 8000 or data[:4] not in MAGIC:
        return {'name': family, 'error': f'not a font (len={len(data)}, magic={data[:4]!r})'}
    fname = f'{pascal(family)}-{"Bold" if got == 700 else "Regular"}.ttf'
    with open(os.path.join(STAGE, fname), 'wb') as f:
        f.write(data)
    return {'name': family, 'file': fname, 'category': category, 'weight': got, 'bytes': len(data)}

lines = [l.strip() for l in open(os.path.join(BASE, 'families.txt')) if l.strip()]
with ThreadPoolExecutor(max_workers=8) as ex:
    results = list(ex.map(one, lines))

ok = [r for r in results if 'file' in r]
bad = [r for r in results if 'error' in r]
ok.sort(key=lambda r: r['name'].lower())
json.dump(ok, open(os.path.join(BASE, 'manifest.json'), 'w'), indent=2)
print(f'ok={len(ok)} failed={len(bad)} total={sum(r["bytes"] for r in ok)/1e6:.1f}MB')
for b in bad:
    print('  FAIL', b['name'], '-', b['error'])
