# Project reference - the full original rule and setup sections

Moved verbatim out of CLAUDE.md on Oct 4 2026 to keep that file small. Facts here are a
record of when they were written; CLAUDE.md holds the current state.

## What this project is

React Native / Expo (SDK 54) mobile video editor. CapCut/Canva-level quality bar.

Main frontend file under active work: `screens/EditVideoScreen.js`.

Backend: `~/Tonefy-react/backend/server.js` (Node/Express-style server with ffmpeg-based
video processing, faster_whisper transcription, ImageMagick caption rendering).

## Repos and directories (do not confuse these)

- **`mark2-creator/TonefyApp`** — the actual frontend app (matches EAS project slug `tonefyapp`).
  This is the one being worked on.
- **`mark2-creator/Tonefy-react`** — backend only, and now accurately so: the repo
  is just `backend/` (Node/Express, pm2 `tonefy-backend`). It is not the mobile app.
  It did also hold a `frontend/` — a React 19 + Vite prototype — which was deleted in
  `5be8def1`: never deployed, hardcoded to `http://localhost:5000`, sent no Firebase
  token so every call would have 401'd, and superseded by the live site below. Do not
  go looking for a website in here, and note `~/pages-app` is a FitLife Flask app,
  not Tonefy.

On this VPS there are three confusable local directories:

- **`~/tonefy-build`** — ✅ **THE working copy.** Git repo, remote = `mark2-creator/TonefyApp`,
  branch `main`. All Phase 1–4 rebuild work lives here. Use this one.
- **`~/TonefyApp`** — ❌ stale decoy from June 10. Not a git repo, no `screens/EditVideoScreen.js`,
  no `babel.config.js`. Ignore it. Do not patch files here.
- **`/tmp/tonefy-build`** — ❌ the old working copy, now superseded. Left in place as a
  temporary backup only. Do not edit here; it will vanish on reboot.

## The parent business has its own project file — keep them apart

**Tonefy runs on `tonefy-ai.fitlifesolutions.site`, a subdomain of the owner's OTHER business**,
Fitlifesolutions: a WooCommerce ebook store (`www.fitlifesolutions.site`, 319 products) plus a WordPress
blog (`blog.`, 464 posts), sold through Digistore24. That business is documented in
**`~/fitlife/CLAUDE.md`** and is not this project.

The shared domain has two consequences that reach Tonefy and nothing else does:

- **Search Console.** The `fitlifesolutions.site` **Domain property covers every subdomain**, so Tonefy's
  pages report into a property whose numbers are dominated by the blog — 23 indexed of 547 known across the
  whole domain. A URL-prefix property for `tonefy-ai.` was added Sep 18 2026 for clean separation and
  **auto-verified with no meta tag**, because the parent domain is already verified by DNS.
- **Tonefy had never been crawled.** URL Inspection reported *"URL is unknown to Google"* with
  *"Referring page: None detected"* — nothing anywhere linked to it. Closed by submitting
  `/sitemap.xml` (Success, 5 pages) and adding a "Tonefy AI" item to the store's Main Menu. That link buys
  **discovery**, not ranking: same registrable domain, so Google reads it as internal.

**Do not write FitLife findings into this file, or Tonefy findings into that one.** The blog's indexing
problem, the Digistore24 automation and the WooCommerce store belong there; anything about the app, the
backend or the Tonefy website belongs here. Both live on the same VPS, which is exactly why the boundary
has to be stated rather than assumed.

## One backend, two clients (confirmed Aug 8 2026)

The Android app and the live website already share a single backend. This was traced
end to end; it does not need investigating again.

```
Android app (~/tonefy-build, all 7 screens) ──┐
                                              ├─→ https://api.fitlifesolutions.site
Live website (tonefy-ai.fitlifesolutions.site)┘         │
                                    DNS → 173.212.232.182 (this VPS)
                                    nginx → proxy_pass http://localhost:5000
                                    PID on :5000 == pm2 `tonefy-backend`
                                    == ~/Tonefy-react/backend/server.js
```

