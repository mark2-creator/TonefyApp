# Tonefy AI — Project Context for Claude Code

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
  git --git-dir=~/tonefy-website.git add -A && git --git-dir=~/tonefy-website.git commit
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

## Known bug pattern: gesture composition + config methods

**Symptom:** grey screen / silent unmount on render, no error visible in normal
usage — only shows up on-device, not in `expo export` build checks.

**Root cause:** calling a `BaseGesture` config method (`.enabled()`, `.onStart()`,
etc.) directly on a `Gesture.Race()` / `Gesture.Simultaneous()` composition. RNGH's
`class Gesture {}` is empty — composed gestures (`ComposedGesture`) sit on
`ComposedGesture → Gesture → Object`, which does NOT include `BaseGesture` where
those methods actually live. The call throws `TypeError: ... is not a function`
during render, which unmounts the tree.

**Fix pattern:** apply config methods (`.enabled()`, etc.) to each individual leaf
gesture before composing them, not to the composed result.

**This is the third bug of this shape in the project** (after `useDragTracker`
returning the `PanResponder` wrapper instead of `panHandlers`, and a deleted-
component call site) — same signature: passes every static check
(bundling, `node --check`, lint) and only a real device catches it.

**Guard added:** `scripts/check-gesture-composition.py` — reads
`ComposedGesture`/`BaseGesture` method lists from the installed
`react-native-gesture-handler` and flags any of its config methods chained onto a
composition. Tracks library upgrades instead of going stale on a hardcoded list.
Run this after any gesture-handler changes, and consider running it in CI/pre-commit
if that gets set up.

**Fixed in:** commit `75198f47` (gesture fix; the guard script landed in `05e26d3b`) + `05e26d3b` (separate, unrelated
correctness fix: `openOverlayEditor` was calling `setInlineEditKey` from inside a
`setSelectedOverlayKey` updater — updaters must be pure; harmless today since the
replayed call sets the same key, but flagged as a landmine for a future React
upgrade).

**Newly-testable surface:** tap-to-select → tap-again-to-type and the long-press
style sheet on text overlays were unreachable before this fix (crashed on mount).
Confirmed working on-device as of this fix.

## Known bug pattern: a signing certificate Google does not recognise

**Symptom:** Google Sign-In fails on a real device with `DEVELOPER_ERROR`, or - more
dangerously - with `{"type":"cancelled","data":null}` *after* the account picker has
run and an account has been chosen. Email/password auth keeps working throughout.

**Read a "cancelled" the user did not cause as a config rejection.** With the legacy
`GoogleSignInClient` (which is what `@react-native-google-signin/google-signin@16.1.2`
uses on Android - checked in `RNGoogleSigninModule.java`, not inferred from the README),
an app whose certificate matches no OAuth client is refused, and that surfaces as either
12501 `SIGN_IN_CANCELLED` or status 10 `DEVELOPER_ERROR` unpredictably. The same build
produced both on different days here. Neither code is worth diagnosing from; what both
mean is *package + signing certificate + webClientId does not resolve to a registered
OAuth client*.

**Count the certificates, don't match one number.** The trap is that verifying "the
SHA-1 is registered in Firebase" passes while the app is presenting a *different*
certificate. An app can legitimately have more than the usual two (upload key + app
signing key):

- **A rotated app signing key** adds one. Play Console → Test and release → Setup →
  App integrity → App signing shows a **"Previous app signing keys"** table when this
  has happened. Installs made before the rotation still present the old certificate,
  and Play services APIs resolve identity through the rotation lineage rather than
  switching to the newest key. Google's guidance is to register **both**.
- **Play's Quantum-ready beta** adds another: the key gets a **"Post-quantum
  cryptography key"** certificate with its own SHA-1 alongside the **"Classical key"**.

This is exactly what bit here - see item 28 under IMMEDIATE NEXT STEPS for the full
account, including why a session of correct-looking checks missed it.

**Fixing it needs no build and no publish.** `google-services.json` is not read at
runtime for this flow; Play services validates against Google's servers. Register the
missing fingerprint and the fix is live immediately on the device already installed.
Add it with the Firebase Management API rather than the Console, which also gives you a
way to *read* the truth back:

```js
// list what is actually registered
fb.projects.androidApps.sha.list({ parent })
// add one (shaHash lowercase, no colons)
fb.projects.androidApps.sha.create({ parent, requestBody: { shaHash, certType: "SHA_1" } })
// re-pull google-services.json and confirm a new client_type=1 entry appeared
fb.projects.androidApps.getConfig({ name: parent + "/config" })
```

Keep the committed `android/app/google-services.json` in sync afterwards. It changes
nothing at runtime, but this project's committed `android/` folder means nothing
regenerates it, so it silently rots from every SHA change otherwise.

## Known bug pattern: many sibling views is O(n²) on Android

**Symptom:** the app freezes and Android offers "Tonefy AI isn't responding". Sentry
reports `ApplicationNotResponding` with the **main thread** (not the JS thread) inside:

```
BlendModeHelper.needsIsolatedLayer -> View.getTag -> SparseArray.binarySearch
```

**Mechanism**, read out of the installed React Native source rather than inferred:
`ReactViewGroup.drawChild` (`ReactViewGroup.kt:885`) runs **once per child**, and every
call asks `needsIsolatedLayer(this)`, which is
`view.children.any { it.getTag(R.id.mix_blend_mode) != null }` (`BlendModeHelper.kt:50`).
**One view group with N children therefore costs N×N `getTag` calls per frame** - and
none of them can ever matter in this app, because nothing here sets `mix-blend-mode`,
so the answer is always false. It is pure waste that grows quadratically.

**The rule this gives you: never render an unbounded number of siblings into one
parent.** Two fixes, usually both:

1. **Cap the count**, deriving size from the available width so the thing still fills
   its box rather than stopping part way.
2. **Nest them into groups**, which turns one N² into `g² + g·k²`. Purely structural -
   plain views in the same flex direction lay out identically.

**Found Aug 16 2026** on a Galaxy A23 (`device.class = 1`), build 9, with a project of
just two 3-second clips - small, but with music on it. Fixed in `87c0479f`:

- **`components/Waveform.js` was the killer.** Bar count was uncapped at `width / 3`,
  and an audio block's width is its duration × 40px, so a three-minute track drew
  ~2,400 bars: **~5.7 million `getTag` calls per frame**. Now `MAX_BARS = 500` with
  pitch/width derived from the block, plus `<G>` groups of 16. **Under ~25s of audio
  nothing changes.** That file also carried a wrong comment claiming one SVG meant "one
  native view instead of a hundred and fifty" - **on Android `react-native-svg` gives
  every `<Rect>` its own native view**; the saving is layout and prop plumbing, never
  view count. Corrected in place, since that comment is what would mislead next time.
- **`components/FilmStrip.js`** has the same shape smaller - up to `MAX_TILES = 160`
  tiles as direct children - and got the same nesting.

Measured: 3-min waveform 5,760,000 → 9,216 calls/frame (625×), 60s waveform 640,000 →
9,216 (69×), filmstrip 25,600 → 2,212 (12×).

**Not the same bug as the export ANR in item 20**, which was the *JS* thread freezing on
unmemoized overlays. Same dialog, different thread, different fix. When an ANR appears,
the first thing to establish is which thread the stack is on.

**Places worth checking before adding one:** anything that maps over a duration, a
sample array, or a catalogue into siblings. The caption style picker (138 tiles) is safe
because it is a `FlatList` and virtualises; the timeline rows are safe because they hold
one chip per item. Waveform and filmstrip were the two that scaled with *content length*
rather than item count, which is the property to watch for.

## Social posting: the chain is built, TikTok is in sandbox

Everything from connect to publish now works and was built Aug 21 2026 - but **the
TikTok credentials are sandbox-only and the Content Posting API has not been applied
for**, so a real post cannot succeed yet. Do not spend time debugging a failed publish
against that; it is the app registration, not the code.

```
connect TikTok      tokens persisted in Firestore (see below)
post now            verifyToken + ownership check + own-host-only videoUrl
save to queue       scheduledPostSweep publishes due items every 5 minutes
schedule for later  day within 14 days + quarter-hour, chips not a native picker
failures            written back onto the post with the reason
```

Three fixes underneath it, each of which had to come before the one after:

- **`tiktokTokens` was a plain in-memory `{}`**, so every `pm2 restart` disconnected
  every account - silently, because the "Connected" badge reads `connectedAccounts`
  which the client writes and which survives. Now `tiktokTokens/{openId}` in Firestore,
  its own collection rather than `connectedAccounts/{uid}` because that document is
  readable by its owner and these are bearer credentials. **No security rule mentions
  that path, and Firestore denies where no rule matches**, so it is Admin-SDK-only by
  construction.
- **`/tiktok/post-video` was unauthenticated and did `fetch(videoUrl)` on a client
  string.** Anyone could post to any account whose openId they knew (an openId is not a
  secret), and anyone could make this box fetch any address - `127.0.0.1:5000` and the
  cloud metadata endpoint included, on a VPS running five other pm2 services. Now
  `verifyToken` inline, an ownership check against `connectedAccounts/{uid}`, and
  `videoUrl` restricted to https on this host under `/videos` or `/uploads`. The
  ownership lookup fails CLOSED - unlike the plan checks, being wrong here posts to a
  stranger's account.
- **Nothing read `scheduledPosts`.** "Add to queue" wrote a document, said "Added to
  queue!", and the post was never sent while the Calendar listed it as pending.

`publishToTikTok` is a function the route and the sweep both call, deliberately - two
implementations of "send this to TikTok" drift the first time one gets a fix.

## Two flex traps that have each bitten twice

**A horizontal chip row in a flex column needs all four of these**, and building one
from scratch instead of copying a working one is how three of the four get written:

```js
row:     { flexGrow: 0, flexShrink: 0 }                    // on `style`
content: { alignItems: 'center', paddingHorizontal: N }    // on `contentContainerStyle`
```

- `flexGrow: 0` - it must not expand to fill the sheet.
- `flexShrink: 0` - and a long list below must not be able to **compress it to
  nothing**. This is the one that gets forgotten. It emptied the music filter rows
  under a 68-track list, and `RecipeSheet`'s category strip had the same omission under
  a 128-tile FlatList.
- `alignItems` on the **content** container - it defaults to `stretch`, so every chip
  takes the row's height instead of defining it, and they come out clipped through the
  middle rather than overflowing.
- padding on the **content** container - on a horizontal ScrollView `style` is the
  clipping box, so padding there shrinks what is visible instead of insetting it.

First hit on `MyVideosScreen`'s filter chips (item 34), then reintroduced from scratch
on the music filters Aug 21 2026. `grep -E "flexGrow: 0" | grep -v flexShrink` finds
the shape.

**`maxHeight` is not a definite height, so `flex: 1` inside it resolves to zero.** The
music sheet is `maxHeight: '85%'`; giving its track list `flex: 1` emptied the list
completely - the child has nothing to flex against, and because it then contributes
nothing to the sheet's intrinsic height the sheet shrinks to fit everything else and
the child stays at zero. A deadlock, not a clipping problem. A list inside a
content-sized sheet should stay content-sized and let the sheet's own maxHeight do the
clipping.

Both bugs in that one row came from **adding one more thing than the situation needed**
- `flexShrink: 0` alone had already fixed it, and the `flex: 1` added alongside was
solving a problem that fix had already solved.

## The music library

68 tracks, and the honest state of them (Aug 21 2026):

- **All 68 are 96 kbps**, which is the real audio quality problem and is not fixable
  here. Re-encoding cannot restore what was never in the file, and **Mixkit and Pixabay
  both return 403 to this VPS** - with browser headers too - so the originals cannot be
  re-fetched. Better files have to come from a machine that is not blocked.
- **Loudness is fine and does not need a normalisation pass** - 3.4 dB across all 68,
  median -16 LUFS, already normalised at source. Measured before assuming.
- **"Energy" does not discriminate anything** - every track sits between 0.14 and 0.18.
  BPM does: 62 to 185.
- Each track carries mood, tempo band, BPM and length, from
  `scripts/analyse-music.py` -> `backend/music-meta.json`, read once at boot.
  BPM is measured by onset autocorrelation (no librosa or aubio on this box); mood comes
  from the track's own title where it says something, and from measured tempo where it
  does not. **There is deliberately no fallback category** - the first version put 25 of
  68 in "Corporate", including a 185bpm Valley Sunset.
- Adding tracks: drop mp3s into `backend/public/music/`, re-run the script, restart.
  Prefer **Pixabay Music** - CC0-equivalent, commercial use, no attribution, and no
  redistribution restriction. **Avoid Epidemic Sound and Artlist**: their licences
  forbid redistributing the files, which is what bundling them into an app does.

## Live preview on the canvas, and why no native module was bought

**Confirmed working on device Aug 20 2026.** The editor canvas shows grades and camera
moves live. Four separate concepts, and the distinction decides the implementation:

| | what it changes | where it lives | live on canvas |
|---|---|---|---|
| **filter** | colour only, same every frame | `constants/filters.js`, 155 | **131/154** |
| **motion** | where the camera is | `constants/motions.js`, 22 | **21/21** |
| **effect** | something happening on the footage | `constants/effects.js`, 68 | 18/67 |
| **transition** | how clip A becomes clip B | `constants/transitions.js`, 132 | n/a |

**React Native 0.81 has a built-in `filter` style prop, and this is the thing not to
re-discover.** On Android the colour-matrix functions (brightness, contrast, saturate,
hue-rotate, grayscale, invert, sepia) compile to a `ColorMatrixColorFilter` via
`FilterHelper.kt`'s `isOnlyColorMatrixFilters`, which works on **every** Android version
- only blur and drop-shadow need the API 31 `RenderEffect`. It is core RN, already
inside versionCode 11, so all of this shipped **over the air**.

**A native module was explicitly asked for and deliberately not added.** A colour-matrix
module would have offered the same matrix these are already fitted to. A shader could go
further, but compositing a shader over a native video view is not a solved problem in
React Native, and finding that out would have cost a binary and a review cycle. If this
is revisited, the open question is shader-over-video, not colour matrices.

**The lesson worth keeping is how the coverage went from 20 to 131.** Only 20 chains are
built from `eq`/`hue` and map exactly; the rest use `colorbalance`, `curves` or
`colorchannelmixer`, and a curve is non-linear while a colour matrix is linear. That was
read as "no mapping exists" and it was the wrong conclusion: **there is no exact one,
but there is a NEAREST one, and it can be found rather than guessed.**
`scripts/fit-filter-preview.py` renders each grade through real ffmpeg on three
portraits at different exposures and fits brightness/contrast/saturate/hue-rotate/sepia
by Nelder-Mead against it, using the W3C matrices so the simulation is of what Android
actually applies. Median error 3.8 levels of 255; kept at 8 (3.1%), which is below what
is distinguishable on a moving phone preview. Output is `constants/filterPreview.js`,
GENERATED, `[css, measuredError]` per grade.

**Anything with no close-enough live form abstains** and shows its name on a canvas
badge instead - the badge lists only what CANNOT be shown, so a grade already on screen
is not announced. The rule throughout: a preview is worth having when it resembles the
result, and past that it misinforms. What changed is that "resembles" is a number.

Two traps recorded:

- **Flip and motion both want `transform`, and two `transform` keys in a style array do
  not merge** - the later silently replaces the earlier, so a flipped clip with a zoom
  loses its flip. Composed into one array in `canvasLayerStyle`.
- **`constants/filters.js` is loaded by `scripts/gen-filter-previews.mjs` OUTSIDE React
  Native**, so any import it gains needs an explicit `.js` extension - plain Node ESM
  does not resolve extensionless paths, Metro takes either. Breaking that would not
  surface until the next tile regeneration.

**Preview tiles for motions and effects** are animated WebP rendered from the recipe
(`scripts/gen-recipe-previews.mjs`, served from `/motions` and `/effects`), the same
arrangement transitions use. Motions render over a STILL so the motion is the only thing
moving; effects render over a MOVING clip because `lagfun`/`tmix` blend across frames and
preview as nothing on a still. The sheet virtualises - 68 tiles is 3.5MB and a
ScrollView would fetch all of them.

**A diamond appears only when an item is actually LOCKED**, never merely because it is
premium - see the design rule above.

## Known bug pattern: an absolute child where a flowing one was meant

**Symptom (Aug 18 2026):** a video clip's filmstrip showed frames for about thirteen
seconds and was empty for the rest, however long the footage was. **A photo was
completely unaffected.**

**Cause:** `styles.row` in `components/FilmStrip.js` is `position: absolute, top: 0` -
correct for the sliding strip, since `left` is what a trim drag animates - and the
group wrappers *inside* it reused that same style. So every group laid out at `left:
0` and the seven groups of a 90-second clip stacked on top of one another. The strip
was only ever as wide as **one group**: `TILES_PER_GROUP` (12) x ~44px = ~524px =
13.1 seconds. Fixed in `03557326` with a separate `group: { flexDirection: 'row' }`.

Introduced by the grouping added in `87c0479f` to escape the O(n²) draw path above.
That grouping is still correct and still needed - it just has to flow rather than
float. **Splitting children into wrapper views is not purely structural if the
wrapper inherits a positioned style.**

**The photo being fine is the part worth remembering.** Every tile of a still is the
same image, so stacking them is invisible. The broken case and the working case
differed only in whether the tiles were distinguishable - which is why it survived two
days and three rounds of diagnosis. When one media type works and another does not,
ask what differs in the *rendering* before assuming the difference is in the *data*.

**What actually found it: printing the component's own numbers onto the clip.** Three
rounds of reasoning from the symptom each landed somewhere else, and two shipped
"fixes" (middle-out decode order, nearest-frame fill - both kept, both real
improvements, neither the bug). A temporary readout gave `decoded 40/40 · tiles 84 ·
span 3675px · DONE` on a strip that visibly ended at 524px, which states the bug in
one line. **On a defect only a device can show, an instrument is cheaper than another
guess** - especially here, where each round trip costs the owner an 8MB OTA download
on a connection measured in hundreds of bytes per second.

## "Is the fix actually on the phone?" - Profile → Build answers it

`ProfileScreen` has a **Build** section reporting `Updates.isEmbeddedLaunch`, channel,
runtime and the update's publish time. Added Aug 18 2026 after the question was
answered by inference three times and was wrong at least twice - once as a "grey
screen" that was a stale bundle (item 29), and again during the filmstrip hunt above,
where a correct "still broken" report was about a build that did not contain the fix.

**Check it before diagnosing any device report.** "Original install (no update
applied)" means no OTA has ever been applied and the bundle is whatever shipped in the
APK.

**`App.js` checks for updates in a mount-only effect**, so resuming from background
never re-checks - only a cold start does. And on a slow connection `fetchUpdateAsync`
can fail silently, leaving the app looking current when it is not. Both matter for
this project's testers, who are largely on Ugandan mobile data. Still unaddressed:
there is no "downloading update" state, and `reloadAsync()` is called mid-session,
which can restart the app under someone who is editing.

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

## Product direction (stated by the owner, not derivable from the code)

- **Social posting is one of the reasons Tonefy exists**, not a side feature. TikTok is
  the only platform wired today; Facebook, Instagram and X are "Coming soon" rows in
  `EditPostVideoScreen`/`ProfileScreen`/`ConnectAccountsScreen`. **As each becomes fully
  functional it is to be sold as a Pro/Creator benefit**, so treat posting integrations
  as monetisable scope rather than as chrome. Nothing in `tiers.js` reflects this yet -
  the caps there are credits, duration, resolution, watermark, caption styles and voices.
- **The editor's toolbar is a roadmap and stays that way.** 75 tools are defined,
  ~20 built; the rest fall through to "Coming soon" via `toolTapAction`. **Do not remove
  the unbuilt ones** - the stated intent is to reach CapCut-level breadth and build them
  one at a time as revenue allows. Build order is by what costs nothing to run: the
  ffmpeg-native tools first, since this box already has every filter they need
  (`vidstabdetect`/`vidstabtransform`, `minterpolate`, `tmix`, `chromakey`/`despill`,
  `afftdn`/`atadenoise`, `reverse`/`areverse`, `eq`, `unsharp`, `deshake` - all verified
  present Aug 16 2026). Roughly half the unbuilt toolbar is labour, not spend.
- **Genuinely-AI tools are a later, separately-funded tier.** BG Remover, AI remove/expand,
  Eye contact, Lip sync, Retouch, Relight, Auto reframe and voice isolation need real
  models. **Google is the wrong provider for most of them** - Gemini understands video but
  cannot segment, inpaint or lip-sync, and Veo generates video rather than editing yours.
  Veo is also unviable at current pricing: $0.10/sec (Fast 720p) is **$6/minute against
  $0.117/minute of Pro revenue**, ~51x. If Veo is ever offered it has to be a separately
  priced add-on, never bundled into credits.
- ~~**Video Translator is the cheapest big win available** and is not built~~ — **BUILT
  Aug 16 2026, see item 33.** `/api/translate-video` (job-based, 14 languages) plus the
  `translate` toolbar tool. Leaving the old wording here unstruck cost a session: it was
  read as current and Video Translator was recommended as the next thing to build, to
  the person who had already paid for it being built. **A roadmap line is stale the
  moment the thing ships — strike it in the same commit, do not rely on a later item
  contradicting it.** Still unverified on a device.

## Rebuild status

### Phase 1: Reanimated timeline foundation — ✅ COMPLETE

UI-thread-driven scroll sync across clips + 4 aux rows (voiceover/music/text/captions)
via `useAnimatedReaction` + shared `scrollXShared`. Playback uses a RAF tick loop that
writes the shared value every frame but throttles React `setPosition()` state updates to
~25/sec — this was the root fix for "scratched DVD" playback stutter seen in the lost
version.

