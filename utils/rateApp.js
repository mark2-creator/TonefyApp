import { Linking, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { showAlert } from '../components/BrandedAlert';

// Asking for a Play rating, at the only moment it is fair to ask.
//
// Why this exists: the app had 27 accounts and ZERO ratings, and on Play a zero-rating
// app does not merely look unproven - it ranks below everything that has any, for every
// search term it might otherwise appear in. Ratings are a discovery problem before they
// are a vanity one.
//
// Two routes, chosen by what the INSTALLED binary has:
//   - expo-store-review (build 13 on): Google's own in-app review sheet, rated without
//     leaving the app. Shown DIRECTLY - Google's in-app review guidelines forbid asking
//     anything first ("Do you like the app?", "Would you rate us 5 stars?"), so this
//     route has no pre-prompt of ours at all.
//   - anything older: our own sheet, then the Play listing via Linking, which every build
//     already has.
// expo-store-review is a NATIVE module and its JS calls requireNativeModule at import,
// so a top-level import would throw on build 12 and take the app down (the
// expo-secure-store lesson, item 29). Required lazily inside a try instead.
//
// Asked from two kinds of place (Oct 3 2026): a finished render/export, via JobsContext,
// which every way of making a video goes through - and, until then, only after a social
// post, which is paid-only, so with no subscribers NO real user had ever been asked.
// Saves to the phone COUNT as a win (recordWin) but never ask: those screens show their
// own "Saved" sheet, and BrandedAlert has one host - a prompt would replace it.
const PKG = 'com.ahumuza21213.TonefyApp';
const KEY = 'tonefy.rating';
const WINS_BEFORE_ASKING = 2;        // never on someone's first success - that is a stranger
const ASK_AGAIN_AFTER_DAYS = 60;     // a "not now" is an answer, not a pause

async function readState() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : { wins: 0, lastAskedAt: 0, done: false };
  } catch {
    // A storage failure must never cost someone a finished video, so the safe answer
    // is the one that asks for nothing.
    return null;
  }
}

function storeReview() {
  try { return require('expo-store-review'); } catch { return null; }
}

async function writeState(s) {
  try { await AsyncStorage.setItem(KEY, JSON.stringify(s)); } catch { /* not worth failing for */ }
}

/** Opens the Play listing. market:// hands straight to the Play app; the https URL is
 *  the fallback for a device without it (and for anything that is not Android). */
export async function openStoreListing() {
  const market = `market://details?id=${PKG}`;
  const web = `https://play.google.com/store/apps/details?id=${PKG}`;
  try {
    if (Platform.OS === 'android' && (await Linking.canOpenURL(market))) {
      await Linking.openURL(market);
      return true;
    }
    await Linking.openURL(web);
    return true;
  } catch {
    return false;
  }
}

/** Counts a success without ever asking - for moments that already show their own sheet. */
export async function recordWin() {
  const s = await readState();
  if (!s || s.done) return;
  await writeState({ ...s, wins: s.wins + 1 });
}

/**
 * Record that something went well, and ask for a rating if this is a good moment.
 * Call it after a real success - an export that finished, a post that landed - never
 * on app open, and never after an error.
 */
export async function recordWinAndMaybeAsk() {
  const s = await readState();
  if (!s || s.done) return;

  const wins = s.wins + 1;
  const dueAgain = Date.now() - s.lastAskedAt > ASK_AGAIN_AFTER_DAYS * 86400000;
  if (wins < WINS_BEFORE_ASKING || !dueAgain) {
    await writeState({ ...s, wins });
    return;
  }

  // Written down BEFORE the sheet opens. showAlert dismisses on a backdrop tap and on
  // the back button without running any button's onPress, so a prompt that recorded
  // itself in a button handler would re-appear on every export until someone tapped a
  // real button - which is how a polite request turns into nagging.
  await writeState({ ...s, wins, lastAskedAt: Date.now() });

  // Native sheet when this build has it. Google decides whether it actually appears (it
  // is quota-limited and gives no callback either way), so this is never marked done -
  // the 60-day rule above decides when it is worth asking again.
  const SR = storeReview();
  if (SR) {
    try {
      if (await SR.isAvailableAsync()) { await SR.requestReview(); return; }
    } catch { /* fall through to the Linking route */ }
  }

  // Neutral wording on purpose: no "Enjoying Tonefy?" - asking for an opinion first and
  // only sending the happy ones on is review-gating, which Play's policy forbids.
  showAlert(
    'Rate Tonefy on Google Play?',
    'Ratings help other creators find Tonefy. It only takes a few seconds.',
    [
      { text: 'Not now', style: 'cancel' },
      {
        text: 'Rate on Google Play',
        onPress: async () => {
          // Marked done on the way OUT, not on the way back. Play gives no callback
          // saying whether a rating was left, and someone who went to the store has
          // been asked as far as this app is concerned.
          await writeState({ ...(await readState() || {}), done: true });
          openStoreListing();
        },
      },
    ],
  );
}
