import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import { fontFamilyFor } from '../constants/fonts';
import { captionFill, captionHighlight } from '../constants/captionStyles';

// One renderer for every caption style. The old code branched per style id inside
// the overlay component, which meant a new look needed renderer code and the
// picker's swatch and the video canvas drew the same style by two different code
// paths - they drifted. Here the spec is the only input, and the swatch and the
// canvas are the same component at different sizes, so what you pick is what you
// get.
//
// React Native gives text one shadow and no stroke, so both are built out of
// stacked copies of the same string, absolutely positioned over each other:
//
//   highlight chip -> shadow -> glow -> stroke ring -> fill
//
// The chip goes at the bottom for the same reason it is a whole extra copy of the
// string rather than a background on the fill: paint it on the fill and it covers
// the stroke ring of the word it is meant to sit behind.
//
// Every copy is stretched to the wrapper's box (left/right/top/bottom 0) and
// displaced with `transform` rather than being offset with `left`/`top`. An
// absolutely positioned Text with no width shrink-wraps and re-wraps its own
// lines, which would put the outline's line breaks in different places from the
// fill's; stretching pins all the copies to one identical layout.

// Eight points around the glyph. The diagonals are pulled in by √2 so the corners
// of the ring sit on the same circle as the sides rather than bulging past them.
const DIAG = 0.7071;
const STROKE_OFFSETS = [
  [-1, 0], [1, 0], [0, -1], [0, 1],
  [-DIAG, -DIAG], [DIAG, -DIAG], [-DIAG, DIAG], [DIAG, DIAG],
];

function clamp255(n) { return Math.max(0, Math.min(255, Math.round(n))); }

function parseHex(hex) {
  const h = String(hex || '').replace('#', '');
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  return {
    r: parseInt(full.slice(0, 2), 16) || 0,
    g: parseInt(full.slice(2, 4), 16) || 0,
    b: parseInt(full.slice(4, 6), 16) || 0,
  };
}

function mixHex(from, to, t) {
  const a = parseHex(from);
  const b = parseHex(to);
  const c = [
    clamp255(a.r + (b.r - a.r) * t),
    clamp255(a.g + (b.g - a.g) * t),
    clamp255(a.b + (b.b - a.b) * t),
  ];
  return '#' + c.map(n => n.toString(16).padStart(2, '0')).join('');
}

// Split on whitespace but keep it, so the runs can be reassembled into exactly the
// original string. A chip drawn over runs that dropped their spaces would sit at
// the wrong x once there was more than one word.
function splitRuns(text) {
  return String(text || '').split(/(\s+)/).filter(r => r !== '');
}

// Which run is the nth word. Whitespace runs are not words, so the caller's word
// index has to be mapped through the run list rather than used on it directly.
function runIndexOfWord(runs, wordIndex) {
  if (wordIndex < 0) return -1;
  let w = -1;
  for (let i = 0; i < runs.length; i++) {
    if (!/^\s+$/.test(runs[i])) {
      w += 1;
      if (w === wordIndex) return i;
    }
  }
  return -1;
}

// The chip layer: every run invisible except the one being spoken, which is
// painted as a background behind transparent glyphs. React Native ignores padding
// on a nested Text, so the chip hugs the word - a thin space at each end buys the
// bit of breathing room that `padX` gets in the export, where the box is drawn
// with real geometry.
const THIN = '\u2009';

function HighlightRun({ runs, activeRun, color }) {
  return runs.map((r, i) => (
    <Text
      key={i}
      style={i === activeRun
        ? { color: 'transparent', backgroundColor: color }
        : { color: 'transparent' }}
    >{r}</Text>
  ));
}

// The fill, with the spoken word recoloured so it stays legible on its chip. Fed
// the same runs as the chip layer, so the two agree on where the word starts.
function FillRuns({ runs, activeRun, activeColor }) {
  return runs.map((r, i) => (
    i === activeRun && activeColor
      ? <Text key={i} style={{ color: activeColor }}>{r}</Text>
      : <Text key={i}>{r}</Text>
  ));
}

// A gradient across a line of text needs either a mask or an SVG text node, and
// this app has neither dependency - adding one would mean a new native build for
// a fill colour. Colouring each character its own step along the ramp needs
// nothing but nested Text, keeps the real font, wraps normally, and at caption
// size reads as a gradient. The export renders the same two stops as a true
// continuous ramp in ImageMagick, which is if anything the smoother of the two.
function GradientRun({ text, from, to }) {
  const chars = useMemo(() => Array.from(text || ''), [text]);
  const last = Math.max(1, chars.length - 1);
  return chars.map((ch, i) => (
    <Text key={i} style={{ color: mixHex(from, to, i / last) }}>{ch}</Text>
  ));
}

// Layer copies must not carry the fill's colour or shadow, only its metrics.
function metricsOf(base) {
  return {
    fontSize: base.fontSize,
    fontFamily: base.fontFamily,
    fontWeight: base.fontWeight,
    letterSpacing: base.letterSpacing,
    textAlign: base.textAlign,
  };
}

const STRETCH = { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 };

