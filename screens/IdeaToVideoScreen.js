import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, StatusBar,
  Modal, FlatList, SafeAreaView
} from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

const STATUSBAR_HEIGHT = StatusBar.currentHeight || 0;
const BACKEND = 'https://api.fitlifesolutions.site';

const VOICES = [
  { id: 'gtts-us',    label: 'Sarah',   accent: 'US Female',   icon: '🇺🇸' },
  { id: 'gtts-uk',    label: 'Emma',    accent: 'UK Female',   icon: '🇬🇧' },
  { id: 'gtts-au',    label: 'Olivia',  accent: 'AU Female',   icon: '🇦🇺' },
  { id: 'edge-guy',   label: 'Guy',     accent: 'US Male',     icon: '🇺🇸' },
  { id: 'edge-ryan',  label: 'Ryan',    accent: 'UK Male',     icon: '🇬🇧' },
  { id: 'edge-brian', label: 'Brian',   accent: 'Deep Male',   icon: '🎙️' },
  { id: 'edge-aria',  label: 'Aria',    accent: 'US Female 2', icon: '🇺🇸' },
  { id: 'edge-sonia', label: 'Sonia',   accent: 'UK Female 2', icon: '🇬🇧' },
];

const ASPECT_RATIOS = [
  { id: '16:9', label: '16:9', icon: '🖥️', desc: 'YouTube' },
  { id: '9:16', label: '9:16', icon: '📱', desc: 'TikTok/Reels' },
  { id: '1:1',  label: '1:1',  icon: '⬛', desc: 'Instagram' },
];

const CAPTION_STYLES = [
  { id: 'classic',  label: 'Classic',  desc: 'White + black outline',   color: '#fff',    bg: 'transparent', bold: false, shadow: false },
  { id: 'tiktok',   label: 'TikTok',   desc: 'Bold yellow, thick stroke',color: '#FFD700', bg: 'transparent', bold: true,  shadow: true  },
  { id: 'bold',     label: 'Bold',     desc: 'Large white, heavy stroke', color: '#fff',    bg: 'transparent', bold: true,  shadow: true  },
  { id: 'neon',     label: 'Neon',     desc: 'Glowing green text',       color: '#00FF7F', bg: 'transparent', bold: true,  shadow: true  },
  { id: 'fire',     label: 'Fire',     desc: 'Burning orange text',      color: '#FF6600', bg: 'transparent', bold: true,  shadow: true  },
  { id: 'minimal',  label: 'Minimal',  desc: 'Small clean white text',   color: '#fff',    bg: 'transparent', bold: false, shadow: false },
];

async function fetchWithTimeout(url, options, timeoutMs = 300000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timer);
    return res;
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') throw new Error('Request timed out after ' + Math.round(timeoutMs / 1000) + 's');
    throw err;
  }
}

const ProgressBar = ({ progress, label }) => (
  <View style={styles.progressBarContainer}>
    <View style={styles.progressBarBg}>
      <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
    </View>
    <Text style={styles.progressText}>{label} {Math.round(progress)}%</Text>
  </View>
);

const StepDots = ({ current, total }) => (
  <View style={styles.dotsRow}>
    {Array.from({ length: total }).map((_, i) => (
      <View key={i} style={[styles.dot, i < current && styles.dotActive]} />
    ))}
  </View>
);

function SelectorRow({ icon, label, value, onPress }) {
  return (
    <TouchableOpacity style={styles.selectorRow} onPress={onPress}>
      <Text style={styles.selectorIcon}>{icon}</Text>
      <Text style={styles.selectorLabel}>{label}</Text>
      <Text style={styles.selectorValue}>{value}</Text>
      <Text style={styles.selectorChevron}>›</Text>
    </TouchableOpacity>
  );
}