Known follow-up (not yet needed, watch for regression): `requestAnimationFrame` runs
on the JS thread in RN, not the UI thread. If playback stutter resurfaces, the proper fix
is `useFrameCallback` for a true UI-thread playback clock — would need worklet-safe
`timeToPixelXWorklet` / `getTransitionWindowWorklet` helpers and an `itemsMetaShared`
mirror of the items array. Not critical now since this baseline lacks per-item
variable-width transitions.

### Phase 2: Audio drag/trim — ✅ COMPLETE

`DraggableAudioTrack` component, `fetchAudioDuration`, `applyAudioTrimEdit`,
absolute-positioned draggable/trimmable voiceover & music blocks.
`PIXELS_PER_SECOND` is a fixed constant (40) — no pinch-zoom in this baseline.

### Phase 3: Auto-captions — ✅ COMPLETE

`generateCaptionsFromVoiceover` (calls `/api/transcribe-voiceover`), time-gated preview,
grouped caption summary chips (`captionPreviewGroups`) in brand green.

**Caption catalogue (Aug 7 2026)** — 138 styles across 13 categories in
`constants/captionStyles.js`, up from 12. It landed at 130 in `5ff8992d` and grew to 138
in `33b4ef33`. That file is hand-written and safe to edit; it is not generated like
`constants/fonts.js` (which is a separate 130 — font families, not caption styles).

A style is a spec of typographic parts — face, fill or two-stop gradient, stroke, glow,
drop shadow, box, tracking, case, scale, word cadence — not a set of flags. The old model
was four booleans plus a branch per special case inside `DraggableTextOverlay`, which is
why it stopped at a dozen: every new look needed renderer code, and the combinations all
read as "white text". One renderer, `components/CaptionText.js`, interprets the spec, and
the picker's swatch and the video canvas are that same component at two sizes — so a
preview cannot drift from what the canvas draws.

The twelve original ids are still in the catalogue, restyled but not renamed, so projects
saved before it existed still resolve. `resolveCaptionStyle` falls back to the default for
anything else.

Things worth not rediscovering:

- **Stroke width is calibrated, not guessed.** The ring is `width * (size / 18)` on both
  sides. As a fraction of font size the legible range is about 0.04 to 0.14 — past ~0.15
  the rings of adjacent letters touch and a word closes into one black slug. Catalogue
  widths (0.75–2.5) sit inside that. Checked against real glyphs, not by eye.
- **RN gives text one shadow and no stroke**, so both are stacked copies of the string,
  each stretched to the wrapper box (`left/right/top/bottom: 0`) and displaced with
  `transform`. An absolutely positioned Text with no width shrink-wraps and re-wraps its
  own lines, which would put the outline's line breaks somewhere the fill's are not.
- **Gradients are per-character**, interpolated in JS with nested `Text`. A real gradient
  needs a mask or an SVG text node, and neither dependency is installed — adding one means
  a new native build for a fill colour. The export draws the same two stops as a true
  continuous ramp in ImageMagick.
- **`italic` is deliberately absent.** Every style names a family, each family registers a
  single cut, and asking Android to slant it risks losing the family to the system face.
- The picker is its own sheet (`components/CaptionStylePicker.js` — formerly dead code
  exporting a second, conflicting `CAPTION_STYLES`), searchable and filtered by category.
  138 tiles will not fit in the Auto Captions sheet, and a vertical list nested in that
  sheet's ScrollView is the one arrangement RN handles worst: neither scroller virtualises.
  It exports `CaptionStyleSheet` (sheet alone, for a screen that already has a row to open
  it from) and a default `CaptionStylePicker` (trigger row + sheet).

**All four screens share the catalogue (Aug 7 2026).** Edit Video, and Idea/Script/Url →
Video, which each carried their own duplicated 12-style copy. All three generation screens
POST to the same `/api/idea-to-video-v2`, so one endpoint change covered them. Their
`OptionModal` caption branch and its `CaptionPreview` swatch are gone — every remaining
caller passes options with an `icon`, so that branch was unreachable.

**Canvas overlays are free (Aug 7 2026)** — `components/CanvasOverlay.js`. Drag anywhere,
pinch to scale, two-finger rotate, plus a corner handle that turns and resizes with one
finger. Replaces the drag-only PanResponder.

- **Position is the element's CENTRE, as a percentage** (`anchor: 'center'` in the export
  payload). Top-left is not a position you can rotate about: spin an element and its
  top-left corner describes a circle while the thing being aimed stays put. Centre is also
  the only anchor that centres a caption by default without measuring its particular words.
  Overlays are session-only, so there was nothing on disk to migrate; the server still
  accepts top-left from older clients.
- **Nothing measures anything to place it.** The element sits in a wrapper that fills the
  frame and centres its child, so a translate of `(x - w/2, y - h/2)` lands its centre on
  the point — no `onLayout` round trip and no frame where the overlay is in the wrong place.
- **Scale folds into `size` at export.** Every part of an overlay is already a multiple of
  the size — stroke, padding, glow — so multiplying reproduces a pinch exactly, and there
  is no second factor for the renderer to apply and get wrong.
- **Auto-captions move as one.** They are one caption per phrase and only the phrase under
  the playhead is on screen, so moving just the visible one would look like the caption
  jumping back as soon as the clip moves on.
- The corner handle never needs the canvas's position on screen: the vector from centre to
  handle is known when the drag starts, the finger's translation is added to it, and length
  gives scale while angle gives rotation.
- **The handle has to block the element's own one-finger gestures.** Being drawn inside the
  element, its `GestureDetector` is nested in the element's — which buys it no priority.
  Both reach for the same finger, and the first handler to activate cancels every other one
  it is not simultaneous with. The element's pan activates at `minDistance(2)` where a pan
  left unconfigured waits for the platform touch slop (~8dp on Android), so the element's
  pan won every time and the handle only ever dragged the caption. `blocksExternalGesture`
  makes pan, tap and long press wait for the handle to fail. Rotation is a leaf on
  `BaseGesture`, so this is not the composition trap — the composition was verified correct
  (`Race` adds no relation at all; pan/pinch/rotation are cross-linked `simultaneousWith`).
- **Pan needs `averageTouches(true)`.** Android measures a pan from the last finger placed
  rather than the point between them, so a two-finger turn reads as a large drag: each
  finger sweeps an arc while the centre stays put. RNGH's own source calls this out for
  exactly the case of attaching a rotation handler. iOS already averages and ignores it.
- Rotation snaps within 4° of a right angle. Turning by hand never lands on exactly 0, and
  a caption a degree and a half off level reads as a mistake.
- Pan carries `minDistance(2)`. A finger never lands perfectly still, and without it that
  jitter activates the pan before the tap can finish, so tap-to-select works only sometimes.

**Type on the canvas (Aug 7 2026).** A second tap puts a caret in the overlay itself
instead of opening a sheet with a plain input in it, so a font, a stroke or a colour is
judged against the frame it will sit on rather than against a grey modal.

- The caret is a **transparent `TextInput` laid over the rendered overlay**, not an input
  styled to look like one. Nothing reproduces the stacked stroke and glow layers, so a
  real input would drop them the moment editing began. Both are laid out from
  `captionMetrics`, exported from `CaptionText.js` and used by the renderer itself — two
  definitions of what a style measures drift, and the drift shows as a caret between the
  wrong two letters.
- **Every gesture is off while an overlay is being typed into.** A handler that merely
  loses a race still swallows the touch, so leaving them on means taps land on the overlay
  instead of in the text: no placing the caret, no selecting a word, no dragging the
  handles the keyboard puts there. The style sheet moved to a long press (typing is the
  commoner act), and an overlay typed empty is deleted rather than left as an invisible
  object that still catches every tap.
- Manual text overlays carry a **background chip** of their own — colour, opacity, radius,
  padding. It travels to the export as a spec `box`, the same thing a boxed caption style
  sends, so the server draws both with one code path and needs no idea which came from the
  catalogue and which from four sliders.

**Everything in a caption style is a multiple of the font size, scaled by `size / 18`.**
The export scales by exactly that (`sscale` in `server.js`), so anything left fixed on
this side matches the export at size 18 and nowhere else — and the picker's swatch is the
same component at a smaller size, so it drifts the other way at the same time. Scaled:
tracking, stroke width, glow radius, shadow offset **and blur**, chip padding **and corner
radius**. `4d47c7cc` fixed the last two, which had been missed while their immediate
neighbours were scaled — a rounded sticker came out squarer than the burned-in one on the
canvas and rounder in its own tile, and a drop shadow drifted from the word without
softening, reading as a hard second copy of it. When adding a part to a style, the
question to ask is not whether it looks right but whether it is scaled.

Highlight is the one deliberate exception: the app pads the spoken word with thin spaces
(`\u2009`) where the export draws a real chip with `hlPadX`/`hlPadY` geometry, because
React Native ignores padding on a nested `Text`. Close approximation, not the same maths.

**`.enabled()` goes on a leaf gesture, never on a composition.** Full account in
"Known bug pattern: gesture composition + config methods" above. It shipped in
`dd1c0a81` and grey-screened Add Text (`75198f47`); every overlay rendered through
that line, so the Add button was only the first thing to mount one. The
`scripts/check-gesture-composition.py` guard was verified by running it against the
broken file, not only the fixed one.

**`npx expo export` is necessary but not sufficient.** Metro bundles a reference to a
function that no longer exists and only fails when that branch renders. Deleting a
component and leaving one of its two call sites behind is exactly how that happens — it
happened here. `scratchpad/jsxrefs.py` checks every capitalised JSX tag resolves to
something the file imports or defines; worth re-running after any component deletion.

### Phase 4: Performance/memoization reapply — ✅ COMPLETE

Extracted as `React.memo` components: `ClipsRow`, `TextRow`, `CaptionsRow`, and
`AudioTrackRow` (shared by both voiceover and music rows — two call sites, wired in
commit `56d986ad`). Net -62 lines of duplication. Build check clean before and after
the JSX swap.

### Timeline filmstrip and clip trimming (Aug 7 2026)

`components/FilmStrip.js` + `TimelineClip` in `EditVideoScreen.js`. The clips row was
a strip of fixed 72px chips, each drawing `item.uri` in an `<Image>` — which for a
video file is not a frame of it. So a clip was one tile with no picture in it and
nothing to aim at.

- **The width was the deeper half of that bug.** The row sits in the scroll view whose
  offset is read back as `x / PIXELS_PER_SECOND`, and every other row — voiceover,
  music, text, captions — is positioned at `startOffset * PIXELS_PER_SECOND`. The clips
  alone were laid out at a fixed size, so a 30s clip drew 72px where the playhead
  believed 1200px: clips did not line up with their own audio, and the frame under the
  playhead was not the frame being played. **Nothing in that row may take horizontal
  space that is not time** — a fixed chip, a margin, or the inline transition button
  each pushed every later clip further out by its own width, and the error accumulates.
  The transition marker is now drawn inside the clip's right edge, where the next clip
  cannot overdraw it (siblings paint in order; it would need a stacking context to sit
  on the join).
- **Frames come from `expo-video`'s `generateThumbnailsAsync`**, which was already in
  the runtime-1.1.0 binary — expo-video landed `0365cf33` (Jun 9), the build is Jul 13 —
  so this shipped over the air. `expo-video-thumbnails` is *not* installed and adding it
  would have meant a new native build for a filmstrip.
