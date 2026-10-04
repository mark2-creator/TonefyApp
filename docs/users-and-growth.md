# Users and growth - onboarding, drop-off, reminders, AI scenes

Moved verbatim out of CLAUDE.md on Oct 4 2026 to keep that file small. Facts here are a
record of when they were written; CLAUDE.md holds the current state.

## Re-engagement reminders, rebuilt "like CapCut" (Oct 3 2026)

**Before:** three local reminders (days 1, 3, 7) and then silence, scheduled ONLY after an export in
the video editor - which was also the only place permission was asked. Idea/Script/Url to Video users
were never asked, and the post-launch strangers (none of whom finished a video) never got one. The
messages also carried emoji, against the app's own rule.

**Now** (`utils/notifications.js`, update group `f90be985-7267-44c6-8b94-62cc606233b6`):
- **19 local reminders at 18:00 local time: days 1-7 daily, then every 2 days to day 31.** Still local
  (no server, no cost, works offline); build 12/13 already carry expo-notifications + POST_NOTIFICATIONS.
- **Rebuilt from now on every app open and return to foreground** (`refreshReminders` in `App.js`),
  so a daily user never gets one - only someone who drifts away does.
- **14 rotating messages, each naming a real feature, each opening its screen when tapped**
  (`data.route`; cold launch handled with `getLastNotificationResponseAsync`). No emoji. The rotation
  start advances per series so a returning user does not restart at message one.
- **Asked after the first finished video from ANY screen** (JobsContext), and on the dashboard once
  the account is a day old - with our own one-line explanation before Android's dialog, because a
  "no" there is permanent. Asked once ever (`tonefy.notifPermissionAsked`). The editor's own ask was
  removed - JobsContext covers its exports too.
- **Turning reminders off is remembered** (`tonefy.notifOptOut`), so the automatic refresh never
  quietly re-enables them; the Notifications screen's switch ON passes `fromUser: true` to clear it.
- **One prompt per success:** BrandedAlert has a single host, so when the reminders question is asked
  the rating prompt waits for the next finished video (`recordWin` instead of `recordWinAndMaybeAsk`).
- **Not device-tested yet.** The discriminating test: allow reminders, then use Notifications ->
  "Send test notification" for the channel, and check one arrives at 18:00 the next day.

## Google sign-in captured no country and no usable name (`components/ProfileGate.js`)

**Found Sep 26 2026 by the owner, confirmed by measurement: 20 of 27 accounts had no
country, every one of them a Google account, and only 6 of 27 carried one at all.**
Sign-up by email asks for a full name and a country (item 6). Google sign-in cannot -
Google returns a name and an address and nothing else - and nothing asked afterwards, so
the field simply stayed empty. The admin screen's country breakdown had been reporting
on under a quarter of the user base without saying so.

**`components/ProfileGate.js`, mounted in `App.js` beside `BrandedAlertHost`.** Three
decisions worth not re-litigating:

- **Gated on the FIELD being missing, not on "is this a new sign-up".** That is the whole
  reason it repairs the existing accounts: the twenty already signed in never pass through
  `AuthScreen` again, so anything hooked to the sign-up path would only ever have helped
  future users. Verified against live data before shipping - it asks exactly those 20,
  skips the 6 that have one, and skips the 1 with no profile document at all (the backend
  creates that lazily, so it gets asked the launch after).
- **Dismissible**, per the sheet rule that every sheet backs out from its header. A
  required field captures marginally more on the first showing and traps anyone whose
  country is genuinely not on the list; asking again next launch gets there without
  holding the app hostage. Shown once per session via a module flag.
- **It does NOT create a profile document.** Asking someone for a country before anything
  of theirs exists would write a document containing only that.

**The trap this nearly shipped with: `CountrySheet` is itself a `Modal`.** Rendering it
inside `CountryGate`'s own `Modal` is a Modal inside a Modal, which on Android can put
the inner one behind its parent or drop it entirely - and it **bundles clean, passes
eslint, passes jsxrefs and passes `expo export`**, failing only on a real device. Exactly
the shape this file records four times already. They are siblings under a fragment now,
with the outer sheet hidden while the picker is up, so two modals are never on screen at
once. **Check whether a component you are about to nest is a `Modal` before nesting it.**

