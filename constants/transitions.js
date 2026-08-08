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