- On Android it reads through **`MediaMetadataRetriever`, not the playback decoder**
  (checked in the module's Kotlin, not assumed), so unlike the duration probe removed in
  `e1937cfe` it cannot take audio focus mid-playback. Muted and set to `mixWithOthers`
  anyway. `createVideoPlayer` instances never release themselves — release in a `finally`.
- `toMetadataRetriever()` only needs the player's **source URI**, not a loaded asset, so
  there is no readiness handshake to wait on.
- **Sampling is on a fixed grid over the whole source file, never over the trimmed
  window**, and the clip's box shows the part of that strip it covers. This is what makes
  a trim handle cheap: dragging reveals frames that are already decoded, so the strip
  slides instead of being rebuilt. Keyed by source file rather than by clip, so splitting
  a clip does not decode the same file twice; the cache value is the in-flight promise, so
  two clips mounting on one frame wait on one extraction.
- A trim drag moves exactly two numbers — the window's width and the strip's offset — as
  RN `Animated` values, and commits once on release. Writing to `items` per frame would
  re-lay-out every later clip and every aux row at 60fps for a gesture with one outcome.
- **The edge is clamped during the drag, not at the commit.** Letting a handle run past
  the end of the footage and correcting on release reads as the app rejecting the gesture.
- **Handles sit outside the clip's press target.** A `PanResponder` nested inside a
  `TouchableOpacity` has to take the touch off it on every grab, and losing that race once
  is a trim that selects the clip instead. They also carry
  `onPanResponderTerminationRequest: () => false`, or the horizontal ScrollView they live
  in asks for the touch back the moment the finger moves sideways — which is every trim.
- **One undecodable frame used to cost the whole strip.** The native side does
  `bitmaps.awaitAll()` — it awaits every requested frame together, so a single seek point
  that will not decode rejects all of them, and the clip gets no strip at all rather than
  one gap. Variable-frame-rate footage, which is what phone cameras record, is exactly
  where `getFrameAtTime` returns null. **This was the bug that made every clip grey on
  first release** (`24c2ec84`). The batch is still tried first; only on failure are the
  frames asked for one at a time, keeping whatever lands, with a failed time held as a
  gap tile so the strip keeps its length and stays aligned to the ruler.
- A strip that fails now **says why, on the clip**, instead of being a silent grey box —
  the decoder's message, or `no duration` for the case below. Worth keeping: this failure
  is only reachable on a real device, and the first version swallowed the reason in a
  `catch` that cost a whole round trip to the device to recover.
- **Add buttons float, one per row, down the right edge** (`ADD_RAIL` / `styles.addRail`).
  They have to be outside the ScrollView: they used to sit at the end of their own row,
  which was survivable when a clip was a 72px chip and stopped being so the moment a row
  became as long as the media on it. Each is centred on its row's **measured** frame, not
  on a table of row heights — a row is only as tall as whatever chip is on it. The rail
  is `pointerEvents="box-none"`, or it would swallow every scrub crossing the right-hand
  end of the strip. The empty-state buttons stay at the *head* of each row; they are
  already in reach and they are what names a row with nothing on it yet.
- Known gap this exposed, not fixed: **`ImagePicker` does not always report a video's
  duration**, and nothing measures it afterwards. `pickMedia` falls back to `trimEnd: 3`,
  so such a clip is 3s to the strip, the playhead and the export alike. Its right handle
  refuses to extend, which is the safe reading of not knowing, but the real fix is to
  measure the duration on add. The strip shows `no duration` when this bites.

## Repo hygiene (as of Aug 5 2026)

- `rebuild/phase-4` pushed to `origin`, confirmed at `f3a8e26d` (Aug 6 2026).
- `node_modules/` removed from git tracking (was previously committed, which is
  unusual/wrong) — now gitignored, relies on `package-lock.json` for reproducible
  installs.
- `EditVideoScreen.js.bak_*` recovery snapshots gitignored (left on disk, not deleted).
- Work now lives in `~/tonefy-build` (persistent), not `/tmp` — the `/tmp` copy was
  the source of the original data-loss incident and should be treated as a stale
  backup only, safe to remove once confidence is established.

## IMMEDIATE NEXT STEPS

1. ~~Set up a separate `recovery-test` channel~~ — **dropped Aug 6 2026.** Publishing
   straight to `preview` is approved (single user, nothing to protect). Test there.
2. On-device test of `rebuild/phase-4` is in progress. Latest publish to `preview` is
   update group `6ae72ff8-619c-40b0-90ba-beb34d4b62c0` (commit `e8683619`, runtime
   1.1.0, filmstrip trim sheet + trim/replace correctness + PostRecording colours)
   on Aug 7 2026.

   **A commit is not a publish.** Four changes landed on `main` before this update
   went out, and a device test of them reported the *old* screen back - correctly,
   because the phone was still running `25b02b2d` from nineteen commits earlier.
   `eas update --branch preview` is the step that makes work testable; running it is
   part of finishing a change, not a separate errand. Cheap way to tell which bundle
   a phone is on: pick any colour that moved recently. The modal Apply button was
   `#00d4d4` at `25b02b2d` and is `#2ECC71` now, so a teal Apply dates the build
   without any guessing.

   Superseding
   `b9008c6b-6dae-43a6-aa81-9becc1e0fc73` (commit `310644df`, a header add bar —
   reverted, the buttons belong on their own rows),
   `d884a9b4-b92d-43ba-ba69-050f3c648ebc` (commit `24c2ec84`, the per-frame fallback
   that made the filmstrip actually render — **confirmed working on device**),
   `6ac0e67a-91f3-41fd-9d94-f45fa41ce3df` (commit `22cbb059`,
   the timeline filmstrip + time-proportional clips + clip trim handles),
   `6a6076f6-6c26-4632-94cc-e09a13cea57b` (commit `b67b08cb`,
   the corner handle winning its own finger + `averageTouches`),
   `a9d57a65-71d1-4c7a-9a8c-bb335cd2759b` (commit `05e26d3b`, the guard
   script and updater purity), `e7850ff7-a5d7-494f-bba3-9507196d21f0` (commit
   `75198f47`, the Add Text grey-screen fix — anything published before this one
   grey-screens on mount, so it is not worth testing),
   `9be0586f-0d06-4de4-a475-0b966df5d7c6` (commit `256fff8e`, on-canvas typing +
   text background chip + the `size / 18` scaling fixes),
   `e3705693-3ccd-49d9-ae60-de700a4e3af9` (commit `50570dc9`,
   the 130-style caption catalogue),
   `f63025f2-1c0e-4262-871b-19fa019004bd` (commit `b289df85`),
   `24fa85fa-d9e5-4449-9d40-34a9a8b6af57`
   (commit `ef882e58`), `42422470-8b9d-4381-b2ae-f831fff19ff8`
   (commit `734d746e`) and `9f403a24-2afb-4454-a741-505825af5584` (commit
   `f8b0d7ec`). Awaiting confirmation:
   - **Timeline filmstrip (`48c35bec`, `24c2ec84`)** — ✅ frames confirmed rendering on
     device Aug 7 2026. Still unconfirmed on this surface: the **alignment** claim,
     which is the real point of the change — add a voiceover and a moment in the audio
     should sit under the frame it belongs to, with **two or more clips of different
     lengths** as the discriminating case, since the old fixed-width chips were only
     ever right when every clip was the same length as every other.
   - **Clip trim handles (`22cbb059`)** — a selected clip has a handle at each end.
     Test: drag each and confirm the frames slide under it live rather than the strip
     going blank and repainting on release, that it stops dead at the end of the
     footage rather than running past and snapping back, and that the clip cannot go
     below ~0.3s. Trim, then play, and confirm the export starts where the handle was
     left. A **still image** clip is its own case: both edges just change how long it
     is held, up to 30s.
   - **Per-row floating add buttons (`25b02b2d`)** — clip, voiceover, music, text,
     captions, stacked down the right edge, each floating over its own row. Test: scroll
     the timeline a long way and confirm all five stay put and still open the right
     thing; scrub by dragging across the right-hand end of the strip and confirm the
     rail does not swallow it (that is the `box-none` claim). Each button should sit
     centred on its row, including after a row changes height — adding the first text
     overlay swaps a chip in and is the case that would expose a hardcoded height
     table. Note `310644df` put these in a header bar instead and was reverted in
     `25b02b2d`; the time markers it removed are back, and are still the static
     `[0,1,2,3,4]` ruler they always were — a real ruler is unbuilt work, not a bug.
   - **Corner handle and two-finger rotate (`b67b08cb`)** — dragging the corner
     handle used to move the overlay instead of turning it, and a two-finger turn
     threw it across the frame. Test: drag the handle on a selected overlay and
     confirm it rotates and resizes without translating; then two-finger rotate and
     confirm the overlay turns about its centre rather than bolting. Tap-to-select,
     tap-again-to-type and the long-press style sheet must all still work, since
     `blocksExternalGesture` makes them wait for the handle to fail — the failure
     mode to watch for is a tap that now feels laggy or gets dropped near the corner.
     Rotation should snap within 4° of level.
   - **On-canvas typing (`dd1c0a81`)** — tap an overlay to select, tap again to put a
     caret in it. Test: type into a stroked style and confirm the stroke and glow stay
     on while editing (a plain input would drop them); place the caret mid-word and
     confirm it lands between the letters it looks like it lands between, which is the
     `captionMetrics` shared-layout claim; drag the keyboard's own selection handles,
     which only work if the canvas gestures really are off. Long press should open the
     style sheet. Clearing an overlay to empty should delete it rather than leave an
     invisible tap target. The discriminating case is a **tracked or large style**,
     where a caret laid out from different metrics than the render drifts visibly.
   - **Text background chip (`dd1c0a81`)** — Add Text now has colour, opacity, radius
     and padding for a chip behind the words. Test: set one, then export and confirm the
     burned-in chip matches; it travels as a spec `box`, so it shares the server path
     with boxed caption styles and needs the backend restart below to draw at all.
   - **Chip corners and shadow blur (`4d47c7cc`)** — both were fixed on this side while
     everything around them scaled with the font size. Test: put a rounded boxed style
     (Sticker, Reels, Cobalt) on the canvas at a large size and check the corner
     rounding matches its own tile in the picker and the burned-in export — this is
     three renders of one number and they should now agree. A pill style (`radius: 999`)
     must still be a pill at every size. Then a heavy shadow style (Heavyweight,
     Clickbait) large, where the blur should grow with the word instead of staying a
     hard second copy of it. All three are invisible at size 18, which is exactly the
     size a swatch is nearest — check on the canvas, not in the sheet.
   - **Font grid (`734d746e`, specimen word `ef882e58`, group order `b289df85`)** —
     the font sheet lays the families out as a three-column grid of specimen tiles
     (the word "Quick" set in the family, name beneath in the system face) instead
     of one full-width row each. The specimen
     is a whole word rather than a letter pair because a typeface's character is in
     its rhythm; it shrinks to fit (`adjustsFontSizeToFit`, floor 0.6) since the
     families are nowhere near equal in width at a given size, and carries no fixed
     `lineHeight`, which would clip the taller display faces. Group headers keep a
     full-width row of their own, so the grid is built by chunking each group into
     rows of three and making each row one FlatList item — `numColumns` cannot do
     this, as it lays every item into a cell, headers included. Groups run
     Handwriting, Display, Sans, Serif, Mono — that order is `GROUP_ORDER` in
     `FontPicker.js`, not in `constants/fonts.js`, whose "GENERATED" header means an
     order set there would be lost on regeneration; groups it does not name keep
     their upstream position behind the ones it does. System/Default stays pinned
     above all of them, being the current-value fallback rather than a category.
     Test: the last row of a group should keep its tiles at column width rather
     than stretching them,
     and search should still return a flat grid with no headers.
   - **Fonts (`f8b0d7ec`)** — the text sheet now offers 130 families instead of
     `['Default','Bold','Italic','Mono']`, which were never families at all and
     mapped to nothing in the export. TTFs ship in `assets/fonts` (6.2MB, Google's
     latin subsets) and in `backend/fonts`; `constants/fonts.js` is generated by
     `scripts/fetch-fonts.py` from `scripts/fonts.families.txt`, and the backend
     reads `fonts/manifest.json` rather than a hardcoded map. **The backend was
     restarted Aug 6 2026 and now serves the 130-family manifest** — the old
     21-entry fallback is no longer in play (it only applies if manifest.json goes
     missing or unreadable, which logs a `[fonts]` warning). Verified before the
     restart: 130 manifest families, 130 TTFs in `assets/fonts`, every manifest
     entry resolving to a file that exists, and no family in the app list absent
     from the backend manifest. Test: pick a font, check the preview, then export
     and confirm the burned-in text matches.
   - **Colour picker (`f56257a7`)** — Add Text / Add Caption now carries a full
     picker (saturation-value plane, hue slider, hex field) behind the tune button
     at the end of the swatch row, drawn with `react-native-svg` gradients. Colours
     mixed on the plane persist to recents via AsyncStorage (`tonefy.recentTextColors`,
     8 entries, presets excluded). Test: drag on the plane (the sheet must not
     scroll under the finger), type a hex, then reopen the sheet on an existing
     overlay and confirm the plane adopts that overlay's colour. Solid colours only
     — but note the export path already renders gradients: `server.js:1983` fills
     from `t.gradient` when an overlay carries a two-stop array, so a Gradient tab
     is frontend-only work, not blocked on the backend as previously recorded.

     As first published (`f56257a7`) the plane and hue slider took no touches at
     all: `useDragTracker` returned the `PanResponder.create` wrapper instead of
     the `panHandlers` inside it, so spreading it onto a View set one ignored prop
     and attached no responder callbacks. Fixed in `bf87b82e`. Worth remembering as
     a class of bug — it bundles clean, renders correctly, and fails only on touch,
     so nothing short of a device catches it.

     The Auto Captions sheet carries the same picker as of `8869e8b5`, seeded from
     the selected style with a "Match style" revert. It appears only when a
     voiceover track exists: that path times words on device and emits text
     overlays, whose `color` survives to `/api/render`. With no voiceover,
     `/api/edit-video` burns captions in via `buildAssFile` from the server's own
     `STYLES` table, so the sheet explains that instead of offering a dead control.
     Closing that gap — a `captionColor` param through `buildAssFile` — would also
     give the Idea/Script/Url→Video screens caption colour, which they likewise
     lack. Not done; would be backend work in `~/Tonefy-react/backend/server.js`.

     Note the app has no other colour-choosing surface. The `boxColors` arrays in
     the generation screens are a loading animation, not a picker.
   - **Preview/scroll sync (`712adbda`)** — the timeline now follows the video
     decoder's reported position instead of seeking the decoder to match a wall
     clock. The old correction could not converge on Android, where a seek lands on
     the nearest preceding keyframe, so it re-fired every 200ms pass. Play-start and
     paused scrubbing also now seek the canvas, which they never did.
     Test: scrub somewhere mid-timeline while paused (canvas should follow the
     scrubber, not hold a stale frame), then hit play — the first frame should be the
     one under the scrubber, and clip boundaries should not jump. Multi-clip and
     trimmed clips are the discriminating cases; a single untrimmed clip starting at 0
     exercises a path that was never broken.
   - Audio track durations are now measured rather than falling back to a hardcoded
     5s, which had been truncating each track's mixer window (`609b06e1`), and the
     throwaway duration probe that stole audio focus mid-playback is gone (`e1937cfe`).
   - The music library audition sound could be adopted *after* the stop that was
     meant to cancel it, leaving an orphaned sound outside the mixer — audible over
     the timeline, deaf to play/pause, never seeking. This is what made Add Music
     ignore playback control while voiceover, which has no audition path, stayed in
     sync (`0286a94c`). The discriminating test is to hit Add **while the preview is
     still buffering**; waiting for the audition to start playing first exercises a
     path that was never broken.

   - **Caption styles (`5ff8992d`)** — the Auto Captions sheet's style row opens a
     searchable sheet of 138 styles across 13 categories, each tile previewing the
     real style rather than a coloured word. Test: pick a stroke-heavy style
     (Punch, Impact) and a boxed one (Newsroom, Sticker) and check the canvas
     overlay matches its tile; pick a gradient style (Sunset) and confirm the fill
     ramps across the characters; then override the colour and confirm the gradient
     gives way to it. The discriminating cases are a **two-line caption** — the
     outline's line breaks must land where the fill's do — and a **long word in a
     boxed style**, where the chip should hug the text rather than the caption's
     80%-width column.

   **Backend restarted Aug 7 2026, 09:12** — `pm2 restart tonefy-backend`, pid 3872,
   restart #7, no unstable restarts, font manifest loaded without a `[fonts]` warning.
   The spec-driven caption rendering is live, so stroke, glow, box and the word chip now
   survive to the export instead of being dropped. Verified by process start time
   (09:12:51) postdating the last `server.js` edit (08:55:32) — the check to repeat,
   since "I restarted it" and "it is running that code" are not the same claim.

   Note what was actually deployed: HEAD is `02a75a25`, not the `e2e2c670` this file used
   to name, **plus uncommitted `server.js` changes** — the backend half of the word chip
   (`labelWidth`/`labelPad`/`wordBoxInLabel`, the fill recolour, the chip layer). A
   restart deploys the working tree, not the last commit, so read `git diff` before
   restarting rather than trusting the commit id. Those changes are still uncommitted.

   **No longer blocked (Aug 8 2026).** `git -C ~/Tonefy-react push origin master`
   now succeeds — verified by pushing seven backend commits and confirming
   `origin/master` matches local at `2b7bccc1`, 0 ahead / 0 behind. Whatever denied
   the credential 403 has been resolved. The backend is no longer single-disk, so
   "commit it but you cannot push" is not a constraint to plan around any more.
   Push backend work as normal.

   Once confirmed on device, open a PR into `main` and merge.
3. ~~Eight caption styles have never been verified against the export.~~ — **closed
   Aug 11 2026.** The eight `hl-*` (Highlight) styles added in `33b4ef33` are the only
   styles in the catalogue carrying a `highlight` field, so neither export path had ever
   actually exercised it. Verified against both real renderers, not by reading the code:

   - **ImageMagick path (`/api/media-to-video`, voiceover-driven auto-captions) — all
     eight correct.** Ran the actual extracted `labelWidth`/`labelPad`/`wordBoxInLabel`
     functions against the real font files and real `convert`/`identify` binaries: the
     spoken word's box lands inside the canvas for all eight, and a pixel-histogram check
     of the composited PNG confirms the recoloured word takes exactly `highlight.textColor`
     while its neighbour keeps the base fill colour, for every style tested.
   - **ASS path (`/api/edit-video`, the no-voiceover route `handleAutoCaption()` in
     `EditVideoScreen.js` actually calls) — all eight were broken, silently.**
     `assStyleFromSpec`/`buildAssFile` never read `spec.highlight` anywhere. Confirmed by
     extracting the exact deployed function and running it against real specs: one flat
     Dialogue line per chunk, zero per-word emphasis, no trace of the highlight colour in
     the output. Not a crash, not an error — a Highlight-category style picked with no
     voiceover rendered indistinguishable from a plain stroke style, which is the "ships
     clean, wrong on screen" failure shape this file keeps flagging as the dangerous kind.

   **Fixed in `036aad9f`** (`~/Tonefy-react/backend`, pushed, deployed via `pm2 restart`
   Aug 11 2026). Not a chip — a real chip needs the same glyph-offset measurement the
   ImageMagick path gets from ImageMagick's own `identify`, which this string-only ASS
   builder has no equivalent of. What it does instead: inline `\1c` colour-override tags
   recolour just the active word within the phrase (the phrase itself stays fully visible
   throughout, matching the "chip follows the voice" intent minus the chip), using real
   per-word whisper timing when available and an even split of the chunk's own window
   otherwise — the only case actually reachable today, since `handleAutoCaption` never
   sends `voiceoverUrl` to this endpoint. Verified by burning the generated `.ass` into a
   real frame with the exact `ass=...:fontsdir=...` filter this file already uses: libass
   parses the new tags without error, and the frame's colour histogram shows two distinct
   colours landing on the right words. Known, accepted limitation: some `highlight.textColor`
   values (e.g. `hl-yellow`, `hl-mono`'s `#1A1400`) were designed to sit on a bright chip:
   without one they're low-contrast against a dark background in this fallback path. Worse
   than the chip version, better than rendering no differently from a plain stroke style.

4. ~~Remove the `/tmp/tonefy-build` backup copy~~ — **done Aug 11 2026.** Checked before
   deleting: its last commit (`b2ea9216`) was already present in `~/tonefy-build`'s
   history, and the one non-trivial uncommitted diff on top of it (766 lines in
   `EditVideoScreen.js`) introduced identifiers - `AudioTrackRow`, `ClipsRow`,
   `TextRow`, `CaptionsRow`, `applyAudioTrimEdit`, `captionPreviewGroups` - that exactly
   match Phase 2-4 features already documented complete above. An earlier draft of
   already-shipped work, not anything unique. Removed with `rm -rf`.
5. Rotate the exposed GitHub PAT in `xauusd_scalper` repo config (unrelated hygiene
   item, low priority, not urgent).
6. **Sign-up now asks for full name and country** (commit `7b6d26e7`, published Aug 10
   2026 as update group `c29281a5-c78d-4a01-9bf6-cfe6f30aacb8`, runtime 1.1.0) — new
   `components/CountryPicker.js` (searchable sheet) and `constants/countries.js` (194
   names, no flag emoji, per the no-emoji rule). `fullName` goes through
   `updateProfile` the same way `ProfileScreen.js` already reads `displayName`; country
   has nowhere in Auth to live, so it gets its own minimal Firestore doc at
   `users/{uid}`, written while still authenticated and wrapped in its own try/catch so
   a Firestore failure can't block the verification email. **Untested on device** —
   this is a new sign-up path, not a hot-reloadable screen tweak, so the discriminating
   test is a real signup: full name saved as `displayName` (check via ProfileScreen),
   country saved to Firestore `users/{uid}`, and — the case most likely to actually
   break — Firestore security rules actually permitting an unauthenticated-a-moment-ago
   user to write their own new doc right after `createUserWithEmailAndPassword`
   resolves.
7. **Profile screen: real brand marks + Dark Mode now persists** (commits `44069a7b`,
   `1e259396`, published Aug 10 2026 as update groups `2d273779-afa0-430c-99ff-c0afc58f8989`
   and `f9c13a95-3a8f-40cf-872e-6019669af765`, runtime 1.1.0). TikTok/Facebook/Instagram
   now use `FontAwesome6`'s brand glyphs (bundled with `@expo/vector-icons`, no new
   native module) with each platform's real badge colour, replacing MaterialIcons
   stand-ins that had no actual TikTok or Instagram glyph to draw from. Test Crash
   (a Sentry-wiring check, not a real control) is gone.

   Separately: `context/ThemeContext.js`'s `isDark` was plain `useState`, so the Dark
   Mode switch on the Settings sheet reset to dark on every restart. Persisted to
   AsyncStorage (`tonefy.darkMode`). While in there, the Settings sheet's own divider,
   Close button and grabber handle were found hardcoded to the dark palette regardless
   of `theme.*` — fixed, since shipping "the toggle now persists" while the sheet it
   lives in still breaks in light mode would not actually be done.
8. **Dark Mode extended to the app's chrome screens** (commit `d1df1ffa`, published
   Aug 10 2026 as update group `bc60b6f4-5d39-4607-9ed2-7e3769f2c662`, runtime 1.1.0).
   `AuthScreen.js`, `ProfileScreen.js`, `MyVideosScreen.js`, `CalendarScreen.js`,
   `ConnectAccountsScreen.js`, `components/CountryPicker.js` and the bottom tab bar
   (`MainTabs.js`) now pull from `ThemeContext` instead of hardcoding the dark palette.
   Added `inputBg`/`inputBorder`/`handle` tokens for form fields and sheet grabbers
   that had no prior token. Semantic status chips (connected/soon badges, danger
   buttons, the 2FA lock badge) get their own light-mode tint inline per screen rather
   than new shared tokens, since each is a one-off state colour, not a reusable surface
   — worth checking those specifically on a real light-mode pass, since they're the
   most likely spot for a missed hardcoded value the build check can't catch (wrong
   colors compile fine).

   **Deliberately still dark-only, on purpose, not by omission:** the editor
   (`EditVideoScreen.js`) and everything in its family — `EditPostVideoScreen.js`,
   `RecordingScreen.js`, `RecordToVideoScreen.js`, `PostRecordingScreen.js`, the three
   `*ToVideoScreen.js` generation screens, and the audio generation/result screens
   (`IdeaToAudioScreen.js`, `ScriptToAudioScreen.js`, `GeneratingAudioScreen.js`,
   `AudioResultScreen.js`) — matching every serious competitor (CapCut, Canva,
   Lightroom mobile keep the editing canvas dark regardless of system theme) and this
   app's own dark-first identity. `LandingScreen.js` is also excluded: a pre-auth
   marketing splash built on ambient glow effects tuned to sit against near-black, not
   a colour-swap job, for a screen most people see once before signing up. Extending
   further needs an explicit ask, same as before.
9. **MyVideosScreen status-bar overlap + stacked back button** (commit `8d85d988`,
   published Aug 10 2026 as update group `7579ca1f-58e1-4319-8c2e-f353a2a0a146`,
   runtime 1.1.0). `MyVideosScreen.js` never consumed `useSafeAreaInsets` — same class
   of bug as the App.js `SafeAreaProvider` fix, just a screen that hadn't been touched
   yet; now uses the same `insets.top` pattern as `PostRecordingScreen.js`. Separately,
   its back arrow + "Back" label were laid out as unstyled siblings inside a
   `TouchableOpacity` with no `flexDirection`, so RN's default column layout stacked
   the arrow above the text. `ConnectAccountsScreen.js` had the identical copy-pasted
   bug, fixed alongside. **Same stacked-back-button pattern still exists** in
   `IdeaToVideoScreen.js`, `UrlToVideoScreen.js`, `ScriptToVideoScreen.js`,
   `EditPostVideoScreen.js` and `RecordToVideoScreen.js` (grepped, not fixed) — same
   one-line fix (`style={{flexDirection:'row',alignItems:'center',gap:4}}` on the
   TouchableOpacity) whenever one of those is touched next.
