// Audio effects, for a clip's own sound or for an audio track.
//
// IDs ONLY travel to the server. Unlike constants/effects.js, constants/motions.js and
// constants/transitions.js - which each carry a real ffmpeg chain that the backend
// validates and runs - this file carries no filter strings at all. The chains live in
// AUDIO_FX in server.js and are looked up by id.
//
// That asymmetry is deliberate rather than an oversight. The video catalogues are large
// and grow often, and shipping the recipe with the app is what lets a new effect appear
// without a backend deploy. This catalogue is small, so it can afford the safer shape:
// an unknown id renders nothing, and no caller-supplied text reaches a command line.
//
// The cost of that choice, stated plainly: adding an effect here needs a matching entry
// in server.js and a pm2 restart. Adding one to this file alone does nothing - the id
// will not resolve and the sound will come back unchanged.
//
// Every chain behind these was rendered against real speech and MEASURED before it was
// offered here (see the AUDIO_FX comment in server.js for the per-class instruments and
// the numbers). None of them is a plausible-looking filter string nobody listened to.
//
// No audition. Selecting an effect does not change what the preview canvas plays - the
// canvas plays the raw clip, and these are applied at export. `expo-av` can shift rate
// and pitch but has no reverb or EQ, so an honest preview would mean a server round trip
// per tap. The descriptions below carry that weight instead, and each one says what the
// result SOUNDS like rather than naming the filter that makes it.
const F = (id, label, category, desc) => ({ id, label, category, desc });

export const AUDIO_FX_CATEGORIES = ['Space', 'Tone', 'Voice', 'Character'];

export const AUDIO_FX = [
  // Space - size and distance. Ordered smallest room to largest.
  F('room',        'Room',         'Space',     'A small, close space. Takes the dryness off a voice.'),
  F('slapback',    'Slapback',     'Space',     'One distinct repeat, close behind. Rockabilly vocals.'),
  F('hall',        'Hall',         'Space',     'A larger room with a real tail. Good under narration.'),
  F('cathedral',   'Cathedral',    'Space',     'Long, wide and slow. Everything becomes solemn.'),
  F('stadium',     'Stadium',      'Space',     'Huge and far away, with the low end lifted.'),

  // Tone - the same performance, differently balanced.
  F('bassboost',   'Bass Boost',   'Tone',      'Weight and body. Lifts the low end hard.'),
  F('trebleboost', 'Treble Boost', 'Tone',      'Air and detail at the top.'),
  F('warm',        'Warm',         'Tone',      'Fuller low end, softer highs. Easier to listen to.'),
  F('bright',      'Bright',       'Tone',      'Forward and crisp. Cuts through a busy mix.'),
  F('deess',       'De-ess',       'Tone',      'Tames harsh S sounds without dulling the voice.'),
  F('loudness',    'Loudness',     'Tone',      'Evens the level to broadcast loudness. No tone change.'),

  // Voice - the speaker themselves.
  F('deep',        'Deep Voice',   'Voice',     'Drops the pitch. Bigger, slower, heavier.'),
  F('downtone',    'Down a Tone',  'Voice',     'A subtle drop - still clearly the same person.'),
  F('uptone',      'Up a Tone',    'Voice',     'A subtle lift - still clearly the same person.'),
  F('chipmunk',    'Chipmunk',     'Voice',     'Well above natural pitch. Comic, not subtle.'),
  F('robot',       'Robot',        'Voice',     'Strips the natural variation out. Flat and synthetic.'),

  // Character - a voice heard through something.
  F('telephone',   'Telephone',    'Character', 'Narrow and thin, like a phone line.'),
  F('radio',       'Radio',        'Character', 'Squashed and punchy, like an AM broadcast.'),
  F('podcast',     'Podcast',      'Character', 'Clean, close and even. The default for spoken word.'),
  F('megaphone',   'Megaphone',    'Character', 'Harsh and clipped, shouted through a cone.'),
  F('underwater',  'Underwater',   'Character', 'Muffled and swimming. Everything above a murmur is gone.'),
  F('vinyl',       'Vinyl',        'Character', 'Band-limited with a short slap. Old record.'),
  F('bitcrush',    '8-Bit',        'Character', 'Coarse and grainy, like early game hardware.'),
];

export const AUDIO_FX_BY_ID = Object.fromEntries(AUDIO_FX.map(f => [f.id, f]));

export function audioFxLabel(id) {
  return AUDIO_FX_BY_ID[id]?.label || null;
}
