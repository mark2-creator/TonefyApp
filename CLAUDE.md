# Tonefy AI — Project Context for Claude Code

React Native / Expo SDK 54 mobile video editor (Android), CapCut/Canva quality bar, plus a
Node/Express backend and a static website. Owner: Ahumuza (works from Termux on a phone + SSH
to a Contabo VPS, often on slow Ugandan mobile data). **He is a sole developer with paying-user
ambitions: decide the best option yourself rather than handing back a menu, but show a plan
before large changes when he asks for one.**

This file holds the RULES and the CURRENT STATE. Long history, specs and full bug write-ups live
in `docs/` (index at the bottom) - read the relevant file when a task touches that area. It was
cut from 377k to this on Oct 4 2026; every original line is preserved verbatim in `docs/`.

## Where things are (do not confuse these)

| Path | What |
|---|---|
| `~/tonefy-build` | ✅ THE app working copy. Repo `mark2-creator/TonefyApp`, branch **`rebuild/phase-4`** |
| `~/Tonefy-react/backend` | Backend, repo `mark2-creator/Tonefy-react` (branch `master`), pm2 **`tonefy-backend`**, `server.js` (~7k lines), port 5000 |
| `/var/www/tonefy-ai` | Live website (hand-written HTML, nginx). Git dir is **`~/tonefy-website.git`** - repo `mark2-creator/tonefy-website` |
| `~/TonefyApp`, `/tmp/tonefy-build` | ❌ stale decoys - never edit |
| `~/fitlife/CLAUDE.md` | the owner's OTHER business (WooCommerce ebooks + blog). **Never mix the two files** |
| `~/ytshots/` | review evidence, Play price backups, listing backups |
| `~/builds/` | downloaded AABs (e.g. `tonefy-vc13.aab`) |

- **Website git:** `git --git-dir=~/tonefy-website.git add <specific pages>`; **never `add -A`** (the
  webroot holds unrelated things, e.g. `vitablast/`) and **never `git init` in the webroot** (it made
  `.git/config` downloadable once).
- **One backend, two clients.** App and website both call `https://api.fitlifesolutions.site`
  (nginx → localhost:5000). `api.` resolves straight to the VPS; `tonefy-ai.` goes via Cloudflare.
  Site endpoints: idea-to-video-v2, extract-segments, generate-script. App editor: media-to-video,
  upload-media, edit-video. Shared: `/api/job`, generate-audio.
- **Every `/api` route registered after `app.use("/api", verifyToken)` (line ~1516) is behind it**; a few above it carry `verifyToken` inline. A call with no token
  gets a 401 whose JSON lacks every field the caller reads, so features silently do nothing - in
  the app always send the Firebase ID token. OAuth callbacks and `/play-notifications` are
  deliberately outside `/api`.
- **Registration order decides middleware**: CORS, rate limiters and verifyToken apply only to routes
  registered after them. Put new middleware above all routes.

## How to work

- **Interrupted work resumes itself.** For any multi-step task, write the plan to `docs/wip.md` FIRST and update it
  after every step (done / next / uncommitted state); clear it when the task is recorded. An hourly scheduled task
  ("Tonefy: resume interrupted work", `trig_01W9DWr4bSWuYspGxjMBbNDR`) tells this session to read it and carry on
  after a usage limit - no reminder from the owner needed. On "continue" or that check: read `docs/wip.md`, act.
- **Never do real work in `/tmp`** (a reboot wiped weeks of work once). Use the scratchpad for scratch.
- **Commit early, push after every commit, both repos**: `git -C ~/tonefy-build push origin rebuild/phase-4`,
  `git -C ~/Tonefy-react push origin master`. `git rev-list --left-right --count HEAD...@{upstream}`
  must read `0 0`. A published OTA update is not saved source.
- **Every piece of work is recorded in this file (or the right `docs/` file) and pushed as part of
  "done"** - decisions and reasons, not just the change. Strike stale lines in the same commit.
  Keep THIS file under ~20k (it is loaded into every message): rules + short current state here, the story in `docs/`.
