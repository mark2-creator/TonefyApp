import { useEffect, useState } from 'react';
import { createVideoPlayer } from 'expo-video';

// One frame of a video file, for showing it as a still. A video overlay has to be
// positioned against the footage it will sit on, and the only alternative to a poster
// frame is a second live decoder inside the preview - which on Android means another
// player competing with the one already driving the canvas, in an app whose audio
// session has been broken by a throwaway player before (e1937cfe).
//
// Keyed by uri, and the cached value is the in-flight promise, so several mounts of
// the same source wait on one extraction rather than starting their own.
const posterCache = new Map();

export function getPosterFrame(uri) {
  const hit = posterCache.get(uri);
  if (hit) return hit;
  const promise = extract(uri).catch(() => null);
  posterCache.set(uri, promise);
  return promise;
}

async function extract(uri) {
  let player = null;
  try {
    player = createVideoPlayer(uri);
    player.muted = true;
    player.audioMixingMode = 'mixWithOthers';
    // Not the very first frame: a file that opens on black or a fade-in gives a
    // poster with nothing in it to aim by.
    const [frame] = await player.generateThumbnailsAsync([0.5], { maxWidth: 480, maxHeight: 480 });
    return frame || null;
  } catch {
    // A source that will not decode is not worth remembering as permanently
    // posterless - a later mount may succeed where this one did not.
    posterCache.delete(uri);
    return null;
  } finally {
    // createVideoPlayer's instances never release themselves.
    if (player) player.release();
  }
}

/** The poster for a uri, or null until it lands. Images resolve to their own uri. */
export function usePosterFrame(uri, isVideo) {
  const [poster, setPoster] = useState(null);
  useEffect(() => {
    if (!isVideo || !uri) { setPoster(null); return undefined; }
    let alive = true;
    getPosterFrame(uri).then(f => { if (alive) setPoster(f); });
    return () => { alive = false; };
  }, [uri, isVideo]);
  return poster;
}