- Every screen in the app declares `const BACKEND = 'https://api.fitlifesolutions.site'`.
  There is no second host, no staging URL and no localhost anywhere in the app.
- The **live website is not in any repo you have checked out.** It is hand-written
  static HTML in `/var/www/tonefy-ai`, served straight by nginx — 13 pages plus
  `firebase-auth.js`, Tailwind from CDN, and the downloadable APK. It is *not* the
  Vite app that used to be in `Tonefy-react/frontend`.
- `tonefy-ai.` resolves to Cloudflare and proxies back here; `api.` resolves straight
  to the VPS. Only the API is direct, so moving the VPS is not a one-record change.
- Same process and same job store, **different endpoints**: the site uses
  `/api/idea-to-video-v2`, `/api/extract-segments`, `/api/generate-script`; the app's
  editor uses `/api/media-to-video`, `/api/upload-media`, `/api/edit-video`. They
  share `/api/job` and `/api/generate-audio`. That separation is why editor-side
  backend changes cannot break the website.
- **The live site is now in git — but its `.git` is NOT in the webroot.** Repo is
  `mark2-creator/tonefy-website` (private). The work tree is `/var/www/tonefy-ai`;
  the git directory is `~/tonefy-website.git`. Work on it with:

  ```bash
  git --git-dir=~/tonefy-website.git status      # work-tree is configured already
  # stage the SPECIFIC pages, not `add -A`: the work-tree is a live webroot with
  # unrelated things in it (e.g. a vitablast/ PWA), and `-A` sweeps them in (see item 44)
  git --git-dir=~/tonefy-website.git add privacy.html terms.html   # etc.
  git --git-dir=~/tonefy-website.git commit
  git --git-dir=~/tonefy-website.git push
  ```

  They are split for a reason: `git init` inside the webroot made `/.git/config` and
  `/.git/HEAD` fetchable over HTTPS — the whole repository was downloadable from the
  public site. nginx's existing rules do not catch it (`\.(env|json|...|config)$`
  needs a dot before `config`, and `.git/config` has a slash). There is no
  passwordless sudo here to add a deny rule, and moving the git dir out is the better
  fix anyway. **Never run `git init` in `/var/www/tonefy-ai`.** The APK is gitignored:
  84MB of an 85MB directory, and a release artefact rather than source.

- **Every `/api` route is behind `app.use("/api", verifyToken)`.** A call with no
  Authorization header does not fail loudly - it gets a 401 whose JSON lacks every
  field the caller reads, so the feature silently does nothing. That is what pinned
  the export bar at 0% while renders completed. In the app, go through `apiFetch`.

## Environment / workflow reality

Owner (Ahumuza) works primarily via Termux on phone + SSH to a Contabo VPS
(`ahumuza@vmi3125977`). Now also has Claude Code access — use it to work directly
in the repo instead of the old paste-relay method.

**Never do heavy work in `/tmp`.** A previous VPS reboot wiped `/tmp/tonefy-build`,
destroying weeks of uncommitted frontend work. Working directory must be persistent —
`~/tonefy-build` — and committed to git regularly. **Commit early, commit often** —
this is the single most important lesson from the incident that led to this rebuild.

`node -c` does NOT validate JSX. The real syntax/bundle check is:

```bash
npx expo export --platform android 2>&1 | tail -20
```

Run this after every meaningful patch and confirm clean output before moving on.

**But `expo export` is not enough on its own, and this is the gap that keeps costing
device round trips.** Metro happily bundles a reference to an identifier that does not
exist; it resolves at bundle time and throws only when that line runs. A deleted
`useState` declaration whose setter three call sites still call bundles perfectly and
grey-screens on a device - which is exactly what shipped in `5caf0ca8`.

**ESLint was set up Aug 16 2026** for precisely that (`npx expo lint` scaffolded it;
config in `eslint.config.js`). The gate is:

