import React, { useEffect, useState, useCallback } from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  StatusBar, Modal, ActivityIndicator, RefreshControl, ScrollView
} from 'react-native';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { auth, db } from '../firebase';
import { useTheme } from '../context/ThemeContext';
import { showAlert } from '../components/BrandedAlert';
import { saveVideoToDevice, downloadVideoToCache } from '../utils/saveVideo';
import ProgressRing from '../components/ProgressRing';
import ProgressButton from '../components/ProgressButton';
import { measureVideoDuration } from '../utils/videoDuration';

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

function VideoCard({ video, onPress, onUse, onDownload, downloading, downloadPct, preparing }) {
  const { theme } = useTheme();
  const url = video.downloadUrl || video.localUrl || '';
  const player = useVideoPlayer(url, (p) => {
    p.muted = true;
    p.loop = false;
  });

  return (
    <TouchableOpacity style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]} onPress={() => onPress(video)} activeOpacity={0.85}>
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
        <Text style={[styles.date, { color: theme.subtext }]}>{formatDate(video.createdAt)}</Text>
        <Text style={[styles.prompt, { color: theme.text }]} numberOfLines={1}>{video.prompt || 'Generated video'}</Text>
      </View>
      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.btnUse} onPress={() => onUse(video)} disabled={preparing}>
          {preparing
            ? <ActivityIndicator size="small" color="#04211f" />
            : <Text style={styles.btnUseText}>Use</Text>}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btnDl, { backgroundColor: theme.card, borderColor: theme.border }]}
          onPress={() => onDownload(video)}
          disabled={downloading}
        >
          {/* A ring rather than a spinner: same footprint, but it says how far. */}
          {downloading
            ? <ProgressRing progress={downloadPct} size={30} stroke={2.5} iconSize={14} iconColor="#2ecc71" />
            : <MaterialIcons name="file-download" size={18} color={theme.icon} />}
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