**It collects a FIRST and LAST name as well** (asked for Sep 26 2026, for personalised
email). Measured before building it: **26 of 27 accounts already had a name from Google**,
but only 8 had it mirrored into Firestore and **none** had it split into first and last -
which is the part an email actually needs. So it does not ask anyone to retype what the
app holds: the fields are **prefilled** by splitting the display name, and simulating the
gate against live data gave a prefilled first name for all 26 with none blank.

- **A surname is OPTIONAL.** Two accounts have a single-word name, and plenty of people
  legitimately have one. Requiring it would block them or teach them to type a full stop.
- **The split is shown for correction, never saved silently** - first-token-is-given-name
  is wrong for every culture that writes the family name first.
- **The name is mirrored back to Auth `displayName`**, because `ProfileScreen` reads that
  and two stores disagreeing would show one person under two names. Non-fatal: the
  Firestore record is the one that counts.

Renamed from `CountryGate` when it grew the name fields - a component called `CountryGate`
that asks for names is exactly the kind of name that misleads the next reader.

**Two device findings, both fixed Sep 26 2026:**

- **The Save button sat under the Android navigation buttons** - the sheet's primary
  action, unreachable. `useSheetInset()` returns a **STYLE OBJECT**, `{paddingBottom: n}`,
  and this wrote `{ paddingBottom: sheetInset }`, nesting an object inside a style
  property. React Native silently drops that, so the sheet had no bottom padding at all.
  **Valid JS, valid JSX, passes `eslint --quiet`, `expo export` AND jsxrefs** - nothing
  static has an opinion about the shape of a style value. 41 other call sites spread it
  correctly (`style={[styles.sheet, sheetInset]}`); this was the only one wrong.
  **Now a MUST in the `tonefy-design` skill** (owner's request): nothing interactive may
  sit under the navigation bar or gesture pill, the padding cannot be a fixed number
  because the bar differs per device, and the three-button device is the tightest case to
  check against.
- **"Tell us who you are" read as a demand.** Now "Nice to meet you", explaining what the
  answers buy the user (the languages and voices people actually need) rather than what
  the app wants. Owner's standing preference: good, polite, friendly and professional.

Published to `production` Sep 26 2026: `98b71a94-f98a-492a-83d5-e8b2fb6896ce` (country),
`518e7a07-a7ad-45a2-9ea5-0cda9b2f1c56` (name + country), then
`45e89282-2e65-48fe-a021-4708126050a0` (copy + safe area).

## AI scenes in Idea/Script/Url to Video, via fal.ai (Oct 2 2026)

**Built and deployed, OFF until `FAL_KEY` is in `~/Tonefy-react/backend/.env`.** With no key the
server ignores `aiScenes` and `/api/ai-scenes/status` says `available:false`, so the app row renders
nothing. Backend `aiScenes.js`; app `components/AiScenesRow.js` on the three generation screens.

- **Hybrid, and AI is never load-bearing.** The first N segments (hook first) are generated, the rest
  are Pexels, and any scene that fails, times out (150s), is refused or hits a cap resolves `null` and
  takes the old Pexels path. Generations run concurrently, so the wait is the slowest clip.
- **Model is one string, `AI_SCENE_MODEL`.** Default **Seedance 1 Pro Fast, 720p** - priced from the
  real schema and pages, it is better AND cheaper than Wan 2.2 (~$0.11 vs $0.40 per 5s). **Hailuo 02
  t2v has no `aspect_ratio` input - landscape only - so it is out for a portrait app.** Kling 2.1
  Master is $1.40/5s. Read model inputs from `fal.ai/api/openapi/queue/openapi.json?endpoint_id=...`,
  not from the rendered docs page, which lies by omission.
- **Allowance separate from credits**: free 0, pro 10/cycle 2/video, creator 40/cycle 4/video, clip 3-8s.
  Tied to the credit cycle by stamping `aiScenesCycle = creditsResetAt`, so none of the four refill
  paths had to change. Reserved in a transaction, **refunded for failures and cache hits**.
- **Spend guards, outermost first**: the fal PREPAID BALANCE with auto top-up off (fal has no separate
  spend limit - the balance is the ceiling, even for a leaked key); then **$3/day and $1/hour** caps
  (`AI_SCENE_DAILY_USD_CAP` / `AI_SCENE_HOURLY_USD_CAP` in `.env`) **reserved in a Firestore transaction
  on `aiSpend/{UTC day}` before every fal call** - they were in memory first, and a crash loop under pm2
  would have reset them each lap; fails CLOSED. The first trip of each cap per day **emails the owner**
  (Brevo, to `AI_SCENE_ALERT_EMAIL` or `EMAIL_USER`), flagged on the same doc so restarts do not resend -
  verified landing in the Gmail INBOX Oct 3. Then the per-user allowance. **Pro/Creator with no
  `subscriptionPurchaseToken` (reviewer, hand-set test accounts) get 3/cycle, 1/video**. **Admins (the
  owner's ahumuzamark21213@ account) are not rationed at all** - no allowance, no caps, by owner request
  Oct 3 2026 so he can test freely; their spend is recorded as `aiSpend.adminUsd`, outside the capped
  totals. The fal balance is the only ceiling on an admin. **Aborting the client's wait does
  not stop fal billing** - the code calls `fal.queue.cancel` on timeout; the client's own `timeout`
  option is documented as not enforced.
- 7-day prompt cache in `backend/cache/aiscenes` (gitignored, swept by age), so a retried render is free.
- **Verified** against the real fal API with an invalid key: reserve 2 of 5 asked (per-video cap),
  fal refused, both refunded, stale cycle reads 0, free gets 0.
- **LIVE Oct 3 2026, real generation verified.** Owner's fal account: prepaid $10, auto top-up OFF (the
  balance IS the cap - fal has no separate spend limit), key scope API, `FAL_KEY` in `.env`. A full
  `/api/idea-to-video-v2` render with `aiScenes:1` took 85s, scene 1 generated in 28s (~$0.08 for 4s),
  scenes 2-3 Pexels, allowance 40 -> 39. **"720p" 9:16 is really 704x1248**; 480p is 480x864 at half
  the price. Compared side by side at export size: 480p is visibly softer in foliage and faces, and the
  AI clip is the HOOK sitting next to HD stock, so **720p stays** - the margin holds at 720p anyway.
  **Published to `production` Oct 3 2026** as update group `8a234f95-17cb-4789-bcd1-9b1d9d48889f`
  (commit `126df9e0`, runtime 1.1.0) - every Play install on build 12 takes it on its next cold starts.

## "Names that are not real names" in Admin -> Accounts: not a bug (checked Oct 3 2026)

The list shows each account's own `displayName` - for a Google sign-in, whatever that person's Google
profile is called, copied as-is. Checked against Auth metadata, the odd ones are:
- **`*@cloudtestlabaccounts.com` ("Nuage Laboratoire") is Google's pre-launch report robot** (Firebase
  Test Lab), created 06:34 Oct 3 - minutes after build 13 was uploaded. **One appears per uploaded
  build**, and it inflates "New this week".
