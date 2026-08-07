import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import ReanimatedAnimated, {
  useSharedValue, useAnimatedStyle, runOnJS, withTiming,
} from 'react-native-reanimated';

// A text overlay or caption on the preview canvas, free to be moved anywhere in
// the frame, turned to any angle and pinched to any size - the CapCut/Canva
// interaction, rather than the old drag-only PanResponder.
//
// Position is the element's CENTRE, as a percentage of the frame. Top-left, which
// is what this used to store, is not a position you can rotate or scale about:
// spin an element and its top-left corner describes a circle while the thing you
// are aiming stays put. Centre is also the only anchor that lets a caption be
// centred by default without measuring how wide its particular words happen to be.
//
// Nothing here measures anything to place it, either. The element sits inside a
// wrapper that fills the frame and centres its child, so the child starts centred
// and a translate of (x - w/2, y - h/2) puts its centre exactly on the point -
// no onLayout round trip, and no frame where the overlay is in the wrong place.

// How close to a right angle counts as meaning it. Rotating by hand never lands
// on exactly 0, and a caption a degree and a half off level reads as a mistake.
const SNAP_DEGREES = 4;
const SNAP_TARGETS = [-180, -90, 0, 90, 180];

// The centre stays inside the frame, so an overlay can hang off any edge but can
// never be pushed out of reach.
const EDGE_MARGIN = 8;

const MIN_SCALE = 0.25;
const MAX_SCALE = 6;

const HANDLE = 28;

function clamp(v, lo, hi) {
  'worklet';
  return Math.min(hi, Math.max(lo, v));
}

function snapAngle(deg) {
  'worklet';
  for (let i = 0; i < SNAP_TARGETS.length; i++) {
    if (Math.abs(deg - SNAP_TARGETS[i]) <= SNAP_DEGREES) return SNAP_TARGETS[i];
  }
  return deg;
}

function normaliseAngle(deg) {
  'worklet';
  let d = deg % 360;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}

