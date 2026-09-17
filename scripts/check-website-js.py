#!/usr/bin/env python3
"""Syntax-check every inline <script> on the hand-written website.

The app has `expo export` and eslint. The website has nothing: it is hand-written HTML
served straight by nginx, so a syntax error ships silently - and a script that does not
parse does not run AT ALL, which looks like a page that merely does nothing rather than a
page that is broken. Three pages were in that state when this was written
(connect-accounts, dashboard, edit-post-video), each from an edit that wrapped code in a
callback and left the braces unbalanced.

Run it after ANY website edit:

    python3 scripts/check-website-js.py            # defaults to /var/www/tonefy-ai
    python3 scripts/check-website-js.py <dir>

Exits non-zero if anything fails to parse, so it can gate a commit.
"""
import os
import re
import subprocess
import sys
import tempfile

SCRIPT_RE = re.compile(r'<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)</script>', re.I)


def check(path):
    with open(path, encoding='utf-8') as fh:
        html = fh.read()
    problems = []
    for index, match in enumerate(SCRIPT_RE.finditer(html), start=1):
        body = match.group(2)
        if not body.strip():
            continue
        # .mjs so `import` at the top level parses; a classic script that happens to
        # contain no modules parses the same way, so one suffix covers both.
        tmp = tempfile.NamedTemporaryFile('w', suffix='.mjs', delete=False, encoding='utf-8')
        try:
            tmp.write(body)
            tmp.close()
            result = subprocess.run(['node', '--check', tmp.name],
                                    capture_output=True, text=True)
        finally:
            os.unlink(tmp.name)
        if result.returncode:
            line = next((l for l in result.stderr.splitlines() if 'Error' in l),
                        result.stderr.strip().splitlines()[0] if result.stderr.strip() else '?')
            problems.append(f'block {index}: {line.strip()}')
    return problems


def main():
    root = sys.argv[1] if len(sys.argv) > 1 else '/var/www/tonefy-ai'
    if not os.path.isdir(root):
        print(f'not a directory: {root}')
        return 2
    pages = sorted(f for f in os.listdir(root) if f.endswith('.html'))
    if not pages:
        print(f'no .html files in {root}')
        return 2
    broken = 0
    for page in pages:
        problems = check(os.path.join(root, page))
        if problems:
            broken += 1
            print(f'BROKEN  {page}')
            for problem in problems:
                print(f'          {problem}')
    print(f'\n{len(pages)} pages checked, {broken} broken.')
    return 1 if broken else 0


if __name__ == '__main__':
    sys.exit(main())
