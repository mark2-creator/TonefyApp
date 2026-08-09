// The transition catalogue.
//
// A transition is a RECIPE, not a name: an ffmpeg xfade `base` plus an optional `fx`
// chain that is gated to the transition's own window. That is what makes a hundred of
// them distinct rather than fifty-eight renamed twice - "Whip Left" is not a relabelled
// slideleft, it is slideleft with a heavy blur ramped across the join, and it reads as
// a different thing on screen.
//
// The app sends this recipe with the clip, so the server holds no copy of the
// catalogue and a transition added here renders without a backend deploy. Same
// arrangement the caption styles use, and for the same reason: two lists drift.
//
// This file is pure data with no imports, deliberately - scripts/gen-transition-previews.mjs
// imports it directly to render the previews, so it must load outside React Native.
//
// `fx` entries are ffmpeg filter strings. Each gets :enable='between(t,start,end)'
// appended by whoever builds the chain, so the effect exists only across the join and
// the rest of the video is untouched.

const BASE = [
  // --- Dissolves
  ['fade',        'Fade',            'Basic'],
  ['fadefast',    'Fade Fast',       'Basic'],
  ['fadeslow',    'Fade Slow',       'Basic'],
  ['dissolve',    'Dissolve',        'Basic'],
  ['fadeblack',   'Fade Black',      'Basic'],
  ['fadewhite',   'Fade White',      'Basic'],
  ['fadegrays',   'Fade Grays',      'Basic'],
  ['distance',    'Distance',        'Basic'],
  // --- Slides: the incoming frame pushes the outgoing one off
  ['slideleft',   'Slide Left',      'Slide'],
  ['slideright',  'Slide Right',     'Slide'],
  ['slideup',     'Slide Up',        'Slide'],
  ['slidedown',   'Slide Down',      'Slide'],
  ['smoothleft',  'Smooth Left',     'Slide'],
  ['smoothright', 'Smooth Right',    'Slide'],
  ['smoothup',    'Smooth Up',       'Slide'],
  ['smoothdown',  'Smooth Down',     'Slide'],
  ['squeezeh',    'Squeeze Wide',    'Slide'],
  ['squeezev',    'Squeeze Tall',    'Slide'],
  // --- Covers and reveals: one frame travels, the other stays
  ['coverleft',   'Cover Left',      'Cover'],
  ['coverright',  'Cover Right',     'Cover'],
  ['coverup',     'Cover Up',        'Cover'],
  ['coverdown',   'Cover Down',      'Cover'],
  ['revealleft',  'Reveal Left',     'Cover'],
  ['revealright', 'Reveal Right',    'Cover'],
  ['revealup',    'Reveal Up',       'Cover'],
  ['revealdown',  'Reveal Down',     'Cover'],
  // --- Wipes: a hard edge crosses the frame
  ['wipeleft',    'Wipe Left',       'Wipe'],
  ['wiperight',   'Wipe Right',      'Wipe'],
  ['wipeup',      'Wipe Up',         'Wipe'],
  ['wipedown',    'Wipe Down',       'Wipe'],
  ['wipetl',      'Wipe Top Left',   'Wipe'],
  ['wipetr',      'Wipe Top Right',  'Wipe'],
  ['wipebl',      'Wipe Btm Left',   'Wipe'],
  ['wipebr',      'Wipe Btm Right',  'Wipe'],
  ['diagtl',      'Diagonal TL',     'Wipe'],
  ['diagtr',      'Diagonal TR',     'Wipe'],
  ['diagbl',      'Diagonal BL',     'Wipe'],
  ['diagbr',      'Diagonal BR',     'Wipe'],
  // --- Slices and wind: the frame breaks into bands
  ['hlslice',     'Slice Left',      'Slice'],
  ['hrslice',     'Slice Right',     'Slice'],
  ['vuslice',     'Slice Up',        'Slice'],
  ['vdslice',     'Slice Down',      'Slice'],
  ['hlwind',      'Wind Left',       'Slice'],
  ['hrwind',      'Wind Right',      'Slice'],
  ['vuwind',      'Wind Up',         'Slice'],
  ['vdwind',      'Wind Down',       'Slice'],
  // --- Shapes: a geometric mask opens or closes
  ['circleopen',  'Circle Open',     'Shape'],
  ['circleclose', 'Circle Close',    'Shape'],
  ['circlecrop',  'Circle Crop',     'Shape'],
  ['rectcrop',    'Rect Crop',       'Shape'],
  ['vertopen',    'Vertical Open',   'Shape'],
  ['vertclose',   'Vertical Close',  'Shape'],
  ['horzopen',    'Horizontal Open', 'Shape'],
  ['horzclose',   'Horizontal Close','Shape'],
  ['radial',      'Radial',          'Shape'],
  // --- Optical
  ['pixelize',    'Pixelize',        'Optical'],
  ['hblur',       'Blur Cross',      'Optical'],
  ['zoomin',      'Zoom In',         'Optical'],
];

