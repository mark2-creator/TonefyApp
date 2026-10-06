import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from '../firebase';
import { shouldSendDiagnostics } from './diagnostics';

// Reports the first time this account reaches a step on the way to its first video
// (dashboard, a tool opened, script, voice, render, finished, saved). See /api/funnel in
// server.js for why it exists and what is kept: the step name and when, nothing else.
//
// Fire-and-forget: it never throws, never waits, and never blocks the thing being
// measured. Each step is sent once per account per phone (remembered locally, and the
// server keeps only the first time anyway), and nothing is sent at all when the user
// has turned diagnostics off in Settings -> Privacy - the privacy policy promises that.
//
// The step names must match FUNNEL_STEPS on the server, which rejects anything else.

const BACKEND = 'https://api.fitlifesolutions.site';
const sentKey = (uid) => `tonefy.funnel.${uid}`;

export function logStep(step) {
  (async () => {
    try {
      if (!shouldSendDiagnostics()) return;
      const user = auth.currentUser;
      if (!user) return;
      const raw = await AsyncStorage.getItem(sentKey(user.uid)).catch(() => null);
      const sent = raw ? JSON.parse(raw) : {};
      if (sent[step]) return;
      const token = await user.getIdToken();
      const res = await fetch(`${BACKEND}/api/funnel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ step }),
      });
      if (!res.ok) return;   // not remembered, so it is tried again next time
      sent[step] = 1;
      await AsyncStorage.setItem(sentKey(user.uid), JSON.stringify(sent));
    } catch (e) {
      // Offline or anything else: measuring must never break the app.
    }
  })();
}
