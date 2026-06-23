import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Animated, Image,
  StyleSheet, ActivityIndicator, Alert, StatusBar,
  Modal, FlatList, SafeAreaView
} from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Audio } from 'expo-av';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { getAuth } from 'firebase/auth';

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
  { id: 'classic',   label: 'Classic',   desc: 'White + black outline',     color: '#fff',    bg: 'transparent', bold: true,  shadow: true  },
  { id: 'tiktok',    label: 'TikTok',    desc: 'Bold yellow, viral style',  color: '#00FFFF', bg: 'transparent', bold: true,  shadow: true  },
  { id: 'bold',      label: 'Bold',      desc: 'Thick heavy stroke',        color: '#fff',    bg: 'transparent', bold: true,  shadow: true  },
  { id: 'neon',      label: 'Neon',      desc: 'Glowing green text',        color: '#7FFF00', bg: 'transparent', bold: true,  shadow: false },
  { id: 'fire',      label: 'Fire',      desc: 'Burning orange text',       color: '#FF4500', bg: 'transparent', bold: true,  shadow: true  },
  { id: 'sticker',   label: 'Sticker',   desc: 'White box behind text',     color: '#000',    bg: '#fff',        bold: true,  shadow: false },
  { id: 'shadow3d',  label: '3D Shadow', desc: 'Deep 3D drop shadow',       color: '#fff',    bg: 'transparent', bold: true,  shadow: true  },
  { id: 'highlight', label: 'Highlight', desc: 'Alternating word colors',   color: '#00FFFF', bg: 'transparent', bold: true,  shadow: true  },
  { id: 'outline',   label: 'Outline',   desc: 'White border, no fill',     color: '#fff',    bg: 'transparent', bold: true,  shadow: false },
  { id: 'cinematic', label: 'Cinematic', desc: 'Elegant spaced italic',     color: '#fff',    bg: 'transparent', bold: false, shadow: true  },
  { id: 'minimal',   label: 'Minimal',   desc: 'Small clean white text',    color: '#fff',    bg: 'transparent', bold: false, shadow: false },
  { id: 'purple',    label: 'Purple',    desc: 'Bold purple glow',          color: '#FF00FF', bg: 'transparent', bold: true,  shadow: true  },
];

