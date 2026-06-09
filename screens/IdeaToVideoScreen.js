import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, StatusBar, Dimensions
} from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import VoicePicker from '../components/VoicePicker';
import CaptionStylePicker from '../components/CaptionStylePicker';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const STATUSBAR_HEIGHT = StatusBar.currentHeight || 0;
const BACKEND = 'https://api.fitlifesolutions.site';

const ASPECT_RATIOS = [
  { id: '16:9', label: '16:9', icon: '🖥️', desc: 'YouTube' },
  { id: '9:16', label: '9:16', icon: '📱', desc: 'TikTok/Reels' },
  { id: '1:1', label: '⬛', icon: '⬛', desc: 'Instagram' },
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

const StepHeader = ({ current, total, navigation }) => (
  <View style={styles.header}>
    <TouchableOpacity onPress={() => navigation.goBack()}>
      <Text style={styles.back}>← Back</Text>
    </TouchableOpacity>
    <Text style={styles.title}>Idea to Video</Text>
    <Text style={styles.stepCount}>{current}/{total}</Text>
  </View>
);

const StepDots = ({ current, total }) => (
  <View style={styles.dotsRow}>
    {Array.from({ length: total }).map((_, i) => (
      <View key={i} style={[styles.dot, i < current && styles.dotActive]} />
    ))}
  </View>
);

function VideoPlayer({ videoUrl }) {
  const player = useVideoPlayer(videoUrl, p => { p.loop = true; p.play(); });
  return (
    <VideoView player={player} style={styles.videoPlayer} allowsFullscreen allowsPictureInPicture />
  );
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
  const progressInterval = useRef(null);

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

  const stopProgress = (v = 100) => {
    if (progressInterval.current) clearInterval(progressInterval.current);
    setProgress(v);
  };

  const resetLoading = () => {
    stopProgress(0); setLoading(false); setLoadingMsg(''); setProgress(0);
  };

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
    } catch (err) { Alert.alert('Error', err.message || 'Could not connect to server.'); }
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
    } catch (err) { Alert.alert('Error', err.message || 'Could not connect to server.'); }
    resetLoading();
  };

  const generateVideo = async () => {
    setLoading(true);
    try {
      setLoadingMsg('Analyzing script...'); startProgress(0, 15, 3000);
      const kwRes = await fetchWithTimeout(`${BACKEND}/api/extract-keywords`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: script, voiceId }),
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

      setLoadingMsg('Merging clips & audio...'); startProgress(30, 95, 30000);
      const mergeRes = await fetchWithTimeout(`${BACKEND}/api/idea-to-video`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt, voiceover: script,
          selectedVideos: searchData.videos.slice(0, 3),
          audioUrl, aspectRatio,
        }),
      }, 300000);
      const mergeData = await mergeRes.json();
      stopProgress(100);
      if (mergeData.videoUrl) { setVideoUrl(mergeData.videoUrl); setStep(4); }
      else Alert.alert('Error', mergeData.error || 'Failed to generate video');
    } catch (err) {
      stopProgress(0);
      Alert.alert('Error', err.message || 'Connection failed. Please try again.');
    }
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
    } catch (err) {
      setDownloading(false);
      Alert.alert('Error', 'Download failed: ' + err.message);
    }
  };

  const resetAll = () => {
    setStep(1); setPrompt(''); setScript(''); setAudioUrl('');
    setVideoUrl(''); setProgress(0); setLoadingMsg('');
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a0a" />
      <StepHeader current={step} total={4} navigation={navigation} />
      <StepDots current={step} total={4} />

      {/* STEP 1 — Idea & Format */}
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
          <VoicePicker selectedId={voiceId} onSelect={setVoiceId} />
          <Text style={styles.sectionLabel}>📐 Video Format</Text>
          <View style={styles.ratioRow}>
            {ASPECT_RATIOS.map((r) => (
              <TouchableOpacity key={r.id} style={[styles.ratioBtn, aspectRatio === r.id && styles.ratioBtnActive]} onPress={() => setAspectRatio(r.id)}>
                <Text style={styles.ratioIcon}>{r.icon}</Text>
                <Text style={[styles.ratioLabel, aspectRatio === r.id && styles.ratioLabelActive]}>{r.label}</Text>
                <Text style={styles.ratioDesc}>{r.desc}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <CaptionStylePicker selectedId={captionStyle} onSelect={setCaptionStyle} />
          {loading && <ProgressBar progress={progress} label={loadingMsg} />}
          <TouchableOpacity style={[styles.btn, (loading || !prompt.trim()) && styles.btnDisabled]} onPress={generateScript} disabled={loading || !prompt.trim()}>
            {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.btnText}>✨ Generate Script</Text>}
          </TouchableOpacity>
        </View>
      )}

      {/* STEP 2 — Script */}
      {step === 2 && (
        <View style={styles.stepContainer}>
          <Text style={styles.stepTitle}>📄 Your Script</Text>
          <Text style={styles.stepSub}>Edit your AI-generated script below.</Text>
          <TextInput
            style={[styles.textArea, { flex: 1, minHeight: 200, color: '#fff' }]}
            value={script}
            onChangeText={setScript}
            multiline
          />
          {loading && <ProgressBar progress={progress} label={loadingMsg} />}
          <TouchableOpacity style={[styles.btnOutline]} onPress={() => setStep(1)}>
            <Text style={styles.btnOutlineText}>← Back</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, loading && styles.btnDisabled]} onPress={generateVoiceover} disabled={loading}>
            {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.btnText}>🎙️ Generate Voiceover</Text>}
          </TouchableOpacity>
        </View>
      )}

      {/* STEP 3 — Voiceover ready, generate video */}
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

      {/* STEP 4 — Video ready */}
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
  sectionLabel: { color: '#2ecc71', fontWeight: 'bold', fontSize: 13, marginBottom: 10 },
  textArea: { backgroundColor: '#1a1a1a', color: '#fff', borderRadius: 10, padding: 14, textAlignVertical: 'top', borderWidth: 1, borderColor: '#333', fontSize: 14, marginBottom: 16 },
  ratioRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  ratioBtn: { flex: 1, backgroundColor: '#1a1a1a', borderRadius: 10, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: '#333' },
  ratioBtnActive: { borderColor: '#2ecc71', backgroundColor: '#0d2b1a' },
  ratioIcon: { fontSize: 20, marginBottom: 4 },
  ratioLabel: { color: '#888', fontWeight: 'bold', fontSize: 12 },
  ratioLabelActive: { color: '#2ecc71' },
  ratioDesc: { color: '#555', fontSize: 9, textAlign: 'center', marginTop: 2 },
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

});