// A composed transition is a base plus a character layer. Each of these reads as its
// own effect, not as a variant - which is the whole test for whether it earns a place
// in the list.
const COMPOSED = [
  // --- Whip pans: the blur is what sells the speed
  ['whipleft',    'Whip Left',       'Motion',    'slideleft',  ['gblur=sigma=24']],
  ['whipright',   'Whip Right',      'Motion',    'slideright', ['gblur=sigma=24']],
  ['whipup',      'Whip Up',         'Motion',    'slideup',    ['gblur=sigma=24']],
  ['whipdown',    'Whip Down',       'Motion',    'slidedown',  ['gblur=sigma=24']],
  ['whipsoft',    'Whip Soft',       'Motion',    'smoothleft', ['gblur=sigma=12']],
  ['rush',        'Rush',            'Motion',    'zoomin',     ['gblur=sigma=18']],
  ['punch',       'Zoom Punch',      'Motion',    'zoomin',     ['eq=contrast=1.4:brightness=0.06']],
  ['warpspeed',   'Warp Speed',      'Motion',    'zoomin',     ['gblur=sigma=30', 'eq=brightness=0.1']],
  ['driftleft',   'Drift Left',      'Motion',    'smoothleft', ['gblur=sigma=6']],
  ['driftright',  'Drift Right',     'Motion',    'smoothright',['gblur=sigma=6']],
  ['tumble',      'Tumble',          'Motion',    'squeezev',   ['gblur=sigma=10']],
  ['shove',       'Shove',           'Motion',    'coverleft',  ['gblur=sigma=14']],
  // --- Light: flashes, leaks and blooms
  ['flashwhite',  'Flash White',     'Light',     'fadewhite',  ['eq=brightness=0.35']],
  ['flashhard',   'Hard Flash',      'Light',     'fadefast',   ['eq=brightness=0.5:contrast=1.2']],
  ['flashblack',  'Flash Black',     'Light',     'fadeblack',  ['eq=brightness=-0.3']],
  ['lightleak',   'Light Leak',      'Light',     'fadewhite',  ['colorbalance=rs=0.35:gs=0.12:bs=-0.2', 'eq=brightness=0.12']],
  ['sunburst',    'Sunburst',        'Light',     'radial',     ['colorbalance=rs=0.4:gs=0.2:bs=-0.25', 'eq=brightness=0.18']],
  ['bloom',       'Bloom',           'Light',     'fade',       ['gblur=sigma=10', 'eq=brightness=0.18:contrast=1.15']],
  ['halation',    'Halation',        'Light',     'dissolve',   ['gblur=sigma=8', 'colorbalance=rs=0.25:bs=-0.1']],
  ['overexpose',  'Overexpose',      'Light',     'fadewhite',  ['eq=brightness=0.45:saturation=0.4']],
  ['emberglow',   'Ember Glow',      'Light',     'fadegrays',  ['colorbalance=rs=0.45:gs=0.15:bs=-0.3', 'vignette']],
  ['moonlight',   'Moonlight',       'Light',     'fadeblack',  ['colorbalance=rs=-0.2:bs=0.35', 'eq=brightness=-0.08']],
  // --- Glitch and digital
  ['glitch',      'Glitch',          'Glitch',    'pixelize',   ['rgbashift=rh=-14:bh=14']],
  ['glitchhard',  'Hard Glitch',     'Glitch',    'hlslice',    ['rgbashift=rh=-24:bh=24', 'noise=alls=22:allf=t']],
    // pixelize=0 was rejected as out of range - its width must be >= 1. Rebuilt from
  // shift and noise, which carry the look without a size to get wrong.
  ['datamosh',    'Datamosh',        'Glitch',    'dissolve',   ['rgbashift=rv=-14:bv=14:rh=6:bh=-6', 'noise=alls=20:allf=t', 'gblur=sigma=4']],
  ['rgbsplit',    'RGB Split',       'Glitch',    'fade',       ['rgbashift=rh=-20:bh=20']],
  ['scanline',    'Scanline',        'Glitch',    'vdslice',    ['rgbashift=rv=-8:bv=8', 'eq=contrast=1.25']],
  ['staticcut',   'Static',          'Glitch',    'fadegrays',  ['noise=alls=40:allf=t', 'eq=contrast=1.3']],
  ['vhs',         'VHS',             'Glitch',    'hrslice',    ['chromashift=cbh=8:crh=-8', 'noise=alls=18:allf=t', 'eq=saturation=1.3']],
  ['signalloss',  'Signal Loss',     'Glitch',    'fadeblack',  ['noise=alls=50:allf=t', 'eq=brightness=-0.15']],
  ['pixelburst',  'Pixel Burst',     'Glitch',    'pixelize',   ['eq=contrast=1.35:saturation=1.4']],
  ['invert',      'Invert Flash',    'Glitch',    'fadefast',   ['negate']],
  // --- Cinematic grades
  ['filmburn',    'Film Burn',       'Cinematic', 'fadegrays',  ['colorbalance=rs=0.4:gs=0.1:bs=-0.35', 'vignette', 'noise=alls=12:allf=t']],
  ['noir',        'Noir',            'Cinematic', 'fadeblack',  ['hue=s=0', 'eq=contrast=1.4']],
  ['bleach',      'Bleach Bypass',   'Cinematic', 'fade',       ['eq=saturation=0.25:contrast=1.45:brightness=0.08']],
  ['sepia',       'Sepia Drift',     'Cinematic', 'dissolve',   ['colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131']],
  ['teal',        'Teal & Orange',   'Cinematic', 'fade',       ['colorbalance=rs=0.3:bs=0.25:rm=-0.1:bm=0.15', 'eq=contrast=1.2']],
  ['coldopen',    'Cold Open',       'Cinematic', 'fadeblack',  ['colorbalance=rs=-0.25:bs=0.35', 'eq=contrast=1.25']],
  ['goldenhour',  'Golden Hour',     'Cinematic', 'smoothright',['colorbalance=rs=0.35:gs=0.18:bs=-0.25', 'eq=saturation=1.2']],
  ['fadedfilm',   'Faded Film',      'Cinematic', 'dissolve',   ['eq=contrast=0.8:brightness=0.1:saturation=0.7', 'noise=alls=10:allf=t']],
  ['vignetteout', 'Vignette Out',    'Cinematic', 'circleclose',['vignette', 'eq=brightness=-0.1']],
  ['irisin',      'Iris In',         'Cinematic', 'circleopen', ['vignette']],
  ['smoke',       'Smoke',           'Cinematic', 'hblur',      ['gblur=sigma=14', 'eq=saturation=0.6']],
  ['nightfall',   'Nightfall',       'Cinematic', 'fadeblack',  ['eq=brightness=-0.2:saturation=0.7', 'vignette']],
  // --- Dreamy and soft
  ['dream',       'Dream',           'Dream',     'dissolve',   ['gblur=sigma=16', 'eq=brightness=0.1:saturation=1.15']],
  ['softfocus',   'Soft Focus',      'Dream',     'fade',       ['gblur=sigma=9']],
  ['haze',        'Haze',            'Dream',     'fadewhite',  ['gblur=sigma=12', 'eq=contrast=0.85:brightness=0.15']],
  ['ripple',      'Ripple',          'Dream',     'radial',     ['gblur=sigma=7', 'chromashift=cbh=6:crh=-6']],
  ['heathaze',    'Heat Haze',       'Dream',     'smoothleft', ['chromashift=cbv=7:crv=-7', 'gblur=sigma=5']],
  ['watercolour', 'Watercolour',     'Dream',     'dissolve',   ['gblur=sigma=11', 'eq=saturation=1.35:contrast=0.9']],
  ['ghost',       'Ghost',           'Dream',     'fadegrays',  ['gblur=sigma=13', 'eq=brightness=0.12:saturation=0.4']],
  ['prism',       'Prism',           'Dream',     'fade',       ['rgbashift=rh=-10:bh=10', 'gblur=sigma=6', 'eq=saturation=1.3']],
  // --- Punchy / social
  ['neon',        'Neon',            'Punch',     'fade',       ['eq=saturation=1.9:contrast=1.3', 'colorbalance=bs=0.25']],
  ['saturate',    'Saturate',        'Punch',     'fadefast',   ['eq=saturation=2.0']],
  ['crush',       'Crush',           'Punch',     'fade',       ['eq=contrast=1.7:brightness=-0.06']],
  ['popleft',     'Pop Left',        'Punch',     'coverleft',  ['eq=saturation=1.5:contrast=1.2']],
  ['popup',       'Pop Up',          'Punch',     'coverup',    ['eq=saturation=1.5:contrast=1.2']],
  ['strobe',      'Strobe',          'Punch',     'fadewhite',  ['eq=brightness=0.4:contrast=1.5']],
  ['acid',        'Acid',            'Punch',     'dissolve',   ['hue=h=90', 'eq=saturation=1.8']],
  ['duotone',     'Duotone',         'Punch',     'fade',       ['hue=s=0', 'colorbalance=rs=0.4:bs=0.4']],
  ['sharpcut',    'Sharp Cut',       'Punch',     'fadefast',   ['unsharp=5:5:1.6']],
  ['blast',       'Blast',           'Punch',     'circleopen', ['eq=brightness=0.25:contrast=1.4', 'gblur=sigma=8']],
  // --- Shaped and graphic
  ['spotlight',   'Spotlight',       'Graphic',   'circleopen', ['eq=brightness=0.15', 'vignette']],
  ['keyhole',     'Keyhole',         'Graphic',   'circlecrop', ['vignette']],
  ['boxin',       'Box In',          'Graphic',   'rectcrop',   ['eq=contrast=1.15']],
  ['shutter',     'Shutter',         'Graphic',   'vertopen',   ['eq=contrast=1.2']],
  ['blinds',      'Blinds',          'Graphic',   'horzopen',   ['eq=contrast=1.2']],
  ['split',       'Split',           'Graphic',   'vertclose',  ['gblur=sigma=6']],
  ['fold',        'Fold',            'Graphic',   'squeezeh',   ['gblur=sigma=8']],
  ['shred',       'Shred',           'Graphic',   'hlwind',     ['eq=contrast=1.25']],
  ['comb',        'Comb',            'Graphic',   'vuslice',    ['eq=contrast=1.2', 'gblur=sigma=4']],
  ['mosaic',      'Mosaic',          'Graphic',   'pixelize',   ['eq=saturation=1.25']],
  ['crosshatch',  'Crosshatch',      'Graphic',   'diagtl',     ['eq=contrast=1.3']],
  ['origami',     'Origami',         'Graphic',   'diagbr',     ['gblur=sigma=7', 'eq=contrast=1.15']],
];

