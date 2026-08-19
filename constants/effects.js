// The effects catalogue.
//
// An EFFECT changes the image beyond its colour - over time, or structurally. That is
// the line against the other three catalogues, and it is a real one rather than a
// naming convention:
//
//   filter     colour only, identical on every frame          (constants/filters.js)
//   motion     where the camera is                            (constants/motions.js)
//   transition how clip A becomes clip B                      (constants/transitions.js)
//   effect     something HAPPENING on the footage             this file
//
// "Make it look like Kodak film" is a filter. "A glitch tears across the frame", "the
// picture strobes", "the image leaves trails" are effects. The Effects tab used to
// list seven filter names, which is why the app looked like it had none.
//
// Recipes as data, like the other three, so one added here renders with no backend
// deploy. Placeholders the server substitutes: {W} {H} {FPS}.
//
// LINEAR CHAINS ONLY - no `[labels]`, no split/blend. The server's validator refuses
// brackets, because they are how a filter string escapes into the wider filtergraph.
// That rules out true bloom and overlaid light leaks, which need a second stream; it
// leaves everything below, which is plenty. Particle overlays (confetti, bokeh, snow)
// are the genuine exception and need real footage, not a recipe.
//
// Only three ways to make time pass, and each was checked against real ffmpeg before
// anything here was written - several plausible ones do not work:
//
//   eval=frame   eq, hue, vignette, geq, rotate, crop, zoompan take live expressions.
//                gblur and colortemperature do NOT, whatever their docs imply.
//   enable=      gates any filter on and off. This is how a flicker, a tear or a burst
//                is built out of a filter that has no expression support of its own.
//   temporal     tmix and lagfun read across frames by nature. dblur is structural.
//
// geq is per-pixel and by far the slowest thing here, so it is used only where nothing
// else produces the look - scanlines, waves, and the interlace tear.

// `slow` is measured, not guessed: render cost at 720p as a multiple of realtime, taken
// on this VPS. Everything unflagged runs at 0.1-0.7x and is free in practice; the
// flagged ones are 1.7-4.6x, so a minute of footage costs two to five minutes of
// rendering. That is worth paying for a look you chose and worth SAYING before you wait
// for it - the same reason Stabilize announces itself.
//
// All of them are geq (per-pixel expressions) or edgedetect. There is no cheaper way to
// mirror or ripple inside a linear chain, so the cost is the feature rather than a
// defect to optimise away.
const SLOW = new Set([
  'glitch-tear', 'scanline', 'interlace', 'crt', 'ripple', 'wave-h', 'wobble', 'bulge',
  'edge-glow', 'mirror-left', 'mirror-right', 'mirror-top', 'kaleido',
]);

const E = (id, label, category, chain, premium = true) =>
  ({ id, label, category, chain, premium, slow: SLOW.has(id) });

// A burst that fires for `on` seconds every `period` seconds.
const burst = (period, on) => `enable='lt(mod(t,${period}),${on})'`;