const TRANSITION_STYLES = [
  { id: 'none',        label: 'Cut',          desc: 'Hard cut, no transition',        icon: '✂️',  group: 'Basic' },
  { id: 'fade',        label: 'Fade',         desc: 'Smooth fade',                    icon: '🌅', group: 'Basic' },
  { id: 'fadewhite',   label: 'Flash White',  desc: 'Slam to white',                  icon: '⚡', group: 'Trendy' },
  { id: 'fadeblack',   label: 'Fade Black',   desc: 'Dip to black',                   icon: '⬛', group: 'Basic' },
  { id: 'fadegrays',   label: 'Film Burn',    desc: 'Cinematic gray burn',            icon: '🎞️', group: 'Cinematic' },
  { id: 'fadefast',    label: 'Flash Cut',    desc: 'Ultra fast fade',                icon: '💥', group: 'Trendy' },
  { id: 'fadeslow',    label: 'Slow Burn',    desc: 'Dreamy slow fade',               icon: '🌙', group: 'Cinematic' },
  { id: 'zoomin',      label: 'Zoom In',      desc: 'Punch zoom into next scene',     icon: '🚀', group: 'Trendy' },
  { id: 'hblur',       label: 'Blur Wipe',    desc: 'Horizontal blur transition',     icon: '💫', group: 'Trendy' },
  { id: 'pixelize',    label: 'Pixelate',     desc: 'Pixel burst between scenes',     icon: '🟦', group: 'Trendy' },
  { id: 'dissolve',    label: 'Dissolve',     desc: 'Soft dissolve blend',            icon: '💧', group: 'Basic' },
  { id: 'radial',      label: 'Radial',       desc: 'Spinning radial wipe',           icon: '🌀', group: 'Cinematic' },
  { id: 'circleopen',  label: 'Circle Open',  desc: 'Circle expands to reveal',       icon: '⭕', group: 'Cinematic' },
  { id: 'circleclose', label: 'Circle Close', desc: 'Circle closes between scenes',   icon: '🔵', group: 'Cinematic' },
  { id: 'circlecrop',  label: 'Circle Crop',  desc: 'Circle crop transition',         icon: '🔴', group: 'Cinematic' },
  { id: 'coverleft',   label: 'Cover Left',   desc: 'Next scene covers from right',   icon: '⬅️', group: 'Trendy' },
  { id: 'coverright',  label: 'Cover Right',  desc: 'Next scene covers from left',    icon: '➡️', group: 'Trendy' },
  { id: 'coverup',     label: 'Cover Up',     desc: 'Next scene covers from bottom',  icon: '⬆️', group: 'Trendy' },
  { id: 'coverdown',   label: 'Cover Down',   desc: 'Next scene covers from top',     icon: '⬇️', group: 'Trendy' },
  { id: 'revealleft',  label: 'Reveal Left',  desc: 'Reveal next scene leftward',     icon: '👈', group: 'Cinematic' },
  { id: 'revealright', label: 'Reveal Right', desc: 'Reveal next scene rightward',    icon: '👉', group: 'Cinematic' },
  { id: 'revealup',    label: 'Reveal Up',    desc: 'Reveal next scene upward',       icon: '👆', group: 'Cinematic' },
  { id: 'revealdown',  label: 'Reveal Down',  desc: 'Reveal next scene downward',     icon: '👇', group: 'Cinematic' },
  { id: 'slideleft',   label: 'Slide Left',   desc: 'Slide to the left',              icon: '◀️', group: 'Basic' },
  { id: 'slideright',  label: 'Slide Right',  desc: 'Slide to the right',             icon: '▶️', group: 'Basic' },
  { id: 'slideup',     label: 'Slide Up',     desc: 'Slide upward',                   icon: '🔼', group: 'Basic' },
  { id: 'slidedown',   label: 'Slide Down',   desc: 'Slide downward',                 icon: '🔽', group: 'Basic' },
  { id: 'smoothleft',  label: 'Smooth Left',  desc: 'Smooth ease slide left',         icon: '🌊', group: 'Cinematic' },
  { id: 'smoothright', label: 'Smooth Right', desc: 'Smooth ease slide right',        icon: '🌊', group: 'Cinematic' },
  { id: 'smoothup',    label: 'Smooth Up',    desc: 'Smooth ease slide up',           icon: '🌊', group: 'Cinematic' },
  { id: 'smoothdown',  label: 'Smooth Down',  desc: 'Smooth ease slide down',         icon: '🌊', group: 'Cinematic' },
  { id: 'wipeleft',    label: 'Wipe Left',    desc: 'Hard wipe left',                 icon: '🧹', group: 'Basic' },
  { id: 'wiperight',   label: 'Wipe Right',   desc: 'Hard wipe right',                icon: '🧹', group: 'Basic' },
  { id: 'wipeup',      label: 'Wipe Up',      desc: 'Hard wipe up',                   icon: '🧹', group: 'Basic' },
  { id: 'wipedown',    label: 'Wipe Down',    desc: 'Hard wipe down',                 icon: '🧹', group: 'Basic' },
  { id: 'wipetl',      label: 'Wipe ↖',       desc: 'Diagonal wipe top-left',         icon: '↖️', group: 'Cinematic' },
  { id: 'wipetr',      label: 'Wipe ↗',       desc: 'Diagonal wipe top-right',        icon: '↗️', group: 'Cinematic' },
  { id: 'wipebl',      label: 'Wipe ↙',       desc: 'Diagonal wipe bottom-left',      icon: '↙️', group: 'Cinematic' },
  { id: 'wipebr',      label: 'Wipe ↘',       desc: 'Diagonal wipe bottom-right',     icon: '↘️', group: 'Cinematic' },
  { id: 'diagtl',      label: 'Diag ↖',       desc: 'Diagonal reveal top-left',       icon: '↖️', group: 'Cinematic' },
  { id: 'diagtr',      label: 'Diag ↗',       desc: 'Diagonal reveal top-right',      icon: '↗️', group: 'Cinematic' },
  { id: 'diagbl',      label: 'Diag ↙',       desc: 'Diagonal reveal bottom-left',    icon: '↙️', group: 'Cinematic' },
  { id: 'diagbr',      label: 'Diag ↘',       desc: 'Diagonal reveal bottom-right',   icon: '↘️', group: 'Cinematic' },
  { id: 'hlslice',     label: 'H Slices',     desc: 'Horizontal slice wipe',          icon: '🔪', group: 'Trendy' },
  { id: 'hrslice',     label: 'HR Slices',    desc: 'Horizontal reverse slice',       icon: '🔪', group: 'Trendy' },
  { id: 'vuslice',     label: 'V Slices',     desc: 'Vertical slice wipe',            icon: '🔪', group: 'Trendy' },
  { id: 'vdslice',     label: 'VD Slices',    desc: 'Vertical down slice',            icon: '🔪', group: 'Trendy' },
  { id: 'hlwind',      label: 'H Wind',       desc: 'Horizontal wind sweep',          icon: '💨', group: 'Trendy' },
  { id: 'hrwind',      label: 'HR Wind',      desc: 'Horizontal reverse wind',        icon: '💨', group: 'Trendy' },
  { id: 'vuwind',      label: 'V Wind',       desc: 'Vertical wind sweep',            icon: '💨', group: 'Trendy' },
  { id: 'vdwind',      label: 'VD Wind',      desc: 'Vertical down wind',             icon: '💨', group: 'Trendy' },
  { id: 'squeezeh',    label: 'Squeeze H',    desc: 'Horizontal squeeze',             icon: '↔️', group: 'Trendy' },
  { id: 'squeezev',    label: 'Squeeze V',    desc: 'Vertical squeeze',               icon: '↕️', group: 'Trendy' },
  { id: 'vertopen',    label: 'Vert Open',    desc: 'Vertical barn door open',        icon: '🚪', group: 'Cinematic' },
  { id: 'vertclose',   label: 'Vert Close',   desc: 'Vertical barn door close',       icon: '🚪', group: 'Cinematic' },
  { id: 'horzopen',    label: 'Horz Open',    desc: 'Horizontal barn door open',      icon: '🚪', group: 'Cinematic' },
  { id: 'horzclose',   label: 'Horz Close',   desc: 'Horizontal barn door close',     icon: '🚪', group: 'Cinematic' },
  { id: 'rectcrop',    label: 'Rect Crop',    desc: 'Rectangle crop reveal',          icon: '⬜', group: 'Cinematic' },
  { id: 'distance',    label: 'Distance',     desc: 'Distance-based blend',           icon: '🎯', group: 'Cinematic' },
];


