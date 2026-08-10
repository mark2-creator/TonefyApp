import React, { useState, useEffect } from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Alert, StatusBar
} from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { TikTokLogo, InstagramLogo, FacebookLogo } from '../components/BrandLogos';
import { auth, db } from '../firebase';
import { doc, getDoc, addDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { useTheme } from '../context/ThemeContext';

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
  const { videoUrl, videoPath } = route.params || {};
  const [caption, setCaption] = useState('');
  const [tiktokConnected, setTiktokConnected] = useState(false);
  const [tiktokOpenId, setTiktokOpenId] = useState(null);
  const [tiktokName, setTiktokName] = useState('');
  const [ttOn, setTtOn] = useState(false);
  const [schedMode, setSchedMode] = useState('immediate');
  const [posting, setPosting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [queue, setQueue] = useState([]);
  const user = auth.currentUser;

  useEffect(() => {
    loadTikTok();
    loadQueue();
  }, []);

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

  async function postNow() {
    if (!videoPath) { Alert.alert('Error', 'No video to post'); return; }
    if (!ttOn) { Alert.alert('Error', 'Enable at least one platform'); return; }
    if (!tiktokOpenId) { Alert.alert('Error', 'Connect TikTok first'); return; }
    setPosting(true);
    try {
      const token = await user.getIdToken();
      const r = await fetch(`${BACKEND}/tiktok/post-video`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ openId: tiktokOpenId, videoUrl: `${BACKEND}${videoPath}`, title: caption })
      });
      const d = await r.json();
      if (d.error) throw new Error(d.error);
      await addDoc(collection(db, 'scheduledPosts'), {
        userId: user.uid, caption, videoUrl: `${BACKEND}${videoPath}`,
        platforms: ['tiktok'], scheduledFor: new Date().toISOString(),
        scheduleMode: 'immediate', status: 'posted', createdAt: new Date().toISOString()
      });
      Alert.alert('Success', 'Posted to TikTok!', [{ text: 'OK', onPress: () => navigation.navigate('Calendar') }]);
    } catch (e) { Alert.alert('Error', e.message); }
    setPosting(false);
  }

  async function saveToQueue() {
    setSaving(true);
    try {
      await addDoc(collection(db, 'scheduledPosts'), {
        userId: user.uid, caption, videoUrl: videoUrl || '',
        platforms: ttOn ? ['tiktok'] : [],
        scheduledFor: new Date().toISOString(),
        scheduleMode: 'queued', status: 'queued', createdAt: new Date().toISOString()
      });
      await loadQueue();
      Alert.alert('Saved', 'Added to queue!');
    } catch (e) { Alert.alert('Error', e.message); }
    setSaving(false);
  }

  const fullUrl = videoUrl ? (videoUrl.startsWith('http') ? videoUrl : `${BACKEND}${videoUrl}`) : null;

  // Getting the finished video off the phone's screen and into the phone.
  //
  // This downloads it and hands it to the system share sheet, which is where "Save to
  // Files", "Save video" and every messaging app live. It is not a one-tap write into
  // the gallery: that needs expo-media-library, which is not installed, and adding a
  // native module cannot be done over the air - it would need a new build of the app.
  // The share sheet is the honest thing that works today.
  const [downloading, setDownloading] = useState(false);
  async function downloadVideo() {
    if (!fullUrl || downloading) return;
    setDownloading(true);
    try {
      const name = (videoPath || fullUrl).split('/').pop().split('?')[0] || 'tonefy-video.mp4';
      const target = new File(Paths.cache, name);
      // A previous download of the same export would otherwise collide.
      try { if (target.exists) target.delete(); } catch {}
      const file = await File.downloadFileAsync(fullUrl, target);
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert('Saved', `Downloaded to the app's storage as ${name}.`);
        return;
      }
      await Sharing.shareAsync(file.uri, {
        mimeType: 'video/mp4',
        dialogTitle: 'Save or share your video',
        UTI: 'public.movie',
      });
    } catch (e) {
      Alert.alert('Download failed', e?.message || 'Could not download the video.');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
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
          <TouchableOpacity style={styles.downloadBtn} onPress={downloadVideo} disabled={downloading}>
            {downloading
              ? <ActivityIndicator size="small" color="#04211f" />
              : <MaterialIcons name="file-download" size={20} color="#04211f" />}
            <Text style={styles.downloadText}>
              {downloading ? 'Preparing…' : 'Save video'}
            </Text>
          </TouchableOpacity>
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

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.btnQueue} onPress={saveToQueue} disabled={saving}>
            {saving ? <ActivityIndicator color="#2ecc71" size="small" /> : <Text style={styles.btnQueueText}>Save to Queue</Text>}
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
  container: { flex: 1, backgroundColor: '#0a0a0a', paddingTop: STATUSBAR_HEIGHT },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#1a1a1a' },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  back: { color: '#2ecc71', fontSize: 15, fontWeight: '600' },
  title: { color: '#fff', fontSize: 16, fontWeight: '700' },
  scroll: { flex: 1, padding: 16 },
  sectionLabel: { color: '#888', fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8, marginTop: 16 },
  videoWrap: { backgroundColor: '#1a1a1a', borderRadius: 14, overflow: 'hidden', marginBottom: 4, minHeight: 200 },
  video: { width: '100%', height: 260, backgroundColor: '#000' },
  playFab: {
    position: 'absolute', left: 12, bottom: 12, width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#2ECC71', alignItems: 'center', justifyContent: 'center',
  },
  videoLoading: { position: 'absolute', right: 14, bottom: 22 },
  downloadBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#2ECC71', borderRadius: 12, paddingVertical: 13, marginTop: 10,
  },
  downloadText: { color: '#04211f', fontSize: 14, fontWeight: '700' },
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
