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

Screens outside the editor are still entirely green and predate this rule, so some of
their green is decorative and should be neutral — `PostRecordingScreen.js` is the known
example. Not yet migrated.

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

4. Remove the `/tmp/tonefy-build` backup copy once confident the `~/tonefy-build`
   copy is the sole working source (git history is now the real safety net).
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
      base text paint, not the keyboard's own composing overlay. Fixed (commit `28f32b2f`,
      update group `2ab73009-6dd9-45bb-ac87-425fef57f264`) by turning `autoCorrect`/
      `spellCheck` off on the caret `TextInput`, which commits each character immediately
      instead of holding it in composing state - nothing left for the keyboard to paint a
      highlight on. Both the plain and caption-styled overlay paths share the one
      `withCaret()` function, so one change covers both. **Untested on device** - the
      mechanism fits every reported symptom, but not yet confirmed closed.

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
