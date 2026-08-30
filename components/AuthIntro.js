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
import AuthCharacter, { AuthBag, HIP_ORIGIN, SHOULDER_ORIGIN } from './AuthCharacter';

/**
 * The opening of the auth screen: she walks in from the left, sets her bag down, the
 * form springs up out of it, and she settles into a lean beside it.
 *
 * The choreography lives here rather than in AuthScreen so that screen keeps reading as
 * a form. It owns WHEN things move; AuthCharacter owns how they are drawn.
 *
 * Beats, in milliseconds from mount. They overlap on purpose - a sequence where each
 * step waits for the last reads as a slideshow rather than one continuous action:
 *
 *     0 1250   she walks in, legs stepping
 *  1063        the legs crossfade to a planted stance
 *  1130 1550   she bends: the arm reaches down and her body sinks with it
 *  1310 1930   the bag descends slowly and settles
 *  1550 2030   she straightens back up
 *  2020        the FORM springs UP out of the bag
 *  2080 2600   she settles into the lean
 */

// She was reading as running: four half-strides in 850ms is a jog, not a walk. Longer
// steps, shallower swing and less bob turn the same motion into an amble.
const WALK_MS = 1250;
const STEP_MS = 312;          // one half-stride; four of them fill the walk
const BAG_MS = 620;           // the bag descends slowly - see the easing below
const LEAN_MS = 520;

const WALK_FROM = -170;       // negative: she enters from the left
const BAG_FROM = -34;         // the bag starts at hand height
const LEAN_DEG = 5;           // a few degrees is a lean; more is a stumble
const ARM_DEG = 30;           // a real reach toward the ground, not a twitch
const STEP_DEG = 9;           // how far each leg swings from the base stride
const BOB_PX = 3;             // the rise and fall that makes it a walk, not a glide
const DIP_PX = 9;             // how far she sinks while setting the bag down
const FORM_RISE = 70;         // how far below its resting place the form starts

// When she stops walking and starts placing. Everything after this is one movement:
// bend, lower, release, straighten.
const PLACE_AT = WALK_MS;

