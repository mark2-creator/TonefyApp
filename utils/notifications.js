import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Re-engagement reminders: an idea or a feature to try, at 6pm, while someone is away.
//
// expo-notifications is a NATIVE module, which makes this the one feature in the app
// that an over-the-air update cannot deliver. The binary currently on the phone
// (runtime 1.1.0) has no notification code compiled into it, and an OTA update that
// imported this module at the top level would throw on launch and grey-screen the app
// - the worst failure this project has, and one it has hit before.
//
// So the module is required lazily, inside a try. On a build that has it, everything
// works. On one that does not, `mod()` returns null, every function below turns into
// a no-op, and the app carries on exactly as it did. That makes this safe to ship OTA
// today and live the moment a new build is installed, rather than being a change that
// has to wait for one.
let cached;
function mod() {
  if (cached !== undefined) return cached;
  try {
    // eslint-disable-next-line global-require
    cached = require('expo-notifications');
  } catch {
    cached = null;
  }
  return cached;
}

/** Whether this build can show notifications at all. */
export function notificationsAvailable() {
  return !!mod();
}

const ASKED_KEY = 'tonefy.notifPermissionAsked';
const SCHEDULED_KEY = 'tonefy.notifScheduled';

// Android puts every notification in a channel, and one that is never created is
// silently dropped rather than shown. Created once, before anything is scheduled.
async function ensureChannel(N) {
  if (Platform.OS !== 'android') return;
  await N.setNotificationChannelAsync('reminders', {
    name: 'Reminders',
    importance: N.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 200, 100, 200],
    lightColor: '#00d4d4',
  }).catch(() => {});
}

/**
 * Ask for permission, but only once ever.
 *
 * Asking on first launch, before anything has been made, is how an app gets denied
 * permanently - the answer is no when there is nothing to be reminded about yet. The
 * caller decides the moment; this only guarantees it is not asked twice.
 */
export async function requestNotificationPermission() {
  const N = mod();
  if (!N) return false;
  try {
    const asked = await AsyncStorage.getItem(ASKED_KEY);
    const current = await N.getPermissionsAsync();
    if (current.granted) return true;
    // Already declined once: asking again is the OS showing nothing and us believing
    // we asked.
    if (asked && !current.canAskAgain) return false;
    await AsyncStorage.setItem(ASKED_KEY, '1');
    const res = await N.requestPermissionsAsync();
    if (res.granted) await ensureChannel(N);
    return !!res.granted;
  } catch {
    return false;
  }
}

// The nudges (rebuilt Oct 3 2026, owner: "like CapCut - almost daily").
//
// Each one names something the app really does and opens the screen that does it - a
// notification that only says "come back" is the kind people switch off. No emoji, per
// the app-wide rule. Rotated so nobody sees the same line two days running.
const MESSAGES = [
  { title: 'Got an idea for a video?', body: 'Type it into Tonefy AI and get a finished video with voiceover and captions in about a minute.', route: 'IdeaToVideo' },
  { title: 'Open with something new', body: 'Paid plans can generate an AI opening scene for every video. Give your next one a hook.', route: 'IdeaToVideo' },
  { title: 'Post everywhere in one tap', body: 'Send your next video to TikTok, YouTube, Pinterest and LinkedIn at once.', route: 'Social' },
  { title: '138 caption styles', body: 'Bold, neon, highlight, sticker... captions people actually stop scrolling for.', route: 'EditVideo' },
  { title: 'Already have a script?', body: 'Paste it into Script to Video and Tonefy AI finds the footage for every line.', route: 'ScriptToVideo' },
  { title: 'Turn an article into a video', body: 'Paste a link and Tonefy AI writes, voices and edits a short video from it.', route: 'UrlToVideo' },
  { title: 'Over 300 voices', body: 'Give your next voiceover a new voice, in the language your audience speaks.', route: 'ScriptToAudio' },
  { title: 'Speak to a new audience', body: 'Video Translator re-voices a clip in another language. Try it in the editor.', route: 'EditVideo' },
  { title: 'Five minutes is enough', body: 'One short video today keeps your channel growing. Tonefy AI does the editing.', route: 'IdeaToVideo' },
  { title: 'Make a thumbnail that gets clicks', body: 'Pick a frame, add bold text, done. Thumbnails for YouTube, TikTok and more.', route: 'Thumbnail' },
  { title: 'Plan the week ahead', body: 'Schedule your posts once and Tonefy AI publishes them on time.', route: 'Social' },
  { title: 'Your videos are waiting', body: 'Open My Videos to post, download or edit something you already made.', route: 'MainTabs' },
  { title: 'Record and polish', body: 'Film yourself and let Tonefy AI add captions, music and effects.', route: 'RecordToVideo' },
  { title: 'Consistency beats perfect', body: 'Creators who post often grow fastest. Make today\'s video in a minute.', route: 'IdeaToVideo' },
];