```bash
npx eslint . --quiet          # errors only - MUST be silent
```

The codebase sits at **0 errors, ~144 warnings**, so any error is new and real. Warnings
are left as warnings on purpose: they are style rather than defects, and a lint that is
always red is a lint nobody reads. `no-undef` and `no-dupe-keys` are the two promoted to
errors - the second found two real duplicate style keys on the very first run.

Verified by deleting a real `useState` declaration and confirming `--quiet` reports its
three call sites, not merely by confirming it passes on working code.

`babel.config.js` must exist (it didn't originally) for Reanimated's worklet plugin:

```js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: ['react-native-reanimated/plugin'],
  };
};
```

`react-native-reanimated@4.1.7` is installed; `react-native-reanimated/plugin` is a thin
re-export of `react-native-worklets/plugin` (v4 restructuring) — either import path works.

Note: `babel.config.js` is tracked in git as of Aug 6 2026 (it was untracked for a
while, which would have silently lost worklet compilation on a clean checkout).

## `preview` channel policy (updated Aug 6 2026 — rule relaxed)

**`eas update --branch preview` is now the normal, approved way to test on device.**

The previous rule forbade publishing to `preview` until the rebuild reached full feature
parity, on the grounds that it would downgrade production for real users. That premise no
longer holds: **Ahumuza is the only user of the app.** There is no third-party user base on
the `preview` channel to protect, so an incomplete rebuild landing there costs nothing more
than a reinstall. Publish freely.

What remains true and still worth knowing:

- Updates published to `preview` are live on Expo's CDN, independent of VPS disk state.
  Local disk loss cannot un-publish them — the CDN copy is its own backup.
- An update is only served to builds with a **matching `runtimeVersion`**. Builds at
  runtime `1.0.0` (the four from Jun 28–30 2026) will silently ignore a `1.1.0` update
  rather than crash. Before treating an on-device test as meaningful, confirm the
  installed build is runtime `1.1.0`.
- A separate `recovery-test` channel is no longer required. Don't build that plumbing.

## Known security hygiene item (low priority, not urgent)

A GitHub PAT is exposed in plaintext in `~/xauusd_scalper/.git/config` remote URL
(unrelated repo). Rotate when convenient.

## Skills (`.claude/skills/`)

- **`tonefy-design`** — this app's visual conventions: the green/teal rule below, the
  context-toolbar pattern, the 12/20/24 icon scale, sheet anatomy, timeline geometry.
  Read it before writing any UI. Its colour rule has only been probe-tested by hand, not
  yet by a fresh session picking the skill up on its own.
- **`frontend-design`** — Anthropic's general design skill, unmodified. Aesthetic
  direction for new surfaces; `tonefy-design` wins wherever the two disagree, since this
  app already has an identity to match.

## Design/brand note

Both `#2ECC71` and `#00d4d4` are intentional brand colours, and which one a control
takes is decided by what it does, not by when it was written (`63a2bc7e`):

- **Green `#2ECC71` — the action commits.** Export, modal Apply, ADD, Confirm, and the
  states that choose a value: selected voice, selected resolution, an active tool chip.
- **Teal `#00d4d4` — you are handling media.** Waveforms, trim handles, the selected
  clip's border, every slider, the scrubber, progress, and view-switching controls like
  the tab strip.
- **Decoration is neither** and takes a neutral (`#fff`, `#888`, a surface border).

An audit on Aug 7 2026 found the split had been purely chronological: of nineteen slider
declarations in `EditVideoScreen.js`, eleven were teal and eight green purely because
the eight were newest. Teal is no longer a legacy marker, so do not "finish the rebrand"
by converting it. Full rules in the `tonefy-design` skill.

**Social platforms are ALWAYS shown with their official logo and their name in that
platform's own brand colour — a MUST, stated by the owner Sep 11 2026, not a preference.**
Wherever a platform is named or marked (connect cards, "Post to" rows, OAuth success
pages, marketing), use the real brand logo (never a Material/FontAwesome stand-in where a
true mark exists) and write the platform NAME in its brand colour and closest available
typographic style — Facebook `#1877F2`, Instagram its `#FEDA75→#FA7E1E→#D62976→#962FBF`
gradient (fall back `#D62976`), TikTok black + `#25F4EE`/`#FE2C55`, YouTube `#FF0000`, X
black/white, Pinterest `#E60023`, LinkedIn `#0A66C2`. This is the one deliberate
exception to the green/teal rule: a third party's name is its identity, not one of our
controls, so it does not take a Tonefy colour. Our own words around it ("Connected!",
"Post") stay green. Proprietary brand fonts can't be embedded — the official logo carries
the real wordmark, the name approximates with a bold sans. Full table in the
`tonefy-design` skill under "Social platform identity".

**A paid feature is marked with a diamond, never a padlock.** `MaterialIcons`
`"diamond"` in premium gold `#f5c451`, with the label left dimmed — the same mark
the transitions panel has used since it was written. This is a rule about meaning,
not decoration: **a padlock is a refusal and a diamond is an offer.** Everything
gated here is on a plan that is for sale, so a padlock states the opposite of what
is true and discourages the upgrade the screen exists to sell.

Three gates had drifted to a padlock before this was written down (export
resolution, the Idea-to-Audio length chips, and locked voices in `VoiceAvatar` —
that last one drawing every card in the 321-voice picker), fixed Aug 18 2026.

The one padlock that is correct is `ProfileScreen`'s Two-Factor Auth, where a lock
means *security* rather than *payment*; a diamond there would imply 2FA is
something you buy. That is the test to apply: **does the lock mean "pay" or does it
mean "protected"?** Only the first becomes a diamond.

Not an emoji — it is the Material glyph, so the no-emoji rule is intact and the
mark is identical everywhere rather than merely similar. Verify any icon name
against the installed glyphmap before using it; an absent name renders as a blank
square and no build check catches it.

Screens outside the editor are still entirely green and predate this rule, so some of
their green is decorative and should be neutral — `PostRecordingScreen.js` is the known
example. Not yet migrated.

## Repo hygiene (as of Aug 5 2026)

- `rebuild/phase-4` pushed to `origin`, confirmed at `f3a8e26d` (Aug 6 2026).
- `node_modules/` removed from git tracking (was previously committed, which is
  unusual/wrong) — now gitignored, relies on `package-lock.json` for reproducible
  installs.
- `EditVideoScreen.js.bak_*` recovery snapshots gitignored (left on disk, not deleted).
- Work now lives in `~/tonefy-build` (persistent), not `/tmp` — the `/tmp` copy was
  the source of the original data-loss incident and should be treated as a stale
  backup only, safe to remove once confidence is established.

## Build 12 (Aug 31 2026) and native-build notes

Build 12 (versionCode 12) is now on both the `internal` and `alpha` tracks, promoted
Aug 31 2026 after being verified on device. It carried one native change OTA could not
deliver:

- **`POST_NOTIFICATIONS` — SHIPPED in build 12 (Aug 31 2026).** Manifest commit
  `20fafb14`. Without it, Android 13+ dropped every re-engagement notification and never
  showed the permission dialog, which is why no notification had ever appeared in the
  app's life. **Build 12 (versionCode 12) fixed it and is verified working on device** -
  the permission dialog now appears and the "Send test notification" button delivers.
  Cut Aug 31 from commit `20fafb14`, reusing keystore `qMlH7ffwtv` (builds 9-11), AAB
  checked to carry POST_NOTIFICATIONS and BILLING and to still lack READ_MEDIA_VIDEO.
  Uploaded to `internal` first, verified on device, then promoted to `alpha` - both
  tracks now on vc 12. Google Sign-In unaffected (same signing key).

Audited Aug 31: this is the **only** pending native change. `package.json` adds no new
runtime module since build 11 (`expo-secure-store` from item 29 is already in 11).
`READ_MEDIA_VIDEO`/`READ_MEDIA_IMAGES` remain correctly ABSENT — the only `READ_MEDIA`
strings in the manifest are the comment explaining why, unchanged from 11 — so build 12
will not repeat the build-10 rejection.

**For Play PRODUCTION (TikTok listing, item 41):** build 12 is on alpha, not production.
When the closed test completes and the app goes to production on Play, versionCode 12 (or
a later build) is what unblocks the TikTok Play Store URL. No new native change is needed
between now and then unless another is added - the notification permission this build
carries is already the last outstanding one.

## Working conventions to keep

- One logical change at a time; verify with a fresh build check after each.
- When patching via scripted find/replace, use exact unique-string matching that fails
  loudly if the target isn't found exactly once (avoids silent no-op edits).
- Don't trust terminal echo/paste alone for verifying file state — re-read the file
  (`cat`/`grep`) after edits when in doubt.
- **Install Expo packages with `npx expo install`, never `npm install`.** It picks the
  version matched to the installed SDK; npm picks latest, which is how an app ends up
  with a native module its SDK cannot build against. Applies to anything `expo-*` or
  in Expo's compatibility list.
- **A native module cannot ship over the air.** Adding one means a new binary, so a
  top-level `import` of it reaches the installed build as JS for a module that is not
  compiled in, and grey-screens on launch. Require it lazily inside a `try` and let
  every entry point no-op when it is absent - that keeps the current install working
  and lets the feature come alive when the new build lands. `utils/notifications.js`
  is the worked example. Leave `runtimeVersion` alone unless you intend to cut the
  current install off from updates.

  **Hand edits to `android/` do not survive expo tooling.** `npx expo install` and
  `npx expo lint` have both silently rewritten
  `android/app/src/main/AndroidManifest.xml`, keeping the permissions but dropping the
  comments explaining them - twice now, in a project that never prebuilds. So the
  reasoning has to live here, not only there. **Run `git diff android/` after any expo
  command.**

  The one that matters most: **`READ_MEDIA_VIDEO`/`READ_MEDIA_IMAGES` must stay OUT of
  that manifest.** expo-media-library's config plugin would add them (and no config
  plugin runs here), but Play **refuses the upload outright** with "All developers
  requesting access to the photo and video permissions are required to tell Google Play
  about the core functionality of their app" - which cost build 10. Nothing in this app
  reads the user's library; it writes one file it just created, which on Android 10+
  scoped storage needs no permission, and `requestPermissionsAsync(true)` asks
  write-only to match.

  **The check that enforces this, before every `eas update`:**

  ```bash
  # <commit> = the commit the installed build was cut from (eas build:list --json)
  git diff <commit>..HEAD -- package.json
  ```

  Any new dependency in that diff is a candidate for this trap, and the rule is easy
  to know and still walk past - it was, on Aug 15 2026, publishing `expo-secure-store`
  to a build that did not have it (item 29). Note the failure is not confined to the
  feature: `expo-secure-store` is imported by `firebase.js`, which every screen
  imports, so a module that throws on import takes the whole app down at launch. Also
  note that guarding the *calls* is not enough if the `import` itself is what throws,
  and that `.catch()` on a returned promise does not catch a missing method, which
  throws synchronously at the call.
- **Push after every commit, not at the end of a session.** And never count an
  `eas update` publish as having saved the work: a published bundle is not
  recoverable source. On Aug 9 2026 this session published **21 updates while 38
  commits sat unpushed** — Expo's CDN held every bundle and the source history existed
  on one disk, which is precisely the incident this file was written after. The push is
  part of finishing a change, the same way the build check is.
  Both repos, every time: `git -C ~/tonefy-build push origin rebuild/phase-4` and
  `git -C ~/Tonefy-react push origin master` (the latter's old 403 is long resolved —
  see IMMEDIATE NEXT STEPS). `git rev-list --left-right --count HEAD...@{upstream}`
  answers "is anything stranded here" in one line.