export default function MyVideosScreen({ navigation }) {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [allVideos, setAllVideos] = useState([]);
  const [filtered, setFiltered] = useState([]);
  // The id of the video being fetched, so only its own button shows a spinner.
  const [downloading, setDownloading] = useState(null);
  const [downloadPct, setDownloadPct] = useState(0);
  // Fetching a finished video so the editor can open it as a clip.
  const [preparing, setPreparing] = useState(null);
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

  // Opens the finished video in the editor as a clip, to be trimmed, captioned,
  // cut against other footage or re-exported at a different aspect.
  //
  // It used to navigate to Idea-to-Video with a `reuseVideoUrl` param that NOTHING
  // read - so the video was dropped and you landed on an empty generator screen. The
  // button looked finished and did nothing.
  //
  // The file is fetched first rather than handing the editor a URL, because a clip
  // has to be a real local file: processVideo builds its upload straight from
  // `item.uri` for every item, and maps the server's replies back by position, so a
  // remote uri in that list would upload nothing usable and shift everything after
  // it.
  async function handleUse(video) {
    const url = video.downloadUrl || video.localUrl;
    if (!url) return showAlert('Use video', 'This video has no file to open.');
    if (preparing) return;
    setPreparing(video.id);
    try {
      const uri = await downloadVideoToCache(url, video);
      // The record carries durationSeconds only for videos made by the two newer
      // export paths; anything from Idea-to-Video predates it. Measured on device
      // when it is missing, because a clip whose length is unknown falls back to 3s
      // everywhere it is drawn, played and exported.
      const known = Number(video.durationSeconds) > 0 ? Number(video.durationSeconds) : null;
      const seconds = known || (await measureVideoDuration(uri));
      setModalVisible(false);
      navigation.navigate('EditVideo', {
        useVideo: {
          uri,
          seconds: seconds || null,
          fileName: `tonefy_${video.id}.mp4`,
          prompt: video.prompt || '',
        },
      });
    } catch (e) {
      showAlert('Use video', e.message || 'Could not open this video in the editor.');
    } finally {
      setPreparing(null);
    }
  }

  // Was Linking.openURL(url), which handed the video to the phone's browser and left
  // the user to download it from there - technically a download, and nothing like what
  // the button says. Now fetches the file and either saves it straight to the gallery
  // or offers the share sheet, depending on what the installed build can do.
  async function handleDownload(video) {
    const url = video.downloadUrl || video.localUrl;
    if (!url) return showAlert('Download', 'This video has no file to download.');
    if (downloading) return;
    setDownloading(video.id);
    try {
      setDownloadPct(0);
      const { method } = await saveVideoToDevice(url, video, setDownloadPct);
      if (method === 'gallery') {
        showAlert('Saved', 'The video is in your gallery.');
      }
      // The share sheet is its own confirmation: it opens, the user picks somewhere,
      // it closes. An alert on top of that is a tap of pure noise.
    } catch (e) {
      showAlert('Download failed', e.message || 'Could not download this video.');
    } finally {
      setDownloading(null);
    }
  }

  const totalMB = (allVideos.reduce((s, v) => s + (v.size || 0), 0) / 1024 / 1024).toFixed(1);
  const now = new Date();
  const thisMonth = allVideos.filter((v) => {
    const d = new Date(v.createdAt);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  return (
    <View style={[styles.container, { backgroundColor: theme.bg, paddingTop: insets.top }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.bg} />
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backRow}>
          <MaterialIcons name="arrow-back" size={20} color={theme.icon} />
          <Text style={styles.backBtn}>Back</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>My Videos</Text>
        <Text style={styles.totalCount}>{allVideos.length} videos</Text>
      </View>

      <View style={styles.statsRow}>
        {/* numberOfLines + adjustsFontSizeToFit so a value shrinks rather than wrapping.
            "26.5MB" was breaking across two lines as "26.5M" / "B" on a device with a
            larger system font scale, which reads as a rendering fault rather than a
            number. */}
        <View style={[styles.statCard, { backgroundColor: theme.card, borderColor: theme.border }]}><Text style={styles.statNum} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{allVideos.length}</Text><Text style={[styles.statLabel, { color: theme.subtext }]} numberOfLines={1}>Total</Text></View>
        <View style={[styles.statCard, { backgroundColor: theme.card, borderColor: theme.border }]}><Text style={styles.statNum} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{thisMonth}</Text><Text style={[styles.statLabel, { color: theme.subtext }]} numberOfLines={1}>This Month</Text></View>
        <View style={[styles.statCard, { backgroundColor: theme.card, borderColor: theme.border }]}><Text style={styles.statNum} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{totalMB}MB</Text><Text style={[styles.statLabel, { color: theme.subtext }]} numberOfLines={1}>Stored</Text></View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterRow}
        contentContainerStyle={styles.filterRowContent}
      >
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterBtn, { borderColor: theme.border }, activeFilter === f.key && styles.filterBtnActive]}
            onPress={() => handleFilterPress(f.key)}
          >
            <Text style={[styles.filterText, { color: theme.subtext }, activeFilter === f.key && styles.filterTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <Text style={[styles.emptyText, { color: theme.subtext }]}>Loading your videos...</Text>
      ) : filtered.length === 0 ? (
        <View style={styles.emptyState}>
          <MaterialIcons name="movie" size={48} color={theme.border} style={styles.emptyIcon} />
          <Text style={[styles.emptyTitle, { color: theme.text }]}>No videos yet</Text>
          <Text style={[styles.emptySub, { color: theme.subtext }]}>Generate your first AI video</Text>
          <TouchableOpacity style={styles.createBtn} onPress={() => navigation.navigate('IdeaToVideo')}>
            <Text style={styles.createBtnText}>Create Video</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          style={styles.list}
          data={filtered}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={{ gap: 12 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2ecc71" />}
          renderItem={({ item }) => (
            <VideoCard video={item} onPress={openModal} onUse={handleUse} onDownload={handleDownload} downloading={downloading === item.id} downloadPct={downloadPct} preparing={preparing === item.id} />
          )}
        />
      )}

      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={closeModal}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            {selected && (
              <VideoView player={modalPlayer} style={styles.modalVideo} nativeControls contentFit="contain" />
            )}
            <Text style={[styles.modalInfo, { color: theme.subtext }]}>
              {(selected?.prompt || 'Generated video')} · {selected?.aspectRatio || ''} · {formatDate(selected?.createdAt)}
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalBtnOutline, { borderColor: theme.border }]} onPress={closeModal}>
                <Text style={[styles.modalBtnOutlineText, { color: theme.text }]}>Close</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBtnGreen} onPress={() => selected && handleUse(selected)} disabled={!!preparing}>
                {preparing
                  ? <ActivityIndicator size="small" color="#04211f" />
                  : <Text style={styles.modalBtnGreenText}>Use This</Text>}
              </TouchableOpacity>
              {/* Outline rather than solid: it fills left-to-right like every other
                  download in the app, but must not out-shout "Use This" beside it. */}
              <ProgressButton
                variant="outline"
                label={downloading ? `${downloadPct}%` : 'Download'}
                progress={downloadPct}
                busy={!!downloading}
                borderColor={theme.border}
                textColor={theme.text}
                style={styles.modalBtnProgress}
                labelStyle={styles.modalBtnProgressLabel}
                onPress={() => selected && handleDownload(selected)}
              />
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
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backBtn: { color: '#2ecc71', fontSize: 15, fontWeight: '600' },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: '700' },
  totalCount: { color: '#2ecc71', fontSize: 12 },
  statsRow: { flexDirection: 'row', gap: 10, padding: 16, paddingBottom: 0 },
  statCard: { flex: 1, backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 14, padding: 14, alignItems: 'center' },
  statNum: { color: '#2ecc71', fontSize: 22, fontWeight: '800' },
  statLabel: { color: '#888', fontSize: 11, marginTop: 4 },
  // Three things had to be right together, and removing the old `maxHeight: 44`
  // alone was not enough - the row still clipped.
  //
  // 1. `paddingHorizontal` belongs in contentContainerStyle, not here. On a
  //    ScrollView, `style` is the outer clipping box: padding there shrinks the
  //    visible area rather than insetting the content.
  // 2. The chips needed `alignItems: 'center'`. A ScrollView's content container
  //    defaults to `stretch`, so each chip took the row's height instead of
  //    defining it - which is why they came out squashed and cut through the
  //    middle rather than simply overflowing.
  // 3. flexShrink: 0, so a tall list below can never compress the row.
  //
  // The FlatList also now carries flex: 1. Without it a long grid makes the column
  // over-constrained, and the row is what gives way.
  filterRow: { marginTop: 16, marginBottom: 4, flexGrow: 0, flexShrink: 0 },
  filterRowContent: { paddingHorizontal: 16, alignItems: 'center', paddingVertical: 2 },
  filterBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#2a2a2a', marginRight: 8 },
  filterBtnActive: { backgroundColor: '#2ecc71', borderColor: '#2ecc71' },
  filterText: { color: '#888', fontSize: 13, fontWeight: '600' },
  filterTextActive: { color: '#000' },
  // Takes the space left under the filter row. Without it a long grid over-constrains
  // the column and the row above is what gets compressed.
  list: { flex: 1 },
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
  // Height/radius matched to its two neighbours by hand - ProgressButton's own 54pt
  // default is sized for a full-width primary, not a third of a modal footer.
  modalBtnProgress: { flex: 1, minHeight: 46, borderRadius: 25 },
  modalBtnProgressLabel: { fontSize: 13 },
  modalBtnGreenText: { color: '#000', fontSize: 13, fontWeight: '700' },
});