// When: every day for the first week, then every other day up to a month, always at
// 6pm local time - after work and school, when people scroll. Rebuilt from NOW each time
// the app is opened (refreshReminders), so someone who uses Tonefy daily never gets one:
// it only reaches people who have drifted away, which is how CapCut does it too.
const HOUR = 18;
const SCHEDULE_DAYS = [1, 2, 3, 4, 5, 6, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31];

const OPT_OUT_KEY = 'tonefy.notifOptOut';
const ROTATION_KEY = 'tonefy.notifRotation';

/**
 * Schedule the series, replacing anything already scheduled. `fromUser` is the
 * Notifications screen's switch being turned ON; anything automatic respects an
 * earlier OFF and does nothing.
 */
export async function scheduleReminders({ fromUser = false } = {}) {
  const N = mod();
  if (!N) return false;
  try {
    if (fromUser) await AsyncStorage.removeItem(OPT_OUT_KEY);
    else if (await AsyncStorage.getItem(OPT_OUT_KEY)) return false;
    const perms = await N.getPermissionsAsync();
    if (!perms.granted) return false;
    await ensureChannel(N);
    await N.cancelAllScheduledNotificationsAsync();
    // Start the rotation where the last series stopped, so a returning user does not
    // see message one again every time.
    const start = Number(await AsyncStorage.getItem(ROTATION_KEY)) || 0;
    const now = new Date();
    for (let i = 0; i < SCHEDULE_DAYS.length; i++) {
      const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + SCHEDULE_DAYS[i], HOUR, 0, 0);
      const m = MESSAGES[(start + i) % MESSAGES.length];
      await N.scheduleNotificationAsync({
        content: {
          title: m.title,
          body: m.body,
          data: { kind: 'reengage', route: m.route },
          ...(Platform.OS === 'android' ? { channelId: 'reminders' } : {}),
        },
        trigger: { type: N.SchedulableTriggerInputTypes.DATE, date: at },
      });
    }
    // Opening the app tomorrow rebuilds from tomorrow; the next series starts one
    // message further on.
    await AsyncStorage.setItem(ROTATION_KEY, String((start + 1) % MESSAGES.length));
    await AsyncStorage.setItem(SCHEDULED_KEY, String(Date.now()));
    return true;
  } catch {
    return false;
  }
}

/** Called on every app open and return to foreground: restarts the clock. Silent no-op
 *  without permission, without the native module, or after the user turned them off. */
export async function refreshReminders() {
  return scheduleReminders();
}

/**
 * Ask for permission with our own one-line explanation first, then the system dialog.
 * Android 13 lets the system dialog be answered "no" for good, so it is only shown to
 * someone who has just said yes to the idea. Asked once ever (see ASKED_KEY).
 */
