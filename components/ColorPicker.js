import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, PanResponder, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';

// A full colour picker: saturation-value plane + hue slider + hex input, with a
// preset/recent swatch row in front of it. The overlay renderer and the export
// payload both carry a plain hex string, so everything in here converts back to
// one before it leaves the component.

// ---------------------------------------------------------------------------
// Colour maths. HSV is the model the plane and the slider are drawn in; hex is
// the only form that crosses the component boundary.
// ---------------------------------------------------------------------------

// Accepts '#abc', 'abc', '#AABBCC', 'AABBCC'. Returns lowercase '#rrggbb', or
// null when the input is not a colour - callers use null to mean "reject this",
// which is what keeps a half-typed hex field from clobbering the live colour.
export function normalizeHex(input) {
  if (typeof input !== 'string') return null;
  let h = input.trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{3}$/.test(h)) h = h.split('').map(c => c + c).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return '#' + h.toLowerCase();
}

export function hexToRgb(hex) {
  const norm = normalizeHex(hex);
  if (!norm) return null;
  const n = parseInt(norm.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgbToHex(r, g, b) {
  const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
  return '#' + [clamp(r), clamp(g), clamp(b)].map(v => v.toString(16).padStart(2, '0')).join('');
}

export function rgbToHsv(r, g, b) {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn), d = max - min;
  let h = 0;
  if (d > 0) {
    if (max === rn) h = 60 * (((gn - bn) / d) % 6);
    else if (max === gn) h = 60 * ((bn - rn) / d + 2);
    else h = 60 * ((rn - gn) / d + 4);
  }
  if (h < 0) h += 360;
  return { h, s: max === 0 ? 0 : d / max, v: max };
}

export function hsvToRgb(h, s, v) {
  const c = v * s;
  const hp = ((((h % 360) + 360) % 360)) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0, g = 0, b = 0;
  if (hp < 1) { r = c; g = x; }
  else if (hp < 2) { r = x; g = c; }
  else if (hp < 3) { g = c; b = x; }
  else if (hp < 4) { g = x; b = c; }
  else if (hp < 5) { r = x; b = c; }
  else { r = c; b = x; }
  const m = v - c;
  return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 };
}

export function hsvToHex(h, s, v) {
  const { r, g, b } = hsvToRgb(h, s, v);
  return rgbToHex(r, g, b);
}

export function hexToHsv(hex) {
  const rgb = hexToRgb(hex);
  return rgb ? rgbToHsv(rgb.r, rgb.g, rgb.b) : null;
}

// White text on the swatch is unreadable on yellow, black is unreadable on navy.
// Relative luminance picks whichever one survives.
export function readableOn(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return '#fff';
  const lin = (c) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
  const L = 0.2126 * lin(rgb.r) + 0.7152 * lin(rgb.g) + 0.0722 * lin(rgb.b);
  return L > 0.45 ? '#000' : '#fff';
}

const clamp01 = (v) => Math.max(0, Math.min(1, v));

// ---------------------------------------------------------------------------
// Drag tracking
// ---------------------------------------------------------------------------

// Both the plane and the hue slider need the same thing: the touch position in
// their own coordinate space, for taps as well as drags, and a signal when the
// gesture ends so the final value can be committed once.
//
// gestureState only carries page coordinates, so the view's page origin is taken
// from the grant event (pageX - locationX) rather than measured asynchronously -
// measure() would land after the first frames of the drag have already been
// handled with a stale origin. The thumbs are pointerEvents="none" so locationX
// is always relative to the tracking view itself and never to a child.
function useDragTracker(handler) {
  const cb = useRef(handler);
  cb.current = handler;
  const origin = useRef({ x: 0, y: 0 });
  const last = useRef({ x: 0, y: 0 });

  // PanResponder.create returns { panHandlers }, and it is the handlers that get
  // spread onto the view - spreading the wrapper sets one ignored prop and leaves
  // the view with no touch callbacks at all.
  return useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    // The parent sheet scrolls. Once this gesture owns the touch it keeps it,
    // otherwise a vertical drag on the plane turns into a scroll mid-stroke.
    onPanResponderTerminationRequest: () => false,
    onShouldBlockNativeResponder: () => true,
    onPanResponderGrant: (e) => {
      const { pageX, pageY, locationX, locationY } = e.nativeEvent;
      origin.current = { x: pageX - locationX, y: pageY - locationY };
      last.current = { x: locationX, y: locationY };
      cb.current(locationX, locationY, 'start');
    },
    onPanResponderMove: (e, g) => {
      const x = g.moveX - origin.current.x;
      const y = g.moveY - origin.current.y;
      last.current = { x, y };
      cb.current(x, y, 'move');
    },
    // A tap never produces a move, and gestureState.moveX is 0 in that case, so
    // the release commits the last position seen rather than recomputing one.
    onPanResponderRelease: () => cb.current(last.current.x, last.current.y, 'end'),
    onPanResponderTerminate: () => cb.current(last.current.x, last.current.y, 'end'),
  }).panHandlers, []);
}

