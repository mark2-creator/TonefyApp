import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, ActivityIndicator,
  Alert, StatusBar
} from 'react-native';

const STATUSBAR_HEIGHT = StatusBar.currentHeight || 0;
const BACKEND = 'https://api.fitlifesolutions.site';

const ASPECT_RATIOS = [
  { id: '16:9', label: '16:9', icon: '🖥️', desc: 'YouTube' },
  { id: '9:16', label: '9:16', icon: '📱', desc: 'TikTok/Reels' },
  { id: '1:1', label: '1:1', icon: '⬛', desc: 'Instagram' },
];

const ProgressBar = ({ progress, label }) => (
  <View style={styles.progressBarContainer}>
    <View style={styles.progressBarBg}>
      <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
    </View>
    <Text style={styles.progressText}>{label} {Math.round(progress)}%</Text>
  </View>
);

export default function IdeaToVideoScreen({ navigation }) {
  const [prompt, setPrompt] = useState('');
  const [script, setScript] = useState('');
  const [audioUrl, setAudioUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [progress, setProgress] = useState(0);
  const [step, setStep] = useState(1);
  const [aspectRatio, setAspectRatio] = useState('9:16');
  const progressInterval = useRef(null);

  const startProgress = (start, end, duration) => {
    setProgress(start);
    const steps = 20;
    const increment = (end - start) / steps;
    const delay = duration / steps;
    let current = start;
    progressInterval.current = setInterval(() => {
      current += increment;
      if (current >= end) {
        clearInterval(progressInterval.current);
        setProgress(end);
      } else {
        setProgress(Math.round(current));
      }
    }, delay);
  };

  const stopProgress = () => {
    if (progressInterval.current) clearInterval(progressInterval.current);
  };

  const generateScript = async () => {
    if (!prompt.trim()) return Alert.alert('Error', 'Enter a prompt first');
    setLoading(true);
    setLoadingMsg('Generating script with AI...');
    startProgress(0, 90, 3000);
    try {
      const res = await fetch(`${BACKEND}/api/generate-script`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      stopProgress(); setProgress(100);
      if (data.script) { setScript(data.script); setStep(2); }
      else Alert.alert('Error', data.error || 'Failed to generate script');
    } catch (err) { Alert.alert('Error', 'Could not connect to server.'); }
    setLoading(false); setLoadingMsg(''); setProgress(0);
  };

  const generateVoiceover = async () => {
    if (!script.trim()) return Alert.alert('Error', 'Script is empty');
    setLoading(true);
    setLoadingMsg('Generating AI voiceover...');
    startProgress(0, 90, 20000);
    try {
      const res = await fetch(`${BACKEND}/api/generate-audio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: script }),
      });
      const data = await res.json();
      stopProgress(); setProgress(100);
      if (data.audioUrl) { setAudioUrl(data.audioUrl); setStep(3); }
      else Alert.alert('Error', data.error || 'Failed to generate voiceover');
    } catch (err) { Alert.alert('Error', 'Could not connect to server.'); }
    setLoading(false); setLoadingMsg(''); setProgress(0);
  };

  const generateVideo = async () => {
    setLoading(true);
    try {
      setLoadingMsg('Analyzing script...');
      startProgress(0, 15, 3000);
      const kwRes = await fetch(`${BACKEND}/api/extract-keywords`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: script }),
      });
      const kwData = await kwRes.json();
      const keywords = kwData.keywords || [prompt];

      setLoadingMsg('Fetching video clips...');
      startProgress(15, 30, 5000);
      const searchRes = await fetch(`${BACKEND}/api/search-pexels-videos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: prompt, keywords }),
      });
      const searchData = await searchRes.json();
      if (!searchData.videos || searchData.videos.length === 0) {
        Alert.alert('Error', 'No videos found'); setLoading(false); return;
      }

      setLoadingMsg('Merging clips & audio...');
      startProgress(30, 95, 120000);
      const mergeRes = await fetch(`${BACKEND}/api/idea-to-video`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt, voiceover: script,
          selectedVideos: searchData.videos.slice(0, 6),
          audioUrl, aspectRatio,
        }),
      });
      const mergeData = await mergeRes.json();
      stopProgress(); setProgress(100);
      if (mergeData.videoUrl) { setVideoUrl(mergeData.videoUrl); setStep(4); }
      else Alert.alert('Error', mergeData.error || 'Failed to generate video');
    } catch (err) { 
      stopProgress();
      Alert.alert('Error', 'Connection timeout. Video may still be processing. Try again.'); 
    }
    setLoading(false); setLoadingMsg(''); setProgress(0);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a0a" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Idea to Video</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Progress Steps */}
        <View style={styles.progressRow}>
          {['Idea', 'Script', 'Voice', 'Video'].map((s, i) => (
            <View key={i} style={styles.progressItem}>
              <View style={[styles.progressDot, step > i && styles.progressDotActive]}>
                <Text style={styles.progressNum}>{i + 1}</Text>
              </View>
              <Text style={[styles.progressLabel, step > i && styles.progressLabelActive]}>{s}</Text>
            </View>
          ))}
        </View>

        {/* Aspect Ratio */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>📐 Video Format</Text>
          <View style={styles.ratioRow}>
            {ASPECT_RATIOS.map((r) => (
              <TouchableOpacity
                key={r.id}
                style={[styles.ratioBtn, aspectRatio === r.id && styles.ratioBtnActive]}
                onPress={() => setAspectRatio(r.id)}
              >
                <Text style={styles.ratioIcon}>{r.icon}</Text>
                <Text style={[styles.ratioLabel, aspectRatio === r.id && styles.ratioLabelActive]}>{r.label}</Text>
                <Text style={styles.ratioDesc}>{r.desc}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Step 1 */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>📝 Your Idea</Text>
          <TextInput
            style={styles.textArea}
            placeholder="e.g. A motivational video about morning routines..."
            placeholderTextColor="#555"
            value={prompt}
            onChangeText={setPrompt}
            multiline
            numberOfLines={4}
          />
          {loading && step === 1 && <ProgressBar progress={progress} label="Generating script..." />}
          <TouchableOpacity
            style={[styles.btn, (loading || !prompt.trim()) && styles.btnDisabled]}
            onPress={generateScript}
            disabled={loading || !prompt.trim()}
          >
            {loading && step === 1 ? <ActivityIndicator color="#000" /> : <Text style={styles.btnText}>✨ Generate Script</Text>}
          </TouchableOpacity>
        </View>

        {/* Step 2 */}
        {step >= 2 && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>📄 Generated Script (Editable)</Text>
            <TextInput
              style={[styles.textArea, { minHeight: 150, color: '#fff' }]}
              value={script}
              onChangeText={setScript}
              multiline
            />
            {loading && step === 2 && <ProgressBar progress={progress} label="Generating voiceover..." />}
            <TouchableOpacity
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={generateVoiceover}
              disabled={loading}
            >
              {loading && step === 2 ? <ActivityIndicator color="#000" /> : <Text style={styles.btnText}>🎙️ Generate Voiceover</Text>}
            </TouchableOpacity>
          </View>
        )}

        {/* Step 3 */}
        {step >= 3 && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>🎙️ Voiceover Ready!</Text>
            <Text style={styles.successText}>✅ Audio generated successfully</Text>
            {loading && step === 3 && <ProgressBar progress={progress} label={loadingMsg} />}
            <TouchableOpacity
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={generateVideo}
              disabled={loading}
            >
              {loading && step === 3 ? <ActivityIndicator color="#000" /> : <Text style={styles.btnText}>🎬 Generate Video</Text>}
            </TouchableOpacity>
          </View>
        )}

        {/* Step 4 */}
        {step >= 4 && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>🎬 Video Ready!</Text>
            <Text style={styles.successText}>✅ Your video has been generated!</Text>
            <Text style={styles.videoUrl}>{`${BACKEND}${videoUrl}`}</Text>
            <TouchableOpacity style={[styles.btn, { marginBottom: 10 }]}
              onPress={() => Alert.alert('Video URL', `${BACKEND}${videoUrl}`, [{ text: 'OK' }])}>
              <Text style={styles.btnText}>📋 Copy Video Link</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, { backgroundColor: '#7c3aed' }]}
              onPress={() => { setStep(1); setPrompt(''); setScript(''); setAudioUrl(''); setVideoUrl(''); setProgress(0); }}>
              <Text style={styles.btnText}>🔄 Create Another Video</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', paddingTop: STATUSBAR_HEIGHT },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#1a1a1a' },
  back: { color: '#2ecc71', fontSize: 16 },
  title: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  progressItem: { alignItems: 'center' },
  progressDot: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#333', justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  progressDotActive: { backgroundColor: '#2ecc71', borderColor: '#2ecc71' },
  progressNum: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  progressLabel: { color: '#555', fontSize: 10 },
  progressLabelActive: { color: '#2ecc71' },
  card: { backgroundColor: '#1a1a1a', borderRadius: 12, padding: 16, marginBottom: 16 },
  cardLabel: { color: '#2ecc71', fontWeight: 'bold', fontSize: 14, marginBottom: 12 },
  ratioRow: { flexDirection: 'row', gap: 8 },
  ratioBtn: { flex: 1, backgroundColor: '#0a0a0a', borderRadius: 10, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: '#333' },
  ratioBtnActive: { borderColor: '#2ecc71', backgroundColor: '#0d2b1a' },
  ratioIcon: { fontSize: 20, marginBottom: 4 },
  ratioLabel: { color: '#888', fontWeight: 'bold', fontSize: 12 },
  ratioLabelActive: { color: '#2ecc71' },
  ratioDesc: { color: '#555', fontSize: 9, textAlign: 'center', marginTop: 2 },
  textArea: { backgroundColor: '#0a0a0a', color: '#fff', borderRadius: 8, padding: 12, minHeight: 100, textAlignVertical: 'top', borderWidth: 1, borderColor: '#333', fontSize: 14, marginBottom: 12 },
  btn: { backgroundColor: '#2ecc71', borderRadius: 25, padding: 14, alignItems: 'center', marginBottom: 4 },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#000', fontWeight: 'bold', fontSize: 15 },
  successText: { color: '#2ecc71', fontSize: 14, marginBottom: 12 },
  videoUrl: { color: '#888', fontSize: 11, marginBottom: 12, lineHeight: 16 },
  progressBarContainer: { marginBottom: 12 },
  progressBarBg: { height: 8, backgroundColor: '#0a0a0a', borderRadius: 4, overflow: 'hidden', marginBottom: 4 },
  progressBarFill: { height: 8, backgroundColor: '#2ecc71', borderRadius: 4 },
  progressText: { color: '#2ecc71', fontSize: 12, textAlign: 'center' },
});
