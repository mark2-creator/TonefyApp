---
name: tonefy-design
description: Tonefy's visual identity and UI conventions — the teal/green colour rule, context toolbar pattern, spacing, iconography, sheets, and timeline geometry. Use whenever building or changing UI in this React Native/Expo app, before writing any screen, component, toolbar, sheet or style block.
---

# Tonefy design

A mobile video editor held to a CapCut/Canva quality bar. Dark, dense, content-first:
the footage is the subject and the interface is instrumentation around it. Nothing in
the chrome should compete with the frame.

Everything below is what the app already does. Match it rather than inventing a
parallel convention, and when something here is wrong because the code moved, fix this
file in the same commit.

## Colour

Two brand colours, and the difference between them is meaning, not age.

| Colour | Means | Used for |
|---|---|---|
| **Green `#2ECC71`** | this action commits | Export, modal Apply, ADD, Confirm ✓, success text, "Match style", caption chips, switch-on |
| **Teal `#00d4d4`** | you are handling media right now | waveform bars, trim handles, selected-clip border, speed badge, sliders, scrubber, progress bar, active tab underline |

Ask which one a control is before picking: *does this land a change* (green) or *is this
part of the instrument you are working the footage with* (teal). A slider is teal even
when it lives in a sheet whose Apply button is green.

**Selection splits on what is being selected.** A control that chooses a *value* is
green in its active state — the selected voice, the selected resolution, an active tool
chip that applies on tap. A control that switches *which view you are looking at within
the editor* is teal — a sheet's segmented pills, the music/voiceover tabs. Both are
"selected", but only one of them changed the video. This is why the voice pill and the
music/voiceover tab pills sit next to each other in the same sheet in different colours.

**The bottom tab strip is GREEN, and that is settled** (owner, Sep 18 2026). This rule
used to name it as teal, and neither client ever rendered it that way — both use
`theme.accent` (`#2ECC71`). Asked to choose, the owner's answer was that **the APP is the
reference**: where this file and the app disagree, the app wins and this file is what
gets corrected. So the strip stays green on both clients, and the teal rule is about the
editor's own instruments rather than app-level navigation.

Some things are neither an action nor media. If it is an **indicator attached to the
media or the editor surface** — the quality badge on the top bar, a RAW marker on a
preview — it is teal.

**Decoration is neither colour.** An icon in a card header, a card title, a border
stripe on a stats panel: these are ornament, not controls, and they take neutral values
(`#fff`, `#888`, or the surface's own border). Green in particular is *never*
decorative. Its whole job is to mark the thing that commits, and a screen that spends
it on a card title has nothing left with which to distinguish its Save button. If you
find green on more things than a user could plausibly press to commit something, the
screen is diluted and the decorative ones are the mistake.

Green is worth more when it is scarce: Export is the only green in the top bar, and
that is what makes it read as *the* commit.

Write green as **`#2ECC71`** — uppercase. The codebase has both cases; new code uses one.

> **Validation status (Aug 7 2026).** This rule has been probe-tested only by reading
> this text and applying it by hand, in the same session that wrote it — not by a fresh
> session picking the skill up on its own, because `tonefy-design` had not yet appeared
> in the loaded skill list. That probe found and fixed one real defect (decoration had
> no category and fell through to teal), so the text has moved since. A genuine
> validation still needs: a session restart, an **unaudited** screen, and nobody
> steering the interpretation — the author grading their own rule is weak evidence, and
> a rule can read as obviously correct and still be wrong in a case nobody tried.

This rule was decided after an audit, so do not read the existing file as gospel: the
teal in `EditVideoScreen.js` is a mix of correct chrome and un-migrated actions. Convert
teal to green when a control you are already editing is a commit action. Do not sweep.

### Social platform identity — a MUST, not a preference

A third party's brand overrides Tonefy's palette wherever we name or mark that party.
Whenever a social platform is shown — a connect card, a "Post to" row, a success page, a
marketing surface, anywhere:

- **Use the platform's OFFICIAL logo**, never a Material/FontAwesome stand-in *where a
  real mark exists*. A generic glyph in place of a real logo reads as unofficial and, on
  a review surface (TikTok/Meta/Google audits), as a red flag. In the app the canonical
  marks live in **`components/BrandLogos.js`** (`TikTokLogo`, `YouTubeLogo`,
  `FacebookLogo`, `InstagramLogo`, `PinterestLogo`) - full-colour SVGs; import those, do
  NOT reach for `FontAwesome6 name="instagram"` etc. (the FontAwesome Instagram glyph is a
  flat one-colour camera, not the gradient mark, which is exactly what got flagged
  Sep 11 2026). They sit cleanly on a black badge or the row background.
- **Write the platform NAME in that platform's own brand colour** (not `#fff`, not a
  theme token, not green/teal), and as close to the brand's own typographic style as the
  available fonts allow — the logo carries the true wordmark, the name echoes it. This is
  the one place the green/teal rule above does **not** apply: a platform name is the
  third party's identity, not one of our controls.

