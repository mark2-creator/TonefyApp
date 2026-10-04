# Bug patterns - full write-ups

Moved verbatim out of CLAUDE.md on Oct 4 2026 to keep that file small. Facts here are a
record of when they were written; CLAUDE.md holds the current state.

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

## Input handling: where user text meets a command line (audited Sep 17 2026)

The foundation is sound and worth not undoing: **every external binary is invoked with
`execFile` and an argument array, never a shell** (`run()` in `server.js`; no `shell: true`
anywhere). So a caption reading `"; rm -rf /"` arrives at ImageMagick as literal text.
Keep it that way - the moment one call switches to `exec` with an interpolated string,
every caption in the app becomes a command.

That still leaves each TOOL's own syntax, which is where the real findings were. All three
were confirmed by running the thing, not by reading it.

**1. ffmpeg filter injection through the client-supplied chains (FIXED).** The app sends
grade/motion/transition chains so the catalogue can grow without a backend deploy, and the
server checked an op name plus shell metacharacters. Both read only as far as the first
`=`, and neither rejected a **comma** - which is how ffmpeg chains filters. So
`eq=brightness=0.1,movie=http://169.254.169.254/` passed as "eq" and smuggled a second
filter; `movie=` opens any file or URL the server can reach, and this box runs five other
pm2 services on localhost. Grade chains and transition fx are ARRAYS, so one entry is one
filter and a comma inside one is now refused outright. A motion cannot use that rule - its
whole point is an expression, and `z='min(zoom+0.001,1.5)'` needs its comma - so a motion
is split on commas **outside parentheses and quotes** and every segment must name a
geometry op (`MOTION_ALLOWED_OPS`). **Cost to remember: a motion added to
`constants/motions.js` using an op not on that list silently does not render** - the same
failure shape as the `{W}` substitution trap right above it.

**2. ImageMagick `label:` interprets percent escapes (FIXED).** `%[fx:2*3]` DREW "6" -
measured, at identical width to a literal "6". `%d` and `%w` disappeared the same way.
Percentages are ordinary content for this app's users, so this was a real rendering bug,
not only hardening. `imText()` in `textRender.js` is now the single boundary where text
meets ImageMagick, which also fixed a quieter drift: the backslash strip had applied on the
render side only, so **the string being MEASURED was not the string being DRAWN**.
`label:@file` would read a file outright; this box's ImageMagick policy refuses the `@`
indirection (verified by trying it), but the escaping does not rely on that holding.

**3. The ASS path stripped braces but not newlines (FIXED).** Braces are what stop a
caption injecting its own override tags. A `.ass` file is line-based, one Dialogue event
per line, so a literal newline split the event and corrupted the file. Newlines become
`\N`, an ASS hard line break, which keeps what the user meant.

**Checked and found already correct** - don't re-audit these without a reason: uploads are
type- and size-filtered by multer; `isOwnMediaUrl` gates every video URL; paths built from
a client URL go through `path.basename`, which neutralises traversal; the verification
mailer takes its recipient from the verified Auth record, never the request body; no URL
parameter reaches `innerHTML` on any page of the website (all use `textContent`); and audio
effects send an ID rather than a filter string, which is why they needed none of this.

**The shape to carry forward: a safe process spawn does not make the payload safe.** Each
consumer - ffmpeg's filtergraph, ImageMagick's percent escapes and `@` indirection, ASS's
braces and line structure - has a syntax of its own, and user text has to be made safe for
*that* syntax at the boundary where it is handed over.

## Known bug pattern: an authorisation check that reads a client-written record

**Found for real Sep 16 2026 in TikTok, and fixed.** `tiktokOwnedBy(uid, openId)` read
`connectedAccounts/{uid}.tiktok.openId` to decide whether that uid was allowed to post to
that TikTok account. But **`connectedAccounts/{uid}` is written by the CLIENT** -
`tiktok-success.html` wrote it, and the Firestore rule lets any user write their own doc.
So the check asked the caller whether the caller was allowed.

**Why it was exploitable rather than merely ugly:** an `openId` is not a secret (this file
already said so), and `getTikTokToken(openId)` reads an Admin-only token keyed by openId
alone. Write someone else's openId into your own record and every ownership check passes.
The same forged value also chose whose token `/tiktok/disconnect` revoked.

