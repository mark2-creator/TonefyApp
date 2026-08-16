import React, { useMemo } from 'react';
import Svg, { Rect, Defs, LinearGradient, Stop, G } from 'react-native-svg';

// The waveform on an audio block.
//
// The one this replaces drew a fixed 2px bar per sample with a 1px gap, so 400 samples
// came to 1200px of bars no matter how wide the block was. Inside a container with
// overflow hidden that means a short track showed only the first slice of its audio
// and a long one ran out of waveform early - the picture had no relationship to the
// thing it sat on. Nothing about it was wrong except the one thing that matters: it
// did not line up with time.
//
// Drawn as one SVG rather than N Views. Note what that does NOT buy, because the
// comment here used to claim it: on Android react-native-svg gives every <Rect> its
// own native view, so an SVG of N rects is still a view group with N children. The
// saving is in layout and prop plumbing, not in the view count.
//
// That matters because React Native's Android draw path is O(children^2) per view
// group - drawChild runs once per child and each call asks
// BlendModeHelper.needsIsolatedLayer(this), which iterates every child calling getTag
// (ReactViewGroup.kt:885, BlendModeHelper.kt:50). None of it achieves anything here;
// nothing in this app sets mix-blend-mode, so the answer is always false.
//
// The bar count used to be uncapped at width/3, and an audio block's width is its
// duration times 40px - so a three minute track was ~2,400 bars and ~5.7 MILLION
// getTag calls per frame. That is what ANR'd a Galaxy A23, caught by Sentry with
// needsIsolatedLayer at the top of the main thread.
//
// Two changes, both needed. MAX_BARS caps how many exist at all: under about 25
// seconds of audio nothing changes, and past that the bars widen to keep filling the
// block rather than multiplying. BARS_PER_GROUP then nests them, turning one N^2 into
// g^2 + g*k^2 - together roughly 5.7M calls down to under 10,000, with no visual
// change beyond wider bars on long tracks.
const MAX_BARS = 500;
const BARS_PER_GROUP = 16;

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export default function Waveform({
  peaks, width, height = 14,
  color = '#FFFFFF', opacity = 0.9,
  barWidth = 2, gap = 1, minBar = 1.5,
}) {
  const bars = useMemo(() => {
    const usable = Math.max(0, width || 0);
    const n = Math.max(1, Math.min(MAX_BARS, Math.floor(usable / (barWidth + gap))));
    // Bars widen to keep filling the block once the cap bites, so a long track still
    // reads as a waveform across its whole width instead of stopping part way.
    const pitch = usable / n;
    const drawW = Math.max(1, Math.min(barWidth, pitch - gap));
    if (!peaks || peaks.length === 0) return { n, values: null, pitch, drawW };

    // Resampled to however many bars fit, taking the PEAK of each span rather than
    // the mean. Averaging flattens transients, and a waveform that cannot show a beat
    // is decoration rather than information - which is the whole reason for having one
    // on a music track you are trying to cut against.
    const values = new Array(n);
    for (let i = 0; i < n; i += 1) {
      const from = Math.floor((i / n) * peaks.length);
      const to = Math.max(from + 1, Math.floor(((i + 1) / n) * peaks.length));
      let peak = 0;
      for (let j = from; j < to && j < peaks.length; j += 1) {
        const v = peaks[j];
        if (v > peak) peak = v;
      }
      values[i] = peak;
    }
    return { n, values, pitch, drawW };
  }, [peaks, width, barWidth, gap]);

  if (!width || width < 4) return null;
  const mid = height / 2;
  const id = 'wf';

  return (
    <Svg width={width} height={height}>
      <Defs>
        {/* Brighter through the middle, so the centre line reads as the loud part
            rather than the bars all being one flat tone. */}
        <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity={opacity * 0.55} />
          <Stop offset="0.5" stopColor={color} stopOpacity={opacity} />
          <Stop offset="1" stopColor={color} stopOpacity={opacity * 0.55} />
        </LinearGradient>
      </Defs>
      {chunk(Array.from({ length: bars.n }, (_, i) => i), BARS_PER_GROUP).map((group, gi) => (
      <G key={gi}>
      {group.map((i) => {
        // No peaks yet: a flat centre line, which reads as "loading" rather than as
        // silence. Twenty grey dashes looked like a broken track.
        const v = bars.values ? bars.values[i] : 0;
        const h = Math.max(minBar, v * height);
        return (
          <Rect
            key={i}
            x={i * bars.pitch}
            y={mid - h / 2}
            width={bars.drawW}
            height={h}
            rx={bars.drawW / 2}
            fill={bars.values ? `url(#${id})` : color}
            fillOpacity={bars.values ? 1 : 0.25}
          />
        );
      })}
      </G>
      ))}
    </Svg>
  );
}
