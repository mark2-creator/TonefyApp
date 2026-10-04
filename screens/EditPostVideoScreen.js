import React, { useState, useEffect, useMemo, useRef } from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Alert, StatusBar, Linking, AppState
} from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { saveVideoToDevice } from '../utils/saveVideo';
import ProgressButton from '../components/ProgressButton';
import { createEta } from '../utils/eta';
import { TikTokLogo, InstagramLogo, FacebookLogo, YouTubeLogo, PinterestLogo, LinkedInLogo } from '../components/BrandLogos';
import { usePlan } from '../constants/plan';
import { auth, db } from '../firebase';
import { doc, getDoc, setDoc, addDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { showAlert } from '../components/BrandedAlert';
// A post that actually landed is the one moment it is fair to ask for a rating -
// their video is live. utils/rateApp.js picks Google's in-app sheet or the Play listing.
import { recordWinAndMaybeAsk } from '../utils/rateApp';
import TikTokPostSheet from '../components/TikTokPostSheet';
import PinterestBoardSheet, { loadPinterestBoards } from '../components/PinterestBoardSheet';
import YouTubePostSheet, { youtubeTitleFrom } from '../components/YouTubePostSheet';
import AccountPickerSheet from '../components/AccountPickerSheet';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BACKEND = 'https://api.fitlifesolutions.site';
const STATUSBAR_HEIGHT = StatusBar.currentHeight || 0;

function VideoPreview({ url }) {
  // Not autoplaying. It used to call p.play() in setup with loop on, so the video was
  // already running before the screen settled and the only thing the control could do
  // was pause - which is not what "press play to watch what I just made" should feel
  // like, and made the button look dead.
  const player = useVideoPlayer(url, p => { p.loop = true; });
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const onPlaying = player.addListener('playingChange', ({ isPlaying }) => setPlaying(isPlaying));
    const onStatus = player.addListener('statusChange', ({ status }) => setReady(status === 'readyToPlay'));
    return () => { onPlaying.remove(); onStatus.remove(); };
  }, [player]);

  return (
    <View>
      {/* Our own control rather than the native overlay. The native one sits inside a
          ScrollView here and was not reliably taking the tap; this is also the only
          way the button matches the rest of the app. */}
      <VideoView player={player} style={styles.video} contentFit="contain"
        nativeControls={false} allowsFullscreen />
      <TouchableOpacity
        style={styles.playFab}
        onPress={() => (playing ? player.pause() : player.play())}
        accessibilityLabel={playing ? 'Pause' : 'Play'}>
        <MaterialIcons name={playing ? 'pause' : 'play-arrow'} size={26} color="#04211f" />
      </TouchableOpacity>
      {!ready && (
        <View style={styles.videoLoading} pointerEvents="none">
          <ActivityIndicator size="small" color="#00d4d4" />
        </View>
      )}
    </View>
  );
}

const PIN_BOARDS_KEY = 'tonefy.pinterestBoards';
const YT_KIDS_KEY = 'tonefy.youtubeMadeForKids';

// The profile is the only TikTok link there is: a direct post's publish id is not a video id.
const tiktokUrl = (username) => (username ? `https://www.tiktok.com/@${username}` : 'https://www.tiktok.com/');

