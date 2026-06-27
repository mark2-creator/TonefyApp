import React, { useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, Image, ScrollView,
  StyleSheet, ActivityIndicator, Alert, StatusBar, Dimensions
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import DraggableFlatList from 'react-native-draggable-flatlist';
import { MaterialIcons, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { auth } from '../firebase';

const BACKEND = 'https://api.fitlifesolutions.site';
const { width: SCREEN_WIDTH } = Dimensions.get('window');

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
              <MaterialIcons name="edit" size={10} color="#fff" />
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

  const bottomTabs = [
    { name: 'Edit', icon: 'content-cut', lib: 'material' },
    { name: 'Audio', icon: 'musical-note', lib: 'ionicon' },
    { name: 'Text', icon: 'title', lib: 'material' },
    { name: 'Effects', icon: 'auto-awesome', lib: 'material' },
    { name: 'Overlay', icon: 'image', lib: 'material' },
    { name: 'Captions', icon: 'closed-caption', lib: 'material' },
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.topBtn}>
          <MaterialIcons name="close" size={26} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.topBtn}>
          <MaterialIcons name="search" size={26} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        <TouchableOpacity style={styles.qualityBtn}>
          <Text style={styles.qualityText}>AI UHD</Text>
          <MaterialIcons name="keyboard-arrow-down" size={16} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.exportBtn, (items.length === 0 || uploading) && styles.exportBtnDisabled]}
          onPress={processVideo}
          disabled={uploading || items.length === 0}
        >
          {uploading
            ? <ActivityIndicator color="#000" size="small" />
            : <Text style={styles.exportBtnText}>Export</Text>
          }
        </TouchableOpacity>
      </View>

      {/* Preview */}
      <View style={styles.preview}>
        {items.length > 0 ? (
          <Image
            source={{ uri: selectedItem ? selectedItem.uri : items[0].uri }}
            style={styles.previewImage}
            resizeMode="contain"
          />
        ) : (
          <View style={styles.previewEmpty}>
            <MaterialIcons name="movie" size={52} color="#222" />
            <Text style={styles.previewEmptyText}>Add media to get started</Text>
          </View>
        )}
      </View>

      {/* Playback + scrubber row */}
      <View style={styles.scrubberRow}>
        <View style={styles.playbackLeft}>
          <TouchableOpacity style={styles.playBtn}>
            <MaterialIcons name="fullscreen" size={22} color="#ccc" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.playBtn}>
            <MaterialIcons name="play-arrow" size={28} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.playBtn}>
            <MaterialIcons name="closed-caption" size={20} color="#ccc" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.playBtn}>
            <MaterialIcons name="undo" size={20} color="#ccc" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.playBtn}>
            <MaterialIcons name="redo" size={20} color="#ccc" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Timeline */}
      <View style={styles.timeline}>
        {/* Time markers */}
        <View style={styles.timeMarkers}>
          <Text style={styles.timeMarker}>00:00</Text>
          <Text style={styles.timeMarker}>00:02</Text>
          <Text style={styles.timeMarker}>00:04</Text>
        </View>

        {/* Clip track row */}
        <View style={styles.trackRow}>
          {/* Side buttons */}
          <View style={styles.trackSide}>
            <TouchableOpacity style={styles.sideIconBtn}>
              <MaterialIcons name="volume-off" size={18} color="#ccc" />
              <Text style={styles.sideIconText}>Mute{'\n'}clip</Text>
            </TouchableOpacity>
          </View>

          {/* Clips + scrubber */}
          <View style={{ flex: 1, position: 'relative' }}>
            <DraggableFlatList
              data={items}
              keyExtractor={(item) => item.key}
              renderItem={renderItem}
              onDragEnd={({ data }) => setItems(data)}
              horizontal
              contentContainerStyle={styles.timelineContent}
              ListFooterComponent={
                <TouchableOpacity style={styles.addClipBtn} onPress={pickMedia}>
                  <MaterialIcons name="add" size={30} color="#aaa" />
                </TouchableOpacity>
              }
            />
            {/* Red scrubber line */}
            {items.length > 0 && (
              <View style={styles.scrubberLine} />
            )}
          </View>

          {/* Right side track icons */}
          <View style={styles.trackSideRight}>
            <TouchableOpacity style={styles.sideIconBtn}>
              <MaterialIcons name="music-note" size={18} color="#ccc" />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.sideIconBtn, { marginTop: 8 }]}>
              <MaterialIcons name="title" size={18} color="#ccc" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Audio track */}
        <View style={styles.auxRow}>
          <View style={styles.trackSide} />
          <TouchableOpacity style={styles.auxTrack} onPress={pickMedia}>
            <MaterialIcons name="music-note" size={14} color="#555" />
            <Text style={styles.auxLabel}>+ Add audio</Text>
          </TouchableOpacity>
        </View>

        {/* Text track */}
        <View style={styles.auxRow}>
          <View style={styles.trackSide} />
          <TouchableOpacity style={styles.auxTrack}>
            <MaterialIcons name="title" size={14} color="#555" />
            <Text style={styles.auxLabel}>+ Add text</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Timestamp */}
      <View style={styles.timestampRow}>
        <Text style={styles.timestamp}>{'00:00 / ' + durMin + ':' + durSec}</Text>
      </View>

      {/* Bottom Toolbar */}
      <View style={[styles.bottomToolbar, { paddingBottom: insets.bottom || 12 }]}>
        {bottomTabs.map((tab) => (
          <TouchableOpacity
            key={tab.name}
            style={styles.tabBtn}
            onPress={() => {
              setActiveTab(tab.name);
              if (tab.name === 'Edit') pickMedia();
            }}
          >
            {tab.lib === 'ionicon'
              ? <Ionicons name={tab.icon} size={22} color={activeTab === tab.name ? '#fff' : '#666'} />
              : <MaterialIcons name={tab.icon} size={22} color={activeTab === tab.name ? '#fff' : '#666'} />
            }
            <Text style={[styles.tabLabel, activeTab === tab.name && { color: '#fff' }]}>{tab.name}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },

  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 8, gap: 4 },
  topBtn: { padding: 6 },
  qualityBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#222', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6, marginRight: 8 },
  qualityText: { color: '#fff', fontSize: 13, fontWeight: '700', marginRight: 2 },
  exportBtn: { backgroundColor: '#00d4d4', borderRadius: 8, paddingHorizontal: 20, paddingVertical: 8 },
  exportBtnDisabled: { backgroundColor: '#1a1a1a' },
  exportBtnText: { color: '#000', fontWeight: '700', fontSize: 14 },

  preview: { height: 260, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  previewImage: { width: '100%', height: '100%' },
  previewEmpty: { alignItems: 'center', justifyContent: 'center', gap: 10 },
  previewEmptyText: { color: '#333', fontSize: 13 },

  scrubberRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', paddingHorizontal: 10, paddingVertical: 6, borderTopWidth: 1, borderTopColor: '#111' },
  playbackLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  playBtn: { padding: 2 },

  timeline: { flex: 1, backgroundColor: '#0a0a0a' },
  timeMarkers: { flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 60, paddingTop: 4, paddingBottom: 2 },
  timeMarker: { color: '#444', fontSize: 10 },

  trackRow: { flexDirection: 'row', alignItems: 'center', minHeight: 72 },
  trackSide: { width: 52, alignItems: 'center', justifyContent: 'center', gap: 6 },
  trackSideRight: { width: 40, alignItems: 'center', justifyContent: 'center' },
  sideIconBtn: { alignItems: 'center', gap: 2 },
  sideIconText: { color: '#aaa', fontSize: 9, textAlign: 'center' },

  timelineContent: { paddingHorizontal: 4, alignItems: 'center' },

  clip: { width: 80, height: 68, borderRadius: 4, overflow: 'hidden', marginRight: 2, borderWidth: 1.5, borderColor: '#222' },
  clipDragging: { borderColor: '#00d4d4', opacity: 0.85, transform: [{ scale: 1.04 }] },
  clipSelected: { borderColor: '#00d4d4' },
  clipThumb: { width: '100%', height: '100%' },
  coverBadge: { position: 'absolute', top: 4, left: 4, backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: 4, flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 5, paddingVertical: 2 },
  coverText: { color: '#fff', fontSize: 9, fontWeight: '700' },
  clipBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 4, paddingVertical: 2 },
  clipDuration: { color: '#fff', fontSize: 9, fontWeight: '700' },
  clipRemove: { position: 'absolute', top: 3, right: 3, backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 10, width: 16, height: 16, alignItems: 'center', justifyContent: 'center' },

  addClipBtn: { width: 44, height: 68, borderRadius: 4, borderWidth: 1, borderColor: '#333', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', backgroundColor: '#111', marginLeft: 4 },

  scrubberLine: { position: 'absolute', top: 0, bottom: 0, left: '50%', width: 2, backgroundColor: '#ff3b30', zIndex: 10 },

  auxRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, minHeight: 36 },
  auxTrack: { flex: 1, height: 32, borderRadius: 4, backgroundColor: '#111', borderWidth: 1, borderColor: '#1e1e1e', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, marginRight: 10 },
  auxLabel: { color: '#555', fontSize: 12 },

  timestampRow: { paddingHorizontal: 14, paddingVertical: 4 },
  timestamp: { color: '#666', fontSize: 11, fontWeight: '600' },

  bottomToolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingTop: 10, borderTopWidth: 1, borderTopColor: '#1a1a1a', backgroundColor: '#0a0a0a' },
  tabBtn: { alignItems: 'center', gap: 3, flex: 1 },
  tabLabel: { color: '#666', fontSize: 10, fontWeight: '600' },
});
