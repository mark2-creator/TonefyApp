import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Animated, StyleSheet, Text, View } from 'react-native';
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
//
// How many frames are DECODED and how many tiles are DRAWN are two different numbers.
// Tying them together is what made a long clip come out as a smear: with the decode
// count capped, a tile had to cover duration/cap seconds, and its width is that times
// the pixels-per-second - so a two minute clip drew forty tiles 120px wide, each one
// frame blown up and cropped to fill. Tiles are kept near their natural size and a
// decoded frame is simply repeated across as many as it has to cover.

// How wide a tile wants to be on the timeline.
const TARGET_TILE_W = 44;

// How many frames are decoded for one source. A long clip repeats them rather than
// getting more - at maxWidth 120 a vertical frame is about 32KB, so this is ~1.3MB of
// bitmaps per distinct source file.
const MAX_DECODED = 40;

// A hard stop on how many tile views one strip may draw, since nothing here
// virtualises. Only a clip over about two minutes reaches it, and past that tiles do
// start to widen - the alternative is hundreds of views on a row that also has to
// stay smooth under a scroll.
const MAX_TILES = 160;

// Native decode size. Tiles are ~44x56 logical points, so 120 leaves headroom for a
// 3x screen without holding a full-resolution frame per tile.
const THUMB_MAX_PX = 120;

// Keyed by source file, not by clip: splitting a clip gives two clips that share one
// file and therefore one strip, and re-selecting a clip must not decode it again.
const stripCache = new Map();

// Keyed on a caller-supplied id rather than the uri.
//
// A clip's uri CHANGES once its file has been copied out of the cache into permanent
// storage. Keyed on the uri, that change is a cache miss: the entry is rebuilt with
// all-null tiles, `haveAny` goes false, and the clip blanks to grey and re-decodes -
// a visible flicker for a file whose pixels did not move. Keyed on an id that survives
// the copy, the already-extracted frames are simply found again.
//
// The id is per FILE, not per clip, which is what keeps two halves of a split sharing
// one strip instead of decoding the same source twice.
function cacheKey(cacheId, count) {
  return cacheId + '|' + count;
}

function describeError(err, uri) {
  const scheme = uri ? String(uri).split(':')[0] : '';
  const msg = err ? String(err.message || err.code || err) : 'unknown';
  return (scheme ? scheme + ': ' : '') + msg.slice(0, 100);
}

// How many frames to decode for this source, and how much time each one stands for.
export function stripGrid(sourceDuration, pixelsPerSecond) {
  const dur = sourceDuration > 0 ? sourceDuration : 0;
  if (!dur) return { count: 0, interval: 0 };
  const ideal = Math.ceil((dur * pixelsPerSecond) / TARGET_TILE_W);
  const count = Math.max(1, Math.min(ideal, MAX_DECODED));
  return { count, interval: dur / count };
}

// Frames arrive into a shared, mutable record and listeners are told each time one
// lands, so the strip fills in as it decodes instead of staying blank until the last
// frame is in. On a long clip the difference is tens of seconds of grey.
function getStrip(cacheId, uri, count, interval) {
  const key = cacheKey(cacheId, count);
  const hit = stripCache.get(key);
  if (hit) return hit;
  const entry = {
    tiles: new Array(count).fill(null),
    done: false,
    error: null,
    listeners: new Set(),
  };
  stripCache.set(key, entry);
  runExtraction(uri, count, interval, entry, key);
  return entry;
}

