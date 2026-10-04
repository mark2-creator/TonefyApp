# The editor - rebuild phases, captions, timeline, preview, caption rendering

Moved verbatim out of CLAUDE.md on Oct 4 2026 to keep that file small. Facts here are a
record of when they were written; CLAUDE.md holds the current state.

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
