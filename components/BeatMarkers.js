import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';

// Ticks on an audio block showing where the beats fall.
//
// CAPPED AND GROUPED, both deliberately, and for the reason recorded in CLAUDE.md under
// "many sibling views is O(n^2) on Android": ReactViewGroup.drawChild asks
// needsIsolatedLayer once PER CHILD, and that walks every child again - so N siblings in
// one parent cost N*N getTag calls per frame. This is exactly the shape that caught
// Waveform (a 3-minute track drew ~2,400 bars) and FilmStrip, and beats scale with
// content length the same way: a 3-minute track at 100bpm is ~300 of them.
//
// 240 is well past what is legible on a 26px row at 40px/second - beats land ~24px apart
// at 100bpm, so a screen shows about fifteen at a time. The cap only ever bites on
// tracks long enough that the extra ticks are off-screen anyway.
const MAX_MARKERS = 240;
const PER_GROUP = 16;

function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

// Beats are measured against the SOURCE FILE, so a beat at t seconds into the file sits
// at (t - trimStart) into the block. Trimming the head of a track must not slide its
// beats off the audio they belong to.
function BeatMarkers({ beats, trimStart = 0, width, pixelsPerSecond }) {
  const xs = useMemo(() => {
    if (!beats?.length) return [];
    const out = [];
    for (const t of beats) {
      const x = (t - trimStart) * pixelsPerSecond;
      if (x < 0) continue;
      if (x > width) break;              // beats are sorted, so nothing after this fits
      out.push(x);
      if (out.length >= MAX_MARKERS) break;
    }
    return out;
  }, [beats, trimStart, width, pixelsPerSecond]);

  if (!xs.length) return null;

  return (
    <View style={styles.layer} pointerEvents="none">
      {chunk(xs, PER_GROUP).map((group, gi) => (
        <View key={gi} style={styles.group} pointerEvents="none">
          {group.map((x, i) => <View key={i} style={[styles.tick, { left: x }]} />)}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  // Fills the block and sits over the waveform. pointerEvents none throughout, or the
  // ticks would eat the press that selects the track.
  layer: { ...StyleSheet.absoluteFillObject },
  // The group deliberately fills the SAME box as the layer, which looks like the
  // FilmStrip bug (03557326 - group wrappers that inherited an absolute style stacked at
  // left: 0, so a 90-second clip rendered thirteen seconds of frames) and is not.
  //
  // The difference is what the children are. FilmStrip's tiles FLOWED, so a wrapper that
  // did not span the full width truncated the row at one group's worth. These ticks each
  // carry their own absolute `left`, measured from the group's padding box - and because
  // the group fills the layer exactly, that origin is the layer's origin. Grouping is
  // genuinely transparent here; it would not be if the ticks flowed.
  group: { ...StyleSheet.absoluteFillObject },
  tick: { position: 'absolute', top: 0, bottom: 0, width: 1, backgroundColor: 'rgba(255,255,255,0.55)' },
});

export default React.memo(BeatMarkers);
