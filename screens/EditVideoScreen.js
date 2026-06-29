import React, { useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, Image, ScrollView,
  StyleSheet, ActivityIndicator, Alert, StatusBar, Dimensions
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import DraggableFlatList from 'react-native-draggable-flatlist';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { auth } from '../firebase';

const BACKEND = 'https://api.fitlifesolutions.site';
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function EditVideoScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [selectedKey, setSelectedKey] = useState(null);
  const [activeTab, setActiveTab] = useState('Edit');

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
        key: String(Date.now()) + '_' + idx,
        uri: a.uri,
        type: a.type === 'video' ? 'video' : 'image',
        fileName: a.fileName || ('media_' + Date.now() + '_' + idx + '.' + (a.type === 'video' ? 'mp4' : 'jpg')),
        duration: 3,
        sourceDuration: a.duration ? a.duration / 1000 : null,
        trimEnd: a.duration ? a.duration / 1000 : null,
      }));
      setItems(prev => [...prev, ...picked]);
    }
  }

  function removeItem(key) {
    setItems(prev => prev.filter(i => i.key !== key));
    if (selectedKey === key) setSelectedKey(null);
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
      const user = auth.currentUser;
      if (!user) throw new Error('Not logged in');
      const token = await user.getIdToken();
      const uploadRes = await fetch(BACKEND + '/api/upload-media', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token },
        body: formData,
      });
      const uploadData = await uploadRes.json();
      if (uploadData.error) throw new Error(uploadData.error);
      const mediaItems = uploadData.items.map((uploaded, i) => ({
        url: uploaded.url,
        type: uploaded.type,
        duration: items[i].type === 'image' ? items[i].duration : undefined,
        trimEnd: items[i].type === 'video' ? items[i].trimEnd : undefined,
      }));
      setMessage('Starting video creation...');
      const mergeRes = await fetch(BACKEND + '/api/media-to-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ mediaItems, userId: user && user.uid }),
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
        const r = await fetch(BACKEND + '/api/job/' + jobId);
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

  const selectedItem = items.find(i => i.key === selectedKey);
  const totalDuration = items.reduce((acc, i) => acc + (i.type === 'image' ? i.duration : (i.trimEnd || i.sourceDuration || 0)), 0);
  const durMin = String(Math.floor(totalDuration / 60)).padStart(2, '0');
  const durSec = String(Math.floor(totalDuration % 60)).padStart(2, '0');

  const bottomTabs = [
    { name: 'Edit', icon: 'content-cut' },
    { name: 'Audio', icon: 'music-note' },
    { name: 'Text', icon: 'title' },
    { name: 'Effects', icon: 'auto-awesome' },
    { name: 'Overlay', icon: 'image' },
    { name: 'Captions', icon: 'closed-caption' },
  ];

  const renderItem = ({ item, drag, isActive }) => {
    const isFirst = items[0] && items[0].key === item.key;
    const isSelected = item.key === selectedKey;
    return (
      <TouchableOpacity
        onPress={() => setSelectedKey(isSelected ? null : item.key)}
        onLongPress={drag}
        delayLongPress={150}
        activeOpacity={0.9}
      >
        <View style={[styles.clip, isActive && styles.clipDragging, isSelected && styles.clipSelected]}>
          <Image source={{ uri: item.uri }} style={styles.clipThumb} resizeMode="cover" />
          {isFirst && (
            <View style={styles.coverBadge}>
              <MaterialIcons name="edit" size={9} color="#fff" />
              <Text style={styles.coverText}>Cover</Text>
            </View>
          )}
          <View style={styles.clipBottom}>
            <Text style={styles.clipDuration}>
              {item.type === 'image' ? (item.duration + 's') : (item.trimEnd ? item.trimEnd.toFixed(1) + 's' : 'Full')}
            </Text>
          </View>
          {isSelected && (
            <TouchableOpacity style={styles.clipRemove} onPress={() => removeItem(item.key)}>
              <MaterialIcons name="close" size={11} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      {/* TOP BAR */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.topBtn}>
          <MaterialIcons name="close" size={24} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.topBtn}>
          <MaterialIcons name="search" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        <TouchableOpacity style={styles.qualityBtn}>
          <MaterialIcons name="diamond" size={14} color="#00d4d4" />
          <Text style={styles.qualityText}>AI UHD</Text>
          <MaterialIcons name="keyboard-arrow-down" size={16} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.exportBtn, items.length > 0 && !uploading && styles.exportBtnActive]}
          onPress={processVideo}
          disabled={uploading || items.length === 0}
        >
          {uploading
            ? <ActivityIndicator color="#000" size="small" />
            : <Text style={[styles.exportBtnText, items.length > 0 && { color: '#000' }]}>Export</Text>
          }
        </TouchableOpacity>
      </View>

      {/* VIDEO PREVIEW - portrait 9:16 */}
      <View style={styles.previewContainer}>
        <View style={styles.previewFrame}>
          {items.length > 0 ? (
            <Image
              source={{ uri: selectedItem ? selectedItem.uri : items[0].uri }}
              style={styles.previewImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.previewEmpty}>
              <MaterialIcons name="movie" size={48} color="#333" />
              <Text style={styles.previewEmptyText}>Add media to get started</Text>
            </View>
          )}
        </View>

        {/* Playback controls below preview */}
        <View style={styles.playbackRow}>
          <TouchableOpacity style={styles.playBtn}>
            <MaterialIcons name="arrow-back" size={22} color="#888" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.playBtnMain}>
            <MaterialIcons name="play-arrow" size={36} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.playBtn}>
            <MaterialIcons name="arrow-forward" size={22} color="#888" />
          </TouchableOpacity>
        </View>
      </View>

      {/* TIMELINE SECTION */}
      <View style={styles.timeline}>
        {/* Timecode row */}
        <View style={styles.timecodeRow}>
          <Text style={styles.timecode}>{'00:00 / ' + durMin + ':' + durSec}</Text>
          <View style={styles.timeMarkers}>
            <Text style={styles.timeMarker}>00:00</Text>
            <Text style={styles.timeMarker}>00:01</Text>
            <Text style={styles.timeMarker}>00:02</Text>
          </View>
        </View>

        {/* Track area */}
        <View style={styles.trackArea}>
          {/* Sidebar */}
          <View style={styles.sidebar}>
            <TouchableOpacity style={styles.sideBtn}>
              <MaterialIcons name="volume-off" size={18} color="#888" />
              <Text style={styles.sideBtnLabel}>Mute clip</Text>
            </TouchableOpacity>
            <View style={styles.coverThumbWrap}>
              {items.length > 0
                ? <Image source={{ uri: items[0].uri }} style={styles.coverThumbImg} resizeMode="cover" />
                : <View style={styles.coverThumbEmpty} />
              }
              <MaterialIcons name="edit" size={10} color="#fff" style={styles.coverEditIcon} />
              <Text style={styles.sideBtnLabel}>Cover</Text>
            </View>
          </View>

          {/* Scrollable clips + scrubber */}
          <View style={styles.clipsWrapper}>
            {/* Center scrubber line */}
            <View style={styles.scrubberLine} pointerEvents="none" />

            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.clipsScroll}>
              {/* Clip frames */}
              {items.map((item, idx) => (
                <TouchableOpacity key={item.key}
                  onPress={() => setSelectedKey(item.key === selectedKey ? null : item.key)}
                  activeOpacity={0.85}>
                  <View style={[styles.clipFrame, item.key === selectedKey && styles.clipFrameSelected]}>
                    <Image source={{ uri: item.uri }} style={styles.clipFrameImg} resizeMode="cover" />
                    {idx === 0 && (
                      <View style={styles.coverBadge}>
                        <MaterialIcons name="edit" size={9} color="#fff" />
                        <Text style={styles.coverText}>Cover</Text>
                      </View>
                    )}
                    <View style={styles.clipBottom}>
                      <Text style={styles.clipDuration}>
                        {item.type === 'image' ? item.duration + 's' : (item.trimEnd ? item.trimEnd.toFixed(1) + 's' : 'Full')}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
              {/* Add clip button */}
              <TouchableOpacity style={styles.addClipBtn} onPress={pickMedia}>
                <MaterialIcons name="add" size={22} color="#888" />
              </TouchableOpacity>
            </ScrollView>

            {/* Audio track */}
            <View style={styles.auxTrack}>
              <MaterialIcons name="add" size={12} color="#555" />
              <Text style={styles.auxLabel}>Add audio</Text>
            </View>

            {/* Text track */}
            <View style={styles.auxTrack}>
              <MaterialIcons name="add" size={12} color="#555" />
              <Text style={styles.auxLabel}>Add text</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Uploading overlay */}
      {uploading && (
        <View style={styles.uploadOverlay}>
          <ActivityIndicator color="#00d4d4" size="large" />
          <Text style={styles.uploadMsg}>{message}</Text>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: progress + '%' }]} />
          </View>
        </View>
      )}

      {/* BOTTOM TOOLBAR */}
      <View style={[styles.bottomToolbar, { paddingBottom: insets.bottom || 16 }]}>
        {bottomTabs.map((tab) => (
          <TouchableOpacity
            key={tab.name}
            style={styles.tabBtn}
            onPress={() => setActiveTab(tab.name)}
          >
            <MaterialIcons name={tab.icon} size={22} color={activeTab === tab.name ? '#fff' : '#555'} />
            <Text style={[styles.tabLabel, activeTab === tab.name && { color: '#fff' }]}>{tab.name}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },

  // Top bar
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, gap: 4 },
  topBtn: { padding: 4 },
  qualityBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a1a', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginRight: 8, gap: 4, borderWidth: 1, borderColor: '#333' },
  qualityText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  exportBtn: { backgroundColor: '#1a1a1a', borderRadius: 8, paddingHorizontal: 20, paddingVertical: 8 },
  exportBtnActive: { backgroundColor: '#00d4d4' },
  exportBtnText: { color: '#888', fontWeight: '700', fontSize: 14 },

  // Preview
  previewContainer: { alignItems: 'center', paddingVertical: 8, backgroundColor: '#000' },
  previewFrame: { width: SCREEN_WIDTH * 0.55, aspectRatio: 9/16, backgroundColor: '#111', borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#222' },
  previewImage: { width: '100%', height: '100%' },
  previewEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  previewEmptyText: { color: '#444', fontSize: 12 },
  playbackRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 40, marginTop: 10 },
  playBtn: { padding: 4 },
  playBtnMain: { padding: 4 },

  // Timeline
  timeline: { flex: 1, backgroundColor: '#0a0a0a', borderTopWidth: 1, borderTopColor: '#1a1a1a' },
  timecodeRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 4 },
  timecode: { color: '#555', fontSize: 10, fontFamily: 'monospace' },
  timeMarkers: { flexDirection: 'row', gap: 16 },
  timeMarker: { color: '#444', fontSize: 10 },

  trackArea: { flex: 1, flexDirection: 'row' },

  // Sidebar
  sidebar: { width: 72, alignItems: 'center', paddingTop: 8, gap: 16, borderRightWidth: 1, borderRightColor: '#1a1a1a' },
  sideBtn: { alignItems: 'center', gap: 2 },
  sideBtnLabel: { color: '#555', fontSize: 9, textAlign: 'center' },
  coverThumbWrap: { alignItems: 'center', gap: 2 },
  coverThumbImg: { width: 40, height: 48, borderRadius: 4, backgroundColor: '#1a1a1a' },
  coverThumbEmpty: { width: 40, height: 48, borderRadius: 4, backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#333' },
  coverEditIcon: { position: 'absolute', top: 2, right: -2 },

  // Clips
  clipsWrapper: { flex: 1, position: 'relative' },
  scrubberLine: { position: 'absolute', top: 0, bottom: 0, left: '50%', width: 2, backgroundColor: '#fff', zIndex: 10, opacity: 0.8 },
  clipsScroll: { paddingLeft: '50%', paddingRight: 40, alignItems: 'center', paddingVertical: 6 },
  clipFrame: { width: 72, height: 56, borderRadius: 3, overflow: 'hidden', marginRight: 2, borderWidth: 1, borderColor: '#333', position: 'relative' },
  clipFrameSelected: { borderColor: '#00d4d4', borderWidth: 2 },
  clipFrameImg: { width: '100%', height: '100%' },
  coverBadge: { position: 'absolute', top: 3, left: 3, backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 3, flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 4, paddingVertical: 1 },
  coverText: { color: '#fff', fontSize: 8, fontWeight: '700' },
  clipBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 3, paddingVertical: 1 },
  clipDuration: { color: '#fff', fontSize: 8, fontWeight: '700' },
  addClipBtn: { width: 40, height: 56, borderRadius: 3, borderWidth: 1, borderColor: '#333', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', backgroundColor: '#111', marginLeft: 2 },

  // Aux tracks
  auxTrack: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: '50%', paddingRight: 12, height: 28, borderTopWidth: 1, borderTopColor: '#111' },
  auxLabel: { color: '#555', fontSize: 11 },

  // Upload overlay
  uploadOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', alignItems: 'center', justifyContent: 'center', gap: 16, zIndex: 100 },
  uploadMsg: { color: '#aaa', fontSize: 13 },
  progressBarBg: { width: '70%', height: 6, backgroundColor: '#222', borderRadius: 3, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#00d4d4', borderRadius: 3 },

  // Bottom toolbar
  bottomToolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingTop: 10, borderTopWidth: 1, borderTopColor: '#1a1a1a', backgroundColor: '#000' },
  tabBtn: { alignItems: 'center', gap: 3, flex: 1 },
  tabLabel: { color: '#555', fontSize: 10, fontWeight: '600' },

  // Legacy (kept for compatibility)
  clip: { width: 72, height: 56, borderRadius: 3, overflow: 'hidden', marginRight: 2, borderWidth: 1.5, borderColor: '#222' },
  clipDragging: { borderColor: '#00d4d4', opacity: 0.85, transform: [{ scale: 1.04 }] },
  clipSelected: { borderColor: '#00d4d4' },
  clipThumb: { width: '100%', height: '100%' },
  clipRemove: { position: 'absolute', top: 3, right: 3, backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 10, width: 16, height: 16, alignItems: 'center', justifyContent: 'center' },
});
