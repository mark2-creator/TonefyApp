import React, { useEffect, useState, useCallback } from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  StatusBar, Modal, Linking, RefreshControl, ScrollView
} from 'react-native';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { useVideoPlayer, VideoView } from 'expo-video';
import { auth, db } from '../firebase';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: '9:16', label: 'TikTok 9:16' },
  { key: '16:9', label: 'YouTube 16:9' },
  { key: '1:1', label: 'Square 1:1' },
];

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

function VideoCard({ video, onPress, onUse, onDownload }) {
  const url = video.downloadUrl || video.localUrl || '';
  const player = useVideoPlayer(url, (p) => {
    p.muted = true;
    p.loop = false;
  });

  return (
    <TouchableOpacity style={styles.card} onPress={() => onPress(video)} activeOpacity={0.85}>
      <View style={styles.thumbWrap}>
        <VideoView
          player={player}
          style={styles.thumb}
          contentFit="cover"
          nativeControls={false}
          pointerEvents="none"
        />
        <MaterialIcons name="play-arrow" size={28} color="#fff" style={styles.playIcon} />
      </View>
      <View style={styles.info}>
        <Text style={styles.date}>{formatDate(video.createdAt)}</Text>
        <Text style={styles.prompt} numberOfLines={1}>{video.prompt || 'Generated video'}</Text>
      </View>
      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.btnUse} onPress={() => onUse(video)}>
          <Text style={styles.btnUseText}>Use</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnDl} onPress={() => onDownload(video)}>
          <MaterialIcons name="file-download" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

