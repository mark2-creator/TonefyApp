import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, AppState, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { auth } from '../firebase';
import GradientBorder from './GradientBorder';
import { showAlert } from './BrandedAlert';
import { friendlyError } from '../utils/friendlyError';

// "Confirm your email" - a reminder, never a wall.
//
// Until Oct 6 2026 an unverified email account was signed straight back out and told to
// verify first. That lost people at the exact moment they were most interested: they had
// just made an account, and to see the app they had to leave it, find an email (often in
// spam, on slow mobile data), tap a link and come back. One signup (Sep 18) never made it
// back. The wall protected nothing real either - the server never checked
// `email_verified`, so anyone could already use an unverified token directly.
//
// So the person goes straight in, and this card sits on the dashboard until they confirm.
// It says WHY in terms they care about (being able to reset a forgotten password), and
// puts the two things they might need one tap away: send it again, and "I've confirmed".
//
// It renders only for an email-and-password account that is still unverified. Google
// accounts arrive verified and never see it.
//
// The user object does not notice a verification done in the browser until it is
// reloaded, so this reloads it when the dashboard is focused, when the app returns to the
// foreground (the usual path: tap the link in the mail app, switch back), and on the
// "I've confirmed" button.

const COOLDOWN_S = 60;
const BACKEND = 'https://api.fitlifesolutions.site';

export default function VerifyEmailBanner({ theme, focusTick }) {
  const [verified, setVerified] = useState(() => {
    const u = auth.currentUser;
    return !u || u.emailVerified || !u.providerData?.some((p) => p.providerId === 'password');
  });
  const [checking, setChecking] = useState(false);
  const [sending, setSending] = useState(false);
  const [wait, setWait] = useState(0);
  const timer = useRef(null);

  const refresh = useCallback(async () => {
    const u = auth.currentUser;
    if (!u) return false;
    try { await u.reload(); } catch (e) { return !!u.emailVerified; }   // offline: keep what we know
    if (u.emailVerified) setVerified(true);
    return !!u.emailVerified;
  }, []);

  // Dashboard focus.
  useEffect(() => { if (!verified) refresh(); }, [focusTick, verified, refresh]);

  // Back to the app from the mail app.
  useEffect(() => {
    if (verified) return undefined;
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') refresh(); });
    return () => sub.remove();
  }, [verified, refresh]);

  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  function startCooldown() {
    setWait(COOLDOWN_S);
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(() => {
      setWait((w) => {
        if (w <= 1) { clearInterval(timer.current); timer.current = null; return 0; }
        return w - 1;
      });
    }, 1000);
  }

  async function resend() {
    if (sending || wait > 0) return;
    const u = auth.currentUser;
    if (!u) return;
    setSending(true);
    try {
      const token = await u.getIdToken();
      const res = await fetch(`${BACKEND}/api/send-verification-email`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`send ${res.status}`);
      startCooldown();
      showAlert('Email sent', `We sent a new link to ${u.email}. Check your inbox, and your spam folder too.`);
    } catch (e) {
      showAlert('Could not send it', friendlyError(e, 'The email could not be sent just now. Please try again in a moment.'));
    } finally {
      setSending(false);
    }
  }

  async function confirmed() {
    if (checking) return;
    setChecking(true);
    const ok = await refresh();
    setChecking(false);
    if (ok) {
      showAlert('Email confirmed', 'Thank you. Your account is all set.');
    } else {
      showAlert(
        'Not confirmed yet',
        `Open the email we sent to ${auth.currentUser?.email || 'you'} and tap the button inside it, then come back here. It can take a minute to arrive.`,
      );
    }
  }

  if (verified) return null;
  const email = auth.currentUser?.email || '';

  return (
    <GradientBorder radius={14} backgroundColor={theme.card} style={styles.card}>
      <View style={styles.head}>
        <MaterialIcons name="mark-email-unread" size={20} color={theme.subtext} />
        <Text style={[styles.title, { color: theme.text }]}>Confirm your email</Text>
      </View>
      <Text style={[styles.body, { color: theme.subtext }]} numberOfLines={3}>
        {`We sent a link to ${email}. Confirming it lets you reset your password if you ever forget it.`}
      </Text>
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.btn, { borderColor: theme.border }, (sending || wait > 0) && styles.btnOff]}
          onPress={resend}
          disabled={sending || wait > 0}
          activeOpacity={0.75}
        >
          {sending
            ? <ActivityIndicator size="small" color={theme.subtext} />
            : <Text style={[styles.btnText, { color: theme.text }]}>{wait > 0 ? `Send again in ${wait}s` : 'Send again'}</Text>}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btn, { borderColor: theme.border }]}
          onPress={confirmed}
          disabled={checking}
          activeOpacity={0.75}
        >
          {checking
            ? <ActivityIndicator size="small" color={theme.subtext} />
            : <Text style={[styles.btnText, { color: theme.text }]}>I have confirmed</Text>}
        </TouchableOpacity>
      </View>
    </GradientBorder>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 16, marginTop: 16, padding: 16 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 15, fontWeight: '700' },
  body: { fontSize: 12, lineHeight: 17, marginTop: 8 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  btn: { flex: 1, minHeight: 40, borderWidth: 1, borderRadius: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  btnOff: { opacity: 0.5 },
  btnText: { fontSize: 12, fontWeight: '600' },
});
