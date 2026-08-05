# Tonefy AI — Project Context for Claude Code

## What this project is

React Native / Expo (SDK 54) mobile video editor. CapCut/Canva-level quality bar.

Main frontend file under active work: `screens/EditVideoScreen.js`.

Backend: `~/Tonefy-react/backend/server.js` (Node/Express-style server with ffmpeg-based
video processing, faster_whisper transcription, ImageMagick caption rendering).

## Repos and directories (do not confuse these)

- **`mark2-creator/TonefyApp`** — the actual frontend app (matches EAS project slug `tonefyapp`).
  This is the one being worked on.
- **`mark2-creator/Tonefy-react`** — backend-only repo. Not the frontend.

On this VPS there are three confusable local directories:

- **`~/tonefy-build`** — ✅ **THE working copy.** Git repo, remote = `mark2-creator/TonefyApp`,
  branch `main`. All Phase 1–4 rebuild work lives here. Use this one.
- **`~/TonefyApp`** — ❌ stale decoy from June 10. Not a git repo, no `screens/EditVideoScreen.js`,
  no `babel.config.js`. Ignore it. Do not patch files here.
- **`/tmp/tonefy-build`** — ❌ the old working copy, now superseded. Left in place as a
  temporary backup only. Do not edit here; it will vanish on reboot.

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

Note: `babel.config.js` is currently **untracked** in git. It must be committed or the
next clean checkout silently loses worklet compilation.

## SAFETY RULE — do not break this

Do **not** `eas update --branch preview` until the rebuild reaches full feature parity with
what's currently live. Every past `eas update` to `preview` is already live on Expo's CDN
and serving real users, completely independent of VPS disk state — so nothing is at risk
from local work. But publishing an incomplete rebuild to `preview` would downgrade
production. Set up a separate branch/dev-client for testing before ever touching `preview`
again.

## Known security hygiene item (low priority, not urgent)

A GitHub PAT is exposed in plaintext in `~/xauusd_scalper/.git/config` remote URL
(unrelated repo). Rotate when convenient.

## Design/brand note

Project is mid-rebrand from teal `#00d4d4` to green `#2ECC71`. Incomplete — only new
caption-chip styling currently uses the green. Don't treat teal instances as bugs;
they're pre-rebrand and out of scope unless explicitly asked.

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

`CAPTION_STYLES` (12 styles), `CaptionPreview`, `generateCaptionsFromVoiceover` (calls
`/api/transcribe-voiceover`), style-aware rendering in `DraggableTextOverlay`, time-gated
preview, grouped caption summary chips (`captionPreviewGroups`) in brand green.

### Phase 4: Performance/memoization reapply — ✅ COMPLETE

All four aux rows extracted as `React.memo` components and wired up
(all in `screens/EditVideoScreen.js`):

| Component | Defined at | Wired up? |
|---|---|---|
| `AudioTrackRow` | line 370 | ✅ two call sites (voiceover + music) |
| `CaptionsRow` | line 408 | ✅ |
| `TextRow` | line 432 | ✅ |
| `ClipsRow` | line 454 | ✅ |

`AudioTrackRow` is shared by both the voiceover and music rows, parameterised by
`accentColor` / `iconName` / `addLabel` / `tracksComputed` + the shared handlers
`onDragEndAudioTrack`, `applyAudioTrimEdit`, `onPressAudioTrack`. Replacing the two
inline blocks removed 62 net lines of duplication. Build check clean.

## IMMEDIATE NEXT STEPS

1. **Push to `mark2-creator/TonefyApp`.** Work is committed locally on branch
   `rebuild/phase-4` (`3fb978c9` = Phases 1–3 + partial 4, plus a follow-up commit wiring
   `AudioTrackRow`), but **nothing has been pushed yet** — the only copy is still on this
   VPS. Pushing is the actual root-cause fix for the original data-loss incident.
   Merge to `main` when ready.
   Note: `node_modules/` is tracked in git and floods `git status`. Filter with:
   `git status --short -- . ':(exclude)node_modules' ':(exclude)dist'`
   Still untracked, needs a decision: four `EditVideoScreen.js.bak_*` recovery snapshots
   (probably gitignore rather than commit).

2. **Set up safe on-device testing** without touching live `preview` — separate
   `eas update --branch recovery-test-style` channel + a build pointed at it. Reassess
   whether Claude Code changes what's possible here vs. pure Termux+SSH.

3. **Next feature work**: pick from the known-gaps list below (pinch-to-zoom and
   frame-accurate scrub-seeking are the biggest parity gaps).

4. Rotate the exposed GitHub PAT in `xauusd_scalper` (low priority).

## Known gaps vs. the original lost version (lower priority, not yet rebuilt)

- No pinch-to-zoom on timeline.
- No frame-accurate video scrub-seeking while paused.
- Sticker/Outline caption styles not rendered on the backend export side (ImageMagick) —
  was already an open item even before the data loss.
- "Highlight" caption style alternating-color bug — pre-existing, unfixed.
- Full teal→green rebrand — incomplete.
- Split/Fade audio actions — stubbed "Coming soon" in the original, not present here.
- Backend ffmpeg `adelay`/`afade` support — separate open item, unaffected by this rebuild.

## Working conventions to keep

- One logical change at a time; verify with a fresh build check after each.
- When patching via scripted find/replace, use exact unique-string matching that fails
  loudly if the target isn't found exactly once (avoids silent no-op edits).
- Don't trust terminal echo/paste alone for verifying file state — re-read the file
  (`cat`/`grep`) after edits when in doubt.
