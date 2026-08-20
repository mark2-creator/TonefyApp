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

// A zoom about a POINT other than the centre. ax/ay run -1..1, so (-1,-1) is the top
// left corner and (0,0) is the middle. Pushing into a face in the upper third is a
// different shot from pushing into the middle of the frame, and it is what most of the
// Ken Burns moves in real edits actually do.
//
// The x expression is the standard `(iw - iw/zoom) * f` with f the fraction of the
// leftover width to place on the left - which is exactly (ax+1)/2.
const ZPA = (z, ax, ay) =>
  ZP(z, `(iw-iw/zoom)*${((ax + 1) / 2).toFixed(3)}`, `(ih-ih/zoom)*${((ay + 1) / 2).toFixed(3)}`);

// A pan that travels while the zoom is held, in either axis. `fx`/`fy` are the fraction
// of the available travel covered per frame, so both axes finish together on a diagonal.
const PAN = (z, fx, fy) => ZP(
  `${z}`,
  fx === 0 ? 'iw/2-(iw/zoom/2)' : (fx > 0 ? `on*(iw-iw/zoom)*${fx}` : `(iw-iw/zoom)*(1${fx}*on)`),
  fy === 0 ? 'ih/2-(ih/zoom/2)' : (fy > 0 ? `on*(ih-ih/zoom)*${fy}` : `(ih-ih/zoom)*(1${fy}*on)`),
);

// A crop window inset by `pct` of the frame, moved by the given expressions.
const SHAKE = (pct, dx, dy) =>
  `crop=iw*${1 - pct}:ih*${1 - pct}:x='(iw-ow)/2+${dx}':y='(ih-oh)/2+${dy}',scale={W}:{H}`;

// `preview` is the same movement expressed as a React Native transform, so the canvas
// can show it live. It is NOT a second definition of the motion - the chain remains the
// only thing that renders - it is the same numbers in the form a View can animate.
//
// Where the two cannot agree exactly they are honest about it: zoompan reframes with
// subpixel sampling on an upscaled source, a transform scales the view. The movement is
// the same movement; the pixels are not the same pixels. That is the difference between
// a preview and a proof, and it is the right trade - every editor previews
// approximately and renders exactly.
//
//   zoom  [from, to]  scale over the clip, linear in time
//   hold  seconds     a zoom that finishes early and holds (punch)
//   pan   [dx, dy]    fraction of the frame travelled, at the zoom above
//   shake {ax,fx,ay,fy}  amplitude in points, frequency in rad/s - the same two
//                        non-dividing frequencies the crop expressions use
//   osc   [mid, amp, freq]  an oscillating scale (pulse family)
//   spin  [amp, freq]  radians
//   drift [amp, freq]  a rotation that travels one way rather than oscillating
//   anchor [ax, ay]    the point a zoom happens about, -1..1, centre is [0,0]. The
//                      canvas turns it into a translate of -(ax*(scale-1)*W/2), which
//                      is exactly what scaling about an off-centre point means.
const M = (id, label, category, chain, premium = true, preview = null) =>
  ({ id, label, category, chain, premium, preview });

