import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, ActivityIndicator,
  Alert, StatusBar
} from 'react-native';

const STATUSBAR_HEIGHT = StatusBar.currentHeight || 0;
const BACKEND = 'https://api.fitlifesolutions.site';

export default function IdeaToVideoScreen({ navigation }) {
  const [prompt, setPrompt] = useState('');
  const [script, setScript] = useState('');
  const [audioUrl, setAudioUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [step, setStep] = useState(1);

  const generateScript = async () => {
    if (!prompt.trim()) return Alert.alert('Error', 'Enter a prompt first');
    setLoading(true);
    setLoadingMsg('✨ Generating script with AI...');
    try {
      const res = await fetch(`${BACKEND}/api/generate-script`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      if (data.script) {
        setScript(data.script);
        setStep(2);
      } else {
        Alert.alert('Error', data.error || 'Failed to generate script');
      }
    } catch (err) {
      Alert.alert('Error', 'Could not connect to server. Make sure backend is running.');
    }
    setLoading(false);
    setLoadingMsg('');
  };

  const generateVoiceover = async () => {
    if (!script.trim()) return Alert.alert('Error', 'Script is empty');
    setLoading(true);
    setLoadingMsg('🎙️ Generating AI voiceover...');
    try {
      const res = await fetch(`${BACKEND}/api/generate-audio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: script }),
      });
      const data = await res.json();
      if (data.audioUrl) {
        setAudioUrl(data.audioUrl);
        setStep(3);
      } else {
        Alert.alert('Error', data.error || 'Failed to generate voiceover');
      }
    } catch (err) {
      Alert.alert('Error', 'Could not connect to server.');
    }
    setLoading(false);
    setLoadingMsg('');
  };

  const generateVideo = async () => {
    setLoading(true);
    setLoadingMsg('🎬 Searching for video clips...');
    try {
      const searchRes = await fetch(`${BACKEND}/api/search-pexels-videos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: prompt }),
      });
      const searchData = await searchRes.json();
      if (!searchData.videos || searchData.videos.length === 0) {
        Alert.alert('Error', 'No videos found for your topic');
        setLoading(false);
        return;
      }
      setLoadingMsg('🎬 Merging video and audio...');
      const selectedVideo = searchData.videos[0];
      const mergeRes = await fetch(`${BACKEND}/api/idea-to-video`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          voiceover: script,
          selectedVideos: searchData.videos.slice(0, 4),
          audioUrl,
        }),
      });
      const mergeData = await mergeRes.json();
      if (mergeData.videoUrl) {
        setVideoUrl(mergeData.videoUrl);
        setStep(4);
      } else {
        Alert.alert('Error', mergeData.error || 'Failed to generate video');
      }
    } catch (err) {
      Alert.alert('Error', 'Could not connect to server.');
    }
    setLoading(false);
    setLoadingMsg('');
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

        {/* Step 1 - Prompt */}
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
          <TouchableOpacity
            style={[styles.btn, (loading || !prompt.trim()) && styles.btnDisabled]}
            onPress={generateScript}
            disabled={loading || !prompt.trim()}
          >
            {loading && step === 1 ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={styles.btnText}>✨ Generate Script</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Step 2 - Script */}
        {step >= 2 && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>📄 Generated Script</Text>
            <TextInput
              style={[styles.textArea, { minHeight: 120 }]}
              value={script}
              onChangeText={setScript}
              multiline
              color="#fff"
            />
            <TouchableOpacity
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={generateVoiceover}
              disabled={loading}
            >
              {loading && step === 2 ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={styles.btnText}>🎙️ Generate Voiceover</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Step 3 - Audio ready */}
        {step >= 3 && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>🎙️ Voiceover Ready!</Text>
            <Text style={styles.successText}>✅ Audio generated successfully</Text>
            <TouchableOpacity
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={generateVideo}
              disabled={loading}
            >
              {loading && step === 3 ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={styles.btnText}>🎬 Generate Video</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Step 4 - Video ready */}
        {step >= 4 && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>🎬 Video Ready!</Text>
            <Text style={styles.successText}>✅ Your video has been generated!</Text>
            <Text style={styles.videoUrl}>
              {`https://api.fitlifesolutions.site${videoUrl}`}
            </Text>
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: '#7c3aed' }]}
              onPress={() => {
                setStep(1);
                setPrompt('');
                setScript('');
                setAudioUrl('');
                setVideoUrl('');
              }}
            >
              <Text style={styles.btnText}>🔄 Create Another Video</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Loading indicator */}
        {loading && (
          <View style={styles.loadingCard}>
            <ActivityIndicator color="#2ecc71" size="large" />
            <Text style={styles.loadingText}>{loadingMsg}</Text>
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
  textArea: { backgroundColor: '#0a0a0a', color: '#fff', borderRadius: 8, padding: 12, minHeight: 100, textAlignVertical: 'top', borderWidth: 1, borderColor: '#333', fontSize: 14, marginBottom: 12 },
  btn: { backgroundColor: '#2ecc71', borderRadius: 25, padding: 14, alignItems: 'center' },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#000', fontWeight: 'bold', fontSize: 15 },
  successText: { color: '#2ecc71', fontSize: 14, marginBottom: 12 },
  videoUrl: { color: '#888', fontSize: 11, marginBottom: 12, lineHeight: 16 },
  loadingCard: { backgroundColor: '#1a1a1a', borderRadius: 12, padding: 24, alignItems: 'center', marginBottom: 16 },
  loadingText: { color: '#2ecc71', marginTop: 12, fontSize: 14, textAlign: 'center' },
});