// The metrics a style resolves to at a given size. Exported because the on-canvas
// editor lays a transparent TextInput over the rendered caption and its caret is
// only in the right place if it wraps and tracks identically - two definitions of
// "what this style measures" would drift the moment either changed.
export function captionMetrics(style, size, align = 'center') {
  const family = fontFamilyFor(style && style.font);
  return {
    fontSize: size,
    ...(family ? { fontFamily: family } : { fontWeight: 'bold' }),
    ...(style && style.spacing ? { letterSpacing: style.spacing * (size / 18) } : null),
    textAlign: align,
  };
}

function CaptionText({
  style, text, size, color, align = 'center', maxWidth, boxStyle, numberOfLines,
  activeWord = -1,
}) {
  const raw = style.upper ? String(text || '').toUpperCase() : String(text || '');
  const hl = captionHighlight(style);

  // The chip widens the word it sits behind, so the padding has to be baked into
  // the string every layer is laid out from - not added by the chip layer alone,
  // which would leave the stroke ring tracing the unpadded text underneath it.
  const { runs, activeRun, shown } = useMemo(() => {
    if (!hl || activeWord < 0) return { runs: null, activeRun: -1, shown: raw };
    const split = splitRuns(raw);
    const at = runIndexOfWord(split, activeWord);
    if (at < 0) return { runs: null, activeRun: -1, shown: raw };
    const padded = split.map((r, i) => (i === at ? THIN + r + THIN : r));
    return { runs: padded, activeRun: at, shown: padded.join('') };
  }, [raw, hl, activeWord]);

  const fill = captionFill(style, color);
  const strokeW = style.stroke ? Math.max(0.5, style.stroke.width * (size / 18)) : 0;

  // A loaded family already carries the weight it was downloaded at, and asking
  // Android to synthesise more on top of a single registered face is what makes a
  // custom font silently fall back to the system one. No lineHeight either: a
  // fixed one clips the display faces with deep descenders.
  const base = captionMetrics(style, size, align);
  const metrics = metricsOf(base);
  // Passed to every layer, never to one: a line limit that clipped the fill but
  // not the outline would leave the outline of a word the fill no longer shows.
  const lines = numberOfLines || undefined;

  const body = (
    <View style={maxWidth ? { maxWidth } : null}>
      {activeRun >= 0 ? (
        <Text allowFontScaling={false} numberOfLines={lines} style={[STRETCH, metrics]}>
          <HighlightRun runs={runs} activeRun={activeRun} color={hl.color} />
        </Text>
      ) : null}

      {style.shadow ? (
        <Text
          allowFontScaling={false}
          numberOfLines={lines}
          style={[
            STRETCH, metrics,
            {
              color: style.shadow.color,
              textShadowColor: style.shadow.color,
              textShadowOffset: { width: 0, height: 0 },
              textShadowRadius: style.shadow.radius || 0,
              transform: [
                { translateX: (style.shadow.dx || 0) * (size / 18) },
                { translateY: (style.shadow.dy || 0) * (size / 18) },
              ],
            },
          ]}
        >{shown}</Text>
      ) : null}

      {/* Two passes: one soft halo reads as a dim smudge at caption size, and
          stacking is cheaper than a larger radius, which spreads the same ink
          thinner rather than making it brighter. */}
      {style.glow ? [0, 1].map(i => (
        <Text
          key={'glow' + i}
          allowFontScaling={false}
          numberOfLines={lines}
          style={[
            STRETCH, metrics,
            {
              color: style.glow.color,
              textShadowColor: style.glow.color,
              textShadowOffset: { width: 0, height: 0 },
              textShadowRadius: (style.glow.radius || 8) * (size / 18),
            },
          ]}
        >{shown}</Text>
      )) : null}

      {style.stroke ? STROKE_OFFSETS.map(([dx, dy], i) => (
        <Text
          key={'stroke' + i}
          allowFontScaling={false}
          numberOfLines={lines}
          style={[
            STRETCH, metrics,
            {
              color: style.stroke.color,
              transform: [{ translateX: dx * strokeW }, { translateY: dy * strokeW }],
            },
          ]}
        >{shown}</Text>
      )) : null}

      <Text allowFontScaling={false} numberOfLines={lines} style={[base, { color: fill.color }]}>
        {fill.gradient
          ? <GradientRun text={shown} from={fill.gradient[0]} to={fill.gradient[1]} />
          : activeRun >= 0
            ? <FillRuns runs={runs} activeRun={activeRun} activeColor={hl.textColor} />
            : shown}
      </Text>
    </View>
  );

  // The chip hugs the text rather than the caption's own 80%-width column, so a
  // three-word caption does not sit in a box the width of the frame.
  if (style.box) {
    return (
      <View
        style={[
          {
            alignSelf: align === 'center' ? 'center' : 'flex-start',
            backgroundColor: style.box.color,
            borderRadius: style.box.radius,
            paddingHorizontal: (style.box.padX || 0) * (size / 18),
            paddingVertical: (style.box.padY || 0) * (size / 18),
          },
          boxStyle,
        ]}
      >
        {body}
      </View>
    );
  }

  return (
    <View style={[{ alignSelf: align === 'center' ? 'center' : 'flex-start' }, boxStyle]}>
      {body}
    </View>
  );
}

export default React.memo(CaptionText);
