import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

// Downloading a finished video so it lands somewhere the user can find it.
//
// This replaces Linking.openURL(url), which handed the video's URL to the phone's
// browser: the video opened in Chrome and the user had to download it from there. It
// worked in the narrow sense and did nothing a "Download" button in a video app is
// expected to do.
//
// Two routes, and which one runs depends on the binary rather than on anything here:
//
//   expo-media-library present -> saved straight into the gallery, in a Tonefy album.
//   absent                     -> downloaded, then handed to the system share sheet,
//                                 where "Save to Gallery" or sending it to WhatsApp is
//                                 one tap away.
//
// media-library is a NATIVE module and was not in versionCode 9, so a top-level import
// would reach that install as JS for something not compiled in and take the screen down
// (see "A native module cannot ship over the air" in CLAUDE.md). Required lazily inside
// a try, so build 9 gets the share sheet today and the gallery path switches itself on
// when a build containing the module is installed - with no further change here.
function getMediaLibrary() {
  try {
    return require('expo-media-library');
  } catch (e) {
    return null;
  }
}

// A filename the user will recognise in their gallery, from the prompt that made the
// video. Stripped to characters that are safe on every filesystem, because a slash or a
// colon in a filename fails at the write rather than at the download, after the whole
// file has already been fetched.
function fileNameFor(video) {
  const base = (video?.prompt || 'Tonefy video')
    .replace(/[^\p{L}\p{N} _-]/gu, '')
    .trim()
    .slice(0, 40) || 'Tonefy video';
  return `${base}.mp4`;
}

/**
 * Downloads a finished video and puts it somewhere the user can reach.
 *
 * Resolves to { method: 'gallery' | 'share', uri } so the caller can say which
 * happened - "Saved to your gallery" and "choose where to save it" are different
 * outcomes and should not share one message.
 */
export async function saveVideoToDevice(url, video) {
  if (!url) throw new Error('This video has no file to download.');

  // Into cache rather than documents: once it is in the gallery or has been shared,
  // this copy is a duplicate, and the OS may reclaim cache on its own.
  const target = new File(Paths.cache, fileNameFor(video));
  try { if (target.exists) target.delete(); } catch (e) {}

  const downloaded = await File.downloadFileAsync(url, target);
  const localUri = downloaded.uri;

  const MediaLibrary = getMediaLibrary();
  if (MediaLibrary) {
    // Only ever asks on the build that can actually honour the answer.
    const perm = await MediaLibrary.requestPermissionsAsync();
    if (perm.granted) {
      const asset = await MediaLibrary.createAssetAsync(localUri);
      try {
        const album = await MediaLibrary.getAlbumAsync('Tonefy');
        if (album) await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
        else await MediaLibrary.createAlbumAsync('Tonefy', asset, false);
      } catch (e) {
        // The asset is already in the gallery; failing to file it into an album is
        // not worth turning a successful save into an error.
      }
      return { method: 'gallery', uri: asset.uri };
    }
    // Permission refused is a choice, not a failure - fall through to the share
    // sheet, which needs no permission at all.
  }

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available on this device.');
  }
  await Sharing.shareAsync(localUri, {
    mimeType: 'video/mp4',
    dialogTitle: 'Save or share your video',
    UTI: 'public.movie', // iOS only; ignored on Android
  });
  return { method: 'share', uri: localUri };
}

export const SAVE_PLATFORM_NOTE = Platform.OS === 'android'
  ? 'Choose "Save to Gallery" to keep it on your phone.'
  : 'Choose "Save Video" to keep it on your phone.';
