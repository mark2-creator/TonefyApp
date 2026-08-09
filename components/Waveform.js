import React, { useMemo } from 'react';
import Svg, { Rect, Defs, LinearGradient, Stop } from 'react-native-svg';

// The waveform on an audio block.
//
// The one this replaces drew a fixed 2px bar per sample with a 1px gap, so 400 samples
// came to 1200px of bars no matter how wide the block was. Inside a container with
// overflow hidden that means a short track showed only the first slice of its audio
// and a long one ran out of waveform early - the picture had no relationship to the
// thing it sat on. Nothing about it was wrong except the one thing that matters: it
// did not line up with time.
//
// Drawn as a single SVG rather than N Views: one native view instead of a hundred and
// fifty, on a row that has to stay smooth under a scroll.
export default function Waveform({
  peaks, width, height = 14,
  color = '#FFFFFF', opacity = 0.9,
  barWidth = 2, gap = 1, minBar = 1.5,
}) {
  const bars = useMemo(() => {
    const usable = Math.max(0, width || 0);
    const n = Math.max(1, Math.floor(usable / (barWidth + gap)));
    if (!peaks || peaks.length === 0) return { n, values: null };

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
    return { n, values };
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
      {Array.from({ length: bars.n }, (_, i) => {
        // No peaks yet: a flat centre line, which reads as "loading" rather than as
        // silence. Twenty grey dashes looked like a broken track.
        const v = bars.values ? bars.values[i] : 0;
        const h = Math.max(minBar, v * height);
        return (
          <Rect
            key={i}
            x={i * (barWidth + gap)}
            y={mid - h / 2}
            width={barWidth}
            height={h}
            rx={barWidth / 2}
            fill={bars.values ? `url(#${id})` : color}
            fillOpacity={bars.values ? 1 : 0.25}
          />
        );
      })}
    </Svg>
  );
}