const VIDEO_SPEEDS = [
  { id: 1.0, label: '1x', desc: 'Normal speed' },
  { id: 1.25, label: '1.25x', desc: 'Slightly faster' },
  { id: 1.5, label: '1.5x', desc: 'Fast' },
  { id: 2.0, label: '2x', desc: 'Double speed' },
];

async function fetchWithTimeout(url, options, timeoutMs = 300000) {
  try {
    const user = getAuth().currentUser;
    if (user) {
      const token = await user.getIdToken();
      options = { ...options, headers: { ...options?.headers, Authorization: `Bearer ${token}` } };
    }
  } catch (e) { console.warn('Token error:', e); }
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

function CaptionPreview({ item }) {
  const base = { fontSize: 13, fontWeight: item.bold ? 'bold' : 'normal' };
  const shadow = item.shadow ? {
    textShadowColor: '#000', textShadowOffset: { width: 2, height: 2 }, textShadowRadius: 4
  } : {};

  if (item.id === 'sticker') {
    const boxColors = ['#FF6B00','#FF0090','#00CC00','#FFCC00','#0000CC','#990099'];
    return (
      <View style={{ width: 90, height: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
        {['Aa','Bb'].map((t, i) => (
          <View key={i} style={{ backgroundColor: boxColors[i], borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 }}>
            <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 13 }}>{t}</Text>
          </View>
        ))}
      </View>
    );
  }
  if (item.id === 'outline') {
    return (
      <View style={{ width: 90, height: 40, backgroundColor: '#000', borderRadius: 6, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ ...base, color: 'transparent', fontSize: 15, textShadowColor: '#fff', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 6, letterSpacing: 1 }}>ABC</Text>
      </View>
    );
  }
  if (item.id === 'cinematic') {
    return (
      <View style={{ width: 90, height: 40, backgroundColor: '#000', borderRadius: 6, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: '#fff', fontSize: 11, fontStyle: 'italic', letterSpacing: 3 }}>CAPTION</Text>
      </View>
    );
  }
  if (item.id === 'shadow3d') {
    return (
      <View style={{ width: 90, height: 40, backgroundColor: '#111', borderRadius: 6, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 15, textShadowColor: '#555', textShadowOffset: { width: 4, height: 4 }, textShadowRadius: 1 }}>ABC</Text>
      </View>
    );
  }
  if (item.id === 'highlight') {
    return (
      <View style={{ width: 90, height: 40, backgroundColor: '#000', borderRadius: 6, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 3 }}>
        <Text style={{ color: '#00FFFF', fontWeight: 'bold', fontSize: 13 }}>AB</Text>
        <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 13 }}>CD</Text>
      </View>
    );
  }

  return (
    <View style={{ width: 90, height: 40, backgroundColor: item.bg !== 'transparent' ? item.bg : '#000', borderRadius: 6, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 }}>
      <Text style={[base, shadow, { color: item.color, fontSize: 14, textAlign: 'center' }]}>Caption</Text>
    </View>
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
        <CaptionPreview item={item} />
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
  const colors = ['#2ecc71', '#3498db'];
  const IMG_A = { uri: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=200&q=60' };
  const IMG_B = { uri: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=200&q=60' };
  const imgStyle = { position: 'absolute', width: W, height: H, resizeMode: 'cover' };

  // Different preview animations per transition type
  const getPreview = () => {
    switch(item.id) {
      case 'fade': case 'fadeslow': case 'fadefast':
        return (
          <View style={{ width: W, height: H, borderRadius: 6, overflow: 'hidden' }}>
            <Image source={IMG_A} style={imgStyle} />
            <Animated.Image source={IMG_B} style={[imgStyle, { opacity: anim }]} />
          </View>
        );
      case 'slideleft': case 'slide': case 'smoothleft': case 'coverleft': case 'revealleft': case 'swipeleft': case 'wipeleft':
        return (
          <View style={{ width: W, height: H, borderRadius: 6, overflow: 'hidden' }}>
            <Image source={IMG_A} style={imgStyle} />
            <Animated.Image source={IMG_B} style={[imgStyle, { transform: [{ translateX: anim.interpolate({ inputRange: [0,1], outputRange: [W, 0] }) }] }]} />
          </View>
        );
      case 'slideright': case 'smoothright': case 'coverright': case 'revealright': case 'wiperight':
        return (
          <View style={{ width: W, height: H, borderRadius: 6, overflow: 'hidden' }}>
            <Image source={IMG_A} style={imgStyle} />
            <Animated.Image source={IMG_B} style={[imgStyle, { transform: [{ translateX: anim.interpolate({ inputRange: [0,1], outputRange: [-W, 0] }) }] }]} />
          </View>
        );
      case 'slideup': case 'smoothup': case 'coverup': case 'revealup': case 'wipeup':
        return (
          <View style={{ width: W, height: H, borderRadius: 6, overflow: 'hidden' }}>
            <Image source={IMG_A} style={imgStyle} />
            <Animated.Image source={IMG_B} style={[imgStyle, { transform: [{ translateY: anim.interpolate({ inputRange: [0,1], outputRange: [H, 0] }) }] }]} />
          </View>
        );
      case 'slidedown': case 'smoothdown': case 'coverdown': case 'revealdown': case 'wipedown':
        return (
          <View style={{ width: W, height: H, borderRadius: 6, overflow: 'hidden' }}>
            <Image source={IMG_A} style={imgStyle} />
            <Animated.Image source={IMG_B} style={[imgStyle, { transform: [{ translateY: anim.interpolate({ inputRange: [0,1], outputRange: [-H, 0] }) }] }]} />
          </View>
        );
      case 'zoomin': case 'zoomdrive':
        return (
          <View style={{ width: W, height: H, borderRadius: 6, overflow: 'hidden' }}>
            <Image source={IMG_B} style={imgStyle} />
            <Animated.Image source={IMG_A} style={[imgStyle, {
              transform: [{ scale: anim.interpolate({ inputRange: [0,1], outputRange: [1, 2.5] }) }],
              opacity: anim.interpolate({ inputRange: [0, 0.8, 1], outputRange: [1, 0.3, 0] }) }]} />
          </View>
        );
      case 'fadewhite': case 'flashwhite':
        return (
          <View style={{ width: W, height: H, borderRadius: 6, overflow: 'hidden' }}>
            <Image source={IMG_A} style={imgStyle} />
            <Animated.View style={{ ...imgStyle, backgroundColor: '#fff', opacity: anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 1, 0] }) }} />
            <Animated.Image source={IMG_B} style={[imgStyle, { opacity: anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0, 1] }) }]} />
          </View>
        );
      case 'fadeblack': case 'blur':
        return (
          <View style={{ width: W, height: H, borderRadius: 6, overflow: 'hidden' }}>
            <Image source={IMG_A} style={imgStyle} />
            <Animated.View style={{ ...imgStyle, backgroundColor: '#000', opacity: anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 1, 0] }) }} />
            <Animated.Image source={IMG_B} style={[imgStyle, { opacity: anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0, 1] }) }]} />
          </View>
        );
      case 'pixelize': case 'pixelate':
        return (
          <View style={{ width: W, height: H, borderRadius: 6, overflow: 'hidden' }}>
            <Image source={IMG_A} style={imgStyle} />
            <Animated.Image source={IMG_B} style={[imgStyle, {
              opacity: anim,
              transform: [{ scale: anim.interpolate({ inputRange: [0,1], outputRange: [1.15, 1] }) }]
            }]} />
            <View style={{ position: 'absolute', width: W, height: H, flexDirection: 'column' }}>
              {[0,1,2,3].map(row => (
                <View key={row} style={{ flexDirection: 'row', flex: 1 }}>
                  {[0,1,2,3].map(col => (
                    <Animated.View key={col} style={{ flex: 1, margin: 1,
                      backgroundColor: '#000',
                      opacity: anim.interpolate({ inputRange: [0, Math.min(0.3+(row+col)*0.06, 0.7), Math.min(0.5+(row+col)*0.08, 0.95), 1], outputRange: [0.6, 0, 0, 0] }) }} />
                  ))}
                </View>
              ))}
            </View>
          </View>
        );
      case 'circleopen':
        return (
          <View style={{ width: W, height: H, borderRadius: 6, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' }}>
            <Image source={IMG_A} style={imgStyle} />
            <Animated.View style={{ borderRadius: 999, overflow: 'hidden', width: W*2, height: H*2, position: 'absolute',
              transform: [{ scale: anim.interpolate({ inputRange: [0,1], outputRange: [0, 1] }) }] }}>
              <Image source={IMG_B} style={{ width: W*2, height: H*2, resizeMode: 'cover' }} />
            </Animated.View>
          </View>
        );
      case 'circlecrop':
        return (
          <View style={{ width: W, height: H, borderRadius: 6, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' }}>
            <Image source={IMG_B} style={imgStyle} />
            <Animated.View style={{ borderRadius: 999, overflow: 'hidden', width: W*2, height: H*2, position: 'absolute',
              transform: [{ scale: anim.interpolate({ inputRange: [0,1], outputRange: [1, 0] }) }] }}>
              <Image source={IMG_A} style={{ width: W*2, height: H*2, resizeMode: 'cover' }} />
            </Animated.View>
          </View>
        );
      case 'radial':
        return (
          <View style={{ width: W, height: H, borderRadius: 6, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' }}>
            <Image source={IMG_A} style={imgStyle} />
            <Animated.View style={{ position: 'absolute', width: W*2, height: H*2, overflow: 'hidden', borderRadius: 999,
              transform: [
                { scale: anim.interpolate({ inputRange: [0,1], outputRange: [0.1, 1] }) },
                { rotate: anim.interpolate({ inputRange: [0,1], outputRange: ['0deg', '180deg'] }) }
              ] }}>
              <Image source={IMG_B} style={{ width: W*2, height: H*2, resizeMode: 'cover' }} />
            </Animated.View>
          </View>
        );
      case 'squeezeh': case 'squeezev':
        return (
          <View style={{ width: W, height: H, borderRadius: 6, overflow: 'hidden' }}>
            <Image source={IMG_B} style={imgStyle} />
            <Animated.Image source={IMG_A} style={[imgStyle, { transform: [{ scaleX: anim.interpolate({ inputRange: [0,1], outputRange: [1, 0] }) }] }]} />
          </View>
        );
      case 'diagtl': case 'wipetl':
        return (
          <View style={{ width: W, height: H, borderRadius: 6, overflow: 'hidden' }}>
            <Image source={IMG_A} style={imgStyle} />
            <Animated.View style={{ position: 'absolute', width: W*2, height: H*2, overflow: 'hidden', top: 0, left: 0,
              transform: [
                { translateX: anim.interpolate({ inputRange: [0,1], outputRange: [-W, 0] }) },
                { translateY: anim.interpolate({ inputRange: [0,1], outputRange: [-H, 0] }) },
                { rotate: '45deg' }
              ] }}>
              <Image source={IMG_B} style={{ width: W*2, height: H*2, resizeMode: 'cover' }} />
            </Animated.View>
          </View>
        );
      case 'none':
        return (
          <View style={{ width: W, height: H, borderRadius: 6, overflow: 'hidden', flexDirection: 'row' }}>
            <Image source={IMG_A} style={{ width: W/2, height: H, resizeMode: 'cover' }} />
            <View style={{ width: 2, backgroundColor: '#fff' }} />
            <Image source={IMG_B} style={{ width: W/2, height: H, resizeMode: 'cover' }} />
          </View>
        );
      default:
        return (
          <View style={{ width: W, height: H, borderRadius: 6, overflow: 'hidden' }}>
            <Image source={IMG_A} style={imgStyle} />
            <Animated.Image source={IMG_B} style={[imgStyle, { opacity: anim }]} />
          </View>
        );
    }
  };

  return (
    <View style={{ width: W, height: H, borderRadius: 6, overflow: 'hidden', marginBottom: 6 }}>
      {getPreview()}
    </View>
  );
}

function TransitionModal({ visible, options, selectedId, onSelect, onClose }) {
  const groups = ['Basic', 'Trendy', 'Cinematic'];
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
        <View style={[styles.modalSheet, { maxHeight: '85%' }]}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>🎬 Transition Style</Text>
          <FlatList
            data={groups}
            keyExtractor={g => g}
            renderItem={({ item: group }) => {
              const items = options.filter(o => o.group === group);
              if (!items.length) return null;
              return (
                <View style={{ marginBottom: 16 }}>
                  <Text style={{ color: '#888', fontSize: 11, fontWeight: 'bold', letterSpacing: 1, marginBottom: 8, paddingHorizontal: 4 }}>{group.toUpperCase()}</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {items.map(item => (
                      <TouchableOpacity
                        key={item.id}
                        onPress={() => { onSelect(item.id); onClose(); }}
                        style={{
                          width: '30%',
                          backgroundColor: selectedId === item.id ? '#1a3a1a' : '#1a1a1a',
                          borderWidth: 1.5,
                          borderColor: selectedId === item.id ? '#2ecc71' : '#333',
                          borderRadius: 12,
                          padding: 8,
                          alignItems: 'center',
                        }}
                      >
                        <TransitionPreview item={item} />
                        <Text style={{ color: selectedId === item.id ? '#2ecc71' : '#fff', fontSize: 10, fontWeight: 'bold', textAlign: 'center' }}>{item.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              );
            }}
          />
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

function MusicTrackRow({ item, selectedId, onSelect, onClose, playingId, onTogglePlay }) {
  const isSelected = selectedId === item.id;
  const isPlaying = playingId === item.id;
  return (
    <TouchableOpacity
      onPress={() => { onSelect({ id: item.id, name: item.name }); onClose(); }}
      style={{
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: isSelected ? '#1a3a1a' : '#1a1a1a',
        borderWidth: 1.5,
        borderColor: isSelected ? '#2ecc71' : '#333',
        borderRadius: 12, padding: 12, marginBottom: 8,
      }}
    >
      <TouchableOpacity
        onPress={() => onTogglePlay(item)}
        style={{
          width: 36, height: 36, borderRadius: 18,
          backgroundColor: isPlaying ? '#2ecc71' : '#333',
          justifyContent: 'center', alignItems: 'center', marginRight: 12,
        }}
      >
        <Text style={{ fontSize: 14 }}>{isPlaying ? '⏸' : '▶️'}</Text>
      </TouchableOpacity>
      <Text style={{ color: isSelected ? '#2ecc71' : '#fff', fontSize: 13, fontWeight: '600', flex: 1 }}>{item.name}</Text>
      {isSelected && <Text style={{ color: '#2ecc71', fontSize: 16 }}>✓</Text>}
    </TouchableOpacity>
  );
}

function MusicModal({ visible, selectedId, onSelect, onClose }) {
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [playingId, setPlayingId] = useState(null);
  const playerRef = useRef(null);

  React.useEffect(() => {
    if (visible && tracks.length === 0) {
      setLoading(true);
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true }).catch(() => {});
      fetch(`${BACKEND}/api/music-tracks`)
        .then(r => r.json())
        .then(data => setTracks(data.tracks || []))
        .catch(() => setTracks([]))
        .finally(() => setLoading(false));
    }
  }, [visible]);

  React.useEffect(() => {
    if (!visible && playerRef.current) {
      try { await playerRef.current.stopAsync(); await playerRef.current.unloadAsync(); } catch (e) {}
      playerRef.current = null;
      setPlayingId(null);
    }
  }, [visible]);

  const onTogglePlay = (item) => {
    if (playingId === item.id) {
      try { await playerRef.current?.pauseAsync(); } catch (e) {}
      setPlayingId(null);
      return;
    }
    if (playerRef.current) {
      try { await playerRef.current.stopAsync(); await playerRef.current.unloadAsync(); } catch (e) {}
    }
    try {
      const { sound } = await Audio.Sound.createAsync({ uri: `${BACKEND}${item.previewUrl}` });
      playerRef.current = sound;
      await sound.playAsync();
      setPlayingId(item.id);
    } catch(e) { console.warn('Audio preview error:', e); }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
        <View style={[styles.modalSheet, { maxHeight: '85%' }]}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>🎵 Background Music</Text>
          <TouchableOpacity
            onPress={() => { onSelect({ id: 'none', name: 'No Music' }); onClose(); }}
            style={{
              flexDirection: 'row', alignItems: 'center',
              backgroundColor: selectedId === 'none' ? '#1a3a1a' : '#1a1a1a',
              borderWidth: 1.5,
              borderColor: selectedId === 'none' ? '#2ecc71' : '#333',
              borderRadius: 12, padding: 12, marginBottom: 8,
            }}
          >
            <Text style={{ fontSize: 16, marginRight: 12 }}>🔇</Text>
            <Text style={{ color: selectedId === 'none' ? '#2ecc71' : '#fff', fontSize: 13, fontWeight: '600', flex: 1 }}>No Music</Text>
            {selectedId === 'none' && <Text style={{ color: '#2ecc71', fontSize: 16 }}>✓</Text>}
          </TouchableOpacity>
          {loading ? (
            <ActivityIndicator color="#2ecc71" style={{ marginTop: 20 }} />
          ) : (
            <FlatList
              data={tracks}
              keyExtractor={item => item.id}
              renderItem={({ item }) => (
                <MusicTrackRow item={item} selectedId={selectedId} onSelect={onSelect} onClose={onClose} playingId={playingId} onTogglePlay={onTogglePlay} />
              )}
            />
          )}
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

function OptionModal({ visible, title, options, selectedId, onSelect, onClose }) {
  const isCaption = options.length > 0 && options[0].color !== undefined && options[0].icon === undefined;
  if (isCaption) {
    return (
      <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
          <View style={[styles.modalSheet, { maxHeight: '85%' }]}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{title}</Text>
            <FlatList
              data={options}
              keyExtractor={item => item.id}
              numColumns={2}
              columnWrapperStyle={{ gap: 8, paddingHorizontal: 4 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => { onSelect(item.id); onClose(); }}
                  style={{
                    flex: 1, marginBottom: 8,
                    backgroundColor: selectedId === item.id ? '#1a3a1a' : '#1a1a1a',
                    borderWidth: 1.5,
                    borderColor: selectedId === item.id ? '#2ecc71' : '#333',
                    borderRadius: 12, padding: 10, alignItems: 'center',
                  }}
                >
                  <CaptionPreview item={item} />
                  <Text style={{ color: selectedId === item.id ? '#2ecc71' : '#fff', fontSize: 11, fontWeight: 'bold', marginTop: 6, textAlign: 'center' }}>{item.label}</Text>
                  <Text style={{ color: '#666', fontSize: 9, textAlign: 'center', marginTop: 2 }}>{item.desc}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    );
  }
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
  const [transition, setTransition] = useState('fade');
  const [videoSpeed, setVideoSpeed] = useState(1.0);
  const [musicTrack, setMusicTrack] = useState({ id: 'mixkit-deep-meditation-109', name: 'Deep Meditation' });
  const [script, setScript] = useState('');
  const [audioUrl, setAudioUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [progress, setProgress] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [modal, setModal] = useState(null); // 'voice' | 'ratio' | 'caption' | 'transition' | 'music'
  const progressInterval = useRef(null);

  const selectedVoice = VOICES.find(v => v.id === voiceId);
  const selectedRatio = ASPECT_RATIOS.find(r => r.id === aspectRatio);
  const selectedCaption = CAPTION_STYLES.find(c => c.id === captionStyle);
  const selectedTransition = TRANSITION_STYLES.find(t => t.id === transition);
  const selectedSpeed = VIDEO_SPEEDS.find(s => s.id === videoSpeed) || VIDEO_SPEEDS[0];

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
      setLoadingMsg('Analyzing script into scenes...'); startProgress(0, 20, 4000);
      const segRes = await fetchWithTimeout(`${BACKEND}/api/extract-segments`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: script }),
      }, 30000);
      const segData = await segRes.json();
      const segments = segData.segments;
      if (!segments?.length) { Alert.alert('Error', segData.error || 'Failed to analyze script'); resetLoading(); return; }

      setLoadingMsg('Starting video generation...'); startProgress(20, 35, 3000);
      const mergeRes = await fetchWithTimeout(`${BACKEND}/api/idea-to-video-v2`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voiceover: script, segments,
          audioUrl, aspectRatio, captionStyle, transition, videoSpeed,
          musicTrack: musicTrack.id,
        }),
      }, 15000);
      const { jobId, error: jobError } = await mergeRes.json();
      if (!jobId) { Alert.alert('Error', jobError || 'Failed to start job'); resetLoading(); return; }

      // Poll for job completion
      setLoadingMsg('Generating your video...'); startProgress(40, 95, 120000);
      const result = await new Promise((resolve, reject) => {
        const interval = setInterval(async () => {
          try {
            const pollRes = await fetchWithTimeout(`${BACKEND}/api/job/${jobId}`, {}, 10000);
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
            <SelectorRow icon="💬" label="Captions" value={`${selectedCaption.label} · ${selectedCaption.desc}`} onPress={() => setModal('caption')} />
            <View style={styles.divider} />
            <SelectorRow icon="🎬" label="Transition" value={`${selectedTransition.icon} ${selectedTransition.label} · ${selectedTransition.desc}`} onPress={() => setModal('transition')} />
            <View style={styles.divider} />
            <SelectorRow icon="⚡" label="Speed" value={selectedSpeed.label + ' · ' + selectedSpeed.desc} onPress={() => setModal('speed')} />
            <View style={styles.divider} />
            <SelectorRow icon="🎵" label="Music" value={musicTrack.name} onPress={() => setModal('music')} />
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
          <TouchableOpacity style={[styles.btn, { backgroundColor: '#2ecc71' }]} onPress={() => navigation.navigate('EditPostVideo', { videoUrl: fullVideoUrl, videoPath: videoUrl })}>
            <Text style={styles.btnText}>🚀 Post / Schedule</Text>
          </TouchableOpacity>
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
      <OptionModal visible={modal === 'speed'} title="⚡ Video Speed" options={VIDEO_SPEEDS.map(s => ({...s, id: s.id, label: s.label, desc: s.desc, icon: '⚡'}))} selectedId={videoSpeed} onSelect={(v) => setVideoSpeed(parseFloat(v))} onClose={() => setModal(null)} />
      <TransitionModal visible={modal === 'transition'} options={TRANSITION_STYLES} selectedId={transition} onSelect={setTransition} onClose={() => setModal(null)} />
      <MusicModal visible={modal === 'music'} selectedId={musicTrack.id} onSelect={setMusicTrack} onClose={() => setModal(null)} />
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
