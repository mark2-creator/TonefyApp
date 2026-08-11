import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
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

// A box can't collapse to nothing - there would be no handle left to grab to
// widen it back out. In the same px space as size.w (pre-scale layout size).
const MIN_BOX_WIDTH = 40;

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
  onEditDone, editing = false, resizableWidth = false, children,
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
  // -1 is the sentinel for "no side-handle drag in progress" - a real width is
  // never negative, so it doubles as the ghost box's own visibility flag.
  const dragWidth = useSharedValue(-1);
  const startBoxHalfW = useSharedValue(0);

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

  // Stored at scale 1, like size.w itself - a pinch (scale) and a dragged box
  // width are two independent multipliers on the same base, and folding the
  // live scale in here would double-count it the next time scale changes.
  const commitBoxWidth = useCallback((widthAtScale1) => {
    onTransform(overlay.key, { boxWidthPercent: (widthAtScale1 / containerW) * 100 });
  }, [overlay.key, containerW, onTransform]);

  const select = useCallback(() => onSelect(overlay.key), [overlay.key, onSelect]);
  const tap = useCallback(() => onTap(overlay), [overlay, onTap]);
  const longPress = useCallback(() => { if (onLongPress) onLongPress(overlay); }, [overlay, onLongPress]);

  const panGesture = Gesture.Pan()
    .enabled(!editing)
    // A finger never lands perfectly still, and without a threshold that jitter
    // activates the pan before the tap can finish - so tapping to select would
    // work only sometimes, which is worse than not working at all.
    .minDistance(2)
    // Android measures a pan from the last finger placed rather than from the
    // point between them, so a two-finger turn reads as a large drag: each
    // finger sweeps an arc while the centre stays put. Left alone, the overlay
    // bolts across the frame the moment you try to rotate it. iOS already
    // averages, and ignores this.
    .averageTouches(true)
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
    // The handle is drawn inside the element, so its drag and the element's own
    // one-finger gestures are separate handlers reaching for the same finger,
    // and a nested detector buys no priority. The element's pan won every time:
    // it activates at 2dp where a pan left unconfigured waits for the platform
    // touch slop (~8dp), and the first handler to activate cancels every other
    // one it does not run simultaneously with. So dragging the corner handle
    // moved the caption instead of turning it - the only way to rotate with one
    // finger, which is the only way to rotate while holding the phone. Blocking
    // makes those three wait for the handle to fail before they may activate.
    .blocksExternalGesture(panGesture, tapGesture, longPressGesture)
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

  // Side handles change the box's WIDTH only - font size and everything else
  // stays put, and the text rewraps to fit (Canva's side-handle behaviour,
  // distinct from the corner handle's uniform scale-everything). Manual text
  // overlays only: a caption style has no independent box-width concept, and
  // the export has to agree on the wrap for whichever styles opt in, which
  // pins this to the one kind of overlay where that was built (see the
  // server-side wrapTextLinesByWidth in server.js).
  //
  // Resizes symmetrically about the centre - x/y never change here - rather
  // than pinning the opposite edge, which would mean also moving x/y in a
  // way that stays correct under rotation. That is solvable (project the
  // fixed edge's own position through the same rotation) but is meaningfully
  // more state to get right for a first version; centred resize needs only
  // the one number this already tracks.
  //
  // The rotation-aware projection is the same idea as the corner handle's
  // vector maths: a handle's own drag direction is only "rightward" in the
  // overlay's own (rotated) frame, so the finger's screen-space translation
  // is projected onto that rotated axis via a dot product before it is
  // allowed to change the width.
  const widthHandleGesture = (sign) => Gesture.Pan()
    .enabled(!editing && resizableWidth)
    .blocksExternalGesture(panGesture, tapGesture, longPressGesture)
    // hitSlop is the gesture's OWN recognised region, independent of how big
    // the visible bar is drawn - RNGH still has to resolve the touch against
    // whatever else is under it, but a generous slop gives this gesture a
    // real claim on a wider area than its small bar alone would, rather than
    // relying on pixel-perfect aim at an 8pt-wide target.
    .hitSlop({ left: 16, right: 16, top: 20, bottom: 20 })
    .onStart(() => {
      startBoxHalfW.value = (size.w / 2) * scale.value;
      dragWidth.value = startBoxHalfW.value * 2;
      runOnJS(select)();
    })
    .onUpdate(e => {
      const rad = (rotation.value * Math.PI) / 180;
      const localDx = e.translationX * Math.cos(rad) + e.translationY * Math.sin(rad);
      const newHalfW = startBoxHalfW.value + sign * localDx;
      dragWidth.value = clamp(newHalfW * 2, MIN_BOX_WIDTH, containerW - 2 * EDGE_MARGIN);
    })
    .onEnd(() => {
      runOnJS(commitBoxWidth)(dragWidth.value / scale.value);
      dragWidth.value = -1;
    });
  const leftHandleGesture = widthHandleGesture(-1);
  const rightHandleGesture = widthHandleGesture(1);

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

  // Live preview of a side-handle drag before the text itself reflows. Real
  // reflow needs an actual layout pass (Yoga re-measuring wrapped lines),
  // which only happens from a committed React state update - doing that on
  // every onUpdate frame would mean a full text re-layout at gesture speed,
  // not a cheap UI-thread transform. The outline is the cheap part: it moves
  // at 60fps, and the text catches up to it the instant the finger lifts.
  const ghostBoxStyle = useAnimatedStyle(() => {
    const w = dragWidth.value < 0 ? 0 : dragWidth.value;
    const h = size.h * scale.value;
    return {
      opacity: dragWidth.value < 0 ? 0 : 1,
      width: w,
      height: h,
      transform: [{ translateX: -w / 2 }, { translateY: -h / 2 }],
    };
  });

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
            {resizableWidth && selected && !editing && size.w > 0 && (
              <>
                <ReanimatedAnimated.View
                  pointerEvents="none"
                  style={[styles.ghostBox, ghostBoxStyle]}
                />
                <GestureDetector gesture={leftHandleGesture}>
                  <ReanimatedAnimated.View style={[styles.sideHandleHit, styles.sideHandleLeft, handleStyle]}>
                    <View style={styles.sideHandle} />
                  </ReanimatedAnimated.View>
                </GestureDetector>
                <GestureDetector gesture={rightHandleGesture}>
                  <ReanimatedAnimated.View style={[styles.sideHandleHit, styles.sideHandleRight, handleStyle]}>
                    <View style={styles.sideHandle} />
                  </ReanimatedAnimated.View>
                </GestureDetector>
              </>
            )}
            {/* Editing has no handle of its own to reach the caret's controls with -
                the resize/rotate handle above is hidden for exactly the same reason
                every other gesture is off while typing. Without an explicit way out,
                the only exits are tapping elsewhere on the canvas (easy to miss) or
                the keyboard's own back action. Counter-scaled like the handle, or a
                caption pinched to 4x would carry a button the size of a thumb. */}
            {editing && size.w > 0 && (
              <>
                <ReanimatedAnimated.View style={[styles.editBtnHit, styles.editBtnTopRight, handleStyle]}>
                  <TouchableOpacity
                    style={styles.editBtn}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    onPress={onEditDone}
                    accessibilityLabel="Done editing text">
                    <MaterialIcons name="close" size={13} color="#fff" />
                  </TouchableOpacity>
                </ReanimatedAnimated.View>
                {onLongPress && (
                  <ReanimatedAnimated.View style={[styles.editBtnHit, styles.editBtnBottomRight, handleStyle]}>
                    <TouchableOpacity
                      style={styles.editBtn}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      onPress={() => onLongPress(overlay)}
                      accessibilityLabel="Text style settings">
                      <MaterialIcons name="tune" size={13} color="#fff" />
                    </TouchableOpacity>
                  </ReanimatedAnimated.View>
                )}
              </>
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
  // Positioned the same as handleHit, one at each remaining free corner - the
  // resize handle's own corner (bottom-right, unselected) is left clear since
  // HANDLE already claims it whenever editing turns back off. The hit area
  // stays generous (hitSlop below adds another 10 on top of this) even though
  // the visible circle itself is small - a bigger circle read as loud sitting
  // on top of small caption text.
  editBtnHit: {
    position: 'absolute', width: HANDLE, height: HANDLE,
    alignItems: 'center', justifyContent: 'center',
  },
  editBtnTopRight: { right: -HANDLE / 2, top: -HANDLE / 2 },
  editBtnBottomRight: { right: -HANDLE / 2, bottom: -HANDLE / 2 },
  editBtn: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.75)', borderWidth: 1, borderColor: '#2a2a2a',
    alignItems: 'center', justifyContent: 'center',
  },
  // width/height/opacity/transform all come from ghostBoxStyle - left/top:'50%'
  // plus a -w/2,-h/2 translate is what centres a dynamically-sized box without
  // knowing its size ahead of time, the same trick centreWrap uses for the
  // whole overlay, just done by hand since this box's size changes every frame.
  ghostBox: {
    position: 'absolute', left: '50%', top: '50%',
    borderWidth: 1.5, borderColor: '#2ECC71', borderStyle: 'dashed', borderRadius: 2,
    backgroundColor: 'rgba(46,204,113,0.08)',
  },
  // A bar rather than a dot, so it reads as "drag to resize the width" and
  // not "drag to move/rotate" - the same shape language Canva and Figma use
  // for a side (as opposed to corner) handle.
  //
  // The corner handle sits at an actual corner - offset in BOTH x and y, so
  // only a small sliver of its hit box overlaps the element's own draggable
  // area. A side handle offset in x only (vertically centred on the edge)
  // overlapped the element far more: on a single-line overlay, its hit box's
  // whole height sits inside the box's own bounds, and (at the old -HANDLE/2
  // offset) half its width did too. That overlap is what let the element's
  // own pan win the touch instead of the handle - not blocksExternalGesture
  // failing, just a much larger contested area for the same mechanism to
  // arbitrate. Pushed almost entirely outside the box now, matching the
  // corner handle's own near-zero overlap.
  sideHandleHit: {
    position: 'absolute', top: '50%', marginTop: -HANDLE / 2,
    width: HANDLE, height: HANDLE, alignItems: 'center', justifyContent: 'center',
  },
  sideHandleLeft: { left: -HANDLE * 0.9 },
  sideHandleRight: { right: -HANDLE * 0.9 },
  sideHandle: {
    width: 8, height: 26, borderRadius: 4,
    backgroundColor: '#2ECC71', borderWidth: 2, borderColor: '#0b0b0b',
  },
});
