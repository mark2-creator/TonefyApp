import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import { fontFamilyFor } from '../constants/fonts';
import { captionFill } from '../constants/captionStyles';

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
//   shadow -> glow -> stroke ring -> fill
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

function CaptionText({ style, text, size, color, align = 'center', maxWidth, boxStyle, numberOfLines }) {
  const shown = style.upper ? String(text || '').toUpperCase() : String(text || '');
  const fill = captionFill(style, color);
  const family = fontFamilyFor(style.font);
  const strokeW = style.stroke ? Math.max(0.5, style.stroke.width * (size / 18)) : 0;

  const base = {
    fontSize: size,
    // A loaded family already carries the weight it was downloaded at, and asking
    // Android to synthesise more on top of a single registered face is what makes
    // a custom font silently fall back to the system one. No lineHeight either:
    // a fixed one clips the display faces with deep descenders.
    ...(family ? { fontFamily: family } : { fontWeight: 'bold' }),
    ...(style.spacing ? { letterSpacing: style.spacing * (size / 18) } : null),
    textAlign: align,
  };
  const metrics = metricsOf(base);
  // Passed to every layer, never to one: a line limit that clipped the fill but
  // not the outline would leave the outline of a word the fill no longer shows.
  const lines = numberOfLines || undefined;

  const body = (
    <View style={maxWidth ? { maxWidth } : null}>
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
