#!/usr/bin/env python3
"""Every bare setX(...) call must have a matching `const [x, setX] = useState(...)`.

Catches the one thing `expo export` and jsxrefs.py both miss: an identifier that resolves
at bundle time and throws only when the line runs. A deleted state declaration whose
setter is still called bundles perfectly and grey-screens on a device - which is how
`showVoicePicker` shipped.

Only bare calls count. `sound.setOnPlaybackStatusUpdate(...)` is a method on an object,
not a state setter, so anything preceded by a dot is skipped, along with the handful of
globals and library functions that happen to fit the naming.
"""
import re, sys, pathlib

GLOBALS = {
    "setTimeout", "setInterval", "setImmediate", "setState",
    "setDoc", "setItem", "setValue", "setParams", "setStringAsync",
    "setAudioModeAsync", "setPositionAsync", "setVolumeAsync",
    "setOnPlaybackStatusUpdate", "setList", "setClipTransition",
}

root = pathlib.Path(__file__).resolve().parent.parent
files = sorted(list((root / "screens").glob("*.js")) + list((root / "components").glob("*.js")))
bad = 0
for f in files:
    if ".bak_" in f.name:
        continue
    src = f.read_text(encoding="utf-8")
    declared = set(re.findall(r"const\s*\[\s*\w+\s*,\s*(set\w+)\s*\]", src))
    declared |= set(re.findall(r"\b(set\w+)\s*=", src))                       # plain assignment
    declared |= set(re.findall(r"\b(set\w+)\s*[,}:]", src))                   # destructured prop / passed in
    declared |= set(re.findall(r"function\s+(set\w+)", src))
    # bare calls only - a leading dot means it is a method on something
    used = {m.group(1) for m in re.finditer(r"(?<![.\w])(set[A-Z]\w*)\s*\(", src)}
    missing = sorted(u for u in used - GLOBALS if u not in declared)
    if missing:
        bad += len(missing)
        print(f"  {f.relative_to(root)}: {', '.join(missing)}")
print("OK - every state setter has a declaration" if not bad else f"{bad} setter(s) with no declaration")
sys.exit(1 if bad else 0)