export const MOTIONS = [
  M('none', 'None', 'Basic', null, false),

  // --- Zoom: the Ken Burns family. Free, because a still with no motion at all is the
  // thing that makes an app feel cheap, and that should not be behind a paywall.
  M('zoomin', 'Zoom In', 'Zoom', ZP('min(1+0.0009*on,1.22)'), false, { zoom: [1, 1.22] }),
  M('zoomout', 'Zoom Out', 'Zoom', ZP('max(1.22-0.0009*on,1.0)'), false, { zoom: [1.22, 1] }),
  M('zoomin-fast', 'Fast Zoom In', 'Zoom', ZP('min(1+0.0022*on,1.45)'), true, { zoom: [1, 1.45] }),
  M('zoomout-fast', 'Fast Zoom Out', 'Zoom', ZP('max(1.45-0.0022*on,1.0)'), true, { zoom: [1.45, 1] }),
  // Snaps in over half a second and then holds - the beat-drop move.
  M('punchin', 'Punch In', 'Zoom', ZP('if(lt(on,15),1+0.012*on,1.18)'), true, { zoom: [1, 1.18], hold: 0.5 }),
  M('punchout', 'Punch Out', 'Zoom', ZP('if(lt(on,15),1.18-0.012*on,1.0)'), true, { zoom: [1.18, 1], hold: 0.5 }),

  // --- Pan: zoom is held above 1 so there is picture outside the frame to travel over.
  M('panright', 'Pan Right', 'Pan', ZP('1.18', 'on*(iw-iw/zoom)/(25*8)', 'ih/2-(ih/zoom/2)'), false, { zoom: [1.18, 1.18], pan: [0.14, 0] }),
  M('panleft', 'Pan Left', 'Pan', ZP('1.18', '(iw-iw/zoom)-on*(iw-iw/zoom)/(25*8)', 'ih/2-(ih/zoom/2)'), false, { zoom: [1.18, 1.18], pan: [-0.14, 0] }),
  M('pandown', 'Pan Down', 'Pan', ZP('1.18', 'iw/2-(iw/zoom/2)', 'on*(ih-ih/zoom)/(25*8)'), true, { zoom: [1.18, 1.18], pan: [0, 0.14] }),
  M('panup', 'Pan Up', 'Pan', ZP('1.18', 'iw/2-(iw/zoom/2)', '(ih-ih/zoom)-on*(ih-ih/zoom)/(25*8)'), true, { zoom: [1.18, 1.18], pan: [0, -0.14] }),
  // Zoom and travel at once, which is what most "cinematic" stills actually do.
  M('driftin', 'Drift In', 'Pan', ZP('min(1+0.001*on,1.25)', 'on*(iw-iw/zoom)/(25*10)', 'ih/2-(ih/zoom/2)'), true, { zoom: [1, 1.25], pan: [0.10, 0] }),

  // --- Shake. Two frequencies that do not divide into each other, or the window
  // travels a straight diagonal and reads as a slide rather than a shake.
  M('shake-soft', 'Soft Shake', 'Shake', SHAKE(0.06, '5*sin(t*17)', '4*cos(t*23)'), false, { zoom: [1.06, 1.06], shake: { ax: 5, fx: 17, ay: 4, fy: 23 } }),
  M('shake', 'Shake', 'Shake', SHAKE(0.10, '11*sin(t*31)', '9*cos(t*41)'), true, { zoom: [1.10, 1.10], shake: { ax: 11, fx: 31, ay: 9, fy: 41 } }),
  M('shake-hard', 'Hard Shake', 'Shake', SHAKE(0.16, '20*sin(t*53)', '17*cos(t*67)'), true, { zoom: [1.16, 1.16], shake: { ax: 20, fx: 53, ay: 17, fy: 67 } }),
  // Slow and wandering rather than fast and jittery - a person holding a camera, not an
  // earthquake.
  M('handheld', 'Handheld', 'Shake', SHAKE(0.08, '7*sin(t*2.3)+3*sin(t*5.1)', '6*cos(t*1.9)+3*cos(t*4.3)'), true, { zoom: [1.08, 1.08], shake: { ax: 7, fx: 2.3, ay: 6, fy: 1.9 } }),
  M('bump', 'Bump', 'Shake', SHAKE(0.08, '0', '9*sin(t*12)*exp(-mod(t,1)*3)'), true, { zoom: [1.08, 1.08], shake: { ax: 0, fx: 1, ay: 9, fy: 12 } }),

  // --- Pulse: zoom oscillating on a beat.
  M('pulse', 'Pulse', 'Pulse', ZP('1.06+0.05*sin(on/5)'), true, { osc: [1.06, 0.05, 6.0] }),
  M('heartbeat', 'Heartbeat', 'Pulse', ZP('1.05+0.06*abs(sin(on/7))'), true, { osc: [1.05, 0.06, 4.3] }),
  M('breathe', 'Breathe', 'Pulse', ZP('1.08+0.07*sin(on/22)'), false, { osc: [1.08, 0.07, 1.36] }),

  // --- Tilt: rotation, kept small. Past about 2 degrees the corners need filling and
  // the frame has to be scaled up to hide them, which changes the framing as well.
  M('sway', 'Sway', 'Tilt', `rotate='0.018*sin(t*1.4)':fillcolor=none,scale={W}:{H}`, true, { spin: [0.018, 1.4] }),
  M('tilt', 'Tilt', 'Tilt', `rotate='0.030*sin(t*2.6)':fillcolor=none,scale={W}:{H}`, true, { spin: [0.030, 2.6] }),

  // --- Zoom about a point. A push into the upper third is a different shot from a
  // push into the middle, and it is what most real Ken Burns moves do.
  M('zoom-tl', 'Zoom Top Left', 'Zoom', ZPA('min(1+0.0011*on,1.28)', -1, -1), true, { zoom: [1, 1.28], anchor: [-1, -1] }),
  M('zoom-tr', 'Zoom Top Right', 'Zoom', ZPA('min(1+0.0011*on,1.28)', 1, -1), true, { zoom: [1, 1.28], anchor: [1, -1] }),
  M('zoom-bl', 'Zoom Bottom Left', 'Zoom', ZPA('min(1+0.0011*on,1.28)', -1, 1), true, { zoom: [1, 1.28], anchor: [-1, 1] }),
  M('zoom-br', 'Zoom Bottom Right', 'Zoom', ZPA('min(1+0.0011*on,1.28)', 1, 1), true, { zoom: [1, 1.28], anchor: [1, 1] }),
  M('zoom-face', 'Zoom To Face', 'Zoom', ZPA('min(1+0.0012*on,1.32)', 0, -0.55), false, { zoom: [1, 1.32], anchor: [0, -0.55] }),
  M('zoom-out-tl', 'Pull Back Left', 'Zoom', ZPA('max(1.30-0.0011*on,1.0)', -1, -1), true, { zoom: [1.30, 1], anchor: [-1, -1] }),
  M('zoom-out-face', 'Pull Back Face', 'Zoom', ZPA('max(1.32-0.0012*on,1.0)', 0, -0.55), true, { zoom: [1.32, 1], anchor: [0, -0.55] }),
  M('creep', 'Creep', 'Zoom', ZP('min(1+0.00035*on,1.09)'), false, { zoom: [1, 1.09] }),
  M('snap', 'Snap Zoom', 'Zoom', ZP('if(lt(on,5),1+0.04*on,1.2)'), true, { zoom: [1, 1.2], hold: 0.17 }),
  M('reveal', 'Slow Reveal', 'Zoom', ZP('max(1.5-0.0007*on,1.0)'), true, { zoom: [1.5, 1] }),
  M('crash', 'Crash Zoom', 'Zoom', ZP('min(1+0.006*on,1.6)'), true, { zoom: [1, 1.6], hold: 3.3 }),

  // --- Diagonals. Both axes finish together, so the travel reads as one move.
  M('pan-ul', 'Pan Up Left', 'Pan', PAN('1.22', -0.005, -0.005), true, { zoom: [1.22, 1.22], pan: [-0.12, -0.12] }),
  M('pan-ur', 'Pan Up Right', 'Pan', PAN('1.22', 0.005, -0.005), true, { zoom: [1.22, 1.22], pan: [0.12, -0.12] }),
  M('pan-dl', 'Pan Down Left', 'Pan', PAN('1.22', -0.005, 0.005), true, { zoom: [1.22, 1.22], pan: [-0.12, 0.12] }),
  M('pan-dr', 'Pan Down Right', 'Pan', PAN('1.22', 0.005, 0.005), true, { zoom: [1.22, 1.22], pan: [0.12, 0.12] }),
  M('pan-slow-r', 'Slow Pan Right', 'Pan', PAN('1.14', 0.002, 0), false, { zoom: [1.14, 1.14], pan: [0.06, 0] }),
  M('pan-slow-l', 'Slow Pan Left', 'Pan', PAN('1.14', -0.002, 0), false, { zoom: [1.14, 1.14], pan: [-0.06, 0] }),
  M('pan-fast-r', 'Fast Pan Right', 'Pan', PAN('1.30', 0.010, 0), true, { zoom: [1.30, 1.30], pan: [0.26, 0] }),
  M('pan-fast-l', 'Fast Pan Left', 'Pan', PAN('1.30', -0.010, 0), true, { zoom: [1.30, 1.30], pan: [-0.26, 0] }),
  M('tilt-up', 'Tilt Up', 'Pan', PAN('1.26', 0, -0.006), true, { zoom: [1.26, 1.26], pan: [0, -0.16] }),
  M('tilt-down', 'Tilt Down', 'Pan', PAN('1.26', 0, 0.006), true, { zoom: [1.26, 1.26], pan: [0, 0.16] }),

  // --- Zoom and travel at once. The staple of every photo montage ever cut.
  M('kb-in-right', 'Push Right', 'Pan', ZP('min(1+0.0012*on,1.28)', 'on*(iw-iw/zoom)*0.004', 'ih/2-(ih/zoom/2)'), true, { zoom: [1, 1.28], pan: [0.10, 0] }),
  M('kb-in-left', 'Push Left', 'Pan', ZP('min(1+0.0012*on,1.28)', '(iw-iw/zoom)*(1-0.004*on)', 'ih/2-(ih/zoom/2)'), true, { zoom: [1, 1.28], pan: [-0.10, 0] }),
  M('kb-in-up', 'Push Up', 'Pan', ZP('min(1+0.0012*on,1.28)', 'iw/2-(iw/zoom/2)', '(ih-ih/zoom)*(1-0.004*on)'), true, { zoom: [1, 1.28], pan: [0, -0.10] }),
  M('kb-in-down', 'Push Down', 'Pan', ZP('min(1+0.0012*on,1.28)', 'iw/2-(iw/zoom/2)', 'on*(ih-ih/zoom)*0.004'), true, { zoom: [1, 1.28], pan: [0, 0.10] }),
  M('kb-out-right', 'Pull Right', 'Pan', ZP('max(1.30-0.0012*on,1.0)', 'on*(iw-iw/zoom)*0.004', 'ih/2-(ih/zoom/2)'), true, { zoom: [1.30, 1], pan: [0.10, 0] }),
  M('kb-out-left', 'Pull Left', 'Pan', ZP('max(1.30-0.0012*on,1.0)', '(iw-iw/zoom)*(1-0.004*on)', 'ih/2-(ih/zoom/2)'), true, { zoom: [1.30, 1], pan: [-0.10, 0] }),

  // --- More shake. Amplitude and rate are independent: a big slow move is a boat, a
  // small fast one is a hand, and they are not the same feeling.
  M('shake-h', 'Horizontal Shake', 'Shake', SHAKE(0.10, '13*sin(t*29)', '0'), true, { zoom: [1.10, 1.10], shake: { ax: 13, fx: 29, ay: 0, fy: 1 } }),
  M('shake-v', 'Vertical Shake', 'Shake', SHAKE(0.10, '0', '12*sin(t*33)'), true, { zoom: [1.10, 1.10], shake: { ax: 0, fx: 1, ay: 12, fy: 33 } }),
  M('jitter', 'Micro Jitter', 'Shake', SHAKE(0.05, '3*sin(t*71)', '2.5*cos(t*83)'), false, { zoom: [1.05, 1.05], shake: { ax: 3, fx: 71, ay: 2.5, fy: 83 } }),
  M('earthquake', 'Earthquake', 'Shake', SHAKE(0.20, '28*sin(t*47)', '24*cos(t*59)'), true, { zoom: [1.20, 1.20], shake: { ax: 28, fx: 47, ay: 24, fy: 59 } }),
  M('boat', 'Boat', 'Shake', SHAKE(0.09, '9*sin(t*1.1)', '8*cos(t*0.8)'), true, { zoom: [1.09, 1.09], shake: { ax: 9, fx: 1.1, ay: 8, fy: 0.8 } }),
  M('run', 'Running', 'Shake', SHAKE(0.14, '10*sin(t*7.5)', '16*cos(t*15)'), true, { zoom: [1.14, 1.14], shake: { ax: 10, fx: 7.5, ay: 16, fy: 15 } }),
  M('nervous', 'Nervous', 'Shake', SHAKE(0.07, '5*sin(t*43)+2*sin(t*11)', '4*cos(t*37)'), true, { zoom: [1.07, 1.07], shake: { ax: 6, fx: 43, ay: 4, fy: 37 } }),

  // --- Pulse
  M('pulse-fast', 'Fast Pulse', 'Pulse', ZP('1.07+0.06*sin(on/2.5)'), true, { osc: [1.07, 0.06, 12.0] }),
  M('pulse-slow', 'Slow Pulse', 'Pulse', ZP('1.06+0.05*sin(on/12)'), true, { osc: [1.06, 0.05, 2.5] }),
  M('throb', 'Throb', 'Pulse', ZP('1.09+0.09*abs(sin(on/9))'), true, { osc: [1.135, 0.045, 3.33] }),
  M('bounce', 'Bounce', 'Pulse', ZP('1.05+0.07*abs(sin(on/6))'), true, { osc: [1.085, 0.035, 5.0] }),
  M('stutter', 'Stutter', 'Pulse', ZP('1.05+0.07*(lt(mod(on,15),4))'), true, { osc: [1.085, 0.035, 12.5] }),

  // --- Rotation. Small on purpose: past about two degrees the corners come into frame
  // and the picture has to be scaled up to hide them, which changes the framing too.
  M('drift-cw', 'Drift Clockwise', 'Tilt', `rotate='0.0035*t':fillcolor=none,scale={W}:{H}`, true, { drift: [0.0035, 1] }),
  M('drift-ccw', 'Drift Anticlockwise', 'Tilt', `rotate='-0.0035*t':fillcolor=none,scale={W}:{H}`, true, { drift: [-0.0035, 1] }),
  M('dutch', 'Dutch Angle', 'Tilt', `rotate='0.045*min(t,1)':fillcolor=none,scale={W}:{H}`, true, { drift: [0.045, 0], hold: 1 }),
  M('wobble-rot', 'Wobble', 'Tilt', `rotate='0.022*sin(t*4.2)':fillcolor=none,scale={W}:{H}`, true, { spin: [0.022, 4.2] }),
  M('rock', 'Rock', 'Tilt', `rotate='0.038*sin(t*0.9)':fillcolor=none,scale={W}:{H}`, true, { spin: [0.038, 0.9] }),
  M('spiral', 'Spiral In', 'Tilt', `${UP},zoompan=z='min(1+0.0012*on,1.3)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s={W}x{H}:fps={FPS},rotate='0.03*sin(t*1.6)':fillcolor=none,scale={W}:{H}`, true, { zoom: [1, 1.3], spin: [0.03, 1.6] }),
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
