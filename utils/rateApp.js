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
// DELIBERATELY NOT expo-store-review. That is the nicer control - Google's own overlay,
// rated without leaving the app - but it is a NATIVE module, so shipping it means a new
// binary and nobody already holding the app gets the prompt until they update. This
// version uses Linking, which every installed build already has, so it works over the
// air today. When a native build next happens, swap `openStoreListing` for
// StoreReview.requestReview() and nothing else here needs to change.
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

  showAlert(
    'Enjoying Tonefy?',
    'If Tonefy saved you some time, a rating on Google Play genuinely helps other creators find it.',
    [
      { text: 'Not now', style: 'cancel' },
      {
        text: 'Rate Tonefy',
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