// Free covers every xfade primitive - all 58 of them, which is a complete set of
// plain transitions and enough to finish a video with. Premium is the composed tier:
// the ones carrying a grade, a blur, grain or a shift on top of the move, which are
// the ones that read as produced rather than as a default.
//
// The split is by what a transition IS rather than by a hand-picked list, so a
// composition added later is premium without anyone remembering to mark it.
export const TRANSITIONS = [
  // "None" is a real choice and has to be in the list to be choosable. It is not a
  // transition with a zero duration - the concat gives it the shortest join it can,
  // which is a cut.
  { id: 'none', label: 'None', group: 'Basic', base: null, fx: [], premium: false },
  ...BASE.map(([id, label, group]) => ({ id, label, group, base: id, fx: [], premium: false })),
  ...COMPOSED.map(([id, label, group, base, fx]) => ({ id, label, group, base, fx, premium: true })),
];

export const TRANSITION_GROUPS = [
  'Basic', 'Motion', 'Light', 'Cinematic', 'Dream', 'Punch',
  'Glitch', 'Slide', 'Cover', 'Wipe', 'Slice', 'Shape', 'Graphic', 'Optical',
];

const BY_ID = new Map(TRANSITIONS.map(t => [t.id, t]));

/** The recipe for an id, or Fade for anything the catalogue no longer knows. */
export function resolveTransition(id) {
  if (!id) return BY_ID.get('none');
  // Clips were written with 'None' capitalised for as long as this screen has
  // existed, and the catalogue's id is lowercase. Unmatched ids fall through to Fade,
  // so every clip that had NO transition was exporting with one. Normalising here
  // covers the sessions already carrying the old value, not just new clips.
  const key = String(id).toLowerCase();
  if (key === 'none') return BY_ID.get('none');
  return BY_ID.get(key) || BY_ID.get('fade');
}

