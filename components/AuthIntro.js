import React, { useEffect, useState } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import AuthCharacter, { AuthBag, SHOULDER_ORIGIN } from './AuthCharacter';

/**
 * The opening of the auth screen: she walks in from the left, sets her bag down, the
 * form springs out of it, and she settles into a lean beside it.
 *
 * The choreography lives here rather than in AuthScreen so that screen keeps reading as
 * a form. It owns WHEN things move; AuthCharacter owns how they are drawn.
 *
 * Beats, in milliseconds from mount. They overlap on purpose - a sequence where each
 * step waits for the last reads as a slideshow rather than one continuous action:
 *
 *     0  850   she walks in
 *   650 1000   the arm lowers
 *   700 1080   the bag travels from her hand to the ground
 *  1080         the bag lands and squashes
 *  1150         the FORM springs out of it
 *  1200 1700   she straightens into the lean
 */

const WALK_MS = 850;
const BAG_MS = 380;
const LEAN_MS = 500;

// How far off-screen she starts. Negative because she enters from the left.
const WALK_FROM = -170;
// The bag starts at hand height and falls to the ground.
const BAG_FROM = -34;
// A few degrees is a lean; more is a stumble.
const LEAN_DEG = 5;
const ARM_DEG = 14;

export function useAuthIntro() {
  const walk = useSharedValue(WALK_FROM);
  const arm = useSharedValue(0);
  const bagY = useSharedValue(BAG_FROM);
  const bagOpacity = useSharedValue(0);
  const bagSquash = useSharedValue(1);
  const lean = useSharedValue(0);
  const form = useSharedValue(0);

  // Someone who has asked the OS to reduce motion should not be made to watch a
  // 1.7-second entrance every time they open the app, and this screen is the one people
  // reach when they are already locked out or frustrated. They get the finished state.
  const [reduced, setReduced] = useState(null);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => alive && setReduced(!!v))
      .catch(() => alive && setReduced(false));
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (reduced === null) return;   // still asking the OS; do not start on a guess

    if (reduced) {
      walk.value = 0;
      arm.value = 0;
      bagY.value = 0;
      bagOpacity.value = 1;
      lean.value = LEAN_DEG;
      form.value = 1;
      return;
    }

    const ease = { duration: WALK_MS, easing: Easing.out(Easing.cubic) };
    walk.value = withTiming(0, ease);

    // Down, then most of the way back: an arm that stays down looks broken, and one
    // that returns fully looks like it never moved.
    arm.value = withDelay(650, withSequence(
      withTiming(ARM_DEG, { duration: 350, easing: Easing.out(Easing.quad) }),
      withDelay(180, withTiming(3, { duration: 420, easing: Easing.inOut(Easing.quad) })),
    ));

    bagOpacity.value = withDelay(700, withTiming(1, { duration: 120 }));
    bagY.value = withDelay(700, withTiming(0, {
      duration: BAG_MS,
      easing: Easing.bezier(0.4, 0, 0.9, 1),   // gathers speed, like something dropped
    }));
    // The squash is what sells the landing. Brief, and it recovers.
    bagSquash.value = withDelay(1080, withSequence(
      withTiming(0.82, { duration: 90, easing: Easing.out(Easing.quad) }),
      withSpring(1, { damping: 7, stiffness: 260 }),
    ));

    // The form leaves the bag the instant it lands, overshooting before it settles.
    form.value = withDelay(1150, withSpring(1, { damping: 12, stiffness: 130, mass: 0.9 }));

    lean.value = withDelay(1200, withTiming(LEAN_DEG, {
      duration: LEAN_MS, easing: Easing.inOut(Easing.cubic),
    }));
  }, [reduced, walk, arm, bagY, bagOpacity, bagSquash, lean, form]);

  // She pivots on her feet when she leans, not about her middle - which means the
  // origin has to sit on the element that carries the rotation, not on its wrapper.
  const figureStyle = useAnimatedStyle(() => ({
    transformOrigin: '50% 100%',
    transform: [{ translateX: walk.value }, { rotate: `${lean.value}deg` }],
  }));

  // Rotating about the shoulder rather than the layer's centre is the whole reason the
  // arm reads as hinged instead of sliding.
  const armStyle = useAnimatedStyle(() => ({
    transformOrigin: SHOULDER_ORIGIN,
    transform: [{ rotate: `${arm.value}deg` }],
  }));

  const bagStyle = useAnimatedStyle(() => ({
    opacity: bagOpacity.value,
    transform: [{ translateY: bagY.value }, { scaleY: bagSquash.value }],
  }));

  // Scaled from its own bottom-left, which is where the bag is, so it reads as coming
  // OUT of the bag rather than fading in over it.
  const formStyle = useAnimatedStyle(() => ({
    opacity: form.value,
    transformOrigin: '18% 0%',
    transform: [{ scale: 0.35 + 0.65 * form.value }],
  }));

  return { figureStyle, armStyle, bagStyle, formStyle };
}

/** The ground she walks onto. Fixed height so the form below it never shifts. */
export function AuthStage({ figureStyle, armStyle, bagStyle }) {
  return (
    <View style={styles.stage} pointerEvents="none">
      <View style={styles.figureSlot}>
        <AuthCharacter style={figureStyle} armStyle={armStyle} />
      </View>
      <AuthBag style={[styles.bagSlot, bagStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { width: '100%', height: 196, marginBottom: 4 },
  figureSlot: { position: 'absolute', left: 0, bottom: 0 },
  bagSlot: { position: 'absolute', left: 104, bottom: 2 },
});