export async function askForReminders(showAlert) {
  const N = mod();
  if (!N) return false;
  try {
    if ((await N.getPermissionsAsync()).granted) { await refreshReminders(); return false; }
    if (await AsyncStorage.getItem(ASKED_KEY)) return false;
    if (await AsyncStorage.getItem(OPT_OUT_KEY)) return false;
  } catch { return false; }
  showAlert(
    'Get a video idea now and then?',
    'Tonefy AI can send you a short reminder with an idea or a feature to try. You can turn this off any time in Settings, Notifications.',
    [
      { text: 'Not now', style: 'cancel', onPress: () => { AsyncStorage.setItem(ASKED_KEY, '1').catch(() => {}); } },
      { text: 'Yes, remind me', onPress: async () => { if (await requestNotificationPermission()) await scheduleReminders(); } },
    ],
    { cancelable: false },
  );
  return true;   // a prompt is on screen - the caller should not open another
}

/** The route of the notification that launched the app from cold, if any. */
export async function launchRouteFromNotification() {
  const N = mod();
  if (!N) return null;
  try { return routeFromNotification(await N.getLastNotificationResponseAsync()); } catch { return null; }
}

/** The screen a tapped reminder should open, or null. */
export function routeFromNotification(response) {
  return response?.notification?.request?.content?.data?.route || null;
}

/** Subscribes to taps on any notification; returns an unsubscribe function. */
export function onNotificationTap(handler) {
  const N = mod();
  if (!N) return () => {};
  try {
    const sub = N.addNotificationResponseReceivedListener(handler);
    return () => { try { sub.remove(); } catch {} };
  } catch {
    return () => {};
  }
}

/** Best-effort local read of whether reminders are currently scheduled - not a live permission check. */
export async function remindersEnabled() {
  try {
    return !!(await AsyncStorage.getItem(SCHEDULED_KEY));
  } catch {
    return false;
  }
}

/** Stop everything - used when the user turns reminders off. */
export async function cancelReminders() {
  const N = mod();
  if (!N) return;
  try {
    await N.cancelAllScheduledNotificationsAsync();
    await AsyncStorage.removeItem(SCHEDULED_KEY);
    // Remembered, so the automatic refresh on every app open does not quietly undo it.
    await AsyncStorage.setItem(OPT_OUT_KEY, '1');
  } catch {}
}

/**
 * How a notification behaves while the app is open.
 *
 * Without a handler the OS shows nothing at all in the foreground, which reads as the
 * feature being broken when it is being tested - which is exactly when someone has the
 * app open.
 */
export function configureForegroundBehaviour() {
  const N = mod();
  if (!N) return;
  try {
    N.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
  } catch {}
}

/**
 * The live permission state, for a settings screen that wants to show the truth rather
 * than a guess. Distinguishes the three cases that need different UI:
 *   'unavailable' - this build has no notification module compiled in
 *   'granted'     - allowed, notifications will show
 *   'denied'      - the user said no (canAskAgain tells you whether asking again works)
 *   'undetermined'- never asked yet
 */
export async function notificationStatus() {
  const N = mod();
  if (!N) return { state: 'unavailable' };
  try {
    const p = await N.getPermissionsAsync();
    if (p.granted) return { state: 'granted' };
    if (p.status === 'undetermined' || p.canAskAgain) return { state: 'undetermined', canAskAgain: true };
    return { state: 'denied', canAskAgain: false };
  } catch {
    return { state: 'unavailable' };
  }
}

/**
 * Fire one notification a few seconds from now, so the user can confirm the whole chain
 * works without waiting a day for the first reminder or exporting a video to schedule
 * them. If nothing appears after this, the problem is the OS permission or the build,
 * not the schedule.
 */
export async function sendTestNotification() {
  const N = mod();
  if (!N) return false;
  try {
    const p = await N.getPermissionsAsync();
    if (!p.granted) return false;
    await ensureChannel(N);
    await N.scheduleNotificationAsync({
      content: {
        title: 'Tonefy AI',
        body: 'Notifications are working. This is a test.',
        data: { kind: 'test' },
        ...(Platform.OS === 'android' ? { channelId: 'reminders' } : {}),
      },
      trigger: {
        type: N.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 5,
      },
    });
    return true;
  } catch {
    return false;
  }
}
