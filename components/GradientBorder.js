import React, { useEffect, useState } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
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
 * COLOURS: the sweep must not use green. Green in this app means "this action commits"
 * (see tonefy-design), and a green light travelling around a card that CONTAINS the
 * commit button spends the one colour that distinguishes it. Teal is the default because
 * it is bright on the dark ground and already brand. Pass `colors` for a deliberate
 * exception, not to decorate.
 *
 * Honours Reduce Motion by holding still rather than spinning. A border that never stops
 * moving is exactly what that setting exists to switch off.
 */

const DEFAULT_COLORS = ['#00d4d4', '#89C5CC', '#00d4d4'];
const SPIN_MS = 4200;      // slow. A fast sweep reads as a loading spinner.

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
  const angle = useSharedValue(0);

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
    angle.value = withRepeat(
      withTiming(360, { duration: SPIN_MS, easing: Easing.linear }),
      -1,
      false,
    );
  }, [reduced, angle]);

  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${angle.value}deg` }],
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
              <LinearGradient id="gb" x1="0" y1="0" x2="1" y2="1">
                {colors.map((c, i) => (
                  <Stop key={c + i} offset={`${(i / (colors.length - 1)) * 100}%`} stopColor={c} />
                ))}
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#gb)" />
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