- **"ytapitest Hyd" (Sep 7) is the YouTube API audit team** testing the integration.
- "Basic Account", "Just Another", "Nata", "Gyy" etc. are real Google/password sign-ins whose own
  profile names look like that. Common to all of the recent ones: **one session, 0 videos, no country,
  never returned** - an activation problem worth more attention than the names.

**Robot now handled (Oct 3 2026):** `isTestDeviceUser()` in `server.js` (email `@cloudtestlabaccounts.com`)
- excluded from every admin count (total, new this week, verified, active), from the plan tally and from
the orphan-doc check (its profile document would otherwise read as an orphan - caught on the live
endpoint, not by reading); reported as `testDevices`; list rows carry `testDevice: true` and both admin
screens title it "Google test device" with the address underneath. Live after the fix: 32 accounts,
plans sum 32, 0 orphans, 1 test device. App update `1778f3b1-f462-4c31-8804-8f837d50e7e3`.

### Why new users leave (investigated Oct 3 2026)

**Only 3 of 33 accounts have EVER made a video** - and two of those are the owner and the YouTube
review account. 12 came back more than a day after signing up. Server requests lined up against each
signup time:
- **Most recent signups made NO request at all after signing in** - no script, no audio, no render. They
  looked and left. The app reads plan/profile from Firestore directly, so the dashboard itself makes no
  backend call - silence means nothing was started.