// ---------------------------------------------------------------------------
// Static gradient layers. Redrawing SVG on every drag frame is the one thing
// that makes a picker feel cheap, so the plane only re-renders when the hue
// changes and the hue track never re-renders at all.
// ---------------------------------------------------------------------------

const SVPlaneGradient = React.memo(function SVPlaneGradient({ hue, width, height, gid }) {
  return (
    <Svg width={width} height={height} pointerEvents="none">
      <Defs>
        <LinearGradient id={`sat-${gid}`} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#ffffff" />
          <Stop offset="1" stopColor={hsvToHex(hue, 1, 1)} />
        </LinearGradient>
        <LinearGradient id={`val-${gid}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#000000" stopOpacity="0" />
          <Stop offset="1" stopColor="#000000" stopOpacity="1" />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width={width} height={height} rx="12" fill={`url(#sat-${gid})`} />
      <Rect x="0" y="0" width={width} height={height} rx="12" fill={`url(#val-${gid})`} />
    </Svg>
  );
});

const HUE_STOPS = ['#ff0000', '#ffff00', '#00ff00', '#00ffff', '#0000ff', '#ff00ff', '#ff0000'];

const HueTrack = React.memo(function HueTrack({ width, height, gid }) {
  return (
    <Svg width={width} height={height} pointerEvents="none">
      <Defs>
        <LinearGradient id={`hue-${gid}`} x1="0" y1="0" x2="1" y2="0">
          {HUE_STOPS.map((c, i) => (
            <Stop key={c + i} offset={`${i / (HUE_STOPS.length - 1)}`} stopColor={c} />
          ))}
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width={width} height={height} rx={height / 2} fill={`url(#hue-${gid})`} />
    </Svg>
  );
});

// ---------------------------------------------------------------------------

const PLANE_H = 150;
const HUE_H = 22;
let gidSeq = 0;

/**
 * @param color      current colour, any hex form
 * @param onChange   fires continuously while dragging (throttled) and on every commit
 * @param onCommit   fires once when a value is settled - use it to record recents
 * @param presets    swatch row colours
 * @param recents    recently used colours, shown after the presets
 * @param onDragStateChange  true while a drag owns the touch, so an enclosing
 *                   ScrollView can disable itself for the duration
 */
export default function ColorPicker({
  color, onChange, onCommit, presets = [], recents = [], onDragStateChange,
}) {
  const gid = useMemo(() => ++gidSeq, []);
  const [hsv, setHsv] = useState(() => hexToHsv(color) || { h: 0, s: 0, v: 1 });
  const [open, setOpen] = useState(false);
  const [width, setWidth] = useState(0);
  const [hexDraft, setHexDraft] = useState(() => normalizeHex(color) || '#ffffff');
  const [hexFocused, setHexFocused] = useState(false);

  const hex = hsvToHex(hsv.h, hsv.s, hsv.v);
  // Gesture handlers read the live HSV from here rather than from a setState
  // updater: emitting to the parent from inside an updater is a side effect in
  // React's render phase, and the handlers need the current hue anyway.
  const hsvRef = useRef(hsv);
  hsvRef.current = hsv;

  // Adopt a colour set from outside (opening the sheet on an existing overlay,
  // or tapping a swatch). Grey, black and white carry no hue of their own, so
  // the plane keeps the hue it was already showing instead of snapping to red.
  useEffect(() => {
    const norm = normalizeHex(color);
    if (!norm || norm === hex) return;
    const next = hexToHsv(norm);
    if (!next) return;
    const merged = { h: next.s === 0 ? hsvRef.current.h : next.h, s: next.s, v: next.v };
    hsvRef.current = merged;
    setHsv(merged);
  }, [color]); // eslint-disable-line react-hooks/exhaustive-deps

  // The hex field mirrors the colour except while it is being typed into, where
  // overwriting the draft would fight the user's keystrokes.
  useEffect(() => {
    if (!hexFocused) setHexDraft(hex);
  }, [hex, hexFocused]);

  // The parent owns the colour, and it lives on a screen big enough that a
  // re-render per touch frame is wasteful. Drags emit at ~25/sec; the end of a
  // gesture always emits, so the settled value is never the throttled-away one.
  const lastEmit = useRef(0);
  const emit = useCallback((value, { flush = false, commit = false } = {}) => {
    const now = Date.now();
    if (flush || now - lastEmit.current >= 40) {
      lastEmit.current = now;
      onChange?.(value);
    }
    // Typing in the hex field applies immediately but is not a settled value -
    // every keystroke that happens to parse would otherwise land in recents.
    if (commit) onCommit?.(value);
  }, [onChange, onCommit]);

  const applyHsv = useCallback((next, settled) => {
    hsvRef.current = next;
    setHsv(next);
    emit(hsvToHex(next.h, next.s, next.v), { flush: settled, commit: settled });
  }, [emit]);

  const planeHandlers = useDragTracker(useCallback((x, y, phase) => {
    if (width <= 0) return;
    const s = clamp01(x / width);
    const v = 1 - clamp01(y / PLANE_H);
    applyHsv({ h: hsvRef.current.h, s, v }, phase === 'end');
    if (phase === 'start') onDragStateChange?.(true);
    if (phase === 'end') onDragStateChange?.(false);
  }, [width, applyHsv, onDragStateChange]));

  const hueHandlers = useDragTracker(useCallback((x, y, phase) => {
    if (width <= 0) return;
    const h = clamp01(x / width) * 360;
    applyHsv({ h, s: hsvRef.current.s, v: hsvRef.current.v }, phase === 'end');
    if (phase === 'start') onDragStateChange?.(true);
    if (phase === 'end') onDragStateChange?.(false);
  }, [width, applyHsv, onDragStateChange]));

  const pickSwatch = useCallback((c) => {
    const norm = normalizeHex(c);
    if (!norm) return;
    const next = hexToHsv(norm);
    applyHsv({ h: next.s === 0 ? hsvRef.current.h : next.h, s: next.s, v: next.v }, true);
  }, [applyHsv]);

  // Typing applies as soon as the draft is a whole colour, so the plane tracks
  // the field. An unfinished or junk value is left alone until blur, which
  // restores the last good one rather than silently keeping bad text around.
  const onHexChange = useCallback((text) => {
    const cleaned = text.replace(/[^#0-9a-fA-F]/g, '').slice(0, 7);
    setHexDraft(cleaned);
    const norm = normalizeHex(cleaned);
    if (norm) {
      const next = hexToHsv(norm);
      const merged = { h: next.s === 0 ? hsvRef.current.h : next.h, s: next.s, v: next.v };
      hsvRef.current = merged;
      setHsv(merged);
      emit(norm, { flush: true });
    }
  }, [emit]);

  // Leaving the field is what settles a typed colour, so that is where it enters
  // recents - one entry for the colour, not one per keystroke on the way to it.
  const onHexBlur = useCallback(() => {
    setHexFocused(false);
    setHexDraft(hex);
    emit(hex, { flush: true, commit: true });
  }, [hex, emit]);

  const swatches = useMemo(() => {
    const seen = new Set();
    return [...presets, ...recents]
      .map(normalizeHex)
      .filter(c => c && !seen.has(c) && seen.add(c));
  }, [presets, recents]);

  const thumbX = width > 0 ? hsv.s * width : 0;
  const thumbY = (1 - hsv.v) * PLANE_H;
  const hueX = width > 0 ? (hsv.h / 360) * width : 0;

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <View style={styles.swatchRow}>
        {swatches.map(c => (
          <TouchableOpacity
            key={c}
            accessibilityRole="button"
            accessibilityLabel={`Colour ${c}`}
            style={[styles.swatch, { backgroundColor: c }, hex === c && styles.swatchSelected]}
            onPress={() => pickSwatch(c)}
          />
        ))}
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={open ? 'Hide colour picker' : 'Show colour picker'}
          style={[styles.customBtn, open && styles.customBtnOpen]}
          onPress={() => setOpen(o => !o)}
        >
          <MaterialIcons name="tune" size={16} color={open ? '#000' : '#2ECC71'} />
        </TouchableOpacity>
      </View>

      {open && width > 0 && (
        <View style={styles.panel}>
          <View style={{ width, height: PLANE_H }} {...planeHandlers}>
            <SVPlaneGradient hue={hsv.h} width={width} height={PLANE_H} gid={gid} />
            <View pointerEvents="none" style={[styles.planeThumb, {
              left: thumbX - PLANE_THUMB / 2, top: thumbY - PLANE_THUMB / 2, backgroundColor: hex,
            }]} />
          </View>

          <View style={{ width, height: HUE_H, marginTop: 16 }} {...hueHandlers}>
            <HueTrack width={width} height={HUE_H} gid={gid} />
            <View pointerEvents="none" style={[styles.hueThumb, {
              left: Math.max(0, Math.min(width - HUE_THUMB, hueX - HUE_THUMB / 2)),
              backgroundColor: hsvToHex(hsv.h, 1, 1),
            }]} />
          </View>

          <View style={styles.hexRow}>
            <View style={[styles.preview, { backgroundColor: hex }]}>
              <Text style={[styles.previewText, { color: readableOn(hex) }]}>Aa</Text>
            </View>
            <View style={styles.hexField}>
              <Text style={styles.hexLabel}>HEX</Text>
              <TextInput
                style={styles.hexInput}
                value={hexDraft}
                onChangeText={onHexChange}
                onFocus={() => setHexFocused(true)}
                onBlur={onHexBlur}
                onSubmitEditing={onHexBlur}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={7}
                placeholder="#ffffff"
                placeholderTextColor="#555"
                selectTextOnFocus
              />
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const PLANE_THUMB = 22;
const HUE_THUMB = 20;

const styles = StyleSheet.create({
  swatchRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginBottom: 8 },
  swatch: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: '#333' },
  swatchSelected: { borderWidth: 3, borderColor: '#2ECC71' },
  customBtn: {
    width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2ECC71',
  },
  customBtnOpen: { backgroundColor: '#2ECC71', borderColor: '#2ECC71' },

  panel: { marginTop: 6, marginBottom: 4 },
  planeThumb: {
    position: 'absolute', width: PLANE_THUMB, height: PLANE_THUMB, borderRadius: PLANE_THUMB / 2,
    borderWidth: 3, borderColor: '#fff',
    // The white ring vanishes on the top-left corner of the plane, which is pure
    // white; the shadow is what keeps the thumb findable there.
    shadowColor: '#000', shadowOpacity: 0.6, shadowRadius: 3, shadowOffset: { width: 0, height: 1 },
    elevation: 4,
  },
  hueThumb: {
    position: 'absolute', top: (HUE_H - HUE_THUMB) / 2 - 3,
    width: HUE_THUMB, height: HUE_THUMB + 6, borderRadius: HUE_THUMB / 2,
    borderWidth: 3, borderColor: '#fff',
    shadowColor: '#000', shadowOpacity: 0.6, shadowRadius: 3, shadowOffset: { width: 0, height: 1 },
    elevation: 4,
  },

  hexRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16 },
  preview: {
    width: 52, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#333',
  },
  previewText: { fontSize: 16, fontWeight: 'bold' },
  hexField: {
    flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a1a',
    borderRadius: 10, borderWidth: 1, borderColor: '#2a2a2a', paddingHorizontal: 12, height: 44,
  },
  hexLabel: { color: '#666', fontSize: 11, fontWeight: 'bold', letterSpacing: 1, marginRight: 10 },
  hexInput: { flex: 1, color: '#fff', fontSize: 15, padding: 0 },
});