export const EFFECTS = [
  E('none', 'None', 'Basic', null, false),

  // --- Glitch -------------------------------------------------------------
  E('rgbsplit', 'RGB Split', 'Glitch', `rgbashift=rh=-6:bh=6:${burst(0.9, 0.12)}`, false),
  E('rgbsplit-hard', 'Hard Split', 'Glitch', `rgbashift=rh=-18:bh=18:rv=4:bv=-4:${burst(0.7, 0.1)}`),
  E('chroma-bleed', 'Chroma Bleed', 'Glitch', `chromashift=cbh=10:crh=-10:${burst(1.1, 0.18)}`),
  E('static-burst', 'Static Burst', 'Glitch', `noise=alls=44:allf=t:${burst(0.8, 0.2)}`),
  E('signal-drop', 'Signal Drop', 'Glitch', `eq=brightness=-0.5:contrast=1.6:${burst(2.2, 0.06)}`),
  E('pixel-crush', 'Pixel Crush', 'Glitch', `pixelize=w=14:h=14:${burst(1.0, 0.32)}`),
  E('glitch-tear', 'Glitch Tear', 'Glitch',
    `geq=lum='lum(X+12*sin(Y/7+T*30)*lt(mod(T,1.4),0.12),Y)':cb='cb(X,Y)':cr='cr(X,Y)'`),
  E('scanline', 'Scanlines', 'Glitch',
    `geq=lum='lum(X,Y)*(0.78+0.22*sin(Y*1.6))':cb='cb(X,Y)':cr='cr(X,Y)'`, false),
  E('interlace', 'Interlace', 'Glitch',
    `geq=lum='lum(X+6*sin(T*40)*(mod(Y,2)),Y)':cb='cb(X,Y)':cr='cr(X,Y)'`),
  E('glitch-strobe', 'Glitch Strobe', 'Glitch',
    `rgbashift=rh=-14:bh=14:${burst(0.45, 0.07)},noise=alls=30:allf=t:${burst(0.45, 0.07)}`),

  // --- Light --------------------------------------------------------------
  E('strobe', 'Strobe', 'Light', `eq=brightness='0.55*lt(mod(t,0.32),0.06)':eval=frame`, false),
  E('flash-beat', 'Flash', 'Light', `eq=brightness='0.7*lt(mod(t,0.9),0.05)':eval=frame`),
  E('expo-pulse', 'Exposure Pulse', 'Light', `eq=brightness='0.14*sin(t*3.2)':eval=frame`, false),
  E('dark-pulse', 'Dark Pulse', 'Light', `eq=brightness='-0.16*abs(sin(t*2.4))':eval=frame`),
  E('overexpose', 'Blowout', 'Light', `eq=brightness='0.28+0.18*sin(t*1.6)':contrast=1.12:eval=frame`),
  E('flicker', 'Flicker', 'Light', `eq=brightness='0.10*sin(t*37)+0.05*sin(t*61)':eval=frame`),
  E('lightning', 'Lightning', 'Light',
    `eq=brightness='0.85*lt(mod(t,3.1),0.04)+0.5*lt(mod(t+0.12,3.1),0.03)':eval=frame`),
  E('warm-pulse', 'Warm Pulse', 'Light', `eq=gamma_r='1+0.22*abs(sin(t*1.9))':gamma_b='1-0.14*abs(sin(t*1.9))':eval=frame`),
  E('cool-pulse', 'Cool Pulse', 'Light', `eq=gamma_b='1+0.24*abs(sin(t*1.7))':gamma_r='1-0.14*abs(sin(t*1.7))':eval=frame`),
  E('contrast-pump', 'Contrast Pump', 'Light', `eq=contrast='1+0.45*abs(sin(t*2.8))':eval=frame`),

  // --- Trails: read across frames, so they cost nothing extra to look expensive.
  E('echo', 'Echo', 'Trails', 'lagfun=decay=0.92', false),
  E('echo-long', 'Long Echo', 'Trails', 'lagfun=decay=0.97'),
  E('ghost', 'Ghost', 'Trails', 'tmix=frames=10'),
  E('ghost-heavy', 'Heavy Ghost', 'Trails', 'tmix=frames=22'),
  E('comet', 'Comet', 'Trails', 'lagfun=decay=0.95,eq=contrast=1.15:saturation=1.2'),
  E('smear-h', 'Smear', 'Trails', 'dblur=angle=0:radius=14'),
  E('smear-v', 'Vertical Smear', 'Trails', 'dblur=angle=90:radius=14'),
  E('smear-diag', 'Diagonal Smear', 'Trails', 'dblur=angle=45:radius=16'),
  E('trail-pulse', 'Pulsing Trail', 'Trails', `lagfun=decay=0.9:${burst(1.6, 1.0)}`),

  // --- Retro --------------------------------------------------------------
  E('vhs', 'VHS', 'Retro', `chromashift=cbh=7:crh=-7,noise=alls=16:allf=t,eq=saturation=1.25:contrast=0.95`, false),
  E('film-grain', 'Film Grain', 'Retro', 'noise=alls=14:allf=t', false),
  E('grain-heavy', 'Heavy Grain', 'Retro', 'noise=alls=34:allf=t'),
  E('old-film', 'Old Film', 'Retro',
    `noise=alls=20:allf=t,eq=brightness='0.05*sin(t*29)':contrast=1.18:saturation=0.55:eval=frame`),
  E('super8', 'Super 8', 'Retro',
    `noise=alls=18:allf=t,eq=gamma_r=1.14:gamma_b=0.9:brightness='0.04*sin(t*23)':eval=frame,vignette=a=PI/4.5`),
  E('tv-static', 'TV Static', 'Retro', `noise=alls=60:allf=t:${burst(2.0, 0.12)},eq=saturation=0.4`),
  E('crt', 'CRT', 'Retro',
    `geq=lum='lum(X,Y)*(0.82+0.18*sin(Y*2.2))':cb='cb(X,Y)':cr='cr(X,Y)',eq=contrast=1.12`),
  E('damaged-tape', 'Damaged Tape', 'Retro',
    `chromashift=cbh=12:crh=-12:${burst(1.7, 0.2)},noise=alls=28:allf=t:${burst(1.7, 0.2)}`),
  E('sepia-flicker', 'Sepia Flicker', 'Retro',
    `hue=s=0,colorbalance=rm=0.2:gm=0.08:bm=-0.14,eq=brightness='0.06*sin(t*31)':eval=frame`),
  E('gate-weave', 'Gate Weave', 'Retro',
    `crop=iw*0.97:ih*0.97:x='(iw-ow)/2+3*sin(t*4.1)':y='(ih-oh)/2+2*cos(t*3.3)',scale={W}:{H},noise=alls=12:allf=t`),

  // --- Distort ------------------------------------------------------------
  E('ripple', 'Ripple', 'Distort',
    `geq=lum='lum(X+6*sin(Y/12+T*4),Y)':cb='cb(X,Y)':cr='cr(X,Y)'`),
  E('wave-h', 'Wave', 'Distort',
    `geq=lum='lum(X,Y+7*sin(X/16+T*3))':cb='cb(X,Y)':cr='cr(X,Y)'`),
  E('wobble', 'Wobble', 'Distort',
    `geq=lum='lum(X+9*sin(T*6),Y+7*cos(T*5))':cb='cb(X,Y)':cr='cr(X,Y)'`),
  E('pixelate-pulse', 'Pixelate', 'Distort', `pixelize=w=10:h=10:${burst(2.0, 0.7)}`),
  E('mosaic', 'Mosaic', 'Distort', 'pixelize=w=22:h=22'),
  E('zoom-blur', 'Zoom Blur', 'Distort', `boxblur=8:1:${burst(1.0, 0.45)}`),
  E('blur-breathe', 'Blur Breathe', 'Distort', `boxblur=6:1:${burst(2.4, 1.5)}`),
  // Sharpen Pump was written and removed. It renders, but could not be shown to differ
  // measurably from no effect at all - sharpening changes local edge contrast, which
  // mean-pixel-difference barely registers, so the metric cannot tell "subtle" from
  // "absent". Shipping it would have been claiming a distinctness that was never
  // demonstrated. edge-glow covers the same territory and is unambiguous.
  E('edge-glow', 'Edge Glow', 'Distort', 'edgedetect=mode=colormix:high=0.2'),
  E('bulge', 'Bulge', 'Distort',
    `geq=lum='lum(X+(X-W/2)*0.08*sin(T*2),Y+(Y-H/2)*0.08*sin(T*2))':cb='cb(X,Y)':cr='cr(X,Y)'`),

  // --- Colour events ------------------------------------------------------
  E('hue-cycle', 'Hue Cycle', 'Colour', `hue=h='t*40':s=1`, false),
  E('hue-fast', 'Fast Hue', 'Colour', `hue=h='t*180':s=1.1`),
  E('sat-pulse', 'Saturation Pulse', 'Colour', `hue=s='1+0.9*abs(sin(t*2.2))'`),
  E('desat-pulse', 'Desaturate Pulse', 'Colour', `hue=s='1-0.85*abs(sin(t*1.8))'`),
  E('invert-flash', 'Invert Flash', 'Colour', `negate=${burst(1.6, 0.05)}`),
  E('invert', 'Invert', 'Colour', 'negate'),
  E('neon-cycle', 'Neon Cycle', 'Colour', `hue=h='t*70':s=1.6,eq=contrast=1.2`),
  // Posterize (elbg) was written and then removed: measured at 10.9x realtime on 720p,
  // so a one-minute clip would spend eleven minutes on the effect alone. Nothing else
  // here is above 4.6x. Worth retrying if a cheaper quantiser turns up.
  E('duotone-flash', 'Duotone Flash', 'Colour',
    `hue=s=0,colorbalance=rs=0.25:bs=0.3,eq=brightness='0.2*lt(mod(t,1.2),0.08)':eval=frame`),
  E('bleed-warm', 'Warm Bleed', 'Colour', `hue=h='18*sin(t*1.4)':s='1+0.3*sin(t*1.4)'`),

  // --- Mirror: structural rather than temporal, and still not a grade.
  E('mirror-left', 'Mirror Left', 'Mirror', `geq=lum='lum(if(lt(X,W/2),X,W-X),Y)':cb='cb(if(lt(X,W/2),X,W-X),Y)':cr='cr(if(lt(X,W/2),X,W-X),Y)'`),
  E('mirror-right', 'Mirror Right', 'Mirror', `geq=lum='lum(if(gte(X,W/2),X,W-X),Y)':cb='cb(if(gte(X,W/2),X,W-X),Y)':cr='cr(if(gte(X,W/2),X,W-X),Y)'`),
  E('mirror-top', 'Mirror Top', 'Mirror', `geq=lum='lum(X,if(lt(Y,H/2),Y,H-Y))':cb='cb(X,if(lt(Y,H/2),Y,H-Y))':cr='cr(X,if(lt(Y,H/2),Y,H-Y))'`),
  E('kaleido', 'Kaleidoscope', 'Mirror',
    `geq=lum='lum(if(lt(X,W/2),X,W-X),if(lt(Y,H/2),Y,H-Y))':cb='cb(if(lt(X,W/2),X,W-X),if(lt(Y,H/2),Y,H-Y))':cr='cr(if(lt(X,W/2),X,W-X),if(lt(Y,H/2),Y,H-Y))'`),

  // --- Atmosphere ---------------------------------------------------------
  E('vignette-pulse', 'Vignette Pulse', 'Atmosphere', `vignette=a='PI/4.5+0.25*sin(t*1.6)':eval=frame`, false),
  E('tunnel', 'Tunnel', 'Atmosphere', `vignette=a='PI/3.2+0.35*abs(sin(t*2.1))':eval=frame`),
  E('dream', 'Dream', 'Atmosphere', `boxblur=3:1,eq=brightness=0.06:saturation=1.15:contrast=0.92`),
  E('haze', 'Haze', 'Atmosphere', `boxblur=2:1,eq=brightness='0.1+0.05*sin(t*1.2)':contrast=0.88:eval=frame`),
  E('fade-breathe', 'Fade Breathe', 'Atmosphere', `eq=saturation='1-0.5*abs(sin(t*1.1))':eval=frame`),
  E('deep-dark', 'Deep Dark', 'Atmosphere', `vignette=a=PI/3,eq=brightness=-0.05:contrast=1.2`),
];

export function resolveEffect(id) {
  return EFFECTS.find(e => e.id === id) || EFFECTS[0];
}

/** The recipe for an effect id, or null for none. */
export function effectChain(id) {
  const e = EFFECTS.find(x => x.id === id);
  return e && e.chain ? e.chain : null;
}

export const EFFECT_CATEGORIES = [...new Set(EFFECTS.map(e => e.category))];