**Confirmed reachable before anything was changed** - a real client-authenticated REST
write put an arbitrary openId into a fresh user's own record and Firestore returned 200.
Then confirmed closed by running the whole exploit against the fixed server: the forged
claim still writes (the rule is unchanged, and nothing trusts it now), posting is refused,
and the victim's token survives the disconnect attempt.

**The rule: a record the client can write is a CLAIM, never a credential.** Ownership has
to live somewhere the client cannot reach - here `tiktokTokens/{openId}.uid`, written only
by the server. Note the trap is not "we forgot to check" - there WAS a check, with a
careful comment about failing closed, reading the wrong source. So the question to ask of
any authorisation check is not *does it check* but **who wrote the thing it is reading**.

**And check it at the point of use.** Three paths reach TikTok - `/api/post-now`, the
scheduled sweep, and the older `/tiktok/post-video`. The check now sits inside
`publishToTikTok`, because a check that has to be repeated per route is one that some
future route eventually gets written without.

**The binding needed a uid at the end of an OAuth that does not carry one** (TikTok's state
holds only the PKCE verifier, and the flow is under review, so it must not be touched).
Solved without touching it: the callback issues a **single-use link code**, and the success
page trades that code plus its own Firebase ID token for a server-written connection. The
redirect URI, scopes and consent screen are all unchanged - the query string on **our own**
success page is ours to add to. Codes live in `tiktokLinkCodes`, are consumed before
anything else can fail (a code that survives a failed attempt can be replayed), expire in
10 minutes, and are swept at issue time since nothing else ever looks at that collection.

**Where else to look for this shape:** anything reading `connectedAccounts` to authorise
rather than to display. The other platforms are safe today for a structural reason worth
keeping - their tokens are keyed by **uid**, so the uid doing the reading is the uid whose
token is used and there is nothing to forge. TikTok was exposed precisely because its
token store is keyed by openId, which is what also made it the easiest to make
multi-account. **A per-account-id token store needs a server-written owner field from the
first day it exists.**

## Known bug pattern: a reasoning model's `max_tokens` is a SHARED budget

**Found Sep 24 2026.** Groq's `openai/gpt-oss-*` models are reasoning models, and
`max_tokens` caps their private reasoning **and** the answer together. Reasoning is
spent first, so a budget that looks generous for the answer can be consumed entirely
before one content token is emitted. The reply is not an error - it is
`finish_reason: 'length'` with `content` **empty**.

Measured on this app's own prompts at their real budgets, default (medium) effort:

| call site | max_tokens | reasoning tokens | result |
|---|---|---|---|
| `/api/extract-keywords` | 80 | 78 | **empty** |
| AI tool lookup | 120 | 113 | **empty** |
| `/api/extract-segments` | 500 | 498 | **empty** |
| url -> script | 400 | 141 | `finish: length`, narration **truncated mid-sentence** |

**Fixed with `reasoning_effort: 'low'`, not by raising every budget** - these prompts are
lookups and extractions, not problems needing deliberation. Reasoning drops to 28-46
tokens and every call finishes `stop` with real content. Set once in `groqChat`, the
single boundary every caller goes through.

**Three things this hid behind:**

- **Only one of the four actually broke visibly.** `/api/extract-segments` calls
  `groqChat` DIRECTLY rather than through `callLLM`, so it has no Cloudflare fallback and
  simply failed. The others fell through to Cloudflare on *every single call* - working,
  slower, and not what the model list is for. **A fallback that always fires looks like
  success.**
- **The error it surfaced named the wrong thing.** Empty content set `lastError`, the
  loop moved to the next candidate, that one was retired, and the 404 for
  `groq/compound-mini` is what reached the log - so the visible error was the *second*
  model's retirement, never the first model's starvation. `lastError` now reports
  `finish` and the reasoning/budget split, because "returned empty content" alone is what
  got blamed on the model last time.
- **It had already caused a wrong conclusion, written down as fact.** The comment above
  `GROQ_MODELS` rejected `openai/gpt-oss-20b` on Aug 17 2026 for "returns EMPTY content
  for these prompts". It does - at medium effort, exactly as the 120b does. It was the
  budget, not the model, and that misdiagnosis cost the list its only working fallback.
  `gpt-oss-20b` passes all four real prompts at low effort and is the fallback again.

**`qwen/qwen3.8-27b` is still rejected**, now for a measured reason: it accepts
`reasoning_effort` and ignores it, starving at 80 and 400 tokens.