/** Whether a clip actually has a transition on its right edge. */
export function hasTransition(id) {
  return !!resolveTransition(id)?.base;
}

/** What travels to the server with a clip. Null for a hard cut. */
export function transitionSpec(id) {
  const t = resolveTransition(id);
  if (!t || !t.base) return null;
  return { base: t.base, fx: t.fx };
}

/** Whether an id needs a paid plan. Unknown ids resolve to Fade, which is free. */
export function isPremiumTransition(id) {
  return !!resolveTransition(id)?.premium;
}

// ---------------------------------------------------------------------------
// Preview motion
// ---------------------------------------------------------------------------

// How a join should look on the canvas at progress `p` (0 at the start of the
// transition window, 1 at the end), as two layers plus an optional tint.
//
// The canvas can show a transition properly because it draws the outgoing and
// incoming clips as two stacked layers - the same two inputs xfade gets. What it
// cannot do is reproduce 133 ffmpeg filters, so this maps a base onto the motion
// that defines it and accepts an honest approximation everywhere else:
//
//  - the moves (slide, cover, reveal, squeeze, zoom) are exact, because a translate
//    or a scale is the whole effect
//  - the dips (fade to black/white) are exact
//  - the masked ones (wipes, slices, shapes) fall back to a dissolve. A wipe needs a
//    hard edge travelling across one layer, which means a mask, and RN has no mask
//    without another native dependency
//  - the graded ones (Film Burn, VHS, Glitch) show their move and their tint but not
//    their grain or channel shifts
//
// Offsets are FRACTIONS of the frame so this stays free of layout, and the screen
// multiplies by its own width and height.
//
// A caller that wants to know how faithful this is can ask `previewFidelity(base)`.

