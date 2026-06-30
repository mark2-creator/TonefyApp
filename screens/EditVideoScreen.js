import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, Image, ScrollView,
  StyleSheet, ActivityIndicator, Alert, StatusBar,
  Dimensions, Modal, TextInput, PanResponder, Animated
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Video, Audio } from 'expo-av';
import * as DocumentPicker from 'expo-document-picker';
import Slider from '@react-native-community/slider';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { auth } from '../firebase';

const BACKEND = 'https://api.fitlifesolutions.site';
const { width: SW, height: SH } = Dimensions.get('window');
const PIXELS_PER_SECOND = 40;
const PREVIEW_W = SW * 0.5;
const PREVIEW_H = PREVIEW_W * (16/9);
const CLIP_W = 72;
const CLIP_H = 56;

const FILTERS = ['None','Bright','Contrast','Warm','Cool','Fade','B&W'];
const SPEEDS = [0.3, 0.5, 1, 1.5, 2, 3];
const FONTS = ['Default','Bold','Italic','Mono'];
const TEXT_COLORS = ['#fff','#000','#ff0','#f00','#0f0','#00f','#f0f','#0ff'];
const TRANSITION_STYLES = [
  { id: 'none',        label: 'Cut',          icon: '✂️',  group: 'Basic' },
  { id: 'fade',        label: 'Fade',         icon: '🌅', group: 'Basic' },
  { id: 'fadewhite',   label: 'Flash White',  icon: '⚡', group: 'Trendy' },
  { id: 'fadeblack',   label: 'Fade Black',   icon: '⬛', group: 'Basic' },
  { id: 'fadefast',    label: 'Flash Cut',    icon: '💥', group: 'Trendy' },
  { id: 'fadeslow',    label: 'Slow Burn',    icon: '🌙', group: 'Cinematic' },
  { id: 'zoomin',      label: 'Zoom In',      icon: '🚀', group: 'Trendy' },
  { id: 'hblur',       label: 'Blur Wipe',    icon: '💫', group: 'Trendy' },
  { id: 'pixelize',    label: 'Pixelate',     icon: '🟦', group: 'Trendy' },
  { id: 'dissolve',    label: 'Dissolve',     icon: '💧', group: 'Basic' },
  { id: 'radial',      label: 'Radial',       icon: '🌀', group: 'Cinematic' },
  { id: 'circleopen',  label: 'Circle Open',  icon: '⭕', group: 'Cinematic' },
  { id: 'circleclose', label: 'Circle Close', icon: '🔵', group: 'Cinematic' },
  { id: 'coverleft',   label: 'Cover Left',   icon: '⬅️', group: 'Trendy' },
  { id: 'coverright',  label: 'Cover Right',  icon: '➡️', group: 'Trendy' },
  { id: 'coverup',     label: 'Cover Up',     icon: '⬆️', group: 'Trendy' },
  { id: 'coverdown',   label: 'Cover Down',   icon: '⬇️', group: 'Trendy' },
  { id: 'slideleft',   label: 'Slide Left',   icon: '◀️', group: 'Basic' },
  { id: 'slideright',  label: 'Slide Right',  icon: '▶️', group: 'Basic' },
  { id: 'slideup',     label: 'Slide Up',     icon: '🔼', group: 'Basic' },
  { id: 'slidedown',   label: 'Slide Down',   icon: '🔽', group: 'Basic' },
  { id: 'wipeleft',    label: 'Wipe Left',    icon: '🧹', group: 'Basic' },
  { id: 'wiperight',   label: 'Wipe Right',   icon: '🧹', group: 'Basic' },
  { id: 'hlslice',     label: 'H Slices',     icon: '🔪', group: 'Trendy' },
  { id: 'vuslice',     label: 'V Slices',     icon: '🔪', group: 'Trendy' },
  { id: 'hlwind',      label: 'H Wind',       icon: '💨', group: 'Trendy' },
  { id: 'vuwind',      label: 'V Wind',       icon: '💨', group: 'Trendy' },
];

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

function TransitionPreview({ item }) {
  const anim = React.useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 100, useNativeDriver: true }),
        Animated.delay(600),
      ])
    ).start();
  }, []);
  const W = 70, H = 44;
  const IMG_A = { uri: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=200&q=60' };
  const IMG_B = { uri: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=200&q=60' };
  const imgStyle = { position: 'absolute', width: W, height: H, resizeMode: 'cover' };
  const getPreview = () => {
    switch(item.id) {
      case 'fade': case 'fadeslow': case 'fadefast': case 'dissolve':
        return (<View style={{ width: W, height: H, borderRadius: 6, overflow: 'hidden' }}>
          <Image source={IMG_A} style={imgStyle} />
          <Animated.Image source={IMG_B} style={[imgStyle, { opacity: anim }]} />
        </View>);
      case 'slideleft': case 'smoothleft': case 'coverleft': case 'wipeleft': case 'hlslice': case 'hlwind':
        return (<View style={{ width: W, height: H, borderRadius: 6, overflow: 'hidden' }}>
          <Image source={IMG_A} style={imgStyle} />
          <Animated.Image source={IMG_B} style={[imgStyle, { transform: [{ translateX: anim.interpolate({ inputRange: [0,1], outputRange: [W, 0] }) }] }]} />
        </View>);
      case 'slideright': case 'smoothright': case 'coverright': case 'wiperight':
        return (<View style={{ width: W, height: H, borderRadius: 6, overflow: 'hidden' }}>
          <Image source={IMG_A} style={imgStyle} />
          <Animated.Image source={IMG_B} style={[imgStyle, { transform: [{ translateX: anim.interpolate({ inputRange: [0,1], outputRange: [-W, 0] }) }] }]} />
        </View>);
      case 'slideup': case 'smoothup': case 'coverup': case 'wipeup': case 'vuslice': case 'vuwind':
        return (<View style={{ width: W, height: H, borderRadius: 6, overflow: 'hidden' }}>
          <Image source={IMG_A} style={imgStyle} />
          <Animated.Image source={IMG_B} style={[imgStyle, { transform: [{ translateY: anim.interpolate({ inputRange: [0,1], outputRange: [H, 0] }) }] }]} />
        </View>);
      case 'slidedown': case 'smoothdown': case 'coverdown': case 'wipedown':
        return (<View style={{ width: W, height: H, borderRadius: 6, overflow: 'hidden' }}>
          <Image source={IMG_A} style={imgStyle} />
          <Animated.Image source={IMG_B} style={[imgStyle, { transform: [{ translateY: anim.interpolate({ inputRange: [0,1], outputRange: [-H, 0] }) }] }]} />
        </View>);
      case 'zoomin':
        return (<View style={{ width: W, height: H, borderRadius: 6, overflow: 'hidden' }}>
          <Image source={IMG_B} style={imgStyle} />
          <Animated.Image source={IMG_A} style={[imgStyle, { transform: [{ scale: anim.interpolate({ inputRange: [0,1], outputRange: [1, 2.5] }) }], opacity: anim.interpolate({ inputRange: [0, 0.8, 1], outputRange: [1, 0.3, 0] }) }]} />
        </View>);
      case 'fadewhite':
        return (<View style={{ width: W, height: H, borderRadius: 6, overflow: 'hidden' }}>
          <Image source={IMG_A} style={imgStyle} />
          <Animated.View style={{ ...imgStyle, backgroundColor: '#fff', opacity: anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 1, 0] }) }} />
          <Animated.Image source={IMG_B} style={[imgStyle, { opacity: anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0, 1] }) }]} />
        </View>);
      case 'fadeblack':
        return (<View style={{ width: W, height: H, borderRadius: 6, overflow: 'hidden' }}>
          <Image source={IMG_A} style={imgStyle} />
          <Animated.View style={{ ...imgStyle, backgroundColor: '#000', opacity: anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 1, 0] }) }} />
          <Animated.Image source={IMG_B} style={[imgStyle, { opacity: anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0, 1] }) }]} />
        </View>);
      case 'radial': case 'circleopen': case 'circleclose': case 'hblur': case 'pixelize':
        return (<View style={{ width: W, height: H, borderRadius: 6, overflow: 'hidden' }}>
          <Image source={IMG_A} style={imgStyle} />
          <Animated.Image source={IMG_B} style={[imgStyle, { opacity: anim, transform: [{ scale: anim.interpolate({ inputRange: [0,1], outputRange: [1.15, 1] }) }] }]} />
        </View>);
      default:
        return (<View style={{ width: W, height: H, borderRadius: 6, overflow: 'hidden' }}>
          <Image source={IMG_A} style={imgStyle} />
          <Animated.Image source={IMG_B} style={[imgStyle, { opacity: anim }]} />
        </View>);
    }
  };
  return <View style={{ marginBottom: 6 }}>{getPreview()}</View>;
}

