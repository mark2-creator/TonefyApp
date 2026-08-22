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
import { TikTokLogo, InstagramLogo, FacebookLogo, YouTubeLogo } from '../components/BrandLogos';
import { usePlan } from '../constants/plan';
import { auth, db } from '../firebase';
import { doc, getDoc, addDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { showAlert } from '../components/BrandedAlert';

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

export default function EditPostVideoScreen({ navigation, route }) {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { videoUrl, videoPath } = route.params || {};
  const [caption, setCaption] = useState('');
  const [tiktokConnected, setTiktokConnected] = useState(false);
  const [tiktokOpenId, setTiktokOpenId] = useState(null);
  const [tiktokName, setTiktokName] = useState('');
  const [ttOn, setTtOn] = useState(false);
  const [youtube, setYoutube] = useState(null);
  // No toggle. A toggle asks the user to express an intention and then do a SECOND
  // thing to act on it - and on this row the second thing was far away at the bottom of
  // the screen, so flipping it appeared to do nothing at all. One button that runs the
  // whole sequence is what was actually wanted.
  const [ytPosting, setYtPosting] = useState(false);
  // Set before the browser opens, so returning from a completed consent CONTINUES to the
  // upload instead of dumping the user back on a screen where nothing has happened.
  const ytPendingRef = useRef(false);
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
    // Returning from the browser BACKGROUNDS the app rather than navigating away, so
    // AppState is the signal - a navigation focus effect would never fire.
    const sub = AppState.addEventListener('change', async (next) => {
      if (next !== 'active') return;
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
    setYtPosting(true);
    try {
      const token = await user.getIdToken();
      const r = await fetch(`${BACKEND}/api/post-now`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ videoUrl: `${BACKEND}${videoPath}`, caption, platforms: ['youtube'] }),
      });
      const d = await r.json();
      const result = d.results?.[0];
      if (!result) throw new Error(d.error || 'The upload failed.');
      if (!result.ok) throw new Error(result.error);
      // Said here rather than discovered later: the video really is on the channel, and
      // it really is private until Google's audit clears.
      showAlert('Posted to YouTube',
        'It is on your channel as a private video while our YouTube app is under review.',
        [{ text: 'OK', onPress: () => navigation.navigate('Calendar') }]);
    } catch (e) {
      showAlert('YouTube', e.message || 'The upload failed.');
    } finally {
      setYtPosting(false);
    }
  }

  async function loadTikTok() {
    try {
      const snap = await getDoc(doc(db, 'connectedAccounts', user.uid));
      if (snap.exists() && snap.data().tiktok) {
        const tt = snap.data().tiktok;
        setTiktokConnected(true);
        setTiktokOpenId(tt.openId);
        setTiktokName(tt.displayName || 'TikTok');
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
  async function postNow() {
    if (!videoPath) { showAlert('Error', 'No video to post'); return; }
    const platforms = ttOn ? ['tiktok'] : [];
    if (platforms.length === 0) { showAlert('Error', 'Enable at least one platform'); return; }
    setPosting(true);
    try {
      const token = await user.getIdToken();
      const r = await fetch(`${BACKEND}/api/post-now`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ videoUrl: `${BACKEND}${videoPath}`, caption, platforms }),
      });
      const d = await r.json();
      const failed = (d.results || []).filter(x => !x.ok);
      if (!d.results) throw new Error(d.error || 'The post failed.');
      if (failed.length === 0) {
        showAlert('Posted', `Posted to ${platforms.length > 1 ? 'your channels' : platforms[0] === 'youtube' ? 'YouTube' : 'TikTok'}!`,
          [{ text: 'OK', onPress: () => navigation.navigate('Calendar') }]);
      } else if (failed.length < (d.results || []).length) {
        // Partial success is its own outcome. Reporting it as failure would have someone
        // retry a platform that already posted.
        showAlert('Partly posted', failed.map(f => `${f.platform}: ${f.error}`).join('\n'));
      } else {
        throw new Error(failed.map(f => f.error).join('\n'));
      }
    } catch (e) { showAlert('Error', e.message); }
    setPosting(false);
  }

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

  async function saveToQueue() {
    setSaving(true);
    try {
      await addDoc(collection(db, 'scheduledPosts'), {
        userId: user.uid, caption, videoUrl: videoUrl || '',
        platforms: ttOn ? ['tiktok'] : [],
        scheduledFor: scheduledAt.toISOString(),
        scheduleMode: schedMode === 'immediate' ? 'queued' : 'scheduled',
        status: 'queued', createdAt: new Date().toISOString()
      });
      await loadQueue();
      // Says when, because it now actually happens. The queue used to be a list nothing
      // read: this said "Added to queue!" and the post was never sent.
      showAlert('Queued', !ttOn
        ? 'Saved to your queue. Connect TikTok to have it post automatically.'
        : schedMode === 'immediate'
          ? 'It will post to TikTok within about 5 minutes. You can see it on the Calendar.'
          : `It will post to TikTok on ${scheduledAt.toLocaleDateString()} at `
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

        {/* Post To */}
        <Text style={[styles.sectionLabel, { color: theme.subtext }]}>POST TO</Text>
        <View style={[styles.platformsCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.platformRow}>
            <View style={styles.platformIcon}><FacebookLogo size={22} /></View>
            <Text style={[styles.platformName, { color: theme.text }]}>Facebook</Text>
            <Text style={[styles.comingSoon, { color: theme.subtext }]}>Coming soon</Text>
            <View style={[styles.toggleOff, { backgroundColor: theme.divider }]} />
          </View>
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <View style={styles.platformRow}>
            <View style={styles.platformIcon}><InstagramLogo size={22} /></View>
            <Text style={[styles.platformName, { color: theme.text }]}>Instagram</Text>
            <Text style={[styles.comingSoon, { color: theme.subtext }]}>Coming soon</Text>
            <View style={[styles.toggleOff, { backgroundColor: theme.divider }]} />
          </View>
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <View style={styles.platformRow}>
            <View style={styles.platformIcon}><TikTokLogo size={22} /></View>
            <Text style={[styles.platformName, { color: theme.text }]}>TikTok</Text>
            {tiktokConnected ? (
              <Text style={styles.connectedText}>Connected</Text>
            ) : (
              <TouchableOpacity onPress={() => navigation.navigate('ConnectAccounts')}>
                <Text style={styles.connectLink}>Connect</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.toggle, { backgroundColor: theme.border }, ttOn && tiktokConnected && styles.toggleOn]}
              onPress={() => tiktokConnected ? setTtOn(!ttOn) : navigation.navigate('ConnectAccounts')}
            >
              <View style={[styles.toggleThumb, ttOn && tiktokConnected && styles.toggleThumbOn]} />
            </TouchableOpacity>
          </View>
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          {/* YouTube. Live, and a paid benefit - the diamond marks an offer, never a
              padlock, because everything gated here is on a plan that is for sale.
              The server refuses a free account inside the publisher regardless, so this
              is the explanation rather than the enforcement. */}
          <View style={styles.platformRow}>
            <View style={styles.platformIcon}><YouTubeLogo size={22} /></View>
            <Text style={[styles.platformName, { color: theme.text }]}>YouTube</Text>
            {isPremium && youtube?.connected
              ? <Text style={styles.connectedText}>Connected</Text>
              : null}
            {/* A button, not a toggle. A toggle states an intention and needs a second
                action to carry it out - and that second action was at the bottom of the
                screen, so flipping this appeared to do nothing. This runs the whole
                sequence: plan check, sign in if needed, upload. */}
            <TouchableOpacity
              style={[styles.ytBtn, !isPremium && styles.ytBtnLocked]}
              onPress={postToYouTube}
              disabled={ytPosting}
            >
              {ytPosting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  {!isPremium && <MaterialIcons name="diamond" size={11} color="#f5c451" />}
                  <Text style={styles.ytBtnText}>
                    {!isPremium ? 'Pro' : youtube?.connected ? 'Post' : 'Connect & post'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
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

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.btnQueue} onPress={saveToQueue} disabled={saving}>
            {saving ? <ActivityIndicator color="#2ecc71" size="small" />
              : <Text style={styles.btnQueueText}>{schedMode === 'later' ? 'Schedule' : 'Save to Queue'}</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnPost} onPress={postNow} disabled={posting}>
            {posting ? <ActivityIndicator color="#000" size="small" /> : <Text style={styles.btnPostText}>Post Now</Text>}
          </TouchableOpacity>
        </View>

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
  container: { flex: 1, backgroundColor: '#0a0a0a', paddingTop: STATUSBAR_HEIGHT },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#1a1a1a' },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  back: { color: '#2ecc71', fontSize: 15, fontWeight: '600' },
  title: { color: '#fff', fontSize: 16, fontWeight: '700' },
  scroll: { flex: 1, padding: 16 },
  schedRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  schedMode: { flex: 1, borderWidth: 1, borderRadius: 10, paddingVertical: 11, alignItems: 'center' },
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
