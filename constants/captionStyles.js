// The caption catalogue. Unlike constants/fonts.js this file is hand-written and
// safe to edit - nothing generates it.
//
// A style is a declarative spec, not a set of flags. The old model was four
// booleans (colour / bold / shadow / bg) plus a branch per special case in the
// renderer, which is why it stopped at a dozen: every new look needed renderer
// code, and twelve booleans' worth of combinations all read as "white text".
// A spec that names the actual typographic parts - face, fill, stroke, glow,
// drop shadow, box, tracking, case - lets a hundred and thirty styles share one
// renderer and still look nothing like each other.
//
// Every field is optional except id/label/category. Omitted means absent, not
// default-on: a style with no `stroke` has no stroke at all.
//
//   font     family name from constants/fonts.js, or omitted for the system face
//   color    fill colour
//   gradient [from, to] - overrides `color`; see CaptionText for how it is drawn
//   stroke   { color, width } outline around the glyphs. Width is the ring's
//            thickness in points at the 18pt base, so it scales with the caption:
//            both the app and the export lay down a ring of width * (size / 18).
//            Rendered as a fraction of the font size that is roughly 0.04 to 0.14
//            - checked against real glyphs, not guessed. Past about 0.15 the rings
//            of adjacent letters touch and a word closes up into one black slug.
//   glow     { color, radius } soft halo, no offset
//   shadow   { color, dx, dy, radius } offset drop shadow
//   box      { color, radius, padX, padY } filled chip behind the text
//   highlight { color, textColor, padX, padY } chip behind the word being spoken
//            right now, rather than behind the whole phrase. Needs word timings,
//            so it only does anything on an auto-caption; a manual overlay has no
//            playhead to be at a word of and renders as if the field were absent.
//            `textColor` recolours that one word so it stays legible on the chip.
//   upper    render in capitals
//   spacing  letter spacing, in points at the 18pt base size
//   scale    multiplier on the base caption size
//   words    words per caption chunk; 1 is the word-by-word "pop" cadence
//
// Ids are permanent. The twelve original ids are still here, restyled but not
// renamed, so projects saved before this catalogue existed still resolve.

export const DEFAULT_CAPTION_STYLE_ID = 'classic';

// The size an unscaled caption is rendered at in the preview canvas. Overlays
// store an absolute size, so `scale` is folded in when the overlay is built.
export const CAPTION_BASE_SIZE = 18;