- **Pawel (Sep 22) tried and hit a bug:** generate-script -> generate-audio -> **extract-segments four
  times in 15s**, then stopped before ever rendering. Extract-segments returned EMPTY until the
  reasoning-budget fix on Sep 24 (see that bug pattern) - a real user lost to a bug since fixed.
- **Rita (Sep 18, email signup) never verified her address** and so could never sign in (`AuthScreen`
  blocks unverified logins) - lost at the verification wall.
- First-run path today: sign in -> the ProfileGate sheet asks for names + country immediately -> a
  dashboard of ~11 equal cards ("Choose a workflow") with no guided first step. None of the recent
  signups ever set a country, so each dismissed the gate or left at it.
- **There is no funnel data**, so where exactly people quit is inferred. Proposed fixes put to the owner.
- **Correction from the owner the same day: most accounts are his closed-test recruits, not users.**
  The Play API cannot confirm it - `edits.testers.get` returns `{}` for internal/alpha/beta because
  it only exposes GOOGLE GROUPS; testers entered as Console EMAIL LISTS are invisible to it. Grouped by
  creation date against the 14-day closed test that preceded the Sep 3 production application, the 33:
  **4 the owner's own**, **5 review/test** (Test User, Play Reviewer, YouTube Audit, Google's
  "ytapitest" reviewer, the Test Lab robot), **15 closed-test recruits** (Google sign-ins Aug 16-19,
  exactly the recruitment window), and **9 after the Sep 8 launch** - the only real strangers. Of
  those 9, none has made a video and one (Sep 22) tried and hit the extract-segments bug. So the
  activation finding stands, on a sample of 9 rather than 33.

## My Videos: real thumbnails and titles (Oct 4 2026, app `25d7fc2e-b7f0-41e9-a60f-46f1e88a7a1d`)

Owner: "the thumbnails take a very long time". They never loaded: each card was a deliberate placeholder,
because the first version mounted an expo-video player per card and froze low-end phones (the
"My Videos stops responding" ANR), and real posters were left as "a future enhancement".
- **`ensurePoster()`** (server) writes `<video>.poster.jpg` beside each video - frame at 1s (frame 0 for
  shorter clips), 360 wide, 5-33KB. Made by all three `userVideos` writers when a video is recorded,
  and on request by **`POST /api/video-posters`** (caller's own videos only, <=60, 3 at a time).
  Deduplicated per file, written atomically. `cleanupOldFiles` keeps a poster while its .mp4 exists and
  deletes it after - it does NOT age out at 72h like other non-video files. Measured on the owner's 11
  videos: 2.1s cold, 78ms warm; served with a 30-day cache.
- **Titles:** a video is named from the caption it was FIRST posted with (first line, hashtags removed,
  cut at a word with an ellipsis past 60 chars) - `setVideoTitleFromCaption` in post-now. The old
  "Uploaded media video" placeholder is never a title (it was once sent out as a caption, before Sep 27 -
  the dry run caught two). Display rule everywhere: `title` → idea/prompt → "Edited video". Backfilled 4.
- App: `MyVideosScreen` (poster Image + play button, one request per list) and the Thumbnail screen's
  list. Website `my-videos.html`: posters instead of a `<video preload>` per card, the same titles, text
  now escaped before innerHTML, and its last two emoji replaced by Material SVGs.
