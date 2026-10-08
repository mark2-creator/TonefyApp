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

- **Never do real work in `/tmp`** (a reboot wiped weeks of work once). Use the scratchpad for scratch.
- **Commit early, push after every commit, both repos**: `git -C ~/tonefy-build push origin rebuild/phase-4`,
  `git -C ~/Tonefy-react push origin master`. `git rev-list --left-right --count HEAD...@{upstream}`
  must read `0 0`. A published OTA update is not saved source.
- **Every piece of work is recorded in this file (or the right `docs/` file) and pushed as part of
  "done"** - decisions and reasons, not just the change. Strike stale lines in the same commit.
  Keep THIS file under ~40k: current state and rules here, the story in `docs/`.
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
  build is **vc13, cut from commit `c6281028`** (its only new native module vs vc12 is expo-store-review;
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
- **User text meeting a command line:** all binaries via `execFile` + arg arrays (never a shell); make
  text safe for EACH tool's syntax at the boundary (ffmpeg filter commas, ImageMagick `%` escapes via
  `imText()`, ASS braces/newlines). Motions must use ops in `MOTION_ALLOWED_OPS` or they silently don't render.
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

## Current state (Oct 4 2026)

**Play / builds.** Production, alpha and internal all on **vc13** (released Oct 3; adds Google's
in-app review sheet). Runtime `1.1.0`. Title "Tonefy AI: AI Video Generator", 8 screenshots, no promo
video (deliberate). Category Video Players & Editors. **First public reviews: 3 x 5 stars (Oct 3-4, all
on vc13), each answered with a developer reply Oct 4**; **the reviews became publicly visible on the Play listing
Oct 6 2026** (owner checked on the store himself). Only installers can rate (Play rule for every app). Details: `docs/play-store.md`.

**Plans and prices** (`backend/tiers.js` enforces; `constants/plan.js` mirrors for UI):

| | credits/cycle | max export | resolution | watermark | AI scenes/cycle (per video) |
|---|---|---|---|---|---|
| free | 10 | 2 min | 720p | yes | 0 |
| pro | 60 | 15 min | 1080p | no | 10 (2) |
| creator | 300 | 40 min | 1080p | no, priority render | 40 (4) |

1 credit = 1 started minute, deducted after success from the real duration; may go negative. Cycles
are 30 days from `creditsResetAt`. **Prices are regional since Oct 3 2026:** doubled in 44 high-income
markets (US Pro $13.99/mo $139.99/yr, Creator $29.99/$299.99; UK £11.99/£26.99; DE €13.99/€29.99),
unchanged in 130 others including **Uganda ($8.25 / $17.69)** - most real users are Ugandan. Before/after
backups in `~/ytshots/play-subs-*-2026-10-03.json`. Price patch needs `regionsVersion.version` `2026/01`.
The plans screen shows only Play's own price (no hardcoded fallback). Billing: Google Play, verified by
`/api/verify-purchase`; lapses via `subscriptionSweep` (6-hourly) and **RTDN** (Pub/Sub →
`/play-notifications?key=`; payload untrusted, re-asked of Play). **0 paying subscribers** so far.

**Admins** (`ADMIN_UIDS` in `.env`, owner `sWyTCf…` = ahumuzamark21213@gmail.com) are permanently
Creator and **not rationed for AI scenes**. `/api/admin/*` answers 404 to non-admins. **Accounts on a
paid plan with no `subscriptionPurchaseToken`** (reviewer/test accounts) get 3 AI scenes/cycle, 1 per video.

**AI scenes** (`backend/aiScenes.js`, fal.ai, details `docs/users-and-growth.md`): the first N scenes of an
Idea/Script/Url video are generated, the rest Pexels; every failure falls back to Pexels and is refunded.
Model `AI_SCENE_MODEL` = Seedance 1 Pro Fast 720p (~$0.0216/s; "720p" 9:16 is 704x1248). Off without
`FAL_KEY`. **Spend guards:** fal prepaid balance with auto top-up OFF (the real ceiling) → `$3/day`,
`$1/hour` caps reserved in Firestore `aiSpend/{UTC day}` (admins recorded as `adminUsd`, uncapped) →
per-user allowance; first cap trip per day emails the owner. App row `components/AiScenesRow.js`
defaults to "First scene" for anyone with scenes to spend.

**Social posting** (details `docs/social-posting.md`). Paid-only (`/api/post-now` and the sweep refuse
free). One registry `PUBLISHERS`; `/api/post-now` and `scheduledPostSweep` (5 min) share it. **Post Now is a
background job** (`async: true` → `job.posts` per platform/account with status + url); every publisher
returns a `url` and Edit & Post rows show "Posted · View" (one `PostRow` component). Multi-account
platforms have an account picker. LinkedIn captions are escaped as little text.