export const CAPTION_STYLES = [
  // ---------------------------------------------------------------- Trending
  { id: 'classic',    label: 'Classic',     category: 'Trending', font: 'Inter',           color: '#FFFFFF', stroke: { color: '#000000', width: 1.5 }, shadow: { color: '#000000CC', dx: 0, dy: 2, radius: 3 }, upper: true, words: 3 },
  { id: 'tiktok',     label: 'TikTok',      category: 'Trending', font: 'Poppins',         color: '#FFFFFF', stroke: { color: '#000000', width: 2 }, upper: true, scale: 1.15, words: 1 },
  { id: 'bold',       label: 'Impact',      category: 'Trending', font: 'Archivo Black',   color: '#FFFFFF', stroke: { color: '#000000', width: 2.5 }, shadow: { color: '#000000AA', dx: 0, dy: 3, radius: 4 }, upper: true, scale: 1.2, words: 1 },
  { id: 'punch',      label: 'Punch',       category: 'Trending', font: 'Anton',           color: '#FFE24A', stroke: { color: '#000000', width: 2.5 }, upper: true, scale: 1.25, words: 1 },
  { id: 'creator',    label: 'Creator',     category: 'Trending', font: 'Montserrat',      color: '#FFFFFF', stroke: { color: '#000000', width: 1.5 }, shadow: { color: '#00000099', dx: 0, dy: 2, radius: 4 }, words: 3 },
  { id: 'hype',       label: 'Hype',        category: 'Trending', font: 'Luckiest Guy',    color: '#FFFFFF', stroke: { color: '#111111', width: 2.5 }, shadow: { color: '#00000099', dx: 0, dy: 4, radius: 3 }, upper: true, scale: 1.2, words: 1 },
  { id: 'reels',      label: 'Reels',       category: 'Trending', font: 'Figtree',         color: '#FFFFFF', box: { color: '#000000B8', radius: 8, padX: 10, padY: 4 }, words: 4 },
  { id: 'shorts',     label: 'Shorts',      category: 'Trending', font: 'Bebas Neue',      color: '#FFFFFF', stroke: { color: '#000000', width: 1.5 }, upper: true, spacing: 1, scale: 1.3, words: 3 },
  { id: 'viral',      label: 'Viral',       category: 'Trending', font: 'Oswald',          color: '#2ECC71', stroke: { color: '#04240F', width: 2 }, upper: true, scale: 1.15, words: 1 },
  { id: 'streamer',   label: 'Streamer',    category: 'Trending', font: 'Kanit',           color: '#FFFFFF', stroke: { color: '#7C3AED', width: 2 }, glow: { color: '#7C3AED', radius: 8 }, upper: true, words: 1 },
  { id: 'podcast',    label: 'Podcast',     category: 'Trending', font: 'Inter',           color: '#F5F5F5', box: { color: '#0F0F0FD9', radius: 10, padX: 12, padY: 6 }, spacing: 0.3, words: 4 },
  { id: 'clickbait',  label: 'Clickbait',   category: 'Trending', font: 'Bangers',         color: '#FF2D6F', stroke: { color: '#FFFFFF', width: 2 }, shadow: { color: '#000000AA', dx: 2, dy: 3, radius: 2 }, upper: true, scale: 1.25, words: 1 },

  // --------------------------------------------------------------- Highlight
  // The chip follows the voice: the phrase stays on screen and the word being
  // spoken is boxed. These carry a multi-word cadence on purpose - a one-word
  // chunk has nothing to highlight against, so it would read as a plain chip.
  { id: 'hl-yellow',  label: 'Highlight',   category: 'Highlight', font: 'Poppins',       color: '#FFFFFF', stroke: { color: '#000000', width: 1.5 }, highlight: { color: '#FFE24A', textColor: '#1A1400', padX: 6, padY: 2 }, upper: true, words: 3 },
  { id: 'hl-green',   label: 'Karaoke',     category: 'Highlight', font: 'Montserrat',    color: '#FFFFFF', stroke: { color: '#000000', width: 1.5 }, highlight: { color: '#2ECC71', textColor: '#04240F', padX: 6, padY: 2 }, upper: true, words: 3 },
  { id: 'hl-red',     label: 'Hot Word',    category: 'Highlight', font: 'Archivo Black', color: '#FFFFFF', stroke: { color: '#000000', width: 2 }, highlight: { color: '#DC2626', textColor: '#FFFFFF', padX: 6, padY: 2 }, upper: true, words: 3 },
  { id: 'hl-blue',    label: 'Cobalt Beat', category: 'Highlight', font: 'Inter',         color: '#FFFFFF', stroke: { color: '#00000099', width: 1 }, highlight: { color: '#2563EB', textColor: '#FFFFFF', padX: 6, padY: 3 }, words: 4 },
  { id: 'hl-purple',  label: 'Pulse',       category: 'Highlight', font: 'Kanit',         color: '#E9D5FF', stroke: { color: '#2E1065', width: 1.5 }, highlight: { color: '#7C3AED', textColor: '#FFFFFF', padX: 6, padY: 2 }, upper: true, words: 3 },
  { id: 'hl-mono',    label: 'Reader',      category: 'Highlight', font: 'Figtree',       color: '#F5F5F5', box: { color: '#0B0B0BCC', radius: 8, padX: 10, padY: 5 }, highlight: { color: '#FFE24A', textColor: '#1A1400', padX: 5, padY: 2 }, words: 5 },
  { id: 'hl-mint',    label: 'Fresh',       category: 'Highlight', font: 'Outfit',        color: '#FFFFFF', shadow: { color: '#000000AA', dx: 0, dy: 2, radius: 4 }, highlight: { color: '#A7F3D0', textColor: '#052E1B', padX: 6, padY: 2 }, words: 4 },
  { id: 'hl-ink',     label: 'Inkwell',     category: 'Highlight', font: 'Barlow',        color: '#FFFFFF', stroke: { color: '#000000', width: 1.5 }, highlight: { color: '#0B0B0B', textColor: '#FFE24A', padX: 6, padY: 2 }, upper: true, words: 4 },

  // ------------------------------------------------------------- Bold Impact
  { id: 'slab',       label: 'Slab',        category: 'Bold', font: 'Alfa Slab One',   color: '#FFFFFF', stroke: { color: '#000000', width: 2 }, upper: true, scale: 1.1, words: 2 },
  { id: 'heavyweight',label: 'Heavyweight', category: 'Bold', font: 'Ultra',           color: '#FFF7E6', shadow: { color: '#000000B3', dx: 3, dy: 3, radius: 1 }, upper: true, words: 2 },
  { id: 'stadium',    label: 'Stadium',     category: 'Bold', font: 'Squada One',      color: '#FFFFFF', stroke: { color: '#E11D48', width: 2 }, upper: true, spacing: 1.5, scale: 1.25, words: 2 },
  { id: 'headline',   label: 'Headline',    category: 'Bold', font: 'Archivo Black',   color: '#111111', box: { color: '#FFFFFF', radius: 4, padX: 10, padY: 4 }, upper: true, words: 3 },
  { id: 'blockbuster',label: 'Blockbuster', category: 'Bold', font: 'Passion One',     color: '#FFD700', stroke: { color: '#1A1400', width: 2 }, upper: true, scale: 1.3, words: 1 },
  { id: 'titan',      label: 'Titan',       category: 'Bold', font: 'Titan One',       color: '#FFFFFF', stroke: { color: '#1E3A8A', width: 2.5 }, shadow: { color: '#00000099', dx: 0, dy: 4, radius: 3 }, upper: true, scale: 1.15, words: 1 },
  { id: 'sigmar',     label: 'Monument',    category: 'Bold', font: 'Sigmar One',      color: '#F8FAFC', stroke: { color: '#0F172A', width: 2.5 }, upper: true, words: 1 },
  { id: 'condensed',  label: 'Condensed',   category: 'Bold', font: 'Teko',            color: '#FFFFFF', stroke: { color: '#000000', width: 1.5 }, upper: true, spacing: 1, scale: 1.45, words: 3 },
  { id: 'staat',      label: 'Poster',      category: 'Bold', font: 'Staatliches',     color: '#FFFFFF', stroke: { color: '#000000', width: 1.5 }, upper: true, spacing: 1.2, scale: 1.35, words: 3 },
  { id: 'blackops',   label: 'Tactical',    category: 'Bold', font: 'Black Ops One',   color: '#D9F99D', stroke: { color: '#14210A', width: 2 }, upper: true, words: 2 },
  { id: 'gravitas',   label: 'Gravitas',    category: 'Bold', font: 'Gravitas One',    color: '#FFFFFF', shadow: { color: '#000000CC', dx: 0, dy: 3, radius: 5 }, upper: true, words: 2 },
  { id: 'bevan',      label: 'Bevan',       category: 'Bold', font: 'Bevan',           color: '#FFF1D6', stroke: { color: '#3B1F0B', width: 2 }, upper: true, words: 2 },

  // ---------------------------------------------------------- Neon and Glow
  { id: 'neon',       label: 'Neon',        category: 'Neon', font: 'Righteous',       color: '#39FF14', glow: { color: '#39FF14', radius: 12 }, upper: true, words: 1 },
  { id: 'neon-pink',  label: 'Neon Pink',   category: 'Neon', font: 'Righteous',       color: '#FF3DCB', glow: { color: '#FF3DCB', radius: 12 }, upper: true, words: 1 },
  { id: 'neon-cyan',  label: 'Neon Cyan',   category: 'Neon', font: 'Audiowide',       color: '#22E8FF', glow: { color: '#00B4D8', radius: 14 }, upper: true, spacing: 1, words: 1 },
  { id: 'electric',   label: 'Electric',    category: 'Neon', font: 'Orbitron',        color: '#FFFFFF', glow: { color: '#3B82F6', radius: 14 }, stroke: { color: '#1E3A8A', width: 1 }, upper: true, spacing: 1, words: 1 },
  { id: 'laser',      label: 'Laser',       category: 'Neon', font: 'Michroma',        color: '#FF2D55', glow: { color: '#FF2D55', radius: 16 }, upper: true, spacing: 1.5, scale: 0.95, words: 1 },
  { id: 'monoton',    label: 'Signage',     category: 'Neon', font: 'Monoton',         color: '#FFB703', glow: { color: '#FB8500', radius: 14 }, upper: true, scale: 1.1, words: 1 },
  { id: 'fire',       label: 'Fire',        category: 'Neon', font: 'Anton',           color: '#FF7A00', glow: { color: '#FF3D00', radius: 14 }, stroke: { color: '#3B0A00', width: 1.5 }, upper: true, scale: 1.15, words: 1 },
  { id: 'ice',        label: 'Ice',         category: 'Neon', font: 'Exo 2',           color: '#E0F7FF', glow: { color: '#38BDF8', radius: 12 }, stroke: { color: '#0C4A6E', width: 1 }, upper: true, words: 1 },
  { id: 'toxic',      label: 'Toxic',       category: 'Neon', font: 'Nosifer',         color: '#A3E635', glow: { color: '#4D7C0F', radius: 12 }, upper: true, scale: 0.95, words: 1 },
  { id: 'ghost',      label: 'Ghost',       category: 'Neon', font: 'Creepster',       color: '#E9D5FF', glow: { color: '#7E22CE', radius: 14 }, upper: true, scale: 1.1, words: 1 },
  { id: 'halo',       label: 'Halo',        category: 'Neon', font: 'Poppins',         color: '#FFFFFF', glow: { color: '#FFFFFF', radius: 10 }, words: 2 },
  { id: 'purple',     label: 'Ultraviolet', category: 'Neon', font: 'Kanit',           color: '#C084FC', glow: { color: '#A855F7', radius: 12 }, stroke: { color: '#2E1065', width: 1.5 }, upper: true, words: 1 },

  // ------------------------------------------------------------- Gradient
  { id: 'sunset',     label: 'Sunset',      category: 'Gradient', font: 'Poppins',        gradient: ['#FF8A00', '#FF2D55'], stroke: { color: '#2B0A00', width: 1.5 }, upper: true, scale: 1.1, words: 1 },
  { id: 'sunrise',    label: 'Sunrise',     category: 'Gradient', font: 'Montserrat',     gradient: ['#FFD200', '#FF6A00'], stroke: { color: '#301A00', width: 1.5 }, upper: true, words: 1 },
  { id: 'ocean',      label: 'Ocean',       category: 'Gradient', font: 'Outfit',         gradient: ['#22D3EE', '#3B82F6'], stroke: { color: '#062037', width: 1.5 }, upper: true, words: 1 },
  { id: 'mint',       label: 'Mint',        category: 'Gradient', font: 'Figtree',        gradient: ['#A7F3D0', '#2ECC71'], stroke: { color: '#052E1B', width: 1.5 }, upper: true, words: 1 },
  { id: 'candy',      label: 'Candy',       category: 'Gradient', font: 'Fredoka',        gradient: ['#FF8FE5', '#8B5CF6'], stroke: { color: '#2A0B3F', width: 1.5 }, upper: true, words: 1 },
  { id: 'gold',       label: 'Gold',        category: 'Gradient', font: 'Playfair Display', gradient: ['#FCE38A', '#C79A2E'], stroke: { color: '#2B1D00', width: 1.5 }, upper: true, spacing: 0.5, words: 2 },
  { id: 'chrome',     label: 'Chrome',      category: 'Gradient', font: 'Archivo Black',  gradient: ['#FFFFFF', '#8FA3B8'], stroke: { color: '#111827', width: 2 }, upper: true, words: 1 },
  { id: 'flame',      label: 'Flame',       category: 'Gradient', font: 'Anton',          gradient: ['#FFE24A', '#FF2D00'], stroke: { color: '#2B0000', width: 2 }, glow: { color: '#FF6B00', radius: 8 }, upper: true, scale: 1.15, words: 1 },
  { id: 'vapor',      label: 'Vapourwave',  category: 'Gradient', font: 'Audiowide',      gradient: ['#FF6AD5', '#26C6FF'], stroke: { color: '#1B0730', width: 1.5 }, upper: true, spacing: 1, words: 1 },
  { id: 'aurora',     label: 'Aurora',      category: 'Gradient', font: 'Sora',           gradient: ['#7DF9C4', '#7C6BFF'], glow: { color: '#4C1D95', radius: 10 }, upper: true, words: 1 },
  { id: 'berry',      label: 'Berry',       category: 'Gradient', font: 'Urbanist',       gradient: ['#F472B6', '#7C3AED'], stroke: { color: '#2A0A3F', width: 1.5 }, upper: true, words: 1 },
  { id: 'lime',       label: 'Lime',        category: 'Gradient', font: 'Rubik',          gradient: ['#D9F99D', '#16A34A'], stroke: { color: '#0B2610', width: 1.5 }, upper: true, words: 1 },
  { id: 'peach',      label: 'Peach',       category: 'Gradient', font: 'Quicksand',      gradient: ['#FFE0C2', '#FF7E5F'], stroke: { color: '#3B1405', width: 1.5 }, words: 2 },
  { id: 'galaxy',     label: 'Galaxy',      category: 'Gradient', font: 'Orbitron',       gradient: ['#8EC5FC', '#E0C3FC'], glow: { color: '#4338CA', radius: 12 }, upper: true, spacing: 1, words: 1 },

  // --------------------------------------------------------- Boxed and Chip
  { id: 'sticker',    label: 'Sticker',     category: 'Boxed', font: 'Nunito',          color: '#111111', box: { color: '#FFFFFF', radius: 10, padX: 12, padY: 5 }, words: 3 },
  { id: 'sticker-yellow', label: 'Highlighter', category: 'Boxed', font: 'Nunito',      color: '#1A1A00', box: { color: '#FFE24A', radius: 4, padX: 10, padY: 3 }, words: 3 },
  { id: 'sticker-green',  label: 'Go',      category: 'Boxed', font: 'Poppins',         color: '#04240F', box: { color: '#2ECC71', radius: 10, padX: 12, padY: 5 }, upper: true, words: 2 },
  { id: 'sticker-red',    label: 'Alert',   category: 'Boxed', font: 'Archivo Black',   color: '#FFFFFF', box: { color: '#DC2626', radius: 6, padX: 12, padY: 5 }, upper: true, words: 2 },
  { id: 'sticker-blue',   label: 'Cobalt',  category: 'Boxed', font: 'Inter',           color: '#FFFFFF', box: { color: '#2563EB', radius: 10, padX: 12, padY: 5 }, words: 3 },
  { id: 'sticker-black',  label: 'Slate',   category: 'Boxed', font: 'Inter',           color: '#FFFFFF', box: { color: '#0B0B0BE0', radius: 8, padX: 12, padY: 5 }, words: 4 },
  { id: 'lower-third',    label: 'Lower Third', category: 'Boxed', font: 'Barlow',      color: '#FFFFFF', box: { color: '#111827E6', radius: 2, padX: 14, padY: 6 }, spacing: 0.5, words: 5 },
  { id: 'news',       label: 'Newsroom',    category: 'Boxed', font: 'Roboto',          color: '#FFFFFF', box: { color: '#B91C1C', radius: 0, padX: 12, padY: 5 }, upper: true, spacing: 0.8, words: 4 },
  { id: 'terminal',   label: 'Terminal',    category: 'Boxed', font: 'JetBrains Mono',  color: '#4ADE80', box: { color: '#000000E6', radius: 4, padX: 10, padY: 5 }, words: 3 },
  { id: 'note',       label: 'Sticky Note', category: 'Boxed', font: 'Patrick Hand',    color: '#3F2E00', box: { color: '#FDE68A', radius: 6, padX: 12, padY: 6 }, scale: 1.15, words: 3 },
  { id: 'pill',       label: 'Pill',        category: 'Boxed', font: 'Manrope',         color: '#0B0B0B', box: { color: '#FFFFFFF2', radius: 999, padX: 14, padY: 5 }, words: 3 },
  { id: 'frost',      label: 'Frosted',     category: 'Boxed', font: 'Plus Jakarta Sans', color: '#FFFFFF', box: { color: '#FFFFFF2E', radius: 12, padX: 12, padY: 6 }, shadow: { color: '#00000080', dx: 0, dy: 2, radius: 4 }, words: 4 },

  // ------------------------------------------------------ Outline and Stroke
  { id: 'outline',    label: 'Outline',     category: 'Outline', font: 'Archivo Black', color: '#00000000', stroke: { color: '#FFFFFF', width: 1.5 }, upper: true, scale: 1.1, words: 2 },
  { id: 'outline-yellow', label: 'Hollow Gold', category: 'Outline', font: 'Anton',     color: '#00000000', stroke: { color: '#FFD700', width: 1.5 }, upper: true, scale: 1.15, words: 2 },
  { id: 'outline-thin',   label: 'Hairline',    category: 'Outline', font: 'Josefin Sans', color: '#00000000', stroke: { color: '#FFFFFF', width: 0.75 }, upper: true, spacing: 2, words: 3 },
  { id: 'double',     label: 'Double Line', category: 'Outline', font: 'Bungee Inline', color: '#FFFFFF', stroke: { color: '#000000', width: 1.5 }, upper: true, words: 1 },
  { id: 'varsity',    label: 'Varsity',     category: 'Outline', font: 'Bungee',        color: '#FFFFFF', stroke: { color: '#DC2626', width: 2.5 }, upper: true, scale: 1.05, words: 1 },
  { id: 'bungee-shade', label: 'Marquee',   category: 'Outline', font: 'Bungee Shade',  color: '#FFFFFF', shadow: { color: '#00000099', dx: 0, dy: 3, radius: 3 }, upper: true, scale: 1.05, words: 1 },
  { id: 'wallpoet',   label: 'Stencil',     category: 'Outline', font: 'Wallpoet',      color: '#F1F5F9', stroke: { color: '#0F172A', width: 1.5 }, upper: true, spacing: 1, words: 2 },
  { id: 'knockout',   label: 'Knockout',    category: 'Outline', font: 'Anton',         color: '#0B0B0B', stroke: { color: '#FFFFFF', width: 2.5 }, upper: true, scale: 1.15, words: 1 },
  { id: 'sketch',     label: 'Sketch',      category: 'Outline', font: 'Architects Daughter', color: '#00000000', stroke: { color: '#FFFFFF', width: 1 }, scale: 1.15, words: 2 },
  { id: 'emboss',     label: 'Emboss',      category: 'Outline', font: 'Merriweather',  color: '#D6D3D1', shadow: { color: '#000000', dx: 1, dy: 1, radius: 0 }, stroke: { color: '#57534E', width: 0.75 }, upper: true, words: 2 },

  // ------------------------------------------------------------- Cinematic
  { id: 'cinematic',  label: 'Cinematic',   category: 'Cinematic', font: 'Cormorant Garamond', color: '#F5EFE0', shadow: { color: '#000000CC', dx: 0, dy: 2, radius: 6 }, upper: true, spacing: 3, scale: 1.1, words: 4 },
  { id: 'subtitle',   label: 'Subtitle',    category: 'Cinematic', font: 'Roboto',      color: '#FFFFFF', shadow: { color: '#000000', dx: 0, dy: 1, radius: 3 }, words: 6 },
  { id: 'trailer',    label: 'Trailer',     category: 'Cinematic', font: 'Michroma',    color: '#E5E7EB', shadow: { color: '#000000CC', dx: 0, dy: 2, radius: 8 }, upper: true, spacing: 4, scale: 0.95, words: 3 },
  { id: 'noir',       label: 'Noir',        category: 'Cinematic', font: 'Libre Baskerville', color: '#EDE9E3', box: { color: '#00000099', radius: 0, padX: 14, padY: 6 }, words: 5 },
  { id: 'documentary',label: 'Documentary', category: 'Cinematic', font: 'Lora',        color: '#FAFAF9', shadow: { color: '#000000B3', dx: 0, dy: 2, radius: 5 }, words: 5 },
  { id: 'epic',       label: 'Epic',        category: 'Cinematic', font: 'Cardo', color: '#F3E8C8', glow: { color: '#78350F', radius: 10 }, upper: true, spacing: 3, words: 3 },
  { id: 'western',    label: 'Western',     category: 'Cinematic', font: 'Rokkitt',     color: '#F5DEB3', stroke: { color: '#3B1F0B', width: 1.5 }, upper: true, spacing: 2, words: 3 },
  { id: 'scifi',      label: 'Sci-Fi',      category: 'Cinematic', font: 'Syncopate',   color: '#CFFAFE', glow: { color: '#0891B2', radius: 10 }, upper: true, spacing: 3, scale: 0.9, words: 3 },
  { id: 'thriller',   label: 'Thriller',    category: 'Cinematic', font: 'Special Elite', color: '#E7E5E4', shadow: { color: '#000000', dx: 1, dy: 2, radius: 4 }, upper: true, words: 3 },
  { id: 'credits',    label: 'End Credits', category: 'Cinematic', font: 'EB Garamond', color: '#FFFFFF', shadow: { color: '#000000B3', dx: 0, dy: 1, radius: 4 }, spacing: 2, words: 5 },

  // --------------------------------------------------------------- Elegant
  { id: 'editorial',  label: 'Editorial',   category: 'Elegant', font: 'Playfair Display', color: '#FFFFFF', shadow: { color: '#00000099', dx: 0, dy: 2, radius: 5 }, words: 4 },
  { id: 'fashion',    label: 'Fashion',     category: 'Elegant', font: 'Prata',        color: '#FFFFFF', upper: true, spacing: 4, shadow: { color: '#00000080', dx: 0, dy: 1, radius: 4 }, words: 3 },
  { id: 'boutique',   label: 'Boutique',    category: 'Elegant', font: 'Cormorant Garamond', color: '#F8F4EC', spacing: 1, scale: 1.15, words: 4 },
  { id: 'luxury',     label: 'Luxury',      category: 'Elegant', font: 'Yeseva One',   color: '#E8C77B', shadow: { color: '#00000099', dx: 0, dy: 2, radius: 5 }, spacing: 1, words: 3 },
  { id: 'serif-clean',label: 'Serif',       category: 'Elegant', font: 'Merriweather',  color: '#FFFFFF', shadow: { color: '#00000099', dx: 0, dy: 1, radius: 3 }, words: 4 },
  { id: 'wedding',    label: 'Wedding',     category: 'Elegant', font: 'Great Vibes',  color: '#FFF7F2', shadow: { color: '#00000080', dx: 0, dy: 2, radius: 6 }, scale: 1.5, words: 3 },
  { id: 'gallery',    label: 'Gallery',     category: 'Elegant', font: 'Spectral',     color: '#FAFAFA', box: { color: '#00000073', radius: 2, padX: 14, padY: 6 }, words: 5 },
  { id: 'vogue',      label: 'Runway',      category: 'Elegant', font: 'Abril Fatface', color: '#FFFFFF', shadow: { color: '#000000A6', dx: 0, dy: 2, radius: 4 }, words: 3 },
  { id: 'quiet',      label: 'Quiet',       category: 'Elegant', font: 'Crimson Text', color: '#F5F5F4', words: 5 },
  { id: 'ivory',      label: 'Ivory',       category: 'Elegant', font: 'Vollkorn',     color: '#FFFBEB', box: { color: '#1C1917B3', radius: 8, padX: 12, padY: 5 }, words: 4 },

  // ----------------------------------------------------------- Handwritten
  { id: 'marker',     label: 'Marker',      category: 'Handwritten', font: 'Permanent Marker', color: '#FFFFFF', stroke: { color: '#000000', width: 1.5 }, scale: 1.15, words: 2 },
  { id: 'brush',      label: 'Brush',       category: 'Handwritten', font: 'Kaushan Script',   color: '#FFFFFF', shadow: { color: '#000000A6', dx: 0, dy: 2, radius: 5 }, scale: 1.25, words: 3 },
  { id: 'signature',  label: 'Signature',   category: 'Handwritten', font: 'Allura',           color: '#FFFFFF', shadow: { color: '#00000099', dx: 0, dy: 2, radius: 5 }, scale: 1.7, words: 3 },
  { id: 'notebook',   label: 'Notebook',    category: 'Handwritten', font: 'Caveat',           color: '#FFFFFF', shadow: { color: '#000000A6', dx: 0, dy: 1, radius: 3 }, scale: 1.4, words: 4 },
  { id: 'crayon',     label: 'Crayon',      category: 'Handwritten', font: 'Indie Flower',     color: '#FDE68A', stroke: { color: '#422006', width: 1 }, scale: 1.35, words: 3 },
  { id: 'chalk',      label: 'Chalk',       category: 'Handwritten', font: 'Rock Salt',        color: '#F8FAFC', shadow: { color: '#000000B3', dx: 0, dy: 1, radius: 4 }, scale: 0.95, words: 2 },
  { id: 'lobster',    label: 'Diner',       category: 'Handwritten', font: 'Lobster',          color: '#FF4D4D', stroke: { color: '#2B0000', width: 1.5 }, scale: 1.2, words: 2 },
  { id: 'pacifico',   label: 'Surf',        category: 'Handwritten', font: 'Pacifico',         color: '#7DF9FF', stroke: { color: '#052F3F', width: 1.5 }, scale: 1.2, words: 2 },
  { id: 'romance',    label: 'Romance',     category: 'Handwritten', font: 'Sacramento',       color: '#FFE4EC', glow: { color: '#DB2777', radius: 10 }, scale: 1.6, words: 3 },
  { id: 'casual',     label: 'Casual',      category: 'Handwritten', font: 'Shadows Into Light', color: '#FFFFFF', shadow: { color: '#000000A6', dx: 0, dy: 2, radius: 4 }, scale: 1.35, words: 4 },

  // -------------------------------------------------------- Retro and Y2K
  { id: 'arcade',     label: 'Arcade',      category: 'Retro', font: 'Press Start 2P', color: '#FFE24A', stroke: { color: '#000000', width: 1.5 }, upper: true, scale: 0.75, words: 1 },
  { id: 'pixel',      label: 'Pixel',       category: 'Retro', font: 'Silkscreen',     color: '#4ADE80', stroke: { color: '#052E16', width: 1.5 }, upper: true, scale: 0.95, words: 2 },
  { id: 'crt',        label: 'CRT',         category: 'Retro', font: 'VT323',          color: '#8CFF8C', glow: { color: '#22C55E', radius: 10 }, scale: 1.35, words: 3 },
  { id: 'eighties',   label: 'Eighties',    category: 'Retro', font: 'Faster One',     color: '#FF3DCB', glow: { color: '#7C3AED', radius: 12 }, upper: true, scale: 1.1, words: 1 },
  { id: 'seventies',  label: 'Seventies',   category: 'Retro', font: 'Shrikhand',      color: '#FFB703', stroke: { color: '#4A2500', width: 1.5 }, scale: 1.05, words: 2 },
  { id: 'typewriter', label: 'Typewriter',  category: 'Retro', font: 'Special Elite',  color: '#F5F5F4', box: { color: '#00000099', radius: 2, padX: 10, padY: 4 }, words: 4 },
  { id: 'cassette',   label: 'Cassette',    category: 'Retro', font: 'Days One',       color: '#FDE68A', stroke: { color: '#3F2E00', width: 1.5 }, upper: true, spacing: 1, words: 2 },
  { id: 'grunge',     label: 'Grunge',      category: 'Retro', font: 'Frijole',        color: '#E7E5E4', stroke: { color: '#1C1917', width: 2 }, upper: true, words: 2 },
  { id: 'y2k',        label: 'Y2K',         category: 'Retro', font: 'Rampart One',    color: '#C4B5FD', glow: { color: '#6D28D9', radius: 12 }, upper: true, scale: 1.15, words: 1 },
  { id: 'boombox',    label: 'Boombox',     category: 'Retro', font: 'Carter One',     color: '#FFFFFF', stroke: { color: '#DB2777', width: 2 }, upper: true, words: 1 },

  // --------------------------------------------------------------- Playful
  { id: 'bubble',     label: 'Bubble',      category: 'Playful', font: 'Baloo 2',      color: '#FFFFFF', stroke: { color: '#EC4899', width: 2.5 }, scale: 1.2, words: 1 },
  { id: 'comic',      label: 'Comic',       category: 'Playful', font: 'Bangers',      color: '#FFE24A', stroke: { color: '#000000', width: 2 }, upper: true, scale: 1.25, words: 1 },
  { id: 'chewy',      label: 'Chewy',       category: 'Playful', font: 'Chewy',        color: '#FFFFFF', stroke: { color: '#F97316', width: 2 }, scale: 1.2, words: 2 },
  { id: 'kids',       label: 'Kids',        category: 'Playful', font: 'Fredoka',      color: '#FFFFFF', stroke: { color: '#3B82F6', width: 2 }, scale: 1.15, words: 2 },
  { id: 'party',      label: 'Party',       category: 'Playful', font: 'Titan One',    gradient: ['#FDE68A', '#F472B6'], stroke: { color: '#3F1D38', width: 2 }, upper: true, scale: 1.15, words: 1 },
  { id: 'cartoon',    label: 'Cartoon',     category: 'Playful', font: 'Luckiest Guy', gradient: ['#7DF9FF', '#2563EB'], stroke: { color: '#0B1E3F', width: 2 }, upper: true, scale: 1.15, words: 1 },
  { id: 'doodle',     label: 'Doodle',      category: 'Playful', font: 'Amatic SC',    color: '#FFFFFF', stroke: { color: '#000000', width: 1 }, upper: true, scale: 1.6, words: 3 },
  { id: 'sprinkle',   label: 'Sprinkle',    category: 'Playful', font: 'Cookie',       color: '#FFD1E8', shadow: { color: '#00000099', dx: 0, dy: 2, radius: 5 }, scale: 1.65, words: 3 },
  { id: 'balloon',    label: 'Balloon',     category: 'Playful', font: 'Baloo 2',      color: '#1F2937', box: { color: '#FDE68A', radius: 999, padX: 14, padY: 6 }, scale: 1.1, words: 2 },
  { id: 'candyshop',  label: 'Candy Shop',  category: 'Playful', font: 'Berkshire Swash', color: '#FFFFFF', stroke: { color: '#DB2777', width: 2 }, scale: 1.2, words: 2 },

  // --------------------------------------------------------------- Minimal
  { id: 'minimal',    label: 'Minimal',     category: 'Minimal', font: 'Inter',        color: '#FFFFFF', words: 4 },
  { id: 'mono',       label: 'Mono',        category: 'Minimal', font: 'Roboto Mono',  color: '#FFFFFF', shadow: { color: '#000000A6', dx: 0, dy: 1, radius: 3 }, words: 4 },
  { id: 'wide',       label: 'Wide',        category: 'Minimal', font: 'Work Sans',    color: '#FFFFFF', upper: true, spacing: 5, scale: 0.9, words: 3 },
  { id: 'tight',      label: 'Tight',       category: 'Minimal', font: 'Archivo Black', color: '#FFFFFF', upper: true, spacing: -0.5, words: 3 },
  { id: 'soft',       label: 'Soft',        category: 'Minimal', font: 'Quicksand',    color: '#F5F5F5', shadow: { color: '#00000080', dx: 0, dy: 1, radius: 4 }, words: 4 },
  { id: 'shadow3d',   label: '3D Shadow',   category: 'Minimal', font: 'Poppins',      color: '#FFFFFF', shadow: { color: '#555555', dx: 4, dy: 4, radius: 0 }, upper: true, scale: 1.1, words: 2 },
  { id: 'highlight',  label: 'Spotlight',   category: 'Minimal', font: 'Montserrat',   color: '#FFE24A', stroke: { color: '#1A1400', width: 1.5 }, upper: true, words: 1 },
  { id: 'whisper',    label: 'Whisper',     category: 'Minimal', font: 'Lato',         color: '#E5E7EB', spacing: 1, words: 5 },
];

