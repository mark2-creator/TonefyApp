// The filter catalogue.
//
// A filter is a RECIPE - an ffmpeg filter chain - not a name the server has to
// recognise. The app sends the chain with the clip, so this file is the only place a
// look is defined, and one added here renders without a backend deploy. Same
// arrangement the caption styles and the transitions use, for the same reason: a
// second list on the server drifts from the first.
//
// Pure data, no imports: scripts/gen-filter-previews.mjs loads it outside React Native
// to render the tiles.
//
// The seven original names are kept verbatim as ids - projects saved before this
// existed carry `filter: 'Warm'` on their clips, and resolveFilter must still find it.

const F = (id, label, category, chain, premium = true) => ({ id, label, category, chain, premium });

export const FILTERS = [
  // --- The originals. Free, and unchanged, so old projects render as they did.
  F('None', 'None', 'Basic', [], false),
  F('Bright', 'Bright', 'Basic', ['eq=brightness=0.10'], false),
  F('Contrast', 'Contrast', 'Basic', ['eq=contrast=1.30'], false),
  F('Warm', 'Warm', 'Basic', ['eq=gamma_r=1.12:gamma_b=0.92'], false),
  F('Cool', 'Cool', 'Basic', ['eq=gamma_r=0.92:gamma_b=1.12'], false),
  F('Fade', 'Fade', 'Basic', ['eq=contrast=0.85:brightness=0.06:saturation=0.80'], false),
  F('B&W', 'B&W', 'Basic', ['hue=s=0'], false),
  // A few more free ones, so the free tier is a usable set rather than a teaser.
  F('clean', 'Clean', 'Basic', ['eq=contrast=1.08:saturation=1.06'], false),
  F('soft', 'Soft', 'Basic', ['eq=contrast=0.92:brightness=0.05:saturation=0.95'], false),
  F('punchy', 'Punchy', 'Basic', ['eq=contrast=1.25:saturation=1.35'], false),

  // --- Portrait: kind to skin. Warmth in the mids, contrast held back.
  F('porcelain', 'Porcelain', 'Portrait', ['eq=brightness=0.06:contrast=0.95:saturation=0.9', 'colorbalance=rm=0.06:bm=0.04']),
  F('glow', 'Glow', 'Portrait', ['eq=brightness=0.1:saturation=1.05', 'colorbalance=rh=0.08:gh=0.04']),
  F('honey', 'Honey', 'Portrait', ['colorbalance=rm=0.12:gm=0.05:bm=-0.08', 'eq=saturation=1.1']),
  F('rosewater', 'Rosewater', 'Portrait', ['colorbalance=rs=0.1:bs=0.06:rm=0.05', 'eq=contrast=0.96']),
  F('bronze', 'Bronze', 'Portrait', ['colorbalance=rm=0.15:gm=0.06:bm=-0.12', 'eq=contrast=1.1:saturation=1.05']),
  F('lift', 'Lift Glow', 'Portrait', ['curves=all=0/0.06 0.5/0.55 1/1', 'eq=saturation=1.05']),
  F('velvet', 'Velvet', 'Portrait', ['eq=contrast=1.12:saturation=0.95', 'colorbalance=rs=0.05:bh=0.05']),
  F('ivory', 'Ivory', 'Portrait', ['eq=brightness=0.08:saturation=0.85', 'colorbalance=rh=0.06:gh=0.05']),

  // --- Cinematic: the graded looks. Split tones and crushed blacks.
  F('tealorange', 'Teal & Orange', 'Cinematic', ['colorbalance=rs=-0.15:bs=0.2:rh=0.18:bh=-0.12', 'eq=contrast=1.18']),
  F('blockbuster', 'Blockbuster', 'Cinematic', ['colorbalance=rs=-0.2:bs=0.25:rm=0.08:rh=0.15', 'eq=contrast=1.25:saturation=1.1']),
  F('noir', 'Noir', 'Cinematic', ['hue=s=0', 'eq=contrast=1.45:brightness=-0.04']),
  F('noirflash', 'Noir Flash', 'Cinematic', ['hue=s=0', 'eq=contrast=1.7:brightness=0.06', 'unsharp=5:5:0.8']),
  F('cold', 'Cold Open', 'Cinematic', ['colorbalance=rs=-0.2:bs=0.28', 'eq=contrast=1.2:saturation=0.9']),
  F('desert', 'Desert', 'Cinematic', ['colorbalance=rm=0.16:gm=0.08:bm=-0.18', 'eq=contrast=1.15:saturation=0.95']),
  F('moonlit', 'Moonlit', 'Cinematic', ['colorbalance=rs=-0.18:bs=0.3:bm=0.12', 'eq=brightness=-0.08:contrast=1.15']),
  F('bleach', 'Bleach Bypass', 'Cinematic', ['eq=saturation=0.25:contrast=1.5:brightness=0.06']),
  F('emberlight', 'Ember', 'Cinematic', ['colorbalance=rs=0.22:gs=0.06:bs=-0.2', 'eq=contrast=1.2', 'vignette']),
  F('gotham', 'Gotham', 'Cinematic', ['eq=saturation=0.5:contrast=1.35:brightness=-0.06', 'colorbalance=bs=0.15']),
  F('hollywood', 'Hollywood', 'Cinematic', ['curves=all=0/0.03 0.35/0.32 0.7/0.75 1/0.98', 'eq=saturation=1.12']),
  F('dracula', 'Dracula', 'Cinematic', ['colorbalance=rs=0.25:gs=-0.1:bs=-0.05', 'eq=contrast=1.4:brightness=-0.1', 'vignette']),

  // --- Film: emulsion. Lifted blacks, grain, a colour cast in the shadows.
  F('kodachrome', 'Kodachrome', 'Film', ['eq=saturation=1.25:contrast=1.15', 'colorbalance=rm=0.08:bs=-0.06']),
  F('portra', 'Portra', 'Film', ['curves=all=0/0.05 0.5/0.52 1/0.97', 'colorbalance=rm=0.08:gm=0.03', 'eq=saturation=0.95']),
  F('superia', 'Superia', 'Film', ['colorbalance=gs=0.08:bs=0.06', 'eq=saturation=1.12:contrast=1.05']),
  F('retroprint', 'Retro Print', 'Film', ['curves=all=0/0.1 0.5/0.5 1/0.92', 'eq=saturation=0.85', 'noise=alls=8:allf=t']),
  F('fadedfilm', 'Faded Film', 'Film', ['eq=contrast=0.8:brightness=0.1:saturation=0.7', 'noise=alls=10:allf=t']),
  F('grainy', 'Grain', 'Film', ['noise=alls=18:allf=t', 'eq=contrast=1.08']),
  F('sepiaprint', 'Sepia Print', 'Film', ['colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131']),
  F('crossprocess', 'Cross Process', 'Film', ['colorbalance=rs=-0.15:gs=0.1:bs=0.2:rh=0.15:bh=-0.15', 'eq=contrast=1.3:saturation=1.3']),
  F('expired', 'Expired', 'Film', ['colorbalance=gs=0.15:bm=-0.1', 'eq=contrast=0.85:saturation=0.75', 'noise=alls=14:allf=t']),
  F('matte', 'Matte High', 'Film', ['curves=all=0/0.14 0.5/0.5 1/0.9', 'eq=saturation=0.88']),

  // --- Vivid: colour turned up, for social.
  F('vivid', 'Vivid', 'Vivid', ['eq=saturation=1.6:contrast=1.2']),
  F('vivid2', 'Vivid 2', 'Vivid', ['eq=saturation=1.9:contrast=1.3', 'unsharp=5:5:0.5']),
  F('vividglam', 'Vivid Glam', 'Vivid', ['eq=saturation=1.7:contrast=1.25:brightness=0.05', 'colorbalance=rh=0.08']),
  F('hdr', 'HDR', 'Vivid', ['eq=contrast=1.4:saturation=1.4', 'unsharp=5:5:1.0']),
  F('neonpop', 'Neon Pop', 'Vivid', ['eq=saturation=2.0:contrast=1.25', 'colorbalance=bs=0.2:rh=0.12']),
  F('candy', 'Candy', 'Vivid', ['eq=saturation=1.75:brightness=0.08', 'colorbalance=rs=0.12:bs=0.1']),
  F('electric', 'Electric', 'Vivid', ['hue=h=8', 'eq=saturation=1.85:contrast=1.3']),
  F('sunbeam', 'Sunbeam', 'Vivid', ['colorbalance=rh=0.2:gh=0.12:bh=-0.15', 'eq=brightness=0.1:saturation=1.4']),

  // --- Cool: blues, teals, water and glass.
  F('deepcyan', 'Deep Cyan', 'Cool', ['colorbalance=gs=0.12:bs=0.22:rm=-0.08', 'eq=saturation=1.15']),
  F('arctic', 'Arctic', 'Cool', ['colorbalance=bs=0.3:bm=0.1', 'eq=brightness=0.06:saturation=0.9']),
  F('maldives', 'Maldives', 'Cool', ['colorbalance=gs=0.1:bs=0.24', 'eq=saturation=1.3:contrast=1.12']),
  F('cloudless', 'Cloudless', 'Cool', ['colorbalance=bs=0.2:bh=0.1', 'eq=brightness=0.08:contrast=1.1']),
  F('bluehour', 'Blue Hour', 'Cool', ['colorbalance=rs=-0.15:bs=0.3', 'eq=brightness=-0.06:contrast=1.18']),
  F('mint', 'Mint', 'Cool', ['colorbalance=gs=0.18:bs=0.1', 'eq=saturation=1.1:brightness=0.05']),
  F('steel', 'Steel', 'Cool', ['eq=saturation=0.6:contrast=1.25', 'colorbalance=bs=0.15']),
  F('crystal', 'Crystal Clear', 'Cool', ['eq=contrast=1.15:saturation=1.05:brightness=0.05', 'unsharp=5:5:0.6']),

  // --- Warm: golden hour, skin, sunsets.
  F('goldenhour', 'Golden Hour', 'Warm', ['colorbalance=rh=0.22:gh=0.12:bh=-0.2', 'eq=saturation=1.2:brightness=0.05']),
  F('coral', 'Coral Mood', 'Warm', ['colorbalance=rs=0.15:gs=0.04:bs=-0.08', 'eq=saturation=1.15']),
  F('tropical', 'Tropical', 'Warm', ['colorbalance=rm=0.1:gm=0.08:bm=-0.1', 'eq=saturation=1.35:contrast=1.1']),
  F('sunset', 'Wistful Sunset', 'Warm', ['colorbalance=rs=0.2:bs=-0.12:rh=0.12', 'eq=contrast=1.1:saturation=1.2']),
  F('amber', 'Amber', 'Warm', ['colorbalance=rm=0.18:gm=0.1:bm=-0.16', 'eq=contrast=1.12']),
  F('woody', 'Woody Brown', 'Warm', ['colorbalance=rm=0.14:gm=0.06:bm=-0.14', 'eq=saturation=0.9:contrast=1.15']),
  F('terracotta', 'Terracotta', 'Warm', ['colorbalance=rs=0.18:gs=0.02:bs=-0.14', 'eq=saturation=1.05:contrast=1.08']),
  F('summer', 'Summer Skin', 'Warm', ['colorbalance=rh=0.14:gh=0.08:bh=-0.1', 'eq=brightness=0.07:saturation=1.15']),

  // --- Nature: greens and landscape.
  F('nature', 'Nature', 'Nature', ['colorbalance=gm=0.12:gs=0.06', 'eq=saturation=1.25:contrast=1.1']),
  F('forest', 'Forest', 'Nature', ['colorbalance=gs=0.15:bs=0.05:rm=-0.06', 'eq=saturation=1.15:contrast=1.15']),
  F('meadow', 'Meadow', 'Nature', ['colorbalance=gm=0.1:rh=0.08', 'eq=brightness=0.06:saturation=1.2']),
  F('safari', 'Safari', 'Nature', ['colorbalance=rm=0.1:gm=0.1:bm=-0.15', 'eq=saturation=1.1:contrast=1.2']),

  // --- Mono: black and white, and near-mono.
  F('silver', 'Silver', 'Mono', ['hue=s=0', 'eq=contrast=1.2:brightness=0.05']),
  F('inkwell', 'Inkwell', 'Mono', ['hue=s=0', 'eq=contrast=1.6']),
  F('graphite', 'Graphite', 'Mono', ['hue=s=0', 'curves=all=0/0.08 0.5/0.48 1/0.92']),
  F('duotone', 'Duotone', 'Mono', ['hue=s=0', 'colorbalance=rs=0.2:bs=0.25']),
  F('sepiasoft', 'Sepia Soft', 'Mono', ['hue=s=0', 'colorbalance=rm=0.18:gm=0.08:bm=-0.12']),

  // --- Night: low light.
  F('hddark', 'HD Dark', 'Night', ['eq=brightness=-0.08:contrast=1.3', 'unsharp=5:5:0.7']),
  F('midnight', 'Midnight', 'Night', ['colorbalance=bs=0.25:rm=-0.08', 'eq=brightness=-0.12:contrast=1.25']),
  F('neonnight', 'Neon Night', 'Night', ['colorbalance=bs=0.2:rh=0.15', 'eq=brightness=-0.05:saturation=1.6:contrast=1.2']),
  F('shadow', 'Shadow', 'Night', ['eq=brightness=-0.1:contrast=1.4:saturation=0.85', 'vignette']),
  // --- Retro: the eighties and nineties, video and print.
  F('vhs', 'VHS', 'Retro', ['colorbalance=rs=0.12:bs=0.1', 'eq=saturation=1.3:contrast=1.1', 'noise=alls=12:allf=t']),
  F('polaroid', 'Polaroid', 'Retro', ['curves=all=0/0.12 0.5/0.52 1/0.94', 'colorbalance=rm=0.08:gm=0.04', 'eq=saturation=0.9']),
  F('disposable', 'Disposable', 'Retro', ['eq=contrast=1.25:saturation=1.2:brightness=0.05', 'noise=alls=16:allf=t']),
  F('technicolor', 'Technicolor', 'Retro', ['eq=saturation=1.7:contrast=1.25', 'colorbalance=rs=0.1:bh=0.1']),
  F('eighties', 'Eighties', 'Retro', ['colorbalance=rs=0.15:bs=0.18', 'eq=saturation=1.4:contrast=1.15']),
  F('faded90s', 'Nineties', 'Retro', ['curves=all=0/0.1 0.5/0.48 1/0.9', 'colorbalance=gs=0.08', 'eq=saturation=0.85']),
  F('betamax', 'Betamax', 'Retro', ['colorbalance=rs=0.1:gs=-0.05:bs=0.12', 'eq=contrast=1.2', 'noise=alls=20:allf=t']),
  F('newspaper', 'Newsprint', 'Retro', ['hue=s=0', 'eq=contrast=1.5:brightness=0.05', 'noise=alls=14:allf=t']),

  // --- Pastel: low saturation, lifted blacks, soft colour.
  F('pastel', 'Pastel', 'Pastel', ['curves=all=0/0.13 0.5/0.55 1/0.97', 'eq=saturation=0.8']),
  F('blush', 'Blush', 'Pastel', ['colorbalance=rs=0.12:bs=0.06', 'eq=saturation=0.85:brightness=0.08']),
  F('lavender', 'Lavender', 'Pastel', ['colorbalance=rs=0.08:bs=0.16', 'eq=saturation=0.85:brightness=0.06']),
  F('peach', 'Peach', 'Pastel', ['colorbalance=rm=0.12:gm=0.05:bm=-0.05', 'eq=saturation=0.9:brightness=0.07']),
  F('seafoam', 'Seafoam', 'Pastel', ['colorbalance=gs=0.12:bs=0.1', 'eq=saturation=0.82:brightness=0.06']),
  F('powder', 'Powder', 'Pastel', ['curves=all=0/0.16 0.5/0.56 1/0.96', 'eq=saturation=0.7']),
  F('cream', 'Cream', 'Pastel', ['colorbalance=rh=0.1:gh=0.07', 'eq=saturation=0.78:brightness=0.09']),
  F('sorbet', 'Sorbet', 'Pastel', ['colorbalance=rs=0.1:gs=0.06:bs=0.08', 'eq=saturation=0.95:brightness=0.08']),

  // --- Street: urban, contrasty, a little grubby.
  F('street', 'Street', 'Street', ['eq=contrast=1.35:saturation=0.9', 'colorbalance=bs=0.08']),
  F('concrete', 'Concrete', 'Street', ['eq=saturation=0.55:contrast=1.3', 'colorbalance=bs=0.1']),
  F('tokyo', 'Tokyo', 'Street', ['colorbalance=bs=0.2:rh=0.1', 'eq=saturation=1.45:contrast=1.2']),
  F('subway', 'Subway', 'Street', ['eq=brightness=-0.06:contrast=1.35:saturation=0.8', 'vignette']),
  F('grit', 'Grit', 'Street', ['eq=contrast=1.4:saturation=0.85', 'noise=alls=15:allf=t', 'unsharp=5:5:0.8']),
  F('brooklyn', 'Brooklyn', 'Street', ['curves=all=0/0.08 0.5/0.5 1/0.95', 'colorbalance=gm=0.06', 'eq=saturation=1.05']),
  F('rooftop', 'Rooftop', 'Street', ['colorbalance=rh=0.12:bs=0.1', 'eq=contrast=1.22:saturation=1.1']),
  F('monsoon', 'Monsoon', 'Street', ['colorbalance=bs=0.18:gs=0.06', 'eq=saturation=0.8:contrast=1.15']),

  // --- Beauty: soft, flattering, high key.
  F('softskin', 'Soft Skin', 'Beauty', ['eq=contrast=0.9:brightness=0.08:saturation=0.95', 'colorbalance=rm=0.06']),
  F('airy', 'Airy', 'Beauty', ['curves=all=0/0.1 0.5/0.58 1/1', 'eq=saturation=0.9']),
  F('highkey', 'High Key', 'Beauty', ['eq=brightness=0.16:contrast=0.9:saturation=0.9']),
  F('satin', 'Satin', 'Beauty', ['eq=contrast=0.95:saturation=0.92', 'colorbalance=rh=0.07:gh=0.04']),
  F('flawless', 'Flawless', 'Beauty', ['eq=brightness=0.1:contrast=0.94', 'colorbalance=rm=0.08:bm=0.03']),
  F('sunkissed', 'Sunkissed', 'Beauty', ['colorbalance=rm=0.14:gm=0.07:bm=-0.1', 'eq=brightness=0.08:saturation=1.15']),
  F('marble', 'Marble', 'Beauty', ['eq=saturation=0.7:brightness=0.1:contrast=1.05', 'colorbalance=bh=0.06']),
  F('cashmere', 'Cashmere', 'Beauty', ['colorbalance=rm=0.1:gm=0.06:bm=-0.04', 'eq=saturation=0.85:contrast=0.96']),

  // --- Moody: dark, desaturated, heavy.
  F('moody', 'Moody', 'Moody', ['eq=brightness=-0.08:contrast=1.3:saturation=0.75']),
  F('smoke', 'Smoke', 'Moody', ['eq=saturation=0.5:contrast=1.15', 'colorbalance=bs=0.12', 'vignette']),
  F('ash', 'Ash', 'Moody', ['eq=saturation=0.35:contrast=1.25:brightness=-0.04']),
  F('storm', 'Storm', 'Moody', ['colorbalance=bs=0.2:gs=0.05', 'eq=brightness=-0.1:contrast=1.3:saturation=0.7']),
  F('rust', 'Rust', 'Moody', ['colorbalance=rm=0.16:gm=0.04:bm=-0.16', 'eq=saturation=0.85:contrast=1.25']),
  F('charcoal', 'Charcoal', 'Moody', ['hue=s=0', 'eq=contrast=1.35:brightness=-0.08', 'vignette']),
  F('deepwood', 'Deep Wood', 'Moody', ['colorbalance=rm=0.1:gm=0.08:bm=-0.12', 'eq=brightness=-0.06:contrast=1.28:saturation=0.9']),
  F('eclipse', 'Eclipse', 'Moody', ['eq=brightness=-0.14:contrast=1.4:saturation=0.65', 'vignette']),

  // --- Summer / Winter: seasonal casts.
  F('summerhaze', 'Summer Haze', 'Season', ['curves=all=0/0.1 0.5/0.55 1/0.98', 'colorbalance=rh=0.12:gh=0.06', 'eq=saturation=1.1']),
  F('poolside', 'Poolside', 'Season', ['colorbalance=gs=0.1:bs=0.2', 'eq=brightness=0.08:saturation=1.3']),
  F('beachday', 'Beach Day', 'Season', ['colorbalance=rh=0.1:bs=0.12', 'eq=brightness=0.1:contrast=1.12:saturation=1.25']),
  F('vividspring', 'Vivid Spring', 'Season', ['colorbalance=gm=0.1', 'eq=saturation=1.5:brightness=0.06:contrast=1.1']),
  F('autumn', 'Autumn', 'Season', ['colorbalance=rm=0.16:gm=0.06:bm=-0.16', 'eq=saturation=1.2:contrast=1.12']),
  F('frost', 'Frost', 'Season', ['colorbalance=bs=0.22:gs=0.06', 'eq=brightness=0.08:saturation=0.8:contrast=1.1']),
  F('snowlight', 'Snow Light', 'Season', ['eq=brightness=0.14:contrast=1.1:saturation=0.75', 'colorbalance=bh=0.1']),
  F('harvest', 'Harvest', 'Season', ['colorbalance=rm=0.12:gm=0.1:bm=-0.14', 'eq=saturation=1.25:contrast=1.15']),

  // --- Neon / night city.
  F('neonlights', 'Neon Lights', 'Neon', ['colorbalance=rs=0.15:bs=0.22', 'eq=saturation=1.8:contrast=1.25']),
  F('cyberpunk', 'Cyberpunk', 'Neon', ['colorbalance=rs=0.2:bs=0.28:gm=-0.08', 'eq=saturation=1.9:contrast=1.3']),
  F('synthwave', 'Synthwave', 'Neon', ['colorbalance=rs=0.25:bs=0.25:gs=-0.1', 'eq=saturation=1.7:contrast=1.2']),
  F('vapor', 'Vaporwave', 'Neon', ['colorbalance=rs=0.18:bs=0.2', 'eq=saturation=1.5:brightness=0.06:contrast=1.05']),
  F('acidhouse', 'Acid', 'Neon', ['hue=h=140', 'eq=saturation=1.8:contrast=1.2']),
  F('ultraviolet', 'Ultraviolet', 'Neon', ['colorbalance=bs=0.3:rs=0.14', 'eq=saturation=1.6:brightness=-0.04']),
  F('infrared', 'Infrared', 'Neon', ['hue=h=200', 'eq=saturation=1.7:contrast=1.25']),
  F('laser', 'Laser', 'Neon', ['colorbalance=rh=0.2:bh=0.18', 'eq=saturation=1.75:contrast=1.3', 'unsharp=5:5:0.6']),

  // --- Analog film stocks, pushed and pulled.
  F('push2', 'Push +2', 'Analog', ['eq=contrast=1.45:brightness=0.08:saturation=1.1', 'noise=alls=14:allf=t']),
  F('pull1', 'Pull -1', 'Analog', ['eq=contrast=0.85:brightness=-0.04:saturation=0.9']),
  F('ektar', 'Ektar', 'Analog', ['eq=saturation=1.35:contrast=1.18', 'colorbalance=rs=0.06:bh=0.06']),
  F('trix', 'Tri-X', 'Analog', ['hue=s=0', 'eq=contrast=1.3', 'noise=alls=18:allf=t']),
  F('hp5', 'HP5', 'Analog', ['hue=s=0', 'curves=all=0/0.08 0.5/0.5 1/0.94', 'noise=alls=14:allf=t']),
  F('velvia', 'Velvia', 'Analog', ['eq=saturation=1.55:contrast=1.25', 'colorbalance=gs=0.06:bs=0.06']),
  F('agfa', 'Agfa', 'Analog', ['colorbalance=gm=0.08:bm=0.05', 'eq=saturation=1.1:contrast=1.08']),
  F('lomo', 'Lomo', 'Analog', ['eq=saturation=1.5:contrast=1.35', 'vignette', 'colorbalance=bs=0.1']),

  // --- Fashion / editorial.
  F('editorial', 'Editorial', 'Fashion', ['eq=contrast=1.2:saturation=0.9', 'colorbalance=rm=0.05:bh=0.05', 'unsharp=5:5:0.5']),
  F('runway', 'Runway', 'Fashion', ['eq=brightness=0.06:contrast=1.25:saturation=0.95', 'unsharp=5:5:0.7']),
  F('monochromered', 'Red Room', 'Fashion', ['hue=s=0', 'colorbalance=rs=0.35:rm=0.15']),
  F('couture', 'Couture', 'Fashion', ['curves=all=0/0.04 0.5/0.5 1/0.96', 'eq=saturation=0.88:contrast=1.15']),
  F('glossy', 'Glossy', 'Fashion', ['eq=contrast=1.3:saturation=1.2:brightness=0.04', 'unsharp=5:5:1.0']),
  F('minimal', 'Minimal', 'Fashion', ['eq=saturation=0.6:contrast=1.1:brightness=0.06']),
  F('studio', 'Studio', 'Fashion', ['eq=contrast=1.15:brightness=0.05', 'colorbalance=rh=0.04:bh=0.04']),
  F('spotlightf', 'Spotlight', 'Fashion', ['eq=contrast=1.35:brightness=0.06', 'vignette']),

  // --- Duotones. Mono first, then two stops pushed into the shadows and highlights.
  F('duo_teal', 'Duo Teal', 'Mono', ['hue=s=0', 'colorbalance=bs=0.3:gs=0.18:rh=0.12']),
  F('duo_rose', 'Duo Rose', 'Mono', ['hue=s=0', 'colorbalance=rs=0.3:bs=0.12:gh=0.08']),
  F('duo_gold', 'Duo Gold', 'Mono', ['hue=s=0', 'colorbalance=rs=0.25:gs=0.15:bh=0.1']),
  F('duo_violet', 'Duo Violet', 'Mono', ['hue=s=0', 'colorbalance=rs=0.2:bs=0.3:gm=-0.06']),
  F('duo_forest', 'Duo Forest', 'Mono', ['hue=s=0', 'colorbalance=gs=0.28:bs=0.1:rh=0.08']),
  F('duo_slate', 'Duo Slate', 'Mono', ['hue=s=0', 'colorbalance=bs=0.2:rm=-0.06:bh=0.08']),
];

