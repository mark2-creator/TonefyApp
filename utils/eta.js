// "About 2 minutes left" from a stream of percentages.
//
// A percentage alone does not answer the question people actually have, which is whether
// to wait or put the phone down. 43% means nothing without a rate; two minutes means
// something immediately.
//
// Deliberately smoothed and deliberately coarse. A naive estimate from the last two
// samples swings wildly on a mobile connection - "5 minutes left" then "20 seconds" then
// "8 minutes" - which is worse than no estimate, because it reads as the app guessing.
// This averages over a window and rounds hard, so it moves slowly and is usually right
// about the order of magnitude even when it is wrong about the number.

const WINDOW_MS = 20000;   // rate is measured over the last 20s, not the whole download
const MIN_SAMPLES = 3;     // below this any estimate is noise
const MIN_ELAPSED_MS = 4000; // and so is anything from the first few seconds

export function createEta() {
  const samples = [];
  return {
    /** Feed it a percentage (0-100). Returns a label, or '' when it cannot say yet. */
    push(percent) {
      const now = Date.now();
      const p = Math.max(0, Math.min(100, Number(percent) || 0));
      samples.push({ t: now, p });
      while (samples.length > 2 && now - samples[0].t > WINDOW_MS) samples.shift();

      if (samples.length < MIN_SAMPLES) return '';
      const first = samples[0];
      const last = samples[samples.length - 1];
      const dt = last.t - first.t;
      const dp = last.p - first.p;
      // No measurable progress yet, or it went backwards: say nothing rather than
      // invent a number.
      if (dt < MIN_ELAPSED_MS || dp <= 0) return '';

      const remaining = ((100 - last.p) / dp) * dt;
      return formatEta(remaining);
    },
    reset() { samples.length = 0; },
  };
}

export function formatEta(ms) {
  const s = Math.round(ms / 1000);
  if (s <= 0) return '';
  // Rounded to units people actually think in. "About 97 seconds left" is precision
  // nobody asked for and cannot be right anyway.
  if (s < 15) return 'almost done';
  if (s < 90) return `about ${Math.round(s / 10) * 10}s left`;
  const m = Math.round(s / 60);
  if (m < 60) return `about ${m} min left`;
  const h = Math.round(m / 60);
  return `about ${h} hr left`;
}