function CaptionOptionRow({ item, selectedId, onSelect, onClose }) {
  const isCaption = item.color !== undefined && item.icon === undefined;
  return (
    <TouchableOpacity
      style={[styles.optionRow, selectedId === item.id && styles.optionRowActive]}
      onPress={() => { onSelect(item.id); onClose(); }}
    >
      {isCaption ? (
        <View style={styles.captionPreviewBox}>
          <Text style={[
            styles.captionPreviewText,
            { color: item.color, fontWeight: item.bold ? 'bold' : 'normal' },
            item.shadow && { textShadowColor: '#000', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 4 },
          ]}>Caption</Text>
        </View>
      ) : (
        <Text style={styles.optionIcon}>{item.icon || item.preview}</Text>
      )}
      <View style={styles.optionText}>
        <Text style={[styles.optionLabel, selectedId === item.id && styles.optionLabelActive]}>{item.label}</Text>
        <Text style={styles.optionDesc}>{item.accent || item.desc}</Text>
      </View>
      {selectedId === item.id && <Text style={styles.optionCheck}>✓</Text>}
    </TouchableOpacity>
  );
}

function OptionModal({ visible, title, options, selectedId, onSelect, onClose }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>{title}</Text>
          <FlatList
            data={options}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <CaptionOptionRow item={item} selectedId={selectedId} onSelect={onSelect} onClose={onClose} />
            )}
          />
        </View>
      </TouchableOpacity>
    </Modal>
  );
}function VideoPlayer({ videoUrl }) {
  const player = useVideoPlayer(videoUrl, p => { p.loop = true; p.play(); });
  return <VideoView player={player} style={styles.videoPlayer} allowsFullscreen allowsPictureInPicture />;
}

