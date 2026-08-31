import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Re-engagement reminders: "Hi, it's Tonefy AI - fancy making a video?"
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

// The nudges themselves. Short, in the app's voice, and each says what it is for -
// a notification that only says "come back" is the kind people turn off.
const REMINDERS = [
  {
    title: '👋 Hi, it’s Tonefy AI',
    body: 'Do you want to make a video today? It takes about a minute. 🎬',
    days: 1,
  },
  {
    title: '✨ Your next video is waiting',
    body: 'Turn an idea into a finished clip with captions and music. 🎵',
    days: 3,
  },
  {
    title: '🎬 Still got that idea?',
    body: 'Tonefy AI can have it edited and ready to post in minutes.',
    days: 7,
  },
];

/**
 * Schedule the re-engagement series, replacing anything already scheduled.
 *
 * Cancelled and rebuilt each time rather than added to, because the point of these is
 * "you have not been here for a while" - and someone who just finished a video should
 * have their clock restarted, not receive a reminder booked three days ago.
 */
export async function scheduleReminders() {
  const N = mod();
  if (!N) return false;
  try {
    const perms = await N.getPermissionsAsync();
    if (!perms.granted) return false;
    await ensureChannel(N);
    await N.cancelAllScheduledNotificationsAsync();
    for (const r of REMINDERS) {
      await N.scheduleNotificationAsync({
        content: {
          title: r.title,
          body: r.body,
          data: { kind: 'reengage' },
          ...(Platform.OS === 'android' ? { channelId: 'reminders' } : {}),
        },
        trigger: {
          type: N.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: r.days * 24 * 60 * 60,
        },
      });
    }
    await AsyncStorage.setItem(SCHEDULED_KEY, String(Date.now()));
    return true;
  } catch {
    return false;
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
        title: '🔔 Tonefy AI',
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
