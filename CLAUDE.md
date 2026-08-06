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

Extracted as `React.memo` components: `ClipsRow`, `TextRow`, `CaptionsRow`, and
`AudioTrackRow` (shared by both voiceover and music rows — two call sites, wired in
commit `56d986ad`). Net -62 lines of duplication. Build check clean before and after
the JSX swap.

## Repo hygiene (as of Aug 5 2026)

- `rebuild/phase-4` pushed to `origin`, confirmed at `80911885`.
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
2. On-device test of `rebuild/phase-4` is in progress. Published to `preview` as update
   group `451d5908-16e9-4d7b-afbc-0f1706329d71` (commit `9853004b`, runtime 1.1.0) on
   Aug 6 2026. Once confirmed working on device, open a PR into `main` and merge.
3. Remove the `/tmp/tonefy-build` backup copy once confident the `~/tonefy-build`
   copy is the sole working source (git history is now the real safety net).
4. Rotate the exposed GitHub PAT in `xauusd_scalper` repo config (unrelated hygiene
   item, low priority, not urgent).

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