| Platform | Usable by anyone? | Notes |
|---|---|---|
| TikTok | yes | production app, **Direct Post audit approved Sep 24**; `TikTokPostSheet` (caption, privacy, disclosure) now opens for single posts, **Post Now AND Save to queue** - without it the server defaults to SELF_ONLY |
| Pinterest | yes | Standard access; `PinterestBoardSheet`: choose/**create (public only)**/search boards, optional link, 5 cover frames; row always shows the board + Change; choice saved to `users/{uid}.pinterestBoards` |
| LinkedIn | yes | member profile only; `LI_VERSION` must be current (`202606`); captions unescaped (TODO) |
| YouTube | yes, private uploads | **uploads forced PRIVATE until the YouTube API Services audit passes** (OAuth verification passed Oct 4 - a different review); `YouTubePostSheet`: own title + made-for-kids (remembered, `users/{uid}.youtubeMadeForKids`) |
| Facebook / Instagram | no | Meta dev mode; URSB registered Oct 8, Business Verification + App Review next (`docs/meta-app-review.md`). **"Coming soon" to everyone except admins and `META_REVIEWER_UIDS`** until `META_LIVE=true`; IG uses Instagram Login (`instagram_business_*` scopes) |
| X | not built | paid API |

Multi-account per platform (Creator) except YouTube. Tokens live in Admin-only collections
(`tiktokTokens/{openId}` with a server-written `uid`, `{platform}Tokens/{uid}.accounts`). YouTube,
Pinterest and LinkedIn **require a caption** in the app (it is the post's title). FitLife's
`~/social-publish.py` reads Tonefy's Pinterest/LinkedIn tokens - check it before reshaping token storage.

**Users and growth** (`docs/users-and-growth.md`). 32 accounts = 4 owner, 5 review/test, 15 closed-test
recruits (Aug 16-19), **9 post-launch strangers - none has finished a video**. Google's pre-launch
robot (`@cloudtestlabaccounts.com`) is excluded from admin stats and labelled "Google test device". My Videos
shows server-made posters (`/api/video-posters`) and titles from the first posted caption.
**Activation (Oct 6 2026):** dashboard card "Make your first video" (green "Start with an idea" + 3 example
ideas that prefill Idea to Video) until the account has a video (`utils/firstVideo.js`: `userVideos`, cached
once yes); **ProfileGate now waits for the first video**; **first-steps log** `utils/funnel.js` ->
`POST /api/funnel` -> `funnel/{uid}.steps` (fixed step list, first time only, off with the diagnostics switch,
in the privacy policy 2.2, purged on account delete), shown in Admin -> FIRST STEPS. **Email signup no longer signs the person out**: unverified accounts go straight to the dashboard, where
`VerifyEmailBanner` (resend with 60s cooldown, "I have confirmed", reloads the user on focus/foreground) sits
below the first-video card - the server never checked `email_verified`, so the old wall was app-only.
Finished-video screens (Idea/Script/Url): **"Save to my phone" is the one green button**, Post/Copy link are
outlined. Idea/Script/Url
render waits survive dropped polls (20 misses) and say "still being made" after 10 min instead of failing. **Rating prompt** fires after any finished video
(JobsContext) - native in-app sheet on vc13, neutral Linking prompt on older builds; never on the first
success, max every 60 days. **Reminders**: 19 local notifications at 18:00 (days 1-7 daily, then every
2 days to day 31), rebuilt on every app open, asked after the first finished video or on the dashboard
after a day; OFF is remembered.

**Google reviews** (`docs/google-verifications.md`): Play identity ✅ Aug 11, payments ✅ Sep 7,
**YouTube API Services audit OPEN - use case accepted Oct 5, awaiting the completion notice**,
**OAuth app verification APPROVED Oct 4** for `youtube.upload` (consent screen now shows Tonefy AI, no
"unverified app" warning, 100-user cap lifted). **Any new scope or ANY change to the OAuth consent
screen needs a NEW verification** - don't touch it casually. Watch both ...21213@ and ...254@ inboxes. Reviewer login `youtube.audit@tonefyai.app` (Creator, re-tested Oct 2).

**Email** goes out through Brevo (`smtp-relay.brevo.com`, from the verified `EMAIL_FROM`), including
the branded verification email (`/api/send-verification-email`) and AI-cap alerts.
**Next-day email** (`backend/nextDayEmail.js`, hourly sweep): ONE email, "Your first video is about 2 minutes
away", to accounts created 22-48h ago with a VERIFIED email, no video, not admin/test robot, not opted out.
Flag `emailPrefs/{uid}.nextDayAt` is written before sending (never twice). Signed one-click unsubscribe
`/email/unsubscribe?u=&t=` (HMAC, `EMAIL_LINK_SECRET` in `.env`) + List-Unsubscribe headers -> `emailPrefs.optOut`;
**any future automated email must check `optOut`**. Reply-To is the owner. Button -> `open.html` (intent link
to the app, Play Store fallback). In the privacy policy; `emailPrefs` purged on account delete.

## Open / waiting

- **Drop-off fixes: 1, 2 and 4 SHIPPED Oct 6 2026** (first-video card, ProfileGate after the first video,
  first-steps log - see Users and growth). **Read Admin -> FIRST STEPS after a week of new installs** and fix
  the biggest drop. **Email signups now go straight in (Oct 6)** with a "Confirm your email" card. **Next-day
  reminder email LIVE Oct 6** (owner's go-ahead; first 2 sent that day).
- Google: YouTube API Services audit decision (the one that lifts forced-private uploads). Submitted
  Aug 27; **Oct 5 2026 reply (`youtube-disputes` thread): "submitted details sufficiently justify the
  stated use case", no more info needed, they will notify on completion** - not yet the approval. Do NOT
  reply (nothing asked) and the Oct 12 follow-up is dropped. Never resubmit the form; change nothing in
  the YouTube/OAuth setup; keep the reviewer login working. On approval: confirm the quota in Cloud
  Console, then lift forced-PRIVATE uploads.
- **Meta go-live: URSB registration DONE Oct 8 2026** - **AHUMUZA FITLIFE SOLUTIONS**, reg. no. 80043893223863,
  sole proprietorship, Muliro Zone, Luwero Central, Luwero Town Council, Luweero District (commenced Oct 5).
  Website legal pages now name it; `data-deletion.html` added; reviewer login allowed via `META_REVIEWER_UIDS`.
  **Business Verification SUBMITTED Oct 8 2026 ~18:30 EAT** (existing portfolio 732676555725838 renamed to
  "Ahumuza Fitlife solutions", legal name AHUMUZA FITLIFE SOLUTIONS, Luweero address, website tonefy-ai.,
  email method via hello@fitlifesolutions.site, certificate + statement of particulars; Meta says ~2 business days).
  Developer app settings DONE Oct 8 (display name now Tonefy AI).
  **Owner's next steps** (App Review with exactly 5 permissions, screencasts; done: portfolio, Business Verification with BOTH PDFs - the certificate has no address -
  App Review with exactly 5 permissions, screencasts): `docs/meta-app-review.md`. After approval: Live +
  `META_LIVE=true`.
- Backend: convert the remaining `exec()` shell calls in `server.js` to `execFile` (no user text reaches
  them today, but one did - see history 46).
- Rotate: Brevo SMTP key and LinkedIn client secret (both were pasted into chat once).
- Pinterest blocks links to the whole `fitlifesolutions.site` domain as spam (an appeal is the owner's).
- Editor known gaps: no pinch-zoom on the timeline; `ImagePicker` sometimes omits a video's duration
  (falls back to 3s); 75 toolbar tools defined, ~25 built - **keep the unbuilt ones visible** (roadmap).

## Docs index - read the one a task touches

| File | Read it for |
|---|---|
| `docs/project-reference.md` | the original long versions of the setup and rule sections above (repos, website git, workflow, preview policy, design note, build-12 notes, working conventions) |
| `docs/bug-patterns.md` | the full story behind every bug-pattern rule, plus the Sep 17 input-handling security audit |
| `docs/editor.md` | rebuild phases 1-4, caption catalogue (138 styles) and canvas overlays, filmstrip/trim, live preview filters/motions, backend caption rendering, music library, known nits and gaps |
| `docs/social-posting.md` | posting chain, TikTok (second account, legacy route, audit), Content Calendar fix, who can use each platform, Oct 3 four-platform check, analytics scopes, FitLife token sharing |
| `docs/meta-app-review.md` | Meta Business Verification + App Review pack: legal facts, exact permissions, justifications, reviewer steps, screencast script |
| `docs/play-store.md` | ASO and listing, screenshots, ratings, testing tracks, RTDN, regional pricing details, Profile → Build |
| `docs/google-verifications.md` | the four Google verifications and the OAuth branding saga |
| `docs/website.md` | the website: build check, platform parity, Profile/Admin pages, icons |
| `docs/product-direction.md` | the owner's product direction: social posting, multi-account plan, toolbar roadmap, AI tiers |
| `docs/users-and-growth.md` | ProfileGate, account breakdown and drop-off analysis, admin robot, reminders, AI scenes design and pricing |
| `docs/history-log.md` | the full numbered history (items 1-45, Aug-Oct 2026): every build, publish, fix and verification with update ids |
