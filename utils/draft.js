import AsyncStorage from '@react-native-async-storage/async-storage';

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