function TransitionModal({ visible, targetKey, onSelect, onClose }) {
  const groups = ['Basic', 'Trendy', 'Cinematic'];
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={{ flex:1, backgroundColor:'rgba(0,0,0,0.6)', justifyContent:'flex-end' }} activeOpacity={1} onPress={onClose}>
        <View style={{ backgroundColor:'#111', borderTopLeftRadius:20, borderTopRightRadius:20, padding:16, maxHeight:'85%' }}>
          <View style={{ width:36, height:4, backgroundColor:'#333', borderRadius:2, alignSelf:'center', marginBottom:12 }} />
          <Text style={{ color:'#fff', fontSize:16, fontWeight:'bold', marginBottom:12 }}>🎬 Transition Style</Text>
          <ScrollView>
            {groups.map(group => {
              const items = TRANSITION_STYLES.filter(o => o.group === group);
              if (!items.length) return null;
              return (
                <View key={group} style={{ marginBottom: 16 }}>
                  <Text style={{ color:'#888', fontSize:11, fontWeight:'bold', letterSpacing:1, marginBottom:8 }}>{group.toUpperCase()}</Text>
                  <View style={{ flexDirection:'row', flexWrap:'wrap', gap:8 }}>
                    {items.map(item => (
                      <TouchableOpacity key={item.id}
                        onPress={() => { onSelect(targetKey, item.id); onClose(); }}
                        style={{ width:'30%', backgroundColor:'#1a1a1a', borderWidth:1.5, borderColor:'#333', borderRadius:12, padding:8, alignItems:'center' }}>
                        <TransitionPreview item={item} />
                        <Text style={{ color:'#fff', fontSize:10, fontWeight:'bold', textAlign:'center' }}>{item.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

function WaveformBars({ peaks, color = '#00d4d4', height = 28 }) {
  if (!peaks || peaks.length === 0) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height, gap: 1 }}>
        {Array.from({ length: 20 }).map((_, i) => (
          <View key={i} style={{ width: 2, height: 4, backgroundColor: '#333', borderRadius: 1 }} />
        ))}
      </View>
    );
  }
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', height, gap: 1 }}>
      {peaks.map((p, i) => (
        <View key={i} style={{
          width: 2,
          height: Math.max(2, p * height),
          backgroundColor: color,
          borderRadius: 1,
        }} />
      ))}
    </View>
  );
}

function DraggableTextOverlay({ overlay, containerW, containerH, onMove, onTap }) {
  const pan = useRef(new Animated.ValueXY({
    x: (overlay.x / 100) * containerW,
    y: (overlay.y / 100) * containerH,
  })).current;
  const lastPos = useRef({ x: (overlay.x / 100) * containerW, y: (overlay.y / 100) * containerH });

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (e, g) => Math.abs(g.dx) > 3 || Math.abs(g.dy) > 3,
      onPanResponderGrant: () => {
        pan.setOffset({ x: lastPos.current.x, y: lastPos.current.y });
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
      onPanResponderRelease: (e, g) => {
        pan.flattenOffset();
        let newX = lastPos.current.x + g.dx;
        let newY = lastPos.current.y + g.dy;
        newX = Math.max(0, Math.min(containerW - 20, newX));
        newY = Math.max(0, Math.min(containerH - 20, newY));
        lastPos.current = { x: newX, y: newY };
        pan.setValue({ x: newX, y: newY });
        const xPct = (newX / containerW) * 100;
        const yPct = (newY / containerH) * 100;
        onMove(overlay.key, xPct, yPct);
      },
    })
  ).current;

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={{ position: 'absolute', transform: pan.getTranslateTransform() }}>
      <TouchableOpacity onPress={() => onTap(overlay)} activeOpacity={0.7}>
        <Text style={{
          color: overlay.color, fontSize: overlay.size,
          fontWeight: overlay.font === 'Bold' ? 'bold' : 'normal',
          fontStyle: overlay.font === 'Italic' ? 'italic' : 'normal',
          textShadowColor: '#000', textShadowRadius: 4, textShadowOffset: { width: 1, height: 1 },
        }}>{overlay.text}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

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
  const timelineScrollRef = useRef(null);
  const isUserScrubbing = useRef(false);

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

  // Voiceover
  const [showVoiceoverModal, setShowVoiceoverModal] = useState(false);
  const [voiceoverTab, setVoiceoverTab] = useState('generate'); // 'generate' | 'file'
  const [voiceoverScript, setVoiceoverScript] = useState('');
  const [voiceId, setVoiceId] = useState('gtts-us');
  const [voiceoverTracks, setVoiceoverTracks] = useState([]);
  const [generatingVoiceover, setGeneratingVoiceover] = useState(false);
  const [voiceoverPreviewSound, setVoiceoverPreviewSound] = useState(null);
  const [voiceoverPreviewPlaying, setVoiceoverPreviewPlaying] = useState(false);

  // Waveforms
  const [waveformCache, setWaveformCache] = useState({});

  // Music library
  const [showMusicModal, setShowMusicModal] = useState(false);
  const [musicTab, setMusicTab] = useState('library'); // 'library' | 'device'
  const [musicLibraryTracks, setMusicLibraryTracks] = useState([]);
  const [musicLoading, setMusicLoading] = useState(false);
  const [musicPreviewSound, setMusicPreviewSound] = useState(null);
  const [musicPreviewPlayingId, setMusicPreviewPlayingId] = useState(null);

  // Transition picker
  const [showTransitionModal, setShowTransitionModal] = useState(false);
  const [transitionTargetKey, setTransitionTargetKey] = useState(null);

  // Undo/Redo history
  const [history, setHistory] = useState([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // Overlays
  const [overlays, setOverlays] = useState([]);

  // Captions
  const [showCaptionModal, setShowCaptionModal] = useState(false);
  const [captionScript, setCaptionScript] = useState('');
  const [captionStyle, setCaptionStyle] = useState('classic');

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

  // Sync timeline scroll to playback position (CapCut-style fixed playhead)
  useEffect(() => {
    if (isUserScrubbing.current) return;
    if (timelineScrollRef.current) {
      timelineScrollRef.current.scrollTo({ x: position * PIXELS_PER_SECOND, animated: false });
    }
  }, [position]);

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
      setItems(prev => {
        const next = [...prev, ...picked];
        pushHistory(next);
        return next;
      });
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
    if (editingText) {
      setTextOverlays(prev => prev.map(t => t.key === editingText.key
        ? { ...t, text: textInput, color: textColor, font: textFont, size: textSize }
        : t));
    } else {
      setTextOverlays(prev => [...prev, {
        key: String(Date.now()),
        text: textInput,
        color: textColor,
        font: textFont,
        size: textSize,
        x: 50, y: 80,
      }]);
    }
    setShowTextModal(false);
    setTextInput('');
    setEditingText(null);
  }

  function updateTextOverlayPosition(key, x, y) {
    setTextOverlays(prev => prev.map(t => t.key === key ? { ...t, x, y } : t));
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
        transition: items[i].transition || (items[i].transition || 'none'),
      }));

      // Upload overlays if any
      let uploadedOverlays = [];
      if (overlays.length > 0) {
        setMessage('Uploading overlays...');
        const overlayForm = new FormData();
        overlays.forEach(o => overlayForm.append('files', {
          uri: o.uri, name: o.fileName, type: o.type === 'video' ? 'video/mp4' : 'image/jpeg',
        }));
        const overlayRes = await fetch(BACKEND + '/api/upload-media', {
          method: 'POST', headers: { Authorization: 'Bearer ' + token }, body: overlayForm,
        });
        const overlayData = await overlayRes.json();
        if (overlayData.items) {
          uploadedOverlays = overlayData.items.map((u, i) => ({ url: u.url, type: overlays[i].type }));
        }
      }

      // Upload audio tracks (voiceover + music) if any
      let uploadedAudio = [];
      if (audioTracks.length > 0) {
        setMessage('Uploading audio...');
        for (const track of audioTracks) {
          if (track.uri.startsWith('http')) {
            uploadedAudio.push({ url: track.uri, volume: track.volume || 1, isVoiceover: !!track.isVoiceover });
          } else {
            const audioForm = new FormData();
            audioForm.append('files', { uri: track.uri, name: track.name || 'audio.mp3', type: 'audio/mpeg' });
            const audioRes = await fetch(BACKEND + '/api/upload-media', {
              method: 'POST', headers: { Authorization: 'Bearer ' + token }, body: audioForm,
            });
            const audioData = await audioRes.json();
            if (audioData.items?.[0]) {
              uploadedAudio.push({ url: audioData.items[0].url, volume: track.volume || 1, isVoiceover: !!track.isVoiceover });
            }
          }
        }
      }

      setMessage('Creating video...');
      const mergeRes = await fetch(BACKEND + '/api/media-to-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({
          mediaItems, userId: user.uid, resolution,
          textOverlays: textOverlays.map(t => ({ text: t.text, color: t.color, font: t.font, size: t.size, x: t.x, y: t.y })),
          overlays: uploadedOverlays,
          audioTracks: uploadedAudio,
        }),
      });
      const { jobId, error } = await mergeRes.json();
      if (!jobId) throw new Error(error || 'Failed to start job');
      pollJob(jobId);
    } catch (e) { Alert.alert('Error', e.message); setUploading(false); }
  }

  async function generateVoiceover() {
    if (!voiceoverScript.trim()) { Alert.alert('Script required', 'Enter text to generate voiceover.'); return; }
    setGeneratingVoiceover(true);
    try {
      const res = await fetch(BACKEND + '/api/generate-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: voiceoverScript, voiceId }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const fullUrl = BACKEND + data.audioUrl;
      setVoiceoverTracks(prev => [...prev, {
        key: String(Date.now()), uri: fullUrl,
        name: 'Voiceover: ' + voiceoverScript.slice(0, 30), volume: 1, isVoiceover: true,
      }]);
      setVoiceoverScript('');
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setGeneratingVoiceover(false);
    }
  }

  async function previewVoice(voice) {
    try {
      if (voiceoverPreviewSound) { await voiceoverPreviewSound.stopAsync(); await voiceoverPreviewSound.unloadAsync(); }
      setGeneratingVoiceover(true);
      const res = await fetch(BACKEND + '/api/generate-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'Hi, this is a quick preview of my voice.', voiceId: voice.id }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const { sound } = await Audio.Sound.createAsync({ uri: BACKEND + data.audioUrl }, { shouldPlay: true });
      setVoiceoverPreviewSound(sound);
      setVoiceoverPreviewPlaying(true);
      sound.setOnPlaybackStatusUpdate(status => {
        if (status.didJustFinish) setVoiceoverPreviewPlaying(false);
      });
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setGeneratingVoiceover(false);
    }
  }

  async function pickVoiceoverFile() {
    const result = await DocumentPicker.getDocumentAsync({ type: 'audio/*', copyToCacheDirectory: true });
    if (!result.canceled && result.assets?.[0]) {
      const a = result.assets[0];
      setVoiceoverTracks(prev => [...prev, {
        key: String(Date.now()), uri: a.uri, name: a.name || 'Voiceover file', volume: 1, isVoiceover: true,
      }]);
    }
  }

  function addVoiceoverTrack(track) {
    const tagged = { ...track, isVoiceover: true };
    setAudioTracks(prev => [...prev, tagged]);
    setVoiceoverTracks(prev => prev.filter(t => t.key !== track.key));
    setShowVoiceoverModal(false);
    fetchWaveform(tagged);
  }

  async function loadMusicLibrary() {
    if (musicLibraryTracks.length > 0) return;
    setMusicLoading(true);
    try {
      const res = await fetch(BACKEND + '/api/music-tracks');
      const data = await res.json();
      setMusicLibraryTracks(data.tracks || []);
    } catch (e) {
      Alert.alert('Error', 'Failed to load music library.');
    } finally {
      setMusicLoading(false);
    }
  }

  async function previewMusicTrack(track) {
    try {
      if (musicPreviewSound) { await musicPreviewSound.stopAsync(); await musicPreviewSound.unloadAsync(); }
      if (musicPreviewPlayingId === track.id) { setMusicPreviewPlayingId(null); setMusicPreviewSound(null); return; }
      const { sound } = await Audio.Sound.createAsync({ uri: BACKEND + track.previewUrl }, { shouldPlay: true });
      setMusicPreviewSound(sound);
      setMusicPreviewPlayingId(track.id);
      sound.setOnPlaybackStatusUpdate(status => {
        if (status.didJustFinish) setMusicPreviewPlayingId(null);
      });
    } catch (e) {}
  }

  function addMusicTrackFromLibrary(track) {
    const newTrack = { key: String(Date.now()), uri: BACKEND + track.previewUrl, name: track.name, volume: 1, isMusic: true };
    setAudioTracks(prev => [...prev, newTrack]);
    setShowMusicModal(false);
    fetchWaveform(newTrack);
  }

  async function pickMusicFile() {
    const result = await DocumentPicker.getDocumentAsync({ type: 'audio/*', copyToCacheDirectory: true });
    if (!result.canceled && result.assets?.[0]) {
      const a = result.assets[0];
      const newTrack = { key: String(Date.now()), uri: a.uri, name: a.name || 'Music track', volume: 1, isMusic: true };
      setAudioTracks(prev => [...prev, newTrack]);
      setShowMusicModal(false);
      fetchWaveform(newTrack);
    }
  }

  async function fetchWaveform(track) {
    if (waveformCache[track.key]) return;
    try {
      const res = await fetch(BACKEND + '/api/audio-waveform', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: track.uri, samples: 40 }),
      });
      const data = await res.json();
      if (data.peaks) {
        setWaveformCache(prev => ({ ...prev, [track.key]: data.peaks }));
      }
    } catch (e) {}
  }

  function setClipTransition(key, transitionId) {
    setItems(prev => prev.map(i => i.key === key ? { ...i, transition: transitionId } : i));
  }

  function pushHistory(newItems) {
    setHistory(prev => {
      const trimmed = prev.slice(0, historyIndex + 1);
      return [...trimmed, newItems];
    });
    setHistoryIndex(prev => prev + 1);
    setItems(newItems);
  }

  function undo() {
    if (historyIndex <= 0) return;
    const newIndex = historyIndex - 1;
    setHistoryIndex(newIndex);
    setItems(history[newIndex]);
  }

  function redo() {
    if (historyIndex >= history.length - 1) return;
    const newIndex = historyIndex + 1;
    setHistoryIndex(newIndex);
    setItems(history[newIndex]);
  }

  async function pickOverlay() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission needed', 'Allow access to photos/videos.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsMultipleSelection: false, quality: 0.8,
    });
    if (!result.canceled) {
      const a = result.assets[0];
      setOverlays(prev => [...prev, {
        key: String(Date.now()),
        uri: a.uri,
        type: a.type === 'video' ? 'video' : 'image',
        fileName: a.fileName || ('overlay_' + Date.now() + '.' + (a.type === 'video' ? 'mp4' : 'jpg')),
      }]);
    }
  }

  async function handleAutoCaption() {
    if (items.length === 0) { Alert.alert('No media', 'Add a video clip first.'); return; }
    const videoItem = items.find(i => i.type === 'video');
    if (!videoItem) { Alert.alert('No video', 'Auto Captions requires at least one video clip.'); return; }
    setShowCaptionModal(false);
    setUploading(true); setMessage('Generating captions...');
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Not logged in');
      const token = await user.getIdToken();
      const res = await fetch(BACKEND + '/api/edit-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({
          videoUrl: videoItem.uri,
          script: captionScript,
          captionStyle: captionStyle,
          userId: user.uid,
        }),
      });
      const { jobId, error } = await res.json();
      if (!jobId) throw new Error(error || 'Failed to start caption job');
      pollCaptionJob(jobId);
    } catch (e) { Alert.alert('Error', e.message); setUploading(false); }
  }

  function pollCaptionJob(jobId) {
    const interval = setInterval(async () => {
      try {
        const r = await fetch(BACKEND + '/api/job/' + jobId);
        const job = await r.json();
        setProgress(job.progress || 0); setMessage(job.message || '');
        if (job.status === 'done') {
          clearInterval(interval); setUploading(false);
          const captionedUrl = 'https://api.fitlifesolutions.site' + job.videoUrl;
          setItems(prev => prev.map((item, i) =>
            i === 0 ? { ...item, uri: captionedUrl, type: 'video' } : item
          ));
          Alert.alert('Done', 'Captions added to your first clip!');
        } else if (job.status === 'error') {
          clearInterval(interval); setUploading(false);
          Alert.alert('Error', job.error || 'Caption generation failed');
        }
      } catch (e) {}
    }, 2000);
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

  const [showImageDurationModal, setShowImageDurationModal] = useState(false);
  const [showAudioListModal, setShowAudioListModal] = useState(false);
  const [showTextListModal, setShowTextListModal] = useState(false);

  const getTabTools = () => {
    switch (activeTab) {
      case 'Edit':
        return [
          { key: 'split', icon: 'content-cut', label: 'Split', onPress: splitAtScrubber },
          { key: 'trim', icon: 'straighten', label: 'Trim', onPress: () => selectedItem && openTrim(selectedItem) },
          { key: 'delete', icon: 'delete', label: 'Delete', color: '#ff6b6b', onPress: () => selectedKey && removeItem(selectedKey) },
          { key: 'res', icon: 'hd', label: resolution, color: '#00d4d4', onPress: () => setShowResModal(true) },
          ...(selectedItem?.type === 'image' ? [{ key: 'duration', icon: 'timer', label: selectedItem.duration + 's', onPress: () => setShowImageDurationModal(true) }] : []),
        ];
      case 'Audio':
        return [
          { key: 'addmusic', icon: 'add', label: 'Add Music', onPress: pickAudio },
          { key: 'volume', icon: 'volume-up', label: 'Volume', onPress: () => setShowVolumeModal(true) },
          ...(selectedItem ? [{ key: 'mute', icon: selectedItem.muted ? 'volume-off' : 'volume-up', label: selectedItem.muted ? 'Unmute' : 'Mute', onPress: () => setItems(prev => prev.map(i => i.key === selectedKey ? { ...i, muted: !i.muted } : i)) }] : []),
          ...(audioTracks.length > 0 ? [{ key: 'tracks', icon: 'queue-music', label: `Tracks (${audioTracks.length})`, color: '#00d4d4', onPress: () => setShowAudioListModal(true) }] : []),
        ];
      case 'Text':
        return [
          { key: 'addtext', icon: 'add', label: 'Add Text', onPress: () => { setEditingText(null); setTextInput(''); setShowTextModal(true); } },
          ...(textOverlays.length > 0 ? [{ key: 'textlist', icon: 'format-list-bulleted', label: `Texts (${textOverlays.length})`, color: '#00d4d4', onPress: () => setShowTextListModal(true) }] : []),
        ];
      case 'Effects':
        return [
          ...FILTERS.map(f => ({ key: 'f-' + f, label: f, active: selectedFilter === f, onPress: () => applyFilter(f) })),
          ...SPEEDS.map(s => ({ key: 's-' + s, label: s + 'x', active: selectedSpeed === s, onPress: () => applySpeed(s) })),
        ];
      case 'Overlay':
        return [
          { key: 'addoverlay', icon: 'add-photo-alternate', label: 'Add Overlay', onPress: pickOverlay },
          ...overlays.map(o => ({ key: 'ov-' + o.key, label: o.type, isOverlayThumb: true, overlay: o, onPress: () => {}, onLongPress: () => setOverlays(prev => prev.filter(x => x.key !== o.key)) })),
        ];
      case 'Captions':
        return [
          { key: 'autocap', icon: 'closed-caption', label: 'Auto Captions', onPress: () => setShowCaptionModal(true) },
          { key: 'addcap', icon: 'add', label: 'Add Caption', onPress: () => { setEditingText(null); setTextInput(''); setShowTextModal(true); } },
        ];
      default: return [];
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
          {/* Text overlays on preview - draggable */}
          {textOverlays.map(t => (
            <DraggableTextOverlay
              key={t.key}
              overlay={t}
              containerW={PREVIEW_W}
              containerH={PREVIEW_H}
              onMove={updateTextOverlayPosition}
              onTap={(ov) => { setEditingText(ov); setTextInput(ov.text); setTextColor(ov.color); setTextFont(ov.font); setTextSize(ov.size); setShowTextModal(true); }}
            />
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
          <TouchableOpacity style={styles.playBtn} onPress={undo}>
            <MaterialIcons name="undo" size={22} color={historyIndex > 0 ? '#fff' : '#888'} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.playBtn} onPress={redo}>
            <MaterialIcons name="redo" size={22} color={historyIndex < history.length - 1 ? '#fff' : '#888'} />
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
            <ScrollView
              ref={timelineScrollRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              scrollEventThrottle={16}
              onScrollBeginDrag={() => { isUserScrubbing.current = true; setIsPlaying(false); }}
              onScroll={(e) => {
                const x = e.nativeEvent.contentOffset.x;
                const newPos = Math.max(0, Math.min(duration, x / PIXELS_PER_SECOND));
                setPosition(newPos);
              }}
              onScrollEndDrag={() => { isUserScrubbing.current = false; }}
              onMomentumScrollEnd={() => { isUserScrubbing.current = false; }}>
            <View>
            <View style={styles.clipsScroll}>
              {items.map((item, idx) => (
                <View key={item.key} style={{ flexDirection:'row', alignItems:'center' }}>
                <TouchableOpacity
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
                {idx < items.length - 1 && (
                  <TouchableOpacity
                    onPress={() => { setTransitionTargetKey(item.key); setShowTransitionModal(true); }}
                    style={{ width:24, alignSelf:'center', alignItems:'center', justifyContent:'center',
                      backgroundColor:'#1a1a1a', borderRadius:12, height:24, borderWidth:1, borderColor:'#333', marginHorizontal:2 }}>
                    <Text style={{ color: item.transition && item.transition !== 'none' ? '#00d4d4' : '#555', fontSize:14, fontWeight:'bold' }}>+</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
 <TouchableOpacity style={styles.addClipBtn} onPress={pickMedia}>
                <MaterialIcons name="add" size={22} color="#888" />
              </TouchableOpacity>
            </View>

            {/* Voiceover row */}
            <View style={[styles.auxScrollRow, { paddingLeft: 8 }]}>
              {audioTracks.filter(t => t.isVoiceover).map(track => (
                <TouchableOpacity key={track.key}
                  onLongPress={() => setAudioTracks(prev => prev.filter(t => t.key !== track.key))}
                  style={{ backgroundColor:'#1a1a1a', borderRadius:8, paddingHorizontal:8, paddingVertical:4, marginRight:6, borderWidth:1, borderColor:'#2a2a2a' }}>
                  <Text style={{ color:'#888', fontSize:9, marginBottom:2 }} numberOfLines={1}>{track.name?.slice(0, 18)}</Text>
                  <WaveformBars peaks={waveformCache[track.key]} color="#60a5fa" height={20} />
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={styles.auxTrackBtn}
                onPress={() => { setShowVoiceoverModal(true); setVoiceoverTab('generate'); }}>
                <MaterialIcons name="record-voice-over" size={12} color="#555" />
                <Text style={styles.auxLabel}>{audioTracks.some(t => t.isVoiceover) ? 'Add more' : 'Add voiceover'}</Text>
              </TouchableOpacity>
            </View>
            {/* Music row */}
            <View style={[styles.auxScrollRow, { paddingLeft: 8 }]}>
              {audioTracks.filter(t => t.isMusic).map(track => (
                <TouchableOpacity key={track.key}
                  onLongPress={() => setAudioTracks(prev => prev.filter(t => t.key !== track.key))}
                  style={{ backgroundColor:'#1a1a1a', borderRadius:8, paddingHorizontal:8, paddingVertical:4, marginRight:6, borderWidth:1, borderColor:'#2a2a2a' }}>
                  <Text style={{ color:'#888', fontSize:9, marginBottom:2 }} numberOfLines={1}>{track.name?.slice(0, 18)}</Text>
                  <WaveformBars peaks={waveformCache[track.key]} color="#00d4d4" height={20} />
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={styles.auxTrackBtn}
                onPress={() => { setShowMusicModal(true); setMusicTab('library'); loadMusicLibrary(); }}>
                <MaterialIcons name="music-note" size={12} color="#555" />
                <Text style={styles.auxLabel}>{audioTracks.some(t => t.isMusic) ? 'Add more' : 'Add music'}</Text>
              </TouchableOpacity>
            </View>
            {/* Text row */}
            <View style={styles.auxScrollRow}>
              {textOverlays.map(t => (
                <TouchableOpacity key={t.key} style={styles.textChip}
                  onLongPress={() => removeTextOverlay(t.key)}
                  onPress={() => { setEditingText(t); setTextInput(t.text); setTextColor(t.color); setTextFont(t.font); setTextSize(t.size); setShowTextModal(true); }}>
                  <Text style={[styles.textChipText, { color: t.color }]}>{t.text}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={styles.auxTrackBtn}
                onPress={() => { setEditingText(null); setTextInput(''); setShowTextModal(true); }}>
                <MaterialIcons name="title" size={12} color="#555" />
                <Text style={styles.auxLabel}>Add text</Text>
              </TouchableOpacity>
            </View>
            {/* Captions row */}
            <View style={styles.auxScrollRow}>
              <TouchableOpacity style={styles.auxTrackBtn}
                onPress={() => setShowCaptionModal(true)}>
                <MaterialIcons name="closed-caption" size={12} color="#555" />
                <Text style={styles.auxLabel}>Auto captions</Text>
              </TouchableOpacity>
            </View>
            </View>
            </ScrollView>
          </View>
        </View>
      </View>

      {/* TRUE SINGLE-ROW BOTTOM TOOLBAR */}
      <View style={[styles.bottomToolbar, { paddingBottom: insets.bottom || 16 }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ alignItems: 'center', paddingHorizontal: 8, gap: 6 }}>
          {bottomTabs.map(tab => (
            <TouchableOpacity key={tab.name} style={[styles.tabBtn, activeTab === tab.name && styles.tabBtnActive]}
              onPress={() => setActiveTab(tab.name)}>
              <MaterialIcons name={tab.icon} size={20} color={activeTab === tab.name ? '#00d4d4' : '#555'} />
              <Text style={[styles.tabLabel, activeTab === tab.name && { color: '#00d4d4' }]}>{tab.name}</Text>
            </TouchableOpacity>
          ))}
          <View style={{ width: 1, height: 32, backgroundColor: '#2a2a2a', marginHorizontal: 4 }} />
          {getTabTools().map(tool => (
            tool.isOverlayThumb ? (
              <TouchableOpacity key={tool.key} onLongPress={tool.onLongPress} onPress={tool.onPress}
                style={{ alignItems: 'center', backgroundColor: '#2a2a2a', borderRadius: 8, padding: 4 }}>
                <Image source={{ uri: tool.overlay.uri }} style={{ width: 32, height: 32, borderRadius: 4 }} resizeMode="cover" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity key={tool.key} style={[styles.toolChip, tool.active && styles.toolChipActive]} onPress={tool.onPress}>
                {tool.icon && <MaterialIcons name={tool.icon} size={16} color={tool.active ? '#000' : (tool.color || '#fff')} />}
                <Text style={[styles.toolChipText, tool.active && { color: '#000' }, tool.color && !tool.active && { color: tool.color }]}>{tool.label}</Text>
              </TouchableOpacity>
            )
          ))}
        </ScrollView>
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

      {/* IMAGE DURATION MODAL */}
      <Modal visible={showImageDurationModal} transparent animationType="slide">
        <View style={{ flex:1, justifyContent:'flex-end', backgroundColor:'rgba(0,0,0,0.6)' }}>
          <View style={{ backgroundColor:'#1a1a1a', borderTopLeftRadius:16, borderTopRightRadius:16, padding:20 }}>
            <Text style={{ color:'#fff', fontSize:16, fontWeight:'bold', marginBottom:16 }}>Photo Duration</Text>
            {selectedItem && (
              <>
                <Text style={{ color:'#aaa', fontSize:13, marginBottom:8 }}>Duration: {selectedItem.duration}s</Text>
                <Slider style={{ width: '100%', height: 32 }}
                  minimumValue={1} maximumValue={10} step={1}
                  value={selectedItem.duration}
                  minimumTrackTintColor="#00d4d4"
                  maximumTrackTintColor="#333"
                  thumbTintColor="#00d4d4"
                  onValueChange={v => setItems(prev =>
                    prev.map(i => i.key === selectedKey ? { ...i, duration: v } : i))}
                />
              </>
            )}
            <TouchableOpacity onPress={() => setShowImageDurationModal(false)}
              style={{ backgroundColor:'#00d4d4', borderRadius:8, padding:14, alignItems:'center', marginTop:16 }}>
              <Text style={{ color:'#000', fontWeight:'bold' }}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* AUDIO LIST MODAL */}
      <Modal visible={showAudioListModal} transparent animationType="slide">
        <View style={{ flex:1, justifyContent:'flex-end', backgroundColor:'rgba(0,0,0,0.6)' }}>
          <View style={{ backgroundColor:'#1a1a1a', borderTopLeftRadius:16, borderTopRightRadius:16, padding:20, maxHeight:'70%' }}>
            <Text style={{ color:'#fff', fontSize:16, fontWeight:'bold', marginBottom:16 }}>Audio Tracks</Text>
            <ScrollView>
              {audioTracks.map(track => (
                <View key={track.key} style={{ flexDirection:'row', alignItems:'center', backgroundColor:'#2a2a2a', borderRadius:8, padding:10, marginBottom:8 }}>
                  <MaterialIcons name={track.isVoiceover ? 'record-voice-over' : 'music-note'} size={16} color="#00d4d4" />
                  <Text style={{ color:'#fff', flex:1, marginLeft:8, fontSize:13 }} numberOfLines={1}>{track.name}</Text>
                  <TouchableOpacity onPress={() => setAudioTracks(prev => prev.filter(t => t.key !== track.key))}>
                    <MaterialIcons name="close" size={18} color="#888" />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
            <TouchableOpacity onPress={() => setShowAudioListModal(false)}
              style={{ alignItems:'center', padding:10, marginTop:6 }}>
              <Text style={{ color:'#888' }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* TEXT LIST MODAL */}
      <Modal visible={showTextListModal} transparent animationType="slide">
        <View style={{ flex:1, justifyContent:'flex-end', backgroundColor:'rgba(0,0,0,0.6)' }}>
          <View style={{ backgroundColor:'#1a1a1a', borderTopLeftRadius:16, borderTopRightRadius:16, padding:20, maxHeight:'70%' }}>
            <Text style={{ color:'#fff', fontSize:16, fontWeight:'bold', marginBottom:16 }}>Text Overlays</Text>
            <ScrollView>
              {textOverlays.map(t => (
                <TouchableOpacity key={t.key}
                  onPress={() => { setShowTextListModal(false); setEditingText(t); setTextInput(t.text); setTextColor(t.color); setTextFont(t.font); setTextSize(t.size); setShowTextModal(true); }}
                  style={{ flexDirection:'row', alignItems:'center', backgroundColor:'#2a2a2a', borderRadius:8, padding:10, marginBottom:8 }}>
                  <Text style={{ color: t.color, flex:1, fontSize:13 }} numberOfLines={1}>{t.text}</Text>
                  <TouchableOpacity onPress={() => removeTextOverlay(t.key)}>
                    <MaterialIcons name="close" size={18} color="#888" />
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity onPress={() => setShowTextListModal(false)}
              style={{ alignItems:'center', padding:10, marginTop:6 }}>
              <Text style={{ color:'#888' }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* VOICEOVER MODAL */}
      <Modal visible={showVoiceoverModal} transparent animationType="slide">
        <View style={{ flex:1, justifyContent:'flex-end', backgroundColor:'rgba(0,0,0,0.6)' }}>
          <View style={{ backgroundColor:'#1a1a1a', borderTopLeftRadius:16, borderTopRightRadius:16, padding:20, maxHeight:'85%' }}>
            <Text style={{ color:'#fff', fontSize:16, fontWeight:'bold', marginBottom:12 }}>Add Voiceover</Text>

            <View style={{ flexDirection:'row', gap:8, marginBottom:14 }}>
              <TouchableOpacity onPress={() => setVoiceoverTab('generate')}
                style={{ flex:1, padding:10, borderRadius:8, alignItems:'center',
                  backgroundColor: voiceoverTab === 'generate' ? '#00d4d4' : '#2a2a2a' }}>
                <Text style={{ color: voiceoverTab === 'generate' ? '#000' : '#fff', fontWeight:'600' }}>Generate</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setVoiceoverTab('file')}
                style={{ flex:1, padding:10, borderRadius:8, alignItems:'center',
                  backgroundColor: voiceoverTab === 'file' ? '#00d4d4' : '#2a2a2a' }}>
                <Text style={{ color: voiceoverTab === 'file' ? '#000' : '#fff', fontWeight:'600' }}>Pick File</Text>
              </TouchableOpacity>
            </View>

            {voiceoverTab === 'generate' ? (
              <ScrollView>
                <Text style={{ color:'#aaa', fontSize:12, marginBottom:6 }}>Script</Text>
                <TextInput
                  style={{ backgroundColor:'#2a2a2a', color:'#fff', borderRadius:8, padding:10, minHeight:70, marginBottom:14, textAlignVertical:'top' }}
                  placeholder="Type what you want the voiceover to say..."
                  placeholderTextColor="#555"
                  multiline
                  value={voiceoverScript}
                  onChangeText={setVoiceoverScript}
                />
                <Text style={{ color:'#aaa', fontSize:12, marginBottom:8 }}>Voice</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom:16 }}>
                  {VOICES.map(v => (
                    <TouchableOpacity key={v.id} onPress={() => setVoiceId(v.id)}
                      style={{ marginRight:8, padding:10, borderRadius:10, alignItems:'center', minWidth:78,
                        backgroundColor: voiceId === v.id ? '#00d4d4' : '#2a2a2a' }}>
                      <Text style={{ fontSize:20 }}>{v.icon}</Text>
                      <Text style={{ color: voiceId === v.id ? '#000' : '#fff', fontWeight:'700', fontSize:12, marginTop:4 }}>{v.label}</Text>
                      <Text style={{ color: voiceId === v.id ? '#003' : '#888', fontSize:9 }}>{v.accent}</Text>
                      <TouchableOpacity onPress={() => previewVoice(v)} style={{ marginTop:6 }}>
                        <MaterialIcons name="play-circle-outline" size={18} color={voiceId === v.id ? '#000' : '#888'} />
                      </TouchableOpacity>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <TouchableOpacity onPress={generateVoiceover} disabled={generatingVoiceover}
                  style={{ backgroundColor:'#00d4d4', borderRadius:8, padding:14, alignItems:'center', marginBottom:10, opacity: generatingVoiceover ? 0.6 : 1 }}>
                  {generatingVoiceover
                    ? <ActivityIndicator color="#000" />
                    : <Text style={{ color:'#000', fontWeight:'bold', fontSize:15 }}>Generate Voiceover</Text>}
                </TouchableOpacity>

                {voiceoverTracks.map(t => (
                  <View key={t.key} style={{ flexDirection:'row', alignItems:'center', backgroundColor:'#2a2a2a', borderRadius:8, padding:10, marginBottom:8 }}>
                    <MaterialIcons name="graphic-eq" size={16} color="#00d4d4" />
                    <Text style={{ color:'#fff', flex:1, marginLeft:8, fontSize:12 }} numberOfLines={1}>{t.name}</Text>
                    <TouchableOpacity onPress={() => addVoiceoverTrack(t)} style={{ marginLeft:8 }}>
                      <Text style={{ color:'#00d4d4', fontWeight:'700', fontSize:12 }}>ADD</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            ) : (
              <View>
                <TouchableOpacity onPress={pickVoiceoverFile}
                  style={{ backgroundColor:'#2a2a2a', borderRadius:8, padding:16, alignItems:'center', marginBottom:10 }}>
                  <MaterialIcons name="upload-file" size={28} color="#00d4d4" />
                  <Text style={{ color:'#fff', marginTop:8 }}>Browse audio files</Text>
                </TouchableOpacity>
                {voiceoverTracks.map(t => (
                  <View key={t.key} style={{ flexDirection:'row', alignItems:'center', backgroundColor:'#2a2a2a', borderRadius:8, padding:10, marginBottom:8 }}>
                    <MaterialIcons name="graphic-eq" size={16} color="#00d4d4" />
                    <Text style={{ color:'#fff', flex:1, marginLeft:8, fontSize:12 }} numberOfLines={1}>{t.name}</Text>
                    <TouchableOpacity onPress={() => addVoiceoverTrack(t)} style={{ marginLeft:8 }}>
                      <Text style={{ color:'#00d4d4', fontWeight:'700', fontSize:12 }}>ADD</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            <TouchableOpacity onPress={() => setShowVoiceoverModal(false)} style={{ alignItems:'center', padding:10, marginTop:6 }}>
              <Text style={{ color:'#888' }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MUSIC MODAL */}
      <Modal visible={showMusicModal} transparent animationType="slide">
        <View style={{ flex:1, justifyContent:'flex-end', backgroundColor:'rgba(0,0,0,0.6)' }}>
          <View style={{ backgroundColor:'#1a1a1a', borderTopLeftRadius:16, borderTopRightRadius:16, padding:20, maxHeight:'85%' }}>
            <Text style={{ color:'#fff', fontSize:16, fontWeight:'bold', marginBottom:12 }}>Add Music</Text>

            <View style={{ flexDirection:'row', gap:8, marginBottom:14 }}>
              <TouchableOpacity onPress={() => { setMusicTab('library'); loadMusicLibrary(); }}
                style={{ flex:1, padding:10, borderRadius:8, alignItems:'center',
                  backgroundColor: musicTab === 'library' ? '#00d4d4' : '#2a2a2a' }}>
                <Text style={{ color: musicTab === 'library' ? '#000' : '#fff', fontWeight:'600' }}>Library</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setMusicTab('device')}
                style={{ flex:1, padding:10, borderRadius:8, alignItems:'center',
                  backgroundColor: musicTab === 'device' ? '#00d4d4' : '#2a2a2a' }}>
                <Text style={{ color: musicTab === 'device' ? '#000' : '#fff', fontWeight:'600' }}>Upload</Text>
              </TouchableOpacity>
            </View>

            {musicTab === 'library' ? (
              musicLoading ? (
                <ActivityIndicator color="#00d4d4" style={{ marginVertical: 30 }} />
              ) : (
                <ScrollView>
                  {musicLibraryTracks.map(track => (
                    <TouchableOpacity key={track.id} onPress={() => addMusicTrackFromLibrary(track)}
                      style={{ flexDirection:'row', alignItems:'center', backgroundColor:'#2a2a2a', borderRadius:8, padding:12, marginBottom:8 }}>
                      <TouchableOpacity onPress={() => previewMusicTrack(track)}
                        style={{ width:32, height:32, borderRadius:16, backgroundColor: musicPreviewPlayingId === track.id ? '#00d4d4' : '#333', alignItems:'center', justifyContent:'center', marginRight:10 }}>
                        <MaterialIcons name={musicPreviewPlayingId === track.id ? 'pause' : 'play-arrow'} size={18} color={musicPreviewPlayingId === track.id ? '#000' : '#fff'} />
                      </TouchableOpacity>
                      <Text style={{ color:'#fff', flex:1, fontSize:13 }} numberOfLines={1}>{track.name}</Text>
                      <Text style={{ color:'#00d4d4', fontWeight:'700', fontSize:12 }}>ADD</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )
            ) : (
              <TouchableOpacity onPress={pickMusicFile}
                style={{ backgroundColor:'#2a2a2a', borderRadius:8, padding:16, alignItems:'center', marginBottom:10 }}>
                <MaterialIcons name="upload-file" size={28} color="#00d4d4" />
                <Text style={{ color:'#fff', marginTop:8 }}>Browse audio files</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity onPress={() => setShowMusicModal(false)} style={{ alignItems:'center', padding:10, marginTop:6 }}>
              <Text style={{ color:'#888' }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* TRANSITION PICKER MODAL */}
      <TransitionModal
        visible={showTransitionModal}
        targetKey={transitionTargetKey}
        onSelect={setClipTransition}
        onClose={() => setShowTransitionModal(false)}
      />

      {/* AUTO CAPTIONS MODAL */}
      <Modal visible={showCaptionModal} transparent animationType="slide">
        <View style={{ flex:1, justifyContent:'flex-end', backgroundColor:'rgba(0,0,0,0.6)' }}>
          <View style={{ backgroundColor:'#1a1a1a', borderTopLeftRadius:16, borderTopRightRadius:16, padding:20 }}>
            <Text style={{ color:'#fff', fontSize:16, fontWeight:'bold', marginBottom:12 }}>Auto Captions</Text>

            <Text style={{ color:'#aaa', fontSize:12, marginBottom:6 }}>Caption Script (optional)</Text>
            <TextInput
              style={{ backgroundColor:'#2a2a2a', color:'#fff', borderRadius:8, padding:10, minHeight:80, marginBottom:14, textAlignVertical:'top' }}
              placeholder="Enter script or leave blank to auto-detect..."
              placeholderTextColor="#555"
              multiline
              value={captionScript}
              onChangeText={setCaptionScript}
            />

            <Text style={{ color:'#aaa', fontSize:12, marginBottom:8 }}>Caption Style</Text>
            <View style={{ flexDirection:'row', gap:8, marginBottom:20 }}>
              {['classic','word','animated'].map(s => (
                <TouchableOpacity key={s}
                  onPress={() => setCaptionStyle(s)}
                  style={{ flex:1, padding:10, borderRadius:8, alignItems:'center',
                    backgroundColor: captionStyle === s ? '#00d4d4' : '#2a2a2a' }}>
                  <Text style={{ color: captionStyle === s ? '#000' : '#fff', textTransform:'capitalize', fontSize:13 }}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity onPress={handleAutoCaption}
              style={{ backgroundColor:'#00d4d4', borderRadius:8, padding:14, alignItems:'center', marginBottom:10 }}>
              <Text style={{ color:'#000', fontWeight:'bold', fontSize:15 }}>Generate Captions</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowCaptionModal(false)}
              style={{ alignItems:'center', padding:10 }}>
              <Text style={{ color:'#888' }}>Cancel</Text>
            </TouchableOpacity>
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
  auxScrollRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  auxTrackBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 26, paddingHorizontal: 12, borderRadius: 13, borderWidth: 1, borderColor: '#222', backgroundColor: '#111' },
  auxLabel: { color: '#555', fontSize: 11 },


  tabContent: { flexDirection: 'row', alignItems: 'center' },
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

  bottomToolbar: { flexDirection: 'column', borderTopWidth: 1, borderTopColor: '#1a1a1a', backgroundColor: '#000' },
  tabIconsRow: { paddingVertical: 4 },
  tabToolsRow: { paddingTop: 8, paddingBottom: 2, paddingHorizontal: 4, minHeight: 44 },
  tabBtn: { alignItems: 'center', gap: 3, paddingHorizontal: 14, paddingVertical: 4 },
  tabBtnActive: { borderBottomWidth: 2, borderBottomColor: '#00d4d4' },
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