export default function CanvasOverlay({
  overlay, containerW, containerH, selected, onSelect, onTransform, onTap, onLongPress,
  editing = false, children,
}) {
  const [size, setSize] = useState({ w: 0, h: 0 });

  const x = useSharedValue(((overlay.x ?? 50) / 100) * containerW);
  const y = useSharedValue(((overlay.y ?? 80) / 100) * containerH);
  const scale = useSharedValue(overlay.scale ?? 1);
  const rotation = useSharedValue(overlay.rotation ?? 0);

  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const startScale = useSharedValue(1);
  const startRotation = useSharedValue(0);
  const handleLen = useSharedValue(0);
  const handleAngle = useSharedValue(0);

  // The overlay can also be moved from outside the canvas - a reset, an undo, a
  // value typed in a sheet - and the gesture state has to follow, or the next
  // drag would snap it back to where the finger last left it.
  useEffect(() => {
    x.value = ((overlay.x ?? 50) / 100) * containerW;
    y.value = ((overlay.y ?? 80) / 100) * containerH;
    scale.value = overlay.scale ?? 1;
    rotation.value = overlay.rotation ?? 0;
  }, [overlay.x, overlay.y, overlay.scale, overlay.rotation, containerW, containerH]);

  const commit = useCallback((nx, ny, nscale, nrotation) => {
    onTransform(overlay.key, {
      x: (nx / containerW) * 100,
      y: (ny / containerH) * 100,
      scale: nscale,
      rotation: nrotation,
    });
  }, [overlay.key, containerW, containerH, onTransform]);

  const select = useCallback(() => onSelect(overlay.key), [overlay.key, onSelect]);
  const tap = useCallback(() => onTap(overlay), [overlay, onTap]);
  const longPress = useCallback(() => { if (onLongPress) onLongPress(overlay); }, [overlay, onLongPress]);

  const panGesture = Gesture.Pan()
    .enabled(!editing)
    // A finger never lands perfectly still, and without a threshold that jitter
    // activates the pan before the tap can finish - so tapping to select would
    // work only sometimes, which is worse than not working at all.
    .minDistance(2)
    .onStart(() => {
      startX.value = x.value;
      startY.value = y.value;
      runOnJS(select)();
    })
    .onUpdate(e => {
      x.value = clamp(startX.value + e.translationX, EDGE_MARGIN, containerW - EDGE_MARGIN);
      y.value = clamp(startY.value + e.translationY, EDGE_MARGIN, containerH - EDGE_MARGIN);
    })
    .onEnd(() => {
      runOnJS(commit)(x.value, y.value, scale.value, rotation.value);
    });

  const pinchGesture = Gesture.Pinch()
    .enabled(!editing)
    .onStart(() => {
      startScale.value = scale.value;
      runOnJS(select)();
    })
    .onUpdate(e => {
      scale.value = clamp(startScale.value * e.scale, MIN_SCALE, MAX_SCALE);
    })
    .onEnd(() => {
      runOnJS(commit)(x.value, y.value, scale.value, rotation.value);
    });

  const rotationGesture = Gesture.Rotation()
    .enabled(!editing)
    .onStart(() => {
      startRotation.value = rotation.value;
      runOnJS(select)();
    })
    .onUpdate(e => {
      rotation.value = normaliseAngle(startRotation.value + (e.rotation * 180) / Math.PI);
    })
    .onEnd(() => {
      rotation.value = withTiming(snapAngle(rotation.value), { duration: 90 });
      runOnJS(commit)(x.value, y.value, scale.value, snapAngle(rotation.value));
    });

  const tapGesture = Gesture.Tap()
    .enabled(!editing)
    .maxDuration(250)
    .onEnd((_e, ok) => {
      if (ok) { runOnJS(select)(); runOnJS(tap)(); }
    });

  // Holding an overlay opens its style sheet. Tapping it twice types into it, so
  // without this there would be no gesture left for "change the font" and the
  // sheet would only be reachable from the text list.
  const longPressGesture = Gesture.LongPress()
    .enabled(!editing)
    .minDuration(400)
    .onStart(() => { runOnJS(select)(); runOnJS(longPress)(); });

  // A corner handle turns and resizes with one finger, which is the only way to do
  // either while holding the phone in the other hand. The maths never needs the
  // canvas's position on screen: the vector from the element's centre out to the
  // handle is known at the moment the drag starts, and the finger's translation is
  // added to it, so length gives the scale and angle gives the rotation.
  const handleGesture = Gesture.Pan()
    .onStart(() => {
      startScale.value = scale.value;
      startRotation.value = rotation.value;
      const halfW = (size.w / 2) * scale.value;
      const halfH = (size.h / 2) * scale.value;
      handleLen.value = Math.max(1, Math.hypot(halfW, halfH));
      handleAngle.value = (rotation.value * Math.PI) / 180 + Math.atan2(halfH, halfW);
      runOnJS(select)();
    })
    .onUpdate(e => {
      const vx = handleLen.value * Math.cos(handleAngle.value) + e.translationX;
      const vy = handleLen.value * Math.sin(handleAngle.value) + e.translationY;
      const len = Math.hypot(vx, vy);
      scale.value = clamp((startScale.value * len) / handleLen.value, MIN_SCALE, MAX_SCALE);
      const delta = Math.atan2(vy, vx) - handleAngle.value;
      rotation.value = normaliseAngle(startRotation.value + (delta * 180) / Math.PI);
    })
    .onEnd(() => {
      rotation.value = withTiming(snapAngle(rotation.value), { duration: 90 });
      runOnJS(commit)(x.value, y.value, scale.value, snapAngle(rotation.value));
    });

  // Pan, pinch and rotate run together so a two-finger gesture can move, resize and
  // turn in one motion. The tap races them: it only wins if nothing moved.
  //
  // While the overlay is being typed into, every one of them is switched off. A
  // gesture handler that merely loses a race still swallows the touch, so leaving
  // them enabled means taps land on the overlay instead of in the text - no
  // placing the caret, no selecting a word, no dragging the handles the keyboard
  // puts there.
  // `.enabled()` goes on each leaf, never on the composition. `Gesture.Race` and
  // `Gesture.Simultaneous` return a ComposedGesture, whose prototype chain is
  // ComposedGesture -> Gesture -> Object - and `enabled` is defined on
  // BaseGesture, which is not on that chain. Calling it on the composed gesture
  // throws "enabled is not a function" while rendering, which takes the whole
  // screen grey rather than merely leaving the gesture on.
  const composed = Gesture.Race(
    longPressGesture,
    tapGesture,
    Gesture.Simultaneous(panGesture, pinchGesture, rotationGesture)
  );

  const elementStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.value - containerW / 2 },
      { translateY: y.value - containerH / 2 },
      { rotate: `${rotation.value}deg` },
      { scale: scale.value },
    ],
  }));

  // The frame and its handle live inside the transform, so they follow the element -
  // but they are counter-scaled, or a caption pinched to 4x would carry a four
  // pixel border and a handle the size of a thumb.
  const chromeStyle = useAnimatedStyle(() => ({
    borderWidth: 1 / scale.value,
    margin: -1 / scale.value,
  }));
  const handleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 / scale.value }],
  }));

  const onLayout = useCallback(e => {
    const { width, height } = e.nativeEvent.layout;
    setSize(prev => (prev.w === width && prev.h === height ? prev : { w: width, h: height }));
  }, []);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <View style={styles.centreWrap} pointerEvents="box-none">
        <GestureDetector gesture={composed}>
          <ReanimatedAnimated.View style={elementStyle} onLayout={onLayout}>
            {selected && (
              <ReanimatedAnimated.View
                pointerEvents="none"
                style={[
                  StyleSheet.absoluteFill,
                  styles.frame,
                  editing && styles.frameEditing,
                  chromeStyle,
                ]}
              />
            )}
            {children}
            {selected && !editing && size.w > 0 && (
              <GestureDetector gesture={handleGesture}>
                <ReanimatedAnimated.View style={[styles.handleHit, handleStyle]}>
                  <View style={styles.handle} />
                </ReanimatedAnimated.View>
              </GestureDetector>
            )}
          </ReanimatedAnimated.View>
        </GestureDetector>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centreWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  frame: { borderColor: '#2ECC71', borderStyle: 'dashed', borderRadius: 2 },
  frameEditing: { borderStyle: 'solid' },
  // The hit area is deliberately larger than the dot it draws - a 10pt target is
  // not reliably hittable, and the handle sits half off the element's corner.
  handleHit: {
    position: 'absolute', right: -HANDLE / 2, bottom: -HANDLE / 2,
    width: HANDLE, height: HANDLE, alignItems: 'center', justifyContent: 'center',
  },
  handle: {
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: '#2ECC71', borderWidth: 2, borderColor: '#0b0b0b',
  },
});
