import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Alert, StatusBar
} from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { auth, db } from '../firebase';
import { doc, getDoc, addDoc, collection, getDocs, query, where } from 'firebase/firestore';

const BACKEND = 'https://api.fitlifesolutions.site';
const STATUSBAR_HEIGHT = StatusBar.currentHeight || 0;

function VideoPreview({ url }) {
  const player = useVideoPlayer(url, p => { p.loop = true; p.play(); });
  return <VideoView player={player} style={styles.video} allowsFullscreen />;
}

export default function EditPostVideoScreen({ navigation, route }) {
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

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a0a" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>✂️ Edit & Post Video</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Video Preview */}
        <Text style={styles.sectionLabel}>VIDEO PREVIEW</Text>
        <View style={styles.videoWrap}>
          {fullUrl ? <VideoPreview url={fullUrl} /> : (
            <View style={styles.noVideo}>
              <Text style={styles.noVideoIcon}>🎬</Text>
              <Text style={styles.noVideoText}>No video selected</Text>
              <TouchableOpacity onPress={() => navigation.navigate('IdeaToVideo')}>
                <Text style={styles.noVideoLink}>→ Create a video</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Caption */}
        <Text style={styles.sectionLabel}>CAPTION</Text>
        <TextInput
          style={styles.captionInput}
          value={caption}
          onChangeText={setCaption}
          placeholder="Enter your video caption... #TonefyAI"
          placeholderTextColor="#555"
          multiline
          numberOfLines={3}
        />

        {/* Post To */}
        <Text style={styles.sectionLabel}>POST TO</Text>
        <View style={styles.platformsCard}>
          <View style={styles.platformRow}>
            <Text style={styles.platformIcon}>📘</Text>
            <Text style={styles.platformName}>Facebook</Text>
            <Text style={styles.comingSoon}>Coming soon</Text>
            <View style={styles.toggleOff} />
          </View>
          <View style={styles.divider} />
          <View style={styles.platformRow}>
            <Text style={styles.platformIcon}>📷</Text>
            <Text style={styles.platformName}>Instagram</Text>
            <Text style={styles.comingSoon}>Coming soon</Text>
            <View style={styles.toggleOff} />
          </View>
          <View style={styles.divider} />
          <View style={styles.platformRow}>
            <Text style={styles.platformIcon}>🎵</Text>
            <Text style={styles.platformName}>TikTok</Text>
            {tiktokConnected ? (
              <Text style={styles.connectedText}>Connected</Text>
            ) : (
              <TouchableOpacity onPress={() => navigation.navigate('ConnectAccounts')}>
                <Text style={styles.connectLink}>Connect</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.toggle, ttOn && tiktokConnected && styles.toggleOn]}
              onPress={() => tiktokConnected ? setTtOn(!ttOn) : navigation.navigate('ConnectAccounts')}
            >
              <View style={[styles.toggleThumb, ttOn && tiktokConnected && styles.toggleThumbOn]} />
            </TouchableOpacity>
          </View>
          <View style={styles.divider} />
          <View style={styles.platformRow}>
            <Text style={styles.platformIcon}>✖️</Text>
            <Text style={styles.platformName}>X (Twitter)</Text>
            <Text style={styles.comingSoon}>Coming soon</Text>
            <View style={styles.toggleOff} />
          </View>
        </View>

        {/* AI Tip */}
        <View style={styles.aiTip}>
          <Text style={styles.aiTipIcon}>🤖</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.aiTipTitle}>AI Tip</Text>
            <Text style={styles.aiTipText}>Best time to post on TikTok is between 7–9 PM for maximum reach.</Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.btnQueue} onPress={saveToQueue} disabled={saving}>
            {saving ? <ActivityIndicator color="#2ecc71" size="small" /> : <Text style={styles.btnQueueText}>💾 Save to Queue</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnPost} onPress={postNow} disabled={posting}>
            {posting ? <ActivityIndicator color="#000" size="small" /> : <Text style={styles.btnPostText}>▶ Post Now</Text>}
          </TouchableOpacity>
        </View>

        {/* Recently Queued */}
        <Text style={styles.sectionLabel}>RECENTLY QUEUED</Text>
        {queue.length === 0 ? (
          <Text style={styles.emptyQueue}>No queued posts yet</Text>
        ) : queue.map(p => (
          <View key={p.id} style={styles.queueItem}>
            <Text style={styles.queueIcon}>🎬</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.queueCaption} numberOfLines={1}>{p.caption || 'Untitled'}</Text>
              <Text style={styles.queueMeta}>{new Date(p.scheduledFor).toLocaleDateString()} · {p.status}</Text>
              <Text style={styles.queuePlat}>→ {(p.platforms || []).join(', ') || 'No platform'}</Text>
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
  back: { color: '#2ecc71', fontSize: 15, fontWeight: '600' },
  title: { color: '#fff', fontSize: 16, fontWeight: '700' },
  scroll: { flex: 1, padding: 16 },
  sectionLabel: { color: '#888', fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8, marginTop: 16 },
  videoWrap: { backgroundColor: '#1a1a1a', borderRadius: 14, overflow: 'hidden', marginBottom: 4, minHeight: 200 },
  video: { width: '100%', height: 260 },
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
