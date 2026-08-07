import React, { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { createVideoPlayer } from 'expo-video';

// A clip on the timeline draws the footage it covers, not one poster frame for the
// whole thing. Without frames there is nothing in the strip to aim at: you cannot
// see where the shot changes, so you cannot put a cut there.
//
// Frames are sampled on a fixed grid over the WHOLE SOURCE FILE, never over the
// trimmed window. Trimming then only moves the window over an already-extracted
// strip, so dragging a handle re-renders instead of re-decoding - extraction is far
// too slow to sit inside a drag.

// How wide a tile wants to be on the timeline. Also sets how much time one frame
// stands for: at PIXELS_PER_SECOND = 40 this is a frame roughly every second.
const TARGET_TILE_W = 44;

// Bounds the work and the memory for one source. A long clip gets coarser tiles
// rather than more of them - at maxWidth 120 a vertical frame is about 32KB, so
// this is ~1.3MB of bitmaps per distinct source file.
const MAX_TILES = 40;

// Native decode size. The tiles are ~44x56 logical points, so 120 leaves headroom
// for a 3x screen without holding a full-resolution frame per tile.
const THUMB_MAX_PX = 120;

// Extraction is keyed by source file, not by clip: splitting a clip gives two clips
// that share one file and therefore one strip, and re-selecting a clip must not
// decode it again. Values are the in-flight promise, so two clips mounting on the
// same frame wait on one extraction rather than racing to do it twice.
const stripCache = new Map();

function cacheKey(uri, count) {
  return uri + '|' + count;
}

// How many tiles this source gets, and how much time each one stands for. Derived
// from the source duration alone so every clip cut from one file agrees.
export function stripGrid(sourceDuration, pixelsPerSecond) {
  const dur = sourceDuration > 0 ? sourceDuration : 0;
  if (!dur) return { count: 0, interval: 0 };
  const ideal = Math.ceil((dur * pixelsPerSecond) / TARGET_TILE_W);
  const count = Math.max(1, Math.min(ideal, MAX_TILES));
  return { count, interval: dur / count };
}

async function extractStrip(uri, times) {
  // A player is only the handle the API hangs off. On Android the frames come from
  // MediaMetadataRetriever, not from the playback decoder, so this does not touch
  // the audio session - but it is still muted and set to mix, because a throwaway
  // player taking audio focus mid-playback has broken this app before.
  const player = createVideoPlayer(uri);
  try {
    player.muted = true;
    player.audioMixingMode = 'mixWithOthers';
    return await player.generateThumbnailsAsync(times, {
      maxWidth: THUMB_MAX_PX,
      maxHeight: THUMB_MAX_PX,
    });
  } finally {
    // createVideoPlayer's instances never release themselves.
    player.release();
  }
}

function loadStrip(uri, count, interval) {
  const key = cacheKey(uri, count);
  const hit = stripCache.get(key);
  if (hit) return hit;
  // Sample the middle of each tile's span rather than its leading edge: the first
  // frame of a file is often black or a fade-in, and a strip that opens on black
  // reads as a failed extraction.
  const times = Array.from({ length: count }, (_, i) => (i + 0.5) * interval);
  const promise = extractStrip(uri, times).catch(() => {
    // A source that cannot be decoded should be retried the next time the clip is
    // shown, not remembered as permanently frameless.
    stripCache.delete(key);
    return null;
  });
  stripCache.set(key, promise);
  return promise;
}

/**
 * The frames under one clip.
 *
 * `width`/`height` are the clip's box on the timeline; `trimStart`/`trimEnd` are
 * absolute offsets into the source, the same convention the rest of the screen uses.
 */
export default function FilmStrip({
  uri, type, sourceDuration, trimStart, trimEnd, width, height, pixelsPerSecond,
}) {
  const isVideo = type !== 'image';
  const { count, interval } = useMemo(
    () => (isVideo ? stripGrid(sourceDuration, pixelsPerSecond) : { count: 0, interval: 0 }),
    [isVideo, sourceDuration, pixelsPerSecond]
  );
  const [tiles, setTiles] = useState(null);

  useEffect(() => {
    if (!isVideo || !uri || !count) return undefined;
    let alive = true;
    loadStrip(uri, count, interval).then((result) => {
      if (alive && result) setTiles(result);
    });
    return () => { alive = false; };
  }, [isVideo, uri, count, interval]);

  // A still image has no frames to find, so the strip is that image repeated. One
  // copy stretched across the clip would smear a photo over the whole timeline.
  if (!isVideo) {
    const tileW = Math.max(1, height * 0.75);
    const repeats = Math.max(1, Math.ceil(width / tileW));
    return (
      <View style={[styles.window, { width, height }]}>
        <View style={styles.row}>
          {Array.from({ length: repeats }, (_, i) => (
            <Image key={i} source={{ uri }} style={{ width: tileW, height }} contentFit="cover" />
          ))}
        </View>
      </View>
    );
  }

  if (!tiles || !tiles.length) {
    return <View style={[styles.window, styles.pending, { width, height }]} />;
  }

  const tileW = interval * pixelsPerSecond;
  // The whole source is laid out and the clip's box shows the part of it the clip
  // covers. Sliding the strip by trimStart is what makes a trim handle free: the
  // tiles never change, only how much of them is visible.
  const offset = -(trimStart || 0) * pixelsPerSecond;

  return (
    <View style={[styles.window, { width, height }]}>
      <View style={[styles.row, { left: offset }]}>
        {tiles.map((tile, i) => (
          <Image
            key={i}
            source={tile}
            style={{ width: tileW, height }}
            contentFit="cover"
            // The bitmaps are already in memory and handed over as native refs;
            // a fade would flash the strip grey every time a clip re-renders.
            transition={0}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  window: { overflow: 'hidden' },
  row: { position: 'absolute', top: 0, flexDirection: 'row' },
  pending: { backgroundColor: '#181818' },
});