10. **Notifications and Help & Support screens** (commit `137e46c9`, published Aug 10
    2026 as update group `7b69b572-bd5a-40c7-a247-2c698bae15ea`, runtime 1.1.0). Both
    Settings-sheet rows had no `onPress` — tapping did nothing. `NotificationsScreen.js`
    surfaces the re-engagement reminder toggle that `utils/notifications.js` already
    implemented (permission request, schedule, cancel) but that nothing in the UI had
    ever exposed — it was only ever triggered from inside `EditVideoScreen` after an
    export. When the installed build lacks the native notifications module, the toggle
    disables itself with an explanation rather than looking broken (same OTA-safety
    pattern the file already documents). Added `remindersEnabled()` to read the
    scheduled-state back for the toggle's initial value. `HelpSupportScreen.js` is a
    self-written FAQ plus a **Report an Issue** action that opens a prefilled `mailto:`
    to the app owner's real address — deliberately not a fabricated support inbox or
    help-center URL, since neither exists yet (checked both this repo and the live
    site's page list before writing it). Both screens are new chrome, themed like the
    rest of today's batch. **Untested on device.**
11. **Dark Mode now covers the whole app except EditVideoScreen** (commits `6daa7e16`,
    `a517f2f4`, `e29fa27b`, `d557f2f4`, `22d1e38c`, published Aug 10 2026 as update
    group `9c1916cd-6358-4ae7-b116-8240e0d020fb`, runtime 1.1.0). Direct instruction,
    overriding the earlier scoped-rollout call: theme everything, explicitly excluding
    only the editor. Twelve more screens converted on top of the seven from item 8 —
    `GeneratingAudioScreen`, `IdeaToAudioScreen`, `RecordToVideoScreen`,
    `AudioResultScreen`, `PostRecordingScreen`, `ScriptToAudioScreen`, `LandingScreen`,
    `EditPostVideoScreen`, `UrlToVideoScreen`, `ScriptToVideoScreen`,
    `IdeaToVideoScreen`, plus `RecordingScreen` assessed and left dark on purpose.

    **Three screens stayed dark despite the "theme everything" instruction, each
    flagged to the user rather than silently decided:**
    - `RecordingScreen.js` — a live camera viewfinder. Every element is a translucent
      dark chip meant to float over unpredictable camera footage (the same convention
      every camera app uses), not chrome sitting on a background color. There is no
      "screen background" to theme; the camera feed is the background.
    - `LandingScreen.js` — themed for surfaces/text, but its ambient glow blobs
      (translucent color circles tuned to sit against near-black) were left at their
      existing low opacity rather than redesigned. In light mode they read as a
      subtle tint rather than a glow — a cosmetic softening, not a break.
    - Media/camera-preview surfaces *within* otherwise-themed screens stay dark by
      established convention (first set in item 8's MyVideosScreen pass): video
      canvases, `RecordToVideoScreen`'s camera-preview placeholder and its overlay
      chips, `PostRecordingScreen`'s raw-preview box, `TransitionPreview`'s animated
      demo thumbnails. A surface standing in for camera/video content isn't chrome.

    `UrlToVideoScreen`, `ScriptToVideoScreen` and `IdeaToVideoScreen` share a near-
    identical wizard template (`SelectorRow`/`SettingCard`, `CaptionOptionRow`,
    `TransitionModal`, `OptionModal`, `StepDots`, `ProgressBar` as separate function
    components declared in each file) — each needed its own `useTheme()` call or a
    `theme` prop, since none of them inherit it automatically. `IdeaToVideoScreen`
    additionally has `SettingCard` (icon-badge rows) and `MusicTrackRow`/`MusicModal`
    (background-music picker with audition playback), unique to that screen.

    **The same stacked-back-button bug (icon and label as unstyled siblings, no
    `flexDirection`, RN's default column layout stacking them) turned up in six of
    these screens** — `EditPostVideoScreen`, `UrlToVideoScreen`, `ScriptToVideoScreen`,
    `IdeaToVideoScreen`, on top of the `MyVideosScreen`/`ConnectAccountsScreen` pair
    from item 9 — and was fixed in all of them alongside the theming, since they were
    already open. One incidental correctness fix along the way:
    `IdeaToVideoScreen`'s Preview Voiceover button used black text
    (`styles.btnText`'s default) on a dark navy background, already near-invisible
    before any theming; the new `theme.text` override fixes it in both modes.

    One overreach caught before committing, worth remembering as a class of mistake:
    while theming `UrlToVideoScreen`'s Copy Link button, its background was changed
    from green to neutral gray. Copy Link had never had an explicit color override —
    it inherited the shared green `.btn` style, same as Post/Schedule — so recoloring
    it to "neutral" was a button-hierarchy change smuggled in under a theming task,
    not a light/dark difference. Reverted before commit. Green vs. neutral is the
    separate, already-documented, not-yet-done teal/green rebrand — a task like this
    should touch *only* colors that differ between the two theme objects, nothing
    that was a fixed, unstyled value in both.
12. **Tiered video retention — "your videos, saved" as a paid feature** (four
    bisectable commits, Aug 10 2026, plus a crontab/system change with no commit of
    its own). App repo: `95666dc4`, published as update group
    `d8795acf-d750-43cb-bbcf-a5cf8283a67e`, runtime 1.1.0. Backend repo (`~/Tonefy-react`):
    `aaa0f043`, `22769cc3` (cron removal has no commit — see below), deployed via
    `pm2 restart tonefy-backend` at 15:46:59, confirmed postdating the last edit
    (15:45) with a clean startup log and no unstable restarts.

    **The prerequisite this whole feature was blocked on:** there was no plan/
    subscription field anywhere — `constants/plan.js` was a device-local AsyncStorage
    mock (explicitly documented as such in its own comment), the backend had zero
    concept of plan/tier, and `ProfileScreen.js`'s "Free Plan" badge was hardcoded
    text shown to every user. Now: `users/{uid}.plan` in Firestore, values `"free"` |
    `"pro"` | `"creator"`, missing/absent = free. **No billing integration** — set by
    hand in the Firestore console. To test paid retention or the Profile badge on a
    real account: open Firestore console → `users/{uid}` → add/edit `plan` field.
    `ProfileScreen.js` and the `EditVideoScreen.js:3514` premium gate both read this
    live via `usePlan()` (`constants/plan.js`, rewritten to `onSnapshot` +
    `onAuthStateChanged` instead of AsyncStorage) — a Firestore console edit should
    show up in the app without a restart.

    **Commit 1** (`aaa0f043`) — `txtrender-*.png` (the composited text-overlay image
    burned into every export with text) was never unlinked anywhere: 1,764 files, 174MB
    at time of fix, growing with every render that has text. Wrapped the overlay-burn
    ffmpeg call in try/finally so cleanup happens whether it succeeds or fails. Same
    fix shape for `wavesrc`/`wavepcm` in `/api/audio-waveform`, which only cleaned up
    on the success path before. **Neither retroactively cleans the existing
    accumulation** — that's Commit 3's uploads sweep.

    **Commit 2** (no commit — not a git-tracked file) — `crontab -l` ran
    `/home/ahumuza/cleanup_videos.sh` every 3 days: a blind `find -mmin +X -delete`
    against `public/videos`/`public/audios` with **zero Firestore or plan awareness**.
    It had deleted nothing since it was added (its own log shows "0 files" on every
    run since June) purely because the in-process 10-minute sweep always won the race
    and deleted first — invisible, silent redundancy that would have become an active
    bug the moment the in-process sweep started skipping paid users' files. Removed
    from crontab (verified via diff: exactly one line gone, nothing else touched).
    Script file kept at its path but disabled — `exit 1` guard at the top, execute
    bit stripped, header explains why and points at `cleanupOldFiles()` as the one
    remaining mechanism. **Worth checking crontab again if disk cleanup ever looks
    wrong** — this class of "a second thing was doing the same job" is exactly what
    bit this feature before it shipped.

    **Commit 3** (`22769cc3`) — `cleanupOldFiles()` now resolves a video's plan via
    `userVideos.userId` → `users/{uid}.plan` before deleting: 72h if free (unchanged —
    that promise was never broken), 30 days otherwise. Three states, handled on
    purpose: no matching record/no plan field → `'free'` (nothing to protect); the
    Firestore lookup itself throwing → **treated as paid, file held one more cycle**
    (a lookup failure must never cost a paying user their video); a real plan value →
    applied directly. `getOwnerPlan()` carries a comment marking where a future
    subscription-lapse grace period hooks in — not built, since there's no billing yet
    for a plan to lapse from, but the shape was designed so it fits without rework.
    Also added `cleanupUploads()`, which never existed before: scratch-prefixed files
    (`wavesrc-`, `wavepcm-`, `transcribesrc-`, `captionsrc-`, `txtrender-`) at 48h,
    genuine uploads (random-hash filenames from `/api/upload-media`) at a flat,
    **not plan-aware**, generous 30 days — uploads have no per-file owner record the
    way `userVideos` does, and `utils/draft.js` drafts have no expiry of their own to
    key a shorter window off safely without real risk of breaking an in-progress edit.

    **Commit 4** (`95666dc4`) — `usePlan()` rewritten to read `users/{uid}.plan` live
    (`onSnapshot`, following `onAuthStateChanged` so it resolves correctly regardless
    of mount order relative to auth) instead of AsyncStorage. Tier constants aligned
    to what the backend actually uses — `TIER_STANDARD` (`'standard'`) never
    corresponded to a real value anywhere and is gone; added `TIER_CREATOR`.
    `EditVideoScreen.js`'s premium gate needed zero changes — it only ever
    destructured `isPremium`, confirmed by grep before touching anything, which is
    the entire reason `usePlan()` was built as one hook in the first place.

    **What's explicitly not built, on purpose:** cloud storage (Firebase Storage stays
    initialized-but-unused; both retention tiers are VPS disk, a deliberate call per
    "upgrading the promise is easy, downgrading one is not"), subscription-lapse
    behavior (delete vs. read-only vs. grace period — a product decision with no
    billing yet to trigger it), and billing itself. **Untested on device or against a
    real paid account** — the retention logic has never actually held a video past
    72h end-to-end; verifying that needs a real `users/{uid}.plan = "pro"` account,
    a generated video older than 72h, and confirming it survives a cleanup cycle
    rather than reading the code and trusting it.
13. **Subscription pricing, Phase 1 (Aug 10 2026) — credits, per-tier caps, no billing yet.**
    Nine backend commits (`~/Tonefy-react`, `1a1084de`..`0a9bc0dc`) plus four app commits
    (`4e683f4d`..`a0dab42c`, published as update group `3c5211c5-9666-4d8b-9345-7082643d1ede`,
    runtime 1.1.0). Payment provider is **Google Play Billing, not Stripe** — a mid-planning
    pivot (the original proposal below item 12 assumed Stripe; that's superseded). Play
    Console is still under identity verification, so this phase is deliberately scoped to
    everything that doesn't depend on it: credit tracking, tier caps, enforcement,
    UI — no purchase flow, no `react-native-iap`, no native build.

    **Tiers** (`~/Tonefy-react/backend/tiers.js`, new module — kept separate from the
    ~2900-line `server.js` since three endpoints sharing this logic inline would drift
    the first time one got a fix the others didn't): free (5 credits/mo, 1 min/export,
    720p, watermark, 12 legacy caption styles, 3 gTTS voices), pro (60 credits, 15 min,
    1080p, no watermark, everything), creator (300 credits, 40 min, 1080p, no watermark,
    everything, jumps the render queue). **`FREE_CAPTION_STYLES`/`FREE_VOICES` are stated
    defaults, not a confirmed product decision** — the 12 legacy styles and 3 gTTS voices
    are the most defensible lines available without guessing at one (both already-existing
    boundaries in the app's own history, not invented here). One array each to edit once
    the real answer is known. `constants/plan.js` on the app side mirrors these as
    `TIER_CAPS`, UI-only — the backend is what actually enforces every cap.

    **A real security gap found and fixed first, before anything else** (`aaa0f043`... no,
    `1a1084de`/`975e73a3`): `/api/media-to-video` and `/api/edit-video` both derived the
    Firestore-record owner from `req.body.userId` — a client-supplied value — instead of
    `req.user.uid` from the verified token. Harmless before credits existed (just
    misattributed a record); would have made credit enforcement trivially bypassable
    (claim any uid, render for free or drain someone else's balance) had it shipped
    unfixed. **The first commit's message claimed this was already fine everywhere else,
    based on checking one endpoint (`idea-to-video-v2`) — it wasn't; `edit-video` had the
    identical bug, caught and fixed in a follow-up commit.** Worth remembering: "every
    other endpoint already does X" is a claim to verify per-endpoint, not infer from one.

    **Per-endpoint reality, not force-fitted uniformly** — each of the three render
    endpoints got exactly the checks its own parameters support, confirmed by reading
    actual request bodies rather than assuming symmetry:
    - `/api/media-to-video` (timeline editor export) — full synchronous check before
      `createJob()` (duration estimable up front from `mediaItems`' trim/speed data).
      Gained watermarking, which it had **zero** of before this — idea-to-video/v2
      already burned one in unconditionally, but the editor's own export path had none
      at all, which would have made "no watermark" a Pro benefit only for AI-generated
      videos. No caption-style/voice gating — this endpoint doesn't accept either param.
    - `/api/idea-to-video-v2` — credits/caption-style checked synchronously up front; a
      rough word-count duration estimate (~150 wpm) catches obviously-oversized requests
      before spending anything on TTS/Pexels, with a **precise** recheck once real audio
      duration is known, before the expensive per-segment work starts (fails the *job*
      at that point, not the HTTP request, since a jobId was already returned — still
      surfaces clearly via job status). Gained **real 1080p output** — it had no
      resolution parameter at all before, a fixed ~720p `scaleFilter` regardless of
      plan; now driven by the same `frameSize()`/`SHORT_EDGE` helper `media-to-video`
      already used. Watermark made conditional (was unconditional). No voice param here
      at all — it consumes audio `/api/generate-audio` already generated, so **voice
      gating lives on `/api/generate-audio` instead**, which also covers the standalone
      Idea/Script-to-Audio screens correctly (voice access is a plan property regardless
      of whether the audio ends up in a video).
    - `/api/edit-video` (caption burn-in onto an existing video) — full synchronous
      check like media-to-video (duration cheaply known via one ffprobe on the source,
      moved earlier in the handler). **No resolution cap** — this endpoint doesn't scale
      or re-encode to a chosen resolution at all, it burns captions at whatever
      resolution the input already is; adding a cap would mean adding a re-encode step
      that isn't otherwise part of the job. Gained watermarking (had none), folded into
      the same filter chain as caption burn-in so a watermark-only export still gets a
      real encode instead of the original `-c copy` fast path (which can't add a filter).

    **Credits deducted once, after success, from `ffprobe` on the real output — never
    the pre-flight estimate**, via a new shared `probeDurationSeconds()` helper (the
    same `ffprobe -show_entries format=duration` line already existed inline three
    times elsewhere for audio; not retrofitted there, out of scope, just reused for the
    new call sites). `deductCredits()` uses `FieldValue.increment`, not read-modify-
    write, so two renders finishing close together for one account can't clobber each
    other's deduction. **Deliberately allowed to go negative** — a render that already
    finished slightly over budget is real compute already spent; discarding finished
    work to keep a counter non-negative wastes more than it protects. Deduction is
    non-fatal on its own (wrapped separately, logs rather than fails the job) since the
    video is already done and saved by that point — a Firestore hiccup must not turn a
    successful render into a failed one.

    **Fail-safe direction, explicit and tested**: if the plan lookup itself throws (not
    "no record" — a genuine Firestore error), `checkRenderAllowed` treats the account as
    paid and holds the render rather than risk rejecting or undercharging a real
    subscriber over a transient blip.

    **Priority render queue** — only `idea-to-video-v2` ever called
    `acquireVideoSlot()`/`releaseVideoSlot()`; `media-to-video`/`edit-video` have no
    concurrency limiter at all (confirmed by grep, not assumed) — scoped to what
    exists rather than adding a limiter to two endpoints that never had one. Two queues
    now: Creator-tier requests drain first once a slot frees up, but this only changes
    which *waiter* gets the next slot — never touches `activeVideoJobs` or preempts
    anything already running.

    **Monthly credit reset — a deliberate deviation from the original Stripe-era
    design.** That design was free-only-via-cron, paid-driven-by-webhooks-on-the-real-
    billing-period (correct once Play Billing/Phase 2 exists — a generic sweep drifting
    from the actual renewal date is exactly the mismatch a subscriber notices). Since
    Phase 2 is deferred, the sweep applies to **every** plan for now — a paid-only-via-
    webhook design today would mean a hand-set Pro/Creator test account never resets via
    *any* mechanism. Commented clearly for narrowing to `plan == 'free'` once Play's
    RTDN/purchase-verification flow exists.

    **App side**: `usePlan()` (`constants/plan.js`) extended, not replaced, with
    `creditsRemaining`/`creditsResetAt`/`caps` off the same `onSnapshot` listener — no
    new subscription. `EditVideoScreen.js`'s premium gate (`isPremium`) needed zero
    changes both times this session it could have broken, confirmed by grep before
    touching anything — the whole point of building it as one hook. Signup
    (`AuthScreen.js`) now seeds `plan`/`creditsRemaining`/`creditsResetAt`/
    `subscriptionStatus` explicitly rather than relying on the backend's lazy-init
    (`getUserPlanData`), which is a migration safety net for pre-existing accounts, not
    meant to be the primary path — without this a brand-new account showed no credits
    at all until its first render attempt. **5 credits / 30-day window is duplicated
    across both repos on purpose** (no shared package) — flagged in comments on both
    sides so it can't drift silently.

    **Soft paywall**: extended the *existing* `promptUpgrade()` in `EditVideoScreen.js`
    rather than building a parallel mechanism — it already had the right honest framing
    ("plans aren't on sale yet," no fake checkout link) and just needed its stale
    "Standard and Pro" copy fixed (`TIER_STANDARD` was removed earlier this session; this
    reference was missed) and a way to show the backend's specific rejection reason.
    Wired into all three places that can now receive a 402/403. **The original ask's
    "deep-link to the web pricing page for checkout" is explicitly not implemented** —
    written for the Stripe assumption; Play Billing checkout happens entirely inside the
    Android app via `react-native-iap`, not on a website, and no pricing page exists
    regardless. Also gated the resolution picker UI itself (grey out 1080p/4K, lock icon,
    tap prompts upgrade) using the same rank comparison the backend clamps with — UI-only,
    the server-side clamp was already the real enforcement. **Known minor gap, not
    fixed**: the picker's default state is `'1080p'` regardless of plan, so a free
    account that never opens it sees "1080p" as selected even though every export is
    still correctly clamped to 720p server-side — cosmetic only, left alone rather than
    risk auto-overriding a paid user's own deliberate lower-resolution choice.

    **Verification, matching the retention work's discipline — every backend commit
    tested against the live server, not just read through**: real Firebase ID tokens via
    custom-token exchange against disposable test accounts, real HTTP requests. Every
    rejection path confirmed (zero credits → 402, over-cap → 403, locked caption
    style/voice → 403, all with no `jobId` issued). **One full success-path run** on
    `edit-video`: real 5s render completed, credits correctly deducted 5→4
    (`ceil(5/60)=1`), a real `userVideos` record written with the right duration — the
    render→deduct→record chain confirmed working end to end, not just individually
    plausible (not repeated for the other two endpoints, which share the identical
    `tiers.js` functions — diminishing returns past the first full proof). The priority
    queue verified via an isolated reproduction of the exact algorithm (pure logic, no
    I/O — legitimate here unlike everything else, which needed the real deployed server
    because it involved external state). The credit reset sweep verified against a real
    ~10-minute wait for the actual scheduled `setInterval` tick, not a manual trigger —
    three fixtures (overdue free, overdue pro, not-yet-due), all three outcomes correct.
    All test accounts, Firestore fixtures and rendered files removed after each check.

    **What's still not built, on purpose**: everything Play-Billing-specific (Phase 2,
    blocked on Play Console identity verification) — `react-native-iap`, the purchase
    flow, server-side purchase verification, Real-time Developer Notifications, the
    native build that adding a native module requires. iOS monetization — explicitly
    out of scope per direct instruction (Android-only for now). The web pricing/account
    page from the original ask — superseded by the Play Billing pivot; a website can't
    process a Play Billing purchase, so it would be marketing copy at most, not built.
    Subscription-lapse behavior (delete vs. read-only vs. grace period) — still a
    product decision with no billing yet to trigger it, same as noted in item 12.
14. **Captions/overlays could render partially or fully outside the exported frame**
    (Aug 11 2026, `~/Tonefy-react/backend@e410f2e9`, deployed via `pm2 restart`) — two
    independent, unclamped mechanisms, both closed:

    - **ImageMagick path (`/api/media-to-video`)** — the composite position was computed
      straight from the overlay's centre x/y with no check against the frame, and the
      rendered PNG's own size was never capped either. `CanvasOverlay.js`'s pan/pinch
      clamps only bound the centre point and the scale factor (`[0.25, 6]`) independently
      — never the overlay's actual rendered bounding box — so a drag near an edge, a 6x
      pinch, or a caption whose wrapped lines simply ran wide at that font/size all
      produced a PNG that ffmpeg's `overlay` filter draws at whatever raw x/y it's given,
      with anything past `[0,W]x[0,H]` silently cut off by the frame boundary. Fixed by
      shrinking an oversized overlay to fit a safe zone (margin matches `CanvasOverlay`'s
      own `EDGE_MARGIN=8`, scaled to the export resolution, so the safe zone agrees with
      what the drag gesture already respects on-screen) before placement, then clamping
      `placeX`/`placeY` so the box can never leave the frame. The resize always leaves
      room for a valid clamp by construction (checked algebraically, not just tested).
    - **ASS path (`buildAssFile`, all 3 call sites)** — `PlayResX`/`PlayResY` were
      hardcoded to `720`/`1280` regardless of the real output frame. libass maps that
      virtual canvas onto the actual encoded resolution, stretching it non-uniformly
      whenever the two disagree, so `MarginL`/`MarginR`'s promised safe zone stopped
      corresponding to the real edges for any source that wasn't 720×1280. Confirmed by
      burning a real caption onto a 1280×720 (16:9) frame with the old hardcoded values
      vs. the real dimensions: measured rendered width differed by **1.776x**, matching
      the predicted `1280/720 = 1.778` distortion almost exactly — the exact mechanism
      that pushes a caption from safely inside the margin to past the real edge for
      longer/wider text. Fixed by threading the real output width/height through to
      `buildAssFile` at all three call sites: `frameSize()`'s own `scaleW`/`scaleH` where
      already computed, and a new `probeVideoDimensions()` ffprobe helper for
      `/api/edit-video`, which has no prior scale step to borrow dimensions from.

    Verified directly, not by reading: the ImageMagick clamp math against edge-drag,
    pinch-6x, long-word and normal-caption cases (all land fully inside the frame, the
    normal case unaffected — no change in behaviour for a caption that was already fine),
    and the ASS fix by burning real `.ass` output through the exact `ffmpeg`+`libass`
    filter this file already uses. **Not fixed on the app side** — `CanvasOverlay.js`'s
    pan/pinch clamps still only bound the centre point and scale independently, so a user
    can still drag/pinch an overlay into a state that looks off-frame in the live preview
    (`previewFrame` has `overflow:hidden`, so preview and the old export agreed — a user
    saw the crop coming). The export fix means the finished file no longer matches that
    preview in this situation: instead of a clipped fragment, the overlay now shrinks to
    fit and stays fully visible, smaller than it was dragged/pinched to. Extending the
    same bounding-box-aware clamp to `CanvasOverlay.js`'s own pan/pinch handlers (lines
    116-119, 131, 195 — it already measures the real box via `onLayout`, at `size.w`/
    `size.h`, just never consults it there) would make the preview match again, but
    touching gesture composition code carries its own established landmine risk in this
    file (see "Known bug pattern: gesture composition + config methods") and wasn't
    asked for — flagged rather than done.
15. **On-canvas text editing had no explicit way out and no shortcut to its style
    sheet** (commit `f6de3b07`, published Aug 11 2026 as update group
    `98f66e39-a024-44d9-a9a4-2eb90bd6d339`, runtime 1.1.0) — direct feedback from an
    on-device test of the on-canvas typing feature (item under Phase 3). Every gesture
    on an overlay is switched off while typing into it (needed so a tap lands in the
    text, not on the element - see "Type on the canvas" under Phase 3), which also hides
    the corner resize handle. That left editing with no visible exit besides tapping
    elsewhere on the canvas or the keyboard's own back action, and no route to
    font/colour/background without first leaving edit mode, deselecting, then
    long-pressing to find the gesture existed at all.

    Two small buttons now sit at the same corners the resize handle already uses when
    selected (its own bottom-right corner is free during editing regardless, since the
    handle is hidden then) - both counter-scaled the same way the handle already is, or
    a caption pinched to 4x would carry a button the size of a thumb: a close (`X`)
    button wired to the existing `endInlineEdit` (commit-or-delete-if-empty, unchanged),
    and a `tune` button wired to the existing `openOverlayStyleSheet` - the same callback
    the long-press gesture already calls, now also reachable without knowing long-press
    is the way in. `CanvasOverlay` gained one new prop (`onEditDone`) and reuses the
    existing `onLongPress` prop for the second button rather than adding another.
    `scripts/check-gesture-composition.py` run clean after, since this touched the same
    file the gesture-composition bug pattern lives in - no `.enabled()` was added to a
    composition, only two plain `TouchableOpacity`s as siblings of the existing gestures.

    **First on-device pass (same day) found two follow-ups, both fixed:**
    - The buttons themselves were too loud at 28px/20px icon sitting over caption-sized
      text - shrunk to a 20px circle / 13px icon (commit `6c58771b`, update group
      `849c864a-b34b-4a06-ad32-35c9a3702f8f`). Hit area held steady via the existing
      10px `hitSlop`, so the smaller circle didn't also shrink what you actually have to
      hit.
    - **A second, differently-coloured copy of the text appeared while typing**, offset
      from and wrapped differently than the real one, tracking every keystroke live, then
      vanishing the instant editing ended. Diagnosed with two questions rather than
      guessed: it updated with live typing (had to be the caret's own `TextInput`, not a
      stale render of something else) and disappeared the moment editing ended (so not a
      second persisted overlay - ruled out `textOverlays` holding a duplicate object).
      That combination points at Android's own IME **composing-span highlight** - some
      keyboards paint the still-uncommitted word (on at least this device, evidently the
      whole uncommitted buffer) in their own colour, as a system-drawn decoration that
      `color:'transparent'` has no authority over, since RN's `color` style only sets the
      base text paint, not the keyboard's own composing overlay. First attempt (commit
      `28f32b2f`, update group `2ab73009-6dd9-45bb-ac87-425fef57f264`) turned `autoCorrect`/
      `spellCheck` off on the caret `TextInput`, betting that committing each character
      immediately would leave nothing for the keyboard to paint a highlight on.

      **Confirmed on-device (same day, latest build) that this did not hold** - same bug,
      now showing black instead of the user's selected red, still tracking keystrokes live,
      still correcting the instant editing ended. Whichever keyboard this device runs
      apparently paints its composing highlight regardless of `autoCorrect`/`spellCheck`.
      Rather than chase that OEM by OEM, `withCaret()` (commit `4ae5a661`, update group
      `ee7bacd4-0140-4530-8741-a8bbd081ff77`) now takes an optional `caretColor`. Left
      `null` (the caption-styled call site, unchanged), it is the original trick - content
      stays visible, the input sits on top fully transparent - which a stroked/glowing
      style still needs, since a plain `TextInput` cannot reproduce those layers and this
      app already tested that they survive editing. Given a real colour (the plain-overlay
      call site, wired to `overlay.color`), it flips the trick instead of fighting the
      keyboard: content is hidden (`opacity: 0`, not unmounted, so it still sizes the box
      exactly as before) and the `TextInput` itself becomes the one visible copy, already
      in the right colour - there is no wrong colour left for any keyboard to paint over.
      **Untested on device.**
16. **Canva-style side-handle box-width resize for manual text overlays** (commit
    `0d215089`, published Aug 11 2026 as update group
    `7b22455d-f32b-4895-a001-e319aa9afeca`, runtime 1.1.0; backend half
    `Tonefy-react@7c22d107`, deployed same day via `pm2 restart`). Direct request,
    following a design discussion: the existing corner handle scales an overlay
    uniformly, font size included - Canva instead gives a text box two *independent*
    controls, a width (side handles) and a font size (corner), so a side-drag
    rewraps the text into more or fewer lines without touching how big it reads.
    Scoped to manual text overlays only, on purpose - a caption style has no
    independent box-width concept, and captions are short/style-driven in a way
    that doesn't benefit from it; the corner handle stays the only control there,
    unchanged.

    - **`CanvasOverlay.js`** — two new `Gesture.Pan` handles at the left/right-middle
      edges (`resizableWidth` prop, gated to `!captionStyleId && !isAutoCaption` at the
      call site), reusing the corner handle's own rotation-aware projection trick: a
      handle's "outward" direction is only meaningful in the overlay's own rotated
      frame, so the finger's screen-space translation is projected onto that axis via
      a dot product before it's allowed to change anything. Resizes **symmetrically
      about the centre** rather than pinning the opposite edge - the latter would also
      need x/y to move in a way that stays correct under rotation, solvable but
      meaningfully more state for a first version.
    - **Live drag shows a dashed ghost-box outline**, not a live text reflow - the
      outline is a pure Reanimated transform (`useSharedValue`/`useAnimatedStyle`,
      60fps, UI-thread only), while actual text reflow needs a real Yoga layout pass
      from committed React state. The text catches up to the outline the instant the
      finger lifts rather than continuously during the drag. A disclosed
      simplification, not a limitation of the interaction model - live reflow is
      buildable later if wanted.
    - **New overlay field `boxWidthPercent`** — width at scale 1, as a percentage of
      the frame, matching how `x`/`y` are already stored (resolution-independent,
      composes correctly with a later corner-handle pinch: `scale` multiplies both
      font size and box width the same way, so the two stay proportionally
      consistent). `undefined` by default - every existing overlay, and every overlay
      nobody has dragged, renders exactly as it did before this shipped.
    - **The export side needed real work, not just plumbing.** The existing
      `wrapTextLinesServer` wraps by a fixed word count (4/line), with zero knowledge
      of font, size or frame width - fine as an approximation for auto-captions, which
      never carry a box width, but would have silently disagreed with whatever the
      user actually dragged on screen for a manual overlay, the exact "ships clean,
      wrong on screen" shape this file's own history keeps warning about. New
      `wrapTextLinesByWidth()` measures real candidate-line widths with the same
      `labelWidth()` the highlight chip's word-boxing already uses, breaking only when
      the next word would push a line past the target; a single word wider than the
      target still gets its own line rather than splitting mid-word, matching what the
      app's own `Text` component does at that same edge. Wired in only when
      `boxWidthPercent` is present - every auto-caption and every un-resized overlay
      keeps the unchanged word-count wrap, zero behaviour change for them.

    Verified directly, not by reading: the wrap function against real ImageMagick
    across three target widths (every multi-word line measured at or under its
    target, the long-single-word edge case landing correctly on its own line), `expo
    export` clean, and `check-gesture-composition.py` clean (two new leaf
    `Gesture.Pan` instances - `.enabled()`/`.blocksExternalGesture()` only ever called
    on those, never on a composition).

    **First on-device pass found the handles unreliable** (commit `2b40d386`, update
    group `a934f15d-76b0-46c5-8aa5-69584f89d9b2`) - dragging either side handle moved
    the whole overlay instead of resizing it. Not `blocksExternalGesture` failing (the
    same mechanism the corner handle already relies on) but how much of each handle's
    hit box overlapped the element's own draggable area: the corner handle sits at an
    actual corner, offset in both x *and* y, so only a small sliver overlaps; a side
    handle offset in x only (vertically centred on the edge) had its hit box's whole
    *height* already inside the box's own bounds on a single-line overlay, and at the
    original `-HANDLE/2` offset half its *width* too - a much larger contested area for
    the same arbitration to get right, and evidently enough for the element's pan to
    win often. Fixed by pushing the hit box to sit almost entirely outside the box
    (`-HANDLE*0.9`, matching the corner handle's own near-zero overlap) and adding an
    explicit `hitSlop` to the gesture itself, so its actual catch area is meaningfully
    larger than its 8pt visible bar.

    **Second on-device pass found that fix real but incomplete** (commit `082d5a59`,
    update group `d2f6e472-23a7-4289-a50b-2f5f2b812ff2`) - narrowed down together with
    the user to a precise, reproducible split: works fine with no background on the
    overlay, still very hard to drag with one. The actual mechanism: a plain text
    overlay's own touchable area is sparse (just the glyphs), so a handle's hitSlop
    reaching a little way back toward the box barely competed with anything real. A
    background chip turns that same area into one solid, fully opaque `View` the main
    pan gesture hits reliably everywhere inside it - and the first fix's `hitSlop`
    (`{left:16,right:16,top:20,bottom:20}` on *both* handles) was extending 16-20px
    **inward**, directly handing part of the handle's own catch area to that now much
    more competitive surface. Two changes closed it: `hitSlop` is now asymmetric per
    handle and never grows inward (left handle `{left:20,right:0,...}`, right handle
    `{left:0,right:20,...}`), and the resting position moved from `-HANDLE*0.9` to
    `-HANDLE` (fully outside, zero base overlap, not just mostly). Between the two
    there is no hit-region overlap with the box's own content left at all, whether
    that content is bare text or an opaque chip. **Untested on device** past this fix.
17. **Firestore rules had no entry at all for `users/{userId}` — every account's plan/
    credits read and write had been silently failing since the rules were last deployed
    (Jun 19 2026).** Found Aug 11 2026 while checking a fresh signup's Firestore write
    for item 6 (country capture) - `users/{uid}` simply didn't exist after signup, with
    no error surfaced anywhere (the write is deliberately non-fatal, per item 6's own
    design, so a Firestore failure can't cost someone their verification email). The
    real cause was one level up: the deployed rules had `match` blocks for
    `scheduledPosts`, `connectedAccounts` and `userVideos`, but nothing for `users` at
    all - Firestore denies by default when no rule matches a path, so this was never a
    timing race (the risk item 6 flagged when it was built), it was a flat permission
    denial for every account, on every read and write, the entire time the credits
    feature has existed. This is also what the "—" on the Plan & Credits section earlier
    in this same testing session actually was - not a lazy-init delay, a rules bug.

    **Fixed by deploying the missing rule**, matching the exact pattern already proven
    safe for `connectedAccounts`:
    ```
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    ```
    No `firestore.rules` file exists in either repo - rules here are Console/Admin-SDK-
    managed only, so this is the only record of them outside Firebase itself; worth a
    real `firestore.rules` file + deploy tooling at some point, not done now.

    **Verified with real client-authenticated requests, not admin access and not just
    trusting the deploy**: minted a real ID token, confirmed a real REST write to
    `users/{uid}` returned 403 *before* the fix (proving the bug, not assuming it),
    deployed the corrected rules, confirmed the identical write returned 200 immediately
    after, and confirmed a *different* uid was still correctly denied (the fix isn't
    permissive beyond each user's own doc). A separate real GET request (same
    client-auth path `usePlan()`'s own `onSnapshot` listener uses) confirmed reads work
    too.

    **Backfilled the two accounts this bug had already caught**, since the app has no
    retroactive sweep and both were missing data an actual user would need:
    `mumberemike4@gmail.com` (today's fresh signup - now has `country: 'Uganda'`,
    confirmed with the user rather than guessed, plus the same free/5-credit/30-day
    defaults signup already writes) and `ahumuzamark21213@gmail.com` (the project's own
    main account, which predates the credits feature entirely and so was never seeded at
    signup - given the same free-tier defaults, `country` deliberately left unset since
    it was never asked for at that account's signup and there's no real value to write).
    Every other pre-existing account, if any, remains unbackfilled - would need a real
    migration sweep rather than a one-off script if that turns out to matter.
18. **Verification email is now genuinely Tonefy-branded** (Aug 11 2026, app commit
    `23a65afd`, published as update group `5a627f61-7fa0-445a-a211-a1527cf64dc3`, runtime
    1.1.0; backend `Tonefy-react@469216cc`, deployed via `pm2 restart`). Direct request
    after seeing the old email's raw unstyled link during item 6's signup test.

    **Editing Firebase's own template turned out not to work for this project.** Tried
    first, since it needed no new infrastructure: PATCHing
    `notification.sendEmail.verifyEmailTemplate.body` via the Identity Platform admin
    API (`identitytoolkit.googleapis.com/v2/projects/{id}/config`), authenticated with
    the existing service account via `google-auth-library`. Every attempt - a
    parent-object mask, a full leaf-level mask naming all five sub-fields, a body-only
    mask with a trivially small test value - returned HTTP 200, and every single time a
    **fresh, separate GET** (never trusting the write response) showed the body
    completely unchanged. Nothing was damaged in the process - the other templates
    (password reset, change-email, 2FA-added) were re-checked intact after every
    attempt. The likely cause, not fully confirmed: this project's `notification.
    sendEmail.method` is `CUSTOM_SMTP` (already routed through `ahumuzamark21213@
    gmail.com`'s Gmail SMTP, not Firebase's default mailer), and the template-body
    field may simply be inert once that's active - Console UI editing was not tried,
    since it does not gate signup on that test.

    **Fixed by bypassing Firebase's template system entirely.** New backend endpoint
    `POST /api/send-verification-email` (`~/Tonefy-react/backend/server.js`) generates
    the real link via `generateEmailVerificationLink()` and sends a genuinely branded
    HTML email (Tonefy AI header, a real green `#2ECC71` "Verify Email" button, not a
    raw link) through **the same Gmail SMTP account already configured for this
    project**, via `nodemailer` with a new Gmail App Password
    (`EMAIL_USER`/`EMAIL_APP_PASSWORD` in `~/Tonefy-react/backend/.env`, gitignored,
    confirmed before committing). uid/email are read from the verified token
    (`req.user`, via `getAuth().getUser()`), never the request body - the same lesson
    the `media-to-video`/`edit-video` `userId` bug already taught this file (item 13):
    a client-supplied email here would let anyone request a verification link for an
    address that isn't theirs. `AuthScreen.js` calls this new endpoint in place of the
    direct `sendEmailVerification()` call, and **falls back to Firebase's own default**
    if the backend call fails for any reason - a plainer email beats no email at all.

    **Verified for real, twice, not by reading**: a live test send to a real inbox,
    visually confirmed by the user as correctly branded and rendering properly; then a
    full run of the app's *actual* signup sequence from Node against the live backend -
    create user, update profile, the Firestore write (confirming item 17's rules fix in
    the real flow, not just in isolation), this new endpoint, a doc readback - all
    succeeding together. Test account and its Firestore doc fully removed via Admin SDK
    afterward (the client-side delete attempt correctly failed with permission-denied,
    since it ran after signing out - confirming the rules are doing their job, not a
    bug). **Password-reset and change-email templates were left exactly as Firebase's
    defaults** - only the signup-blocking verification email was in scope; the same
    branding treatment could extend to those later using the same pattern.
19. **Every popup in the app is now Tonefy-branded** (Aug 11 2026, commit `d8570d98`,
    published as update group `17363fc2-4e7a-4497-8e27-8732c80cf56a`, runtime 1.1.0).
    Direct request following the verification-email work above. Native `Alert.alert`
    renders the OS's own dialog - nothing in RN can style it - so every popup in the
    app had looked like stock Android regardless of how the rest of the screen was
    themed.

    **`components/BrandedAlert.js`** is a drop-in replacement: identical signature
    (`title, message, buttons, options`), identical `{text, style, onPress}` button
    shape, so every call site converts with a literal token swap
    (`Alert.alert(` → `showAlert(`) rather than a rewrite. Renders the same bottom-sheet
    chrome every other modal in the app already uses - `#111` sheet, rounded top
    corners only, green `#2ECC71` for the default/commit button (matching the
    established brand rule - see "Design/brand note" above), red-bordered destructive,
    neutral cancel. Imperative by design, like the thing it replaces: a module-level
    ref to the mounted host's own `setState`, set once by `<BrandedAlertHost />` in
    `App.js` (inside `GestureHandlerRootView`, alongside `NavigationContainer`, so it
    survives every screen) rather than each of ~114 call sites needing its own modal
    state.

    **All 114 real `Alert.alert(...)` calls across 10 screens converted mechanically**
    (`ConnectAccountsScreen`, `UrlToVideoScreen`, `AuthScreen`, `CalendarScreen`,
    `EditVideoScreen`, `EditPostVideoScreen`, `ProfileScreen`, `IdeaToVideoScreen`,
    `NotificationsScreen`, `ScriptToVideoScreen`) - a scripted replace verified 1:1 by
    count per file (before-count of `Alert.alert(` matched after-count of `showAlert(`
    for every file, not just eyeballed), plus the matching import added to each. The
    `.bak_*` recovery snapshots were correctly left alone - grepped and confirmed not
    part of the live build. Every button pattern already in use (single-button info,
    cancel/destructive pairs, 3-button) maps onto the new component with no call-site
    rewrite beyond the token swap, confirmed by spot-checking a converted
    destructive-delete call site to make sure its button array survived intact.

    Verified: `expo export` clean, `scratchpad/jsxrefs.py` clean (the new
    `BrandedAlertHost` tag resolves). **Untested on device.**
20. **Export ANR on projects with many overlays — fixed** (Aug 11 2026, commit
    `22dae4d0`, update group `89dcde4c-c720-4387-98e1-b01f61b94744`, runtime 1.1.0).
    Reported from a device test: export looked stuck at 60% ("Adding text &
    overlays..."), then Android showed "Tonefy AI isn't responding." Checked the
    backend's own `jobs.json` directly rather than trusting the symptom - the job had
    actually finished (`status:"done", progress:100`) several minutes after the app's
    poll log showed its last request. The server was never the problem.

    **Root cause: the text-overlay render loop had no memoization at all**, unlike
    `mediaOverlayViews` right above it, which already solved this exact problem with
    `useMemo`. Every unrelated re-render - an export progress tick from `pollJob`'s
    `setProgress`/`setMessage`, firing every 2s and having nothing to do with overlay
    content - rebuilt every `CanvasOverlay` from scratch for every overlay in the
    project, each one constructing seven `Gesture.Pan` objects (five pre-existing, two
    added by item 16's box-width resize). On a project with enough overlays
    accumulated - this session's test project had several, including one long
    paragraph duplicated across multiple clips - that per-tick cost was apparently
    enough to eventually freeze the JS thread. Since `pollJob`'s own `setInterval` runs
    on that same thread, the freeze stopped its own timer from firing too, which is
    what turned a slow export into an apparently-stuck one and triggered the ANR.

    Fixed by wrapping the render in `useMemo`, matching `mediaOverlayViews`' existing
    pattern exactly (new `textOverlayViews`). `position` stays a real dependency -
    auto-captions gate on it and a highlight style's active word depends on it - so it
    still recomputes correctly during playback; only state this list has nothing to do
    with (export progress, poll messages) no longer forces a recompute. One correctness
    fix needed alongside it: `onChangeText` was an inline per-render closure over each
    overlay's key, which would have defeated the memo for every overlay on every
    render - replaced with the stable `setOverlayText(key, text)` callback itself, with
    `TextOverlayContent`'s caret `TextInput` now supplying `overlay.key` at the call
    site instead of the parent closing over it.

    Verified: `expo export` clean, `scratchpad/jsxrefs.py` clean. **Untested on
    device** - the mechanism fits every symptom reported, but not yet confirmed closed.
21. **Text overlays hidden on canvas during an active transition blend** (Aug 11 2026,
    commit `00c93e1d`, update group `c7c1c95b-944e-4b95-b34d-89e93bc34fba`, runtime
    1.1.0). Same device-test session as item 20 - text/captions looked visually wrong
    ("squeeze tall") while a transition was blending. Direct request rather than a
    root-cause chase: a caption or manual overlay has no transition of its own, so it
    was sitting flat on top of a clip that's moving/masked/scaled underneath it - not
    shown for that span is the simplest correct behaviour.

    Gated on `joinLayers.active` specifically, not `activeJoin` - the latter is true
    for the whole 1.5s lookahead window the incoming clip pre-mounts during
    (deliberately invisible prep, not yet blending, see the comment above `activeJoin`
    itself), while `.active` is only the actual 0.3s the two clips are visibly
    crossing. Gating on the longer window would have made text disappear noticeably
    before anything was happening on screen. **Preview-only** - the export's own
    transition rendering (ffmpeg `xfade`) is a separate mechanism from this RN-side
    approximation and was not in scope of what was reported. **Untested on device.**
22. **"Stuck at 60%" was real the second time, not the same bug as item 20** (Aug 11
    2026, `~/Tonefy-react/backend@38549dfc`, deployed via `pm2 restart`). After item 20
    shipped, a fresh export attempt still reported the same symptom. Checked
    `jobs.json` directly rather than assuming the fix hadn't landed: this time the job
    itself genuinely showed `status:"pending", progress:60` for **over six minutes**,
    re-checked later and confirmed it had eventually reached `status:"done"` - a real,
    multi-minute stretch of the export doing something with zero progress reported,
    not the client losing track of an already-finished job like item 20 was.

    **The gap**: `/api/media-to-video`'s own progress markers jump straight from 60%
    ("Adding text & overlays...") to 80% ("Mixing audio...") with nothing reported in
    between, regardless of how many overlays there are or how long the mask/alpha/
    fill/composite chain (several `convert` shell-outs per overlay) takes for each one.
    A project with several overlays - especially a long one, which pays per-word for
    `wrapTextLinesByWidth`'s real measurement when `boxWidthPercent` is set (item 16) -
    could sit on that one frozen message for minutes with no visible sign anything was
    happening.

    **Fixed by reporting progress after every overlay finishes**, scaled across the
    same 60-80% band the two existing markers already bracket, with a running count in
    the message (`"Adding text & overlays... (3/7)"`). Does not make the loop faster -
    the underlying per-overlay cost is unchanged - only makes the number the client
    polls actually move instead of sitting frozen for the whole span, which is what
    read as hung. Whether `wrapTextLinesByWidth`'s per-word cost is itself worth
    optimizing (e.g. a smarter search instead of linear word-by-word measurement) is a
    real open question this did not attempt to answer - flagged, not fixed, since
    changing that measurement's actual algorithm risks a correctness regression under
    time pressure and the progress-reporting fix already addresses the reported
    symptom. **Untested on device** past a real completed job confirmed via `jobs.json`.
23. **The real cause of item 22's slowness: 391 overlays, rendered fully sequentially**
    (Aug 11 2026, `~/Tonefy-react/backend@9f2e9ca9`, deployed via `pm2 restart` once
    confirmed no render was in-flight). The count came straight from the device's own
    progress message once item 22 made it visible (`"Adding text & overlays...
    (353/391)"`) - a highlight-style caption sends one overlay per spoken word (the
    phrase stays on screen, only which word is chipped changes - see "Type on the
    canvas" above), so a normal-length voiceover means hundreds of these, each paying
    several real `convert` process-spawns on top of its own image work, fully
    sequentially.

    **New `mapWithConcurrency`** runs 4 at a time instead of one, overlapping that
    spawn overhead. Kept modest rather than higher - this VPS runs other pm2 processes
    too, and a mask/alpha/fill/composite chain is real CPU work (dilate, blur), not I/O
    wait that more workers would help hide.

    **Naively parallelizing would have undercut `phraseLayerCache` itself** - that
    cache only writes the shared shadow/glow/stroke layers back once a word finishes
    (the single most expensive call in the whole caption path, 380ms, identical for
    every word of a phrase per its own comment), so two words of the *same* phrase
    running at once would both miss the cache and both pay that cost redundantly - not
    wrong output, but exactly the wasted work that cache exists to avoid, potentially
    offsetting whatever concurrency gained. Fixed by grouping `textOverlays` by
    `(text, font, size, captionSpec)` before anything runs - every word of one phrase
    carries the identical tuple - so each phrase's own words stay together and run
    sequentially (the cache still helps exactly as before), while different
    phrases/overlays run concurrently with each other.

    Verified: `node -c` clean, and the grouping logic checked in isolation against a
    realistic three-phrase input (one 3-word and one 2-word highlight-style phrase,
    plus an ordinary singleton overlay) - correctly formed three groups with each
    phrase's words kept together in original `activeWord` order. The per-overlay
    rendering logic itself is completely unchanged, only the outer iteration structure.
    **Not independently verified end-to-end against a real 391-overlay render or
    compared byte-for-byte against the old sequential output** - deployed given the
    user was actively waiting and the reasoning is solid, but this is the piece most
    worth double-checking (word timing, which word is highlighted, chip position) on
    the next real export if anything looks even slightly different.
24. **Overlay render concurrency tuned from 4 to 6, measured not guessed**
    (`~/Tonefy-react/backend@cb8fc8b1`). Direct request - "make it faster, check before
    implementing" - after item 23's fix confirmed working. Benchmarked the actual
    mask/alpha/dilate/composite chain this loop runs (the real four `convert` calls,
    not a synthetic stand-in) at concurrency 1/4/6/8/12, live, with this VPS's other
    pm2 processes already running: 208/41/29/36/29 ms/overlay. 6 - this box's real
    core count, confirmed via `nproc`, not assumed - beat the previous setting of 4 by
    ~30%; 8 was worse than 6 (contention past the real core count, exactly as expected
    for CPU-bound work); 12 matched 6 with no further gain. 6 is the measured ceiling
    for this specific hardware, not a round number picked by feel - revisit if this
    VPS's core count or its other workload changes.

    Checked the rest of the export pipeline for the same class of opportunity before
    stopping: the clip-combining/transition stage builds one ffmpeg `filter_complex`
    graph and runs it as a single process, not a loop of shell-outs, so there is
    nothing to parallelize there the same way - its speed is bounded by ffmpeg's own
    internal threading. The one per-clip loop there (duration probing) is unlikely to
    matter in practice, since real projects have a handful of clips, not the hundreds a
    highlight-caption's one-overlay-per-word count reaches.

    **A bigger, unexplored option**: this benchmark's own sequential number (208ms for
    an operation ImageMagick itself completes in a few ms) says most of that cost is
    process-spawn overhead, not image work - `convert` is invoked as a fresh OS process
    per call, four times per overlay. A persistent-worker or native-binding approach
    (avoiding the spawn entirely) could plausibly beat even concurrency=6 by a wide
    margin, but is a real architecture change - a new dependency or a long-lived
    ImageMagick process to manage - not attempted here. Worth a dedicated look if
    export speed is still a priority after this.
25. **`readJson()` threw before its own callers' 402/403 branches could ever run -
    every rejection showed a raw JSON dump instead of the branded upgrade prompt**
    (app commit `61d552eb`, published as update group
    `6e711407-fe92-490b-afe0-494daa0225aa`, runtime 1.1.0; backend wording change
    `Tonefy-react@c2e95557`). Reported from a device screenshot: the credit-limit
    rejection showed `Server error (402). {"error":"No credits remaining..."}` inside a
    plain "Error" alert, not `promptUpgrade`'s branded sheet - a feature this app
    already has, that never fired.

    **The actual bug**: `readJson()` threw immediately on any non-ok response, but
    nearly every one of its ~13 call sites in `EditVideoScreen.js` was written
    expecting it to *return* the parsed body instead - `const data = await
    readJson(res); if (data.error) throw new Error(data.error)` is the dominant
    pattern in this file, and the three call sites with explicit 402/403 handling for
    `promptUpgrade` follow the identical shape. Since `readJson` threw before any of
    those lines ever ran, every one of those branches was dead code - every
    rejection, credit-limit included, fell through to the generic catch block showing
    whatever `readJson`'s own raw-text fallback produced. That fallback is what put
    unparsed JSON on screen.

    **Fixed at the source** rather than patching each call site: a non-ok response now
    returns its parsed JSON body (matching what almost every caller already assumed)
    as long as the body is real JSON - only a response with nothing parseable at all
    (an nginx error page, a timeout) still throws a translated message, since there is
    nothing structured to hand back in that case. Verified against a real 402 from the
    live backend, not by reading: minted a token for a 0-credit test account, hit
    `/api/media-to-video` for real, confirmed `readJson` now returns `{jobId:
    undefined, error: "..."}` instead of throwing - exactly the shape the export
    flow's `if (!jobId) { promptUpgrade(...) }` needs to finally run.

    **Also softened the wording** of all five plan-limit rejections while in there (a
    second, separate part of the same request) - credits exhausted, export-too-long
    (x2, the sync check and the async-job-failure check), voice/caption-style locked
    (x2) - to read as an explanation rather than a command: "You've used all your
    credits... they'll refresh automatically" instead of "No credits remaining...
    Upgrade or wait", "is available on the Pro and Creator plans" instead of "needs a
    Pro or Creator plan". No change to when these fire or their status codes.
    **Untested on device.**
26. **"This cycle" replaced with the actual reset date** (`~/Tonefy-react/backend@
    4fa04238`). Direct follow-up question - "cycle" didn't say whether that meant
    daily, weekly or monthly. Checked against the code rather than assumed:
    `FREE_RESET_MS` is a rolling **30 days** from whenever an account's credits were
    last set, not a calendar month - so "monthly" would have been a real, and
    inaccurate, claim. `checkRenderAllowed` already had `creditsResetAt` sitting on
    the same account record it was already reading `plan`/`creditsRemaining` from -
    just never destructured it. Now formats it directly into the message ("They
    refresh every 30 days - yours reset on August 23") instead of making someone open
    Profile to find out when "later" actually is, with a plain "every 30 days"
    fallback for the should-be-impossible case where the field is missing. Verified
    against a real 402 from the live backend with a test account 12 days from reset.
    Backend-only, already live - no app update needed.
27. **Video/audio/uploads/music static routes had no cache headers at all** -
    `~/Tonefy-react/backend@3e28e8d2`. Reported symptom: restoring a saved draft (and,
    separately, adding a music track or voiceover) took a very long time. Checked
    before touching anything, per direct instruction: `/videos` and `/audios`'
    `express.static` config had no `maxAge` set, unlike `/stickers`/`/filters`/
    `/transitions` a few lines below, which already had `maxAge: "30d"`. `/music` and
    `/uploads` were missing it too - four of the routes this app depends on most were
    the ones with no caching at all.

    Every filename under these routes is unique per render or upload (`uniqueName()`
    bakes in a timestamp and a UUID) - a URL's content can never change under this
    app, exactly the "safe to cache forever" case the sticker/filter/transition routes
    already covered. Without `Cache-Control`, the device had no reason to believe a
    repeat request for the same clip or voiceover could be served from its own cache -
    restoring a draft, reopening the editor, even re-selecting a track already played
    once this session, was a full re-download from zero every time.

    Verified against a real request, not by reading: `curl` against `/music` before
    was missing `Cache-Control` entirely; after, it sends `public, max-age=2592000` -
    byte-identical in shape to `/stickers`' own header, confirming the same
    `express.static` mechanism applies correctly. **Known limit of this fix, stated
    plainly**: it helps *repeat* loads of a file already fetched this device has ever
    fetched before within the 30-day window - the very first download of any file is
    unchanged, still a full fetch. Also unverified: whether `expo-av`'s audio playback
    layer (as opposed to plain `fetch`/`Image` requests, more standard territory)
    actually honours this header on-device - a real, not just a plausible, remaining
    question, since native media player HTTP caching behaviour varies by platform and
    wasn't checked directly. Backend-only, already live.

28. **Google Sign-In was broken by a Play App Signing key rotation, not by any app
    code** (Aug 15 2026, app commits `a0c2bbb0`, `52470e62`; nothing rebuilt, nothing
    published - the whole fix was server side at Google). This had survived a full
    prior session of troubleshooting that verified the right things and still missed
    it, so the reasoning is worth keeping in full.

    **Symptom history, which is itself the clue.** First `signIn()` returned
    `{"type":"cancelled","data":null}` *after* the account picker had appeared and an
    account had been chosen ("Checking info…", then silence). Later the same build,
    untouched, started throwing `DEVELOPER_ERROR` instead. Both are the same
    underlying rejection: with the legacy `GoogleSignInClient`, an app whose
    certificate resolves to no OAuth client is refused, and whether that surfaces as
    12501 `SIGN_IN_CANCELLED` or status 10 `DEVELOPER_ERROR` is not stable enough to
    diagnose from. **A "cancelled" that the user did not cause is a config rejection**,
    not a UI event - that is the reading that was missed the first time round.

    **Root cause: the app signing key had been rotated on 11 Aug 2026, 19:45**, visible
    in Play Console → Test and release → Setup → App integrity → App signing as a
    "Previous app signing keys" row. Only the *current* key's fingerprint
    (`441012e0…`) had ever been registered on the Firebase Android app. The
    pre-rotation key, `afdd7e07…`, was registered nowhere - and the install on the test
    device dated from around the rotation, so it still presented the old certificate.
    Google's own guidance for Play App Signing key rotation is to register **both** the
    old and the new fingerprint with every API provider: Play services APIs resolve app
    identity through the rotation lineage rather than simply switching to the newest
    key. Fixed by registering `afdd7e07…` via the Firebase Management API
    (`projects.androidApps.sha.create`); Google auto-created a third `client_type=1`
    OAuth client for it, confirmed by re-pulling the config. **Confirmed working on
    device immediately after, with no rebuild and no `eas update`.**

    **Why the earlier session's checks all passed and still missed it.** Every
    individual thing it verified was true: both SHA-1s "registered in Firebase" (they
    were - just not *all* the relevant ones), webClientId matching, OAuth consent
    screen in production, Credential Manager ruled out. The gap was that "both SHA-1s"
    meant *upload key + current app signing key* - the two a normal project has. A
    rotated key means there are **three**, and nothing about the Firebase Console
    prompts you to notice a fourth is possible. The device-state theory that session
    landed on (Google anti-abuse restricting a churned device) was wrong, and it is
    worth noting how plausible it looked: it explained the symptom, required no further
    checking, and would have kept looking right forever.

    **The check that would have found it in one step**, for next time: read the App
    signing page for *how many* certificates exist, not for whether one number matches.
    A rotated key shows a "Previous app signing keys" table; a Quantum-ready-beta
    enrolment shows a second "Post-quantum cryptography key" fingerprint alongside the
    Classical one. Both are extra certificates the app can present and both need
    registering. **The post-quantum fingerprint is still unregistered** - it was queued
    as the next thing to try and turned out not to be needed. If sign-in ever regresses
    on a fresh install, that is the first thing to add.

    **Also fixed along the way:** the committed `android/app/google-services.json` was
    stale - it carried only the upload key's OAuth client, missing the current app
    signing key's. Refreshed from `projects.androidApps.getConfig`. Worth being precise
    about what this did and did not do: **that file is not read at runtime for this
    flow** (Play services validates package + certificate against Google's servers, not
    against the file), so refreshing it fixed nothing on device - it was fixed because
    it was wrong. This is also why the whole repair needed no new build. Note the file
    would have gone stale again on any future SHA change, since this project's
    committed `android/` folder means nothing regenerates it automatically.

    **Play Billing: the purchase failure is Google's, not ours - stop testing it.**
    `requestSubscription()` returning "That item is unavailable" (`ITEM_UNAVAILABLE`,
    Billing response code 4, from `launchBillingFlow`) was traced to the **payments
    profile still being under review**. Play cannot process a subscription purchase
    until the merchant account is active, and this is how that surfaces. Everything
    else was verified correct against the Play Developer API rather than the Console:
    both products Active, all four base plans Active with
    `newSubscriberAvailability: true`, Uganda in the region list at the exact prices the
    device displayed ($8.25 / $17.69 - which also **rules out propagation delay**, the
    previous session's leading theory, since prices only render if `getSubscriptions`
    found the products), versionCode 8 `completed` on the alpha track, and product /
    base-plan ids matching `SubscriptionScreen.js` and `planFromBasePlanId` exactly. The
    app-side and native purchase path was read end to end and is correct. Retest when
    the bank verification clears; nothing to change before then.

    **The Google Play Android Developer API was disabled in the Cloud project**
    (`527163602306`) and was enabled during this session. This is not cosmetic:
    `/api/verify-purchase` calls `purchases.subscriptionsv2.get`, so **every purchase
    verification would have failed** with the generic "Could not verify this purchase",
    granting nothing after a real payment. It had never been exercised because no
    purchase had ever completed. The service account could not enable it itself
    (`serviceusage.services.enable` denied) - this needs a project owner in the Console.

    **`~/Tonefy-react` was tracking 7,034 files under `backend/node_modules`**
    (`5571116f`). `node_modules/` had been in `.gitignore` all along, but gitignore has
    no effect on files git already tracks. The concrete risk, not a theoretical one:
    the previous session's `npm audit fix` showed up as hundreds of modified files
    indistinguishable from real work, and a `git checkout`/`git stash` there would have
    silently reverted the security fix to the vulnerable versions. Untracked with
    `--cached` (working tree and the running pm2 process untouched), along with six
    rendered test videos; `server.js.bak_*` snapshots now ignored.

    **Still open from this session:** the temporary raw-response diagnostic in
    `handleGoogleSignIn` (`57d29b2f`) is still shipped and can now be removed, since the
    thing it was added to diagnose is understood. The security fixes committed last
    session (`utils/secureAuthPersistence.js`, password strength) still need a native
    build to reach a device - `expo-secure-store` is a native module. The 12-tester /
    14-day production-eligibility window still has not been started, and now only waits
    on the purchase flow, which waits on Google.


29. **Upgrade Plan grey-screened; an ErrorBoundary now makes a render throw say what it
    hit** (Aug 15 2026, commits `180425ff`, `980cdb22`, `07a3691a`). Three separate
    things, in the order they were found, because the order is the lesson.

    **`components/ErrorBoundary.js` is the durable part.** A render-time throw unmounts
    the tree and leaves the bare window background - the grey screen this project has
    now hit four times (`75198f47` gesture composition, `bf87b82e` useDragTracker,
    a deleted component's surviving call site, and this). Every one passed
    `expo export`, `node --check` and lint; every one cost a round trip to a device
    just to learn the *name* of what failed. It prevents none of them. It only makes
    the tree report the error and its component stack instead of vanishing. Wrapped
    around `Stack.Navigator` from inside `NavigationContainer`, so `navigationRef` and
    `BrandedAlertHost` survive and "Try again" re-renders the navigator rather than the
    app. **Kept permanently, not as a temporary diagnostic** - the failures it covers
    are reachable only on a device, so the moment it pays off is always in someone's
    hands and never in front of a build check. It paid off on first use: the answer
    came back as `E_IAP_NOT_AVAILABLE at SubscriptionScreen` on the very next launch,
    after static inspection (route registered, every theme token present, jsxrefs
    clean, `usePlan()` guarded on every path) had already been exhausted.

    **The crash: `purchaseUpdatedListener`/`purchaseErrorListener` are not passive.**
    Each constructs a `NativeEventEmitter` over the IAP native module, so each calls
    `checkNativeAndroidAvailable()` and throws synchronously when the module is absent
    (`react-native-iap/src/internal/platform.ts:23`). Both sat *outside* the try/catch
    already wrapping `initConnection`/`getSubscriptions` - whose own comment says the
    intent was to fall back to the hardcoded prices. The listeners defeated that
    intent, and a throw in an unwrapped effect unmounts the tree. `endConnection()` in
    the cleanup reaches the same module and needed the same wrapping. The screen now
    degrades: fallback prices, an explicit notice, and Subscribe reporting why. Worth
    keeping as a shape, not just a fix - **an `await x()` inside a try tells you
    nothing about the un-awaited call two lines below it**.

    **The mistake I made in the middle of this, which cost a publish cycle.**
    `180425ff` was published to `production` while carrying `cefa6fed`, which had added
    `expo-secure-store` *after* versionCode 8 was built. That module's JS calls
    `requireNativeModule('ExpoSecureStore')` at import time and reads constants off the
    result, so `import * as SecureStore` throws while the file is being evaluated -
    and `firebase.js` imports it, and every screen imports `firebase.js`. That is not a
    degraded feature, it is the app failing to launch. **CLAUDE.md already stated this
    rule** under "Working conventions to keep"; it was published straight past without
    checking. Fixed in `980cdb22` by requiring it lazily inside a `try` with a guard at
    each of the three call sites, matching `utils/notifications.js`. Two things worth
    carrying forward: it never reached the device (which is *also* why the ErrorBoundary
    in that same update did not appear, and the user's "still grey" report was the old
    bundle - a stale-bundle reading that could easily have been mistaken for the fix not
    working); and `removeItem`'s existing `.catch(() => {})` was not protection, since a
    missing method throws synchronously when called and a catch on the returned promise
    never sees it. **Before any `eas update`, diff `package.json` against the commit the
    installed build was cut from.** One line, and it would have caught this.

    **Resolved: Play served the internal-testing build, not the closed-testing one.**
    Google Play ranks tracks - **internal > closed > open > production** - and serves a
    tester the build from the highest-priority track they are opted into, regardless of
    which link they installed from or how much newer another track is. This account was
    on both, so every install had been quietly getting `internal`, which still held
    **versionCode 2** from long before the subscription work existed, while `alpha`
    moved from 6 to 8. The Play Store listing says so plainly once you know to look -
    "Tonefy AI (Internal Early Access)". Fixed by promoting versionCode 9 to **both**
    tracks; confirmed on device, with the notice gone and all four prices matching what
    the Play Developer API reports for Uganda exactly ($8.25/$17.69 monthly,
    $82.59/$176.99 yearly). **Keep the tracks in step from now on** - releasing to
    closed testing alone does not reach a tester who is also an internal tester, and it
    fails silently, looking exactly like an app bug rather than a distribution one.

    The evidence that had looked contradictory resolves cleanly under this: the same
    device really did show live converted prices in an earlier session, on a build
    installed directly from EAS rather than through Play. Everything else followed -
    Google Sign-In worked because those native modules are old and present, the
    subscription screen appeared because it is JS delivered over the air, and Play
    Billing was absent because it was never compiled into versionCode 2.

    **How it was chased, since the same trap is easy to fall into again.** The notice reports `Installed 1.0.0 (build ?)` with the
    fallback prices `$6.99`/`$14.99` showing, so the module is genuinely absent rather
    than misbehaving. Ruled out rather than assumed: `react-native-iap` is unchanged at
    12.16.4 across every commit since the session where this same device *did* show real
    converted Play prices ($8.25/$17.69, matching the Play Developer API for Uganda);
    the APK published on the website has no billing classes at all but is on the
    `preview` channel and so cannot take a `production` update; and both finished
    production builds (versionCode 6 from `b42353e4`, versionCode 8 from `040879c0`)
    post-date the react-native-iap commit, so both contain it. Build 8 certainly does -
    `missingDimensionStrategy "store", "play"` was only *needed* because Gradle was
    linking the module, and the Kotlin patch only mattered because it was being
    compiled. The leading explanation is versionCode 2, still sitting on the internal
    testing track, which predates the subscription work entirely - which is what it
    turned out to be. `Constants.nativeBuildVersion` came back undefined and did not
    identify the binary; the reliable device-side reads are Settings -> Apps -> Tonefy
    AI, and the Play Store listing's own title.

    **The one query that would have found it immediately** is the track listing, which
    names the installed-build problem in two lines and needs no device:

    ```
    alpha:    versionCodes=["9"] completed
    internal: versionCodes=["2"] completed   <- what the phone was actually being served
    ```

    Reachable via `edits.insert` -> `edits.tracks.list` -> `edits.delete` on the
    Play Developer API. Worth running whenever a device's behaviour disagrees with what
    was built, before anything else is suspected.

    **Build 9 was cut at `07a3691a`** to settle this and to carry the
    two fixes that cannot ship over the air (`utils/secureAuthPersistence.js`,
    password strength). `eas.json` has `appVersionSource: remote` with `autoIncrement`
    on the production profile, so the versionCode is assigned by EAS rather than by
    `android/app/build.gradle` - which still reads `versionCode 1` and is not the
    number that ships. `runtimeVersion` stays 1.1.0, so every update already published
    applies to it. Verified inside the artifact rather than trusting the green tick -
    the AAB's dex carries 33 `RNIapModule` references plus `PendingPurchasesParams` and
    `QueryProductDetailsResult` (so the Billing 8.0.0 patch really did apply on EAS's
    machine, which is the part `patch-package` could silently skip) and
    `com.android.vending.BILLING` is in the manifest.

    **`eas submit` could not be used** - it wants a Google service account key set up
    interactively and refuses in `--non-interactive`. Uploaded straight through the
    Play Developer API instead (`edits.bundles.upload` -> `edits.tracks.update` ->
    `edits.commit`), which the existing Firebase service account already had permission
    for, so no new credential was needed.


30. **A real Play Billing purchase completed end to end — Pro granted, credits set,
    purchase acknowledged** (Aug 15 2026; app `82518c5b`, `3e008f1c`; build 9 =
    versionCode 9 from `07a3691a`, on both Play tracks). This is the first time the
    subscription chain has ever run: `/api/verify-purchase` had **zero** entries in the
    backend log before tonight, so every part of it downstream of Play was unproven
    code. Confirmed on device and in Firestore, not inferred: `plan=pro`,
    `creditsRemaining=60`, `subscriptionProductId=tonefy_pro_monthly`,
    `processedPurchases=1`, with the app showing "You're upgraded!", the Pro card
    switching to "Current Plan", and ProfileScreen moving to **Pro Plan / 60 of 60** with
    no restart - which is `usePlan()`'s `onSnapshot` listener working as designed.

    **The payments profile was never the blocker, and saying it was, was a mistake.**
    Google's test sheet ("Test card, always approves", `US$8.25/5 min` - test
    subscriptions renew every 5 minutes rather than monthly) processed fine with bank
    verification still under review. The earlier `ITEM_UNAVAILABLE` had a second
    candidate explanation all along - Play Billing refuses to sell to an app the Play
    Store did not install, and that earlier attempt ran on a build installed straight
    from EAS. The reasoning that picked the wrong one is worth naming because it
    appeared **twice in one session**: *everything else checks out, therefore it must be
    X*. Both times "everything else" had not actually been checked - the binary was
    wrong (item 29) and the install path was wrong here. An elimination argument is only
    as good as the enumeration behind it.

    **The bug this exposed is the one that would have cost real money.**
    `purchaseUpdatedListener` is registered in `SubscriptionScreen`'s effect and removed
    on unmount, alongside `endConnection()`. Play delivers a purchase asynchronously,
    after its own "require authentication for purchases?" prompt - by which point the
    sheet was dismissed and the user was on Profile. The screen had unmounted, nothing
    was listening, and the backend was never called. **Nothing picked it up afterwards
    either**, because no code path ever asked Play what the account already owns.

    That second half is the serious one: an unverified purchase is also an
    **unacknowledged** purchase, and Google auto-refunds those after three days. A real
    customer would pay, receive nothing, and be silently refunded, with no error
    anywhere for anyone to notice. **A listener alone cannot close this** - it only fires
    while one particular screen happens to be mounted.

    Fixed in `82518c5b`: `getAvailablePurchases()` now runs once after
    `initConnection()`, and anything still unacknowledged is verified. Silent on that
    path, since on the ordinary route the listener has already handled it and the pass
    finds nothing. Verification is one `useCallback` shared by both routes, so the
    ordering that matters - **acknowledge only after the backend has recorded the
    grant**, never before - cannot drift between them. Deliberately not moved to an
    app-level listener: the restore pass covers that case *and* one an app-level
    listener still would not, a purchase landing while the app is not running.

    **`3e008f1c` is a follow-up to a defect introduced by the fix itself.** `82518c5b`
    listed `verifyPurchase` in the setup effect's dependencies, so a change in its
    identity re-ran the whole effect - repeating `initConnection`, both listener
    registrations and the restore pass. The grant log shows the result: **four parallel
    POSTs for one purchase token within 55ms**. Held in a ref instead, effect back to
    empty deps.

    **Which incidentally gave the replay protection its first real test, and it held.**
    The atomic `.create()` claim on `users/{uid}/processedPurchases/{sha256(token)}`
    (`Tonefy-react@d7881a63`) had never been exercised. Four genuinely *concurrent*
    claims on one token is a sharper case than the sequential retry it was written for:
    one `processedPurchases` doc, `creditsRemaining` exactly 60 rather than 240.

    **A renewal was then observed for the first time** (order
    `GPA.3399-...-22190..2`, ~30 min after the purchase, on the 5-minute test cycle) and
    it changed **nothing** in Firestore: still `plan=pro`, `credits=60`,
    `processedPurchases=1`. That is correct rather than broken, and worth understanding
    before anyone "fixes" it - Play keeps the **same purchase token across renewals**, so
    the sha256-keyed claim refuses to grant twice by design, and credits are refreshed by
    the backend's own 30-day sweep instead (item 13). It works for a monthly plan,
    approximately, and it means a renewal top-up is not a thing that exists.

    **`1ece3bab` fixes a Sentry unhandled rejection - and it is my own earlier fix being
    wrong about what it covered.** `E_NOT_PREPARED` / "Unable to auto-initialize
    connection", `mechanism: onunhandledrejection`, on build 9 minutes after the grant.
    `07a3691a` had wrapped `endConnection()` in a try/catch with a comment claiming it
    "reaches the same native module and throws the same way". It does not. **Two
    failures, two shapes:** a synchronous throw when the native module is absent
    entirely, and a *rejected* `Promise<boolean>` when the billing client is merely
    already gone - the ordinary state on unmount. A try/catch around the call sees the
    first and never the second. The bare call it replaced had the same hole; what the
    try/catch added was the *appearance* of being handled, which is why it shipped.
    Generalise this: **wrapping a promise-returning call in try/catch does not catch its
    rejection**, and a comment asserting it does is worse than no guard at all.

    **Still not built:** subscription-lapse handling and Real-time Developer
    Notifications. Nothing observes a cancellation or expiry, so a lapsed subscriber
    stays on Pro indefinitely. The test subscription's 5-minute cycle makes this
    unusually cheap to observe on a real account - cancel in Play and watch - and that is
    the one part of this system nobody has ever seen behave.


31. **Rate limiting audit — every limit had been one shared bucket for all users at
    once** (Aug 16 2026, `~/Tonefy-react/backend@983748b6`, deployed via `pm2 restart`,
    process start 08:20:08 postdating the 08:18:44 edit).

    **The core defect.** nginx in front of this app sets `X-Real-IP` and **never**
    `X-Forwarded-For`: `/etc/nginx/sites-available/api.fitlifesolutions.site` sets its
    headers inline and does not `include proxy_params;`, unlike mission-control, pages
    and webhook on the same box, which do. Express derives `req.ip` from
    `X-Forwarded-For`, so with `app.set("trust proxy", 1)` on and that header absent,
    **`req.ip` was `127.0.0.1` for every request this server has ever received.** All
    four limiters were therefore a single global counter - 500 requests / 15 min for the
    entire world, 20 video generations / hour across all accounts - and any one caller
    could lock out everybody else. `validate: { xForwardedForHeader: false }` was
    silencing the check that warns about precisely this.

    Fixed app-side with a shared `keyGenerator` rather than by changing nginx, which
    needs root. **Keying an authenticated API by account is the better answer anyway**:
    it survives a phone moving between wifi and mobile data and does not lump a whole
    NAT behind one counter. Falls back to `X-Real-IP` for routes that run before
    `verifyToken`. `ipKeyGenerator` is required rather than decorative - it collapses
    IPv6 to a /56, without which one client can walk its own address space for a fresh
    bucket per request.

    **Registration order, not path, decides what middleware a route gets.** Three routes
    sat above the global limiter and so had *no* rate limiting at all - not even the
    global one - and above the request logger and CORS too:
    `/api/transcribe-voiceover` (runs faster_whisper), `/api/audio-waveform` (shells out
    to ffmpeg), and `/api/music-tracks`, which is above `app.use("/api", verifyToken)`
    as well and is therefore **unauthenticated**. Note this contradicts the claim under
    "One backend, two clients" above that *every* `/api` route is behind `verifyToken`;
    that is true only of routes registered after line 633.

    **The three heaviest endpoints had no limiter either** - only the global one:
    `/api/media-to-video`, `/api/edit-video`, `/api/upload-media`, which is the editor's
    entire export path. Credits already cap how much anyone can render, so
    `renderLimiter` (40/hr) is deliberately loose and exists for retry loops rather than
    as business logic. **Uploads are not credit-gated at all**, so `uploadLimiter`
    (100/hr) is their only ceiling. `/api/send-verification-email` gets the tightest
    limit at 5/hr: it sends real mail through a Gmail account with a daily cap, and
    burning that cap does not degrade one feature, it stops every new signup from being
    able to verify.

    Limiter definitions had to move above all routes - `const` is not hoisted, so
    attaching one to a route registered earlier in the file throws at startup.

    **Verified against a real booted instance on a spare port, not by reading**:
    requests 1-60 to `/api/music-tracks` return 200 and 61 onward return 429, and a
    request carrying a different `X-Real-IP` still returns 200 while the first bucket is
    exhausted - the separation that did not exist before.

    **Both nginx findings closed the same day** (owner ran the edits; no passwordless
    sudo here). `/etc/nginx/sites-available/api.fitlifesolutions.site` now sends
    `X-Forwarded-For` and `X-Forwarded-Proto` alongside `X-Real-IP`, and
    `client_max_body_size` went 50M -> **1G**. 1G rather than 500M on purpose: multer
    caps each *file* at 500MB while nginx caps the whole *request*, so at 1G a single
    large clip always reaches multer - which returns a clear JSON error naming the cap -
    instead of nginx answering with a bare 413 the app cannot explain.

    Verified rather than assumed, because the first reload silently did not happen:
    `sudo nginx -t && sudo systemctl reload nginx` typed as one line ran only the test,
    and nginx kept serving two-day-old workers with the old config. **A passing
    `nginx -t` is not a deployed config.** The checks that caught it and then confirmed
    the fix: worker process start times (a reload spawns new ones), and a 60MB
    unauthenticated POST to `/api/upload-media`, which returned 413 before the reload
    and 401 after - 401 meaning the body got past nginx and the app rejected the auth.

    **The rate-limit key cannot be forged**, which matters now that it reads a header:
    `proxy_set_header X-Real-IP $remote_addr` *replaces* whatever a client sent with
    nginx's own view of the socket, and `$proxy_add_x_forwarded_for` *appends* the real
    address, so with `trust proxy: 1` Express reads the rightmost entry and a
    client-supplied prefix is ignored.

    **`0e1af968` — multer's own limits now get a real status code.** They are signalled
    by `next(err)` before the handler runs, so `/api/upload-media`'s try/catch never saw
    them: the global error handler knew `LIMIT_FILE_SIZE` and `LIMIT_UNEXPECTED_FILE`
    but not the fileFilter rejection, so an unsupported file returned **500** and an
    oversized one a 400 that never said what the limit was. Now 413 with the 500MB cap
    stated, 400 naming the accepted types. Verified with a real ID token against a
    booted instance, all three paths including the success case.

    Worth recording how nearly that shipped unverified: the first run of that test
    reported the *old* messages, which read exactly like the patch not taking. It was a
    stale test server from an earlier boot still holding the port - `kill $BGPID` had
    killed the wrapping shell, not node. **When a test reports pre-change behaviour,
    establish which process answered before concluding anything about the code.** The
    rate-limit verification above is unaffected; that instance postdated the limiter
    work and did contain it.


32. **Capacity: one VPS is the right size, and two scaling cliffs were fixed rather
    than scaled around** (Aug 16 2026, `~/Tonefy-react/backend@8bb766a8`, deployed).

    **The measurements**, so this is not re-derived: 6 cores, 11GB RAM (8.3GB free),
    132GB disk free, load average ~1.3, sharing the box with five other pm2 processes
    that sit at ~0% CPU. A caption-heavy export is ~390 overlay renders at ~29ms each
    (item 24's own benchmark) plus the ffmpeg encode - call it **30-90s of nearly the
    whole box per export**, so roughly **one export per minute sustained**. 100 users at
    two exports a day is ~200/day against a ceiling near 1,400. **Volume is not the
    constraint; simultaneity is.** No load balancer, second server or Kubernetes is
    warranted at this size, and adding them would cost more than it buys.

    **Cliff 1 - the editor's export path had no concurrency limit at all.**
    `acquireVideoSlot` has capped renders at 4 since it was written, but from exactly
    one call site: `idea-to-video-v2`. `media-to-video` and `edit-video` had none, so
    ten simultaneous exports all started at once, each spawning ffmpeg plus up to 6
    parallel ImageMagick processes on 6 cores - all ten running ~10x slower. Worse than
    queuing in every respect: it degrades every user at once instead of making the last
    arrival wait, and **a single slow export has already been mistaken for a hang here
    and triggered an Android ANR** (item 20).

    Acquired *after* `res.json`, so the caller already holds its jobId and polls
    normally while queued, with the job message saying so. **Released in a `finally`,
    which is the part that has to be right** - a throw or early return that skipped it
    leaks a slot permanently, and four leaked slots stop every render on the server for
    good. Verified by extracting the real algorithm and running 11 jobs through it, two
    of which throw: never more than 4 concurrent, zero leaked, no stranded waiters, and
    a Creator-tier job still jumps ahead of queued free ones.

    **Cliff 2 - a blocking whole-file write per progress tick.** `saveJobsToDisk` was
    `writeFileSync` of the entire job store on every `updateJob`, and `updateJob` runs
    once per overlay since item 22 added per-overlay progress - so a 391-overlay render
    performed **391 blocking rewrites of the whole store, on the single thread serving
    every HTTP request for every user**. The cost is (jobs stored) x (ticks per render)
    and grows on both axes at once.

    Coalesced to at most one write per second, with an immediate flush for job creation
    and terminal states, where losing a second to a crash would strand a caller polling
    for a result the store no longer admits exists. **Note these handlers set status
    `'error'`, not `'failed'`** - the flush condition covers all three. Now also writes
    to a temp file and renames: the old version could leave truncated JSON on a crash
    mid-write, and truncated JSON fails to parse, **losing every job rather than the one
    in flight**. A pending write is flushed on SIGINT/SIGTERM so a pm2 restart cannot
    drop it. Verified on a booted instance - auth still enforced, jobs.json valid, no
    stray `.tmp`, all 37 jobs intact after a SIGKILL.

    **What would actually justify more hardware**, when the time comes: sustained
    queue depth on the 4 render slots, not user count. Watch how long jobs sit at
    "Waiting for a free render slot..." - that message exists now and is the signal. The
    first move then is a bigger box (renders are CPU-bound and scale with cores), not
    more boxes: the job store is in-process memory and the rate limiters are in-process
    counters, so a second instance would need both externalised before it helped.


33. **Five toolbar tools built, all zero running cost** (Aug 16 2026; app `f3500816`,
    `8896a509`, `703bb0fa`; backend `2df35786`, `8646efba`, `12035a72`). First delivery
    against the "free half of the toolbar first" order. All five are `premium: true`, so
    building them turns them into real Pro/Creator benefits rather than free additions.

    **Reverse, Reduce noise, Motion blur** are one property each on the media item,
    consumed in the existing per-clip filter chain: `reverse`+`areverse`, `afftdn`,
    `tmix=frames=3`. Chain order is deliberate - reverse before `setpts` so speed applies
    to the reversed clip, `tmix` last so it blends the frames actually shown. Stills are
    refused with a reason rather than silently no-op.

    **Reverse needed a cap.** The filter holds every decoded frame in memory at once,
    since the last frame must be written first - ~1.4MB/frame at 720x1280, so 15s at
    30fps is ~620MB for one clip, with four renders able to run concurrently. Refused
    past 15s, with the number in the message, on both sides. The per-clip `exec` timeout
    was 60s (sized for a plain transcode) and goes to 180s for these.

    **Stabilize is two passes**, and the trap is that `vidstabdetect`'s `.trf` is
    **indexed by frame number**: the detect pass must read *exactly* the frames the
    transform pass will - same `-ss`/`-t`, same source crop ahead of it. Mismatch them
    and nothing fails, the corrections just land on the wrong frames. That is why `vf` is
    now split into `vfHead`/`vfTail` - the transform has to splice in *before* the fit
    into the output frame, or the pad moves around with the picture. `unsharp` after is
    ffmpeg's own recommendation. The `.trf` is unlinked in a `finally` (the
    `txtrender-*.png` leak of `aaa0f043` is the precedent). Timeout 300s.

    **Video Translator** is whisper -> Groq -> edge-tts, all already on the box.
    14 languages; **voice names were read from `edge_tts.list_voices()` on this machine,
    not written from memory** - several are `Multilingual` variants whose obvious
    per-locale names do not exist. LLM call is `temperature: 0.2`, `max_tokens: 2000`
    against the helper's 0.8/400 defaults, and the system prompt insists on the
    translation alone: an LLM told to "translate" adds a preamble, and the preamble then
    gets spoken aloud as if it were the script.

    **It returns a jobId, and that was a correction forced by measurement.** Written
    synchronously first; then whisper was timed at **slower than realtime** - 74s of
    audio did not finish inside two minutes - so a 5-minute clip is 10+ minutes, past
    nginx's 600s `proxy_read_timeout`. Reuses the existing `/api/job/:jobId` polling. It
    also takes one of the four render slots (released in a `finally`), since whisper is
    as CPU-hungry as an export. Input capped at 5 minutes. Enforced Pro/Creator
    server-side, not only by the toolbar's `premium: true`.

    App side: the clip is uploaded on demand (clips live on the device until an export
    uploads them) and the URL is remembered on the item so a second translate does not
    re-send it. The result becomes a voiceover track **and the source clip is muted** -
    without that the original narration plays under the translation, which is worse than
    not translating. Its own poller rather than `pollJob`, which ends by handing an
    exported video to the result screen.

    **Verified against real inputs, not stubs.** Reverse proven to actually reverse (the
    output's first frame matches the source's *last* at PSNR 28.3 vs 16.0 for the
    source's first). Stabilize's exact two-command pair run composed with source crop,
    frame fit, motion blur, speed and denoise. Translation run end to end producing real
    Swahili and French from real English. Test account, Firestore doc, uploads and
    generated audio all removed.

    **What is not verified: vidstab's actual effectiveness on real shake.** Two attempts
    to synthesise shaky footage produced clips that were not shaky - caught by measuring
    rather than assuming, but not worth more scaffolding for a well-established ffmpeg
    filter. **Real handheld footage on a device is the remaining check.** Also unverified
    on device: all five tools, and whether Stabilize's "this takes longer" warning makes
    the wait feel explained.


34. **My Videos had three broken controls; all three fixed** (Aug 16 2026; app
    `c67bd6db`, `7dada187`, `d6633d1d`, `ce278ff8`). All reported from a real tester's
    device, none reproducible on the owner's.

    **The filter chips were clipped through the middle, and the first fix was wrong.**
    `filterRow` had `maxHeight: 44`; removing it changed nothing, confirmed on device -
    and confirmed *usefully*, because the other half of that same commit (the stat
    values) did land, which proved the bundle was current and the diagnosis simply
    wrong. Three things were needed together: `paddingHorizontal` moved from the
    ScrollView's `style` to `contentContainerStyle` (on a ScrollView, `style` is the
    outer clipping box, so padding there shrinks the visible area rather than insetting
    content); `alignItems: 'center'` on the content container, because it defaults to
    `stretch` and every chip was taking the row's height instead of defining it - which
    is why they came out cut through the middle rather than overflowing; and
    `flexShrink: 0` on the row plus `flex: 1` on the FlatList, so a long grid cannot
    compress the controls above it. **A horizontal ScrollView clipping its children
    vertically is nearly always cross-axis stretch plus padding on the wrong style, not
    a height that is too small** - reaching for a height is what put the original
    `maxHeight: 44` there, and it clipped again the moment a device used a larger font
    scale.

    **"26.5MB" was wrapping onto two lines** as "26.5M"/"B" on that same device.
    `numberOfLines={1}` with `adjustsFontSizeToFit`. Both symptoms came from **system
    font scaling**, which is worth testing deliberately - it breaks any layout with a
    hardcoded height.

    **Download was `Linking.openURL(url)`** - the video's URL handed to Chrome, leaving
    the user to download it from the browser. Now `utils/saveVideo.js` fetches the file
    and takes whichever route the *installed binary* supports: gallery (in a Tonefy
    album) when `expo-media-library` is present, share sheet when it is not. Required
    lazily inside a `try`, so build 9 got a working Download over the air and the
    gallery path switches itself on with no further edit. **Its manifest permissions
    had to be written by hand** - the library's own manifest merges three in, but
    `READ_MEDIA_VIDEO`/`READ_MEDIA_IMAGES` come from its **config plugin**, and a
    committed `android/` folder means EAS never runs prebuild so no plugin ever applies.
    Without them gallery saving fails on Android 13+. **Third time this project has been
    caught by that** (after the BILLING permission and react-native-iap's Gradle flavour).

    **"Use"/"Use This" navigated to Idea-to-Video with a `reuseVideoUrl` param that
    nothing read** - written in one place, consumed nowhere, so the video was dropped
    and you landed on an empty generator screen. Now opens it in the editor as a clip.
    **The file is downloaded before navigating, and that is load-bearing rather than
    polish:** `processVideo` builds its upload straight from `item.uri` for every item
    and maps the server's replies back **by position**, so a remote https uri in that
    list would upload nothing usable *and* shift every clip after it. Duration comes
    from the record's `durationSeconds` when present and is measured on device with the
    existing `measureVideoDuration` when absent - needed because **only two of the three
    `userVideos` writers store it, and the one that does not is Idea-to-Video**, which
    is where most of these videos come from. The clip is appended only after
    `draftChecked` (earlier and the restore wipes it), guarded by a ref against
    re-render, with the nav param cleared afterwards, and `persistInto`d out of cache
    like any picked clip.


35. **Extract audio, 23 audio effects, and the Empty Audio misroute** (Aug 21 2026; app
    `rebuild/phase-4`, published as update group `5c9ca907-1274-4aa4-887f-ce8707ae3d16`,
    runtime 1.1.0; backend `~/Tonefy-react@HEAD`, deployed via `pm2 restart` at 13:45:49,
    confirmed postdating the 13:45:48 edit).

    **`/api/extract-audio`** pulls a clip's sound into a file of its own so it can live on
    the timeline as a real track. Synchronous, unlike `/api/translate-video` which it
    otherwise mirrors: that one returns a jobId because whisper runs slower than realtime,
    while this is a demux-and-encode with no model in it. It **probes for an audio stream
    first** - without that a silent clip yields a valid but empty mp3 and the user gets a
    track that plays nothing with no explanation, which is worse than being told the clip
    has no sound. Offsite URLs are refused (SSRF: this box runs other services on
    localhost) and the scratch download is unlinked in a `finally`.

    App side it does **not** mute the source clip, deliberately unlike Translate - which
    must, or the original narration plays under the translation. Here the extracted audio
    is the *same sound*, so muting would leave the timeline sounding identical while
    looking changed.

    **`AUDIO_FX` is 23 chains, and the app sends an ID and never a filter string** -
    deliberately unlike the effect/motion/transition paths, which ship a chain and have the
    backend validate it. Those catalogues are large and change without a deploy; this one
    is small enough to afford the safer shape, so no caller-supplied text reaches a command
    line at all. **The cost, stated so it is not rediscovered:** adding one to
    `constants/audioFx.js` alone does nothing - it needs a matching `server.js` entry and a
    restart. A cross-check that both sides carry the same 23 ids is worth re-running after
    any edit to either.

    **The durable lesson is about instruments, not audio.** Every chain was rendered against
    real speech and measured, and the *first* pass reported a third of them dead:

    - **Reverbs.** A whole-file FFT magnitude spectrum is nearly blind to an echo - a delay
      moves phase, not magnitude - so all five measured ~0.00 and looked like no-ops. By
      **autocorrelation at the delay lag** they lift it from ~0.00 to +0.27 (room) .. +0.60
      (stadium). All five were working the entire time.
    - **Pitch.** Autocorrelation f0 **octave-errored** and reported `deep` as unchanged. By
      **median spectral-peak ratio across voiced frames** it is exactly 0.700. Note this is
      the opposite correction to the music work, where a spectral centroid was the wrong
      pitch instrument and autocorrelation was right - **neither method is "the" pitch
      instrument; each fails differently, so a pitch claim needs two that agree.**
    - **Loudness.** `loudnorm` is *supposed* to leave tone alone. Judged on a spectral
      measure it looks dead while working perfectly (x1.40 level).

    **One genuine defect did come out of that pass, and telling it apart from the
    false alarms is the point**: `bassboost` at `g=8:f=110` measured x1.10 on speech -
    applied, but inaudible, because voice carries almost nothing below 110Hz. It was
    credible *because the same instrument correctly read `warm` at x1.17 and `treble` at
    x3.19*. Retuned to `g=12:f=180`, which measures x2.06. An instrument that is wrong for
    one class can still be right for another; the way to tell is whether it succeeds on
    comparable cases.

    **`AudioFxSheet` is deliberately not `RecipeSheet`**, which every other catalogue uses.
    That sheet is built around an animated WebP preview tile per item, and there is no such
    thing as a picture of a reverb - it would render 23 identical grey squares looking like
    a failed load. **There is also no audition**: the preview canvas plays the raw clip, and
    `expo-av` can shift rate and pitch but has no reverb or EQ, so an honest preview would
    mean a server round trip per tap. The descriptions carry that weight instead and each
    says what the result *sounds like* rather than naming the filter. The sheet says so.

    **The export payload was edited first, for both clips and tracks**, because a tool whose
    flag never reaches the server is the bug this file already shipped four times.

    **Two things checked rather than reasoned about**, both settled with a real repro:
    - **TDZ.** `clipToolActions` references `extractClipAudio` 141 lines before its `const`.
      Safe, because it sits inside an **arrow body**, which resolves on call. Confirmed by
      running both forms: the arrow form runs fine, and only the immediate-eval form (a
      `useMemo` factory, which is what bit before) throws. **Arrow-wrapped forward
      references in the action maps are fine; a factory that runs during render is not.**
    - **`items[i].audioFx` vs `item.audioFx`.** The per-clip hook was written with `items[i]`,
      but the in-scope name in that loop is `item`. `node --check` cannot see this - same
      shape as the `transitionSpec` destructuring miss. Caught before deploy by grepping the
      enclosing block for what the neighbouring lines actually use.
      Note `\b` in **awk** is backspace, not a word boundary, so `awk '/\bitem\b/'` silently
      matches nothing - that cost two empty searches here. Use grep for word boundaries.

    **Verified against the deployed server, not by reading**: extract-audio returns
    200/400/404/400/401 across sound, no-sound, missing, offsite and unauthenticated, and
    the returned mp3 **correlates 1.000** with the source. Two full `/api/media-to-video`
    renders confirm the effects reach the finished mp4 - cathedral lifts the 150ms lag from
    -0.023 to +0.581, chipmunk shifts pitch x1.400. Test accounts and Firestore docs removed.

    **Dashboard**: the **Empty Audio** card said "start creating audio from a blank file" and
    navigated to **Idea to Audio**, which asks for an idea and writes the script for you -
    the opposite of starting blank. Now opens Script to Audio with an empty box. It was not
    a dead control, which is why the dead-control sweep never flagged it: **a card whose
    description and destination disagree passes every check that only asks whether something
    happens on tap.**

    **Untested on device.** ~~Also still not built from this group: **Beats / Beat Sync**~~ -
    **BUILT, see item 36.** ~~**Thumbnail**~~ - **BUILT, see item 37.** The Dashboard
    no longer marks it "soon". The blocker recorded here - no view-capture library, and a
    text renderer trapped as closures inside the `media-to-video` handler - was resolved by
    extracting the renderer rather than by adding a binary.

36. **Beat Sync** (Aug 21 2026; app published as update group
    `ef2bca23-c176-403a-ad6a-da6ae59c756b`, runtime 1.1.0; backend `/api/detect-beats` +
    `backend/detect_beats.py`, deployed via `pm2 restart` at 14:41:08).

    **Tempo is not enough to place a marker, and that is the whole problem.** The
    autocorrelation in `scripts/analyse-music.py` gives the beat **period** - how far apart
    beats are - which is all a tempo band needs and is why the library has BPM but no beat
    times. A marker needs the **phase** as well: where the first beat actually falls. A
    right period with a wrong phase puts every marker exactly *between* the beats, which is
    worse than no markers, because it is confidently wrong rather than absent.

    `detect_beats.py` does both: spectral-flux onset envelope autocorrelated for the period,
    then a pulse train slid across that envelope to find the offset with the most onset
    energy under its pulses. Phase is summed over the **whole track**, so an intro that
    starts off-grid cannot set the phase for everything after it.

    **It returns a grid, not raw onsets.** A grid is what a musician means by "the beat" and
    what a cut wants to land on; raw onsets include every snare flam and vocal consonant,
    and cutting to those looks nervous rather than rhythmic.

    **The two halves needed different checks, and only one of them was already proven:**
    - **period** - 12/12 agreement with the library's own measurement across real tracks
      (half/double time counted as agreement; both are musically correct readings). This
      reuses the method already checked against 68 tracks, so it was the cheap half.
    - **phase** - the NEW part, so measured separately: onset energy under the chosen grid
      versus half a beat off, on 10 tracks. The chosen phase won every one, and several
      anti-phase scores came out **negative** - those points land on below-mean flux, i.e.
      in the quiet gaps between beats, which is the strongest confirmation available.

    **`strength` is reported by the server and gated in the app**, deliberately. The honest
    answer for spoken word is "there is no beat in this", and the app is where there is a
    user to tell. Meditation music measures 0.116 against 0.44-0.86 for tracks with a real
    pulse. Under 0.25 the grid is still stored - a weak reading is not always a wrong one -
    but the message says plainly not to trust it.

    **The snap is the feature; the markers are how you aim it.** `splitAtPlayhead` snaps to
    the nearest beat within **0.12s**, which is under a sixteenth note at 120bpm. The
    detector only reports 60-180 BPM, which puts beats at least 0.33s apart, so a snap can
    never cross to the wrong beat at any tempo it finds. Markers you can see but cannot land
    on would be decoration.

    **The correctness property worth re-checking after any timeline change:** where a marker
    is DRAWN is block-relative (`beat - trimStart`), and where a split SNAPS is
    timeline-absolute (`beat + startOffset - trimStart`). **Two mappings of one number, and
    if they disagree the cut lands somewhere other than the tick it was aimed at.** Verified
    against real detector output across four placements including offset and trimmed tracks.

    **`components/BeatMarkers.js` caps at 240 ticks and nests them in groups of 16**, because
    beats scale with content length exactly as Waveform's bars did - a 3-minute track is ~300
    of them. See the O(n^2) sibling item above. 240 is well past legible on a 26px row at
    40px/s (beats land ~24px apart at 100bpm), so the cap only bites where the extra ticks
    are off-screen anyway. Its group wrapper fills the same box as the layer, which
    **resembles the FilmStrip bug (`03557326`) and is not**: those tiles FLOWED, so a wrapper
    narrower than the row truncated it, while these ticks each carry their own absolute
    `left` measured from a group that fills the layer exactly. **Grouping is transparent for
    absolutely-positioned children and not for flowing ones** - that is the distinction, not
    whether the wrapper is positioned.

    Premium, matching the clip-side `beats` tool and the real cost: ~6 seconds of a core per
    track. Synchronous, like `/api/extract-audio` and unlike `/api/translate-video` - 5-7s
    measured against nginx's 600s `proxy_read_timeout`.

    **Untested on device.**

37. **Thumbnail, and the renderer extraction that made it possible** (Aug 21 2026; backend
    `textRender.js` + `/api/thumbnail`; app published as update group
    `7ce58089-ece7-427c-9c75-950fe2e89050`, runtime 1.1.0).

    **The choice, and why it is the durable one.** A thumbnail needs a frame with styled
    text on it, and there were two routes: `react-native-view-shot` (capture the existing
    `CaptionText` component in-app) or render it server-side. View-shot is a **native
    module**, so it needs a new binary and a review cycle, and it would have left **two
    renderers** for one thing. Server-side reuse needed the export's text renderer, which
    was ~550 lines of closures **inside the `/api/media-to-video` handler** and therefore
    callable by nothing. Extracting it was the larger job and the right one: it ships over
    the air, and it means one definition of what a caption looks like across the editor
    canvas, the style picker, the export and now thumbnails.

    **`backend/textRender.js` is a verbatim move**, `createTextRenderer({...})`. Values the
    handler had in scope (`W`, `H`, export scale, font map) became arguments; per-overlay
    progress became a callback instead of a direct `updateJob`. Helpers are **injected, not
    imported from `server.js`** - no circular import, the module is independently testable,
    and there is still exactly one definition of `run`/`uniqueName`/`mapWithConcurrency`/
    `num`/`safeColor`.

    **The boundary is the part to get right, and getting it wrong is the mistake this move
    made.** The module renders each overlay to a PNG and says **where it goes**; it does not
    composite. The ffmpeg overlay chain pushes into the handler's own `inputs`/`filterParts`
    and is the *export's* way of using that output - a thumbnail uses one `composite` per
    overlay instead. Taking it along produced `inputs is not defined`, caught by a real
    render rather than by reading the diff.

    **Verified by A/B against the live server, which is the only proof worth having for a
    refactor of a working hot path**: rendered one request through the old code, deployed,
    rendered the identical request, compared frames. **Absolute pixel difference 0, RMSE 0,
    byte-identical frame size.** The fixture exercised what a move is most likely to break -
    a stroked and glowing spec, a box with a corner radius, letter tracking, and a second
    overlay with `boxWidthPercent`, which is the measured-wrap path.

    **`/api/thumbnail`** takes a frame (`-ss` before `-i`, so ffmpeg seeks rather than
    decoding up to the timestamp), scales and crops to **fill** rather than letterbox, burns
    the overlays through the shared renderer, and writes JPEG q92. Three sizes: 16:9, 9:16,
    1:1. Seeking past the end of a file produces **no frame and no ffmpeg error**, so the
    missing output is checked for explicitly rather than becoming a 500.

    **`previewWidth` is measured with `onLayout` and sent, never hardcoded.** Every length in
    a caption spec is points at the app's 18pt base and the renderer scales by
    `output width / previewWidth`, so **previewWidth is the app telling the server what the
    numbers on screen were drawn against**. A constant 360 against a stage that is 380 on a
    wider phone puts every thumbnail's text ~5% off its own preview.

    **The instrument was wrong again, and this one is worth keeping** because the first
    reading looked like a real bug. Halving `previewWidth` should double the rendered text;
    measured on a **glowing** overlay at size 34 it grew only **1.22x**, which reads exactly
    like broken scaling. It was the **safe-zone shrink from item 14** doing its job: at 2x
    the text overflowed the frame and was scaled to fit. Re-measured with **no glow and a
    size below the clamp**, it is 33x62 -> 65x122 px - **1.97x, exact**. *A measurement taken
    where a clamp is active measures the clamp.*

    **Also:** the source duration comes back in the response, because only two of the three
    `userVideos` writers store `durationSeconds` and the one that does not is Idea-to-Video -
    where most of these videos come from. Relying on the record would hide the frame slider
    and pin every thumbnail to frame zero. `utils/saveVideo.js` gained `saveImageToDevice`,
    kept separate from the audio one because a `createAssetAsync` failure means different
    things for an image than an mp3.

    **Three prop mistakes lint could not see**, caught by reading the components instead of
    assuming: `CaptionText` takes `style` (the spec) plus a separate `color`, not `spec`;
    `ProgressButton`'s outline is `variant="outline"`, not a boolean; a caption style's
    display name is `label`, not `name`. **`no-undef` proves an identifier exists, never that
    a prop name is the one the component reads.**

    **Untested on device.**

38. **Deleting an account left the YouTube refresh token behind forever** (Aug 26 2026;
    backend `~/Tonefy-react@03d49128`, deployed via `pm2 restart` 12:53:11, confirmed
    postdating the 12:51:27 edit; app `295f858d`, **not yet published**).

    **The defect.** `handleDelete` in `ProfileScreen.js` deleted `users/{uid}` and the
    Auth user, which is everything the client is *permitted* to reach. `youtubeTokens`
    and `tiktokTokens` are Admin-SDK-only by construction - no security rule mentions
    either, and Firestore denies where no rule matches. That is the right home for a
    bearer credential and it is exactly why the client could never clean them up. So a
    deleted account left a live, refreshable YouTube refresh token in Firestore
    permanently, with no path anywhere to remove it, alongside the channel id/title, the
    `scheduledPosts` the sweep then retried every five minutes forever, and the
    `userVideos` records.

    **Blast radius, measured rather than assumed:** nothing could be POSTED with it.
    `publishToYouTube`'s plan gate reads `users/{uid}`, which is gone by then, and fails
    closed. The credential simply persisted. That is smaller than it first looks and
    still not acceptable.

    **Why it mattered on that particular day:** privacy policy section 6(g) states that
    deleting your account deletes the tokens immediately and that no copy is kept after
    revocation - in the section the **YouTube API Services audit reads**. The policy
    described the behaviour we want, so the code was what was wrong. Fixing the code
    rather than softening the policy is the direction that generalises: **when a document
    and an implementation disagree, decide which one states the intent before deciding
    which one to change.**

    `POST /api/account/delete` purges all six collections and **revokes the refresh token
    at Google** rather than merely dropping our copy - a token we forget is still a token
    that works. Revocation is best effort and logged, since an already-dead token answers
    400 and must not stop us deleting our own row.

    **Two ordering rules, both load-bearing and commented at both ends:** it runs BEFORE
    the client deletes the Auth user, because `verifyToken` needs a live ID token; and if
    any step fails it returns 500 so the caller **leaves the login alone**. Deleting it
    would destroy the only key those leftovers are filed under - causing the exact failure
    the endpoint exists to prevent. A destructive endpoint that reports partial success as
    success is the same class of lie as the bug it is fixing.

    Deleting the `userVideos` records does not strand files on disk: `getOwnerPlan`
    returns `'free'` when `snap.empty`, so the sweep removes them at 72h. Checked, not
    assumed.

    **Verified against the deployed server** with a disposable account seeded into all six
    collections: HTTP 200, `{users,youtubeTokens,connectedAccounts,tiktokTokens,
    scheduledPosts,userVideos}` all zero afterwards, unauthenticated refused 401, and the
    revoke-failure branch exercised for real (`[account-delete] youtube revoke:
    invalid_token` logged, purge completed regardless). Test account and every fixture
    removed.

    **Published Aug 26 2026** to `production` as update group
    `a36dec11-0cfb-46ea-ad9a-cb7fb0fed42a` (commit `d2e4da75`, runtime 1.1.0), alongside
    item 39's Profile fix - channel confirmed serving it. Held back at first because
    `production` is the channel the 12 closed testers are on and CLAUDE.md's standing
    "publish freely" permission was written when Ahumuza was the only user, a premise that
    no longer holds there; published on his explicit say-so. The pre-update `package.json`
    diff against build 11 (`17fd20a9`) was clean - eslint devDependencies and a script, no
    runtime or native module. **Untested on device.**

    **Also fixed on the site the same day** (`tonefy-website@2614729`): the homepage was
    the only surface still badging Instagram, Facebook and X as **"Connected"** when none
    has any integration - every other page and the app already said "Coming soon". It is
    the page a Google reviewer lands on, and a false claim about one platform is a poor
    advertisement for the truthfulness of the claims about YouTube.

39. **Profile's YouTube row hardcoded "Connect" and never changed** (Aug 26 2026, app
    `d2e4da75`, published in the group named in item 38). Reported from a device: the row
    said Connect whether or not the account was connected.

    The row carried a comment justifying it - connection state lives server-side, so the
    row "routes there rather than asserting something it cannot check". **It was
    asserting.** "Connect" is a claim that you are not connected, and it was wrong for
    anyone who was. Declining to know would have been a row with no badge at all. TikTok,
    directly above it, was reading `connectedAccounts/{uid}` correctly the whole time -
    and YouTube lives in that same document, which this screen had already fetched, so
    the state was one property access away at zero extra cost.

    Also now reloads on `focus`. Connecting happens on ConnectAccounts and, for YouTube,
    in a browser, so a mount-only effect never sees it: you come BACK to the screen
    already connected. Same reasoning `SocialScreen` had already written down for its own
    `useFocusEffect`.

    **Audited all eleven files mentioning YouTube; Profile was the only one wrong.**
    Social reads `/api/platforms` plus `connectedAccounts` on focus, Connect Accounts and
    Edit & Post both read `/api/youtube/status`. The rest - Thumbnail, Landing, the three
    generation screens, My Videos - say "YouTube" as a 16:9 aspect-ratio label or a
    marketing link, and have no connection state to get wrong.

    **Known gap, flagged and not fixed:** the WEBSITE's `profile.html` and
    `connect-accounts.html` do not list YouTube at all - they know only TikTok, Facebook,
    Instagram and X. Connect YouTube in the app and the site shows no trace of it.

    **The diagnosis that cost a round trip:** the first device report after the fix still
    showed "Connect", which reads exactly like the fix not working. The fix had never been
    published - it was committed and pushed only. `ProfileScreen`'s own Build section said
    "Update applied", which refers to whatever update last applied and is not evidence that
    YOURS did. **Item 29's lesson again: check the publish, not just the commit.**


## Backend caption rendering (`~/Tonefy-react/backend/server.js`)

Changed Aug 7 2026 alongside the caption catalogue and **deployed Aug 7 2026 09:12** —
the pm2 process `tonefy-backend` is running this code. Note the deployed state includes
uncommitted `server.js` changes on top of `02a75a25`; a restart takes the working tree.

Both caption paths are now driven by the style spec the app sends, so the server holds no
copy of the catalogue and a style added in the app renders without a deploy on this side.
Overlays and requests without a spec keep the old id-keyed behaviour.

- **`/api/media-to-video`** (voiceover path, ImageMagick) — `t.captionSpec` drives stroke,
  glow, drop shadow, box and tracking. Layers composite back-to-front: shadow, glow,
  stroke ring, fill, all inside the box.
  - The stroke ring is a **dilate of the alpha on an already-padded canvas**. Dilating an
    alpha cropped to the glyphs squares the ring off at the text's bounding box, which
    reads as a black slab behind the word rather than an outline around it. This was
    caught by rendering it, not by reading it.
  - **`roundrectangle` with radius 0 draws nothing at all** — not a square-cornered box,
    nothing. A hard-edged chip has to ask for `rectangle` by name. Newsroom and Noir were
    silently losing their box to this.
  - Geometry: `effWt`/`effHt` must track the padded and boxed sizes, since placement
    centres on them.
- **`/api/edit-video`** (burn-in path, ASS) — `captionMeta` in the request body carries
  spec, font, size, colour, case and cadence. `assStyleFromSpec` maps it onto ASS's native
  outline / box / shadow / spacing. Gradients fall back to the first stop: per-glyph colour
  tags cannot coexist with the karaoke timing tags this file already emits.
  - **ASS colour is `&HAABBGGRR`** — channels reversed from CSS *and* alpha inverted, where
    `00` is opaque and `FF` invisible.
  - **libass needs `fontsdir`.** It resolves `Fontname` through fontconfig, which has never
    heard of the families this app ships, so without it every custom face silently becomes
    DejaVu Sans — it renders, just in the wrong typeface. All three `ass=` call sites go
    through `assFilter()` so no one site can forget it.

Verified before commit: all 130 specs render through the ImageMagick chain with the
reported geometry matching the files on disk, and all 130 produce valid ASS with correct
field counts, colours, border styles and cadence. Samples burned into video frames to
confirm the fonts and boxes actually land.

**That pass covered 130; the remaining eight (`33b4ef33`'s Highlight styles) were verified
separately Aug 11 2026** — see item 3 under "IMMEDIATE NEXT STEPS". They needed a different
check than the other 130: none of the 130 use the `highlight` spec field, so the pass above
never exercised it. Result: the ImageMagick path (voiceover route) was already correct; the
ASS path (`handleAutoCaption`'s no-voiceover route) silently ignored `highlight` entirely,
fixed in `036aad9f`. What is still **not** verified is the app-side rendering — that needs
a device.

## Known nits, examined and deliberately left

### The photo filmstrip's phantom slide (Aug 9 2026)

`TimelineClip` passes `animOffset` to `FilmStrip` for stills as well as videos, and
the image branch consumes it (`left: offset`), so during a left-handle drag a photo's
strip really does slide. It just conveys nothing:

- **The motion is imperceptible.** A still's strip is one image repeated at
  `height * 0.75`, so the content is periodic and identical - shifting a row of
  matching tiles looks the same as not shifting it, except at the clip's edges.
- **It snaps back on release.** `baseOffset` is `-trimStart * PIXELS_PER_SECOND`, and
  `applyClipTrimEdit` never writes `trimStart` for an image - it changes `duration`.
  So `trimStart` stays 0, and the strip returns to phase zero the moment the finger
  lifts.

Not fixed on purpose. The one-line change - stop passing `offset` for images - trades
an invisible slide that snaps back for no slide at all, which is a different
invisible artefact, and adds a type branch to a component that currently has none.
Investigated properly, so it should not be rediscovered as a bug.

Worth separating from a question that was asked at the same time and is NOT a defect:
a photo's left handle shortening the clip from the right is not backwards, because a
video's does exactly the same. Clip position is the running sum of preceding lengths
(`clipsComputed`), items carry no `startOffset` - only audio tracks do - so no clip's
left edge can move. Video only *feels* different because its strip slides over real
frames while a still has nothing to reveal.

## Known gaps vs. the original lost version (lower priority, not yet rebuilt)

- No pinch-to-zoom on timeline.
- No frame-accurate video scrub-seeking while paused — partly closed by `712adbda`,
  which seeks the canvas on scrub; still keyframe-accurate rather than frame-accurate,
  since expo-av does not expose ExoPlayer's exact seek parameters.
- ~~Sticker/Outline caption styles not rendered on the backend export side (ImageMagick)~~
  — closed Aug 7 2026; the export is spec-driven now (see “Backend caption rendering” above).
- ~~"Highlight" caption style alternating-color bug~~ — gone with the old style table.
- Full teal→green rebrand — incomplete.
- Split/Fade audio actions — stubbed "Coming soon" in the original, not present here.
- Backend ffmpeg `adelay`/`afade` support — separate open item, unaffected by this rebuild.

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
