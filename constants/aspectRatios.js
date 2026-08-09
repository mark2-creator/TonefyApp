// The shapes a project can be exported in.
//
// `w`/`h` are the ratio, not pixels. The export keeps the SHORT edge at the chosen
// resolution and derives the long one, so 1080p means 1080x1920 in portrait and
// 1920x1080 in landscape rather than a portrait video quietly losing half its height
// when someone switches to 16:9.
//
// Pure data. The server derives the same numbers from the same ratio.

export const ASPECT_RATIOS = [
  { id: '9:16', label: '9:16', w: 9, h: 16, note: 'TikTok, Reels, Shorts' },
  { id: '4:5', label: '4:5', w: 4, h: 5, note: 'Instagram feed' },
  { id: '1:1', label: '1:1', w: 1, h: 1, note: 'Square' },
  { id: '16:9', label: '16:9', w: 16, h: 9, note: 'YouTube, landscape' },
  { id: '3:4', label: '3:4', w: 3, h: 4, note: 'Classic portrait' },
  { id: '2:3', label: '2:3', w: 2, h: 3, note: 'Photo portrait' },
];

export const DEFAULT_ASPECT = '9:16';

const BY_ID = new Map(ASPECT_RATIOS.map(a => [a.id, a]));

export function resolveAspect(id) {
  return BY_ID.get(id) || BY_ID.get(DEFAULT_ASPECT);
}

/**
 * Fit the ratio inside a box, returning the largest frame that fits.
 *
 * Both bounds matter: a 9:16 frame given the full width would run off the bottom of
 * the screen, and a 16:9 frame held to a portrait width would come out tiny. Fitting
 * inside a box lets a landscape project use the width it has.
 */
export function fitAspect(id, maxW, maxH) {
  const a = resolveAspect(id);
  let w = maxW;
  let h = (maxW * a.h) / a.w;
  if (h > maxH) {
    h = maxH;
    w = (maxH * a.w) / a.h;
  }
  return { w: Math.round(w), h: Math.round(h) };
}
