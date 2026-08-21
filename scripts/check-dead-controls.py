"""Find TouchableOpacity / Pressable elements with no press handler.

A dead control is the failure this app keeps producing: it looks live, it is styled like
everything around it, and tapping it does nothing at all. Static checks never catch one
because it compiles perfectly.
"""
import re, os, sys
OPEN = re.compile(r'<(TouchableOpacity|Pressable|TouchableHighlight|TouchableWithoutFeedback)\b')
HANDLER = re.compile(r'\bonPress\b|\bonPressIn\b|\bonLongPress\b|\{\.\.\.')
found = []
for root in ('screens', 'components'):
    for f in sorted(os.listdir(root)):
        if not f.endswith('.js'): continue
        p = os.path.join(root, f)
        src = open(p).read()
        lines = src.split('\n')
        for i, ln in enumerate(lines):
            m = OPEN.search(ln)
            if not m: continue
            # The element's own attribute span: from the tag to its first '>' at depth 0.
            chunk, depth = [], 0
            for j in range(i, min(i + 14, len(lines))):
                chunk.append(lines[j])
                seg = lines[j] if j > i else lines[j][m.start():]
                depth += seg.count('{') - seg.count('}')
                # A '>' INSIDE a braced expression is a comparison, not the end of the
                # tag - `items.length > 0` ended the scan one line before the onPress on
                # the next, and reported two working buttons as dead. Only look for the
                # closing bracket in the parts of the line that are not inside braces.
                outside, d = [], depth - (seg.count('{') - seg.count('}'))
                for ch in seg:
                    if ch == '{': d += 1
                    elif ch == '}': d -= 1
                    elif d <= 0: outside.append(ch)
                if '>' in ''.join(outside) and depth <= 0:
                    break
            attrs = '\n'.join(chunk)
            if not HANDLER.search(attrs):
                found.append((p, i + 1, lines[i].strip()[:96]))
print(f'controls with no press handler: {len(found)}\n')
for p, n, t in found:
    print(f'  {p}:{n}  {t}')

# --- state nothing reads ------------------------------------------------------------
#
# A Switch always has an onValueChange, so the check above cannot see one that is wired
# to a useState nothing else ever looks at. That is the same defect wearing different
# clothes - the control moves, a boolean changes, and nothing downstream asks about it.
# It is how five toggles survived on the Record screen and four more on Post-Recording.
#
# The test is occurrence count. The declaration itself contributes exactly one, so a
# name appearing ONCE is read by nobody. The first version of this used <= 2 and
# reported a dozen variables that are read exactly once each - a check that cries wolf
# is a check nobody reads, which is the third time that has been the lesson today.
STATE = re.compile(r'const \[([a-zA-Z_$][\w$]*), *set[A-Z][\w$]*\] *= *useState')
unread = []
for root in ('screens', 'components'):
    for f in sorted(os.listdir(root)):
        if not f.endswith('.js'): continue
        p = os.path.join(root, f)
        src = open(p).read()
        for m in STATE.finditer(src):
            name = m.group(1)
            uses = len(re.findall(r'\b' + re.escape(name) + r'\b', src))
            if uses <= 1:
                line = src[:m.start()].count('\n') + 1
                unread.append((p, line, name, uses))
print(f'\nstate written but never read: {len(unread)}\n')
for p, n, name, uses in unread:
    print(f'  {p}:{n}  {name} ({uses} occurrence{"s" if uses != 1 else ""})')
