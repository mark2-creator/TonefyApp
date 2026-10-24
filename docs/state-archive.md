# State archive

The long 'Current state' and 'Open / waiting' sections of CLAUDE.md, moved here verbatim on Oct 24 2026 to cut the per-message load (CLAUDE.md 29k -> ~15k). Newest facts are in CLAUDE.md; the detail and history behind them is here and in the topic docs.

## Current state (Oct 4 2026)

**Oct 12 2026: Play REMOVED the app (AI-Generated Content policy: no in-app report of offensive AI content).** Fixed same day: `ReportContentSheet` on every AI result -> `/api/report-content` -> `contentReports` + owner email; **vc14 on production/alpha/internal Oct 12; submitted 13:19 EAT (Submission 14); APPROVED - app back on the store the same evening (~20:30 EAT)** (`docs/play-store.md`). **Every AI surface must carry a ReportLink.**

**Play / builds.** Production, alpha and internal all on **vc14** (Oct 12, report button; vc13 Oct 3 added Google's
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
defaults to "First scene" for anyone with scenes to spend. **Oct 17 2026: admin-only Gemini Omni Flash option built, OFF** until `GEMINI_API_KEY` + `AI_SCENE_ADMIN_MODEL=gemini-omni-1.1-flash` (~$0.10/s, own `OMNI_DAILY_USD_CAP` $3); never connect the main Google account to a Flow bridge (`docs/users-and-growth.md`).

**Social posting** (details `docs/social-posting.md`). Paid-only (`/api/post-now` and the sweep refuse
free). One registry `PUBLISHERS`; `/api/post-now` and `scheduledPostSweep` (5 min) share it. **Post Now is a
background job** (`async: true` → `job.posts` per platform/account with status + url); every publisher
returns a `url` and Edit & Post rows show "Posted · View" (one `PostRow` component). Multi-account
platforms have an account picker. LinkedIn captions are escaped as little text.

| Platform | Usable by anyone? | Notes |
|---|---|---|
| TikTok | yes | production app, **Direct Post audit approved Sep 24**; **app connect links via `/api/tiktok/connect` (signed uid) since Oct 10 - before, it used the BROWSER's sign-in**; **Oct 11: callback cached tokens without `expiresAt` → dead token after 24h; fixed, token save now merges**; `TikTokPostSheet` (caption, privacy, disclosure) now opens for single posts, **Post Now AND Save to queue** - without it the server defaults to SELF_ONLY |
| Pinterest | yes | Standard access; `PinterestBoardSheet`: choose/**create (public only)**/search boards, optional link, 5 cover frames; row always shows the board + Change; choice saved to `users/{uid}.pinterestBoards` |
| LinkedIn | yes | member profile only; `LI_VERSION` must be current (`202606`); captions unescaped (TODO) |
| YouTube | yes | **API Services audit APPROVED Oct 22 2026** (public uploads allowed; videos.insert 200/day for 6 months, then reapply/audit). `YouTubePostSheet`: own title, made-for-kids (remembered, `users/{uid}.youtubeMadeForKids`), **who can see it - Public (default)/Unlisted/Private, remembered on the phone** (OTA Oct 23 `fe16fbd2`); a request with no choice (old build / old queued post) still uploads private |
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
**YouTube API Services audit APPROVED Oct 22 2026** (quota 200/day for 6 months),
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
- **YouTube API Services audit APPROVED Oct 22 2026** (email in the `youtube-disputes` thread): API client marked
  compliant, public uploads allowed, videos.insert +100 -> 200/day **for 6 months (to ~Apr 22 2027)** - then a
  compliance audit or reapply; a changed use case needs a new quota request. Forced-private lifted in code + OTA Oct 23.
  **Before ~Apr 2027:** check the quota grant and reapply if asked. Keep the reviewer login working.
- **Pesapal (Oct 23):** documents with Leni (merchantsupport, ticket 9342162); Oct 19 she handed onboarding to
  **Michael Ntale** (michael.ntale@pesapal.com), who had not written by Oct 23. The TIN certificate sent Oct 19 was the
  OLD one (no business name); a follow-up with the amended Oct 20 certificate is DRAFTED (r-8875436823971544382) for
  the owner to send. Ticket 9343049 (support@) is a duplicate.
- **Meta Business Verification APPROVED Oct 20 2026** (URA TIN certificate amended to show the business name + URSB certificate). **App Review SUBMITTED Oct 23 2026** (5 permissions + public_profile; "within 20 days"); don't touch Meta app settings/scopes/reviewer account meanwhile. On approval: Live + `META_LIVE=true` (`docs/meta-app-review.md`). History below.
- **Meta go-live: URSB registration DONE Oct 8 2026** - **AHUMUZA FITLIFE SOLUTIONS**, reg. no. 80043893223863,
  sole proprietorship, Muliro Zone, Luwero Central, Luwero Town Council, Luweero District (commenced Oct 5).
  Website legal pages now name it; `data-deletion.html` added; reviewer login allowed via `META_REVIEWER_UIDS`.
  **Business Verification SUBMITTED Oct 8 2026 ~18:30 EAT** (existing portfolio 732676555725838 renamed to
  "Ahumuza Fitlife solutions", legal name AHUMUZA FITLIFE SOLUTIONS, Luweero address, website tonefy-ai.,
  email method via hello@fitlifesolutions.site, certificate + statement of particulars; Meta says ~2 business days). **Oct 9: "more info needed" - address
  didn't match the document; RESUBMITTED Oct 9 ~16:19 EAT with the address exactly as on the Statement of Particulars.** **Same day: address matched
  but the Statement "isn't an accepted type" - needs a trading licence, bank letter/statement or utility bill showing
  name + address. Owner Oct 9: WILL get a Luwero Town Council trading
  licence (LC1 letter first) and upload it to Meta; business BANK account ON HOLD - too expensive while Tonefy earns
  nothing (Stanbic Pamoja UGX 100k to open + 25k/month; Stanbic also wants the trading licence). Meanwhile ask Flutterwave whether a sole proprietor can settle to mobile money or
  a personal account.**
  Developer app settings DONE Oct 8 (display name now Tonefy AI).
  **Owner's next steps** (App Review with exactly 5 permissions, screencasts; done: portfolio, Business Verification with BOTH PDFs - the certificate has no address -
  App Review with exactly 5 permissions, screencasts): `docs/meta-app-review.md`. After approval: Live +
  `META_LIVE=true`.
