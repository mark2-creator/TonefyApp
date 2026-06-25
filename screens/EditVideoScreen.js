import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, Image,
  StyleSheet, ActivityIndicator, Alert, StatusBar
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { auth } from '../firebase';

const BACKEND = 'https://api.fitlifesolutions.site';
const STATUSBAR_HEIGHT = StatusBar.currentHeight || 0;

export default function EditVideoScreen({ navigation }) {
  const [items, setItems] = useState([]); // { uri, type }
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const user = auth.currentUser;

  async function pickMedia() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Please allow access to your photos/videos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: 20,
    });
    if (!result.canceled) {
      const picked = result.assets.map(a => ({
        uri: a.uri,
        type: a.type === 'video' ? 'video' : 'image',
        fileName: a.fileName || `media_${Date.now()}.${a.type === 'video' ? 'mp4' : 'jpg'}`,
      }));
      setItems(prev => [...prev, ...picked]);
    }
  }

  function removeItem(index) {
    setItems(prev => prev.filter((_, i) => i !== index));
  }

  async function processVideo() {
    if (items.length === 0) {
      Alert.alert('No media', 'Please add at least one photo or video.');
      return;
    }
    setUploading(true);
    setMessage('Uploading media...');
    try {
      const formData = new FormData();
      items.forEach((item, i) => {
        formData.append('files', {
          uri: item.uri,
          name: item.fileName,
          type: item.type === 'video' ? 'video/mp4' : 'image/jpeg',
        });
      });

      const uploadRes = await fetch(`${BACKEND}/api/upload-media`, {
        method: 'POST',
        headers: { 'Content-Type': 'multipart/form-data' },
        body: formData,
      });
      const uploadData = await uploadRes.json();
      if (uploadData.error) throw new Error(uploadData.error);

      setMessage('Starting video creation...');
      const mergeRes = await fetch(`${BACKEND}/api/media-to-video`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mediaItems: uploadData.items, userId: user?.uid }),
      });
      const { jobId, error } = await mergeRes.json();
      if (!jobId) throw new Error(error || 'Failed to start job');

      pollJob(jobId);
    } catch (e) {
      Alert.alert('Error', e.message);
      setUploading(false);
    }
  }

  function pollJob(jobId) {
    const interval = setInterval(async () => {
      try {
        const r = await fetch(`${BACKEND}/api/job/${jobId}`);
        const job = await r.json();
        setProgress(job.progress || 0);
        setMessage(job.message || '');
        if (job.status === 'done') {
          clearInterval(interval);
          setUploading(false);
          navigation.navigate('EditPostVideo', { videoUrl: job.videoUrl, videoPath: job.videoUrl });
        } else if (job.status === 'error') {
          clearInterval(interval);
          setUploading(false);
          Alert.alert('Error', job.error || 'Video creation failed');
        }
      } catch (e) {}
    }, 2000);
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a0a" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>✂️ Edit Video</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionLabel}>YOUR MEDIA</Text>
        <View style={styles.grid}>
          {items.map((item, i) => (
            <View key={i} style={styles.thumbWrap}>
              <Image source={{ uri: item.uri }} style={styles.thumb} />
              {item.type === 'video' && <Text style={styles.videoBadge}>▶</Text>}
              <TouchableOpacity style={styles.removeBtn} onPress={() => removeItem(i)}>
                <Text style={styles.removeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity style={styles.addBtn} onPress={pickMedia}>
            <Text style={styles.addBtnIcon}>+</Text>
            <Text style={styles.addBtnText}>Add Media</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.hint}>
          Add photos and videos from your device. Photos will show for 3 seconds each; videos play at full length. We'll combine them into one video.
        </Text>

        <TouchableOpacity
          style={[styles.processBtn, items.length === 0 && styles.processBtnDisabled]}
          onPress={processVideo}
          disabled={uploading || items.length === 0}
        >
          {uploading ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <ActivityIndicator color="#000" size="small" />
              <Text style={styles.processBtnText}>{message || 'Processing...'} {progress}%</Text>
            </View>
          ) : (
            <Text style={styles.processBtnText}>🎬 Create Video</Text>
          )}
        </TouchableOpacity>

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
  sectionLabel: { color: '#888', fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8, marginTop: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  thumbWrap: { width: '30%', aspectRatio: 1, borderRadius: 10, overflow: 'hidden', position: 'relative' },
  thumb: { width: '100%', height: '100%' },
  videoBadge: { position: 'absolute', bottom: 4, left: 4, color: '#fff', fontSize: 12, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 4, borderRadius: 4 },
  removeBtn: { position: 'absolute', top: 2, right: 2, backgroundColor: 'rgba(0,0,0,0.7)', width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  removeBtnText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  addBtn: { width: '30%', aspectRatio: 1, borderRadius: 10, borderWidth: 1, borderColor: '#2a2a2a', borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a1a1a' },
  addBtnIcon: { color: '#2ecc71', fontSize: 28, fontWeight: '300' },
  addBtnText: { color: '#888', fontSize: 11, marginTop: 4 },
  hint: { color: '#666', fontSize: 12, lineHeight: 18, marginTop: 16 },
  processBtn: { backgroundColor: '#2ecc71', borderRadius: 25, padding: 16, alignItems: 'center', marginTop: 24 },
  processBtnDisabled: { backgroundColor: '#1a1a1a' },
  processBtnText: { color: '#000', fontWeight: '700', fontSize: 14 },
});