export default function MyVideosScreen({ navigation }) {
  const [allVideos, setAllVideos] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [activeFilter, setActiveFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);

  const modalPlayer = useVideoPlayer(selected?.downloadUrl || selected?.localUrl || '', (p) => {
    p.loop = false;
  });

  const loadVideos = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      const q = query(
        collection(db, 'userVideos'),
        where('userId', '==', user.uid)
      );
      const snap = await getDocs(q);
      const videos = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setAllVideos(videos);
      applyFilter(activeFilter, videos);
    } catch (e) {
      console.log('loadVideos error:', e.message);
      setAllVideos([]);
      setFiltered([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeFilter]);

  useEffect(() => { loadVideos(); }, []);

  function applyFilter(filterKey, source) {
    const list = source || allVideos;
    setFiltered(filterKey === 'all' ? list : list.filter((v) => v.aspectRatio === filterKey));
  }

  function handleFilterPress(key) {
    setActiveFilter(key);
    applyFilter(key);
  }

  function onRefresh() {
    setRefreshing(true);
    loadVideos();
  }

  function openModal(video) {
    setSelected(video);
    setModalVisible(true);
  }

  function closeModal() {
    setModalVisible(false);
    modalPlayer.pause();
  }

  function handleUse(video) {
    setModalVisible(false);
    // NOTE: edit-post-video flow doesn't exist in the app yet —
    // passing the video through to Idea-to-Video as a placeholder for now.
    navigation.navigate('IdeaToVideo', { reuseVideoUrl: video.downloadUrl || video.localUrl });
  }

  function handleDownload(video) {
    const url = video.downloadUrl || video.localUrl;
    if (url) Linking.openURL(url);
  }

  const totalMB = (allVideos.reduce((s, v) => s + (v.size || 0), 0) / 1024 / 1024).toFixed(1);
  const now = new Date();
  const thisMonth = allVideos.filter((v) => {
    const d = new Date(v.createdAt);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a0a" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={20} color="#888" />
            <Text style={styles.backBtn}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Videos</Text>
        <Text style={styles.totalCount}>{allVideos.length} videos</Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}><Text style={styles.statNum}>{allVideos.length}</Text><Text style={styles.statLabel}>Total</Text></View>
        <View style={styles.statCard}><Text style={styles.statNum}>{thisMonth}</Text><Text style={styles.statLabel}>This Month</Text></View>
        <View style={styles.statCard}><Text style={styles.statNum}>{totalMB}MB</Text><Text style={styles.statLabel}>Stored</Text></View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterBtn, activeFilter === f.key && styles.filterBtnActive]}
            onPress={() => handleFilterPress(f.key)}
          >
            <Text style={[styles.filterText, activeFilter === f.key && styles.filterTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <Text style={styles.emptyText}>Loading your videos...</Text>
      ) : filtered.length === 0 ? (
        <View style={styles.emptyState}>
          <MaterialIcons name="movie" size={48} color="#333" style={styles.emptyIcon} />
          <Text style={styles.emptyTitle}>No videos yet</Text>
          <Text style={styles.emptySub}>Generate your first AI video</Text>
          <TouchableOpacity style={styles.createBtn} onPress={() => navigation.navigate('IdeaToVideo')}>
            <Text style={styles.createBtnText}>Create Video</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={{ gap: 12 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2ecc71" />}
          renderItem={({ item }) => (
            <VideoCard video={item} onPress={openModal} onUse={handleUse} onDownload={handleDownload} />
          )}
        />
      )}

      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={closeModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selected && (
              <VideoView player={modalPlayer} style={styles.modalVideo} nativeControls contentFit="contain" />
            )}
            <Text style={styles.modalInfo}>
              {(selected?.prompt || 'Generated video')} · {selected?.aspectRatio || ''} · {formatDate(selected?.createdAt)}
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalBtnOutline} onPress={closeModal}>
                <Text style={styles.modalBtnOutlineText}>Close</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBtnGreen} onPress={() => selected && handleUse(selected)}>
                <Text style={styles.modalBtnGreenText}>Use This</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBtnOutline} onPress={() => selected && handleDownload(selected)}>
                <Text style={styles.modalBtnOutlineText}>Download</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#2a2a2a' },
  backBtn: { color: '#2ecc71', fontSize: 15, fontWeight: '600' },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: '700' },
  totalCount: { color: '#2ecc71', fontSize: 12 },
  statsRow: { flexDirection: 'row', gap: 10, padding: 16, paddingBottom: 0 },
  statCard: { flex: 1, backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 14, padding: 14, alignItems: 'center' },
  statNum: { color: '#2ecc71', fontSize: 22, fontWeight: '800' },
  statLabel: { color: '#888', fontSize: 11, marginTop: 4 },
  filterRow: { paddingHorizontal: 16, marginTop: 16, marginBottom: 4, maxHeight: 44 },
  filterBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#2a2a2a', marginRight: 8 },
  filterBtnActive: { backgroundColor: '#2ecc71', borderColor: '#2ecc71' },
  filterText: { color: '#888', fontSize: 13, fontWeight: '600' },
  filterTextActive: { color: '#000' },
  grid: { padding: 16, gap: 12 },
  card: { flex: 1, backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 12, overflow: 'hidden', marginBottom: 12 },
  thumbWrap: { width: '100%', aspectRatio: 9 / 16, backgroundColor: '#111', justifyContent: 'center', alignItems: 'center' },
  thumb: { width: '100%', height: '100%' },
  playIcon: { position: 'absolute', fontSize: 28, opacity: 0.85 },
  info: { padding: 10 },
  date: { color: '#888', fontSize: 11, marginBottom: 4 },
  prompt: { color: '#fff', fontSize: 13, fontWeight: '600' },
  actionsRow: { flexDirection: 'row', gap: 6, paddingHorizontal: 10, paddingBottom: 10 },
  btnUse: { flex: 1, backgroundColor: '#2ecc71', borderRadius: 20, paddingVertical: 8, alignItems: 'center' },
  btnUseText: { color: '#000', fontSize: 12, fontWeight: '700' },
  btnDl: { backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 20, paddingVertical: 8, paddingHorizontal: 12 },
  btnDlText: { color: '#fff', fontSize: 12 },
  emptyText: { color: '#888', textAlign: 'center', marginTop: 40 },
  emptyState: { alignItems: 'center', padding: 40 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 6 },
  emptySub: { color: '#888', fontSize: 13 },
  createBtn: { backgroundColor: '#2ecc71', borderRadius: 25, paddingHorizontal: 24, paddingVertical: 12, marginTop: 12 },
  createBtnText: { color: '#000', fontWeight: '700', fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { width: '100%', maxWidth: 400, backgroundColor: '#1a1a1a', borderRadius: 20, overflow: 'hidden' },
  modalVideo: { width: '100%', height: 400, backgroundColor: '#000' },
  modalInfo: { color: '#888', fontSize: 13, padding: 16 },
  modalActions: { flexDirection: 'row', gap: 10, padding: 16, paddingTop: 0 },
  modalBtnOutline: { flex: 1, borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 25, paddingVertical: 13, alignItems: 'center' },
  modalBtnOutlineText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  modalBtnGreen: { flex: 1, backgroundColor: '#2ecc71', borderRadius: 25, paddingVertical: 13, alignItems: 'center' },
  modalBtnGreenText: { color: '#000', fontSize: 13, fontWeight: '700' },
});
