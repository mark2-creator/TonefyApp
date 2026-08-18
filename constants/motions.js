// The motion catalogue.
//
// What a clip DOES while it is on screen, as distinct from what it looks like (filters)
// or how it arrives (transitions). A still photograph with no motion reads as a slide in
// a presentation; the same photograph drifting slowly into a face is the thing every
// short-form editor uses to make stills feel shot rather than pasted.
//
// A motion is a RECIPE - an ffmpeg filter string appended to the clip's own chain - not
// a name the server has to recognise, matching how filters and transitions already work.
// One added here renders without a backend deploy, and there is no second list to drift.
//
// Placeholders the server substitutes: {W} {H} {FPS}. Nothing else is interpolated.
//
// Two idioms, and which one a motion uses is dictated by what it needs to do:
//
//   zoompan - reframes INTO the picture, so it can zoom and pan. It is fed an upscaled
//             frame because zoompan steps its own scale in coarse increments; at native
//             size a slow zoom visibly jitters between steps. `d=1` means one output
//             frame per input frame, which is what makes `on` (the output frame number)
//             usable as the clock.
//
//   crop    - moves a window AROUND the picture without changing its scale, which is
//             what a shake is. The window is inset first so there is somewhere to move
//             to; without the inset the crop hits the edge and the shake flattens
//             against it.
//
// Expressions use `on` (output frame index) rather than `t` wherever the motion should
// finish exactly with the clip: `t` is seconds and would need the duration substituted
// in, which is one more thing to get wrong. Shakes use `t` on purpose - a shake is a
// rate, not a journey, and should look the same on a 2 second clip as on a 10 second one.

// Upscale before zoompan. 2x is enough to hide the stepping at every zoom level in this
// catalogue (max 1.45) and costs far less than the 8x the usual recipe suggests.
const UP = 'scale={W}*2:{H}*2:flags=bicubic';
const ZP = (z, x = 'iw/2-(iw/zoom/2)', y = 'ih/2-(ih/zoom/2)') =>
  `${UP},zoompan=z='${z}':x='${x}':y='${y}':d=1:s={W}x{H}:fps={FPS}`;

// A crop window inset by `pct` of the frame, moved by the given expressions.
const SHAKE = (pct, dx, dy) =>
  `crop=iw*${1 - pct}:ih*${1 - pct}:x='(iw-ow)/2+${dx}':y='(ih-oh)/2+${dy}',scale={W}:{H}`;

const M = (id, label, category, chain, premium = true, stillsOnly = false) =>
  ({ id, label, category, chain, premium, stillsOnly });

export const MOTIONS = [
  M('none', 'None', 'Basic', null, false),

  // --- Zoom: the Ken Burns family. Free, because a still with no motion at all is the
  // thing that makes an app feel cheap, and that should not be behind a paywall.
  M('zoomin', 'Zoom In', 'Zoom', ZP('min(1+0.0009*on,1.22)'), false),
  M('zoomout', 'Zoom Out', 'Zoom', ZP('max(1.22-0.0009*on,1.0)'), false),
  M('zoomin-fast', 'Fast Zoom In', 'Zoom', ZP('min(1+0.0022*on,1.45)')),
  M('zoomout-fast', 'Fast Zoom Out', 'Zoom', ZP('max(1.45-0.0022*on,1.0)')),
  // Snaps in over half a second and then holds - the beat-drop move.
  M('punchin', 'Punch In', 'Zoom', ZP('if(lt(on,15),1+0.012*on,1.18)')),
  M('punchout', 'Punch Out', 'Zoom', ZP('if(lt(on,15),1.18-0.012*on,1.0)')),

  // --- Pan: zoom is held above 1 so there is picture outside the frame to travel over.
  M('panright', 'Pan Right', 'Pan', ZP('1.18', 'on*(iw-iw/zoom)/(25*8)', 'ih/2-(ih/zoom/2)'), false),
  M('panleft', 'Pan Left', 'Pan', ZP('1.18', '(iw-iw/zoom)-on*(iw-iw/zoom)/(25*8)', 'ih/2-(ih/zoom/2)'), false),
  M('pandown', 'Pan Down', 'Pan', ZP('1.18', 'iw/2-(iw/zoom/2)', 'on*(ih-ih/zoom)/(25*8)')),
  M('panup', 'Pan Up', 'Pan', ZP('1.18', 'iw/2-(iw/zoom/2)', '(ih-ih/zoom)-on*(ih-ih/zoom)/(25*8)')),
  // Zoom and travel at once, which is what most "cinematic" stills actually do.
  M('driftin', 'Drift In', 'Pan', ZP('min(1+0.001*on,1.25)', 'on*(iw-iw/zoom)/(25*10)', 'ih/2-(ih/zoom/2)')),

  // --- Shake. Two frequencies that do not divide into each other, or the window
  // travels a straight diagonal and reads as a slide rather than a shake.
  M('shake-soft', 'Soft Shake', 'Shake', SHAKE(0.06, '5*sin(t*17)', '4*cos(t*23)'), false),
  M('shake', 'Shake', 'Shake', SHAKE(0.10, '11*sin(t*31)', '9*cos(t*41)')),
  M('shake-hard', 'Hard Shake', 'Shake', SHAKE(0.16, '20*sin(t*53)', '17*cos(t*67)')),
  // Slow and wandering rather than fast and jittery - a person holding a camera, not an
  // earthquake.
  M('handheld', 'Handheld', 'Shake', SHAKE(0.08, '7*sin(t*2.3)+3*sin(t*5.1)', '6*cos(t*1.9)+3*cos(t*4.3)')),
  M('bump', 'Bump', 'Shake', SHAKE(0.08, '0', '9*sin(t*12)*exp(-mod(t,1)*3)')),

  // --- Pulse: zoom oscillating on a beat.
  M('pulse', 'Pulse', 'Pulse', ZP('1.06+0.05*sin(on/5)')),
  M('heartbeat', 'Heartbeat', 'Pulse', ZP('1.05+0.06*abs(sin(on/7))')),
  M('breathe', 'Breathe', 'Pulse', ZP('1.08+0.07*sin(on/22)'), false),

  // --- Tilt: rotation, kept small. Past about 2 degrees the corners need filling and
  // the frame has to be scaled up to hide them, which changes the framing as well.
  M('sway', 'Sway', 'Tilt', `rotate='0.018*sin(t*1.4)':fillcolor=none,scale={W}:{H}`),
  M('tilt', 'Tilt', 'Tilt', `rotate='0.030*sin(t*2.6)':fillcolor=none,scale={W}:{H}`),
];

export function resolveMotion(id) {
  return MOTIONS.find(m => m.id === id) || MOTIONS[0];
}

/** The recipe for a motion id, or null for none. */
export function motionChain(id) {
  const m = MOTIONS.find(x => x.id === id);
  return m && m.chain ? m.chain : null;
}

export const MOTION_CATEGORIES = [...new Set(MOTIONS.map(m => m.category))];
