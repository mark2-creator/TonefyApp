import React, { useEffect, useState } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  makeMutable,
  useAnimatedStyle,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

/**
 * A card whose border is a gradient that slowly turns.
 *
 * How it works, because the trick is not obvious from the code: a large gradient square
 * spins BEHIND the content, and an opaque panel sits on top of it inset by the border
 * width. The only part of the spinning square anyone ever sees is the few pixels around
 * the edge, which reads as light travelling around the border. There is no such thing as
 * an animated border colour in React Native, and this needs no native module.
 *
 * The square is sized to the container's DIAGONAL, measured with onLayout. Anything
 * smaller leaves the corners bare at 45 degrees - the one bug this component can have,
 * and the reason it measures rather than guessing a size.
 *
 * COLOURS: violet into pink, on a deep purple ring rather than a near-black one.
 *
 * It is deliberately NOT a brand colour, and that turns out to be the right answer
 * rather than a compromise. Green means "this action commits" and teal means "you are
 * handling media" (see tonefy-design); a border wearing either is making a claim about
 * state that it cannot honour. A colour the app uses for nothing else can only read as
 * decoration, which is what this is. It also keeps green scarce, which is what makes
 * the sign-in button read as THE commit.
 *
 * The ring is deep purple, not black: a dark ring on a dark screen looked like the card
 * had a shadow rather than a border.
 *
 * Honours Reduce Motion by holding still rather than spinning. A border that never stops
 * moving is exactly what that setting exists to switch off.
 */

/**
 * A BRIGHT BAND on a dark ground, not a blend of two brights.
 *
 * The first version was ['#00d4d4', '#89C5CC', '#00d4d4'] - symmetric, and every colour
 * in it light. Rotating a symmetric gradient by 180 degrees gives back an identical
 * image, so it read as static on a square-ish card and only looked alive on a tall one
 * where the aspect ratio broke the symmetry. The eye needs one travelling highlight it
 * can follow, which means most of the ring has to be dark.
 */
// TWO cycles, not one. With a single band and a dark majority, how much colour a card
// shows depends on its shape: the ring samples a slice of this square, so a tall card
// (signup) caught the bright middle while a short one (login) caught mostly dark and
// looked drab beside it. Two cycles put colour on every edge of any shape, and two
// highlights travelling instead of one reads as richer rather than busier.
const DEFAULT_COLORS = [
  '#3b1a5c', '#8b5cf6', '#ec4899', '#a855f7', '#3b1a5c',
  '#8b5cf6', '#ec4899', '#a855f7', '#3b1a5c',
];
const SPIN_MS = 4200;      // slow. A fast sweep reads as a loading spinner.

/**
 * ONE clock for every border in the app.
 *
 * Each of these used to own a `withRepeat` that never stopped. That is fine for one
 * card and wasteful for a screen of them: N borders meant N animations running forever.
 * A single module-level shared value, started once by whichever border mounts first,
 * costs the same whether one is on screen or a dozen - and it has the side effect that
 * every border in the app turns in step, which looks deliberate rather than busy.
 */
const spin = makeMutable(0);
let spinning = false;
function startSpin() {
  if (spinning) return;
  spinning = true;
  spin.value = withRepeat(withTiming(360, { duration: SPIN_MS, easing: Easing.linear }), -1, false);
}

let nextId = 0;

export default function GradientBorder({
  children,
  style,
  radius = 16,
  width = 1.5,
  colors = DEFAULT_COLORS,
  backgroundColor = '#111',
  contentStyle,
}) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  // A fixed id per instance: two SVGs sharing one gradient id resolve to whichever the
  // renderer saw last, so a screen of borders would all wear the first one's colours.
  const [gid] = useState(() => `gb${nextId++}`);

  const [reduced, setReduced] = useState(null);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => alive && setReduced(!!v))
      .catch(() => alive && setReduced(false));
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (reduced === null || reduced) return;
    startSpin();
  }, [reduced]);

  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value}deg` }],
  }));

  // Cover every rotation: a square of side = diagonal, centred on the container.
  const side = Math.ceil(Math.hypot(size.w, size.h)) || 0;

  return (
    <View
      style={[styles.wrap, { borderRadius: radius, padding: width }, style]}
      onLayout={(e) => {
        const { width: w, height: h } = e.nativeEvent.layout;
        if (w !== size.w || h !== size.h) setSize({ w, h });
      }}
    >
      {side > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.spinner,
            { width: side, height: side, left: (size.w - side) / 2, top: (size.h - side) / 2 },
            spinStyle,
          ]}
        >
          <Svg width="100%" height="100%">
            <Defs>
              <LinearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
                {colors.map((c, i) => (
                  <Stop key={c + i} offset={`${(i / (colors.length - 1)) * 100}%`} stopColor={c} />
                ))}
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${gid})`} />
          </Svg>
        </Animated.View>
      )}

      <View style={[styles.inner, { borderRadius: Math.max(0, radius - width), backgroundColor }, contentStyle]}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // overflow:hidden is what clips the spinning square to the card's rounded shape.
  wrap: { overflow: 'hidden' },
  spinner: { position: 'absolute' },
  inner: { overflow: 'hidden' },
});
