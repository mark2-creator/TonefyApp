import React, { useEffect, useRef, useState } from 'react';
import { Animated, PanResponder, StyleSheet, Text, View } from 'react-native';
import FilmStrip from './FilmStrip';

// How wide the grab targets are. They sit *inside* the window's edges rather than
// outside it, so a clip trimmed to the very start of its source still has a left
// handle on screen to pull back out with.
const HANDLE_W = 22;

// FilmStrip lays out up to 160 tiles. Its props do not change while a handle is being
// dragged - the strip is the whole source and stays put, only the window over it
// moves - so memoising it keeps the drag from walking that list every frame.
const MemoFilmStrip = React.memo(FilmStrip);

/**
 * The trim sheet's strip: the whole source file laid out across the sheet, with the
 * kept region bright between two handles and everything to be cut away dimmed.
 *
 * The point of this over two sliders is that a trim is a decision about *pictures* -
 * where the shot changes, where the subject starts talking - and a number in seconds
 * does not carry any of that. It is the same reasoning that put frames on the
 * timeline clips, so this draws them with the same component: whatever a clip's strip
 * looks like, this looks like too, and neither can drift from the other.
 *
 * Geometry is Animated and the commit happens once, on release. Dragging writes two
 * numbers and nothing re-renders; the readout under the strip is the one thing that
 * has to be React state, and it is throttled rather than written every frame.
 */
