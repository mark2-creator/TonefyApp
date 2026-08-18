import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Animated, Image,
  StyleSheet, ActivityIndicator, Alert, StatusBar, ScrollView,
  Modal, FlatList, SafeAreaView
} from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Audio } from 'expo-av';
import * as Clipboard from 'expo-clipboard';
import { getAuth } from 'firebase/auth';
import SheetHeader, { useSheetInset } from '../components/SheetHeader';
import { VOICES } from '../constants/voices';
import VoicePicker from '../components/VoicePicker';
import { CaptionStyleSheet } from '../components/CaptionStylePicker';
import {
  resolveCaptionStyle, captionExportSpec, captionFill, captionFontSize, captionChunkSize,
} from '../constants/captionStyles';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { showAlert } from '../components/BrandedAlert';
import { saveVideoToDevice } from '../utils/saveVideo';

const STATUSBAR_HEIGHT = StatusBar.currentHeight || 0;
const BACKEND = 'https://api.fitlifesolutions.site';


const ASPECT_RATIOS = [
  { id: '16:9', label: '16:9', icon: 'desktop-windows', desc: 'YouTube' },
  { id: '9:16', label: '9:16', icon: 'smartphone', desc: 'TikTok/Reels' },
  { id: '1:1',  label: '1:1',  icon: 'crop-square', desc: 'Instagram' },
];


