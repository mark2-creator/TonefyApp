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
- [x] B. Step 3: Tonefy API for Pro/Creator (hashed keys from website Profile, plan checked per use,
      same credits, POST/GET /v1/videos, no posting in v1). Plan it in this file before coding.
      DESIGN (decided Oct 24):
      - Keys: `tfy_live_` + 32 random bytes (base64url). Stored ONLY as sha256 -> doc `apiKeys/{hash}`
        {uid, prefix (first 14 chars, shown in UI), name, createdAt, lastUsedAt, revokedAt}. Shown once.
        Max 3 active per user. Create needs plan pro/creator (or admin); every /v1 call re-checks the plan
        (a lapsed plan's keys stop working without being revoked). Purged in /api/account/delete.
      - Key management (Firebase token, website Profile): GET /api/api-keys, POST /api/api-keys {name},
        POST /api/api-keys/revoke {id}. Module `backend/apiKeys.js`.
      - Public API under `/v1` (outside /api, so no verifyToken; own per-key limiter):
        GET /v1/me -> plan + credits. POST /v1/videos {idea | script, voice?, aspect_ratio?,
        caption_style?, music?} -> 202 {id, status}. GET /v1/videos/:id -> {id, status, progress,
        video_url (absolute), error}. Errors `{error: {code, message}}`. No posting in v1. AI scenes 0 in v1
        (spend caps; maybe later).
      - Same pipeline as the app: safety screen -> script (idea) -> voice -> segments -> v2 render,
        same credit check/deduction. Needs REFACTOR of server.js routes into functions:
        generateScriptText, synthesizeVoiceover, splitIntoSegments, runV2Render(jobId, ...).
        Routes keep behaviour; re-run the render test after the refactor BEFORE adding /v1.
      - Website: Profile "API keys" card (Pro/Creator; free sees what it is + upgrade link) and a docs
        page `api-docs.html` (curl examples). `scripts/check-website-js.py` after. App: no change.
      Steps: [x] B1 refactor + render test  [x] B2 apiKeys.js + key routes  [x] B3 /v1 routes + live test
             [x] B4 website Profile card + api-docs.html  [x] B5 record + push
- [ ] C. Remaining Open items I can do without the owner: review CLAUDE.md Open list again after B.
      Owner-only (do NOT do): Meta review (hands off), Pesapal (waiting on onboarding), rotate Brevo
      SMTP key + LinkedIn secret (consoles), Pinterest appeal, OpenClaw bind (asked owner).
Done so far: A, B done and recorded (history 51-54). Edge voices fixed (venv).
Next: C1 - Pesapal adapter in backend/webPayments.js (API 3.0, SANDBOX, payments stay OFF; Flutterwave
  code kept switchable or replaced; same grant logic + test-web-payments.mjs style test with fake Pesapal).
  Then C2 editor gaps? (needs device testing - probably leave). Then clear this file.
