# Work in progress - read this first when resuming

Kept current DURING a multi-step task so an interruption (usage limit, crash, new chat) loses
nothing. Update after every finished step; clear the task when it is done and recorded.
Resume = read this, check `git status` in both repos, carry on from "Next". Do not ask.

## Task: Step 2 - video quality (agreed Oct 23; started Oct 24 2026)
Source: CLAUDE.md "Open / waiting" + `docs/users-and-growth.md` "Oct 23 2026: review of real videos".
Problems: 51-108 s videos with one shot per 10-40 s; captions ~2% of frame height, low (under the
TikTok/Reels UI); -19.4 LUFS vs ~-14; first frame a generic stock shot.

Plan (all backend, `~/Tonefy-react/backend/server.js`, so installed builds benefit without OTA):
- [ ] 1. Pacing: in `/api/idea-to-video-v2` segment loop, split each segment into shots of ~2.5 s,
      each from a different Pexels result (per_page up to n+2; pick the mp4 nearest the frame size,
      not "hd"). AI clip (~5 s) supplies the first shots of its segment. Transitions stay between
      segments only; hard cuts inside. `extract-segments` returns optional `shots` (2-4 keyword
      phrases) per segment - include them in `segmentsSafetyText` so the safety cache still hits.
- [ ] 2. Length + hook: `generate-script` default (no targetSeconds) -> ~30 s instead of
      min(90, cap*0.6); system prompt: first sentence is a hook. `extract-url`: 60-90 s -> 30-45 s.
- [ ] 3. First scene: extract-segments prompt - segment 1 keywords = close-up of a person's face.
- [ ] 4. Captions: `buildAssFile` (~line 2407) STYLES are 20-32 px on a 720-wide canvas, alignment 2,
      marginV 80 (low). Make them bigger and higher (clear of bottom ~25%). Check `assStyleFromSpec`
      too - app sends captionMeta.spec for the 138-style catalogue, so the change must apply there.
- [ ] 5. Loudness: final mix `[aout]` (and no-music branch) -> `loudnorm=I=-14:TP=-1.5:LRA=11`.
      Verify with `ffmpeg -af ebur128` on a real render.
- [ ] 6. Render a real test video end to end (disposable account), check cuts/captions/LUFS,
      then record (history-log 50, CLAUDE.md state), commit + push both repos.

Done so far: read the v2 render code and buildAssFile; nothing edited yet.
Next: item 1.