export default function TrimStrip({
  uri, type, sourceDuration, trimStart, trimEnd, width, height = 64, minDur = 0.3, onChange,
}) {
  const dur = sourceDuration > 0 ? sourceDuration : 0;
  const pps = dur > 0 ? width / dur : 0;

  // Seeded with the real geometry rather than 0: these initialisers run on the first
  // render, and the effect below that syncs them lands a frame later - long enough for
  // both handles to be seen sitting at the left edge as the sheet slides up.
  const startX = useRef(new Animated.Value(trimStart * pps)).current;
  const endX = useRef(new Animated.Value(trimEnd * pps)).current;
  // Where the handles are right now, in seconds, whether or not a drag has committed.
  const liveRef = useRef({ start: trimStart, end: trimEnd });
  // Where they were when the finger went down.
  const dragRef = useRef({ start: trimStart, end: trimEnd });
  const [readout, setReadout] = useState({ start: trimStart, end: trimEnd });
  const lastReadRef = useRef(0);

  // A PanResponder is built once and would otherwise clamp against whatever scale and
  // bounds existed on the first render. Neither is stable here: sourceDuration is
  // measured in the background for footage the picker never reported a length for, and
  // pps moves with it. This is the same trap the audio-track drag hit (e1937cfe).
  const cfgRef = useRef(null);
  cfgRef.current = { pps, dur, minDur, trimStart, trimEnd, onChange };

  const pushReadout = (start, end, force) => {
    const now = Date.now();
    if (!force && now - lastReadRef.current < 60) return;
    lastReadRef.current = now;
    setReadout({ start, end });
  };

  // Adopt values that changed from outside a drag: opening the sheet on another clip,
  // and the background measurement landing and rescaling the whole strip.
  useEffect(() => {
    liveRef.current = { start: trimStart, end: trimEnd };
    startX.setValue(trimStart * pps);
    endX.setValue(trimEnd * pps);
    pushReadout(trimStart, trimEnd, true);
  }, [trimStart, trimEnd, pps]);

  const makeHandle = (side) => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (e, g) => Math.abs(g.dx) > 2,
    // Nothing here scrolls today, but a sheet that grows past the screen will get a
    // ScrollView, and it would ask for the touch back the moment the finger moves
    // sideways - which is every trim.
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => { dragRef.current = { ...liveRef.current }; },
    onPanResponderMove: (e, g) => {
      const cfg = cfgRef.current;
      if (!cfg.pps) return;
      const { start, end } = dragRef.current;
      const dSec = g.dx / cfg.pps;
      // Clamped here rather than at the commit, so an edge stops where the footage
      // does instead of running past and snapping back on release.
      const next = side === 'left'
        ? { start: Math.max(0, Math.min(start + dSec, end - cfg.minDur)), end }
        : { start, end: Math.min(cfg.dur, Math.max(end + dSec, start + cfg.minDur)) };
      liveRef.current = next;
      startX.setValue(next.start * cfg.pps);
      endX.setValue(next.end * cfg.pps);
      pushReadout(next.start, next.end);
    },
    onPanResponderRelease: () => {
      const { start, end } = liveRef.current;
      pushReadout(start, end, true);
      cfgRef.current.onChange(start, end);
    },
    onPanResponderTerminate: () => {
      // The gesture was taken away, so nothing was decided. Go back to the committed
      // window rather than leaving the handles wherever the finger got to.
      const cfg = cfgRef.current;
      liveRef.current = { start: cfg.trimStart, end: cfg.trimEnd };
      startX.setValue(cfg.trimStart * cfg.pps);
      endX.setValue(cfg.trimEnd * cfg.pps);
      pushReadout(cfg.trimStart, cfg.trimEnd, true);
    },
  });

  const leftPan = useRef(makeHandle('left')).current;
  const rightPan = useRef(makeHandle('right')).current;

  if (!dur) {
    return (
      <View style={[styles.empty, { width, height }]}>
        <Text style={styles.emptyText}>Still measuring this clip</Text>
      </View>
    );
  }

  const windowW = Animated.subtract(endX, startX);

  return (
    <View>
      <View style={[styles.strip, { width, height }]}>
        <MemoFilmStrip
          uri={uri}
          type={type}
          sourceDuration={dur}
          width={width}
          height={height}
          offset={0}
          pixelsPerSecond={pps}
        />

        {/* What the trim throws away. Dimming it rather than hiding it is the whole
            point: you are choosing an edge, so both sides have to stay visible. */}
        <Animated.View pointerEvents="none" style={[styles.dim, { left: 0, width: startX, height }]} />
        <Animated.View pointerEvents="none" style={[styles.dim, { left: endX, right: 0, height }]} />

        {/* Teal, because a trim handle is you working the footage, not a commit. */}
        <Animated.View
          pointerEvents="none"
          style={[styles.window, { left: startX, width: windowW, height }]}
        />

        <Animated.View style={[styles.handle, styles.handleLeft, { left: startX, height }]} {...leftPan.panHandlers}>
          <View style={styles.grip} />
        </Animated.View>
        <Animated.View
          style={[styles.handle, styles.handleRight, { left: Animated.subtract(endX, HANDLE_W), height }]}
          {...rightPan.panHandlers}>
          <View style={styles.grip} />
        </Animated.View>
      </View>

      <View style={styles.readoutRow}>
        <Text style={styles.readoutEdge}>{readout.start.toFixed(1)}s</Text>
        <Text style={styles.readoutLen}>
          {Math.max(0, readout.end - readout.start).toFixed(1)}s of {dur.toFixed(1)}s
        </Text>
        <Text style={styles.readoutEdge}>{readout.end.toFixed(1)}s</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { borderRadius: 8, overflow: 'hidden', backgroundColor: '#1a1a1a' },
  dim: { position: 'absolute', top: 0, backgroundColor: 'rgba(0,0,0,0.62)' },
  window: { position: 'absolute', top: 0, borderWidth: 2, borderColor: '#00d4d4', borderRadius: 4 },
  handle: {
    position: 'absolute', top: 0, width: HANDLE_W,
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#00d4d4',
  },
  handleLeft: { borderTopLeftRadius: 4, borderBottomLeftRadius: 4 },
  handleRight: { borderTopRightRadius: 4, borderBottomRightRadius: 4 },
  grip: { width: 2, height: 18, borderRadius: 1, backgroundColor: '#04211f' },
  readoutRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  readoutEdge: { color: '#888', fontSize: 12 },
  readoutLen: { color: '#fff', fontSize: 12, fontWeight: '600' },
  empty: {
    borderRadius: 8, backgroundColor: '#1a1a1a', alignItems: 'center', justifyContent: 'center',
  },
  emptyText: { color: '#888', fontSize: 12 },
});
