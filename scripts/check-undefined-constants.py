#!/usr/bin/env python3
"""Flag module-level constants used but never defined or imported.

Metro bundles a reference to something that no longer exists and only throws when
that branch renders, so `npx expo export` passes and the app dies on a device. This
catches the specific shape that has now bitten this project twice: a deletion that
took a neighbour with it.

The VOICES case: 151 lines were removed by line range after checking that three
transition symbols were unreferenced. `const VOICES` sat inside that range, was not
one of the three, and went with them. Export was clean; opening the editor crashed.

Run over any file that has had a block deleted from it.
"""
import re
import sys

GLOBALS = {
    'JSON', 'Math', 'Date', 'Object', 'Array', 'String', 'Number', 'Promise',
    'React', 'Alert', 'Animated', 'StyleSheet', 'URL', 'Set', 'Map', 'Boolean',
    'Error', 'FormData', 'JSX', 'Infinity', 'NaN',
}


def strip_noise(src):
    """Only comments. Deliberately NOT string literals.

    Stripping strings is what made the first version of this guard miss the very bug
    it was written for: an apostrophe in JSX text ("doesn't") reads as an opening
    quote and swallows everything to the next one, taking real code with it. A guard
    that silently drops the region it was meant to inspect is worse than no guard.

    Leaving strings in can only produce a FALSE POSITIVE - a name inside a string
    that looks used - and a false positive is something you look at and dismiss.
    """
    src = re.sub(r'/\*[\s\S]*?\*/', ' ', src)
    src = re.sub(r'(^|[^:])//.*$', r'\1 ', src, flags=re.M)
    return src


def check(path):
    src = strip_noise(open(path, encoding='utf-8').read())
    # A constant being USED: followed by a property, index or call.
    used = {m.group(1) for m in re.finditer(r'(?<![.\w])([A-Z][A-Z0-9_]{2,})\s*[.\[(]', src)}
    missing = []
    for name in sorted(used):
        if name in GLOBALS:
            continue
        defined = re.search(r'(const|let|var|function)\s+%s\b' % name, src)
        imported = re.search(r'import[^;]*\b%s\b' % name, src)
        if not defined and not imported:
            missing.append(name)
    return missing


def main():
    paths = sys.argv[1:]
    if not paths:
        print('usage: check-undefined-constants.py <file.js> [...]')
        return 2
    bad = False
    for path in paths:
        missing = check(path)
        if missing:
            bad = True
            print('%s: UNDEFINED %s' % (path, ', '.join(missing)))
        else:
            print('%s: all constants resolve' % path)
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main())