const TRANSITION_STYLES = [
  { id: 'none',        label: 'Cut',          desc: 'Hard cut, no transition',        group: 'Basic' },
  { id: 'fade',        label: 'Fade',         desc: 'Smooth fade',                    group: 'Basic' },
  { id: 'fadewhite',   label: 'Flash White',  desc: 'Slam to white',                  group: 'Trendy' },
  { id: 'fadeblack',   label: 'Fade Black',   desc: 'Dip to black',                   group: 'Basic' },
  { id: 'fadegrays',   label: 'Film Burn',    desc: 'Cinematic gray burn',            group: 'Cinematic' },
  { id: 'fadefast',    label: 'Flash Cut',    desc: 'Ultra fast fade',                group: 'Trendy' },
  { id: 'fadeslow',    label: 'Slow Burn',    desc: 'Dreamy slow fade',               group: 'Cinematic' },
  { id: 'zoomin',      label: 'Zoom In',      desc: 'Punch zoom into next scene',     group: 'Trendy' },
  { id: 'hblur',       label: 'Blur Wipe',    desc: 'Horizontal blur transition',     group: 'Trendy' },
  { id: 'pixelize',    label: 'Pixelate',     desc: 'Pixel burst between scenes',     group: 'Trendy' },
  { id: 'dissolve',    label: 'Dissolve',     desc: 'Soft dissolve blend',            group: 'Basic' },
  { id: 'radial',      label: 'Radial',       desc: 'Spinning radial wipe',           group: 'Cinematic' },
  { id: 'circleopen',  label: 'Circle Open',  desc: 'Circle expands to reveal',       group: 'Cinematic' },
  { id: 'circleclose', label: 'Circle Close', desc: 'Circle closes between scenes',   group: 'Cinematic' },
  { id: 'circlecrop',  label: 'Circle Crop',  desc: 'Circle crop transition',         group: 'Cinematic' },
  { id: 'coverleft',   label: 'Cover Left',   desc: 'Next scene covers from right',   group: 'Trendy' },
  { id: 'coverright',  label: 'Cover Right',  desc: 'Next scene covers from left',    group: 'Trendy' },
  { id: 'coverup',     label: 'Cover Up',     desc: 'Next scene covers from bottom',  group: 'Trendy' },
  { id: 'coverdown',   label: 'Cover Down',   desc: 'Next scene covers from top',     group: 'Trendy' },
  { id: 'revealleft',  label: 'Reveal Left',  desc: 'Reveal next scene leftward',     group: 'Cinematic' },
  { id: 'revealright', label: 'Reveal Right', desc: 'Reveal next scene rightward',    group: 'Cinematic' },
  { id: 'revealup',    label: 'Reveal Up',    desc: 'Reveal next scene upward',       group: 'Cinematic' },
  { id: 'revealdown',  label: 'Reveal Down',  desc: 'Reveal next scene downward',     group: 'Cinematic' },
  { id: 'slideleft',   label: 'Slide Left',   desc: 'Slide to the left',              group: 'Basic' },
  { id: 'slideright',  label: 'Slide Right',  desc: 'Slide to the right',             group: 'Basic' },
  { id: 'slideup',     label: 'Slide Up',     desc: 'Slide upward',                   group: 'Basic' },
  { id: 'slidedown',   label: 'Slide Down',   desc: 'Slide downward',                 group: 'Basic' },
  { id: 'smoothleft',  label: 'Smooth Left',  desc: 'Smooth ease slide left',         group: 'Cinematic' },
  { id: 'smoothright', label: 'Smooth Right', desc: 'Smooth ease slide right',        group: 'Cinematic' },
  { id: 'smoothup',    label: 'Smooth Up',    desc: 'Smooth ease slide up',           group: 'Cinematic' },
  { id: 'smoothdown',  label: 'Smooth Down',  desc: 'Smooth ease slide down',         group: 'Cinematic' },
  { id: 'wipeleft',    label: 'Wipe Left',    desc: 'Hard wipe left',                 group: 'Basic' },
  { id: 'wiperight',   label: 'Wipe Right',   desc: 'Hard wipe right',                group: 'Basic' },
  { id: 'wipeup',      label: 'Wipe Up',      desc: 'Hard wipe up',                   group: 'Basic' },
  { id: 'wipedown',    label: 'Wipe Down',    desc: 'Hard wipe down',                 group: 'Basic' },
  { id: 'wipetl',      label: 'Wipe TL',       desc: 'Diagonal wipe top-left',         group: 'Cinematic' },
  { id: 'wipetr',      label: 'Wipe TR',       desc: 'Diagonal wipe top-right',        group: 'Cinematic' },
  { id: 'wipebl',      label: 'Wipe BL',       desc: 'Diagonal wipe bottom-left',      group: 'Cinematic' },
  { id: 'wipebr',      label: 'Wipe BR',       desc: 'Diagonal wipe bottom-right',     group: 'Cinematic' },
  { id: 'diagtl',      label: 'Diag TL',       desc: 'Diagonal reveal top-left',       group: 'Cinematic' },
  { id: 'diagtr',      label: 'Diag TR',       desc: 'Diagonal reveal top-right',      group: 'Cinematic' },
  { id: 'diagbl',      label: 'Diag BL',       desc: 'Diagonal reveal bottom-left',    group: 'Cinematic' },
  { id: 'diagbr',      label: 'Diag BR',       desc: 'Diagonal reveal bottom-right',   group: 'Cinematic' },
  { id: 'hlslice',     label: 'H Slices',     desc: 'Horizontal slice wipe',          group: 'Trendy' },
  { id: 'hrslice',     label: 'HR Slices',    desc: 'Horizontal reverse slice',       group: 'Trendy' },
  { id: 'vuslice',     label: 'V Slices',     desc: 'Vertical slice wipe',            group: 'Trendy' },
  { id: 'vdslice',     label: 'VD Slices',    desc: 'Vertical down slice',            group: 'Trendy' },
  { id: 'hlwind',      label: 'H Wind',       desc: 'Horizontal wind sweep',          group: 'Trendy' },
  { id: 'hrwind',      label: 'HR Wind',      desc: 'Horizontal reverse wind',        group: 'Trendy' },
  { id: 'vuwind',      label: 'V Wind',       desc: 'Vertical wind sweep',            group: 'Trendy' },
  { id: 'vdwind',      label: 'VD Wind',      desc: 'Vertical down wind',             group: 'Trendy' },
  { id: 'squeezeh',    label: 'Squeeze H',    desc: 'Horizontal squeeze',             group: 'Trendy' },
  { id: 'squeezev',    label: 'Squeeze V',    desc: 'Vertical squeeze',               group: 'Trendy' },
  { id: 'vertopen',    label: 'Vert Open',    desc: 'Vertical barn door open',        group: 'Cinematic' },
  { id: 'vertclose',   label: 'Vert Close',   desc: 'Vertical barn door close',       group: 'Cinematic' },
  { id: 'horzopen',    label: 'Horz Open',    desc: 'Horizontal barn door open',      group: 'Cinematic' },
  { id: 'horzclose',   label: 'Horz Close',   desc: 'Horizontal barn door close',     group: 'Cinematic' },
  { id: 'rectcrop',    label: 'Rect Crop',    desc: 'Rectangle crop reveal',          group: 'Cinematic' },
  { id: 'distance',    label: 'Distance',     desc: 'Distance-based blend',           group: 'Cinematic' },
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

const ProgressBar = ({ progress, label, theme }) => (
  <View style={styles.progressBarContainer}>
    <View style={[styles.progressBarBg, theme && { backgroundColor: theme.border }]}>
      <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
    </View>
    <Text style={styles.progressText}>{label} {Math.round(progress)}%</Text>
  </View>
);

const StepDots = ({ current, total, theme }) => (
  <View style={styles.dotsRow}>
    {Array.from({ length: total }).map((_, i) => (
      <View key={i} style={[styles.dot, theme && { backgroundColor: theme.border }, i < current && styles.dotActive]} />
    ))}
  </View>
);

function SettingCard({ icon, label, value, onPress, iconColor = "#54e98a", iconBg = "#1a2a1e" }) {
  const { theme } = useTheme();
  return (
    <TouchableOpacity style={[styles.settingCard, { backgroundColor: theme.card, borderColor: theme.border }]} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.settingCardLeft}>
        <View style={[styles.settingCardIcon, { backgroundColor: iconBg }]}>
          <MaterialIcons name={icon} size={22} color={iconColor} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.settingCardLabel, { color: theme.subtext }]}>{label}</Text>
          <Text style={styles.settingCardValue} numberOfLines={1}>{value}</Text>
        </View>
      </View>
      <MaterialIcons name="chevron-right" size={22} color={theme.icon} />
    </TouchableOpacity>
  );
}


