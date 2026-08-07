import React, { useEffect, useMemo, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
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

function describeError(err) {
  if (!err) return 'unknown';
  return String(err.message || err.code || err).slice(0, 120);
}

// Ask for every frame in one call. This is the fast path and the one that should
// normally run.
//
// It is not the only path because the native side awaits the whole batch together:
// one time it cannot decode rejects every frame with it, and the clip is left with
// no strip at all rather than with one gap. That is not hypothetical - a frame can
// fail to come back for a single seek point on a variable-frame-rate recording,
// which phone cameras produce as a matter of course.
async function generateTiles(player, times, opts) {
  try {
    return { tiles: await player.generateThumbnailsAsync(times, opts), error: null };
  } catch (batchErr) {
    // Ask again one frame at a time and keep whatever comes back. A time that fails
    // stays null rather than being dropped, so the strip keeps its full length and
    // goes on lining up with the ruler.
    const tiles = [];
    let lastErr = batchErr;
    let anyOk = false;
    for (const t of times) {
      try {
        const [tile] = await player.generateThumbnailsAsync([t], opts);
        tiles.push(tile || null);
        if (tile) anyOk = true;
      } catch (err) {
        lastErr = err;
        tiles.push(null);
      }
    }
    if (!anyOk) throw lastErr;
    return { tiles, error: describeError(lastErr) };
  }
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
    return await generateTiles(player, times, {
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
  const promise = extractStrip(uri, times).catch((err) => {
    // A source that cannot be decoded should be retried the next time the clip is
    // shown, not remembered as permanently frameless.
    stripCache.delete(key);
    // Reported rather than swallowed. A strip that silently stays grey gives nothing
    // to act on, and this failure is only reachable on a real device.
    console.warn('[FilmStrip] no frames for', uri, '-', describeError(err));
    return { tiles: null, error: describeError(err) };
  });
  stripCache.set(key, promise);
  return promise;
}

/**
 * The frames under one clip.
 *
 * `width` is the clip's box and `offset` is how far the strip is slid left inside it,
 * which is -trimStart * pixelsPerSecond. Both may be Animated values: a trim handle
 * drags by changing exactly these two numbers, and taking them as inputs rather than
 * deriving them from trimStart is what lets it do so at frame rate without this
 * component knowing a drag is in progress.
 */
export default function FilmStrip({
  uri, type, sourceDuration, width, height, offset = 0, pixelsPerSecond,
}) {
  const isVideo = type !== 'image';
  const { count, interval } = useMemo(
    () => (isVideo ? stripGrid(sourceDuration, pixelsPerSecond) : { count: 0, interval: 0 }),
    [isVideo, sourceDuration, pixelsPerSecond]
  );
  const [tiles, setTiles] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isVideo || !uri || !count) return undefined;
    let alive = true;
    setError(null);
    loadStrip(uri, count, interval).then((result) => {
      if (!alive || !result) return;
      if (result.tiles) setTiles(result.tiles);
      if (result.error) setError(result.error);
    });
    return () => { alive = false; };
  }, [isVideo, uri, count, interval]);

  if (!isVideo) {
    // A still image has no frames to find, so the strip is that image repeated, laid
    // out over the same span a video's tiles would cover so that a trim windows it the
    // same way. One copy stretched across the clip would smear a photo over the whole
    // timeline.
    const tileW = Math.max(1, height * 0.75);
    // Laid out over the longest the still can be, not over the clip's current width -
    // `width` is an Animated node mid-drag and has no number to read here, and the
    // tiles have to already exist to be revealed as the right edge is pulled out.
    const span = Math.max(sourceDuration || 0, 0) * pixelsPerSecond;
    const repeats = Math.max(1, Math.ceil(span / tileW));
    return (
      <Animated.View style={[styles.window, { width, height }]}>
        <Animated.View style={[styles.row, { left: offset }]}>
          {Array.from({ length: repeats }, (_, i) => (
            <Image key={i} source={{ uri }} style={{ width: tileW, height }} contentFit="cover" />
          ))}
        </Animated.View>
      </Animated.View>
    );
  }

  if (!tiles || !tiles.length) {
    // Why there are no frames, on the clip, rather than in a log no phone will show.
    // `no duration` means nothing ever asked for a frame - the picker did not report
    // how long the video is, so there was no grid to sample. Anything else is the
    // decoder's own message.
    const reason = error || (count ? null : 'no duration');
    return (
      <Animated.View style={[styles.window, styles.pending, { width, height }]}>
        {reason ? (
          <View style={styles.reasonBox}>
            <Text style={styles.reasonText} numberOfLines={2}>{reason}</Text>
          </View>
        ) : null}
      </Animated.View>
    );
  }

  const tileW = interval * pixelsPerSecond;

  // The whole source is laid out and the clip's box shows the part of it the clip
  // covers. Sliding the strip is what makes a trim handle cheap: the tiles never
  // change, only how much of them is visible.
  return (
    <Animated.View style={[styles.window, { width, height }]}>
      <Animated.View style={[styles.row, { left: offset }]}>
        {tiles.map((tile, i) => (
          tile ? (
            <Image
              key={i}
              source={tile}
              style={{ width: tileW, height }}
              contentFit="cover"
              // The bitmaps are already in memory and handed over as native refs;
              // a fade would flash the strip grey every time a clip re-renders.
              transition={0}
            />
          ) : (
            // A seek point that would not decode. It holds its place so the frames
            // either side of it stay at the time they belong to.
            <View key={i} style={[styles.gap, { width: tileW, height }]} />
          )
        ))}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  window: { overflow: 'hidden' },
  row: { position: 'absolute', top: 0, flexDirection: 'row' },
  pending: { backgroundColor: '#181818' },
  gap: { backgroundColor: '#242424' },
  reasonBox: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  reasonText: { color: '#c94f4f', fontSize: 8, textAlign: 'center' },
});