- **Checks after a meaningful app change** (each catches what the others miss):
  - `npx expo export --platform android 2>&1 | tail -20` - bundles, but **does not** catch undefined names
  - `npx eslint . --quiet` - **must be silent** (0 errors; ~144 warnings are deliberate). `no-undef`
    and `no-dupe-keys` are errors.
  - `python3 scratchpad/jsxrefs.py <files>` - every JSX tag resolves (after deleting a component)
  - `python3 scripts/check-gesture-composition.py` - after any gesture-handler change
  - `python3 scripts/check-website-js.py` - after ANY website edit (parse + eslint no-undef per page)
  - `node scripts/check-friendly-error.mjs` - after changing `utils/friendlyError.js` patterns
  - Nothing static checks prop NAMES, style-object SHAPES, Modal nesting or touch handling - only a device.
- **Backend:** `node --check server.js`, then `pm2 restart tonefy-backend`, then confirm the process
  start time postdates the edit and test the LIVE endpoint (boot takes ~15s - a 502 right after a
  restart is boot, not failure). Mint a test ID token with the Admin SDK custom-token exchange
  against a disposable account; delete test accounts/docs afterwards.
- **Publishing = `npx eas update --branch production --message "..."`** - do it yourself as part of
  finishing an app change (owner's standing preference; real users are on `production`).
  Builds at runtime `1.1.0` take it on their next cold starts (two restarts to apply).
- **Before every `eas update`: `git diff <commit-of-installed-build>..HEAD -- package.json`.** Any new
  native module must be `require`d lazily inside a `try` with every entry point a no-op when absent
  (`utils/notifications.js`, `utils/rateApp.js`) - a top-level import of a missing native module
  throws at launch and takes the whole app down (`expo-secure-store`, history item 29). The installed
  build is **vc14, cut from commit `035e0b49`** (Oct 12 2026; no new native module vs vc13 `c6281028`;
  vc12 was `20fafb14`).
- **`npx expo install`, never `npm install`, for Expo packages.** Then **`git diff android/`**: expo
  tooling has silently rewritten `AndroidManifest.xml` twice (the `android/` folder is committed;
  nothing prebuilds, so config plugins never run - permissions are written by hand).
- **`READ_MEDIA_VIDEO` / `READ_MEDIA_IMAGES` must stay OUT of the manifest** - Play rejected build 10 for them.
- **Native builds:** `npx eas build --platform android --profile production --non-interactive --no-wait`
  (versionCode auto-increments remotely; keystore `qMlH7ffwtv`). Verify inside the AAB before upload
  (dex strings, manifest permissions, `runtimeVersion` 1.1.0). Upload via the Play Developer API with
  the Firebase service account (`edits.bundles.upload` → `tracks.update` → `commit`); `eas submit`
  does not work non-interactively. **Keep `internal`, `alpha` and `production` on the same vc** - Play
  serves a tester the highest-priority track they are in.
- **"Is the fix on the phone?"** - Profile → Build shows channel, runtime and publish time. Check it
  before diagnosing any device report; a commit is not a publish.
- **Look things up instead of reasoning about third-party flows** (Google/Play/TikTok consoles cost
  six wrong guesses once). Read the screen or the docs; probe an API with a deliberately bad payload
  to learn which gate you hit without side effects.
- **External actions:** sending email, publishing, posting, price changes and Play releases need the
  owner's go-ahead in the conversation; test posts are deleted afterwards (Pinterest/YouTube can be;
  a LinkedIn test post reaches his connections' feeds - don't).

## Bug patterns - the one-line rules (full write-ups: `docs/bug-patterns.md`)

- **Config methods on a composed gesture** (`.enabled()` on `Gesture.Race/Simultaneous`) throw at
  render → grey screen. Apply them to leaf gestures. Guard: `check-gesture-composition.py`.
- **A deleted `useState`/component whose call sites remain** bundles fine and crashes on that branch → eslint `no-undef`.
- **Google Sign-In "cancelled" the user did not cause = config rejection.** Count the signing certs
  (upload, app-signing, PREVIOUS app-signing after rotation, post-quantum) - all must be registered.
- **A record the client can write is a CLAIM, never a credential.** Ask of any authorisation check
  *who wrote the thing it reads*; check at the point of use (inside the publisher), not per route.
- **A reasoning model's `max_tokens` is shared with its reasoning** → empty content. `groqChat` sets
  `reasoning_effort: 'low'`. A fallback that always fires looks like success.
