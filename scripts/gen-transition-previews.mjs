// Renders one animated preview per transition, through the same ffmpeg filters the
// export uses.
//
// The previews used to be a hand-written switch in the picker that animated two
// Unsplash images with RN Animated, and each `case` covered a whole group of ids - so
// a dozen transitions showed the same clip and none of them showed what the export
// would actually do. Generating them from the recipe means a preview cannot be
// generic and cannot drift: it IS the transition.
//
// Run: node scripts/gen-transition-previews.mjs [--only <id>] [--force]
// Writes to backend/public/transitions/<id>.webp, served as /transitions/<id>.webp.

import { execFile } from 'node:child_process';
import { mkdir, access, writeFile, readdir } from 'node:fs/promises';
import os from 'node:os';
import { constants } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { TRANSITIONS } from '../constants/transitions.js';

const run = promisify(execFile);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(HERE, '../../Tonefy-react/backend/public/transitions');
// Real photographs, downloaded once and reused. Cached outside both repos: they are
// inputs to a build step, not source, and ~2MB of stock jpegs does not belong in git.
// Refill with scripts/fetch-transition-photos.sh if the cache is empty.
const SRC_DIR = path.join(os.homedir(), '.cache/tonefy/transition-src');

// Small: these are tiles in a grid, and 133 of them are on one screen.
const W = 160, H = 90, FPS = 20;
// Long enough to read the movement, short enough to loop without becoming a
// distraction behind the one the user is actually looking at.
const HOLD = 0.9, XDUR = 0.6, OFFSET = 0.3;

const args = process.argv.slice(2);
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
const force = args.includes('--force');

// Two frames that differ in colour AND structure. A smooth gradient sliding across a
// smooth gradient shows almost nothing; the band is what makes the motion legible.
// gradients is a SOURCE filter - it has no inputs, so it generates at the head of a
// chain rather than being fed one. speed=0 holds it still; left at its default it
// slowly rotates, which would put motion in the preview that the transition is not
// responsible for.
// Each transition gets its OWN pair of photographs. Two shared gradients showed the
// shape of a move but nothing about how it reads over real footage - a grade, a grain
// or a blur has almost nothing to act on in a flat ramp - and 133 tiles running the
// same two frames made the grid look like one effect rendered 133 times.
//
// Pairing is by index, so it is stable across runs: transition i uses photo i against
// photo i+1. Every transition therefore has a distinct pair AND a distinct first
// frame, which is what stops neighbouring tiles reading as the same clip.
function pairFor(index, photos) {
  const n = photos.length;
  return [photos[index % n], photos[(index + 1) % n]];
}

// Fill the frame rather than letterbox it: a bar down the side of a tile reads as a
// broken image, and a transition that slides needs the whole frame to slide.
function inputFilter(stream) {
  return `[${stream}:v]scale=${W}:${H}:force_original_aspect_ratio=increase,`
    + `crop=${W}:${H},fps=${FPS},format=rgba,setsar=1`;
}

function buildFilter(t) {
  const a = `${inputFilter(0)}[a]`;
  const b = `${inputFilter(1)}[b]`;
  // A cut has no xfade to run. Give it the shortest join ffmpeg will take so the
  // preview still shows both frames and reads as the hard cut it is.
  const base = t.base || 'fade';
  const dur = t.base ? XDUR : 0.02;
  const off = t.base ? OFFSET : 0.6;
  const parts = [a, b, `[a][b]xfade=transition=${base}:duration=${dur}:offset=${off}[xf]`];
  // Gated to the join, exactly as the export gates it, so an effect that would bleed
  // over the whole clip in the real render bleeds here too and is caught.
  let last = 'xf';
  (t.fx || []).forEach((f, i) => {
    const label = `fx${i}`;
    const sep = f.includes('=') ? ':' : '=';
    parts.push(`[${last}]${f}${sep}enable='between(t,${off},${(off + dur).toFixed(3)})'[${label}]`);
    last = label;
  });
  return { filter: parts.join(';'), last };
}

async function exists(p) {
  try { await access(p, constants.F_OK); return true; } catch { return false; }
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const photos = (await readdir(SRC_DIR).catch(() => []))
    .filter(f => f.endsWith('.jpg'))
    // Numeric order, so the pairing does not shuffle when the filesystem returns
    // things in a different order and every preview silently changes.
    .sort((x, y) => Number(x.match(/\d+/)?.[0] ?? 0) - Number(y.match(/\d+/)?.[0] ?? 0))
    .map(f => path.join(SRC_DIR, f));
  if (photos.length < 2) {
    console.error(`need photos in ${SRC_DIR} - run scripts/fetch-transition-photos.sh first`);
    process.exit(1);
  }

  const list = only ? TRANSITIONS.filter(t => t.id === only) : TRANSITIONS;
  if (!list.length) { console.error('no such transition:', only); process.exit(1); }

  let made = 0, skipped = 0;
  const failed = [];
  for (const t of list) {
    const out = path.join(OUT_DIR, `${t.id}.webp`);
    if (!force && await exists(out)) { skipped += 1; continue; }
    const { filter, last } = buildFilter(t);
    // Index into the full catalogue, not the filtered list, so --only regenerates a
    // tile with the same photographs a full run gave it.
    const [imgA, imgB] = pairFor(TRANSITIONS.indexOf(t), photos);
    try {
      await run('ffmpeg', [
        '-v', 'error', '-y',
        '-loop', '1', '-t', String(HOLD), '-i', imgA,
        '-loop', '1', '-t', String(HOLD), '-i', imgB,
        '-filter_complex', filter,
        '-map', `[${last}]`,
        '-loop', '0', '-c:v', 'libwebp_anim', '-lossless', '0', '-q:v', '72',
        out,
      ], { timeout: 60000 });
      made += 1;
    } catch (err) {
      // One transition that will not render must not take the other 132 with it.
      failed.push({ id: t.id, why: String(err.stderr || err.message).trim().split('\n').pop() });
    }
  }

  console.log(`made ${made}, skipped ${skipped}, failed ${failed.length}`);
  if (failed.length) {
    failed.forEach(f => console.log(`  FAIL ${f.id}: ${f.why}`));
    // A manifest of what actually exists, so the picker can hide a tile rather than
    // showing a broken image for a preview that was never produced.
    process.exitCode = 1;
  }
  const ok = list.filter(t => !failed.some(f => f.id === t.id)).map(t => t.id);
  await writeFile(path.join(OUT_DIR, 'manifest.json'), JSON.stringify({ previews: ok }, null, 2));
}

main();
