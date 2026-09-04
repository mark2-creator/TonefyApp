import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * The one privacy control the app actually honours: whether diagnostics and crash
 * reports (Sentry) may be sent.
 *
 * This exists because the privacy policy promised a diagnostics opt-out and the app had
 * none - a promised control that does not exist is worse than no promise. So the policy
 * now describes THIS, and this actually gates Sentry.
 *
 * How the gate works: `App.js` keeps `Sentry.init({ enabled: true })` but routes every
 * event through `beforeSend`/`beforeSendTransaction`, which drop the event when
 * `shouldSendDiagnostics()` is false. That is a synchronous read, so it needs a value the
 * instant a crash happens - hence the module-level `sendEnabled` flag rather than an
 * AsyncStorage read per event.
 *
 * The flag defaults to true and is corrected by `hydrateDiagnostics()` at boot. A user
 * who has opted out therefore has one very short window at cold start - between init and
 * hydration - where an event could still send. That is the standard trade for a
 * synchronous gate and is acceptable; the alternative (blocking init on an async read)
 * would delay crash capture for the far commoner opted-in case.
 */

const KEY = 'tonefy.diagnostics';

// Sync mirror of the stored preference, read by Sentry's beforeSend on the UI thread.
let sendEnabled = true;

export function shouldSendDiagnostics() {
  return sendEnabled;
}

// Call once at startup, before or alongside Sentry.init, to adopt the stored choice.
export async function hydrateDiagnostics() {
  try {
    const v = await AsyncStorage.getItem(KEY);
    sendEnabled = v !== 'off';   // default ON: only an explicit opt-out disables it
  } catch {
    sendEnabled = true;          // a storage blip must not silently disable reporting
  }
  return sendEnabled;
}

// The toggle's initial value. Async so it reads the truth rather than the cached mirror.
export async function diagnosticsEnabled() {
  try {
    const v = await AsyncStorage.getItem(KEY);
    return v !== 'off';
  } catch {
    return true;
  }
}

export async function setDiagnosticsEnabled(on) {
  sendEnabled = !!on;            // take effect immediately, before the write resolves
  try {
    await AsyncStorage.setItem(KEY, on ? 'on' : 'off');
  } catch {
    // The in-memory flag is already set; a failed persist only means it won't survive a
    // restart, which is the safe direction (reporting comes back on).
  }
}
