import { Platform } from 'react-native';
// The LEGACY file-system API, deliberately.
//
// expo-file-system v19's `File.copy()` is synchronous - it returns void, not a
// promise - so copying a 50MB video would block the JS thread, which is the same
// thread playback, the timeline scroll and every gesture run on. The legacy module
// still exports copyAsync, and a background copy that nobody waits for is exactly
// what this needs. Swap to the new API only if it grows an async copy.
import * as LegacyFS from 'expo-file-system/legacy';

// Media the user picked, copied somewhere Android will not reclaim.
//
// ImagePicker and DocumentPicker hand back a path in the app's CACHE directory, which
// the OS is free to clear whenever storage runs low. That is fine while the app is
// open and fatal afterwards: the editor now saves a draft, and a restored draft whose
// files have been swept shows a timeline of broken clips - worse than not restoring at
// all, because the work looks recoverable and is not.
const DIR = LegacyFS.documentDirectory + 'tonefy-media/';

let dirReady = null;
async function ensureDir() {
  if (!dirReady) {
    dirReady = LegacyFS.makeDirectoryAsync(DIR, { intermediates: true }).catch(() => {});
  }
  return dirReady;
}

/** Whether a uri is already one of ours, and therefore safe from the OS. */
export function isPersisted(uri) {
  return typeof uri === 'string' && uri.startsWith(DIR);
}

/** The directory itself, for the sweep to enumerate. */
export const MEDIA_DIR = DIR;

function extensionOf(uri, fallback) {
  const clean = String(uri || '').split('?')[0].split('#')[0];
  const dot = clean.lastIndexOf('.');
  const ext = dot > -1 ? clean.slice(dot + 1) : '';
  // A query string or a content:// path can leave something that is not an extension.
  return /^[a-zA-Z0-9]{1,5}$/.test(ext) ? ext.toLowerCase() : fallback;
}

/**
 * Copy a picked file into permanent storage and return its new uri.
 *
 * Named by `mediaId` rather than by content, so the same id always lands on the same
 * path - re-running this for an item that has already been copied is a no-op instead
 * of a second copy of the same video.
 *
 * Returns the ORIGINAL uri on any failure. A clip that could not be copied still plays
 * from the cache for this session; refusing to add it because a copy failed would turn
 * a durability problem into a broken picker.
 */
export async function persistMedia(uri, mediaId, kind = 'bin') {
  if (!uri || typeof uri !== 'string') return uri;
  // Already ours, or not a local file at all - a generated voiceover lives on the
  // backend and is durable there, so copying it locally buys nothing.
  if (isPersisted(uri) || /^https?:/i.test(uri)) return uri;
  try {
    await ensureDir();
    const dest = `${DIR}${mediaId}.${extensionOf(uri, kind)}`;
    const info = await LegacyFS.getInfoAsync(dest);
    if (info.exists) return dest;
    await LegacyFS.copyAsync({ from: uri, to: dest });
    return dest;
  } catch {
    return uri;
  }
}

/** A stable id for one picked FILE. */
let seq = 0;
export function newMediaId(prefix = 'm') {
  seq += 1;
  return `${prefix}_${Date.now().toString(36)}_${seq}`;
}

/** Does the file behind a uri still exist? Remote urls are treated as present. */
export async function mediaExists(uri) {
  if (!uri || typeof uri !== 'string') return false;
  if (/^https?:/i.test(uri)) return true;
  try {
    const info = await LegacyFS.getInfoAsync(uri);
    return !!info.exists;
  } catch {
    return false;
  }
}

/**
 * Delete anything in our media directory that the project no longer refers to.
 *
 * Reference-counted rather than tidied as things are deleted: undo can bring a clip
 * back, so removing its file the moment it leaves the timeline would restore a clip
 * pointing at nothing. Sweeping at launch, once the draft is settled, means the only
 * files that go are the ones nothing can reach - deleted clips, abandoned drafts and
 * whatever "Start fresh" left behind, in one rule.
 *
 * Returns what it removed, so a caller can log it rather than guess.
 */
export async function sweepUnreferenced(referencedUris) {
  const kept = new Set(
    (referencedUris || []).filter(u => typeof u === 'string' && u.startsWith(DIR))
  );
  try {
    const names = await LegacyFS.readDirectoryAsync(DIR).catch(() => []);
    let removed = 0;
    let bytes = 0;
    for (const name of names) {
      const uri = DIR + name;
      if (kept.has(uri)) continue;
      try {
        const info = await LegacyFS.getInfoAsync(uri, { size: true });
        bytes += info.size || 0;
        await LegacyFS.deleteAsync(uri, { idempotent: true });
        removed += 1;
      } catch {
        // A file that will not delete is not worth failing a launch over.
      }
    }
    return { removed, bytes };
  } catch {
    return { removed: 0, bytes: 0 };
  }
}