// One row per platform, all alike (Oct 4 2026). Under the name it shows, in priority:
// "Posted · View" once posted from here, else the row's own line (board, chosen accounts,
// YouTube audience). Each line is two Texts so the link part ("Change", "View") is never
// what truncation cuts. "Coming soon" replaces the button where this user cannot post
// (Facebook/Instagram while Meta is in development mode).
function PostRow({ Logo, name, color, theme, comingSoon, connected, connectedText, sub, posted, posting, isPremium, onPress, connectLabel = 'Connect', youtube }) {
  const line = posted
    ? { text: 'Posted', link: posted.url ? 'View' : null, onPress: posted.url ? () => Linking.openURL(posted.url) : undefined }
    : sub;
  const btnText = youtube ? styles.ytBtnText : styles.ttBtnText;
  return (
    <View style={styles.platformRow}>
      <View style={styles.platformIcon}><Logo size={22} /></View>
      <View style={styles.platformNameCol}>
        <Text style={[styles.platformName, { color, flex: 0 }]} numberOfLines={1}>{name}</Text>
        {line && !comingSoon ? (
          <TouchableOpacity style={styles.platformSubRow} onPress={line.onPress} disabled={!line.onPress} hitSlop={{ top: 6, bottom: 6 }}>
            {posted ? <MaterialIcons name="check-circle" size={12} color="#2ECC71" style={{ marginRight: 4 }} /> : null}
            <Text style={[styles.platformSub, styles.platformSubName, posted && styles.postedText]} numberOfLines={1}>{line.text}</Text>
            {line.link ? <Text style={[styles.platformSub, styles.platformSubLink]}>{` \u00b7 ${line.link}`}</Text> : null}
          </TouchableOpacity>
        ) : null}
      </View>
      {comingSoon ? (
        <Text style={[styles.comingSoon, { color: theme.subtext }]}>Coming soon</Text>
      ) : (
        <>
          {connected && !line ? <Text style={styles.connectedText} numberOfLines={1}>{connectedText}</Text> : null}
          <TouchableOpacity style={youtube ? [styles.ytBtn, !isPremium && styles.ytBtnLocked] : styles.ttBtn} onPress={onPress} disabled={posting}>
            {posting ? <ActivityIndicator color={youtube ? '#fff' : '#000'} size="small" />
              : !isPremium ? <><MaterialIcons name="diamond" size={11} color="#f5c451" /><Text style={btnText}>Pro</Text></>
                : <Text style={btnText}>{connected ? 'Post' : connectLabel}</Text>}
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

// Live progress of a background Post Now - one line per platform/account.
function PostProgress({ job, labels, theme }) {
  if (!job?.posts?.length) return null;
  return (
    <View style={[styles.jobPanel, { borderColor: theme.border }]}>
      {job.posts.map((p, i) => (
        <View key={i} style={styles.jobRow}>
          {p.status === 'posting' ? <ActivityIndicator size="small" color="#00d4d4" />
            : <MaterialIcons
                name={p.status === 'posted' ? 'check-circle' : p.status === 'failed' ? 'error-outline' : 'schedule'}
                size={20} color={p.status === 'posted' ? '#2ECC71' : p.status === 'failed' ? '#ff6b6b' : '#888'} />}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.jobName, { color: theme.text }]} numberOfLines={1}>
              {labels[p.platform] || p.platform}{p.accountId ? ` \u00b7 ${p.accountId}` : ''}
            </Text>
            <Text style={[styles.jobStatus, p.status === 'failed' && { color: '#ff6b6b' }]} numberOfLines={2}>
              {p.status === 'posted' ? 'Posted' : p.status === 'failed' ? (p.error || 'Failed') : p.status === 'posting' ? 'Posting...' : 'Waiting'}
            </Text>
          </View>
          {p.status === 'posted' && p.url ? (
            <TouchableOpacity onPress={() => Linking.openURL(p.url)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.jobView}>View</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ))}
    </View>
  );
}

export default function EditPostVideoScreen({ navigation, route }) {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { videoUrl, videoPath, defaultCaption = '' } = route.params || {};
  // Prefilled from whatever the video is already called, and editable.
  //
  // An empty caption used to reach YouTube as the title "Untitled" with no description,
  // because the title is required and the first line of the caption is what supplies it.
  // A silent fallback would have fixed the symptom while still publishing something the
  // user never saw; prefilling shows them the words before they press Post.
  const [caption, setCaption] = useState(defaultCaption);

  // Where the caption is the TITLE people see. Posting there with none used to publish
  // words the user never wrote - "Untitled" on YouTube, "Tonefy video" on Pinterest (owner's
  // post, Oct 3 2026) - so the app asks instead. TikTok, Facebook and Instagram show no
  // title and are fine without a caption.
  const CAPTION_IS_TITLE = ['youtube', 'pinterest', 'linkedin'];
  function needsCaption(platforms) {
    if (caption.trim() || !platforms.some(p => CAPTION_IS_TITLE.includes(p))) return false;
    showAlert('Add a caption first',
      'YouTube, Pinterest and LinkedIn show your caption as the title of the post. Write it in the caption box above, then post again.');
    return true;
  }
  const [tiktokConnected, setTiktokConnected] = useState(false);
  const [tiktokOpenId, setTiktokOpenId] = useState(null);
  const [tiktokName, setTiktokName] = useState('');
  const [tiktokAccounts, setTiktokAccounts] = useState(0);
  const [ttPosting, setTtPosting] = useState(false);
  const [ttSheet, setTtSheet] = useState(false);
  const [youtube, setYoutube] = useState(null);
  // No toggle. A toggle asks the user to express an intention and then do a SECOND
  // thing to act on it - and on this row the second thing was far away at the bottom of
  // the screen, so flipping it appeared to do nothing at all. One button that runs the
  // whole sequence is what was actually wanted.
  const [ytPosting, setYtPosting] = useState(false);
  // Set before the browser opens, so returning from a completed consent CONTINUES to the
  // upload instead of dumping the user back on a screen where nothing has happened.
  const ytPendingRef = useRef(false);
  // Facebook and Instagram: connected on the ConnectAccounts screen (both need a browser
  // OAuth), so this row only posts when already connected and otherwise routes there -
  // the same model as TikTok, which avoids the browser-return-continue dance.
  const [facebook, setFacebook] = useState(null);
  const [fbPosting, setFbPosting] = useState(false);
  const [instagram, setInstagram] = useState(null);
  const [igPosting, setIgPosting] = useState(false);
  const [pinterest, setPinterest] = useState(null);
  // The board each Pinterest account last posted to: { accountId: { id, name } }. Opens
  // the board sheet on that board, and is what Post Now / Save to queue use.
  // What was posted from this screen, per platform: { url }. Drives "Posted · View".
  const [posted, setPosted] = useState({});
  const markPosted = (platform, url) => setPosted(p => ({ ...p, [platform]: { url } }));
  // Which accounts a multi-account platform posts to: { platform: [ids] }; absent = all.
  const [chosenAccts, setChosenAccts] = useState({});
  const [acctSheet, setAcctSheet] = useState(null);   // platform id whose picker is open
  const accountsBody = (ids) => {
    const a = {};
    for (const id of ids) if (chosenAccts[id]?.length) a[id] = chosenAccts[id];
    return Object.keys(a).length ? { accounts: a } : {};
  };
  // YouTube: the audience answer (remembered on the account) and which sheet mode is open.
  const [ytKids, setYtKids] = useState(null);
  const [ytSheet, setYtSheet] = useState(null);   // null | 'post' | 'settings'
  const pendingPostNow = useRef(false);
  // TikTok's sheet now serves single posts, Post Now and scheduling.
  const [ttFor, setTtFor] = useState('single');   // 'single' | 'all' | 'queue'
  // A running background Post Now: the job as last polled.
  const [postJob, setPostJob] = useState(null);
  useEffect(() => {
    (async () => {
      try { const raw = await AsyncStorage.getItem(YT_KIDS_KEY); if (raw !== null) setYtKids(raw === 'true'); } catch { /* ask */ }
      try {
        const uid = auth.currentUser?.uid;
        const v = uid ? (await getDoc(doc(db, 'users', uid))).data()?.youtubeMadeForKids : undefined;
        if (typeof v === 'boolean') setYtKids(v);
      } catch { /* the phone copy stands */ }
    })();
  }, []);
  function rememberYtKids(v) {
    setYtKids(v);
    AsyncStorage.setItem(YT_KIDS_KEY, String(v)).catch(() => {});
    const uid = auth.currentUser?.uid;
    if (uid) setDoc(doc(db, 'users', uid), { youtubeMadeForKids: v }, { merge: true }).catch(() => {});
  }
  const [pinBoards, setPinBoards] = useState({});
  const [pinSheet, setPinSheet] = useState(null);   // null | 'post' | 'choose'
  // The remembered board is kept on the ACCOUNT (users/{uid}.pinterestBoards) so it follows a
  // phone change, with the phone's copy as the fast first answer.
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(PIN_BOARDS_KEY);
        if (raw) setPinBoards(prev => (Object.keys(prev).length ? prev : JSON.parse(raw)));
      } catch { /* no phone copy */ }
      try {
        const uid = auth.currentUser?.uid;
        const saved = uid ? (await getDoc(doc(db, 'users', uid))).data()?.pinterestBoards : null;
        if (saved && Object.keys(saved).length) setPinBoards(saved);
      } catch { /* the phone copy stands */ }
    })();
  }, []);
  function rememberBoards(chosen) {
    setPinBoards(chosen);
    AsyncStorage.setItem(PIN_BOARDS_KEY, JSON.stringify(chosen)).catch(() => {});
    const uid = auth.currentUser?.uid;
    if (uid) setDoc(doc(db, 'users', uid), { pinterestBoards: chosen }, { merge: true }).catch(() => {});
  }
  const pinterestBody = () => {
    const boards = Object.fromEntries(Object.entries(pinBoards).map(([acc, b]) => [acc, b.id]));
    return Object.keys(boards).length ? { pinterest: { boards } } : {};
  };
  // Nothing remembered yet: show each account's FIRST board on the row, so Post Now / Save to
  // queue never send a Pin somewhere the user could not see. Not saved - only a choice is.
  useEffect(() => {
    if (!pinterest?.connected || Object.keys(pinBoards).length) return;
    let live = true;
    const fill = (list) => {
      if (!live || !list?.length) return;
      const first = {};
      for (const a of list) if (a.boards[0]) first[a.accountId] = { id: a.boards[0].id, name: a.boards[0].name };
      setPinBoards(prev => (Object.keys(prev).length ? prev : first));
    };
    loadPinterestBoards({ onCached: fill }).then(fill).catch(() => {});
    return () => { live = false; };
  }, [pinterest?.connected, pinBoards]);
  const [pinPosting, setPinPosting] = useState(false);
  const [linkedin, setLinkedin] = useState(null);
  const [liPosting, setLiPosting] = useState(false);
  const { isPremium } = usePlan();
  // 'immediate' posts on the next sweep; 'later' posts at the chosen time.
  // schedMode existed and was never read - the queue had no notion of "when", so every
  // post was written with scheduledFor = now whatever the user intended.
  const [schedMode, setSchedMode] = useState('immediate');
  const [schedDay, setSchedDay] = useState(0);      // days from today
  const [schedHour, setSchedHour] = useState(19);   // 7pm, which the tip above recommends
  const [schedMin, setSchedMin] = useState(0);
  const [posting, setPosting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [queue, setQueue] = useState([]);
  const user = auth.currentUser;

  useEffect(() => {
    loadTikTok();
    loadYouTube();
    loadFacebook();
    loadInstagram();
    loadPinterest();
    loadLinkedIn();
    // Returning from the browser BACKGROUNDS the app rather than navigating away, so
    // AppState is the signal - a navigation focus effect would never fire.
    const sub = AppState.addEventListener('change', async (next) => {
      if (next !== 'active') return;
      loadFacebook();
      loadInstagram();
      loadPinterest();
      loadLinkedIn();
      await loadYouTube();
      if (!ytPendingRef.current) return;
      ytPendingRef.current = false;
      // Re-asked rather than assumed: the consent may have been cancelled, and a failed
      // connect must not be followed by an upload attempt that reports a confusing error.
      try {
        const token = await user.getIdToken();
        const r = await fetch(`${BACKEND}/api/youtube/status`, { headers: { Authorization: `Bearer ${token}` } });
        const st = await r.json();
        setYoutube(st);
        if (st?.connected) await uploadToYouTube();
      } catch (e) { /* the card will show it is still not connected */ }
    });
    return () => sub.remove();
    loadQueue();
  }, []);

  // Server-side state, like ConnectAccountsScreen: only the backend knows whether the
  // stored token still works.
  async function loadYouTube() {
    try {
      const token = await user.getIdToken();
      const r = await fetch(`${BACKEND}/api/youtube/status`, { headers: { Authorization: `Bearer ${token}` } });
      setYoutube(await r.json());
    } catch (e) { setYoutube(null); }
  }

  // One button, the whole sequence: plan check, connect if needed, then upload.
  //
  // The connect half cannot be awaited - consent happens in a browser and there is no
  // callback into the app - so the intention is parked in a ref and the AppState
  // listener below picks it back up. That is the difference between "it opened a browser
  // and I ended up back where I started" and a flow that finishes what it began.
  async function postToYouTube() {
    if (!videoPath) return showAlert('YouTube', 'There is no video to post yet.');
    if (!isPremium) {
      return showAlert('YouTube', 'Posting to YouTube is available on the Pro and Creator plans.');
    }
    // Asked fresh rather than trusted from render: the connection may have been made or
    // revoked since this screen loaded.
    let status = youtube;
    try {
      const token = await user.getIdToken();
      const r = await fetch(`${BACKEND}/api/youtube/status`, { headers: { Authorization: `Bearer ${token}` } });
      status = await r.json();
      setYoutube(status);
    } catch (e) { /* fall through on the state we have */ }

    if (!status?.connected) {
      ytPendingRef.current = true;
      try {
        const token = await user.getIdToken();
        const r = await fetch(`${BACKEND}/api/youtube/connect`, { headers: { Authorization: `Bearer ${token}` } });
        const d = await r.json();
        if (!d.authUrl) throw new Error(d.error || 'Could not start the connection.');
        await Linking.openURL(d.authUrl);
      } catch (e) {
        ytPendingRef.current = false;
        showAlert('YouTube', e.message || 'Could not open the YouTube sign-in page.');
      }
      return;
    }
    await uploadToYouTube();
  }

  async function uploadToYouTube() {
    if (needsCaption(['youtube'])) return;
    setYtSheet('post');
  }

  async function confirmYouTube({ title, madeForKids }) {
    rememberYtKids(madeForKids);
    if (ytSheet === 'settings') {
      setYtSheet(null);
      // The audience was asked for because Post Now needed it - carry on with that post.
      if (pendingPostNow.current) { pendingPostNow.current = false; postNow(); }
      return;
    }
    setYtSheet(null);   // closed before posting: the result alert must not sit under a Modal
    setYtPosting(true);
    try {
      const token = await user.getIdToken();
      const r = await fetch(`${BACKEND}/api/post-now`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ videoUrl: `${BACKEND}${videoPath}`, caption, platforms: ['youtube'], youtube: { title, madeForKids } }),
      });
      const d = await r.json();
      const result = d.results?.[0];
      if (!result) throw new Error(d.error || 'The upload failed.');
      if (!result.ok) throw new Error(result.error);
      // Said here rather than discovered later: the video really is on the channel, and
      // it really is private until Google's audit clears.
      markPosted('youtube', result.url);
      showAlert('Posted to YouTube',
        'It is on your channel as a private video while our YouTube app is under review. Open it in YouTube Studio to make it public.',
        doneButtons(result.url));
    } catch (e) {
      showAlert('YouTube', e.message || 'The upload failed.');
    } finally {
      setYtPosting(false);
    }
  }

  // Multi-account platforms (Facebook, Instagram, LinkedIn) post to every connected
  // account, so the row names the count rather than a bare "Connected" - a Post button
  // that fans out to three accounts should say so before it is tapped.
  const connectedLabel = (st, noun = 'accounts') => {
    const n = st?.accounts?.length || 0;
    return n > 1 ? `${n} ${noun}` : 'Connected';
  };
  // With several accounts on a platform, the row says how many a post goes to and lets the
  // user choose (Creator). One account needs no line.
  const accountsLine = (id, st, noun = 'accounts') => {
    const n = st?.accounts?.length || 0;
    if (!st?.connected || n < 2) return null;
    const sel = chosenAccts[id]?.length || n;
    return { text: `${sel} of ${n} ${noun}`, link: 'Choose', onPress: () => setAcctSheet(id) };
  };
  // After a post: a "View" button where there is a link, and no jump to the Calendar - the
  // user is usually about to post the same video somewhere else.
  const doneButtons = (url) => [
    ...(url ? [{ text: 'View post', onPress: () => { Linking.openURL(url); recordWinAndMaybeAsk(); } }] : []),
    { text: 'OK', onPress: () => recordWinAndMaybeAsk() },
  ];

  async function loadFacebook() {
    try {
      const token = await user.getIdToken();
      const r = await fetch(`${BACKEND}/api/facebook/status`, { headers: { Authorization: `Bearer ${token}` } });
      setFacebook(await r.json());
    } catch (e) { setFacebook(null); }
  }

  async function loadInstagram() {
    try {
      const token = await user.getIdToken();
      const r = await fetch(`${BACKEND}/api/instagram/status`, { headers: { Authorization: `Bearer ${token}` } });
      setInstagram(await r.json());
    } catch (e) { setInstagram(null); }
  }

  async function loadPinterest() {
    try {
      const token = await user.getIdToken();
      const r = await fetch(`${BACKEND}/api/pinterest/status`, { headers: { Authorization: `Bearer ${token}` } });
      setPinterest(await r.json());
    } catch (e) { setPinterest(null); }
  }

  async function loadLinkedIn() {
    try {
      const token = await user.getIdToken();
      const r = await fetch(`${BACKEND}/api/linkedin/status`, { headers: { Authorization: `Bearer ${token}` } });
      setLinkedin(await r.json());
    } catch (e) { setLinkedin(null); }
  }

  // Post to a browser-OAuth platform (Facebook/Instagram/Pinterest). Not connected -> send
  // them to ConnectAccounts, exactly like TikTok, rather than opening a browser here and
  // having to resume mid-post on return. Connected -> publish through the same /api/post-now
  // route. One generic handler keyed by platform id so a fourth platform is one map entry.
  const BROWSER_PLATFORMS = {
    facebook: { label: 'Facebook', status: facebook, setPosting: setFbPosting, done: 'Your video is live on your Facebook Page.' },
    instagram: { label: 'Instagram', status: instagram, setPosting: setIgPosting, done: 'Your Reel is live on your Instagram.' },
    pinterest: { label: 'Pinterest', status: pinterest, setPosting: setPinPosting, done: 'Your video Pin is live on your Pinterest board.' },
    linkedin: { label: 'LinkedIn', status: linkedin, setPosting: setLiPosting, done: 'Your post is live on your LinkedIn.' },
  };
  async function postToBrowserPlatform(id, extraBody = {}) {
    const cfg = BROWSER_PLATFORMS[id];
    if (!videoPath) return showAlert(cfg.label, 'There is no video to post yet.');
    // Social posting is a Pro/Creator benefit (also enforced server-side). Shown proactively
    // so a free user gets the message without a failed round-trip.
    if (!isPremium) return showAlert(cfg.label, 'Posting to social media is available on the Pro and Creator plans.');
    if (!cfg.status?.connected) return navigation.navigate('ConnectAccounts');
    if (needsCaption([id])) return;
    cfg.setPosting(true);
    try {
      const token = await user.getIdToken();
      const r = await fetch(`${BACKEND}/api/post-now`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ videoUrl: `${BACKEND}${videoPath}`, caption, platforms: [id], ...accountsBody([id]), ...extraBody }),
      });
      const d = await r.json();
      if (!d.results?.length) throw new Error(d.error || 'The post failed.');
      // Several accounts can mean several results; any success is a post, and the
      // failures are named rather than hidden.
      const ok = d.results.filter(x => x.ok);
      const bad = d.results.filter(x => !x.ok);
      if (!ok.length) throw new Error(bad.map(x => x.error).join('\n'));
      markPosted(id, ok[0].url);
      showAlert(`Posted to ${cfg.label}`,
        bad.length ? `${cfg.done}\n\nNot posted to ${bad.length} account${bad.length === 1 ? '' : 's'}: ${bad.map(x => x.error).join('; ')}` : cfg.done,
        doneButtons(ok[0].url));
    } catch (e) {
      showAlert(cfg.label, e.message || 'The post failed.');
    } finally {
      cfg.setPosting(false);
    }
  }

  // Mirrors postToYouTube: one tap runs the whole sequence. TikTok is not plan-gated on
  // the backend the way YouTube is, so there is no premium check here. Actual posting
  // still depends on the TikTok app being approved for the Content Posting API and on a
  // live connection - until then the server returns a reason and it surfaces below.
  // Tapping Post opens the compliant sheet (privacy selector + disclosures) rather than
  // posting straight away - TikTok's Direct Post audit requires the user to choose there.
  function postToTikTok() {
    if (!videoPath) return showAlert('TikTok', 'There is no video to post yet.');
    if (!isPremium) return showAlert('TikTok', 'Posting to social media is available on the Pro and Creator plans.');
    if (!tiktokConnected) return navigation.navigate('ConnectAccounts');
    setTtFor('single');
    setTtSheet(true);
  }

  // Runs after the sheet collects the user's choices. `options` is the TikTok post_info
  // (privacy, comment/duet/stitch, brand disclosure) built to TikTok's spec.
  async function uploadTikTok(options) {
    // Post Now and Save to queue open this same sheet first, so TikTok always gets the
    // user's own privacy/interaction/disclosure choices - without them the server defaults
    // to SELF_ONLY and the post is visible to no one.
    if (ttFor === 'all') { setTtSheet(false); return runPostNow(options); }
    if (ttFor === 'queue') { setTtSheet(false); return saveToQueue(options); }
    setTtPosting(true);
    try {
      const token = await user.getIdToken();
      // The sheet read its privacy rules FROM one account, so the post goes to that one -
      // not to every connected TikTok under a single account's settings, which is what
      // TikTok's guidelines exist to prevent. accountId is the sheet's, not the user's to
      // type, so it never reaches TikTok as post_info.
      // `caption` is the sheet's, not the screen's: TikTok is the one platform where the
      // user writes the description inside the compliant sheet, alongside the privacy
      // choice, the way TikTok's own composer does.
      const { accountId, accountIds, caption: ttCaption, ...tiktokOptions } = options;
      // Write once: words typed in the TikTok sheet fill the screen's empty caption box, so
      // the YouTube/Pinterest posts that usually follow carry them too. Never overwrites
      // a caption the user already wrote here.
      if (ttCaption?.trim() && !caption.trim()) setCaption(ttCaption);
      const r = await fetch(`${BACKEND}/api/post-now`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          videoUrl: `${BACKEND}${videoPath}`, caption: ttCaption ?? caption, platforms: ['tiktok'],
          tiktok: tiktokOptions,
          // 'all' means every connected TikTok, which post-now expresses as an empty
          // selection; a single id posts only there.
          ...(accountIds?.length ? { accounts: { tiktok: accountIds } }
              : accountId && accountId !== 'all' ? { accounts: { tiktok: [accountId] } } : {}),
        }),
      });
      const d = await r.json();
      const result = d.results?.[0];
      if (!result) throw new Error(d.error || 'The post failed.');
      if (!result.ok) throw new Error(result.error);
      setTtSheet(false);
      // 'direct' once the app is audited for Direct Post; 'draft' until then (the video
      // lands in the TikTok inbox for the user to finish).
      markPosted('tiktok', tiktokUrl(options.username));
      if (result.mode === 'direct') {
        showAlert('Posted to TikTok', 'Your video has been posted to your TikTok account.', doneButtons(tiktokUrl(options.username)));
      } else {
        showAlert('Sent to TikTok',
          'Your video is now in your TikTok inbox as a draft. Open TikTok to add your caption and publish it.',
          doneButtons(null));
      }
    } catch (e) {
      showAlert('TikTok', e.message || 'The post failed.');
    } finally {
      setTtPosting(false);
    }
  }

  async function loadTikTok() {
    try {
      const snap = await getDoc(doc(db, 'connectedAccounts', user.uid));
      const tt = snap.exists() ? snap.data().tiktok : null;
      // An ARRAY since TikTok went multi-account; an older single object still reads.
      // Posting fans out to every connected account server-side, so the first one is
      // only what names the row.
      const arr = Array.isArray(tt) ? tt : (tt ? [tt] : []);
      setTiktokConnected(arr.length > 0);
      setTiktokAccounts(arr.length);
      if (arr.length) {
        setTiktokOpenId(arr[0].accountId || arr[0].openId);
        setTiktokName(arr[0].label || arr[0].displayName || 'TikTok');
      }
    } catch (e) {}
  }

  async function loadQueue() {
    try {
      const q = query(collection(db, 'scheduledPosts'), where('userId', '==', user.uid));
      const snap = await getDocs(q);
      const posts = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 5);
      setQueue(posts);
    } catch (e) {}
  }

  // Every enabled platform, through one route. This used to call /tiktok/post-video
  // directly, which is why a second platform had nowhere to go - /api/post-now publishes
  // through the same registry and the same publish functions the scheduled sweep uses,
  // so posting now and posting later cannot drift apart. It also writes the history
  // record itself, so this no longer does.
  // Pinterest asks WHERE before posting. Everything that would refuse the post anyway
  // (no video, free plan, not connected, no caption) is checked first, so the sheet only
  // opens when choosing a board is the last step.
  function openPinterest() {
    if (!videoPath) return showAlert('Pinterest', 'There is no video to post yet.');
    if (!isPremium) return showAlert('Pinterest', 'Posting to social media is available on the Pro and Creator plans.');
    if (!pinterest?.connected) return navigation.navigate('ConnectAccounts');
    if (needsCaption(['pinterest'])) return;
    setPinSheet('post');
  }

  async function postToChosenBoards({ boards: chosen, link, coverSeconds }) {
    rememberBoards(chosen);
    // Closed BEFORE posting: the result is a BrandedAlert, and a Modal still open on top
    // would hide it (two modals at once is the Android trap ProfileGate documents).
    setPinSheet(null);
    const boards = Object.fromEntries(Object.entries(chosen).map(([acc, b]) => [acc, b.id]));
    await postToBrowserPlatform('pinterest', { pinterest: { boards, link, coverSeconds } });
  }

  function chooseBoards({ boards: chosen }) {
    rememberBoards(chosen);
    setPinSheet(null);
  }

  async function postNow() {
    if (!videoPath) { showAlert('Error', 'No video to post'); return; }
    if (!isPremium) { showAlert('Post Now', 'Posting to social media is available on the Pro and Creator plans.'); return; }
    const platforms = connectedPlatforms;
    if (platforms.length === 0) { showAlert('Post Now', 'Connect an account first - use the Connect buttons above.'); return; }
    if (needsCaption(platforms)) return;
    // YouTube needs the audience answer before anything posts.
    if (platforms.includes('youtube') && typeof ytKids !== 'boolean') {
      pendingPostNow.current = true;
      setYtSheet('settings');
      return;
    }
    if (platforms.includes('tiktok')) { setTtFor('all'); setTtSheet(true); return; }
    return runPostNow(null);
  }

  // The background Post Now: one request returns a job id, the server posts platform by
  // platform, and this polls the job to draw each one's progress.
  async function runPostNow(ttOptions) {
    const platforms = connectedPlatforms;
    setPosting(true);
    setPostJob(null);
    try {
      const token = await user.getIdToken();
      const { accountId, accountIds, caption: ttCaption, username, ...tiktokOptions } = ttOptions || {};
      const accounts = { ...(accountsBody(platforms).accounts || {}) };
      if (ttOptions) {
        if (accountIds?.length) accounts.tiktok = accountIds;
        else if (accountId && accountId !== 'all') accounts.tiktok = [accountId];
      }
      const r = await fetch(`${BACKEND}/api/post-now`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          async: true, videoUrl: `${BACKEND}${videoPath}`, caption, platforms, ...pinterestBody(),
          youtube: { title: youtubeTitleFrom(caption) || undefined, madeForKids: ytKids === true },
          ...(ttOptions ? { tiktok: { ...tiktokOptions, caption: ttCaption } } : {}),
          ...(Object.keys(accounts).length ? { accounts } : {}),
        }),
      });
      const d = await r.json();
      if (!d.jobId) throw new Error(d.error || 'The post could not start.');
      let job = null;
      for (let i = 0; i < 300; i++) {
        await new Promise(z => setTimeout(z, 3000));
        const jr = await fetch(`${BACKEND}/api/job/${d.jobId}`, { headers: { Authorization: `Bearer ${await user.getIdToken()}` } });
        if (!jr.ok) continue;
        job = await jr.json();
        setPostJob(job);
        if (job.status === 'done' || job.status === 'error') break;
      }
      const posts = job?.posts || [];
      for (const p of posts) if (p.status === 'posted') markPosted(p.platform, p.platform === 'tiktok' ? tiktokUrl(username) : p.url);
      if (posts.some(p => p.status === 'posted')) recordWinAndMaybeAsk();
    } catch (e) { showAlert('Post Now', e.message); }
    setPosting(false);
  }



  // Every platform this account can actually publish to right now.
  //
  // The two buttons at the bottom used to be hardcoded to ['tiktok'] - which meant
  // SCHEDULING, the only thing this section offers that the per-platform rows do not,
  // could never target the five platforms that work. Worse, with TikTok not connected it
  // wrote platforms: [] and the sweep skips an empty list, so the post sat queued forever
  // while the Calendar showed it as pending.
  const connectedPlatforms = useMemo(() => {
    const on = [];
    // Meta while in development mode counts only for those it is available to (admins).
    if (facebook?.connected && facebook.available !== false) on.push('facebook');
    if (instagram?.connected && instagram.available !== false) on.push('instagram');
    if (pinterest?.connected) on.push('pinterest');
    if (linkedin?.connected) on.push('linkedin');
    if (tiktokConnected) on.push('tiktok');
    if (youtube?.connected) on.push('youtube');
    return on;
  }, [facebook, instagram, pinterest, linkedin, tiktokConnected, youtube]);

  const captionNotes = useMemo(() => {
    const on = new Set(connectedPlatforms);
    const len = caption.length;
    const tags = (caption.match(/(^|\s)#[^\s#]+/g) || []).length;
    const notes = [];
    if (on.has('instagram') && tags > 30) notes.push(`Instagram allows up to 30 hashtags - this caption has ${tags}.`);
    if (on.has('instagram') && len > 2200) notes.push('Instagram shows the first 2,200 characters.');
    if (on.has('pinterest') && len > 800) notes.push('Pinterest shows the first 800 characters.');
    if (on.has('linkedin') && len > 3000) notes.push('LinkedIn shows the first 3,000 characters.');
    if (on.has('youtube') && len > 5000) notes.push('YouTube shows the first 5,000 characters.');
    return notes;
  }, [caption, connectedPlatforms]);

  const PLATFORM_LABELS = {
    facebook: 'Facebook', instagram: 'Instagram', pinterest: 'Pinterest',
    linkedin: 'LinkedIn', tiktok: 'TikTok', youtube: 'YouTube',
  };
  const namePlatforms = (ids) => {
    const names = ids.map(id => PLATFORM_LABELS[id] || id);
    if (names.length <= 1) return names[0] || '';
    return names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1];
  };

  // The instant the post is due, from the three chips. Built fresh on each render rather
  // than stored, so it cannot go stale across midnight while the screen is open.
  const scheduledAt = useMemo(() => {
    if (schedMode === 'immediate') return new Date();
    const d = new Date();
    d.setDate(d.getDate() + schedDay);
    d.setHours(schedHour, schedMin, 0, 0);
    // Choosing a time earlier today means tomorrow, which is what every calendar does
    // and what the user meant - not "post immediately because that moment has passed".
    if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
    return d;
  }, [schedMode, schedDay, schedHour, schedMin]);

  const SCHED_DAYS = useMemo(() => Array.from({ length: 14 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() + i);
    return { offset: i, label: i === 0 ? 'Today' : i === 1 ? 'Tomorrow'
      : d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' }) };
  }), []);

  async function saveToQueue(ttOptions) {
    if (!isPremium) { showAlert('Schedule', 'Scheduling posts is available on the Pro and Creator plans.'); return; }
    const platforms = connectedPlatforms;
    // Refused rather than written empty. The sweep skips a post with no platforms, so an
    // empty list is a post that stays queued forever while the Calendar calls it pending -
    // which is exactly what "Saved to your queue, now connect TikTok" used to produce.
    if (platforms.length === 0) {
      showAlert('Schedule', 'Connect an account first - a scheduled post needs somewhere to go.');
      return;
    }
    if (needsCaption(platforms)) return;
    if (platforms.includes('youtube') && typeof ytKids !== 'boolean') { setYtSheet('settings'); return; }
    // TikTok's choices are made NOW, at scheduling, and stored with the post for the sweep.
    if (platforms.includes('tiktok') && !ttOptions?.privacyLevel) { setTtFor('queue'); setTtSheet(true); return; }
    const { accountId, accountIds, caption: ttCaption, username, ...tiktokOptions } = ttOptions || {};
    const accounts = { ...(accountsBody(platforms).accounts || {}) };
    if (ttOptions) {
      if (accountIds?.length) accounts.tiktok = accountIds;
      else if (accountId && accountId !== 'all') accounts.tiktok = [accountId];
    }
    setSaving(true);
    try {
      await addDoc(collection(db, 'scheduledPosts'), {
        userId: user.uid, caption, videoUrl: videoUrl || '', ...pinterestBody(),
        youtube: { title: youtubeTitleFrom(caption) || null, madeForKids: ytKids === true },
        ...(ttOptions ? { tiktok: { ...tiktokOptions, caption: ttCaption } } : {}),
        ...(Object.keys(accounts).length ? { accounts } : {}),
        platforms,
        scheduledFor: scheduledAt.toISOString(),
        scheduleMode: schedMode === 'immediate' ? 'queued' : 'scheduled',
        status: 'queued', createdAt: new Date().toISOString()
      });
      await loadQueue();
      // Says when, because it now actually happens. The queue used to be a list nothing
      // read: this said "Added to queue!" and the post was never sent.
      showAlert('Queued', schedMode === 'immediate'
        ? `It will post to ${namePlatforms(platforms)} within about 5 minutes. You can see it on the Calendar.`
        : `It will post to ${namePlatforms(platforms)} on ${scheduledAt.toLocaleDateString()} at `
          + `${scheduledAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`);
    } catch (e) { showAlert('Error', e.message); }
    setSaving(false);
  }

  const fullUrl = videoUrl ? (videoUrl.startsWith('http') ? videoUrl : `${BACKEND}${videoUrl}`) : null;

  // Getting the finished video off the phone's screen and into the phone.
  //
  // This was a third copy of the same download-then-share, alongside My Videos and
  // Idea-to-Video, and like the others it showed a bare spinner labelled "Preparing…"
  // while fetching ~26MB. On a slow connection that is minutes with no sign of
  // progress, which is indistinguishable from a hang - and is what was reported.
  //
  // Shared helper now: it reports a percentage, and on a build with media-library it
  // saves straight to the gallery instead of going through the share sheet. The
  // comment that used to sit here said media-library was not installed; it is, as of
  // versionCode 11.
  const [downloading, setDownloading] = useState(false);
  const [downloadPct, setDownloadPct] = useState(0);
  const [downloadEta, setDownloadEta] = useState('');
  async function downloadVideo() {
    if (!fullUrl || downloading) return;
    setDownloading(true);
    setDownloadPct(0);
    try {
      const name = (videoPath || fullUrl).split('/').pop().split('?')[0] || 'tonefy-video.mp4';
      const eta = createEta();
      const { method } = await saveVideoToDevice(fullUrl, { prompt: name.replace(/\.mp4$/i, '') }, (pct) => {
        setDownloadPct(pct);
        setDownloadEta(eta.push(pct));
      });
      if (method === 'gallery') showAlert('Saved', 'The video is in your gallery.');
    } catch (e) {
      showAlert('Download failed', e?.message || 'Could not download the video.');
    } finally {
      setDownloading(false);
      setDownloadEta('');
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.bg, paddingBottom: insets.bottom || 16 }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.bg} />
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backRow}>
          <MaterialIcons name="arrow-back" size={20} color={theme.icon} />
          <Text style={styles.back}>Back</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.text }]}>Edit & Post Video</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Video Preview */}
        <Text style={[styles.sectionLabel, { color: theme.subtext }]}>VIDEO PREVIEW</Text>
        <View style={[styles.videoWrap, { backgroundColor: theme.card }]}>
          {fullUrl ? <VideoPreview url={fullUrl} /> : (
            <View style={styles.noVideo}>
              <MaterialIcons name="movie" size={36} color={theme.border} style={styles.noVideoIcon} />
              <Text style={[styles.noVideoText, { color: theme.text }]}>No video selected</Text>
              <TouchableOpacity onPress={() => navigation.navigate('IdeaToVideo')}>
                <Text style={styles.noVideoLink}>Create a video</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {fullUrl && (
          <ProgressButton
            label={downloading ? `Downloading… ${downloadPct}%` : 'Save video'}
            hint={downloadEta}
            progress={downloadPct}
            busy={downloading}
            icon="file-download"
            onPress={downloadVideo}
            style={styles.downloadBtn}
            labelStyle={styles.downloadText}
          />
        )}

        {/* Caption */}
        <Text style={[styles.sectionLabel, { color: theme.subtext }]}>CAPTION</Text>
        <TextInput
          style={[styles.captionInput, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.text }]}
          value={caption}
          onChangeText={setCaption}
          placeholder="Enter your video caption... #TonefyAI"
          placeholderTextColor={theme.subtext}
          multiline
          numberOfLines={3}
        />
        {/* Platform limits, said BEFORE posting, only for platforms this account posts to.
            The server trims to the limit so nothing fails, but the user should know what
            will be cut. */}
        {captionNotes.map(n => (
          <View key={n} style={styles.captionNoteRow}>
            <MaterialIcons name="info-outline" size={12} color="#888" />
            <Text style={styles.captionNote}>{n}</Text>
          </View>
        ))}

        {/* Post To */}
        <Text style={[styles.sectionLabel, { color: theme.subtext }]}>POST TO</Text>
        <View style={[styles.platformsCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <PostRow
            Logo={FacebookLogo} name="Facebook" color="#1877F2" theme={theme}
            comingSoon={facebook?.available === false}
            connected={facebook?.connected} connectedText={connectedLabel(facebook, 'Pages')}
            sub={accountsLine('facebook', facebook, 'Pages')}
            posted={posted.facebook} posting={fbPosting} isPremium={isPremium}
            onPress={() => postToBrowserPlatform('facebook')}
          />
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <PostRow
            Logo={InstagramLogo} name="Instagram" color="#E4405F" theme={theme}
            comingSoon={instagram?.available === false}
            connected={instagram?.connected} connectedText={connectedLabel(instagram)}
            sub={accountsLine('instagram', instagram)}
            posted={posted.instagram} posting={igPosting} isPremium={isPremium}
            onPress={() => postToBrowserPlatform('instagram')}
          />
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          {/* The chosen board sits on its own line under the name (see PostRow): appended to
              the unbounded "Connected" label it once squeezed the name to zero and pushed Post
              off screen (Oct 4 2026). Always visible, so Post Now / Save to queue never send a
              Pin somewhere unseen; one tap to change. */}
          <PostRow
            Logo={PinterestLogo} name="Pinterest" color="#E60023" theme={theme}
            connected={pinterest?.connected} connectedText={connectedLabel(pinterest)}
            sub={pinterest?.connected && Object.keys(pinBoards).length ? {
              text: Object.keys(pinBoards).length === 1 ? Object.values(pinBoards)[0].name : `${Object.keys(pinBoards).length} boards`,
              link: 'Change', onPress: () => setPinSheet('choose'),
            } : null}
            posted={posted.pinterest} posting={pinPosting} isPremium={isPremium}
            onPress={openPinterest}
          />
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <PostRow
            Logo={LinkedInLogo} name="LinkedIn" color="#0A66C2" theme={theme}
            connected={linkedin?.connected} connectedText={connectedLabel(linkedin)}
            sub={accountsLine('linkedin', linkedin)}
            posted={posted.linkedin} posting={liPosting} isPremium={isPremium}
            onPress={() => postToBrowserPlatform('linkedin')}
          />
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          {/* TikTok: Post opens the compliant sheet (privacy, interactions, disclosure, which
              account) - TikTok's Direct Post audit requires the user to choose there. */}
          <PostRow
            Logo={TikTokLogo} name="TikTok" color={theme.text} theme={theme}
            connected={tiktokConnected} connectedText={tiktokAccounts > 1 ? `${tiktokAccounts} accounts` : 'Connected'}
            posted={posted.tiktok} posting={ttPosting} isPremium={isPremium}
            onPress={postToTikTok} connectLabel="Connect & post"
          />
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          {/* YouTube: Post opens its sheet (title + the audience YouTube requires). The red
              button is YouTube's own colour - a platform's identity, not one of ours. */}
          <PostRow
            Logo={YouTubeLogo} name="YouTube" color={theme.text} theme={theme}
            connected={isPremium && youtube?.connected} connectedText="Connected"
            sub={isPremium && youtube?.connected && typeof ytKids === 'boolean' ? {
              text: ytKids ? 'Made for kids' : 'Not made for kids', link: 'Change', onPress: () => setYtSheet('settings'),
            } : null}
            posted={posted.youtube} posting={ytPosting} isPremium={isPremium}
            onPress={postToYouTube} connectLabel="Connect & post" youtube
          />
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <View style={styles.platformRow}>
            <MaterialIcons name="close" size={22} color={theme.text} style={styles.platformIcon} />
            <Text style={[styles.platformName, { color: theme.text }]}>X (Twitter)</Text>
            <Text style={[styles.comingSoon, { color: theme.subtext }]}>Coming soon</Text>
            <View style={[styles.toggleOff, { backgroundColor: theme.divider }]} />
          </View>
        </View>

        {/* AI Tip */}
        <View style={[styles.aiTip, { backgroundColor: isDark ? '#0d1a2e' : '#e8f2ff', borderColor: isDark ? '#1a3a5a' : '#b8d4f5' }]}>
          <MaterialIcons name="smart-toy" size={22} color="#2ecc71" style={styles.aiTipIcon} />
          <View style={{ flex: 1 }}>
            <Text style={styles.aiTipTitle}>AI Tip</Text>
            <Text style={[styles.aiTipText, { color: theme.subtext }]}>Best time to post on TikTok is between 7–9 PM for maximum reach.</Text>
          </View>
        </View>

        {/* WHEN */}
        <Text style={[styles.sectionLabel, { color: theme.subtext }]}>WHEN</Text>
        <View style={styles.schedRow}>
          {[['immediate', 'As soon as possible'], ['later', 'At a time']].map(([k, label]) => (
            <TouchableOpacity key={k} onPress={() => setSchedMode(k)}
              style={[styles.schedMode, { borderColor: theme.border },
                schedMode === k && styles.schedModeOn]}>
              <Text style={[styles.schedModeText, { color: theme.text },
                schedMode === k && styles.schedModeTextOn]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {schedMode === 'later' && (
          <>
            {/* Fourteen days is as far ahead as anyone plans a short-form post, and it
                keeps this to chips rather than a calendar grid - no native module, which
                a date picker would otherwise need and which cannot ship over the air. */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              style={styles.chipRow} contentContainerStyle={styles.chipRowContent}>
              {SCHED_DAYS.map(d => (
                <TouchableOpacity key={d.offset} onPress={() => setSchedDay(d.offset)}
                  style={[styles.chip, { borderColor: theme.border }, schedDay === d.offset && styles.chipOn]}>
                  <Text style={[styles.chipText, { color: theme.text }, schedDay === d.offset && styles.chipTextOn]}>{d.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              style={styles.chipRow} contentContainerStyle={styles.chipRowContent}>
              {Array.from({ length: 24 }, (_, h) => h).map(h => (
                <TouchableOpacity key={h} onPress={() => setSchedHour(h)}
                  style={[styles.chip, { borderColor: theme.border }, schedHour === h && styles.chipOn]}>
                  <Text style={[styles.chipText, { color: theme.text }, schedHour === h && styles.chipTextOn]}>
                    {String(h).padStart(2, '0')}:00
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              style={styles.chipRow} contentContainerStyle={styles.chipRowContent}>
              {[0, 15, 30, 45].map(m => (
                <TouchableOpacity key={m} onPress={() => setSchedMin(m)}
                  style={[styles.chip, { borderColor: theme.border }, schedMin === m && styles.chipOn]}>
                  <Text style={[styles.chipText, { color: theme.text }, schedMin === m && styles.chipTextOn]}>
                    :{String(m).padStart(2, '0')}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Text style={[styles.schedSummary, { color: theme.subtext }]}>
              Posts {scheduledAt.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })}
              {' at '}{scheduledAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </>
        )}

        {/* Which platforms both buttons below act on. Stated here because these two send
            to EVERY connected account at once, unlike the per-platform rows above where
            the target is the row you tapped. */}
        <Text style={[styles.schedNote, { color: theme.subtext }]}>
          {connectedPlatforms.length
            ? `Goes to ${namePlatforms(connectedPlatforms)}.`
            : 'No accounts connected yet - connect one above.'}
        </Text>

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.btnQueue} onPress={() => saveToQueue()} disabled={saving}>
            {saving ? <ActivityIndicator color="#2ecc71" size="small" />
              : <Text style={styles.btnQueueText}>{schedMode === 'later' ? 'Schedule' : 'Save to Queue'}</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnPost} onPress={postNow} disabled={posting}>
            {posting ? <ActivityIndicator color="#000" size="small" /> : <Text style={styles.btnPostText}>Post Now</Text>}
          </TouchableOpacity>
        </View>
        <PostProgress job={postJob} labels={PLATFORM_LABELS} theme={theme} />

        {/* Recently Queued */}
        <Text style={[styles.sectionLabel, { color: theme.subtext }]}>RECENTLY QUEUED</Text>
        {queue.length === 0 ? (
          <Text style={[styles.emptyQueue, { color: theme.subtext }]}>No queued posts yet</Text>
        ) : queue.map(p => (
          <View key={p.id} style={[styles.queueItem, { backgroundColor: theme.card }]}>
            <MaterialIcons name="movie" size={24} color={theme.icon} style={styles.queueIcon} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.queueCaption, { color: theme.text }]} numberOfLines={1}>{p.caption || 'Untitled'}</Text>
              <Text style={[styles.queueMeta, { color: theme.subtext }]}>{new Date(p.scheduledFor).toLocaleDateString()} · {p.status}</Text>
              <Text style={styles.queuePlat}>{(p.platforms || []).join(', ') || 'No platform'}</Text>
            </View>
          </View>
        ))}
        <View style={{ height: 40 }} />
      </ScrollView>

      <YouTubePostSheet
        visible={!!ytSheet}
        mode={ytSheet || 'post'}
        onClose={() => { pendingPostNow.current = false; setYtSheet(null); }}
        onConfirm={confirmYouTube}
        caption={caption}
        madeForKids={ytKids}
        posting={ytPosting}
      />

      <AccountPickerSheet
        visible={!!acctSheet}
        onClose={() => setAcctSheet(null)}
        onConfirm={(ids) => { setChosenAccts(c => ({ ...c, [acctSheet]: ids || undefined })); setAcctSheet(null); }}
        label={acctSheet ? PLATFORM_LABELS[acctSheet] : ''}
        color={{ facebook: '#1877F2', instagram: '#E4405F', linkedin: '#0A66C2', pinterest: '#E60023' }[acctSheet] || '#fff'}
        Logo={{ facebook: FacebookLogo, instagram: InstagramLogo, linkedin: LinkedInLogo, pinterest: PinterestLogo }[acctSheet]}
        accounts={({ facebook, instagram, linkedin, pinterest }[acctSheet])?.accounts || []}
        selected={acctSheet ? chosenAccts[acctSheet] : null}
      />

      <PinterestBoardSheet
        visible={!!pinSheet}
        mode={pinSheet || 'post'}
        onClose={() => setPinSheet(null)}
        onConfirm={pinSheet === 'choose' ? chooseBoards : postToChosenBoards}
        remembered={pinBoards}
        posting={pinPosting}
        videoUrl={videoPath ? `${BACKEND}${videoPath}` : null}
      />

      <TikTokPostSheet
        defaultCaption={caption}
        visible={ttSheet}
        onClose={() => { if (!ttPosting) setTtSheet(false); }}
        onConfirm={uploadTikTok}
        theme={theme}
        posting={ttPosting}
        videoUrl={fullUrl}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  ytBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    backgroundColor: '#FF0000', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 7,
    minWidth: 96,
  },
  // Neutral rather than red when it is an upgrade prompt: the red button means "this
  // uploads now", and wearing it while refusing would be a lie about what the tap does.
  ytBtnLocked: { backgroundColor: '#3a3a3a' },
  ytBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  ttBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    backgroundColor: '#2ECC71', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 7,
    minWidth: 96,
  },
  ttBtnText: { color: '#000', fontSize: 12, fontWeight: '700' },
  container: { flex: 1, backgroundColor: '#0a0a0a', paddingTop: STATUSBAR_HEIGHT },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#1a1a1a' },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  back: { color: '#2ecc71', fontSize: 15, fontWeight: '600' },
  title: { color: '#fff', fontSize: 16, fontWeight: '700' },
  scroll: { flex: 1, padding: 16 },
  schedRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  schedMode: { flex: 1, borderWidth: 1, borderRadius: 10, paddingVertical: 11, alignItems: 'center' },
  schedNote: { fontSize: 12, marginTop: 14, marginBottom: 2, textAlign: 'center' },
  schedModeOn: { borderColor: '#2ecc71', backgroundColor: 'rgba(46,204,113,0.10)' },
  schedModeText: { fontSize: 13, fontWeight: '600' },
  schedModeTextOn: { color: '#2ecc71' },
  // All four ingredients, per the chip-row rule in CLAUDE.md: no growing, no shrinking,
  // and both alignment and padding on the CONTENT container rather than on `style`.
  chipRow: { flexGrow: 0, flexShrink: 0, marginBottom: 8 },
  chipRowContent: { alignItems: 'center', gap: 6, paddingVertical: 2 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, borderWidth: 1 },
  chipOn: { borderColor: '#2ecc71', backgroundColor: 'rgba(46,204,113,0.10)' },
  chipText: { fontSize: 12, fontWeight: '600' },
  chipTextOn: { color: '#2ecc71' },
  schedSummary: { fontSize: 12, marginBottom: 12 },
  sectionLabel: { color: '#888', fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8, marginTop: 16 },
  videoWrap: { backgroundColor: '#1a1a1a', borderRadius: 14, overflow: 'hidden', marginBottom: 4, minHeight: 200 },
  video: { width: '100%', height: 260, backgroundColor: '#000' },
  playFab: {
    position: 'absolute', left: 12, bottom: 12, width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#2ECC71', alignItems: 'center', justifyContent: 'center',
  },
  videoLoading: { position: 'absolute', right: 14, bottom: 22 },
  // No backgroundColor and no label colour here on purpose: ProgressButton spreads
  // `style` last, so either one would paint over the fill it is meant to reveal.
  downloadBtn: { borderRadius: 12, marginTop: 10, minHeight: 46 },
  downloadText: { fontSize: 14 },
  noVideo: { alignItems: 'center', padding: 32 },
  noVideoIcon: { fontSize: 36, marginBottom: 8 },
  noVideoText: { color: '#fff', fontWeight: '600', marginBottom: 6 },
  noVideoLink: { color: '#2ecc71', fontWeight: '600' },
  captionInput: { backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 12, color: '#fff', fontSize: 14, padding: 14, minHeight: 80, textAlignVertical: 'top' },
  platformsCard: { backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 14, overflow: 'hidden' },
  platformRow: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10 },
  platformIcon: { fontSize: 22, width: 30 },
  platformName: { flex: 1, color: '#fff', fontSize: 15, fontWeight: '600' },
  comingSoon: { color: '#666', fontSize: 12, marginRight: 8 },
  connectedText: { color: '#2ecc71', fontSize: 12, marginRight: 8 },
  // A name with a second line (the Pinterest board). The column takes the flex, so the
  // name and its sub-line shrink and truncate instead of the button leaving the row.
  platformNameCol: { flex: 1, minWidth: 0 },
  platformSub: { color: '#888', fontSize: 12, marginTop: 2 },
  platformSubRow: { flexDirection: 'row', alignItems: 'center' },
  platformSubName: { flexShrink: 1 },
  platformSubLink: { color: '#2ECC71', fontWeight: '600', flexShrink: 0 },
  postedText: { color: '#2ECC71' },
  captionNoteRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  captionNote: { color: '#888', fontSize: 12, flex: 1 },
  jobPanel: { borderWidth: 1, borderRadius: 14, padding: 12, marginTop: 12, gap: 10 },
  jobRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  jobName: { fontSize: 14, fontWeight: '600' },
  jobStatus: { color: '#888', fontSize: 12, marginTop: 1 },
  jobView: { color: '#2ECC71', fontSize: 13, fontWeight: '700' },
  connectLink: { color: '#2ecc71', fontSize: 12, fontWeight: '600', marginRight: 8 },
  divider: { height: 1, backgroundColor: '#2a2a2a', marginHorizontal: 14 },
  toggle: { width: 44, height: 24, borderRadius: 12, backgroundColor: '#333', justifyContent: 'center', paddingHorizontal: 2 },
  toggleOn: { backgroundColor: '#2ecc71' },
  toggleOff: { width: 44, height: 24, borderRadius: 12, backgroundColor: '#222' },
  toggleThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff' },
  toggleThumbOn: { alignSelf: 'flex-end' },
  aiTip: { flexDirection: 'row', gap: 12, backgroundColor: '#0d1a2e', borderWidth: 1, borderColor: '#1a3a5a', borderRadius: 12, padding: 14, marginTop: 16, alignItems: 'flex-start' },
  aiTipIcon: { fontSize: 22 },
  aiTipTitle: { color: '#60a5fa', fontWeight: '700', fontSize: 13, marginBottom: 2 },
  aiTipText: { color: '#888', fontSize: 12, lineHeight: 18 },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  btnQueue: { flex: 1, borderWidth: 1, borderColor: '#2ecc71', borderRadius: 25, padding: 14, alignItems: 'center' },
  btnQueueText: { color: '#2ecc71', fontWeight: '700', fontSize: 14 },
  btnPost: { flex: 1, backgroundColor: '#2ecc71', borderRadius: 25, padding: 14, alignItems: 'center' },
  btnPostText: { color: '#000', fontWeight: '700', fontSize: 14 },
  emptyQueue: { color: '#888', fontSize: 13, padding: 8 },
  queueItem: { flexDirection: 'row', gap: 10, backgroundColor: '#1a1a1a', borderRadius: 12, padding: 12, marginBottom: 8, alignItems: 'center' },
  queueIcon: { fontSize: 24 },
  queueCaption: { color: '#fff', fontSize: 13, fontWeight: '600' },
  queueMeta: { color: '#888', fontSize: 11, marginTop: 2 },
  queuePlat: { color: '#2ecc71', fontSize: 11, marginTop: 2 },
});
