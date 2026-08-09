// Manual colour adjustment: the sliders behind the Adjust tab.
//
// Each control is a value from -100 to 100 with 0 meaning untouched, and knows how to
// express itself as a fragment of an ffmpeg filter chain. That chain is appended to
// the one the chosen filter produces, so a grade and a hand adjustment compose - and
// because the server already accepts a chain from the app, this needs no backend
// change at all.
//
// Pure data and pure functions, no imports.
//
// Every mapping below is deliberately conservative at the extremes. A slider that
// reaches -100 should still leave a usable picture; one that clips to black at 80%
// of its travel is a slider with 20% of it wasted.

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// n is -100..100 -> a multiplier around 1, spanning [1-down, 1+up]
const scale = (n, down, up) => (n >= 0 ? 1 + (n / 100) * up : 1 - (-n / 100) * down);

export const ADJUSTMENTS = [
  {
    key: 'brightness', label: 'Brightness', icon: 'brightness-6',
    // eq brightness is -1..1 and anything past about a third is already washed out.
    build: n => `eq=brightness=${(n / 100 * 0.3).toFixed(3)}`,
  },
  {
    key: 'contrast', label: 'Contrast', icon: 'contrast',
    build: n => `eq=contrast=${scale(n, 0.5, 0.8).toFixed(3)}`,
  },
  {
    key: 'saturation', label: 'Saturation', icon: 'palette',
    // Down to fully grey, up to a hard but not radioactive boost.
    build: n => `eq=saturation=${scale(n, 1.0, 1.2).toFixed(3)}`,
  },
  {
    key: 'temperature', label: 'Temp', icon: 'device-thermostat',
    // Warm and cool move red and blue in opposite directions, which is what a colour
    // temperature actually is - lifting every channel just changes exposure.
    build: (n) => {
      const t = (n / 100) * 0.3;
      return `colorbalance=rm=${t.toFixed(3)}:bm=${(-t).toFixed(3)}`;
    },
  },
  {
    key: 'tint', label: 'Tint', icon: 'colorize',
    // The other axis: green against magenta.
    build: (n) => {
      const t = (n / 100) * 0.25;
      return `colorbalance=gm=${t.toFixed(3)}:rm=${(-t / 2).toFixed(3)}:bm=${(-t / 2).toFixed(3)}`;
    },
  },
  {
    key: 'highlights', label: 'Highlights', icon: 'wb-sunny',
    // Curves, because this has to move the top of the range and leave the rest alone.
    build: (n) => {
      const top = clamp(1 + (n / 100) * 0.25, 0.5, 1);
      return `curves=all=0/0 0.5/0.5 1/${top.toFixed(3)}`;
    },
  },
  {
    key: 'shadows', label: 'Shadows', icon: 'nightlight',
    build: (n) => {
      const foot = clamp((n / 100) * 0.25, -0.25, 0.25);
      return `curves=all=0/${Math.max(0, foot).toFixed(3)} 0.5/0.5 1/1`;
    },
  },
  {
    key: 'sharpen', label: 'Sharpen', icon: 'details',
    // One-sided: the negative half of a sharpen is a blur, and there is a separate
    // control for that in nobody's mental model of this slider.
    build: n => (n > 0 ? `unsharp=5:5:${(n / 100 * 1.5).toFixed(2)}` : null),
  },
  {
    key: 'vignette', label: 'Vignette', icon: 'vignette',
    build: n => (n > 0 ? 'vignette' : null),
  },
  {
    key: 'grain', label: 'Grain', icon: 'grain',
    build: n => (n > 0 ? `noise=alls=${Math.round(n / 100 * 40)}:allf=t` : null),
  },
];

export const ADJUST_DEFAULTS = ADJUSTMENTS.reduce((acc, a) => { acc[a.key] = 0; return acc; }, {});

/** Whether anything has been moved off centre. */
export function hasAdjustments(adjust) {
  if (!adjust) return false;
  return ADJUSTMENTS.some(a => Math.round(Number(adjust[a.key]) || 0) !== 0);
}

/** The ffmpeg fragments for a set of values, skipping everything left at zero. */
export function adjustChain(adjust) {
  if (!adjust) return [];
  const out = [];
  for (const a of ADJUSTMENTS) {
    const n = Math.round(Number(adjust[a.key]) || 0);
    if (n === 0) continue;
    const part = a.build(clamp(n, -100, 100));
    if (part) out.push(part);
  }
  return out;
}
