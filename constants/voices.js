// The voice catalogue, in one place.
//
// EditVideoScreen and IdeaToVideoScreen each carried their own copy and they had
// already drifted: the editor's entries had no `icon` field at all, so its cards
// rendered a MaterialIcons element with name={undefined} - which draws nothing, which is why
// those cards looked like they were missing their picture.
//
// `id` must match VOICES in ~/Tonefy-react/backend/server.js; the backend gates which
// of them a plan may use (FREE_VOICES in tiers.js) and picks the engine from the same
// id. Adding one here without adding it there gets a 403 at generation time.
export const VOICES = [
  { id: 'gtts-us',    label: 'Sarah',  accent: 'US Female',   country: 'US', tint: '#2ECC71' },
  { id: 'gtts-uk',    label: 'Emma',   accent: 'UK Female',   country: 'GB', tint: '#00d4d4' },
  { id: 'gtts-au',    label: 'Olivia', accent: 'AU Female',   country: 'AU', tint: '#f5c451' },
  { id: 'edge-guy',   label: 'Guy',    accent: 'US Male',     country: 'US', tint: '#7aa2ff' },
  { id: 'edge-ryan',  label: 'Ryan',   accent: 'UK Male',     country: 'GB', tint: '#b98cff' },
  { id: 'edge-brian', label: 'Brian',  accent: 'Deep Male',   country: 'US', tint: '#ff8f6b' },
  { id: 'edge-aria',  label: 'Aria',   accent: 'US Female 2', country: 'US', tint: '#58e5c2' },
  { id: 'edge-sonia', label: 'Sonia',  accent: 'UK Female 2', country: 'GB', tint: '#ff6b9d' },
];

export function voiceById(id) {
  return VOICES.find(v => v.id === id) || VOICES[0];
}