const SLIDE = { slideleft: [1, 0], slideright: [-1, 0], slideup: [0, 1], slidedown: [0, -1] };
const SMOOTH = { smoothleft: [1, 0], smoothright: [-1, 0], smoothup: [0, 1], smoothdown: [0, -1] };
const COVER = { coverleft: [1, 0], coverright: [-1, 0], coverup: [0, 1], coverdown: [0, -1] };
const REVEAL = { revealleft: [-1, 0], revealright: [1, 0], revealup: [0, -1], revealdown: [0, 1] };

const IDLE = { opacity: 1, tx: 0, ty: 0, scale: 1 };

// A hard-edged reveal, described as a clip region in fractions of the frame.
//
// This is the part that was missing. A wipe is not a fade - it is one frame appearing
// through a growing window with a hard edge, and RN draws that with a container that
// has overflow hidden and a child positioned so it does NOT move while the container
// grows. Same mechanism gives circles, boxes and the open/close pairs. Falling back to
// a dissolve for all of them is what made most of the catalogue look identical and
// cheap on the canvas while the export looked like the thing it is.
//
// Returns null when the transition is not a masked one.
const WIPE_EDGE = {
  // [axis, fromStart] - which way the window opens
  wipeleft: ['x', true], wiperight: ['x', false],
  wipeup: ['y', true], wipedown: ['y', false],
};

function maskFor(base, t) {
  if (WIPE_EDGE[base]) {
    const [axis, fromStart] = WIPE_EDGE[base];
    if (axis === 'x') {
      return { type: 'rect', x: fromStart ? 0 : 1 - t, y: 0, w: t, h: 1 };
    }
    return { type: 'rect', x: 0, y: fromStart ? 0 : 1 - t, w: 1, h: t };
  }
  switch (base) {
    // The circle grows past the corner, so the last of the outgoing frame is gone
    // before the window stops - r reaches the half-diagonal, not the half-width.
    case 'circleopen':
    case 'circlecrop':
      return { type: 'circle', cx: 0.5, cy: 0.5, r: t * 0.75 };
    case 'circleclose':
      return { type: 'circle', cx: 0.5, cy: 0.5, r: (1 - t) * 0.75, invert: true };
    case 'rectcrop':
      return { type: 'rect', x: 0.5 - t / 2, y: 0.5 - t / 2, w: t, h: t };
    // Opening from the centre line outwards, and closing in from the edges.
    case 'horzopen':
      return { type: 'rect', x: 0, y: 0.5 - t / 2, w: 1, h: t };
    case 'vertopen':
      return { type: 'rect', x: 0.5 - t / 2, y: 0, w: t, h: 1 };
    // horzclose and vertclose close IN from both edges, which is two bands with a
    // shrinking gap - two mask regions, not one. Left to the dissolve rather than
    // rendered as a single rect, which would just show the whole incoming frame.
    // The corner wipes are a box growing out of one corner.
    case 'wipetl': return { type: 'rect', x: 0, y: 0, w: t, h: t };
    case 'wipetr': return { type: 'rect', x: 1 - t, y: 0, w: t, h: t };
    case 'wipebl': return { type: 'rect', x: 0, y: 1 - t, w: t, h: t };
    case 'wipebr': return { type: 'rect', x: 1 - t, y: 1 - t, w: t, h: t };
    default:
      return null;
  }
}