**The guard:** a model that does not take `reasoning_effort` answers **400**, which is not
a "model gone" error and would be rethrown, taking the feature down. `groqChat` retries
once without the parameter.

**Verified through the deployed endpoints, not the library:** `/api/extract-segments` and
`/api/extract-keywords` both return real content, with no fallback warning in the log.

## Known bug pattern: a field that is WRITTEN but never READ

**Found Sep 24 2026 in TikTok, and it had been live since the token store was built.**
`saveTikTokToken` wrote `expiresAt` on every save, with a comment stating it existed
"so a refresh can be attempted rather than the connection simply failing". Nothing ever
read it. A TikTok access token lives **24 hours**, so every TikTok connection stopped
working the day after it was made, and the only cure was reconnecting by hand.

**Why it hid for so long.** The owner reconnects while testing, so the connection was
almost always less than a day old. And the failure is silent in the worst way: the
badge still said Connected, because `getTikTokToken` returned the expired record and
every caller reads that as "we have a token". The same stale-badge shape as item 39 and
item 41, arrived at from a third direction.

**The tell is in the code, not the symptom.** A field written with a comment explaining
what it is *for* and no reader anywhere is a feature that was designed and never
finished. `grep` for the field name: one hit in the writer and none in a reader is the
whole bug.

**Three things a token refresh has to get right**, all of which are easy to miss:

- **Rotation.** TikTok returns a NEW refresh token each time. Two concurrent refreshes
  race, and the loser persists one the provider has already replaced - which breaks the
  connection *permanently* rather than for a day. One in-flight promise per account,
  shared by everyone who arrives while it runs.
- **What the save overwrites.** `saveTikTokToken` uses `.set()` without merge, so the
  refreshed record must spread the stored one. That is what keeps `uid` - the
  server-written ownership field `tiktokOwnedBy` reads (see the client-written-record
  pattern above). Dropping it would fail every ownership check.
- **A margin.** Refresh a few minutes EARLY, or a token that passes the check expires
  during the upload that follows. A video post takes real time.

**And a dead refresh token must return null, not the expired record** - that is what
makes `/api/tiktok/status` report disconnected instead of drawing Connected over a
token that cannot post.

**Where else to look:** every platform storing an expiring token. Pinterest already has
`pinValidToken` and is fine. The uid-keyed platforms are worth a `grep` for
`expiresAt`/`expires_in` with no reader beside it - the question to ask is not whether
the expiry is recorded but **who reads it**.

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

## Known bug pattern: a canvas made the right SHAPE at the wrong SCALE (fixed Oct 3 2026)

**Reported by the owner from a downloaded video: "the captions become very small".** Every caption
burned in by the ASS path (Idea/Script/Url to Video, Auto Captions) on a **1080p export** - Pro,
Creator, admin - came out at **2/3 of its design size since Aug 11 2026**. Free (720p) was right,
which is why it hid.

**Cause:** item 14 set `PlayResX/Y` to the real output size to stop libass stretching a 720x1280
canvas onto a 16:9 frame. Right about the shape - but every number in `buildAssFile` (font size,
outline, shadow, margins) is pixels designed for a 720-wide frame, so on 1080x1920 the same "42px"
landed on a frame 1.5x taller. **Measured:** caption width 50.4% of frame at 720x1280, 33.6% at
1080x1920 before the fix, 50.3% after. **Fix:** `PlayRes` keeps the real aspect ratio at the
720-short-edge scale (1080x1920 -> 720x1280, 1920x1080 -> 1280x720, 1080x1080 -> 720x720); libass
scales uniformly. 720p output is byte-for-byte the same canvas. Verified on a live 1080x1920 render.

**The shape to carry forward:** when a coordinate space is changed to match the output, every number
written in the OLD space has to be rescaled with it - or keep the old space and change only its aspect.

**Same day, the owner asked whether AI clips were being used: they were not**, because the two real
videos he made were sent with `aiScenes: 0` - the row defaults to **Off**. The AI path itself was
working (proven in the Oct 3 end-to-end test). **DECIDED the same day: the row now defaults to "First
scene" for any account with scenes to spend** - paying users, admin, and the 3/month unpurchased
accounts; free stays Off. Applied once per screen visit so a deliberate Off sticks. Update group
`5cf3b391-d92a-4cc0-a4e8-698ca74ec2ea`.
