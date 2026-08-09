// The sticker catalogue.
//
// A sticker is an image the user drops on the canvas and moves like any other
// overlay - so it reuses the media-overlay path entirely: CanvasOverlay for the
// gestures, and the server's overlay filter for the burn-in. The only thing that
// makes it a sticker is where the picture comes from.
//
// It comes from the SERVER, not the app bundle. Two reasons, and the second is the
// important one: the tiles would add megabytes to every over-the-air update, and the
// export needs the file anyway - a sticker already on the server is composited
// straight from disk with no upload at all, where a bundled one would have to be
// shipped to the phone and then sent back.
//
// Pure data; scripts/gen-stickers.mjs renders from it.

const S = (id, glyph, label, category, premium = true) => ({ id, glyph, label, category, premium });

export const STICKERS = [
  // --- Reactions: the free set. Enough to be useful without paying.
  S('fire', '🔥', 'Fire', 'Reactions', false),
  S('heart', '❤️', 'Heart', 'Reactions', false),
  S('star', '⭐', 'Star', 'Reactions', false),
  S('laugh', '😂', 'Laugh', 'Reactions', false),
  S('wow', '😮', 'Wow', 'Reactions', false),
  S('clap', '👏', 'Clap', 'Reactions', false),
  S('thumbsup', '👍', 'Thumbs Up', 'Reactions', false),
  S('eyes', '👀', 'Eyes', 'Reactions', false),
  S('hundred', '💯', 'Hundred', 'Reactions', false),
  S('sparkles', '✨', 'Sparkles', 'Reactions', false),

  // --- Faces
  S('cool', '😎', 'Cool', 'Faces'), S('cry', '😭', 'Crying', 'Faces'),
  S('think', '🤔', 'Thinking', 'Faces'), S('wink', '😉', 'Wink', 'Faces'),
  S('love', '😍', 'Heart Eyes', 'Faces'), S('shock', '😱', 'Screaming', 'Faces'),
  S('smirk', '😏', 'Smirk', 'Faces'), S('sleepy', '😴', 'Sleepy', 'Faces'),
  S('angry', '😡', 'Angry', 'Faces'), S('party', '🥳', 'Partying', 'Faces'),
  S('nerd', '🤓', 'Nerd', 'Faces'), S('shush', '🤫', 'Shush', 'Faces'),
  S('melt', '🫠', 'Melting', 'Faces'), S('salute', '🫡', 'Salute', 'Faces'),
  S('skull', '💀', 'Skull', 'Faces'), S('ghost', '👻', 'Ghost', 'Faces'),
  S('alien', '👽', 'Alien', 'Faces'), S('robot', '🤖', 'Robot', 'Faces'),
  S('clown', '🤡', 'Clown', 'Faces'), S('cowboy', '🤠', 'Cowboy', 'Faces'),

  // --- Hands
  S('ok', '👌', 'OK', 'Hands'), S('pray', '🙏', 'Pray', 'Hands'),
  S('muscle', '💪', 'Muscle', 'Hands'), S('point', '👉', 'Point', 'Hands'),
  S('pointdown', '👇', 'Point Down', 'Hands'), S('pointup', '👆', 'Point Up', 'Hands'),
  S('wave', '👋', 'Wave', 'Hands'), S('peace', '✌️', 'Peace', 'Hands'),
  S('fist', '✊', 'Fist', 'Hands'), S('handshake', '🤝', 'Handshake', 'Hands'),
  S('writing', '✍️', 'Writing', 'Hands'), S('crossed', '🤞', 'Fingers Crossed', 'Hands'),

  // --- Social: the ones a creator actually reaches for.
  S('like', '💖', 'Sparkle Heart', 'Social'), S('bell', '🔔', 'Bell', 'Social'),
  S('megaphone', '📢', 'Megaphone', 'Social'), S('link', '🔗', 'Link', 'Social'),
  S('camera', '📸', 'Camera', 'Social'), S('phone', '📱', 'Phone', 'Social'),
  S('laptop', '💻', 'Laptop', 'Social'), S('mail', '📩', 'Mail', 'Social'),
  S('pin', '📌', 'Pin', 'Social'), S('calendar', '📅', 'Calendar', 'Social'),
  S('chart', '📈', 'Chart Up', 'Social'), S('money', '💰', 'Money', 'Social'),
  S('cart', '🛒', 'Cart', 'Social'), S('gift', '🎁', 'Gift', 'Social'),
  S('label', '🏷️', 'Tag', 'Social'), S('search', '🔍', 'Search', 'Social'),

  // --- Symbols and marks
  S('check', '✅', 'Check', 'Symbols'), S('cross', '❌', 'Cross', 'Symbols'),
  S('warning', '⚠️', 'Warning', 'Symbols'), S('question', '❓', 'Question', 'Symbols'),
  S('exclaim', '❗', 'Exclaim', 'Symbols'), S('arrowr', '➡️', 'Arrow Right', 'Symbols'),
  S('arrowl', '⬅️', 'Arrow Left', 'Symbols'), S('arrowu', '⬆️', 'Arrow Up', 'Symbols'),
  S('arrowd', '⬇️', 'Arrow Down', 'Symbols'), S('loop', '🔁', 'Repeat', 'Symbols'),
  S('new', '🆕', 'New', 'Symbols'), S('free', '🆓', 'Free', 'Symbols'),
  S('sos', '🆘', 'SOS', 'Symbols'), S('bolt', '⚡', 'Bolt', 'Symbols'),
  S('crown', '👑', 'Crown', 'Symbols'), S('trophy', '🏆', 'Trophy', 'Symbols'),
  S('medal', '🥇', 'Gold Medal', 'Symbols'), S('target', '🎯', 'Target', 'Symbols'),
  S('rocket', '🚀', 'Rocket', 'Symbols'), S('bulb', '💡', 'Idea', 'Symbols'),

  // --- Mood and scene
  S('sun', '☀️', 'Sun', 'Mood'), S('moon', '🌙', 'Moon', 'Mood'),
  S('cloud', '☁️', 'Cloud', 'Mood'), S('rain', '🌧️', 'Rain', 'Mood'),
  S('snow', '❄️', 'Snow', 'Mood'), S('rainbow', '🌈', 'Rainbow', 'Mood'),
  S('wave2', '🌊', 'Wave', 'Mood'), S('palm', '🌴', 'Palm', 'Mood'),
  S('flower', '🌸', 'Blossom', 'Mood'), S('rose', '🌹', 'Rose', 'Mood'),
  S('leaf', '🍃', 'Leaf', 'Mood'), S('globe', '🌍', 'Globe', 'Mood'),
  S('music', '🎵', 'Music', 'Mood'), S('mic', '🎤', 'Mic', 'Mood'),
  S('film', '🎬', 'Clapper', 'Mood'), S('game', '🎮', 'Game', 'Mood'),
  S('coffee', '☕', 'Coffee', 'Mood'), S('pizza', '🍕', 'Pizza', 'Mood'),
  S('cake', '🎂', 'Cake', 'Mood'), S('balloon', '🎈', 'Balloon', 'Mood'),
  S('confetti', '🎉', 'Confetti', 'Mood'), S('sportsfire', '🏀', 'Basketball', 'Mood'),
  S('football', '⚽', 'Football', 'Mood'), S('car', '🚗', 'Car', 'Mood'),
  S('plane', '✈️', 'Plane', 'Mood'), S('house', '🏠', 'House', 'Mood'),
  S('dog', '🐶', 'Dog', 'Mood'), S('cat', '🐱', 'Cat', 'Mood'),
];

export const STICKER_CATEGORIES = ['Reactions', 'Faces', 'Hands', 'Social', 'Symbols', 'Mood'];

const BY_ID = new Map(STICKERS.map(s => [s.id, s]));
export function resolveSticker(id) { return BY_ID.get(id) || null; }
export function isPremiumSticker(id) { return !!BY_ID.get(id)?.premium; }