- **A field written but never read** (TikTok `expiresAt`) is an unfinished feature - grep for readers.
- **Many siblings in one Android view group are O(n²) per frame** (ANR on the main thread). Cap and
  group anything that scales with content length (Waveform, FilmStrip).
- **A wrapper that inherits a positioned (`absolute`) style** stacks its children; grouping is only
  transparent for absolutely-positioned children.
- **A canvas made the right SHAPE at the wrong SCALE** (ASS `PlayRes` = real size while sizes were
  written for 720-wide): 1080p captions burned at 2/3 size until Oct 3 2026. Rescale every number
  with the space, or keep the space and change only its aspect.
- **Flex:** a horizontal chip row needs `flexGrow:0, flexShrink:0` on style and `alignItems:'center'`
  + padding on `contentContainerStyle`; `flex:1` inside a `maxHeight` parent resolves to zero.
- **User text meeting a command line:** all binaries via `execFile` + arg arrays (`ffmpegRun`/`run`; `exec` is not imported); make
  text safe for EACH tool's syntax at the boundary (ffmpeg filter commas, ImageMagick `%` escapes via
  `imText()`, ASS braces/newlines). Motions must use ops in `MOTION_ALLOWED_OPS` or they silently don't render.
- **Facebook `/me/accounts` omits Pages reached through a business portfolio** -> use `debug_token` granular_scopes target_ids (fixed Oct 22 2026 in `metaFetchPages`).
- **Unbounded text beside a `flex: 1` sibling in a row** squeezes that sibling to 0 (it then wraps
  letter by letter - a tall row) and pushes trailing buttons off screen. Give long text its own
  truncating line in a `flex:1, minWidth:0` column. **Layout bugs can be reproduced off-device with
  `yoga-layout` (npm)** - RN's own engine; done for the Pinterest row Oct 4 2026.
- **`useSheetInset()` returns a style OBJECT** - spread it (`[styles.sheet, inset]`), never
  `{ paddingBottom: inset }`. Nothing interactive under the Android nav bar.
- **Never a Modal inside a Modal** (Android drops or buries the inner one); close a sheet before
  showing a BrandedAlert. **BrandedAlert has one host** - two prompts at once replace each other.
- **`onPress={fn}` passes the press event as the first argument**; `showAlert` dismissal runs no
  button - pass `{ cancelable: false }` when awaiting its outcome.
- **A server-side default that fills a user-visible field publishes words the user never wrote**
  ("Tonefy video" on Pinterest/LinkedIn, removed Oct 3). One deliberate exception: TikTok keeps
  `title || 'Created with Tonefy AI'` by the OWNER's decision (Sep 27, commented in `publishToTikTok`)
  as a safety net behind the sheet's AI-written caption - do not "fix" it without asking.
- **A purge list is a place new work must be added**: a new platform's token collection goes into
  `/api/account/delete` in the same commit.
- **A backup that commits but cannot push protects nothing.** Check `@{upstream}..HEAD`.
- **Never show `e.message` to a user.** App: `friendlyError(e, '<what failed>')` / `friendlyText(job.error, ...)`
  (`utils/friendlyError.js`; offline/timeout/server get fixed sentences, raw text goes to logs). Backend:
  `publicError(e, fallback, tag)` (`backend/publicError.js`) for every `error:`/job message. A raw
  `Unable to resolve host ...` reached users until Oct 5 2026; ffmpeg/ENOENT/API text could too.
- **A URL from a user is fetched only via `safeFetch` (`backend/safeFetch.js`)** - plain `fetch`/`downloadToFile`
  on it let anyone read localhost services and the metadata IP until Oct 24 2026 (history 49).
- **`JSON.stringify` is not shell quoting** - `sh` expands `$(...)` inside double quotes. `/api/generate-audio`
  was a command-injection hole for any signed-in user until Oct 5 2026 (`docs/history-log.md` 46).

## Design rules (full: `.claude/skills/tonefy-design`; when it and the app disagree, THE APP wins)

- **Green `#2ECC71` = this action commits** (Export, Apply, Post, selected value). **Teal `#00d4d4` =
  handling media** (waveform, trim handles, sliders, scrubber, progress). Decoration is neutral.
  The bottom tab strip is green.