export function transitionPreviewFrame(base, p) {
  const t = Math.max(0, Math.min(1, p));
  const out = { ...IDLE };
  const inc = { ...IDLE, opacity: 1 };
  let tint = null;

  // A masked transition reveals the incoming frame through a window instead of
  // fading it, so neither layer moves and neither changes opacity.
  const mask = maskFor(base, t);
  if (mask) return { out, inc, tint, mask };

  // Both frames travel: the outgoing leaves as the incoming arrives, which is what
  // makes a slide read as one movement rather than two.
  if (SLIDE[base] || SMOOTH[base]) {
    const [dx, dy] = SLIDE[base] || SMOOTH[base];
    inc.tx = dx * (1 - t); inc.ty = dy * (1 - t);
    out.tx = -dx * t;      out.ty = -dy * t;
    return { out, inc, tint };
  }
  // The incoming slides over an outgoing that stays put.
  if (COVER[base]) {
    const [dx, dy] = COVER[base];
    inc.tx = dx * (1 - t); inc.ty = dy * (1 - t);
    return { out, inc, tint };
  }
  // The outgoing slides away and uncovers an incoming that was always there.
  if (REVEAL[base]) {
    const [dx, dy] = REVEAL[base];
    out.tx = dx * t; out.ty = dy * t;
    return { out, inc, tint };
  }

  switch (base) {
    case 'fadeblack':
    case 'fadegrays':
      // Through black rather than between the two: the outgoing is gone before the
      // incoming appears, which is the whole character of it.
      out.opacity = Math.max(0, 1 - t * 2);
      inc.opacity = Math.max(0, t * 2 - 1);
      tint = { color: '#000000', opacity: 1 - Math.abs(t - 0.5) * 2 };
      return { out, inc, tint };
    case 'fadewhite':
      out.opacity = Math.max(0, 1 - t * 2);
      inc.opacity = Math.max(0, t * 2 - 1);
      tint = { color: '#ffffff', opacity: 1 - Math.abs(t - 0.5) * 2 };
      return { out, inc, tint };
    case 'zoomin':
      inc.scale = 1 + 0.35 * (1 - t);
      inc.opacity = t;
      return { out, inc, tint };
    case 'squeezeh':
      inc.scale = 1; out.scale = 1;
      inc.opacity = t;
      out.ty = -0.5 * t;
      return { out, inc, tint };
    case 'squeezev':
      inc.opacity = t;
      out.tx = -0.5 * t;
      return { out, inc, tint };
    case 'distance':
      inc.opacity = t;
      inc.scale = 1 + 0.12 * (1 - t);
      out.scale = 1 - 0.12 * t;
      return { out, inc, tint };
    default:
      // Dissolve. Correct for the fade family, and the honest stand-in for every
      // masked one - it says "these two frames are changing over" without pretending
      // to an edge shape it cannot draw.
      inc.opacity = t;
      return { out, inc, tint };
  }
}

const EXACT = new Set([
  ...Object.keys(SLIDE), ...Object.keys(SMOOTH), ...Object.keys(COVER), ...Object.keys(REVEAL),
  'fade', 'fadefast', 'fadeslow', 'dissolve', 'fadeblack', 'fadewhite', 'fadegrays',
  'zoomin', 'distance',
  // Masked reveals, drawn with a real hard edge rather than a dissolve.
  ...Object.keys(WIPE_EDGE),
  'circleopen', 'circleclose', 'circlecrop', 'rectcrop',
  'horzopen', 'vertopen', 'wipetl', 'wipetr', 'wipebl', 'wipebr',
]);

/** 'exact' if the canvas can really draw this one, 'approx' if it is standing in. */
export function previewFidelity(id) {
  const def = resolveTransition(id);
  if (!def?.base) return 'exact';
  // A composed transition carries a grade or grain the canvas cannot reproduce, even
  // when its underlying move is one of the exact ones.
  if (def.fx && def.fx.length) return 'approx';
  return EXACT.has(def.base) ? 'exact' : 'approx';
}
