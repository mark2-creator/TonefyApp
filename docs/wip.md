# Work in progress - read this first when resuming

Kept current DURING a multi-step task so an interruption (usage limit, crash, new chat) loses
nothing. Update after every finished step; clear the task when it is done and recorded.
Resume = read this, check `git status` in both repos, carry on from "Next". Do not ask.

## Task: Open-list run (owner, Oct 24 2026: "go ahead ... then the remaining items in claude.md list continues")
Queue, in order:
- [x] A. Backend: convert every remaining shell `exec()` in `~/Tonefy-react/backend/server.js` to
      `execFile`/`run` with argv arrays (24 calls: ffprobe helpers, v1 idea-to-video, v2 concat/xfade/
      custom transitions/final mix, ~6835 auto-caption render, ~7800-8170 editor export pipeline).
      Watch: inside a shell double-quoted string `\\` became `\` - check every converted string for
      backslashes; `'...'` inside filters is ffmpeg quoting and stays. Test: node --check, restart,
      a real v2 render (disposable account) + an editor export (media-to-video / edit-video) if one
      can be driven by API. Backup before editing: scratchpad/server.js.pre-execfile.
- [ ] B. Step 3: Tonefy API for Pro/Creator (hashed keys from website Profile, plan checked per use,
      same credits, POST/GET /v1/videos, no posting in v1). Plan it in this file before coding.
- [ ] C. Remaining Open items I can do without the owner: review CLAUDE.md Open list again after B.
      Owner-only (do NOT do): Meta review (hands off), Pesapal (waiting on onboarding), rotate Brevo
      SMTP key + LinkedIn secret (consoles), Pinterest appeal, OpenClaw bind (asked owner).
Done so far: A done + verified + pushed (bd530bd4, history 51).
Next: B - write the Tonefy API plan into this file, then build it.
