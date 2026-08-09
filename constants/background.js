// The canvas behind the footage.
//
// It only exists once a clip can be FITTED instead of cropped. Until now the export
// always scaled to fill and cropped the overflow, so there was never an empty area
// for a background to occupy - which is why this tab could not be built on its own.
//
// Fill is still the default and still byte-identical to what every existing project
// gets. Fit is the opt-in that makes the rest of this meaningful.

export const FIT_MODES = [
  { id: 'fill', label: 'Fill', icon: 'crop-free', note: 'Crop to fill the frame' },
  { id: 'fit', label: 'Fit', icon: 'fit-screen', note: 'Show the whole shot' },
];

export const BG_TYPES = [
  { id: 'blur', label: 'Blur', icon: 'blur-on', note: 'The shot itself, blurred' },
  { id: 'colour', label: 'Colour', icon: 'palette', note: 'A flat colour' },
];

// Neutrals first: a background is meant to sit behind the subject, not compete with
// it, and black or white is what nearly every fitted video wants.
export const BG_COLOURS = [
  '#000000', '#FFFFFF', '#111111', '#F5F5F5',
  '#2ECC71', '#00d4d4', '#1E3A8A', '#7C3AED',
  '#DC2626', '#F59E0B', '#EC4899', '#065F46',
];

export const DEFAULT_BACKGROUND = {
  fit: 'fill',
  type: 'blur',
  colour: '#000000',
  // Sigma for the blurred backdrop. 20 is heavy enough that the backdrop reads as
  // texture rather than as a second, smaller copy of the video.
  blur: 20,
};

/** Whether the project is doing anything other than the old fill-and-crop. */
export function backgroundActive(bg) {
  return !!bg && bg.fit === 'fit';
}

export function normaliseBackground(bg) {
  const b = { ...DEFAULT_BACKGROUND, ...(bg || {}) };
  return {
    fit: b.fit === 'fit' ? 'fit' : 'fill',
    type: b.type === 'colour' ? 'colour' : 'blur',
    colour: /^#[0-9a-fA-F]{6}$/.test(b.colour) ? b.colour : '#000000',
    blur: Math.max(0, Math.min(60, Number(b.blur) || 0)),
  };
}
