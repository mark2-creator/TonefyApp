#!/usr/bin/env python3
"""Catch BaseGesture-only methods called on a composed gesture.

`Gesture.Race`, `Gesture.Simultaneous` and `Gesture.Exclusive` return a
ComposedGesture, whose prototype chain is ComposedGesture -> Gesture -> Object.
Configuration methods like `.enabled()` live on BaseGesture, which is not on that
chain, so calling one on a composition throws "x is not a function" - at render
time, on a device, from a file that bundled clean.

This is the gesture-shaped member of the same family as jsxrefs.py: the bundler
resolves the module, so nothing complains until the branch actually renders.

The method list is read out of the installed library rather than hardcoded, so it
tracks a gesture-handler upgrade instead of quietly going stale.
"""
import re
import sys
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
RNGH = ROOT / 'node_modules/react-native-gesture-handler/lib/commonjs/handlers/gestures'
SEARCH_DIRS = ['components', 'screens']

COMPOSERS = ('Race', 'Simultaneous', 'Exclusive')


def methods_of(class_name, source):
    """Method names defined directly on `class_name` in a compiled RNGH module."""
    m = re.search(r'^class %s\b.*?$' % class_name, source, re.M)
    if not m:
        return set()
    rest = source[m.end():]
    nxt = re.search(r'^class \w', rest, re.M)
    body = rest[:nxt.start()] if nxt else rest
    return set(re.findall(r'^  ([a-zA-Z_]\w*)\(', body, re.M))


def composed_safe_methods():
    src = (RNGH / 'gestureComposition.js').read_text()
    safe = methods_of('ComposedGesture', src)
    for cls in ('SimultaneousGesture', 'ExclusiveGesture'):
        safe |= methods_of(cls, src)
    return safe


def base_only_methods(safe):
    src = (RNGH / 'gesture.js').read_text()
    base = methods_of('BaseGesture', src) | methods_of('ContinousBaseGesture', src)
    return {m for m in base if m not in safe and not m.startswith('_')}


def spans(text, start):
    """Walk from the '(' at `start` to its match, so a multi-line composition is
    one unit and the method chained after it can be seen."""
    depth = 0
    for i in range(start, len(text)):
        if text[i] == '(':
            depth += 1
        elif text[i] == ')':
            depth -= 1
            if depth == 0:
                return i
    return -1


def main():
    if not RNGH.exists():
        print('SKIP - react-native-gesture-handler not installed')
        return 0

    safe = composed_safe_methods()
    banned = base_only_methods(safe)
    if not banned:
        print('SKIP - could not read the gesture classes; library layout changed?')
        return 0

    problems = []
    for d in SEARCH_DIRS:
        for path in sorted((ROOT / d).rglob('*.js')):
            text = path.read_text()
            for m in re.finditer(r'Gesture\.(%s)\s*\(' % '|'.join(COMPOSERS), text):
                close = spans(text, m.end() - 1)
                if close < 0:
                    continue
                tail = text[close + 1:close + 120]
                chained = re.match(r'\s*\.\s*([a-zA-Z_]\w*)\s*\(', tail)
                if chained and chained.group(1) in banned:
                    line = text[:m.start()].count('\n') + 1
                    problems.append(
                        f'{path.relative_to(ROOT)}:{line}: .{chained.group(1)}() on the '
                        f'result of Gesture.{m.group(1)}() - that is a ComposedGesture, '
                        f'which has no .{chained.group(1)}(). Put it on each leaf gesture.'
                    )

    if problems:
        print('FAIL - composed gesture given a method it does not have:\n')
        for p in problems:
            print('  ' + p)
        print(f'\n({len(banned)} BaseGesture-only methods checked for)')
        return 1

    print(f'OK - no BaseGesture-only method called on a composition '
          f'({len(banned)} checked)')
    return 0


if __name__ == '__main__':
    sys.exit(main())
