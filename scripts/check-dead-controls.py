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