// Order is the order above; the sheet shows them as tabs, "All" first.
export const CAPTION_CATEGORIES = CAPTION_STYLES.reduce(
  (acc, s) => (acc.includes(s.category) ? acc : acc.concat(s.category)),
  []
);

const BY_ID = CAPTION_STYLES.reduce((m, s) => { m[s.id] = s; return m; }, {});

// A project saved against an id this build does not have - rolled back, or edited
// on a newer version - falls back to the default rather than rendering nothing.
export function resolveCaptionStyle(id) {
  return BY_ID[id] || BY_ID[DEFAULT_CAPTION_STYLE_ID];
}

// Words per caption chunk. One word at a time is the cadence that reads as
// "animated" on a phone; longer chunks suit the styles meant to sit still.
export function captionChunkSize(style) {
  const n = style && style.words;
  return n && n > 0 ? n : 3;
}

export function captionFontSize(style, base = CAPTION_BASE_SIZE) {
  return Math.round(base * ((style && style.scale) || 1));
}

// What the renderer paints as the fill. `color` is still what an overlay stores
// and what the colour picker overrides, so a gradient style whose colour the user
// has overridden becomes a flat fill of that colour rather than ignoring them.
export function captionFill(style, overrideColor) {
  if (overrideColor) return { color: overrideColor, gradient: null };
  if (Array.isArray(style.gradient) && style.gradient.length >= 2) {
    return { color: style.gradient[0], gradient: style.gradient };
  }
  return { color: style.color || '#FFFFFF', gradient: null };
}