// One frame per call, always, and never a batch.
//
// `generateThumbnailsAsync` opens a single MediaMetadataRetriever and then fans the
// requested times out across concurrent coroutines that all call into it. That class
// is not thread-safe, and the number of coroutines is the number of times asked for -
// which here scales with the clip's length. Short clips ask for a handful and get away
// with it; a minute of footage asks for forty at once and comes back with nothing.
// Asking one at a time means one coroutine per retriever, which is the only shape that
// is safe to rely on. It costs a retriever per frame, which is why frames are
// published as they land rather than at the end.
async function runExtraction(uri, count, interval, entry, key) {
  const notify = () => entry.listeners.forEach(fn => fn());
  // Sample the middle of each frame's span rather than its leading edge: the first
  // frame of a file is often black or a fade-in, and a strip that opens on black
  // reads as a failed extraction.
  const times = Array.from({ length: count }, (_, i) => (i + 0.5) * interval);
  // A player is only the handle the API hangs off. On Android the frames come from
  // MediaMetadataRetriever, not from the playback decoder, so this does not touch the
  // audio session - but it is still muted and set to mix, because a throwaway player
  // taking audio focus mid-playback has broken this app before.
  let player = null;
  try {
    player = createVideoPlayer(uri);
    player.muted = true;
    player.audioMixingMode = 'mixWithOthers';
    const opts = { maxWidth: THUMB_MAX_PX, maxHeight: THUMB_MAX_PX };
    let lastErr = null;
    for (let i = 0; i < times.length; i += 1) {
      try {
        const [tile] = await player.generateThumbnailsAsync([times[i]], opts);
        entry.tiles[i] = tile || null;
      } catch (err) {
        // A seek point that will not decode holds its place as null rather than being
        // dropped, so the strip keeps its length and goes on lining up with the ruler.
        lastErr = err;
        entry.tiles[i] = null;
      }
      notify();
    }
    // Only worth reporting if it cost every frame. One bad seek in forty is not
    // something to put on the clip.
    if (lastErr && !entry.tiles.some(Boolean)) entry.error = describeError(lastErr, uri);
  } catch (err) {
    entry.error = describeError(err, uri);
    // A source that could not be opened at all should be retried the next time the
    // clip is shown, not remembered as permanently frameless.
    stripCache.delete(key);
    console.warn('[FilmStrip] no frames for', uri, '-', entry.error);
  } finally {
    // createVideoPlayer's instances never release themselves.
    if (player) player.release();
    entry.done = true;
    notify();
  }
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
// React Native's Android draw path is O(children^2) per view group. drawChild runs
// once per child, and each call asks BlendModeHelper.needsIsolatedLayer(this), which
// iterates EVERY child calling getTag - a SparseArray binary search each time
// (ReactViewGroup.kt:885, BlendModeHelper.kt:50). A strip of 160 tiles therefore costs
// ~25,600 getTag calls per frame, per clip, and none of it does anything here: nothing
// in this app sets mix-blend-mode, so the answer is always false.
//
// That is what an ANR on a Galaxy A23 turned out to be - captured by Sentry with
// needsIsolatedLayer at the top of the main thread.
//
// Splitting the tiles into groups turns one N^2 into g^2 + g*k^2. At 160 tiles in
// groups of 12 that is roughly 2,000 calls instead of 25,600 - about 12x less - and it
// is invisible: the groups are plain rows in the same flex direction, so the tiles lay
// out exactly as they did.
const TILES_PER_GROUP = 12;

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export default function FilmStrip({
  uri, type, sourceDuration, width, height, offset = 0, pixelsPerSecond,
  // Defaults to the uri, so a caller that has no stable id behaves exactly as before.
  cacheId,
}) {
  const stripId = cacheId || uri;
  const isVideo = type !== 'image';
  const { count, interval } = useMemo(
    () => (isVideo ? stripGrid(sourceDuration, pixelsPerSecond) : { count: 0, interval: 0 }),
    [isVideo, sourceDuration, pixelsPerSecond]
  );
  const [strip, setStrip] = useState(null);

  useEffect(() => {
    if (!isVideo || !uri || !count) return undefined;
    const entry = getStrip(stripId, uri, count, interval);
    let alive = true;
    const update = () => {
      if (!alive) return;
      setStrip({ tiles: entry.tiles.slice(), done: entry.done, error: entry.error });
    };
    entry.listeners.add(update);
    // Adopt whatever has already landed, for a clip mounting onto a strip another
    // clip cut from the same file has been filling in.
    update();
    return () => { alive = false; entry.listeners.delete(update); };
    // `uri` is deliberately NOT a dependency. It changes when the file is copied into
    // permanent storage, and re-running this would find the same entry anyway - but
    // leaving it out makes that explicit rather than incidental.
  }, [isVideo, stripId, count, interval]);

  // How the strip is drawn: enough tiles to keep each one near its natural size, with
  // each showing whichever decoded frame is nearest the middle of the span it covers.
  const layout = useMemo(() => {
    const dur = sourceDuration > 0 ? sourceDuration : 0;
    if (!dur) return null;
    const spanPx = dur * pixelsPerSecond;
    const tiles = Math.max(1, Math.min(MAX_TILES, Math.round(spanPx / TARGET_TILE_W)));
    return { tiles, tileW: spanPx / tiles, spanPx };
  }, [sourceDuration, pixelsPerSecond]);

  if (!isVideo) {
    // A still has no frames to find, so the strip is that image repeated, laid out
    // over the same span a video's tiles would cover so that a trim windows it the
    // same way. One copy stretched across the clip would smear a photo over the whole
    // timeline.
    const tileW = Math.max(1, height * 0.75);
    // `width` is an Animated node mid-drag and has no number to read here, so the
    // strip is laid out over the source's span; the tiles have to already exist to be
    // revealed as the right edge is pulled out.
    const span = Math.max(sourceDuration || 0, 0) * pixelsPerSecond;
    const repeats = Math.max(1, Math.ceil(span / tileW));
    return (
      <Animated.View style={[styles.window, { width, height }]}>
        <Animated.View style={[styles.row, { left: offset }]}>
          {chunk(Array.from({ length: repeats }, (_, i) => i), TILES_PER_GROUP).map((group, gi) => (
            <View key={gi} style={styles.row}>
              {group.map(i => (
                <Image key={i} source={{ uri }} style={{ width: tileW, height }} contentFit="cover" />
              ))}
            </View>
          ))}
        </Animated.View>
      </Animated.View>
    );
  }

  const decoded = strip ? strip.tiles : null;
  const haveAny = decoded ? decoded.some(Boolean) : false;

  if (!layout || !haveAny) {
    // Say which of the two silences this is. Still working gets a spinner; finished
    // with nothing gets the decoder's own message, and `no duration` covers the case
    // where the picker never reported a length so no grid was built and nothing was
    // ever asked for.
    const working = !!count && (!strip || !strip.done);
    const reason = count ? (strip && strip.error) : 'no duration';
    return (
      <Animated.View style={[styles.window, styles.pending, { width, height }]}>
        <View style={styles.reasonBox}>
          {working
            ? <ActivityIndicator size="small" color="#3a3a3a" />
            : reason
              ? <Text style={styles.reasonText} numberOfLines={2}>{reason}</Text>
              : null}
        </View>
      </Animated.View>
    );
  }

  // The whole source is laid out and the clip's box shows the part of it the clip
  // covers. Sliding the strip is what makes a trim handle cheap: the tiles never
  // change, only how much of them is visible.
  return (
    <Animated.View style={[styles.window, { width, height }]}>
      <Animated.View style={[styles.row, { left: offset }]}>
        {chunk(Array.from({ length: layout.tiles }, (_, i) => i), TILES_PER_GROUP).map((group, gi) => (
        <View key={gi} style={styles.row}>
        {group.map((i) => {
          // The decoded frame nearest the middle of this tile's span. Several tiles
          // share one frame whenever there are more tiles than frames, which is what
          // keeps them at their own size on a long clip instead of each being blown
          // up to cover its share of it.
          const idx = Math.min(decoded.length - 1, Math.floor(((i + 0.5) / layout.tiles) * decoded.length));
          const tile = decoded[idx];
          return tile ? (
            <Image
              key={i}
              source={tile}
              style={{ width: layout.tileW, height }}
              contentFit="cover"
              // The bitmaps are already in memory and handed over as native refs; a
              // fade would flash the strip grey every time a clip re-renders.
              transition={0}
            />
          ) : (
            // A seek point that would not decode, or one not reached yet. It holds its
            // place so the frames either side stay at the time they belong to.
            <View key={i} style={[styles.gap, { width: layout.tileW, height }]} />
          );
        })}
        </View>
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
  // At the clip's head, not centred in it. A clip's box is as wide as its footage -
  // a minute of video is 2400px - so anything centred in it is off the side of the
  // screen, which is how a failing strip came to look like a silent one.
  reasonBox: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 180, alignItems: 'flex-start', justifyContent: 'center', paddingHorizontal: 6 },
  reasonText: { color: '#c94f4f', fontSize: 8, textAlign: 'center' },
});