- **Social platforms always use their official logo (`components/BrandLogos.js`) and their name in
  the platform's brand colour** - Facebook `#1877F2`, Instagram gradient/`#D62976`, TikTok black +
  `#25F4EE`/`#FE2C55`, YouTube `#FF0000`, Pinterest `#E60023`, LinkedIn `#0A66C2`.
- **Paid = gold `#f5c451` `diamond`, never a padlock** (a padlock only for security, e.g. 2FA).
  Unbuilt tools stay visible, dimmed `#5a5a5a`, "Coming soon".
- **No emoji in UI or notifications.** Material Icons only, sizes 12/20/24; verify names against the
  installed glyphmap (a missing name is a blank square).
- Bottom sheets only, `SheetHeader` + `useSheetInset`. Cards wear `GradientBorder`. Editor stays dark;
  the rest follows `ThemeContext`.
- Copy: sentence case, polite and friendly, say what the user gains.

## Current state (Oct 24 2026) - detail and history: `docs/state-archive.md` + topic docs

- **Play:** live, production/alpha/internal all **vc14** (runtime 1.1.0). Removed Oct 12 over AI-content
  reporting, fixed same day, back on the store. **Every AI surface must carry a ReportLink** (`ReportContentSheet`
  -> `/api/report-content`). 3 public 5-star reviews. `docs/play-store.md`.
- **Plans** (`backend/tiers.js` enforces, `constants/plan.js` mirrors): free 10 credits/2 min/720p/watermark/0 AI
  scenes; pro 60/15 min/1080p/10 (2 per video); creator 300/40 min/1080p/priority/40 (4). 1 credit = 1 started
  minute, deducted after success; 30-day cycles. Regional Play prices (Uganda $8.25/$17.69; 44 rich markets doubled).
  **0 paying subscribers.** Admins (`ADMIN_UIDS`, owner `sWyTCf…`) are permanent Creator, not rationed.
- **AI scenes** (`backend/aiScenes.js`, fal.ai Seedance 720p): first N scenes AI, rest Pexels, failures refunded;
  spend caps $3/day $1/hour in `aiSpend/{day}`. Gemini Omni admin option built, OFF. `docs/users-and-growth.md`.
- **Social posting** (paid only; one `PUBLISHERS` registry for Post Now + `scheduledPostSweep`): TikTok, Pinterest,
  LinkedIn, **YouTube (API audit APPROVED Oct 22; user picks Public/Unlisted/Private, OTA `fe16fbd2`; quota 200/day
  until ~Apr 2027 - reapply/audit then)**. Facebook/Instagram: "Coming soon" except admins + `META_REVIEWER_UIDS`
  until `META_LIVE=true`. TikTok keeps `'Created with Tonefy AI'` fallback by owner's decision. `docs/social-posting.md`.
- **Users:** ~32 accounts, few strangers. Funnel since Oct 6 (21 users): dashboard 21 -> script 11 -> video 9 ->
  **saved 3**. Activation work shipped Oct 6 (first-video card, funnel log, next-day email, email signup without wall).
- **Voices:** Edge (paid) voices run from `backend/.venv-tts` (edge-tts pinned). If they fail with 403:
  `backend/.venv-tts/bin/pip install -U edge-tts` + restart (history 54).
- **Content safety (Oct 24):** `backend/contentSafety.js` screens every idea/script/voiceover/AI-scene text
  (blocklist -> Groq gpt-oss-safeguard-20b -> gpt-oss-20b/120b on 429; cached; fails OPEN) and rejects LLM
  refusals; 422 `content_blocked`/`refusal`; blocks logged to `safetyBlocks` (purged on account delete). **Any
  new route that voices, captions or generates from user text must call `safety.screen` first.** History 48.
- **Email:** Brevo; any automated email must check `emailPrefs.optOut`.
- **Firestore rules** (`backend/firestore.rules`, source of truth): clients may only write profile fields - **any new
  client-written `users` field must be added to `profileFields()` first**.

## Open / waiting (Oct 24 2026)

- **Oct 23 plan DONE Oct 24:** safety (history 48), video quality (50), **Tonefy API v1** for Pro/Creator (53: `/v1`,
  keys on website Profile, `api-docs.html`, same credits, no posting). **Never TikTok posting via the API** (owner, Oct 25): TikTok's Direct Post rules need the person to pick privacy/interactions/disclosure and consent on screen before each upload; server-to-server posting breaks them and risks the audited access ALL users share. Other platforms only if asked, with per-user daily caps (YouTube quota is shared). Findings: `docs/users-and-growth.md` (Oct 23 review). Remotion:
  not as the engine; maybe later for animated intro/end cards only.
