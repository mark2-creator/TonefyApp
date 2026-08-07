"""Every capitalised JSX tag must resolve to something the file imports or defines.

Metro happily bundles a reference to a function that no longer exists - it only
fails when that branch renders, which may be never in testing and always for a
user. Deleting a component and leaving one of its two call sites behind is
exactly how that happens.
"""
import re, sys, pathlib

roots = [pathlib.Path('screens'), pathlib.Path('components')]
files = sorted(f for r in roots for f in r.glob('*.js'))

BUILTIN = {'React'}
problems = []
for f in files:
    src = f.read_text()
    defined = set(BUILTIN)
    # import X / import {A, B as C} / import * as N
    # DOTALL: an import clause is routinely spread over several lines, and a
    # line-anchored pattern silently matches none of it - which makes every name
    # in it look undefined.
    for m in re.finditer(r"import\s+(.+?)\s+from\s+'[^']+';", src, re.S):
        clause = m.group(1)
        ns = re.match(r"\*\s+as\s+(\w+)", clause)
        if ns:
            defined.add(ns.group(1)); continue
        brace = re.search(r"\{([^}]*)\}", clause)
        if brace:
            for part in brace.group(1).split(','):
                part = part.strip()
                if not part: continue
                defined.add(part.split(' as ')[-1].strip())
        head = clause.split('{')[0].strip().rstrip(',').strip()
        if head and re.fullmatch(r'\w+', head):
            defined.add(head)
    for m in re.finditer(r"^(?:export\s+)?(?:default\s+)?function\s+(\w+)", src, re.M):
        defined.add(m.group(1))
    for m in re.finditer(r"^(?:export\s+)?(?:const|let|var)\s+(\w+)", src, re.M):
        defined.add(m.group(1))
    # locally scoped helpers, incl. `const Foo = React.memo(...)` inside blocks
    for m in re.finditer(r"(?:const|let|var)\s+(\w+)\s*=", src):
        defined.add(m.group(1))
    for m in re.finditer(r"function\s+(\w+)\s*\(", src):
        defined.add(m.group(1))

    used = set()
    for m in re.finditer(r"<([A-Z]\w*)(?:\.\w+)*[\s/>]", src):
        used.add(m.group(1))

    missing = sorted(u for u in used if u not in defined)
    if missing:
        for name in missing:
            line = src[:src.index('<' + name)].count('\n') + 1
            problems.append(f"{f}:{line}: <{name}> is used but never imported or defined")

print(f"checked {len(files)} files")
for p in problems:
    print('  ' + p)
print('\nNO DANGLING JSX REFERENCES' if not problems else f'\n{len(problems)} dangling reference(s)')
sys.exit(1 if problems else 0)
