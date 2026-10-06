import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, query, where, limit, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

// Has this account ever finished a video?
//
// Two things depend on the answer (Oct 6 2026): the dashboard's "Make your first video"
// card, shown until the answer is yes, and ProfileGate, which now waits until it is yes
// rather than asking a brand-new user for their name and country before they have seen
// the app do anything. Of the nine strangers who installed after launch, none finished
// a video and none set a country - the first thing they met was a form.
//
// The truth is the user's `userVideos` records, the same ones My Videos lists. Once the
// answer is yes it is remembered on the phone and never asked again; no is not
// remembered, because it stops being true the moment a render finishes.
//
// Returns true, false, or null when it cannot tell (offline, a read failure). Callers
// treat null as "do not change anything", so a dropped connection neither shows the
// card to someone who has made ten videos nor pops a form at someone who has made none.

const key = (uid) => `tonefy.madeVideo.${uid}`;
const listeners = new Set();

export async function hasMadeVideo(uid) {
  if (!uid) return null;
  try {
    if ((await AsyncStorage.getItem(key(uid))) === 'yes') return true;
  } catch (e) { /* fall through to the server */ }
  try {
    const snap = await getDocs(query(collection(db, 'userVideos'), where('userId', '==', uid), limit(1)));
    if (!snap.empty) {
      try { await AsyncStorage.setItem(key(uid), 'yes'); } catch (e) {}
      return true;
    }
    return false;
  } catch (e) {
    return null;
  }
}

// Called by JobsContext when any render finishes, so the card disappears at once
// rather than on the next launch.
export async function markMadeVideo(uid) {
  if (!uid) return;
  try { await AsyncStorage.setItem(key(uid), 'yes'); } catch (e) {}
  listeners.forEach((fn) => { try { fn(uid); } catch (e) {} });
}

export function onMadeVideo(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