- **Meta App Review SUBMITTED Oct 23** (5 permissions + public_profile, "within 20 days"). Don't touch Meta app
  settings/scopes/reviewer account meanwhile. On approval: app Live + `META_LIVE=true`. `docs/meta-app-review.md`.
- **Web payments: Pesapal adapter BUILT Oct 24** (history 55, sandbox-tested), payments OFF until the owner puts
  `PESAPAL_CONSUMER_KEY/SECRET` in `.env` after Pesapal approves (onboarding: Michael Ntale; amended URA certificate
  follow-up drafted for the owner to send). Switch-on steps: `docs/web-payments.md` (24 Oct). **The app must never
  mention web payment** (Play rule).
- Website app pages: full width since Oct 25 (`assets/app-wide.css`, `--page-w` per page; never a body max-width again) and **rebuilt to match the app** Oct 25 (`assets/report.js` = ReportLink on site AI surfaces). Not yet: Edit & Post per-platform sheets (TikTok/YouTube/Pinterest); site tools beyond Idea to Video show Coming soon. `docs/website.md`.
- **Play policy email Oct 29 2026:** only two items touch us, both owner actions in Play Console: (1) Japan is a
  sales region, so complete Play's Japan payments authorization by **Dec 1 2026** or ALL payouts are held; (2) declare
  trader status (from Nov 2026). Rest n/a (no location/contacts/SMS/all-files perms; targetSdk 36). Watch: Feb 2027
  memory/code-size quality bar.
- Business docs: URSB 80043893223863; URA TIN 1040051408 amended Oct 20 to show AHUMUZA FITLIFE SOLUTIONS.
- VPS has no firewall: services must bind 127.0.0.1 (backend does since Oct 24). OpenClaw still on `0.0.0.0:18789`,
  owner's call (history 49).
- Backend: ~~convert `exec()` to `execFile`~~ DONE Oct 24 (history 51; use `ffmpegRun`, never a shell). Owner: rotate Brevo
  SMTP key + LinkedIn secret.
- Pinterest blocks links to `fitlifesolutions.site` (appeal is the owner's). Editor gaps: no timeline pinch-zoom;
  ~25 of 75 toolbar tools built - keep unbuilt ones visible.

## Docs index - read the one a task touches

| File | Read it for |
|---|---|
| `docs/project-reference.md` | the original long versions of the setup and rule sections above (repos, website git, workflow, preview policy, design note, build-12 notes, working conventions) |
| `docs/bug-patterns.md` | the full story behind every bug-pattern rule, plus the Sep 17 input-handling security audit |
| `docs/editor.md` | rebuild phases 1-4, caption catalogue (138 styles) and canvas overlays, filmstrip/trim, live preview filters/motions, backend caption rendering, music library, known nits and gaps |
| `docs/social-posting.md` | posting chain, TikTok (second account, legacy route, audit), Content Calendar fix, who can use each platform, Oct 3 four-platform check, analytics scopes, FitLife token sharing |
| `docs/meta-app-review.md` | Meta Business Verification + App Review pack: legal facts, exact permissions, justifications, reviewer steps, screencast script |
| `docs/web-payments.md` | Flutterwave web passes: prices, grant/verify design, Play rule, how to switch on |
| `docs/play-store.md` | ASO and listing, screenshots, ratings, testing tracks, RTDN, regional pricing details, Profile → Build |
| `docs/google-verifications.md` | the four Google verifications and the OAuth branding saga |
| `docs/website.md` | the website: build check, platform parity, Profile/Admin pages, icons |
| `docs/product-direction.md` | the owner's product direction: social posting, multi-account plan, toolbar roadmap, AI tiers |
| `docs/users-and-growth.md` | ProfileGate, account breakdown and drop-off analysis, admin robot, reminders, AI scenes design and pricing |
| `docs/state-archive.md` | the full former Current state / Open sections (Meta, Flutterwave/Pesapal, YouTube, Play, users) - verbatim, Oct 24 |
| `docs/history-log.md` | the full numbered history (items 1-45, Aug-Oct 2026): every build, publish, fix and verification with update ids |