- **SECURITY FIXED Oct 8 2026: Firestore rules DEPLOYED** (ruleset `fd5853f6`, 18:20 UTC, owner ran it). Before,
  any user could write their WHOLE own `users` doc (`plan: creator`, any credits) and change a scheduled post's
  `userId`. Now clients may only create a free <=10-credit record and update profile fields; plan/credits are
  server-only. **`backend/firestore.rules` is the source of truth** (emulator test `backend/rules-test/`); old
  rules backed up `~/ytshots/firestore.rules.bak-2026-10-08`. Live check with a throwaway account: 6/6. Audit:
  nobody had abused it. **Any new client-written `users` field must be added to `profileFields()` first.**
- **Web payments (Flutterwave) BUILT Oct 8 2026, OFF until `FLW_SECRET_KEY`** - 30-day Pro/Creator passes in UGX
  (30,000 / 65,000) on the website only, mobile money + card, never auto-renew; `upgrade.html`, `/flw-webhook`.
  **The app must never link to or mention web payment** (Play rule). **TEST keys in `.env` since Oct 8**: with a
  `_TEST` key only `FLW_TEST_UIDS` (owner's ahumuzamark254@ account) can pay - everyone else still sees "coming soon".
  **Sandbox payment PASSED end to end Oct 8** (page + webhook, granted once). **Play's price per country** (`offerFor`): local
  currency + mobile money in UG/RW/GH/ZM, bank transfer in NG, USD card elsewhere ($13.99 in Play's 44 doubled markets).
  KE/TZ/francophone need Flutterwave to enable those currencies. **Oct 11 2026: Flutterwave DECLINED (Uganda = enterprise only); request closed.** **Oct 19: Pesapal chosen** (account "Fitlifesolutions", one account for Tonefy + FitLife eBooks); website legal/plans pages now name Pesapal, never Flutterwave. Next: Pesapal verification, then a Pesapal adapter in `webPayments.js`.
  `docs/web-payments.md`.
- Backend: convert the remaining `exec()` shell calls in `server.js` to `execFile` (no user text reaches
  them today, but one did - see history 46).
- Rotate: Brevo SMTP key and LinkedIn client secret (both were pasted into chat once).
- Pinterest blocks links to the whole `fitlifesolutions.site` domain as spam (an appeal is the owner's).
- Editor known gaps: no pinch-zoom on the timeline; `ImagePicker` sometimes omits a video's duration
  (falls back to 3s); 75 toolbar tools defined, ~25 built - **keep the unbuilt ones visible** (roadmap).