export default function IdeaToVideoScreen({ navigation }) {
  const [step, setStep] = useState(1);
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState('9:16');
  const [voiceId, setVoiceId] = useState('gtts-us');
  const [captionStyle, setCaptionStyle] = useState('classic');
  const [script, setScript] = useState('');
  const [audioUrl, setAudioUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [progress, setProgress] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [modal, setModal] = useState(null); // 'voice' | 'ratio' | 'caption'
  const progressInterval = useRef(null);

  const selectedVoice = VOICES.find(v => v.id === voiceId);
  const selectedRatio = ASPECT_RATIOS.find(r => r.id === aspectRatio);
  const selectedCaption = CAPTION_STYLES.find(c => c.id === captionStyle);

  const startProgress = (start, end, duration) => {
    if (progressInterval.current) clearInterval(progressInterval.current);
    setProgress(start);
    const steps = 30;
    const increment = (end - start) / steps;
    const delay = duration / steps;
    let current = start;
    progressInterval.current = setInterval(() => {
      current += increment;
      if (current >= end) { clearInterval(progressInterval.current); setProgress(end); }
      else setProgress(Math.round(current));
    }, delay);
  };

  const stopProgress = (v = 100) => { if (progressInterval.current) clearInterval(progressInterval.current); setProgress(v); };
  const resetLoading = () => { stopProgress(0); setLoading(false); setLoadingMsg(''); setProgress(0); };

  const generateScript = async () => {
    if (!prompt.trim()) return Alert.alert('Error', 'Enter a prompt first');
    setLoading(true); setLoadingMsg('Generating script with AI...');
    startProgress(0, 90, 4000);
    try {
      const res = await fetchWithTimeout(`${BACKEND}/api/generate-script`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      }, 30000);
      const data = await res.json();
      stopProgress(100);
      if (data.script) { setScript(data.script); setStep(2); }
      else Alert.alert('Error', data.error || 'Failed to generate script');
    } catch (err) { Alert.alert('Error', err.message); }
    resetLoading();
  };

  const generateVoiceover = async () => {
    if (!script.trim()) return Alert.alert('Error', 'Script is empty');
    setLoading(true); setLoadingMsg('Generating AI voiceover...');
    startProgress(0, 90, 20000);
    try {
      const res = await fetchWithTimeout(`${BACKEND}/api/generate-audio`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: script, voiceId }),
      }, 60000);
      const data = await res.json();
      stopProgress(100);
      if (data.audioUrl) { setAudioUrl(data.audioUrl); setStep(3); }
      else Alert.alert('Error', data.error || 'Failed to generate voiceover');
    } catch (err) { Alert.alert('Error', err.message); }
    resetLoading();
  };

  const generateVideo = async () => {
    setLoading(true);
    try {
      setLoadingMsg('Analyzing script...'); startProgress(0, 15, 3000);
      const kwRes = await fetchWithTimeout(`${BACKEND}/api/extract-keywords`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: script }),
      }, 15000);
      const kwData = await kwRes.json();
      const keywords = kwData.keywords || [prompt];

      setLoadingMsg('Fetching video clips...'); startProgress(15, 30, 5000);
      const searchRes = await fetchWithTimeout(`${BACKEND}/api/search-pexels-videos`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: prompt, keywords }),
      }, 20000);
      const searchData = await searchRes.json();
      if (!searchData.videos?.length) { Alert.alert('Error', 'No videos found'); resetLoading(); return; }

      setLoadingMsg('Starting video generation...'); startProgress(30, 40, 3000);
      const mergeRes = await fetchWithTimeout(`${BACKEND}/api/idea-to-video`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt, voiceover: script,
          selectedVideos: searchData.videos.slice(0, 3),
          audioUrl, aspectRatio, captionStyle,
        }),
      }, 15000);
      const { jobId, error: jobError } = await mergeRes.json();
      if (!jobId) { Alert.alert('Error', jobError || 'Failed to start job'); resetLoading(); return; }

      // Poll for job completion
      setLoadingMsg('Generating your video...'); startProgress(40, 95, 120000);
      const result = await new Promise((resolve, reject) => {
        const interval = setInterval(async () => {
          try {
            const pollRes = await fetch(`${BACKEND}/api/job/${jobId}`);
            const job = await pollRes.json();
            if (job.message) setLoadingMsg(job.message);
            if (job.progress) setProgress(job.progress);
            if (job.status === 'done') { clearInterval(interval); resolve(job); }
            else if (job.status === 'failed') { clearInterval(interval); reject(new Error(job.message)); }
          } catch (e) { clearInterval(interval); reject(e); }
        }, 3000);
        setTimeout(() => { clearInterval(interval); reject(new Error('Video generation timed out')); }, 300000);
      });

      stopProgress(100);
      if (result.videoUrl) { setVideoUrl(result.videoUrl); setStep(4); }
      else Alert.alert('Error', 'Failed to generate video');
    } catch (err) { stopProgress(0); Alert.alert('Error', err.message); }
    resetLoading();
  };

  const fullVideoUrl = videoUrl ? `${BACKEND}${videoUrl}` : null;

  const copyLink = async () => {
    await Clipboard.setStringAsync(fullVideoUrl);
    Alert.alert('Copied!', 'Video link copied to clipboard.');
  };

  const downloadVideo = async () => {
    if (!fullVideoUrl) return;
    setDownloading(true);
    try {
      const filename = `tonefy-${Date.now()}.mp4`;
      const localUri = FileSystem.documentDirectory + filename;
      const { uri } = await FileSystem.downloadAsync(fullVideoUrl, localUri);
      setDownloading(false);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'video/mp4', dialogTitle: 'Save or share your video' });
      } else {
        Alert.alert('Saved', `Video saved to: ${uri}`);
      }
    } catch (err) { setDownloading(false); Alert.alert('Error', 'Download failed: ' + err.message); }
  };

  const resetAll = () => {
    setStep(1); setPrompt(''); setScript(''); setAudioUrl('');
    setVideoUrl(''); setProgress(0); setLoadingMsg('');
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a0a" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Idea to Video</Text>
        <Text style={styles.stepCount}>{step}/4</Text>
      </View>
      <StepDots current={step} total={4} />

      {/* STEP 1 */}
      {step === 1 && (
        <View style={styles.stepContainer}>
          <Text style={styles.stepTitle}>💡 Your Idea</Text>
          <Text style={styles.stepSub}>What do you want your video to be about?</Text>
          <TextInput
            style={styles.textArea}
            placeholder="e.g. A motivational video about morning routines..."
            placeholderTextColor="#555"
            value={prompt}
            onChangeText={setPrompt}
            multiline
            numberOfLines={4}
          />
          <View style={styles.selectorsCard}>
            <SelectorRow icon="🎙️" label="Voice" value={`${selectedVoice.icon} ${selectedVoice.label} · ${selectedVoice.accent}`} onPress={() => setModal('voice')} />
            <View style={styles.divider} />
            <SelectorRow icon="📐" label="Format" value={`${selectedRatio.icon} ${selectedRatio.label} · ${selectedRatio.desc}`} onPress={() => setModal('ratio')} />
            <View style={styles.divider} />
            <SelectorRow icon="💬" label="Captions" value={`${selectedCaption.preview} ${selectedCaption.label} · ${selectedCaption.desc}`} onPress={() => setModal('caption')} />
          </View>
          {loading && <ProgressBar progress={progress} label={loadingMsg} />}
          <TouchableOpacity style={[styles.btn, (loading || !prompt.trim()) && styles.btnDisabled]} onPress={generateScript} disabled={loading || !prompt.trim()}>
            {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.btnText}>✨ Generate Script</Text>}
          </TouchableOpacity>
        </View>
      )}

      {/* STEP 2 */}
      {step === 2 && (
        <View style={styles.stepContainer}>
          <Text style={styles.stepTitle}>📄 Your Script</Text>
          <Text style={styles.stepSub}>Edit your AI-generated script below.</Text>
          <TextInput style={[styles.textArea, { flex: 1, color: '#fff' }]} value={script} onChangeText={setScript} multiline />
          {loading && <ProgressBar progress={progress} label={loadingMsg} />}
          <TouchableOpacity style={styles.btnOutline} onPress={() => setStep(1)}>
            <Text style={styles.btnOutlineText}>← Back</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, loading && styles.btnDisabled]} onPress={generateVoiceover} disabled={loading}>
            {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.btnText}>🎙️ Generate Voiceover</Text>}
          </TouchableOpacity>
        </View>
      )}

      {/* STEP 3 */}
      {step === 3 && (
        <View style={styles.stepContainer}>
          <Text style={styles.stepTitle}>🎙️ Voiceover Ready!</Text>
          <Text style={styles.stepSub}>Your AI voiceover has been generated successfully.</Text>
          <View style={styles.successBox}>
            <Text style={styles.successText}>✅ Audio generated successfully</Text>
            <Text style={styles.successSub}>Now we'll find matching video clips and merge everything together.</Text>
          </View>
          {loading && <ProgressBar progress={progress} label={loadingMsg} />}
          <TouchableOpacity style={styles.btnOutline} onPress={() => setStep(2)}>
            <Text style={styles.btnOutlineText}>← Back</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, loading && styles.btnDisabled]} onPress={generateVideo} disabled={loading}>
            {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.btnText}>🎬 Generate Video</Text>}
          </TouchableOpacity>
        </View>
      )}

      {/* STEP 4 */}
      {step === 4 && fullVideoUrl && (
        <View style={styles.stepContainer}>
          <Text style={styles.stepTitle}>🎬 Your Video is Ready!</Text>
          <VideoPlayer videoUrl={fullVideoUrl} />
          <TouchableOpacity style={styles.btn} onPress={copyLink}>
            <Text style={styles.btnText}>📋 Copy Link</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, styles.btnDownload, downloading && styles.btnDisabled]} onPress={downloadVideo} disabled={downloading}>
            {downloading ? <ActivityIndicator color="#fff" /> : <Text style={[styles.btnText, { color: '#fff' }]}>⬇️ Download MP4</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, styles.btnPurple]} onPress={resetAll}>
            <Text style={[styles.btnText, { color: '#fff' }]}>🔄 Create Another Video</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* MODALS */}
      <OptionModal visible={modal === 'voice'} title="🎙️ Choose Voice" options={VOICES} selectedId={voiceId} onSelect={setVoiceId} onClose={() => setModal(null)} />
      <OptionModal visible={modal === 'ratio'} title="📐 Video Format" options={ASPECT_RATIOS} selectedId={aspectRatio} onSelect={setAspectRatio} onClose={() => setModal(null)} />
      <OptionModal visible={modal === 'caption'} title="💬 Caption Style" options={CAPTION_STYLES} selectedId={captionStyle} onSelect={setCaptionStyle} onClose={() => setModal(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', paddingTop: STATUSBAR_HEIGHT },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#1a1a1a' },
  back: { color: '#2ecc71', fontSize: 16 },
  title: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  stepCount: { color: '#555', fontSize: 14 },
  dotsRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingVertical: 12 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#333' },
  dotActive: { backgroundColor: '#2ecc71', width: 24 },
  stepContainer: { flex: 1, padding: 20 },
  stepTitle: { color: '#fff', fontSize: 22, fontWeight: 'bold', marginBottom: 6 },
  stepSub: { color: '#888', fontSize: 14, marginBottom: 20 },
  textArea: { backgroundColor: '#1a1a1a', color: '#fff', borderRadius: 10, padding: 14, textAlignVertical: 'top', borderWidth: 1, borderColor: '#333', fontSize: 14, marginBottom: 16, minHeight: 100 },
  selectorsCard: { backgroundColor: '#1a1a1a', borderRadius: 14, borderWidth: 1, borderColor: '#2a2a2a', marginBottom: 20 },
  selectorRow: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  selectorIcon: { fontSize: 18, marginRight: 10 },
  selectorLabel: { color: '#888', fontSize: 13, width: 65 },
  selectorValue: { flex: 1, color: '#fff', fontSize: 13 },
  selectorChevron: { color: '#555', fontSize: 20, marginLeft: 8 },
  divider: { height: 1, backgroundColor: '#2a2a2a', marginHorizontal: 14 },
  btn: { backgroundColor: '#2ecc71', borderRadius: 25, padding: 15, alignItems: 'center', marginBottom: 12 },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#000', fontWeight: 'bold', fontSize: 15 },
  btnOutline: { borderWidth: 1, borderColor: '#333', borderRadius: 25, padding: 14, alignItems: 'center', marginBottom: 12 },
  btnOutlineText: { color: '#888', fontWeight: 'bold', fontSize: 15 },
  btnDownload: { backgroundColor: '#1a6b3a' },
  btnPurple: { backgroundColor: '#7c3aed' },
  successBox: { backgroundColor: '#0d2b1a', borderRadius: 12, padding: 16, marginBottom: 24, borderWidth: 1, borderColor: '#2ecc71' },
  successText: { color: '#2ecc71', fontWeight: 'bold', fontSize: 15, marginBottom: 6 },
  successSub: { color: '#888', fontSize: 13 },
  progressBarContainer: { marginBottom: 16 },
  progressBarBg: { height: 8, backgroundColor: '#1a1a1a', borderRadius: 4, overflow: 'hidden', marginBottom: 4 },
  progressBarFill: { height: 8, backgroundColor: '#2ecc71', borderRadius: 4 },
  progressText: { color: '#2ecc71', fontSize: 12, textAlign: 'center' },
  videoPlayer: { width: '100%', height: 220, borderRadius: 10, marginBottom: 16, backgroundColor: '#000' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#111', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 40, maxHeight: '70%' },
  modalHandle: { width: 40, height: 4, backgroundColor: '#333', borderRadius: 2, alignSelf: 'center', marginVertical: 12 },
  modalTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold', paddingHorizontal: 20, marginBottom: 12 },
  optionRow: { flexDirection: 'row', alignItems: 'center', padding: 16, marginHorizontal: 12, borderRadius: 10, marginBottom: 4 },
  optionRowActive: { backgroundColor: '#0d2b1a' },
  optionIcon: { fontSize: 22, marginRight: 14 },
  optionText: { flex: 1 },
  optionLabel: { color: '#ccc', fontSize: 15, fontWeight: '600' },
  optionLabelActive: { color: '#2ecc71' },
  optionDesc: { color: '#666', fontSize: 12, marginTop: 2 },
  optionCheck: { color: '#2ecc71', fontSize: 18, fontWeight: 'bold' },
  captionPreviewBox: { width: 90, height: 36, backgroundColor: '#000', borderRadius: 6, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  captionPreviewText: { fontSize: 16 },
});
