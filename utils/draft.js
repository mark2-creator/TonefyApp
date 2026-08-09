import AsyncStorage from '@react-native-async-storage/async-storage';
import { mediaExists } from './mediaStore';

// The editor's work in progress, kept so closing the app does not throw it away.
//
// Nothing about a project was persisted before this: items, audio tracks, text and
// media overlays all start empty on mount, so backgrounding the app long enough for
// Android to reclaim it meant starting the video again from nothing.
//
// What is stored is the description of the edit, not the media: uris, trims, volumes,
// positions. The files themselves stay where the picker left them.

const KEY = 'tonefy.editorDraft.v1';

// In the key, so a change to the shape of what is stored cannot be read back by code
// expecting the old one. An unreadable draft is dropped rather than crashing the
// editor on launch, which is the worst possible place to fail.
export async function saveDraft(draft) {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify({ savedAt: Date.now(), ...draft }));
  } catch {
    // A draft that will not save must not interrupt editing. The next change tries
    // again a second later anyway.
  }
}

export async function loadDraft() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw);
    // A draft with no clips is not worth offering to restore - it would be an empty
    // editor either way, and the question would be noise.
    if (!draft || !Array.isArray(draft.items) || draft.items.length === 0) return null;
    return draft;
  } catch {
    return null;
  }
}

export async function clearDraft() {
  try { await AsyncStorage.removeItem(KEY); } catch {}
}

/** "3 minutes ago", for telling someone what they are about to restore. */
export function describeAge(savedAt) {
  if (!savedAt) return '';
  const mins = Math.max(0, Math.round((Date.now() - savedAt) / 60000));
  if (mins < 1) return 'moments ago';
  if (mins === 1) return 'a minute ago';
  if (mins < 60) return `${mins} minutes ago`;
  const hours = Math.round(mins / 60);
  if (hours === 1) return 'an hour ago';
  if (hours < 24) return `${hours} hours ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'yesterday' : `${days} days ago`;
}

/** Every uri a draft refers to, across all four lists. */
export function draftUris(draft) {
  if (!draft) return [];
  return [
    ...(draft.items || []),
    ...(draft.audioTracks || []),
    ...(draft.textOverlays || []),
    ...(draft.overlays || []),
  ].map(x => x && x.uri).filter(Boolean);
}

/**
 * Check that a draft's media is still on the device, and mark what is not.
 *
 * Android clears the app's cache whenever storage runs low, and until media was
 * copied into permanent storage every draft was one sweep away from being a timeline
 * of broken clips. Copy-on-add fixes that going forward; this handles the drafts
 * saved before it, and the case of a file the user themselves deleted.
 *
 * Marks rather than drops. Someone who has lost two clips of eight can re-pick those
 * two and keep the trims, captions and audio on the other six - dropping them
 * silently would take that away and look like the app losing work of its own accord.
 */
export async function validateDraft(draft) {
  if (!draft) return { draft: null, missing: 0, total: 0 };

  const check = async (list) => {
    const out = [];
    for (const entry of list || []) {
      // A text overlay has no file behind it and is always fine.
      if (!entry || !entry.uri) { out.push(entry); continue; }
      const ok = await mediaExists(entry.uri);
      out.push(ok ? entry : { ...entry, missing: true });
    }
    return out;
  };

  const items = await check(draft.items);
  const audioTracks = await check(draft.audioTracks);
  const overlays = await check(draft.overlays);

  const counted = [...items, ...audioTracks, ...overlays].filter(x => x && x.uri);
  const missing = counted.filter(x => x.missing).length;

  return {
    draft: { ...draft, items, audioTracks, overlays },
    missing,
    total: counted.length,
    // Nothing survived. Offering a project that is entirely holes is worse than
    // starting clean, so the caller drops it rather than restoring a shell.
    allGone: counted.length > 0 && missing === counted.length,
  };
}
