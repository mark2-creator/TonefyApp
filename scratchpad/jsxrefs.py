#!/usr/bin/env python3
"""Check every capitalised JSX tag resolves to something the file imports or defines.

Metro bundles a reference to a function that no longer exists and only fails when
that branch renders, so `npx expo export` passing is necessary but not sufficient.
Deleting a component and leaving one of its two call sites behind is exactly how
that happens - this catches it statically.
"""
import re, sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
SKIP = {'node_modules', 'dist', '.git', '.expo', 'android', 'scratchpad'}

# <Foo, <Foo.Bar - capitalised opening tags only; lowercase are host components.
TAG = re.compile(r'<([A-Z][A-Za-z0-9_]*)(?:\.([A-Za-z0-9_]+))?')
# Anything that puts a capitalised name in scope.
DEFS = [
    re.compile(r'\bimport\s+([A-Z][A-Za-z0-9_]*)', ),
    # `import Default, { Named }` - the default name sits between the keyword and
    # the braces, so the brace group cannot assume it follows `import` directly.
    re.compile(r'\bimport\s+(?:[A-Za-z0-9_$]+\s*,\s*)?\{([^}]*)\}', re.S),
    re.compile(r'\bfunction\s+([A-Z][A-Za-z0-9_]*)'),
    re.compile(r'\b(?:const|let|var)\s+([A-Z][A-Za-z0-9_]*)'),
    # Destructured out of something at runtime, e.g. `const { CameraView } = Cam;` where
    # Cam is a lazily required native module. That pattern is deliberate here - a native
    # module cannot be imported at the top level if it might be missing from the installed
    # binary - so a checker that flags it reports an error on every correct use of the
    # rule this project already follows. A check that is always red is a check nobody
    # reads.
    re.compile(r'\b(?:const|let|var)\s*\{([^}]*)\}\s*='),
    re.compile(r'\bclass\s+([A-Z][A-Za-z0-9_]*)'),
    re.compile(r'\bas\s+([A-Z][A-Za-z0-9_]*)'),
]

def names_in_scope(src):
    found = set()
    for rx in DEFS:
        for m in rx.finditer(src):
            for part in m.group(1).split(','):
                part = part.strip()
                if ' as ' in part:
                    part = part.split(' as ')[-1].strip()
                if part and part[0].isupper():
                    found.add(re.split(r'\W', part)[0])
    return found

bad = 0
for f in sorted(ROOT.rglob('*.js')):
    if any(p in SKIP for p in f.parts):
        continue
    src = f.read_text(encoding='utf-8', errors='replace')
    if '<' not in src:
        continue
    scope = names_in_scope(src)
    unresolved = set()
    for m in TAG.finditer(src):
        root = m.group(1)
        # React.Fragment shorthand and namespaced members resolve via their root.
        if root not in scope:
            unresolved.add(root)
    for name in sorted(unresolved):
        print(f'{f.relative_to(ROOT)}: <{name}> is not imported or defined')
        bad += 1

print('OK - every JSX tag resolves' if not bad else f'{bad} unresolved tag(s)')
sys.exit(1 if bad else 0)