// The parts of a style the export needs. The backend has no copy of this
// catalogue and must not need one - it renders whatever spec it is handed, so
// adding a style here never requires a deploy on that side.
export function captionExportSpec(style, overrideColor) {
  const fill = captionFill(style, overrideColor);
  const spec = {};
  if (fill.gradient) spec.gradient = fill.gradient;
  if (style.stroke) spec.stroke = { color: style.stroke.color, width: style.stroke.width };
  if (style.glow) spec.glow = { color: style.glow.color, radius: style.glow.radius };
  if (style.shadow) spec.shadow = { ...style.shadow };
  if (style.box) spec.box = { ...style.box };
  if (style.highlight) spec.highlight = { ...style.highlight };
  if (style.spacing) spec.spacing = style.spacing;
  return spec;
}

// What a manual text overlay's chip starts as. Not a caption style: a plain text
// overlay has no spec to hang a `box` on, and giving it one would mean every
// overlay pretending to be a caption to get a background.
export const DEFAULT_TEXT_BACKGROUND = {
  enabled: false,
  color: '#000000',
  opacity: 0.6,
  radius: 8,
  padX: 12,
  padY: 6,
};

// Fold an opacity into a hex colour. Both renderers take one colour string rather
// than a colour plus an alpha - React Native has no backgroundOpacity, and the
// export's ImageMagick fill reads #RRGGBBAA - so the two must not each invent
// their own way of combining them.
export function withAlpha(hex, opacity) {
  const base = String(hex || '#000000').slice(0, 7);
  const a = Math.round(Math.max(0, Math.min(1, opacity == null ? 1 : opacity)) * 255);
  return base + a.toString(16).padStart(2, '0').toUpperCase();
}

// The chip as the export wants it: one colour with the alpha already folded in,
// and the geometry it draws with. Returns null when there is no chip to draw, so
// a caller can spread it into a spec without testing twice.
export function backgroundExportBox(background) {
  if (!background || !background.enabled) return null;
  return {
    color: withAlpha(background.color, background.opacity),
    radius: background.radius || 0,
    padX: background.padX || 0,
    padY: background.padY || 0,
  };
}

// Whether a style highlights the current word. Kept as a function rather than
// read off `style.highlight` at each call site so that the one place that decides
// "this needs word timings" is the same place the renderers ask.
export function captionHighlight(style) {
  return (style && style.highlight) || null;
}

// Which word of a phrase is being spoken at `t`. Returns -1 when the phrase has
// no timings or the playhead is outside it, which every renderer reads as "chip
// nothing" - a caption with no active word must still draw its text.
export function activeWordIndex(words, t) {
  if (!Array.isArray(words) || words.length === 0) return -1;
  for (let i = 0; i < words.length; i++) {
    if (t >= words[i].start && t <= words[i].end) return i;
  }
  return -1;
}
