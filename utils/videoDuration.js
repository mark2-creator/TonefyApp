import { createVideoPlayer } from 'expo-video';

/**
 * The length of a video file in seconds, or null if it cannot be read.
 *
 * ImagePicker does not always report a duration - variable-frame-rate phone-camera
 * footage frequently comes back without one - and a clip whose length is unknown
 * falls back to 3s everywhere it is drawn, played and exported. That is a 30s take
 * collapsing to three seconds with no way to pull it back, because the trim handle
 * will not extend past a length nothing has measured.
 *
 * The player here never plays. It is muted and set to mix *before* a source is
 * attached, because a throwaway player taking audio focus mid-playback has broken
 * this app before (e1937cfe) - that was expo-av's Sound.unloadAsync reaching
 * AVManager.abandonAudioFocusIfUnused, which is a different module from this one,
 * but the cost of being sure is two lines.
 *
 * The source is attached only after the listener is, which is why the player is
 * constructed with null rather than with the uri: a local file can finish loading
 * promptly, and a sourceLoad that fires before anything is listening would hang the
 * promise until its timeout.
 */
export function measureVideoDuration(uri, opts) {
  return measureVideo(uri, opts).then(r => r.duration);
}

/**
 * Duration AND pixel size, from one load.
 *
 * One sourceLoad event carries both, so the crop editor gets the source's real shape
 * without opening a second player to ask for it.
 */
export function measureVideo(uri, { timeoutMs = 5000 } = {}) {
  return new Promise(resolve => {
    let size = null;
    let player = null;
    let subs = [];
    let timer = null;
    let settled = false;

    const finish = (seconds) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      subs.forEach(s => { try { s.remove(); } catch {} });
      // createVideoPlayer's instances never release themselves.
      try { player?.release(); } catch {}
      resolve({
        duration: Number.isFinite(seconds) && seconds > 0 ? seconds : null,
        width: size?.width || null,
        height: size?.height || null,
      });
    };

    try {
      player = createVideoPlayer(null);
      player.muted = true;
      player.audioMixingMode = 'mixWithOthers';
      subs.push(player.addListener('sourceLoad', ({ duration, availableVideoTracks }) => {
        const track = (availableVideoTracks || [])[0];
        if (track?.size) size = { width: track.size.width, height: track.size.height };
        finish(duration);
      }));
      // A source that fails to open never fires sourceLoad, and waiting the full
      // timeout for an answer that is already known reads as the app hanging.
      subs.push(player.addListener('statusChange', ({ status }) => {
        if (status === 'error') finish(null);
      }));
      // Nothing above guarantees either event ever arrives, and the caller cannot be
      // left waiting on a promise that never settles.
      timer = setTimeout(() => finish(null), timeoutMs);
      player.replaceAsync(uri).catch(() => finish(null));
    } catch {
      finish(null);
    }
  });
}
