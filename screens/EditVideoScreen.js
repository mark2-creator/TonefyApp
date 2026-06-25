import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, Image,
  StyleSheet, ActivityIndicator, Alert, StatusBar
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import DraggableFlatList from 'react-native-draggable-flatlist';
import Slider from '@react-native-community/slider';
import { auth } from '../firebase';

const BACKEND = 'https://api.fitlifesolutions.site';
const STATUSBAR_HEIGHT = StatusBar.currentHeight || 0;

export default function EditVideoScreen({ navigation }) {
  const [items, setItems] = useState([]); // { key, uri, type, fileName, duration, trimEnd }
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
      const picked = result.assets.map((a, idx) => ({
        key: `${Date.now()}_${idx}`,
        uri: a.uri,
        type: a.type === 'video' ? 'video' : 'image',
        fileName: a.fileName || `media_${Date.now()}_${idx}.${a.type === 'video' ? 'mp4' : 'jpg'}`,
        duration: 3, // default photo duration
        sourceDuration: a.duration ? a.duration / 1000 : null, // video full length in seconds, if known
        trimEnd: a.duration ? a.duration / 1000 : null,
      }));
      setItems(prev => [...prev, ...picked]);
    }
  }

  function removeItem(key) {
    setItems(prev => prev.filter(i => i.key !== key));
  }

  function updatePhotoDuration(key, value) {
    setItems(prev => prev.map(i => i.key === key ? { ...i, duration: Math.round(value) } : i));
  }

  function updateTrimEnd(key, value) {
    setItems(prev => prev.map(i => i.key === key ? { ...i, trimEnd: value } : i));
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
      items.forEach((item) => {
        formData.append('files', {
          uri: item.uri,
          name: item.fileName,
          type: item.type === 'video' ? 'video/mp4' : 'image/jpeg',
        });
      });

      const uploadRes = await fetch(`${BACKEND}/api/upload-media`, {
        method: 'POST',
        body: formData,
      });
      const uploadData = await uploadRes.json();
      if (uploadData.error) throw new Error(uploadData.error);

      // Merge uploaded URLs back with trim/duration metadata, preserving order
      const mediaItems = uploadData.items.map((uploaded, i) => ({
        url: uploaded.url,
        type: uploaded.type,
        duration: items[i].type === 'image' ? items[i].duration : undefined,
        trimEnd: items[i].type === 'video' ? items[i].trimEnd : undefined,
      }));

      setMessage('Starting video creation...');
      const mergeRes = await fetch(`${BACKEND}/api/media-to-video`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mediaItems, userId: user?.uid }),
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

  const renderItem = ({ item, drag, isActive }) => (
    <TouchableOpacity
      style={[styles.row, isActive && styles.rowActive]}
      onLongPress={drag}
      delayLongPress={150}
    >
      <Image source={{ uri: item.uri }} style={styles.rowThumb} />
      <View style={{ flex: 1, marginLeft: 10 }}>
        <Text style={styles.rowLabel}>
          {item.type === 'video' ? '▶ Video' : '🖼 Photo'}
        </Text>
        {item.type === 'image' ? (
          <View>
            <Text style={styles.rowSubLabel}>{item.duration}s</Text>
            <Slider
              style={{ width: '100%', height: 30 }}
              minimumValue={1}
              maximumValue={10}
              step={1}
              value={item.duration}
              minimumTrackTintColor="#2ecc71"
              maximumTrackTintColor="#333"
              thumbTintColor="#2ecc71"
              onValueChange={(v) => updatePhotoDuration(item.key, v)}
            />
          </View>
        ) : item.sourceDuration ? (
          <View>
            <Text style={styles.rowSubLabel}>Trim end: {item.trimEnd?.toFixed(1)}s / {item.sourceDuration.toFixed(1)}s</Text>
            <Slider
              style={{ width: '100%', height: 30 }}
              minimumValue={1}
              maximumValue={item.sourceDuration}
              value={item.trimEnd || item.sourceDuration}
              minimumTrackTintColor="#2ecc71"
              maximumTrackTintColor="#333"
              thumbTintColor="#2ecc71"
              onValueChange={(v) => updateTrimEnd(item.key, v)}
            />
          </View>
        ) : (
          <Text style={styles.rowSubLabel}>Full length</Text>
        )}
      </View>
      <TouchableOpacity style={styles.removeBtn} onPress={() => removeItem(item.key)}>
        <Text style={styles.removeBtnText}>✕</Text>
      </TouchableOpacity>
      <Text style={styles.dragHandle}>≡</Text>
    </TouchableOpacity>
  );

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

      <Text style={styles.sectionLabel}>YOUR MEDIA (long-press ≡ to reorder)</Text>

      <DraggableFlatList
        data={items}
        keyExtractor={(item) => item.key}
        renderItem={renderItem}
        onDragEnd={({ data }) => setItems(data)}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16 }}
        ListFooterComponent={
          <TouchableOpacity style={styles.addBtn} onPress={pickMedia}>
            <Text style={styles.addBtnIcon}>+</Text>
            <Text style={styles.addBtnText}>Add Media</Text>
          </TouchableOpacity>
        }
      />

      <View style={styles.bottomBar}>
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
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', paddingTop: STATUSBAR_HEIGHT },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#1a1a1a' },
  back: { color: '#2ecc71', fontSize: 15, fontWeight: '600' },
  title: { color: '#fff', fontSize: 16, fontWeight: '700' },
  sectionLabel: { color: '#888', fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginTop: 16, marginBottom: 8, paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a1a', borderRadius: 12, padding: 10, marginBottom: 10, borderWidth: 1, borderColor: '#2a2a2a' },
  rowActive: { borderColor: '#2ecc71', opacity: 0.9 },
  rowThumb: { width: 50, height: 50, borderRadius: 8 },
  rowLabel: { color: '#fff', fontSize: 13, fontWeight: '600' },
  rowSubLabel: { color: '#888', fontSize: 11, marginTop: 2 },
  removeBtn: { padding: 6 },
  removeBtnText: { color: '#888', fontSize: 14 },
  dragHandle: { color: '#666', fontSize: 22, paddingHorizontal: 4 },
  addBtn: { borderRadius: 12, borderWidth: 1, borderColor: '#2a2a2a', borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a1a1a', padding: 20, marginTop: 4 },
  addBtnIcon: { color: '#2ecc71', fontSize: 28, fontWeight: '300' },
  addBtnText: { color: '#888', fontSize: 12, marginTop: 4 },
  bottomBar: { padding: 16, borderTopWidth: 1, borderTopColor: '#1a1a1a' },
  processBtn: { backgroundColor: '#2ecc71', borderRadius: 25, padding: 16, alignItems: 'center' },
  processBtnDisabled: { backgroundColor: '#1a1a1a' },
  processBtnText: { color: '#000', fontWeight: '700', fontSize: 14 },
});
