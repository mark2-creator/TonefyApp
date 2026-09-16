import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import { TikTokLogo, YouTubeLogo, FacebookLogo, InstagramLogo, PinterestLogo, LinkedInLogo } from '../components/BrandLogos';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, AppState,
  StatusBar, Linking, ActivityIndicator, Alert, Image
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { auth, db } from '../firebase';
import { doc, getDoc, setDoc, updateDoc, deleteField } from 'firebase/firestore';
import { useTheme } from '../context/ThemeContext';
import { usePlan } from '../constants/plan';
import { showAlert } from '../components/BrandedAlert';

const BACKEND = 'https://api.fitlifesolutions.site';

export default function ConnectAccountsScreen({ navigation }) {
  const { theme, isDark } = useTheme();
  const { tier } = usePlan();
  // Accounts allowed per platform (mirrors backend ACCOUNT_CAPS): Creator many, others one.
  const accountCap = tier === 'creator' ? 5 : 1;
  const insets = useSafeAreaInsets();
  const [tiktok, setTiktok] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  // YouTube state comes from the SERVER, not Firestore, because the token lives
  // server-side and only the backend can say whether it is still usable. Reading
  // connectedAccounts here would report "connected" for a grant the user revoked in
  // their Google account, which the server discovers and clears on first use.
  const [youtube, setYoutube] = useState(null);
  const [ytLoading, setYtLoading] = useState(true);
  const [ytBusy, setYtBusy] = useState(false);
  // Facebook and Instagram are two separate connections (a Page vs a direct IG Business
  // login), so each has its own status/busy state - same server-authoritative pattern as
  // YouTube, since the tokens live server-side.
  const [facebook, setFacebook] = useState(null);
  const [fbLoading, setFbLoading] = useState(true);
  const [fbBusy, setFbBusy] = useState(false);
  const [instagram, setInstagram] = useState(null);
  const [igLoading, setIgLoading] = useState(true);
  const [igBusy, setIgBusy] = useState(false);
  const [pinterest, setPinterest] = useState(null);
  const [pinLoading, setPinLoading] = useState(true);
  const [pinBusy, setPinBusy] = useState(false);
  const [linkedin, setLinkedin] = useState(null);
  const [liLoading, setLiLoading] = useState(true);
  const [liBusy, setLiBusy] = useState(false);
  const user = auth.currentUser;

  // What an "Add another account" attempt was trying to do, so the app can say whether it
  // worked. Every one of these flows leaves for a browser and comes back, and until now
  // the return was SILENT: the list looked identical whether a second account had been
  // added, the same one had been re-authorised, or the user had cancelled. Three very
  // different outcomes rendering as one unchanged screen is not something a user can be
  // expected to work out.
  const addPending = useRef(null);   // { platform, label, before }

  const noteAddResult = useCallback((platform, label, count) => {
    const p = addPending.current;
    if (!p || p.platform !== platform) return;
    addPending.current = null;
    if (count > p.before) {
      showAlert('Account added', `Your ${label} account is connected. You now have ${count}.`);
    } else {
      // TWO causes, and naming only one of them sends people down the wrong path. Either
      // the authorisation was never completed - switching accounts returns you to the
      // consent screen, and leaving without pressing its confirm button sends nothing at
      // all - or it was completed as the account already linked. Both end here with an
      // unchanged list, and the user cannot tell them apart, so say both.
      showAlert('No new account added',
        `Nothing changed, which means one of two things:\n\n`
        + `1. The ${label} screen was not confirmed. After switching accounts it returns you `
        + `to the permission screen - you have to press its confirm button there for anything `
        + `to reach us.\n\n`
        + `2. ${label} confirmed the account you already had connected. Check the name shown `
        + `on that screen before confirming; if it is the old one, sign out of ${label} in your `
        + `browser and sign in as the other account.`);
    }
  }, []);

  // At-cap note under a platform's account list. Below Creator this is an OFFER, not a
  // refusal - so it is tappable and opens the plans screen (a diamond is an offer, per
  // the design rule). At Creator the 5-account cap is a real ceiling with nothing to
  // buy, so it stays a plain note.
  const capNote = () => (
    tier === 'creator' ? (
      <View style={[styles.permRow, { justifyContent: 'center' }]}>
        <MaterialIcons name="diamond" size={14} color="#f5c451" />
        <Text style={[styles.permText, { color: theme.subtext }]}>You’ve reached the 5-account limit.</Text>
      </View>
    ) : (
      <TouchableOpacity
        style={[styles.permRow, { justifyContent: 'center', alignItems: 'center' }]}
        onPress={() => navigation.navigate('Subscription')}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <MaterialIcons name="diamond" size={14} color="#f5c451" />
        <Text style={[styles.permText, { color: theme.subtext }]}>
          Multiple accounts is a Creator feature.{' '}
          <Text style={{ color: '#f5c451', fontWeight: '700' }}>Upgrade</Text>
        </Text>
      </TouchableOpacity>
    )
  );

  useEffect(() => {
    loadTikTok();
    loadYouTube();
    loadFacebook();
    loadInstagram();
    loadPinterest();
    loadLinkedIn();
    // Re-check on return from the browser, which is exactly when the answer changes.
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') { loadYouTube(); loadFacebook(); loadInstagram(); loadPinterest(); loadLinkedIn(); }
    });
    return () => sub.remove();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function api(path, options) {
    const u = auth.currentUser;
    const token = u ? await u.getIdToken() : null;
    const res = await fetch(BACKEND + path, {
      ...options,
      headers: { ...(options?.headers || {}), ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    });
    return res.json();
  }

  async function loadYouTube() {
    try {
      setYoutube(await api('/api/youtube/status'));
    } catch (e) {
      setYoutube(null);
    } finally {
      setYtLoading(false);
    }
  }

  async function connectYouTube() {
    setYtBusy(true);
    try {
      const data = await api('/api/youtube/connect');
      if (!data.authUrl) throw new Error(data.error || 'Could not start the connection.');
      await Linking.openURL(data.authUrl);
      // Consent happens in a browser and there is no callback into the app. The refresh
      // is driven by AppState below rather than a guessed delay - and by AppState
      // specifically, because returning from a browser BACKGROUNDS the app rather than
      // navigating away, so a navigation focus effect would never fire.
    } catch (e) {
      showAlert('YouTube', e.message || 'Could not open the YouTube sign-in page.');
    } finally {
      setYtBusy(false);
    }
  }

  async function disconnectYouTube() {
    showAlert('Disconnect YouTube', 'Tonefy will no longer be able to upload to your channel.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disconnect', style: 'destructive',
        onPress: async () => {
          try {
            await api('/api/youtube/disconnect', { method: 'POST' });
            setYoutube({ ...(youtube || {}), connected: false, channelTitle: null });
          } catch (e) { showAlert('YouTube', 'Could not disconnect.'); }
        },
      },
    ]);
  }

  async function loadFacebook() {
    try {
      const st = await api('/api/facebook/status');
      setFacebook(st);
      noteAddResult('facebook', 'Facebook', st?.accounts?.length || 0);
    }
    catch (e) { setFacebook(null); }
    finally { setFbLoading(false); }
  }

  async function connectFacebook() {
    setFbBusy(true);
    try {
      const data = await api('/api/facebook/connect');
      if (!data.authUrl) throw new Error(data.error || 'Could not start the connection.');
      await Linking.openURL(data.authUrl);
      // Consent runs in a browser with no callback into the app; AppState refresh (above)
      // picks up the result when the user returns.
    } catch (e) {
      showAlert('Facebook', e.message || 'Could not open the Facebook sign-in page.');
    } finally { setFbBusy(false); }
  }

  async function disconnectFacebook(accountId, label) {
    showAlert('Disconnect Facebook', `Tonefy will no longer be able to post to ${label || 'this Page'}.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disconnect', style: 'destructive',
        onPress: async () => {
          try {
            await api('/api/facebook/disconnect', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(accountId ? { accountId } : {}),
            });
            await loadFacebook();
          } catch (e) { showAlert('Facebook', 'Could not disconnect.'); }
        },
      },
    ]);
  }

  async function loadInstagram() {
    try {
      const st = await api('/api/instagram/status');
      setInstagram(st);
      noteAddResult('instagram', 'Instagram', st?.accounts?.length || 0);
    }
    catch (e) { setInstagram(null); }
    finally { setIgLoading(false); }
  }

  async function connectInstagram() {
    setIgBusy(true);
    try {
      const data = await api('/api/instagram/connect');
      if (!data.authUrl) throw new Error(data.error || 'Could not start the connection.');
      await Linking.openURL(data.authUrl);
    } catch (e) {
      showAlert('Instagram', e.message || 'Could not open the Instagram sign-in page.');
    } finally { setIgBusy(false); }
  }

  async function disconnectInstagram(accountId, label) {
    showAlert('Disconnect Instagram', `Tonefy will no longer be able to post to ${label ? '@' + label : 'this Instagram account'}.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disconnect', style: 'destructive',
        onPress: async () => {
          try {
            await api('/api/instagram/disconnect', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(accountId ? { accountId } : {}),
            });
            await loadInstagram();
          } catch (e) { showAlert('Instagram', 'Could not disconnect.'); }
        },
      },
    ]);
  }

  async function loadPinterest() {
    try {
      const st = await api('/api/pinterest/status');
      setPinterest(st);
      noteAddResult('pinterest', 'Pinterest', st?.accounts?.length || 0);
    }
    catch (e) { setPinterest(null); }
    finally { setPinLoading(false); }
  }

  async function connectPinterest() {
    setPinBusy(true);
    try {
      const data = await api('/api/pinterest/connect');
      if (!data.authUrl) throw new Error(data.error || 'Could not start the connection.');
      await Linking.openURL(data.authUrl);
    } catch (e) {
      showAlert('Pinterest', e.message || 'Could not open the Pinterest sign-in page.');
    } finally { setPinBusy(false); }
  }

  async function disconnectPinterest(accountId, label) {
    showAlert('Disconnect Pinterest', `Tonefy will no longer be able to post to ${label ? '@' + label : 'this Pinterest account'}.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disconnect', style: 'destructive',
        onPress: async () => {
          try {
            await api('/api/pinterest/disconnect', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(accountId ? { accountId } : {}),
            });
            await loadPinterest();
          } catch (e) { showAlert('Pinterest', 'Could not disconnect.'); }
        },
      },
    ]);
  }

  async function loadLinkedIn() {
    try {
      const st = await api('/api/linkedin/status');
      setLinkedin(st);
      noteAddResult('linkedin', 'LinkedIn', st?.accounts?.length || 0);
    }
    catch (e) { setLinkedin(null); }
    finally { setLiLoading(false); }
  }

  async function connectLinkedIn() {
    setLiBusy(true);
    try {
      const data = await api('/api/linkedin/connect');
      if (!data.authUrl) throw new Error(data.error || 'Could not start the connection.');
      await Linking.openURL(data.authUrl);
    } catch (e) {
      showAlert('LinkedIn', e.message || 'Could not open the LinkedIn sign-in page.');
    } finally { setLiBusy(false); }
  }

  async function disconnectLinkedIn(accountId, label) {
    showAlert('Disconnect LinkedIn', `Tonefy will no longer be able to post to ${label || 'this LinkedIn account'}.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disconnect', style: 'destructive',
        onPress: async () => {
          try {
            await api('/api/linkedin/disconnect', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(accountId ? { accountId } : {}),
            });
            await loadLinkedIn();
          } catch (e) { showAlert('LinkedIn', 'Could not disconnect.'); }
        },
      },
    ]);
  }

  async function loadTikTok() {
    try {
      const snap = await getDoc(doc(db, 'connectedAccounts', user.uid));
      const tt = snap.exists() ? snap.data().tiktok : null;
      // An ARRAY since TikTok went multi-account; an older single object still reads.
      const arr = Array.isArray(tt) ? tt : (tt ? [tt] : []);
      setTiktok(arr.length ? arr.map((a) => ({
        accountId: a.accountId || a.openId,
        name: a.label || a.displayName || null,
        avatar: a.avatar || null,
      })) : null);
      noteAddResult('tiktok', 'TikTok', arr.length);
    } catch (e) {}
    setLoading(false);
  }

  async function connectTikTok(adding = false) {
    // Adding a second account is a TWO-TRIP journey, and only because of how TikTok
    // behaves: its authorisation page offers "Switch account", but tapping that sends the
    // user to TikTok's login page, which loses the OAuth request entirely and drops them
    // on the For You feed once they sign in. Nothing we can send changes that - the
    // documented parameters are client_key, scope, response_type, redirect_uri, state and
    // disable_auto_auth, and none of them survives a detour through login.
    //
    // So the honest thing is to say what will happen before it happens. Being returned to
    // TikTok's feed with no explanation reads as the connection having failed, when in
    // fact the account switch worked and only the second trip is missing.
    if (adding) {
      addPending.current = { platform: 'tiktok', label: 'TikTok', before: tiktok?.length || 0 };
      const go = await new Promise((resolve) => {
        showAlert('Add another TikTok account',
          'TikTok will show whichever account you are signed in as.\n\n'
          + 'If it is not the one you want, tap "Switch account" and sign in. TikTok will '
          + 'then leave you on its own home feed - that is normal. Come back here and tap '
          + '"Add another account" once more to finish linking it.',
          [
            { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
            { text: 'Continue', onPress: () => resolve(true) },
          ],
          // Not cancelable: the sheet dismisses on a backdrop tap or the back button by
          // default, and neither runs a button's onPress - so this promise would never
          // settle and the flow would sit here silently.
          { cancelable: false });
      });
      if (!go) { addPending.current = null; return; }
    }
    setConnecting(true);
    try {
      // from=app so the success page hands the user back to Tonefy rather than to the
      // WEBSITE's connect-accounts page - both clients start the flow at this same URL.
      // add=1 makes the backend ask TikTok to show its authorisation page, which is the
      // only place to switch accounts; without it TikTok skips that page for a valid
      // session and silently re-authorises the account already connected.
      await Linking.openURL(`${BACKEND}/tiktok/auth?from=app${adding ? '&add=1' : ''}`);
    } catch (e) {
      showAlert('Error', 'Could not open TikTok auth page');
    }
    setConnecting(false);
  }

  async function disconnectTikTok(accountId, label) {
    showAlert('Disconnect TikTok', `Tonefy will no longer be able to post to ${label || 'this TikTok account'}.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disconnect', style: 'destructive',
        onPress: async () => {
          try {
            // Server-side: deletes our stored token AND revokes it at TikTok. The old
            // client-side deleteField only removed the display flag and left the token
            // live - which the privacy policy says we don't do.
            const r = await api('/tiktok/disconnect', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(accountId ? { accountId } : {}),
            });
            if (r?.error) throw new Error(r.error);
            await loadTikTok();
          } catch (e) { showAlert('Error', e.message || 'Could not disconnect.'); }
        }
      }
    ]);
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.bg, paddingTop: insets.top }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.bg} />
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backRow}>
          <MaterialIcons name="arrow-back" size={20} color={theme.icon} />
          <Text style={styles.back}>Back</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.text }]}>Connect Accounts</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={styles.main} contentContainerStyle={styles.mainContent}>
        <Text style={[styles.pageTitle, { color: theme.text }]}>Connect Accounts</Text>
        <Text style={[styles.pageSub, { color: theme.subtext }]}>Link your social platforms to post directly</Text>

        {/* TikTok */}
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.cardLogoBadge}>
            <TikTokLogo size={40} />
          </View>
          <Text style={[styles.cardTitle, { color: theme.text }]}>Connect TikTok</Text>
          {loading ? (
            <ActivityIndicator color="#2ecc71" style={{ marginVertical: 20 }} />
          ) : (tiktok?.length > 0) ? (
            <>
              {tiktok.map((a) => (
                <View key={a.accountId} style={[styles.connectedBox, { backgroundColor: isDark ? '#0d2018' : '#e0f5e9', borderColor: isDark ? '#1a4a2a' : '#a8e6c1' }]}>
                  <View style={[styles.connectedAvatar, { backgroundColor: '#000' }]}>
                    {a.avatar ? (
                      <Image source={{ uri: a.avatar }} style={{ width: 44, height: 44, borderRadius: 22 }} />
                    ) : (
                      <TikTokLogo size={26} />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.connectedName, { color: theme.text }]}>{a.name || 'TikTok User'}</Text>
                    <Text style={[styles.connectedSub, { color: theme.subtext }]}>TikTok · Connected</Text>
                  </View>
                  <TouchableOpacity onPress={() => disconnectTikTok(a.accountId, a.name)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <MaterialIcons name="close" size={20} color="#f87171" />
                  </TouchableOpacity>
                </View>
              ))}
              {tiktok.length < accountCap ? (
                <TouchableOpacity style={[styles.btnConnect, { backgroundColor: '#000' }]} onPress={() => connectTikTok(true)} disabled={connecting}>
                  {connecting ? <ActivityIndicator color="#fff" /> : <Text style={[styles.btnConnectText, { color: '#fff' }]}>+ Add another account</Text>}
                </TouchableOpacity>
              ) : (
                capNote()
              )}
            </>
          ) : (
            <>
              <Text style={[styles.cardDesc, { color: theme.subtext }]}>To post videos to TikTok, connect your account below</Text>
              <View style={styles.perms}>
                <Text style={[styles.permsTitle, { color: theme.subtext }]}>THIS WILL AUTHORIZE TONEFY AI TO:</Text>
                {['Upload videos to your TikTok', 'View your basic profile info', 'Receive post notifications'].map((p, i) => (
                  <View key={i} style={styles.permRow}>
                    <MaterialIcons name="check" size={16} color="#2ecc71" />
                    <Text style={[styles.permText, { color: theme.subtext }]}>{p}</Text>
                  </View>
                ))}
              </View>
              <TouchableOpacity style={styles.btnConnect} onPress={() => connectTikTok(false)} disabled={connecting}>
                {connecting ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnConnectText}>Connect TikTok Account</Text>}
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* YouTube */}
        {youtube?.configured !== false && (
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.cardLogoBadge}>
              <YouTubeLogo size={40} />
            </View>
            <Text style={[styles.cardTitle, { color: theme.text }]}>Connect YouTube</Text>
            {ytLoading ? (
              <ActivityIndicator color="#2ecc71" style={{ marginVertical: 20 }} />
            ) : youtube?.connected ? (
              <>
                <View style={[styles.connectedBox, { backgroundColor: isDark ? '#0d2018' : '#e0f5e9', borderColor: isDark ? '#1c3a2a' : '#bde5cd' }]}>
                  <View style={[styles.connectedAvatar, { backgroundColor: '#000' }]}>
                    <YouTubeLogo size={26} />
                  </View>
                  <View>
                    {/* channelTitle is often null: reading it needs youtube.readonly, a
                        second sensitive scope not worth requesting for a label. */}
                    <Text style={[styles.connectedName, { color: theme.text }]}>
                      {youtube.channelTitle || 'Your channel'}
                    </Text>
                    <Text style={[styles.connectedSub, { color: theme.subtext }]}>YouTube · Connected</Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={[styles.btnDisconnect, { backgroundColor: isDark ? '#2a1212' : '#ffe5e5', borderColor: isDark ? '#3a1a1a' : '#ffcccc' }]}
                  onPress={disconnectYouTube}>
                  <Text style={styles.btnDisconnectText}>Disconnect YouTube</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={[styles.cardDesc, { color: theme.subtext }]}>To upload videos to YouTube, connect your channel below</Text>
                <View style={styles.perms}>
                  <Text style={[styles.permsTitle, { color: theme.subtext }]}>THIS WILL AUTHORIZE TONEFY AI TO:</Text>
                  {['Upload videos you make in Tonefy to your channel'].map((p, i) => (
                    <View key={i} style={styles.permRow}>
                      <MaterialIcons name="check" size={16} color="#2ecc71" />
                      <Text style={[styles.permText, { color: theme.subtext }]}>{p}</Text>
                    </View>
                  ))}
                  {/* Said plainly here rather than discovered as a bug: until Google's
                      API audit clears, every upload through the API is forced private. */}
                  <Text style={[styles.permText, { color: theme.subtext, marginTop: 8, fontStyle: 'italic' }]}>
                    Uploads start as private while our YouTube app is under review.
                  </Text>
                </View>
                <TouchableOpacity style={[styles.btnConnect, { backgroundColor: '#FF0000' }]} onPress={connectYouTube} disabled={ytBusy}>
                  {ytBusy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnConnectText}>Connect YouTube Channel</Text>}
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        {/* Facebook */}
        {facebook?.configured !== false && (
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.cardLogoBadge}>
              <FacebookLogo size={40} />
            </View>
            <Text style={[styles.cardTitle, { color: theme.text }]}>Connect <Text style={{ color: '#1877F2' }}>Facebook</Text></Text>
            {fbLoading ? (
              <ActivityIndicator color="#2ecc71" style={{ marginVertical: 20 }} />
            ) : (facebook?.accounts?.length > 0) ? (
              <>
                {facebook.accounts.map((a) => (
                  <View key={a.accountId} style={[styles.connectedBox, { backgroundColor: isDark ? '#0d2018' : '#e0f5e9', borderColor: isDark ? '#1c3a2a' : '#bde5cd' }]}>
                    <View style={[styles.connectedAvatar, { backgroundColor: '#000' }]}>
                      <FacebookLogo size={26} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.connectedName, { color: theme.text }]}>{a.name || 'Your Page'}</Text>
                      <Text style={[styles.connectedSub, { color: theme.subtext }]}>Facebook · Connected</Text>
                    </View>
                    <TouchableOpacity onPress={() => disconnectFacebook(a.accountId, a.name)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                      <MaterialIcons name="close" size={20} color="#f87171" />
                    </TouchableOpacity>
                  </View>
                ))}
                {facebook.accounts.length < accountCap ? (
                  <TouchableOpacity style={[styles.btnConnect, { backgroundColor: '#1877F2' }]} onPress={() => { addPending.current = { platform: 'facebook', label: 'Facebook', before: facebook?.accounts?.length || 0 }; connectFacebook(); }} disabled={fbBusy}>
                    {fbBusy ? <ActivityIndicator color="#fff" /> : <Text style={[styles.btnConnectText, { color: '#fff' }]}>+ Add another Page</Text>}
                  </TouchableOpacity>
                ) : (
                  capNote()
                )}
              </>
            ) : (
              <>
                <Text style={[styles.cardDesc, { color: theme.subtext }]}>To post videos to a Facebook Page, connect it below</Text>
                <View style={styles.perms}>
                  <Text style={[styles.permsTitle, { color: theme.subtext }]}>THIS WILL AUTHORIZE TONEFY AI TO:</Text>
                  {['Post videos to your Facebook Page', 'See the Pages you manage'].map((p, i) => (
                    <View key={i} style={styles.permRow}>
                      <MaterialIcons name="check" size={16} color="#2ecc71" />
                      <Text style={[styles.permText, { color: theme.subtext }]}>{p}</Text>
                    </View>
                  ))}
                  <Text style={[styles.permText, { color: theme.subtext, marginTop: 8, fontStyle: 'italic' }]}>
                    Facebook only allows posting to a Page you manage, not a personal profile.
                    Whichever Pages you share on the next screen are the ones connected here.
                  </Text>
                </View>
                <TouchableOpacity style={[styles.btnConnect, { backgroundColor: '#1877F2' }]} onPress={connectFacebook} disabled={fbBusy}>
                  {fbBusy ? <ActivityIndicator color="#fff" /> : <Text style={[styles.btnConnectText, { color: '#fff' }]}>Connect Facebook Page</Text>}
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        {/* Instagram */}
        {instagram?.configured !== false && (
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.cardLogoBadge}>
              <InstagramLogo size={40} />
            </View>
            <Text style={[styles.cardTitle, { color: theme.text }]}>Connect <Text style={{ color: '#E4405F' }}>Instagram</Text></Text>
            {igLoading ? (
              <ActivityIndicator color="#2ecc71" style={{ marginVertical: 20 }} />
            ) : (instagram?.accounts?.length > 0) ? (
              <>
                {instagram.accounts.map((a) => (
                  <View key={a.accountId} style={[styles.connectedBox, { backgroundColor: isDark ? '#0d2018' : '#e0f5e9', borderColor: isDark ? '#1c3a2a' : '#bde5cd' }]}>
                    <View style={[styles.connectedAvatar, { backgroundColor: '#000' }]}>
                      <InstagramLogo size={28} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.connectedName, { color: theme.text }]}>{a.name ? '@' + a.name : 'Your account'}</Text>
                      <Text style={[styles.connectedSub, { color: theme.subtext }]}>Instagram · Connected</Text>
                    </View>
                    <TouchableOpacity onPress={() => disconnectInstagram(a.accountId, a.name)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                      <MaterialIcons name="close" size={20} color="#f87171" />
                    </TouchableOpacity>
                  </View>
                ))}
                {instagram.accounts.length < accountCap ? (
                  <TouchableOpacity style={[styles.btnConnect, { backgroundColor: '#E4405F' }]} onPress={() => { addPending.current = { platform: 'instagram', label: 'Instagram', before: instagram?.accounts?.length || 0 }; connectInstagram(); }} disabled={igBusy}>
                    {igBusy ? <ActivityIndicator color="#fff" /> : <Text style={[styles.btnConnectText, { color: '#fff' }]}>+ Add another account</Text>}
                  </TouchableOpacity>
                ) : (
                  capNote()
                )}
              </>
            ) : (
              <>
                <Text style={[styles.cardDesc, { color: theme.subtext }]}>To post Reels to Instagram, connect your account below</Text>
                <View style={styles.perms}>
                  <Text style={[styles.permsTitle, { color: theme.subtext }]}>THIS WILL AUTHORIZE TONEFY AI TO:</Text>
                  {['Publish Reels to your Instagram', 'See your basic profile info'].map((p, i) => (
                    <View key={i} style={styles.permRow}>
                      <MaterialIcons name="check" size={16} color="#2ecc71" />
                      <Text style={[styles.permText, { color: theme.subtext }]}>{p}</Text>
                    </View>
                  ))}
                  <Text style={[styles.permText, { color: theme.subtext, marginTop: 8, fontStyle: 'italic' }]}>
                    Instagram posting needs a Professional (Business or Creator) account.
                  </Text>
                </View>
                <TouchableOpacity style={[styles.btnConnect, { backgroundColor: '#E4405F' }]} onPress={connectInstagram} disabled={igBusy}>
                  {igBusy ? <ActivityIndicator color="#fff" /> : <Text style={[styles.btnConnectText, { color: '#fff' }]}>Connect Instagram Account</Text>}
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        {/* Pinterest */}
        {pinterest?.configured !== false && (
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.cardLogoBadge}>
              <PinterestLogo size={40} />
            </View>
            <Text style={[styles.cardTitle, { color: theme.text }]}>Connect <Text style={{ color: '#E60023' }}>Pinterest</Text></Text>
            {pinLoading ? (
              <ActivityIndicator color="#2ecc71" style={{ marginVertical: 20 }} />
            ) : (pinterest?.accounts?.length > 0) ? (
              <>
                {pinterest.accounts.map((a) => (
                  <View key={a.accountId} style={[styles.connectedBox, { backgroundColor: isDark ? '#0d2018' : '#e0f5e9', borderColor: isDark ? '#1c3a2a' : '#bde5cd' }]}>
                    <View style={[styles.connectedAvatar, { backgroundColor: '#000' }]}>
                      <PinterestLogo size={28} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.connectedName, { color: theme.text }]}>{a.name ? '@' + a.name : 'Your account'}</Text>
                      <Text style={[styles.connectedSub, { color: theme.subtext }]}>Pinterest · Connected</Text>
                    </View>
                    <TouchableOpacity onPress={() => disconnectPinterest(a.accountId, a.name)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                      <MaterialIcons name="close" size={20} color="#f87171" />
                    </TouchableOpacity>
                  </View>
                ))}
                {pinterest.accounts.length < accountCap ? (
                  <TouchableOpacity style={[styles.btnConnect, { backgroundColor: '#E60023' }]} onPress={() => { addPending.current = { platform: 'pinterest', label: 'Pinterest', before: pinterest?.accounts?.length || 0 }; connectPinterest(); }} disabled={pinBusy}>
                    {pinBusy ? <ActivityIndicator color="#fff" /> : <Text style={[styles.btnConnectText, { color: '#fff' }]}>+ Add another account</Text>}
                  </TouchableOpacity>
                ) : (
                  capNote()
                )}
              </>
            ) : (
              <>
                <Text style={[styles.cardDesc, { color: theme.subtext }]}>To publish your videos to Pinterest, connect your account below</Text>
                <View style={styles.perms}>
                  <Text style={[styles.permsTitle, { color: theme.subtext }]}>THIS WILL AUTHORIZE TONEFY AI TO:</Text>
                  {['Create video Pins on your boards', 'See your boards'].map((p, i) => (
                    <View key={i} style={styles.permRow}>
                      <MaterialIcons name="check" size={16} color="#2ecc71" />
                      <Text style={[styles.permText, { color: theme.subtext }]}>{p}</Text>
                    </View>
                  ))}
                </View>
                <TouchableOpacity style={[styles.btnConnect, { backgroundColor: '#E60023' }]} onPress={connectPinterest} disabled={pinBusy}>
                  {pinBusy ? <ActivityIndicator color="#fff" /> : <Text style={[styles.btnConnectText, { color: '#fff' }]}>Connect Pinterest Account</Text>}
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        {/* LinkedIn (multi-account: Pro 1, Creator up to 5) */}
        {linkedin?.configured !== false && (
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={[styles.cardLogoBadge, { backgroundColor: 'transparent' }]}>
              <LinkedInLogo size={48} />
            </View>
            <Text style={[styles.cardTitle, { color: theme.text }]}>Connect <Text style={{ color: '#0A66C2' }}>LinkedIn</Text></Text>
            {liLoading ? (
              <ActivityIndicator color="#2ecc71" style={{ marginVertical: 20 }} />
            ) : (linkedin?.accounts?.length > 0) ? (
              <>
                {linkedin.accounts.map((a) => (
                  <View key={a.accountId} style={[styles.connectedBox, { backgroundColor: isDark ? '#0d2018' : '#e0f5e9', borderColor: isDark ? '#1c3a2a' : '#bde5cd' }]}>
                    <View style={[styles.connectedAvatar, { backgroundColor: '#000' }]}>
                      <LinkedInLogo size={28} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.connectedName, { color: theme.text }]}>{a.name || 'Your profile'}</Text>
                      <Text style={[styles.connectedSub, { color: theme.subtext }]}>LinkedIn · Connected</Text>
                    </View>
                    <TouchableOpacity onPress={() => disconnectLinkedIn(a.accountId, a.name)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                      <MaterialIcons name="close" size={20} color="#f87171" />
                    </TouchableOpacity>
                  </View>
                ))}
                {linkedin.accounts.length < accountCap ? (
                  <TouchableOpacity style={[styles.btnConnect, { backgroundColor: '#0A66C2' }]} onPress={() => { addPending.current = { platform: 'linkedin', label: 'LinkedIn', before: linkedin?.accounts?.length || 0 }; connectLinkedIn(); }} disabled={liBusy}>
                    {liBusy ? <ActivityIndicator color="#fff" /> : <Text style={[styles.btnConnectText, { color: '#fff' }]}>+ Add another account</Text>}
                  </TouchableOpacity>
                ) : (
                  capNote()
                )}
              </>
            ) : (
              <>
                <Text style={[styles.cardDesc, { color: theme.subtext }]}>To post your videos to LinkedIn, connect your account below</Text>
                <View style={styles.perms}>
                  <Text style={[styles.permsTitle, { color: theme.subtext }]}>THIS WILL AUTHORIZE TONEFY AI TO:</Text>
                  {['Post videos to your LinkedIn', 'See your name and photo'].map((p, i) => (
                    <View key={i} style={styles.permRow}>
                      <MaterialIcons name="check" size={16} color="#2ecc71" />
                      <Text style={[styles.permText, { color: theme.subtext }]}>{p}</Text>
                    </View>
                  ))}
                </View>
                <TouchableOpacity style={[styles.btnConnect, { backgroundColor: '#0A66C2' }]} onPress={connectLinkedIn} disabled={liBusy}>
                  {liBusy ? <ActivityIndicator color="#fff" /> : <Text style={[styles.btnConnectText, { color: '#fff' }]}>Connect LinkedIn Account</Text>}
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        {/* Coming soon platforms */}
        {['X (Twitter)'].map((p, i) => (
          <View key={i} style={[styles.comingSoonCard, { backgroundColor: isDark ? '#1a1a2e' : '#eef0fa', borderColor: isDark ? '#2a2a4a' : '#d8dcf0' }]}>
            <Text style={[styles.comingSoonTitle, { color: theme.text }]}>{p} Coming Soon</Text>
            <Text style={[styles.comingSoonSub, { color: theme.subtext }]}>{p} integration is in development.</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#1a1a1a' },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  back: { color: '#2ecc71', fontSize: 15, fontWeight: '600' },
  title: { color: '#fff', fontSize: 16, fontWeight: '700' },
  main: { flex: 1 },
  mainContent: { padding: 20, paddingBottom: 40 },
  pageTitle: { color: '#fff', fontSize: 22, fontWeight: '700', marginBottom: 4 },
  pageSub: { color: '#888', fontSize: 14, marginBottom: 24 },
  card: { backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 14, padding: 20, alignItems: 'center', marginBottom: 16 },
  cardLogoBadge: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  cardTitle: { color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 8 },
  cardDesc: { color: '#888', fontSize: 14, textAlign: 'center', marginBottom: 20, lineHeight: 20 },
  perms: { width: '100%', marginBottom: 20 },
  permsTitle: { color: '#888', fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 10 },
  permRow: { flexDirection: 'row', gap: 10, paddingVertical: 6 },
  permCheck: { color: '#2ecc71', fontWeight: '700' },
  permText: { color: '#aaa', fontSize: 14 },
  btnConnect: { width: '100%', backgroundColor: '#2ecc71', borderRadius: 25, padding: 16, alignItems: 'center' },
  btnConnectText: { color: '#000', fontWeight: '700', fontSize: 16 },
  connectedBox: { flexDirection: 'row', gap: 12, backgroundColor: '#0d2018', borderWidth: 1, borderColor: '#1a4a2a', borderRadius: 12, padding: 14, width: '100%', alignItems: 'center', marginBottom: 16 },
  connectedAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#1a4a2a', justifyContent: 'center', alignItems: 'center' },
  connectedName: { color: '#fff', fontSize: 15, fontWeight: '600' },
  connectedSub: { color: '#888', fontSize: 12, marginTop: 2 },
  btnDisconnect: { width: '100%', backgroundColor: '#2a1212', borderWidth: 1, borderColor: '#5a2020', borderRadius: 25, padding: 14, alignItems: 'center' },
  btnDisconnectText: { color: '#f87171', fontSize: 15, fontWeight: '600' },
  comingSoonCard: { backgroundColor: '#1a1a2e', borderWidth: 1, borderColor: '#2a2a4a', borderRadius: 14, padding: 20, alignItems: 'center', marginBottom: 12 },
  comingSoonTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 4 },
  comingSoonSub: { color: '#888', fontSize: 13 },
});
