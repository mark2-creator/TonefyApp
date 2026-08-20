// Animated preview tiles for the two catalogues that cannot be shown as a still.
//
// Modelled on gen-transition-previews.mjs, which is the reference for how a picker in
// this app shows what it is offering: a real photograph, put through the real recipe,
// rendered to an animated WebP small enough to have a hundred of them on one screen.
//
// The icons these replace said only which CATEGORY something was in. Every Glitch
// effect drew the same broken-image glyph, so a grid of sixty-eight was a grid of nine
// distinct pictures. A preview rendered from the recipe cannot disagree with the
// result, which is the property that matters.
//
// Two catalogues, two different sources, and the difference is the whole point:
//
//   motions  a STILL photograph, because the motion must be the only thing moving.
//            Rendering a pan over footage that already pans shows neither.
//   effects  a MOVING clip, because lagfun and tmix blend ACROSS frames and have
//            nothing to work with on a still - they would preview as no effect at all,
//            which is exactly the false negative that a verification run against a
//            still produced earlier.
//
// Run: node scripts/gen-recipe-previews.mjs [motions|effects] [--only <id>] [--force]

import { execFile } from 'node:child_process';
import { mkdir, access, writeFile, readdir, rm } from 'node:fs/promises';
import { constants } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { MOTIONS } from '../constants/motions.js';
import { EFFECTS } from '../constants/effects.js';

const run = promisify(execFile);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT_ROOT = path.resolve(HERE, '../../Tonefy-react/backend/public');
// The filter portraits, not the transition photos: these are single-subject frames and
// a face is what most of these recipes are judged against.
const SRC_DIR = path.join(os.homedir(), '.cache/tonefy/filter-src');

// Matches the tile in RecipeSheet - 31.5% of the width at aspectRatio 1.25.
// Deliberately modest, and tuned by measuring rather than by feel.
//
// The grain and film effects dominate the total: temporal noise regenerates every
// frame, so there is nothing for inter-frame compression to find. At 160x128/15fps/q68
// grain-heavy alone was 296KB. Dimensions turned out to be the only lever with real
// give - 128x102 takes it to 152KB - and past that the quality goes before the size
// does.
//
// The rest of the answer is not in the encoder at all: the sheet virtualises, so a
// device fetches the dozen tiles on screen rather than all sixty-eight.
const W = 128, H = 102, FPS = 10, DUR = 1.4;

const args = process.argv.slice(2);
const which = args.find(a => a === 'motions' || a === 'effects');
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
const force = args.includes('--force');

const exists = async p => { try { await access(p, constants.F_OK); return true; } catch { return false; } };
const sub = s => s.replaceAll('{W}', W).replaceAll('{H}', H).replaceAll('{FPS}', FPS);

// A different portrait per tile, cycled by index. One face repeated sixty-eight times
// reads as a placeholder however good the recipes are, and adjacent tiles are what the
// eye compares - so cycling is what stops the grid looking like one clip.
const pick = (i, pool) => pool[i % pool.length];

async function main() {
  if (!which) { console.error('say which: motions | effects'); process.exit(1); }
  const items = (which === 'motions' ? MOTIONS : EFFECTS).filter(x => x.chain);
  const outDir = path.join(OUT_ROOT, which);
  await mkdir(outDir, { recursive: true });

  const pool = (await readdir(SRC_DIR).catch(() => [])).filter(f => /\.(jpe?g|png)$/i.test(f));
  if (!pool.length) { console.error(`no portraits in ${SRC_DIR} - run scripts/fetch-filter-portrait.sh`); process.exit(1); }

  const tmp = path.join(os.tmpdir(), 'tonefy-recipe-prev');
  await mkdir(tmp, { recursive: true });

  let made = 0, skipped = 0, failed = 0;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (only && item.id !== only) continue;
    const out = path.join(outDir, `${item.id}.webp`);
    if (!force && await exists(out)) { skipped++; continue; }
    const src = path.join(SRC_DIR, pick(i, pool));

    // The base clip. For effects it drifts, so anything temporal has real frames to
    // read across; for motions it is held still.
    const fill = `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H}`;
    const base = which === 'effects'
      ? `${fill},scale=${W * 2}:${H * 2},zoompan=z='min(1+0.004*on,1.35)':x='iw/2-(iw/zoom/2)+18*sin(on/18)':y='ih/2-(ih/zoom/2)':d=1:s=${W}x${H}:fps=${FPS}`
      : fill;

    const vf = `${base},${sub(item.chain)},fps=${FPS},format=rgba,setsar=1`;
    try {
      await run('ffmpeg', ['-y', '-v', 'error', '-loop', '1', '-t', String(DUR), '-i', src,
        '-vf', vf, '-loop', '0', '-c:v', 'libwebp_anim', '-lossless', '0', '-q:v', '46', out],
        { timeout: 180000 });
      made++;
      if (made % 15 === 0) console.log(`  ... ${made}`);
    } catch (e) {
      failed++;
      console.error(`  ${item.id}: ${String(e.stderr || e.message).split('\n').filter(Boolean).pop()?.slice(0, 110)}`);
    }
  }
  await rm(tmp, { recursive: true, force: true });

  // A version stamp, so a regenerated tile actually reaches a device. These are served
  // with a long max-age and the URL is otherwise identical between runs.
  const vf = path.resolve(HERE, `../constants/${which === 'motions' ? 'motion' : 'effect'}PreviewVersion.js`);
  await writeFile(vf,
    `// GENERATED by scripts/gen-recipe-previews.mjs - do not edit by hand.\n`
    + `// Bumped whenever the tiles are re-rendered, so a cached one is not served forever.\n`
    + `export const ${which === 'motions' ? 'MOTION' : 'EFFECT'}_PREVIEW_VERSION = ${Date.now()};\n`);

  console.log(`${which}: ${made} rendered, ${skipped} already there, ${failed} failed`);
}
main().catch(e => { console.error(e); process.exit(1); });