export function useAuthIntro() {
  const walk = useSharedValue(WALK_FROM);
  const bob = useSharedValue(0);
  const dip = useSharedValue(0);      // she sinks a little as she bends to place it
  const legA = useSharedValue(0);
  const legB = useSharedValue(0);
  const settle = useSharedValue(0);   // 0 = walking legs, 1 = both feet planted
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
      bob.value = 0;
      dip.value = 0;
      legA.value = 0;
      legB.value = 0;
      settle.value = 1;
      arm.value = 0;
      bagY.value = 0;
      bagOpacity.value = 1;
      lean.value = LEAN_DEG;
      form.value = 1;
      return;
    }

    walk.value = withTiming(0, { duration: WALK_MS, easing: Easing.out(Easing.cubic) });

    // The legs are what make this a walk. Translating a fixed pose across the screen
    // reads as sliding no matter how good the easing is - which is exactly what the
    // first version on a real device looked like. Each leg swings about the pelvis in
    // ANTIPHASE with the other, four half-strides across the walk, decaying to the
    // resting pose so she does not stop mid-step.
    const step = (dir) => withSequence(
      withTiming(dir * STEP_DEG, { duration: STEP_MS, easing: Easing.inOut(Easing.sin) }),
      withTiming(-dir * STEP_DEG, { duration: STEP_MS, easing: Easing.inOut(Easing.sin) }),
      withTiming(dir * STEP_DEG * 0.55, { duration: STEP_MS, easing: Easing.inOut(Easing.sin) }),
      withTiming(0, { duration: STEP_MS, easing: Easing.out(Easing.quad) }),
    );
    legA.value = step(-1);
    legB.value = step(1);

    // A walking body rises and falls twice per stride. Without it the legs move and the
    // torso floats, which looks worse than not animating the legs at all.
    bob.value = withSequence(
      withTiming(-BOB_PX, { duration: STEP_MS / 2, easing: Easing.inOut(Easing.sin) }),
      withTiming(0, { duration: STEP_MS / 2, easing: Easing.inOut(Easing.sin) }),
      withTiming(-BOB_PX, { duration: STEP_MS / 2, easing: Easing.inOut(Easing.sin) }),
      withTiming(0, { duration: STEP_MS / 2, easing: Easing.inOut(Easing.sin) }),
      withTiming(-BOB_PX * 0.6, { duration: STEP_MS / 2, easing: Easing.inOut(Easing.sin) }),
      withTiming(0, { duration: STEP_MS * 1.5, easing: Easing.out(Easing.quad) }),
    );

    // She stops walking, so she stops being mid-stride. The crossfade starts a little
    // before the last half-step lands, which hides the swap inside the movement instead
    // of popping once she is already still.
    settle.value = withDelay(WALK_MS - STEP_MS * 0.6, withTiming(1, {
      duration: 260, easing: Easing.inOut(Easing.quad),
    }));

    // She BENDS to place it. The arm reaches down and stays down while the bag travels,
    // then returns once it has let go. Previously the arm flicked and the bag fell on
    // its own, which is what read as throwing it.
    arm.value = withDelay(PLACE_AT - 120, withSequence(
      withTiming(ARM_DEG, { duration: 420, easing: Easing.inOut(Easing.quad) }),
      withDelay(BAG_MS - 180, withTiming(2, { duration: 480, easing: Easing.inOut(Easing.quad) })),
    ));

    // Her whole body sinks with the reach and rises again after. A hand that goes down
    // while the body stays put is a throw; the dip is what makes it a placement.
    dip.value = withDelay(PLACE_AT - 120, withSequence(
      withTiming(DIP_PX, { duration: 420, easing: Easing.inOut(Easing.quad) }),
      withDelay(BAG_MS - 180, withTiming(0, { duration: 480, easing: Easing.inOut(Easing.quad) })),
    ));

    bagOpacity.value = withDelay(PLACE_AT - 60, withTiming(1, { duration: 140 }));
    // DECELERATING into the ground. The old easing gathered speed on the way down,
    // which is exactly how a dropped object moves and exactly not how a placed one does.
    bagY.value = withDelay(PLACE_AT + 60, withTiming(0, {
      duration: BAG_MS, easing: Easing.out(Easing.cubic),
    }));
    // Barely any squash. Something set down gently does not bounce; this is just enough
    // to register contact with the ground.
    bagSquash.value = withDelay(PLACE_AT + 60 + BAG_MS, withSequence(
      withTiming(0.96, { duration: 110, easing: Easing.out(Easing.quad) }),
      withSpring(1, { damping: 14, stiffness: 180 }),
    ));

    // The form leaves the bag once she has let go of it, overshooting before it settles.
    const RELEASED = PLACE_AT + 60 + BAG_MS + 90;
    form.value = withDelay(RELEASED, withSpring(1, { damping: 12, stiffness: 130, mass: 0.9 }));

    lean.value = withDelay(RELEASED + 60, withTiming(LEAN_DEG, {
      duration: LEAN_MS, easing: Easing.inOut(Easing.cubic),
    }));
  }, [reduced, walk, bob, dip, legA, legB, settle, arm, bagY, bagOpacity, bagSquash, lean, form]);

  // She pivots on her feet when she leans, not about her middle - which means the origin
  // has to sit on the element that carries the rotation, not on its wrapper.
  const figureStyle = useAnimatedStyle(() => ({
    transformOrigin: '50% 100%',
    transform: [
      { translateX: walk.value },
      { translateY: bob.value + dip.value },
      { rotate: `${lean.value}deg` },
    ],
  }));

  const legAStyle = useAnimatedStyle(() => ({
    transformOrigin: HIP_ORIGIN,
    transform: [{ rotate: `${legA.value}deg` }],
  }));

  const legBStyle = useAnimatedStyle(() => ({
    transformOrigin: HIP_ORIGIN,
    transform: [{ rotate: `${legB.value}deg` }],
  }));

  const walkLegsStyle = useAnimatedStyle(() => ({ opacity: 1 - settle.value }));
  const restLegsStyle = useAnimatedStyle(() => ({ opacity: settle.value }));

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

  // The character now stands BELOW the form, so the bag is below it too and the form
  // genuinely grows upward out of it. Scaling from its own BOTTOM edge is what does
  // that: the bottom stays put next to the bag while the rest unfolds upwards. With a
  // top origin it unfolded downwards, which is the opposite of springing out.
  const formStyle = useAnimatedStyle(() => ({
    opacity: form.value,
    transformOrigin: '50% 100%',
    transform: [
      { translateY: FORM_RISE * (1 - form.value) },
      { scale: 0.45 + 0.55 * form.value },
    ],
  }));

  return { figureStyle, armStyle, legAStyle, legBStyle, walkLegsStyle, restLegsStyle, bagStyle, formStyle };
}

/** The ground she walks onto. Fixed height so the form below it never shifts. */
export function AuthStage({ figureStyle, armStyle, legAStyle, legBStyle, walkLegsStyle, restLegsStyle, bagStyle }) {
  return (
    <View style={styles.stage} pointerEvents="none">
      {/* The bag paints BEFORE her, so her planted foot sits in front of it. Drawn on
          top it read as a bag stuck to her shin. */}
      <AuthBag style={[styles.bagSlot, bagStyle]} />
      <View style={styles.figureSlot}>
        <AuthCharacter
          style={figureStyle}
          armStyle={armStyle}
          legAStyle={legAStyle}
          legBStyle={legBStyle}
          walkLegsStyle={walkLegsStyle}
          restLegsStyle={restLegsStyle}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { width: '100%', height: 196, marginTop: 4 },
  figureSlot: { position: 'absolute', left: 0, bottom: 0 },
  // Just past her planted foot, and behind her, so it reads as set down beside her.
  bagSlot: { position: 'absolute', left: 138, bottom: 2 },
});
