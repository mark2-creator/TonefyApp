import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, Image, ScrollView,
  StyleSheet, ActivityIndicator, Alert, StatusBar,
  Dimensions, Modal, TextInput, PanResponder, Animated
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Video } from 'expo-av';
import Slider from '@react-native-community/slider';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { auth } from '../firebase';

const BACKEND = 'https://api.fitlifesolutions.site';
const { width: SW, height: SH } = Dimensions.get('window');
const CLIP_W = 72;
const CLIP_H = 56;

const FILTERS = ['None','Bright','Contrast','Warm','Cool','Fade','B&W'];
const SPEEDS = [0.3, 0.5, 1, 1.5, 2, 3];
const FONTS = ['Default','Bold','Italic','Mono'];
const TEXT_COLORS = ['#fff','#000','#ff0','#f00','#0f0','#00f','#f0f','#0ff'];
const TRANSITIONS = ['None','Fade','Slide','Zoom'];

export default function EditVideoScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const videoRef = useRef(null);

  // Media items
  const [items, setItems] = useState([]);
  const [selectedKey, setSelectedKey] = useState(null);

  // Playback
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0); // seconds
  const [duration, setDuration] = useState(0);
  const playTimer = useRef(null);

  // Upload/export
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');

  // Active bottom tab
  const [activeTab, setActiveTab] = useState('Edit');

  // Text overlays
  const [textOverlays, setTextOverlays] = useState([]);
  const [showTextModal, setShowTextModal] = useState(false);
  const [editingText, setEditingText] = useState(null);
  const [textInput, setTextInput] = useState('');
  const [textColor, setTextColor] = useState('#fff');
  const [textFont, setTextFont] = useState('Default');
  const [textSize, setTextSize] = useState(18);

  // Audio
  const [audioTracks, setAudioTracks] = useState([]);
  const [masterVolume, setMasterVolume] = useState(1);
  const [showVolumeModal, setShowVolumeModal] = useState(false);

  // Effects
  const [selectedFilter, setSelectedFilter] = useState('None');
  const [selectedSpeed, setSelectedSpeed] = useState(1);
  const [selectedTransition, setSelectedTransition] = useState('None');
  const [brightness, setBrightness] = useState(1);

  // Split/trim
  const [showTrimModal, setShowTrimModal] = useState(false);
  const [trimItem, setTrimItem] = useState(null);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(10);

  // Resolution
  const [resolution, setResolution] = useState('1080p');
  const [showResModal, setShowResModal] = useState(false);

  const selectedItem = items.find(i => i.key === selectedKey);

  // Compute total duration
  useEffect(() => {
    const total = items.reduce((acc, i) =>
      acc + (i.type === 'image' ? (i.duration || 3) : (i.trimEnd || i.sourceDuration || 0)), 0);
    setDuration(total);
  }, [items]);

  // Playback timer
  useEffect(() => {
    if (isPlaying) {
      playTimer.current = setInterval(() => {
        setPosition(p => {
          if (p >= duration) { setIsPlaying(false); return 0; }
          return p + 0.1;
        });
      }, 100);
    } else {
      clearInterval(playTimer.current);
    }
    return () => clearInterval(playTimer.current);
  }, [isPlaying, duration]);

  const fmtTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  };

  async function pickMedia() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission needed','Allow access to photos/videos.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsMultipleSelection: true, quality: 0.8, selectionLimit: 20,
    });
    if (!result.canceled) {
      const picked = result.assets.map((a, idx) => ({
        key: String(Date.now()) + '_' + idx,
        uri: a.uri,
        type: a.type === 'video' ? 'video' : 'image',
        fileName: a.fileName || ('media_' + Date.now() + '_' + idx + '.' + (a.type === 'video' ? 'mp4' : 'jpg')),
        duration: 3,
        sourceDuration: a.duration ? a.duration / 1000 : null,
        trimStart: 0,
        trimEnd: a.duration ? a.duration / 1000 : 3,
        volume: 1,
        speed: 1,
        filter: 'None',
        transition: 'None',
      }));
      setItems(prev => [...prev, ...picked]);
    }
  }

  function removeItem(key) {
    setItems(prev => prev.filter(i => i.key !== key));
    if (selectedKey === key) setSelectedKey(null);
  }

  function splitAtScrubber() {
    if (!selectedItem) { Alert.alert('Select a clip first'); return; }
    const clipDur = selectedItem.type === 'image' ? selectedItem.duration : (selectedItem.trimEnd || selectedItem.sourceDuration || 3);
    const splitPoint = clipDur / 2; // split in half for now
    const idx = items.findIndex(i => i.key === selectedKey);
    const part1 = { ...selectedItem, key: selectedItem.key + '_a', trimEnd: splitPoint };
    const part2 = { ...selectedItem, key: selectedItem.key + '_b', trimStart: splitPoint };
    const newItems = [...items];
    newItems.splice(idx, 1, part1, part2);
    setItems(newItems);
    setSelectedKey(null);
  }

  function openTrim(item) {
    setTrimItem(item);
    setTrimStart(item.trimStart || 0);
    setTrimEnd(item.trimEnd || item.sourceDuration || item.duration || 3);
    setShowTrimModal(true);
  }

  function applyTrim() {
    setItems(prev => prev.map(i => i.key === trimItem.key ? { ...i, trimStart, trimEnd } : i));
    setShowTrimModal(false);
  }

  function applySpeed(speed) {
    setSelectedSpeed(speed);
    if (selectedItem) {
      setItems(prev => prev.map(i => i.key === selectedKey ? { ...i, speed } : i));
    }
  }

  function applyFilter(filter) {
    setSelectedFilter(filter);
    if (selectedItem) {
      setItems(prev => prev.map(i => i.key === selectedKey ? { ...i, filter } : i));
    }
  }

  function applyTransition(t) {
    setSelectedTransition(t);
    if (selectedItem) {
      setItems(prev => prev.map(i => i.key === selectedKey ? { ...i, transition: t } : i));
    }
  }

  function addTextOverlay() {
    if (!textInput.trim()) return;
    const overlay = {
      key: String(Date.now()),
      text: textInput,
      color: textColor,
      font: textFont,
      size: textSize,
      x: 50, y: 50,
    };
    if (editingText) {
      setTextOverlays(prev => prev.map(t => t.key === editingText.key ? overlay : t));
    } else {
      setTextOverlays(prev => [...prev, overlay]);
    }
    setShowTextModal(false);
    setTextInput('');
    setEditingText(null);
  }

  function removeTextOverlay(key) {
    setTextOverlays(prev => prev.filter(t => t.key !== key));
  }

  async function pickAudio() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos, // audio files
      allowsMultipleSelection: false,
    });
    if (!result.canceled && result.assets[0]) {
      setAudioTracks(prev => [...prev, {
        key: String(Date.now()),
        uri: result.assets[0].uri,
        name: result.assets[0].fileName || 'Audio track',
        volume: 1,
      }]);
    }
  }async function processVideo() {
    if (items.length === 0) { Alert.alert('No media','Add at least one photo or video.'); return; }
    setUploading(true); setMessage('Uploading media...');
    try {
      const formData = new FormData();
      items.forEach(item => formData.append('files', {
        uri: item.uri, name: item.fileName,
        type: item.type === 'video' ? 'video/mp4' : 'image/jpeg',
      }));
      const user = auth.currentUser;
      if (!user) throw new Error('Not logged in');
      const token = await user.getIdToken();
      const uploadRes = await fetch(BACKEND + '/api/upload-media', {
        method: 'POST', headers: { Authorization: 'Bearer ' + token }, body: formData,
      });
      const uploadData = await uploadRes.json();
      if (uploadData.error) throw new Error(uploadData.error);
      const mediaItems = uploadData.items.map((uploaded, i) => ({
        url: uploaded.url, type: uploaded.type,
        duration: items[i].type === 'image' ? items[i].duration : undefined,
        trimStart: items[i].trimStart || 0,
        trimEnd: items[i].type === 'video' ? items[i].trimEnd : undefined,
        speed: items[i].speed || 1,
        filter: items[i].filter || 'None',
        transition: items[i].transition || 'None',
      }));
      setMessage('Creating video...');
      const mergeRes = await fetch(BACKEND + '/api/media-to-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ mediaItems, userId: user.uid, resolution, textOverlays }),
      });
      const { jobId, error } = await mergeRes.json();
      if (!jobId) throw new Error(error || 'Failed to start job');
      pollJob(jobId);
    } catch (e) { Alert.alert('Error', e.message); setUploading(false); }
  }

  function pollJob(jobId) {
    const interval = setInterval(async () => {
      try {
        const r = await fetch(BACKEND + '/api/job/' + jobId);
        const job = await r.json();
        setProgress(job.progress || 0); setMessage(job.message || '');
        if (job.status === 'done') {
          clearInterval(interval); setUploading(false);
          navigation.navigate('EditPostVideo', { videoUrl: job.videoUrl, videoPath: job.videoUrl });
        } else if (job.status === 'error') {
          clearInterval(interval); setUploading(false);
          Alert.alert('Error', job.error || 'Video creation failed');
        }
      } catch (e) {}
    }, 2000);
  }

  // Current preview item based on playback position
  const getPreviewItem = () => {
    let t = 0;
    for (const item of items) {
      const d = item.type === 'image' ? (item.duration || 3) : (item.trimEnd || item.sourceDuration || 0);
      if (position <= t + d) return item;
      t += d;
    }
    return items[0];
  };

  const previewItem = items.length > 0 ? (selectedItem || getPreviewItem()) : null;

  const bottomTabs = [
    { name: 'Edit', icon: 'content-cut' },
    { name: 'Audio', icon: 'music-note' },
    { name: 'Text', icon: 'title' },
    { name: 'Effects', icon: 'auto-awesome' },
    { name: 'Overlay', icon: 'image' },
    { name: 'Captions', icon: 'closed-caption' },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'Edit':
        return (
          <View style={styles.tabContent}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <TouchableOpacity style={styles.toolChip} onPress={splitAtScrubber}>
                <MaterialIcons name="content-cut" size={18} color="#fff" />
                <Text style={styles.toolChipText}>Split</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.toolChip}
                onPress={() => selectedItem && openTrim(selectedItem)}>
                <MaterialIcons name="straighten" size={18} color="#fff" />
                <Text style={styles.toolChipText}>Trim</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.toolChip}
                onPress={() => selectedKey && removeItem(selectedKey)}>
                <MaterialIcons name="delete" size={18} color="#ff6b6b" />
                <Text style={[styles.toolChipText, { color: '#ff6b6b' }]}>Delete</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.toolChip} onPress={() => setShowResModal(true)}>
                <MaterialIcons name="hd" size={18} color="#00d4d4" />
                <Text style={[styles.toolChipText, { color: '#00d4d4' }]}>{resolution}</Text>
              </TouchableOpacity>
            </ScrollView>
            {selectedItem && (
              <View style={styles.clipInfo}>
                <Text style={styles.clipInfoText}>
                  {selectedItem.type === 'image' ? '🖼 Photo' : '▶ Video'} •
                  {selectedItem.type === 'image'
                    ? ` ${selectedItem.duration}s`
                    : ` ${(selectedItem.trimEnd || 0).toFixed(1)}s`}
                  {selectedItem.speed !== 1 ? ` • ${selectedItem.speed}x` : ''}
                </Text>
                {selectedItem.type === 'image' && (
                  <View style={styles.durationRow}>
                    <Text style={styles.clipInfoLabel}>Duration: {selectedItem.duration}s</Text>
                    <Slider style={{ flex: 1, height: 30 }}
                      minimumValue={1} maximumValue={10} step={1}
                      value={selectedItem.duration}
                      minimumTrackTintColor="#00d4d4"
                      maximumTrackTintColor="#333"
                      thumbTintColor="#00d4d4"
                      onValueChange={v => setItems(prev =>
                        prev.map(i => i.key === selectedKey ? { ...i, duration: v } : i))}
                    />
                  </View>
                )}
              </View>
            )}
          </View>
        );case 'Audio':
        return (
          <View style={styles.tabContent}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <TouchableOpacity style={styles.toolChip} onPress={pickAudio}>
                <MaterialIcons name="add" size={18} color="#fff" />
                <Text style={styles.toolChipText}>Add Music</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.toolChip} onPress={() => setShowVolumeModal(true)}>
                <MaterialIcons name="volume-up" size={18} color="#fff" />
                <Text style={styles.toolChipText}>Volume</Text>
              </TouchableOpacity>
              {selectedItem && (
                <TouchableOpacity style={styles.toolChip}
                  onPress={() => setItems(prev => prev.map(i =>
                    i.key === selectedKey ? { ...i, muted: !i.muted } : i))}>
                  <MaterialIcons name={selectedItem.muted ? 'volume-off' : 'volume-up'} size={18} color="#fff" />
                  <Text style={styles.toolChipText}>{selectedItem.muted ? 'Unmute' : 'Mute'}</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
            {audioTracks.length > 0 && (
              <ScrollView style={{ maxHeight: 80 }}>
                {audioTracks.map(track => (
                  <View key={track.key} style={styles.audioTrackRow}>
                    <MaterialIcons name="music-note" size={14} color="#00d4d4" />
                    <Text style={styles.audioTrackName} numberOfLines={1}>{track.name}</Text>
                    <TouchableOpacity onPress={() => setAudioTracks(prev => prev.filter(t => t.key !== track.key))}>
                      <MaterialIcons name="close" size={14} color="#888" />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        );

      case 'Text':
        return (
          <View style={styles.tabContent}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <TouchableOpacity style={styles.toolChip} onPress={() => { setEditingText(null); setTextInput(''); setShowTextModal(true); }}>
                <MaterialIcons name="add" size={18} color="#fff" />
                <Text style={styles.toolChipText}>Add Text</Text>
              </TouchableOpacity>
            </ScrollView>
            {textOverlays.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                {textOverlays.map(t => (
                  <TouchableOpacity key={t.key} style={styles.textChip}
                    onLongPress={() => removeTextOverlay(t.key)}
                    onPress={() => { setEditingText(t); setTextInput(t.text); setTextColor(t.color); setTextFont(t.font); setTextSize(t.size); setShowTextModal(true); }}>
                    <Text style={[styles.textChipText, { color: t.color }]}>{t.text}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        );

      case 'Effects':
        return (
          <View style={styles.tabContent}>
            <Text style={styles.tabSectionLabel}>FILTERS</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
              {FILTERS.map(f => (
                <TouchableOpacity key={f}
                  style={[styles.toolChip, selectedFilter === f && styles.toolChipActive]}
                  onPress={() => applyFilter(f)}>
                  <Text style={[styles.toolChipText, selectedFilter === f && { color: '#000' }]}>{f}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Text style={styles.tabSectionLabel}>SPEED</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
              {SPEEDS.map(s => (
                <TouchableOpacity key={s}
                  style={[styles.toolChip, selectedSpeed === s && styles.toolChipActive]}
                  onPress={() => applySpeed(s)}>
                  <Text style={[styles.toolChipText, selectedSpeed === s && { color: '#000' }]}>{s}x</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Text style={styles.tabSectionLabel}>TRANSITIONS</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {TRANSITIONS.map(t => (
                <TouchableOpacity key={t}
                  style={[styles.toolChip, selectedTransition === t && styles.toolChipActive]}
                  onPress={() => applyTransition(t)}>
                  <Text style={[styles.toolChipText, selectedTransition === t && { color: '#000' }]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        );

      case 'Overlay':
        return (
          <View style={styles.tabContent}>
            <TouchableOpacity style={styles.toolChip} onPress={pickMedia}>
              <MaterialIcons name="add-photo-alternate" size={18} color="#fff" />
              <Text style={styles.toolChipText}>Add Overlay</Text>
            </TouchableOpacity>
            <Text style={styles.tabSectionLabel} style={{ marginTop: 8, color: '#555', fontSize: 11 }}>
              Tap Add Overlay to add image/video on top
            </Text>
          </View>
        );

      case 'Captions':
        return (
          <View style={styles.tabContent}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <TouchableOpacity style={styles.toolChip}
                onPress={() => Alert.alert('Auto Captions', 'Auto captions will be generated during export.')}>
                <MaterialIcons name="closed-caption" size={18} color="#fff" />
                <Text style={styles.toolChipText}>Auto Captions</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.toolChip]}
                onPress={() => { setEditingText(null); setTextInput(''); setShowTextModal(true); }}>
                <MaterialIcons name="add" size={18} color="#fff" />
                <Text style={styles.toolChipText}>Add Caption</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        );

      default: return null;
    }
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
        <TouchableOpacity style={styles.qualityBtn} onPress={() => setShowResModal(true)}>
          <MaterialIcons name="diamond" size={14} color="#00d4d4" />
          <Text style={styles.qualityText}>AI UHD</Text>
          <MaterialIcons name="keyboard-arrow-down" size={16} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.exportBtn, items.length > 0 && !uploading && styles.exportBtnActive]}
          onPress={processVideo} disabled={uploading || items.length === 0}>
          {uploading
            ? <ActivityIndicator color="#000" size="small" />
            : <Text style={[styles.exportBtnText, items.length > 0 && { color: '#000' }]}>Export</Text>}
        </TouchableOpacity>
      </View>

      {/* VIDEO PREVIEW */}
      <View style={styles.previewContainer}>
        <View style={styles.previewFrame}>
          {previewItem ? (
            previewItem.type === 'video' ? (
              <Video ref={videoRef} source={{ uri: previewItem.uri }}
                style={styles.previewImage} resizeMode="cover"
                shouldPlay={isPlaying} isLooping={false}
                isMuted={previewItem.muted} rate={previewItem.speed || 1} />
            ) : (
              <Image source={{ uri: previewItem.uri }}
                style={styles.previewImage} resizeMode="cover" />
            )
          ) : (
            <View style={styles.previewEmpty}>
              <MaterialIcons name="movie" size={48} color="#333" />
              <Text style={styles.previewEmptyText}>Add media to get started</Text>
            </View>
          )}
          {/* Text overlays on preview */}
          {textOverlays.map(t => (
            <Text key={t.key} style={[styles.textOverlayPreview, {
              color: t.color, fontSize: t.size,
              fontWeight: t.font === 'Bold' ? 'bold' : 'normal',
              fontStyle: t.font === 'Italic' ? 'italic' : 'normal',
            }]}>{t.text}</Text>
          ))}
        </View>

        {/* Playback controls */}
        <View style={styles.playbackRow}>
          <TouchableOpacity style={styles.playBtn} onPress={() => setShowResModal(true)}>
            <MaterialIcons name="fullscreen" size={22} color="#888" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.playBtn} onPress={() => setPosition(Math.max(0, position - 1))}>
            <MaterialIcons name="arrow-back" size={22} color="#888" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.playBtnMain} onPress={() => setIsPlaying(!isPlaying)}>
            <MaterialIcons name={isPlaying ? 'pause' : 'play-arrow'} size={36} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.playBtn} onPress={() => setPosition(Math.min(duration, position + 1))}>
            <MaterialIcons name="arrow-forward" size={22} color="#888" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.playBtn}>
            <MaterialIcons name="undo" size={22} color="#888" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.playBtn}>
            <MaterialIcons name="redo" size={22} color="#888" />
          </TouchableOpacity>
        </View>
      </View> {/* TIMELINE */}
      <View style={styles.timeline}>
        <View style={styles.timecodeRow}>
          <Text style={styles.timecode}>{fmtTime(position)} / {fmtTime(duration)}</Text>
          <View style={styles.timeMarkers}>
            {[0,1,2,3,4].map(t => (
              <Text key={t} style={styles.timeMarker}>{fmtTime(t)}</Text>
            ))}
          </View>
        </View>

        <View style={styles.trackArea}>
          {/* Sidebar */}
          <View style={styles.sidebar}>
            <TouchableOpacity style={styles.sideBtn}
              onPress={() => selectedItem && setItems(prev =>
                prev.map(i => i.key === selectedKey ? { ...i, muted: !i.muted } : i))}>
              <MaterialIcons name={selectedItem?.muted ? 'volume-off' : 'volume-up'} size={18} color="#888" />
              <Text style={styles.sideBtnLabel}>Mute{'\n'}clip</Text>
            </TouchableOpacity>
            <View style={styles.coverThumbWrap}>
              {items.length > 0
                ? <Image source={{ uri: items[0].uri }} style={styles.coverThumbImg} resizeMode="cover" />
                : <View style={styles.coverThumbEmpty} />}
              <MaterialIcons name="edit" size={10} color="#fff" style={styles.coverEditIcon} />
              <Text style={styles.sideBtnLabel}>Cover</Text>
            </View>
            <TouchableOpacity style={styles.sideBtn}>
              <MaterialIcons name="music-note" size={18} color="#888" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.sideBtn}>
              <MaterialIcons name="title" size={18} color="#888" />
            </TouchableOpacity>
          </View>

          {/* Clips + scrubber */}
          <View style={styles.clipsWrapper}>
            <View style={styles.scrubberLine} pointerEvents="none" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.clipsScroll}>
              {items.map((item, idx) => (
                <TouchableOpacity key={item.key}
                  onPress={() => setSelectedKey(item.key === selectedKey ? null : item.key)}
                  onLongPress={() => openTrim(item)}
                  activeOpacity={0.85}>
                  <View style={[styles.clipFrame, item.key === selectedKey && styles.clipFrameSelected]}>
                    <Image source={{ uri: item.uri }} style={styles.clipFrameImg} resizeMode="cover" />
                    {idx === 0 && (
                      <View style={styles.coverBadge}>
                        <MaterialIcons name="edit" size={9} color="#fff" />
                        <Text style={styles.coverText}>Cover</Text>
                      </View>
                    )}
                    {item.muted && (
                      <View style={styles.mutedBadge}>
                        <MaterialIcons name="volume-off" size={10} color="#fff" />
                      </View>
                    )}
                    {item.speed && item.speed !== 1 && (
                      <View style={styles.speedBadge}>
                        <Text style={styles.speedBadgeText}>{item.speed}x</Text>
                      </View>
                    )}
                    <View style={styles.clipBottom}>
                      <Text style={styles.clipDuration}>
                        {item.type === 'image' ? item.duration + 's' : (item.trimEnd ? item.trimEnd.toFixed(1) + 's' : 'Full')}
                      </Text>
                    </View>
                    {item.key === selectedKey && (
                      <TouchableOpacity style={styles.clipRemove} onPress={() => removeItem(item.key)}>
                        <MaterialIcons name="close" size={11} color="#fff" />
                      </TouchableOpacity>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={styles.addClipBtn} onPress={pickMedia}>
                <MaterialIcons name="add" size={22} color="#888" />
              </TouchableOpacity>
            </ScrollView>

            {/* Aux tracks */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.auxScroll}>
              <TouchableOpacity style={styles.auxTrackBtn} onPress={pickAudio}>
                <MaterialIcons name="add" size={12} color="#555" />
                <Text style={styles.auxLabel}>Add audio</Text>
              </TouchableOpacity>
            </ScrollView>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.auxScroll}>
              <TouchableOpacity style={styles.auxTrackBtn}
                onPress={() => { setEditingText(null); setTextInput(''); setShowTextModal(true); }}>
                <MaterialIcons name="add" size={12} color="#555" />
                <Text style={styles.auxLabel}>Add text</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </View>

      {/* TAB CONTENT PANEL */}
      <View style={styles.tabPanel}>
        {renderTabContent()}
      </View>

      {/* BOTTOM TOOLBAR */}
      <View style={[styles.bottomToolbar, { paddingBottom: insets.bottom || 16 }]}>
        {bottomTabs.map(tab => (
          <TouchableOpacity key={tab.name} style={styles.tabBtn} onPress={() => setActiveTab(tab.name)}>
            <MaterialIcons name={tab.icon} size={22} color={activeTab === tab.name ? '#00d4d4' : '#555'} />
            <Text style={[styles.tabLabel, activeTab === tab.name && { color: '#00d4d4' }]}>{tab.name}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* UPLOAD OVERLAY */}
      {uploading && (
        <View style={styles.uploadOverlay}>
          <ActivityIndicator color="#00d4d4" size="large" />
          <Text style={styles.uploadMsg}>{message}</Text>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: progress + '%' }]} />
          </View>
          <Text style={styles.progressText}>{progress}%</Text>
        </View>
      )}

      {/* TRIM MODAL */}
      <Modal visible={showTrimModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Trim Clip</Text>
            {trimItem && (
              <>
                <Text style={styles.modalLabel}>Start: {trimStart.toFixed(1)}s</Text>
                <Slider style={styles.modalSlider}
                  minimumValue={0}
                  maximumValue={trimItem.sourceDuration || trimItem.duration || 10}
                  value={trimStart}
                  minimumTrackTintColor="#00d4d4"
                  maximumTrackTintColor="#333"
                  thumbTintColor="#00d4d4"
                  onValueChange={setTrimStart} />
                <Text style={styles.modalLabel}>End: {trimEnd.toFixed(1)}s</Text>
                <Slider style={styles.modalSlider}
                  minimumValue={0}
                  maximumValue={trimItem.sourceDuration || trimItem.duration || 10}
                  value={trimEnd}
                  minimumTrackTintColor="#00d4d4"
                  maximumTrackTintColor="#333"
                  thumbTintColor="#00d4d4"
                  onValueChange={setTrimEnd} />
              </>
            )}
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalBtnCancel} onPress={() => setShowTrimModal(false)}>
                <Text style={styles.modalBtnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBtnApply} onPress={applyTrim}>
                <Text style={styles.modalBtnApplyText}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* TEXT MODAL */}
      <Modal visible={showTextModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>{editingText ? 'Edit Text' : 'Add Text'}</Text>
            <TextInput style={styles.textModalInput} value={textInput}
              onChangeText={setTextInput} placeholder="Enter text..."
              placeholderTextColor="#555" multiline />
            <Text style={styles.modalLabel}>Color</Text>
            <View style={styles.colorRow}>
              {TEXT_COLORS.map(c => (
                <TouchableOpacity key={c} style={[styles.colorDot, { backgroundColor: c },
                  textColor === c && styles.colorDotSelected]}
                  onPress={() => setTextColor(c)} />
              ))}
            </View>
            <Text style={styles.modalLabel}>Font</Text>
            <View style={styles.fontRow}>
              {FONTS.map(f => (
                <TouchableOpacity key={f} style={[styles.fontChip, textFont === f && styles.fontChipActive]}
                  onPress={() => setTextFont(f)}>
                  <Text style={[styles.fontChipText, textFont === f && { color: '#000' }]}>{f}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.modalLabel}>Size: {textSize}</Text>
            <Slider style={styles.modalSlider} minimumValue={10} maximumValue={48} step={2}
              value={textSize} minimumTrackTintColor="#00d4d4" maximumTrackTintColor="#333"
              thumbTintColor="#00d4d4" onValueChange={setTextSize} />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalBtnCancel} onPress={() => setShowTextModal(false)}>
                <Text style={styles.modalBtnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBtnApply} onPress={addTextOverlay}>
                <Text style={styles.modalBtnApplyText}>
                  {editingText ? 'Update' : 'Add'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>   {/* VOLUME MODAL */}
      <Modal visible={showVolumeModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Master Volume</Text>
            <Text style={styles.modalLabel}>{Math.round(masterVolume * 100)}%</Text>
            <Slider style={styles.modalSlider} minimumValue={0} maximumValue={1}
              value={masterVolume} minimumTrackTintColor="#00d4d4" maximumTrackTintColor="#333"
              thumbTintColor="#00d4d4" onValueChange={setMasterVolume} />
            <TouchableOpacity style={styles.modalBtnApply} onPress={() => setShowVolumeModal(false)}>
              <Text style={styles.modalBtnApplyText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* RESOLUTION MODAL */}
      <Modal visible={showResModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Export Resolution</Text>
            {['720p','1080p','4K'].map(r => (
              <TouchableOpacity key={r} style={[styles.resRow, resolution === r && styles.resRowActive]}
                onPress={() => { setResolution(r); setShowResModal(false); }}>
                <Text style={[styles.resText, resolution === r && { color: '#00d4d4' }]}>{r}</Text>
                {resolution === r && <MaterialIcons name="check" size={18} color="#00d4d4" />}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, gap: 4 },
  topBtn: { padding: 4 },
  qualityBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a1a', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginRight: 8, gap: 4, borderWidth: 1, borderColor: '#333' },
  qualityText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  exportBtn: { backgroundColor: '#1a1a1a', borderRadius: 8, paddingHorizontal: 20, paddingVertical: 8 },
  exportBtnActive: { backgroundColor: '#00d4d4' },
  exportBtnText: { color: '#888', fontWeight: '700', fontSize: 14 },

  previewContainer: { alignItems: 'center', paddingVertical: 6, backgroundColor: '#000' },
  previewFrame: { width: SW * 0.5, aspectRatio: 9/16, backgroundColor: '#111', borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: '#222' },
  previewImage: { width: '100%', height: '100%' },
  previewEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  previewEmptyText: { color: '#444', fontSize: 12 },
  textOverlayPreview: { position: 'absolute', bottom: 40, left: 0, right: 0, textAlign: 'center', textShadowColor: '#000', textShadowRadius: 4 },
  playbackRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 8 },
  playBtn: { padding: 4 },
  playBtnMain: { padding: 4 },

  timeline: { flex: 1, backgroundColor: '#0a0a0a', borderTopWidth: 1, borderTopColor: '#1a1a1a' },
  timecodeRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 4 },
  timecode: { color: '#555', fontSize: 10, fontFamily: 'monospace' },
  timeMarkers: { flexDirection: 'row', gap: 20 },
  timeMarker: { color: '#333', fontSize: 9 },
  trackArea: { flex: 1, flexDirection: 'row' },
  sidebar: { width: 72, alignItems: 'center', paddingTop: 8, gap: 12, borderRightWidth: 1, borderRightColor: '#1a1a1a' },
  sideBtn: { alignItems: 'center', gap: 2 },
  sideBtnLabel: { color: '#555', fontSize: 9, textAlign: 'center' },
  coverThumbWrap: { alignItems: 'center', gap: 2 },
  coverThumbImg: { width: 40, height: 48, borderRadius: 4, backgroundColor: '#1a1a1a' },
  coverThumbEmpty: { width: 40, height: 48, borderRadius: 4, backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#333' },
  coverEditIcon: { position: 'absolute', top: 2, right: -2 },
  clipsWrapper: { flex: 1, position: 'relative' },
  scrubberLine: { position: 'absolute', top: 0, bottom: 0, left: '50%', width: 2, backgroundColor: '#fff', zIndex: 10, opacity: 0.9 },
  clipsScroll: { paddingLeft: '50%', paddingRight: 40, alignItems: 'center', paddingVertical: 6 },
  clipFrame: { width: CLIP_W, height: CLIP_H, borderRadius: 3, overflow: 'hidden', marginRight: 2, borderWidth: 1, borderColor: '#333', position: 'relative' },
  clipFrameSelected: { borderColor: '#00d4d4', borderWidth: 2 },
  clipFrameImg: { width: '100%', height: '100%' },
  coverBadge: { position: 'absolute', top: 3, left: 3, backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 3, flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 3, paddingVertical: 1 },
  coverText: { color: '#fff', fontSize: 8, fontWeight: '700' },
  mutedBadge: { position: 'absolute', top: 3, right: 3, backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 10, padding: 2 },
  speedBadge: { position: 'absolute', bottom: 14, right: 3, backgroundColor: '#00d4d430', borderRadius: 3, paddingHorizontal: 3 },
  speedBadgeText: { color: '#00d4d4', fontSize: 8, fontWeight: '700' },
  clipBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 3, paddingVertical: 1 },
  clipDuration: { color: '#fff', fontSize: 8, fontWeight: '700' },
  clipRemove: { position: 'absolute', top: 3, right: 3, backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 10, width: 16, height: 16, alignItems: 'center', justifyContent: 'center' },
  addClipBtn: { width: 40, height: CLIP_H, borderRadius: 3, borderWidth: 1, borderColor: '#333', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', backgroundColor: '#111', marginLeft: 2 },
  auxScroll: { paddingLeft: '50%', paddingRight: 40 },
  auxTrackBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 26, paddingHorizontal: 12, borderRadius: 13, borderWidth: 1, borderColor: '#222', backgroundColor: '#111' },
  auxLabel: { color: '#555', fontSize: 11 },

  tabPanel: { backgroundColor: '#0a0a0a', borderTopWidth: 1, borderTopColor: '#1a1a1a', minHeight: 80, maxHeight: 140 },
  tabContent: { padding: 10 },
  tabSectionLabel: { color: '#555', fontSize: 10, fontWeight: '700', letterSpacing: 1, marginBottom: 6 },
  toolChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#1a1a1a', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, marginRight: 8, borderWidth: 1, borderColor: '#2a2a2a' },
  toolChipActive: { backgroundColor: '#00d4d4', borderColor: '#00d4d4' },
  toolChipText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  clipInfo: { marginTop: 8 },
  clipInfoText: { color: '#888', fontSize: 11, marginBottom: 4 },
  clipInfoLabel: { color: '#666', fontSize: 11, width: 90 },
  durationRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  audioTrackRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#1a1a1a', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginTop: 4 },
  audioTrackName: { flex: 1, color: '#fff', fontSize: 12 },
  textChip: { backgroundColor: '#1a1a1a', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, marginRight: 8, borderWidth: 1, borderColor: '#2a2a2a' },
  textChipText: { fontSize: 13 },
  fontRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  fontChip: { backgroundColor: '#1a1a1a', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: '#2a2a2a' },
  fontChipActive: { backgroundColor: '#00d4d4', borderColor: '#00d4d4' },
  fontChipText: { color: '#fff', fontSize: 12 },

  bottomToolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingTop: 10, borderTopWidth: 1, borderTopColor: '#1a1a1a', backgroundColor: '#000' },
  tabBtn: { alignItems: 'center', gap: 3, flex: 1 },
  tabLabel: { color: '#555', fontSize: 10, fontWeight: '600' },

  uploadOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.88)', alignItems: 'center', justifyContent: 'center', gap: 16, zIndex: 100 },
  uploadMsg: { color: '#aaa', fontSize: 13 },
  progressBarBg: { width: '70%', height: 6, backgroundColor: '#222', borderRadius: 3, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#00d4d4', borderRadius: 3 },
  progressText: { color: '#00d4d4', fontSize: 13, fontWeight: '700' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#111', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
  modalTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 16 },
  modalLabel: { color: '#888', fontSize: 12, marginBottom: 4, marginTop: 8 },
  modalSlider: { width: '100%', height: 32 },
  modalBtns: { flexDirection: 'row', gap: 12, marginTop: 16 },
  modalBtnCancel: { flex: 1, backgroundColor: '#1a1a1a', borderRadius: 12, padding: 14, alignItems: 'center' },
  modalBtnCancelText: { color: '#888', fontWeight: '600' },
  modalBtnApply: { flex: 1, backgroundColor: '#00d4d4', borderRadius: 12, padding: 14, alignItems: 'center' },
  modalBtnApplyText: { color: '#000', fontWeight: '700' },
  textModalInput: { backgroundColor: '#1a1a1a', borderRadius: 10, padding: 12, color: '#fff', fontSize: 15, minHeight: 60, borderWidth: 1, borderColor: '#2a2a2a', marginBottom: 8 },
  colorRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  colorDot: { width: 28, height: 28, borderRadius: 14 },
  colorDotSelected: { borderWidth: 3, borderColor: '#00d4d4' },
  resRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#1a1a1a' },
  resRowActive: { },
  resText: { color: '#fff', fontSize: 15 },
});
