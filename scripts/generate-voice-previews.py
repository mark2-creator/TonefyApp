#!/usr/bin/env python3
"""Renders one preview clip per voice, once.

Run: python3 scripts/generate-voice-previews.py
Writes: ~/Tonefy-react/backend/public/previews/<voiceId>.mp3

Previews used to be synthesised on every tap: a round trip through /api/generate-audio,
several seconds of silence, CPU on the render box, and a plan check standing between
someone and hearing the voice they were considering paying for. None of that is
necessary - the line is fixed and the voice is fixed, so the audio can only ever come
out the same.

Idempotent: a voice that already has a file is skipped, so re-running after adding
voices only renders the new ones.
"""
import json, pathlib, subprocess, sys

BACKEND = pathlib.Path.home() / "Tonefy-react" / "backend"
OUT = BACKEND / "public" / "previews"
OUT.mkdir(parents=True, exist_ok=True)

# Long enough to judge tone and pace, short enough to sit through while comparing.
LINE = "Hi, this is a quick preview of my voice. Here is how I sound."

voices = json.loads((BACKEND / "voices.json").read_text(encoding="utf-8"))
made = skipped = failed = 0

for vid, v in voices.items():
    dest = OUT / f"{vid}.mp3"
    if dest.exists() and dest.stat().st_size > 500:
        skipped += 1
        continue
    try:
        if v["engine"] == "gtts":
            cmd = ["python3", str(BACKEND / "gtts_generate.py"), LINE, str(dest), v.get("tld", "com")]
        else:
            cmd = ["python3", str(BACKEND / "edge_tts_generate.py"), LINE, str(dest), v["name"]]
        subprocess.run(cmd, check=True, capture_output=True, timeout=120)
        made += 1
    except Exception as e:
        failed += 1
        print(f"  {vid}: {type(e).__name__}", file=sys.stderr)
    if (made + skipped + failed) % 50 == 0:
        print(f"  ... {made + skipped + failed}/{len(voices)}", flush=True)

print(f"previews: {made} new, {skipped} already there, {failed} failed, {len(list(OUT.glob('*.mp3')))} total")