Brand colours to use (kept here so they are not re-guessed):

| Platform | Brand colour | Note |
|---|---|---|
| Facebook | `#1877F2` | solid blue |
| Instagram | pink→orange **gradient** `#FEDA75 → #FA7E1E → #D62976 → #962FBF` | gradient text via `background-clip: text`; fall back to `#D62976` |
| TikTok | `#000` mark, cyan `#25F4EE` + magenta `#FE2C55` accents | on dark surfaces the mark needs a light chip behind it |
| YouTube | `#FF0000` | |
| X | `#000` / `#fff` on dark | |
| Pinterest | `#E60023` | |
| LinkedIn | `#0A66C2` | |

The word "Connected!", "Post", and our own copy around the name stay Tonefy green — only
the platform *name itself* takes the brand colour. Proprietary brand fonts (Facebook
Sans, Instagram's wordmark) cannot be embedded; approximate with a clean bold sans and
let the official logo carry the real letterforms. First applied Sep 11 2026 to
`facebook-success.html` and the Facebook/Instagram connect + post UI.

### The website follows this skill too (Sep 17 2026)

`/var/www/tonefy-ai` is the second client of the same backend and is held to the same
rules. It has no build step and no package manager, so two things differ in MECHANISM
while the rule stays the same:

- **Icons** come from `scripts/website_icons.py` in the app repo - the same Material
  glyphs, inlined as SVG with `currentColor` so an icon takes its row's colour and the
  palette rules keep applying. Same three sizes, no others.
- **Brand logos** are inline SVG per page rather than `components/BrandLogos.js`.

Its emoji were audited to **zero** the same way the app's were: an emoji that WAS the icon
became a glyph, an emoji leading a label was deleted. `idea-to-video`'s option rows lost
their icon entirely rather than gaining ten invented glyphs - the label and description
already carry the choice, which is how the app's own option sheets read.

**Two conflicts surfaced while doing it, both now settled by the same principle: where
this file and the app disagree, THE APP IS THE REFERENCE** (owner, Sep 18 2026).

- **The bottom tab strip** stays green on both clients, and the colour rule above was
  corrected rather than the code. See it there.
- **Teal is narrower than this file once implied.** Outside the editor almost nothing is
  teal, and that is correct rather than an omission: teal marks the instruments you work
  the footage with, which mostly exist in the editor. On the website only the progress bar
  qualified, and it was green until it was fixed.

**The gradient border is on the website too**, as CSS: a rotating conic gradient behind an
opaque panel inset by the border width, which is the same trick the app plays with a
spinning square. Same stops, same 4.2s, same reduced-motion behaviour.

### Surfaces and text

Backgrounds step darkest-first: `#000` (app, toolbar) → `#0a0a0a` (timeline) →
`#111` (sheets, wells, aux rows) → `#1a1a1a` (chips, clip frames) → `#2a2a2a` (raised).
Borders `#2a2a2a` or `#333`; hairline dividers `#2a2a2a`.

Text: `#fff` primary, `#cfcfcf` toolbar labels, `#888` secondary, `#555` disabled or
inactive, `#5a5a5a` for an unbuilt tool. Destructive `#ff6b6b`. Premium `#f5c451`.

## Context toolbar

The bottom bar is not navigation, it is *what you can do to the thing you have
selected*. Selecting a clip, an audio track or a text overlay replaces the tab strip
with that object's tools. Deselecting restores the tabs.

- Horizontally scrollable, items are **icon above label**, never side by side.
- Item: icon size 20, label `fontSize: 10, fontWeight: '600'`, `gap: 4`,
  `minWidth: 62`, `paddingHorizontal: 10`.
- Related tools are grouped and separated by a **1 × 32 `#2a2a2a` rule**,
  `marginHorizontal: 6`. Order carries the grouping — nothing else does.
- **Every context toolbar ends with a persistent green ✓ Confirm**, 44 × 44,
  `borderRadius: 22`, icon 24 in `#04211f`. It sits **outside** the ScrollView, with
  the scroller on `flex: 1`, because it is how you leave the bar and must never be the
  thing that got scrolled off the end. Do not rely on "tap the object again" as the only
  exit — it is not discoverable.
- Selecting an object must not also open a sheet. The bar is the response to selection;
  a sheet on top of it buries what the tap just summoned.

### Tools that are not built

Show them, dimmed (`#5a5a5a` icon and label), and `Alert.alert(label, 'Coming soon.')`
on tap. Derive the dimming from whether the tool has an action, so wiring one up removes
its dimming automatically:

```js
onPress={toolActions[t.key] || (() => Alert.alert(t.label, 'Coming soon.'))}
color={toolActions[t.key] ? '#e6e6e6' : '#5a5a5a'}
```

Never ship a live-looking control that does nothing, and never mark unbuilt work with a
lock or premium badge — that implies paying would unlock it. Premium-but-unbuilt gets
both: the premium badge *and* the dimming.

## Icons

**Material Icons only. No emoji anywhere in the UI** — that was audited to zero and
should stay there. An emoji standing alone was an icon; an emoji leading a label was
decoration and got deleted.

**Premium is a diamond, never a padlock** — `MaterialIcons` `"diamond"`, premium
gold `#f5c451`, at size 11–14 alongside a dimmed label. A padlock reads as *you are
shut out*; a diamond reads as *this is on a paid plan*. Everything gated in this app
is the second thing. The exception is a lock that genuinely means security rather
than payment (ProfileScreen's Two-Factor Auth row) — that keeps its padlock.

Never mark unbuilt work with a diamond or a lock: that implies paying would unlock
it. Unbuilt is dimmed `#5a5a5a` plus "Coming soon". Premium *and* unbuilt gets both
the diamond and the dimming.

Three sizes, no others:

- **12** — badges drawn on top of content (premium mark, speed badge, chip counts)
- **20** — toolbar items, row icons, sheet headers, list affordances
- **24** — primary actions (Confirm ✓, play/pause)

**Verify every icon name against the installed glyphmap before using it.** A name that
is not in the set renders as a blank square and no build check catches it:

```bash
python3 -c "import json;g=json.load(open('node_modules/expo/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/MaterialIcons.json'));print([n for n in ['NAME'] if n not in g] or 'ok')"
```

When swapping a `<Text>` emoji for an icon, carry its style across if it held layout —
`position: absolute`, a fixed width, a margin — or the screen shifts.

## Sheets

Bottom sheets, never centre dialogs. `modalOverlay` is `rgba(0,0,0,0.7)` with
`justifyContent: 'flex-end'`; `modalSheet` is `#111`, `borderTopLeftRadius: 20`,
`borderTopRightRadius: 20`, `padding: 24`.

Always use `SheetHeader` (`components/SheetHeader.js`) and `useSheetInset()` — every
sheet must be dismissible from its header without hunting for a footer button.

### The system bars are not yours to draw on — a MUST

**Nothing interactive may sit under the Android navigation bar or the gesture pill.**
Reported from a device Sep 26 2026: a sheet's Save button was half-hidden behind the
three navigation buttons, which makes the primary action of that sheet unreachable
without the user scrolling a sheet that does not scroll.

A sheet sits flush against the bottom of the window, so **its own bottom padding is the
only thing holding the last row clear**. That padding cannot be a fixed number - the bar
is a different height on a gesture-nav device, a three-button device and a tall device
with a pill, and a guess is wrong on two of the three.

```js
const sheetInset = useSheetInset(16);            // hook, at the top of the component
<View style={[styles.sheet, sheetInset]}>        // SPREAD into the array
```

**`useSheetInset()` returns a STYLE OBJECT, `{ paddingBottom: n }`, not a number.** The
mistake to know about, because it has been made and it is invisible:

```js
<View style={[styles.sheet, { paddingBottom: sheetInset }]}>   // WRONG
```

That nests an object inside a style property. React Native silently drops it, the sheet
gets no bottom padding at all, and the result is the bug above. **It is valid JS, valid
JSX, passes `eslint --quiet`, passes `expo export` and passes jsxrefs** - nothing static
has an opinion about the shape of a style value, so only a device shows it. Same family
as every other failure this project ships: correct-looking, silent, device-only.

Screens that are not sheets use `useSafeAreaInsets()` and consume `insets.top` /
`insets.bottom` directly; `MyVideosScreen` not consuming `insets.top` is what put its
header under the status bar (item 9).

**The check is one line** whenever a sheet is touched: does its last interactive row
clear the navigation bar on a three-button device? That is the tightest case, since a
button bar is taller than a gesture pill.

Option chips: `borderRadius: 20`, `paddingHorizontal: 14`, `paddingVertical: 8`,
`backgroundColor: '#1a1a1a'`, border `#2a2a2a`; active flips to the green fill with
`#000` text.

A sheet whose contents depend on state should store *which* sheet is open, not a
snapshot of its options, so the options rebuild from live state and cannot show a stale
selection.

## Spinning gradient border

`components/GradientBorder.js` wraps a surface in a border whose gradient slowly turns.
It is the app's one piece of ambient motion, and it exists to make a focal surface feel
alive without anything on it blinking or sliding.

**How it works**, because the mechanism is not obvious and the failure mode is: a large
gradient square spins BEHIND the content, and an opaque panel sits on top inset by the
border width, so the only part of the square anyone sees is the few pixels at the edge.
React Native has no animated border colour; this needs no native module. The square is
sized to the container's **diagonal**, measured with `onLayout` — anything smaller
leaves the corners bare at 45 degrees, which is the one bug this component can have.

**The sweep is violet into pink, on a deep purple ring — deliberately NOT a brand
colour.** That is the point rather than a compromise. Green means *this action commits*
and teal means *you are handling media*; a border wearing either is making a claim about
state it cannot honour, and a green light circling a card that CONTAINS the commit button
spends the one colour that distinguishes it. A hue the app uses for nothing else can only
read as decoration, which is exactly what this is.

The ring is deep purple rather than near-black: on a dark screen a black ring read as a
shadow rather than a border, and the card looked unfinished on three of its four sides.

**It is the app's standard treatment for a bordered CARD.** Sections, stat tiles, video
cards, panels - if a surface is a bordered container of content, it wears this rather
than a static `borderWidth: 1`. Remove the static border when you add it, or the card
carries two.

**It is not for inputs, chips, buttons or rows.** A moving border on a text field
competes with the caret and makes typing feel unstable; on a 30px chip a 1.5px sweep is
noise rather than decoration; and a button already says what it is through its fill, so
a border crawling round it blurs the one thing that was clear. Those keep their static
borders.

**One clock drives all of them.** The spin is a single module-level shared value started
by whichever border mounts first, so twenty on a screen cost the same as one - and they
all turn in step, which reads as deliberate rather than as twenty separate animations.
Each instance still needs its own gradient id: two SVGs sharing one resolve to whichever
the renderer saw last, and a screen of borders would all wear the first one's colours.

**The gradient needs a dark majority.** The first version was three light teals and
symmetric; rotating a symmetric gradient by 180 degrees returns an identical image, so
it read as completely static on a square card and only looked alive on a tall one where
the aspect ratio broke the symmetry. The eye needs one bright band it can follow around
a dark ring.

Defaults: `radius: 16`, `width: 1.5`, `SPIN_MS: 4200`. The spin is deliberately slow —
faster reads as a loading spinner, which is a different promise entirely.

Honours Reduce Motion by holding still. A border that never stops moving is exactly what
that setting exists to switch off.

## Timeline geometry

`PIXELS_PER_SECOND = 40`. Clip row is `CLIP_H = 56` (+6 padding each side); aux rows
are 26 high with `marginTop: 4`.

**Nothing in the clips row may take horizontal space that is not time.** A fixed-width
chip, a margin, or an inline button each pushes every later clip out of sync with the
playhead, and the error accumulates. Seams between clips and transition markers are
painted on a layer *over* the row, never laid out between clips.

Row-level controls that must stay reachable (the add buttons) live outside the
ScrollView, pinned, and are positioned from each row's **measured** frame rather than a
table of row heights — a row is only as tall as whatever chip is on it.

## Captions

**138 styles across 13 categories** in `constants/captionStyles.js` — hand-written and
safe to edit. A style is a spec of typographic parts (face, fill or gradient, stroke,
glow, shadow, box, tracking, case, scale, cadence), not a set of flags. One renderer,
`components/CaptionText.js`, interprets the spec, and the picker swatch and the video
canvas are that same component at two sizes so a preview cannot drift from the canvas.

The original ids (`tiktok`, `bold`, `neon`, `fire`, `sticker`, `shadow3d`, `highlight`,
`outline`, `cinematic`, `minimal`, `purple`) are still there, restyled but deliberately
not renamed, so projects saved before the catalogue resolve.

**Every part of a caption style is a multiple of the font size, scaled by `size / 18`** —
tracking, stroke width, glow radius, shadow offset *and* blur, chip padding *and* corner
radius. The export scales by exactly that, so anything left fixed matches at size 18 and
nowhere else. When adding a part to a style the question is not whether it looks right,
it is whether it is scaled.

## Copy

Sentence case. Name what the control does, in the user's terms: "Add voiceover", not
"Attach TTS asset". An action keeps its name through the flow. Errors say what happened
and what to do, never apologise, never go vague. An empty row names what it is for —
that is why the empty-state button stays at the head of each timeline row even though a
floating add button exists.