export const FILTER_CATEGORIES = [
  'Basic', 'Portrait', 'Beauty', 'Cinematic', 'Film', 'Analog', 'Fashion', 'Vivid', 'Neon',
  'Cool', 'Warm', 'Season', 'Nature', 'Street', 'Pastel', 'Retro', 'Moody', 'Mono', 'Night',
];

const BY_ID = new Map(FILTERS.map(f => [f.id, f]));

/** The recipe for an id, or None for anything the catalogue no longer knows. */
export function resolveFilter(id) {
  if (!id) return BY_ID.get('None');
  return BY_ID.get(id) || BY_ID.get('None');
}

/** What travels to the server with a clip. Null when there is nothing to apply. */
export function filterSpec(id) {
  const f = resolveFilter(id);
  return f && f.chain && f.chain.length ? f.chain : null;
}

export function isPremiumFilter(id) {
  return !!resolveFilter(id)?.premium;
}


// --- Live preview -----------------------------------------------------------------
//
// React Native 0.81 has a `filter` style prop, and on Android the colour-matrix
// functions compile to a ColorMatrixColorFilter, which works on every version rather
// than needing the API 31 RenderEffect that blur does. So a grade can be shown live
// with no native module and no new binary.
//
// The mapping is not derived here - it is FITTED and measured, in
// constants/filterPreview.js. Deriving only works for the 20 chains built from eq and
// hue; the rest use colorbalance or curves, and a curve is non-linear while a colour
// matrix is linear, so there is nothing exact to derive. Fitting finds the nearest
// expressible grade and records how near, and only the ones that got near enough are
// offered. See that file for the method and the numbers.
// Explicit .js extension: this file is loaded by scripts/gen-filter-previews.mjs
// OUTSIDE React Native, and plain Node ESM does not resolve extensionless paths.
// Metro accepts the extension either way, so this is the form that works in both.
import { FILTER_PREVIEW_CSS } from './filterPreview.js';

/** The CSS filter string for a grade, or null when no close-enough one exists. */
export function filterCss(id) {
  const hit = FILTER_PREVIEW_CSS[id];
  return hit ? hit[0] : null;
}

/** How far the live preview sits from the real render, in levels out of 255. */
export function filterCssError(id) {
  const hit = FILTER_PREVIEW_CSS[id];
  return hit ? hit[1] : null;
}
