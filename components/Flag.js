import React from 'react';
import Svg, { Rect, Path, G, ClipPath, Defs, Polygon } from 'react-native-svg';

// Flags drawn rather than shipped as emoji or image assets.
//
// Emoji is ruled out by this app's own convention - no emoji anywhere in the UI, a rule
// that was audited to zero - and flag emoji render inconsistently across Android OEMs
// anyway, with several vendors showing two letters instead of a flag. Image assets would
// mean bundling binaries for three countries.
//
// These are deliberate simplifications, not attempts at exactness: at the 14-16px they
// are drawn at, what reads is the colour layout, and detail at that size is noise. The
// US has no stars, and the Australian canton is the Union Jack's cross pattern without
// its diagonals.
function US({ s }) {
  const stripe = s / 13;
  return (
    <Svg width={s * 1.5} height={s} viewBox={`0 0 ${s * 1.5} ${s}`}>
      <Rect width={s * 1.5} height={s} fill="#fff" />
      {Array.from({ length: 7 }, (_, i) => (
        <Rect key={i} y={i * 2 * stripe} width={s * 1.5} height={stripe} fill="#B22234" />
      ))}
      <Rect width={s * 0.6} height={stripe * 7} fill="#3C3B6E" />
    </Svg>
  );
}

function GB({ s }) {
  const w = s * 1.5;
  return (
    <Svg width={w} height={s} viewBox={`0 0 ${w} ${s}`}>
      <Rect width={w} height={s} fill="#012169" />
      <Path d={`M0,0 L${w},${s} M${w},0 L0,${s}`} stroke="#fff" strokeWidth={s * 0.3} />
      <Path d={`M0,0 L${w},${s} M${w},0 L0,${s}`} stroke="#C8102E" strokeWidth={s * 0.14} />
      <Path d={`M${w / 2},0 V${s} M0,${s / 2} H${w}`} stroke="#fff" strokeWidth={s * 0.34} />
      <Path d={`M${w / 2},0 V${s} M0,${s / 2} H${w}`} stroke="#C8102E" strokeWidth={s * 0.2} />
    </Svg>
  );
}

function AU({ s }) {
  const w = s * 1.5;
  const cw = w / 2;
  const ch = s / 2;
  return (
    <Svg width={w} height={s} viewBox={`0 0 ${w} ${s}`}>
      <Rect width={w} height={s} fill="#012169" />
      {/* canton: the Union Jack's crosses, without the diagonals - unreadable this small */}
      <Path d={`M${cw / 2},0 V${ch} M0,${ch / 2} H${cw}`} stroke="#fff" strokeWidth={s * 0.22} />
      <Path d={`M${cw / 2},0 V${ch} M0,${ch / 2} H${cw}`} stroke="#C8102E" strokeWidth={s * 0.12} />
      {/* Commonwealth Star under the canton, and one star in the fly */}
      <Polygon points={`${cw / 2},${ch + s * 0.05} ${cw / 2 + s * 0.09},${ch + s * 0.3} ${cw / 2 - s * 0.09},${ch + s * 0.3}`} fill="#fff" />
      <Polygon points={`${w * 0.74},${s * 0.32} ${w * 0.79},${s * 0.5} ${w * 0.69},${s * 0.5}`} fill="#fff" />
    </Svg>
  );
}

export default function Flag({ country, size = 14 }) {
  if (country === 'GB') return <GB s={size} />;
  if (country === 'AU') return <AU s={size} />;
  return <US s={size} />;
}