function CaptionOptionRow({ item, selectedId, onSelect, onClose }) {
  const { theme, isDark } = useTheme();
  const active = selectedId === item.id;
  return (
    <TouchableOpacity
      style={[styles.optionRow, active && { backgroundColor: isDark ? '#0d2b1a' : '#e0f5e9' }]}
      onPress={() => { onSelect(item.id); onClose(); }}
    >
      {item.icon
        ? <MaterialIcons name={item.icon} size={22} color={theme.icon} style={styles.optionIcon} />
        : <Text style={styles.optionIcon}>{item.preview}</Text>}
      <View style={styles.optionText}>
        <Text style={[styles.optionLabel, { color: theme.text }, active && styles.optionLabelActive]}>{item.label}</Text>
        <Text style={[styles.optionDesc, { color: theme.subtext }]}>{item.accent || item.desc}</Text>
      </View>
      {active && <MaterialIcons name="check" size={20} color="#2ecc71" />}
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
  const { theme, isDark } = useTheme();
  const groups = ['Basic', 'Trendy', 'Cinematic'];
  const sheetInset = useSheetInset();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
        <View style={[styles.modalSheet, { backgroundColor: theme.settingBg, maxHeight: '85%' }, sheetInset]}>
          <View style={[styles.modalHandle, { backgroundColor: theme.handle }]} />
          <SheetHeader title="Transition Style" onClose={onClose} style={styles.sheetHeaderPad} titleColor={theme.text} closeColor={theme.icon} />
          <FlatList
            data={groups}
            keyExtractor={g => g}
            renderItem={({ item: group }) => {
              const items = options.filter(o => o.group === group);
              if (!items.length) return null;
              return (
                <View style={{ marginBottom: 16 }}>
                  <Text style={{ color: theme.subtext, fontSize: 11, fontWeight: 'bold', letterSpacing: 1, marginBottom: 8, paddingHorizontal: 4 }}>{group.toUpperCase()}</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {items.map(item => (
                      <TouchableOpacity
                        key={item.id}
                        onPress={() => { onSelect(item.id); onClose(); }}
                        style={{
                          width: '30%',
                          backgroundColor: selectedId === item.id ? (isDark ? '#1a3a1a' : '#e0f5e9') : theme.card,
                          borderWidth: 1.5,
                          borderColor: selectedId === item.id ? '#2ecc71' : theme.border,
                          borderRadius: 12,
                          padding: 8,
                          alignItems: 'center',
                        }}
                      >
                        <TransitionPreview item={item} />
                        <Text style={{ color: selectedId === item.id ? '#2ecc71' : theme.text, fontSize: 10, fontWeight: 'bold', textAlign: 'center' }}>{item.label}</Text>
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
  const { theme, isDark } = useTheme();
  const isSelected = selectedId === item.id;
  const isPlaying = playingId === item.id;
  return (
    <TouchableOpacity
      onPress={() => { onSelect({ id: item.id, name: item.name }); onClose(); }}
      style={{
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: isSelected ? (isDark ? '#1a3a1a' : '#e0f5e9') : theme.card,
        borderWidth: 1.5,
        borderColor: isSelected ? '#2ecc71' : theme.border,
        borderRadius: 12, padding: 12, marginBottom: 8,
      }}
    >
      <TouchableOpacity
        onPress={() => onTogglePlay(item)}
        style={{
          width: 36, height: 36, borderRadius: 18,
          backgroundColor: isPlaying ? '#2ecc71' : theme.border,
          justifyContent: 'center', alignItems: 'center', marginRight: 12,
        }}
      >
        <MaterialIcons name={isPlaying ? 'pause' : 'play-arrow'} size={16} color="#fff" />
      </TouchableOpacity>
      <Text style={{ color: isSelected ? '#2ecc71' : theme.text, fontSize: 13, fontWeight: '600', flex: 1 }}>{item.name}</Text>
      {isSelected && <MaterialIcons name="check" size={18} color="#2ecc71" />}
    </TouchableOpacity>
  );
}

function MusicModal({ visible, selectedId, onSelect, onClose }) {
  const { theme, isDark } = useTheme();
  const sheetInset = useSheetInset();
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [playingId, setPlayingId] = useState(null);
  const playerRef = useRef(null);

  React.useEffect(() => {
    if (visible && tracks.length === 0) {
      setLoading(true);
      Audio.setAudioModeAsync({ playsInSilentModeIOS: true }).catch(() => {});
      const loadTracks = async () => {
        try {
          const user = getAuth().currentUser;
          const headers = {};
          if (user) {
            const token = await user.getIdToken();
            headers.Authorization = `Bearer ${token}`;
          }
          const r = await fetch(`${BACKEND}/api/music-tracks`, { headers });
          const data = await r.json();
          setTracks(data.tracks || []);
        } catch(e) {
          console.warn('Music tracks error:', e);
          setTracks([]);
        } finally {
          setLoading(false);
        }
      };
      loadTracks();
    }
  }, [visible]);

  React.useEffect(() => {
    if (!visible && playerRef.current) {
      (async () => { try { await playerRef.current.stopAsync(); await playerRef.current.unloadAsync(); } catch (e) {} })();
      playerRef.current = null;
      setPlayingId(null);
    }
  }, [visible]);

  const onTogglePlay = async (item) => {
    if (playingId === item.id) {
      try { await playerRef.current?.pauseAsync(); } catch (e) {}
      setPlayingId(null);
      return;
    }
    if (playerRef.current) {
      try { playerRef.current.stopAsync(); playerRef.current.unloadAsync(); } catch (e) {}
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
        <View style={[styles.modalSheet, { backgroundColor: theme.settingBg, maxHeight: '85%' }, sheetInset]}>
          <View style={[styles.modalHandle, { backgroundColor: theme.handle }]} />
          <SheetHeader title="Background Music" onClose={onClose} style={styles.sheetHeaderPad} titleColor={theme.text} closeColor={theme.icon} />
          <TouchableOpacity
            onPress={() => { onSelect({ id: 'none', name: 'No Music' }); onClose(); }}
            style={{
              flexDirection: 'row', alignItems: 'center',
              backgroundColor: selectedId === 'none' ? (isDark ? '#1a3a1a' : '#e0f5e9') : theme.card,
              borderWidth: 1.5,
              borderColor: selectedId === 'none' ? '#2ecc71' : theme.border,
              borderRadius: 12, padding: 12, marginBottom: 8,
            }}
          >
            <MaterialIcons name="volume-off" size={18} color={theme.icon} style={{ marginRight: 12 }} />
            <Text style={{ color: selectedId === 'none' ? '#2ecc71' : theme.text, fontSize: 13, fontWeight: '600', flex: 1 }}>No Music</Text>
            {selectedId === 'none' && <MaterialIcons name="check" size={18} color="#2ecc71" />}
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
  const { theme } = useTheme();
  const sheetInset = useSheetInset();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
        <View style={[styles.modalSheet, { backgroundColor: theme.settingBg }, sheetInset]}>
          <View style={[styles.modalHandle, { backgroundColor: theme.handle }]} />
          <SheetHeader title={title} onClose={onClose} style={styles.sheetHeaderPad} titleColor={theme.text} closeColor={theme.icon} />
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
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
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
  const [voiceoverPlaying, setVoiceoverPlaying] = useState(false);
  const voiceoverPlayerRef = useRef(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [progress, setProgress] = useState(0);
  // Percentage of the finished video downloaded, separate from the generation progress.
  const [downloadPct, setDownloadPct] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [modal, setModal] = useState(null); // 'voice' | 'ratio' | 'caption' | 'transition' | 'music'
  const progressInterval = useRef(null);

  const selectedVoice = VOICES.find(v => v.id === voiceId);
  const selectedRatio = ASPECT_RATIOS.find(r => r.id === aspectRatio);
  const selectedCaption = resolveCaptionStyle(captionStyle);
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

  // The server's own progress, which arrives in jumps: 10, then 45, then 60, then 100.
  //
  // The bar used to bounce 20 -> 60 -> 20 -> 60 because BOTH a fake timer and the poll
  // were writing to the same state. startProgress(40, 95, 120000) crept upward on an
  // interval while the poll every three seconds overwrote it with the real value, so
  // the bar alternated between a guess and the truth.
  //
  // The server is the only source now. The fake timer is stopped the moment a real
  // value arrives, and the bar is not allowed to go backwards - a progress bar that
  // retreats reads as the work being redone, which is worse than one that pauses.
  const setServerProgress = (value) => {
    if (typeof value !== 'number' || Number.isNaN(value)) return;
    if (progressInterval.current) { clearInterval(progressInterval.current); progressInterval.current = null; }
    setProgress(prev => (value > prev ? value : prev));
  };
  const resetLoading = () => { stopProgress(0); setLoading(false); setLoadingMsg(''); setProgress(0); };

  const generateScript = async () => {
    if (!prompt.trim()) return showAlert('Error', 'Enter a prompt first');
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
      else showAlert('Error', data.error || 'Failed to generate script');
    } catch (err) { showAlert('Error', err.message); }
    resetLoading();
  };

  const generateVoiceover = async () => {
    if (!script.trim()) return showAlert('Error', 'Script is empty');
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
      else showAlert('Error', data.error || 'Failed to generate voiceover');
    } catch (err) { showAlert('Error', err.message); }
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
      if (!segments?.length) { showAlert('Error', segData.error || 'Failed to analyze script'); resetLoading(); return; }

      setLoadingMsg('Starting video generation...'); startProgress(20, 35, 3000);
      const mergeRes = await fetchWithTimeout(`${BACKEND}/api/idea-to-video-v2`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voiceover: script, segments,
          audioUrl, aspectRatio, captionStyle, transition, videoSpeed,
          // The server burns these captions in itself and has no copy of the
          // catalogue, so it needs the style rather than just its name.
          captionMeta: {
            spec: captionExportSpec(selectedCaption),
            font: selectedCaption.font || null,
            size: captionFontSize(selectedCaption),
            color: captionFill(selectedCaption).color,
            upper: !!selectedCaption.upper,
            words: captionChunkSize(selectedCaption),
          },
          musicTrack: musicTrack.id,
        }),
      }, 15000);
      const { jobId, error: jobError } = await mergeRes.json();
      if (!jobId) { showAlert('Error', jobError || 'Failed to start job'); resetLoading(); return; }

      // Poll for job completion
      // No fake timer here: this phase polls, so real progress is available and the two
      // would fight. 40 is where the previous phase left off, so the bar holds there
      // until the server's first report rather than snapping back to it.
      setLoadingMsg('Generating your video...'); stopProgress(40);
      const result = await new Promise((resolve, reject) => {
        const interval = setInterval(async () => {
          try {
            const pollRes = await fetchWithTimeout(`${BACKEND}/api/job/${jobId}`, {}, 10000);
            const job = await pollRes.json();
            if (job.message) setLoadingMsg(job.message);
            setServerProgress(job.progress);
            if (job.status === 'done') { clearInterval(interval); resolve(job); }
            else if (job.status === 'failed') { clearInterval(interval); reject(new Error(job.message)); }
          } catch (e) { clearInterval(interval); reject(e); }
        }, 3000);
        setTimeout(() => { clearInterval(interval); reject(new Error('Video generation timed out')); }, 300000);
      });

      stopProgress(100);
      if (result.videoUrl) { setVideoUrl(result.videoUrl); setStep(4); }
      else showAlert('Error', 'Failed to generate video');
    } catch (err) { stopProgress(0); showAlert('Error', err.message); }
    resetLoading();
  };

  const fullVideoUrl = videoUrl ? `${BACKEND}${videoUrl}` : null;

  const copyLink = async () => {
    await Clipboard.setStringAsync(fullVideoUrl);
    showAlert('Copied!', 'Video link copied to clipboard.');
  };

  // Was its own download-then-share, which meant this screen and My Videos behaved
  // differently for the same action - and neither showed how far along it was. A 26MB
  // file on a slow connection behind a bare spinner is indistinguishable from a hang,
  // which is what "takes forever" turned out to be.
  //
  // Shared helper now, so it also saves straight to the gallery on a build that has
  // media-library, and reports a percentage on the way.
  const downloadVideo = async () => {
    if (!fullVideoUrl) return;
    setDownloading(true);
    setDownloadPct(0);
    try {
      const { method } = await saveVideoToDevice(fullVideoUrl, { prompt }, setDownloadPct);
      setDownloading(false);
      if (method === 'gallery') showAlert('Saved', 'The video is in your gallery.');
    } catch (err) {
      setDownloading(false);
      showAlert('Download', err.message || 'Download failed.');
    }
  };

  const toggleVoiceoverPreview = async () => {
    if (voiceoverPlaying) {
      try { await voiceoverPlayerRef.current?.pauseAsync(); } catch(e) {}
      setVoiceoverPlaying(false);
      return;
    }
    try {
      if (voiceoverPlayerRef.current) {
        await voiceoverPlayerRef.current.stopAsync();
        await voiceoverPlayerRef.current.unloadAsync();
      }
      const { sound } = await Audio.Sound.createAsync({ uri: `${BACKEND}${audioUrl}` });
      voiceoverPlayerRef.current = sound;
      await sound.playAsync();
      setVoiceoverPlaying(true);
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.didJustFinish) setVoiceoverPlaying(false);
      });
    } catch(e) { console.warn('Voiceover preview error:', e); }
  };

  const resetAll = () => {
    setStep(1); setPrompt(''); setScript(''); setAudioUrl('');
    setVoiceoverPlaying(false);
    if (voiceoverPlayerRef.current) { voiceoverPlayerRef.current.stopAsync(); voiceoverPlayerRef.current.unloadAsync(); voiceoverPlayerRef.current = null; }
    setVideoUrl(''); setProgress(0); setLoadingMsg('');
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.bg, paddingBottom: insets.bottom || 16 }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.bg} />
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backRow}>
          <MaterialIcons name="arrow-back" size={20} color={theme.icon} />
          <Text style={styles.back}>Back</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.text }]}>Idea to Video</Text>
        <Text style={[styles.stepCount, { color: theme.subtext }]}>{step}/4</Text>
      </View>
      <StepDots current={step} total={4} theme={theme} />

      {/* STEP 1 */}
      {step === 1 && (
        <View style={{ flex: 1 }}>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 20, paddingBottom: 140 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: isDark ? '#1a2a1e' : '#e0f5e9', borderWidth: 1, borderColor: isDark ? '#2a3a2e' : '#a8e6c1', alignItems: 'center', justifyContent: 'center' }}>
                <MaterialIcons name="lightbulb" size={22} color="#54e98a" />
              </View>
              <Text style={[styles.stepTitle, { color: theme.text }]}>Your Idea</Text>
            </View>
            <View style={{ backgroundColor: theme.card, borderRadius: 20, borderWidth: 1, borderColor: theme.border, padding: 16, marginBottom: 8 }}>
              <TextInput
                style={{ color: theme.text, fontSize: 16, lineHeight: 24, minHeight: 120, textAlignVertical: 'top' }}
                placeholder="Describe your video idea in detail..."
                placeholderTextColor={theme.subtext}
                value={prompt}
                onChangeText={setPrompt}
                multiline
                numberOfLines={5}
              />
            </View>
            <Text style={{ color: theme.subtext, fontSize: 11, fontWeight: '600', letterSpacing: 1.5, marginTop: 24, marginBottom: 12, marginLeft: 4 }}>PRODUCTION SETTINGS</Text>
            <SettingCard icon="record-voice-over" iconColor="#60a5fa" iconBg="#0f1f35" label="Voice" value={`${selectedVoice.label} · ${selectedVoice.accent}`} onPress={() => setModal('voice')} />
            <SettingCard icon="crop-free" iconColor="#a78bfa" iconBg="#1a1035" label="Format" value={`${selectedRatio.label} · ${selectedRatio.desc}`} onPress={() => setModal('ratio')} />
            <SettingCard icon="subtitles" iconColor="#34d399" iconBg="#0a2a1a" label="Captions" value={`${selectedCaption.label} · ${selectedCaption.category}`} onPress={() => setModal('caption')} />
            <SettingCard icon="movie-filter" iconColor="#f472b6" iconBg="#2a0f1f" label="Transition" value={`${selectedTransition.label} · ${selectedTransition.desc}`} onPress={() => setModal('transition')} />
            <SettingCard icon="speed" iconColor="#fb923c" iconBg="#2a1500" label="Speed" value={selectedSpeed.label + ' · ' + selectedSpeed.desc} onPress={() => setModal('speed')} />
            <SettingCard icon="music-note" iconColor="#facc15" iconBg="#2a2000" label="Music" value={musicTrack.name} onPress={() => setModal('music')} />
            {loading && <ProgressBar progress={progress} label={loadingMsg} theme={theme} />}
          </ScrollView>
          <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 80, backgroundColor: theme.bg }}>
            <TouchableOpacity
              style={[{
                backgroundColor: '#2ecc71',
                borderRadius: 16,
                height: 50,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                elevation: 4,
              }, (loading || !prompt.trim()) && { opacity: 0.4 }]}
              onPress={generateScript}
              disabled={loading || !prompt.trim()}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color="#003919" />
                : <>
                    <MaterialIcons name="auto-awesome" size={22} color="#003919" />
                    <Text style={{ color: '#003919', fontSize: 16, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' }}>Generate Script</Text>
                  </>
              }
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* STEP 2 */}
      {step === 2 && (
        // flex: 1 on the step, not just on the input. The input already asked to fill
        // its parent, but the parent was content-sized, so it fell back to the 130px
        // minHeight and left most of the screen empty below the button - a generated
        // script is several paragraphs and had to be edited through a four-line window.
        <View style={[styles.stepContainer, { flex: 1 }]}>
          <Text style={[styles.stepTitle, { color: theme.text }]}>Your Script</Text>
          <Text style={[styles.stepSub, { color: theme.subtext }]}>Edit your AI-generated script below.</Text>
          <TextInput style={[styles.textArea, { flex: 1, backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.text }]} value={script} onChangeText={setScript} multiline />
          {loading && <ProgressBar progress={progress} label={loadingMsg} theme={theme} />}

          <TouchableOpacity style={[styles.btn, loading && styles.btnDisabled]} onPress={generateVoiceover} disabled={loading}>
            {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.btnText}>Generate Voiceover</Text>}
          </TouchableOpacity>
        </View>
      )}

      {/* STEP 3 */}
      {step === 3 && (
        <View style={styles.stepContainer}>
          <Text style={[styles.stepTitle, { color: theme.text }]}>Voiceover Ready!</Text>
          <Text style={[styles.stepSub, { color: theme.subtext }]}>Your AI voiceover has been generated successfully.</Text>
          <View style={[styles.successBox, { backgroundColor: isDark ? '#0d2b1a' : '#e0f5e9' }]}>
            <Text style={styles.successText}>Audio generated successfully</Text>
            <Text style={[styles.successSub, { color: theme.subtext }]}>Now we'll find matching video clips and merge everything together.</Text>
          </View>
          <TouchableOpacity style={[styles.btn, { backgroundColor: isDark ? '#1a1a2e' : '#eef0fa', borderWidth: 1, borderColor: '#2ecc71' }]} onPress={toggleVoiceoverPreview}>
            <Text style={[styles.btnText, { color: theme.text }]}>{voiceoverPlaying ? 'Pause Preview' : 'Preview Voiceover'}</Text>
          </TouchableOpacity>
          {loading && <ProgressBar progress={progress} label={loadingMsg} theme={theme} />}

          <TouchableOpacity style={[styles.btn, loading && styles.btnDisabled]} onPress={generateVideo} disabled={loading}>
            {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.btnText}>Generate Video</Text>}
          </TouchableOpacity>
        </View>
      )}

      {/* STEP 4 */}
      {step === 4 && fullVideoUrl && (
        <View style={styles.stepContainer}>
          <Text style={[styles.stepTitle, { color: theme.text }]}>Your Video is Ready!</Text>
          <VideoPlayer videoUrl={fullVideoUrl} />
          <TouchableOpacity style={[styles.btn, { backgroundColor: '#2ecc71' }]} onPress={() => navigation.navigate('EditPostVideo', { videoUrl: fullVideoUrl, videoPath: videoUrl })}>
            <Text style={styles.btnText}>Post / Schedule</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btn} onPress={copyLink}>
            <Text style={styles.btnText}>Copy Link</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, styles.btnDownload, downloading && styles.btnDisabled]} onPress={downloadVideo} disabled={downloading}>
            {downloading
              ? <Text style={[styles.btnText, { color: '#fff' }]}>Downloading… {downloadPct}%</Text>
              : <Text style={[styles.btnText, { color: '#fff' }]}>Download MP4</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, styles.btnPurple]} onPress={resetAll}>
            <Text style={[styles.btnText, { color: '#fff' }]}>Create Another Video</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* MODALS */}
      {/* Its own picker rather than the generic OptionModal: that drew the same mic
          icon on every row and had no way to hear anything, so choosing a voice meant
          reading "US Female 2" and hoping. */}
      <VoicePicker visible={modal === 'voice'} selectedId={voiceId} onSelect={setVoiceId} onClose={() => setModal(null)} />
      <OptionModal visible={modal === 'ratio'} title="Video Format" options={ASPECT_RATIOS} selectedId={aspectRatio} onSelect={setAspectRatio} onClose={() => setModal(null)} />
      <CaptionStyleSheet visible={modal === 'caption'} value={captionStyle} onChange={setCaptionStyle} onClose={() => setModal(null)} />
      <OptionModal visible={modal === 'speed'} title="Video Speed" options={VIDEO_SPEEDS.map(s => ({...s, id: s.id, label: s.label, desc: s.desc, }))} selectedId={videoSpeed} onSelect={(v) => setVideoSpeed(parseFloat(v))} onClose={() => setModal(null)} />
      <TransitionModal visible={modal === 'transition'} options={TRANSITION_STYLES} selectedId={transition} onSelect={setTransition} onClose={() => setModal(null)} />
      <MusicModal visible={modal === 'music'} selectedId={musicTrack.id} onSelect={setMusicTrack} onClose={() => setModal(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
// insets.bottom, matching IdeaToAudioScreen. Android's gesture/button bar sits over the
// window, so a screen that only pads the top has its last control underneath it - the
// Generate Voiceover button was half behind the navigation bar. `|| 16` because a device
// with no bar at all reports 0 and a button flush to the edge still reads as a mistake.
  container: { flex: 1, backgroundColor: '#121414', paddingTop: STATUSBAR_HEIGHT },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#1e2020' },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  back: { color: '#54e98a', fontSize: 16 },
  title: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  stepCount: { color: '#555', fontSize: 14 },
  dotsRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingVertical: 12 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#2a2a2a' },
  dotActive: { backgroundColor: '#54e98a', width: 24, borderRadius: 4 },
  stepContainer: { padding: 20, paddingBottom: 20 },
  stepTitle: { color: '#e3e2e2', fontSize: 22, fontWeight: 'bold', marginLeft: 10 },
  stepSub: { color: '#888', fontSize: 14, marginBottom: 20 },
  ideaHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  ideaIconBox: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#1e2020', borderWidth: 1, borderColor: '#2a3a2a', justifyContent: 'center', alignItems: 'center' },
  textAreaWrapper: { borderRadius: 20, borderWidth: 1, borderColor: '#2a3a2a', backgroundColor: '#1e2020', marginBottom: 24, overflow: 'hidden' },
  // minHeight is the floor for the steps that are not flex-filled; step 2 grows past
  // it. borderRadius/borderWidth so the box reads as a field rather than as a slab.
  textArea: { color: '#e3e2e2', padding: 18, textAlignVertical: 'top', fontSize: 16, minHeight: 200, borderRadius: 12, borderWidth: 1, marginBottom: 16, backgroundColor: 'transparent' },
  sectionLabel: { color: '#869486', fontSize: 11, fontWeight: '600', letterSpacing: 1.5, marginBottom: 12, paddingHorizontal: 4 },
  settingCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#1e2020', borderRadius: 20, borderWidth: 1, borderColor: '#2a3a2a', padding: 14, marginBottom: 10 },
  settingCardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  settingCardIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#292a2a', justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  settingCardLabel: { color: '#869486', fontSize: 11, fontWeight: '600', letterSpacing: 0.5, marginBottom: 2 },
  settingCardValue: { color: '#54e98a', fontSize: 14, fontWeight: '700' },
  settingCardChevron: { color: '#4a5a4a', fontSize: 22 },
  generateBtnContainer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, paddingBottom: 28 },
  generateBtn: { backgroundColor: '#2ecc71', borderRadius: 28, height: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, elevation: 6 },
  generateBtnIcon: { fontSize: 20 },
  generateBtnText: { color: '#003919', fontSize: 17, fontWeight: 'bold', letterSpacing: 0.5 },
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
  modalSheet: { backgroundColor: '#111', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '70%' },
  modalHandle: { width: 40, height: 4, backgroundColor: '#333', borderRadius: 2, alignSelf: 'center', marginVertical: 12 },
  sheetHeaderPad: { paddingHorizontal: 20, marginBottom: 12 },
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
