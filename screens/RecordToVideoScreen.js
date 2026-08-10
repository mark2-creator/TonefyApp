import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, StatusBar, Switch
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';

const QUALITIES = ['4K 60', '1080p 60', '720p 30'];
const DURATIONS = ['15s', '60s', '3m'];

export default function RecordToVideoScreen({ navigation }) {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [quality, setQuality] = useState('4K 60');
  const [duration, setDuration] = useState('60s');
  const [subtitles, setSubtitles] = useState(true);
  const [music, setMusic] = useState(true);
  const [effects, setEffects] = useState(false);
  const [broll, setBroll] = useState(true);
  const [voiceover, setVoiceover] = useState(false);

  return (
    <View style={[styles.container, { backgroundColor: theme.bg, paddingTop: insets.top }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.bg} />
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={22} color={theme.icon} />
        </TouchableOpacity>
        <Text style={styles.logo}>Tonefy AI</Text>
        <View style={{ width: 22 }} />
      </View>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.titleSection}>
          <View style={styles.titleIcons}>
            <MaterialIcons name="mic" size={22} color="#2ecc71" />
            <MaterialIcons name="videocam" size={22} color="#2ecc71" />
          </View>
          <Text style={[styles.title, { color: theme.text }]}>Record to Video</Text>
          <Text style={[styles.titleSub, { color: theme.subtext }]}>Turn recordings into polished videos with subtitles</Text>
        </View>
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: theme.subtext }]}>QUALITY</Text>
          <View style={styles.chips}>
            {QUALITIES.map(q => (
              <TouchableOpacity key={q} style={[styles.chip, { backgroundColor: theme.card, borderColor: theme.border }, quality === q && styles.chipActive]} onPress={() => setQuality(q)}>
                <Text style={[styles.chipText, { color: theme.subtext }, quality === q && styles.chipTextActive]}>{q}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: theme.subtext }]}>DURATION</Text>
          <View style={styles.chips}>
            {DURATIONS.map(d => (
              <TouchableOpacity key={d} style={[styles.chip, { backgroundColor: theme.card, borderColor: theme.border }, duration === d && styles.chipActive]} onPress={() => setDuration(d)}>
                <Text style={[styles.chipText, { color: theme.subtext }, duration === d && styles.chipTextActive]}>{d}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        <View style={styles.section}>
          <View style={styles.cameraPreview}>
            <MaterialIcons name="videocam" size={56} color="#1e1e1e" />
            <Text style={styles.cameraText}>Camera preview</Text>
            <View style={styles.timerBadge}>
              <View style={styles.timerDot} />
              <Text style={styles.timerText}>00:00</Text>
            </View>
            <TouchableOpacity style={styles.flipBtn}>
              <MaterialIcons name="flip-camera-ios" size={20} color="#fff" />
            </TouchableOpacity>
            <View style={styles.modeSwitcher}>
              <View style={styles.modeChipActive}><Text style={styles.modeChipTextActive}>Video</Text></View>
              <View style={styles.modeChip}><Text style={styles.modeChipText}>Photo</Text></View>
            </View>
          </View>
        </View>
        <View style={styles.recordBtnRow}>
          <TouchableOpacity style={styles.recordBtn} onPress={() => navigation.navigate('Recording')}>
            <View style={styles.recordInner} />
          </TouchableOpacity>
          <Text style={[styles.recordHint, { color: theme.subtext }]}>Tap to start recording</Text>
        </View>
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: theme.subtext }]}>AI ENHANCEMENTS</Text>
          <View style={[styles.toggleCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            {[
              { label: 'Auto-subtitles', icon: 'subtitles', value: subtitles, set: setSubtitles },
              { label: 'Music', icon: 'music-note', value: music, set: setMusic },
              { label: 'Effects', icon: 'auto-fix-high', value: effects, set: setEffects },
              { label: 'B-roll', icon: 'layers', value: broll, set: setBroll },
              { label: 'Voiceover', icon: 'keyboard-voice', value: voiceover, set: setVoiceover },
            ].map((item, i, arr) => (
              <View key={item.label} style={[styles.toggleRow, i < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.border }]}>
                <View style={styles.toggleLeft}>
                  <MaterialIcons name={item.icon} size={20} color="#2ecc71" />
                  <Text style={[styles.toggleLabel, { color: theme.text }]}>{item.label}</Text>
                </View>
                <Switch value={item.value} onValueChange={item.set} trackColor={{ false: '#333', true: '#2ecc71' }} thumbColor="#fff" />
              </View>
            ))}
          </View>
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1a1a1a' },
  logo: { fontSize: 18, fontWeight: '800', color: '#2ecc71' },
  titleSection: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8 },
  titleIcons: { flexDirection: 'row', gap: 6, marginBottom: 8 },
  title: { fontSize: 26, fontWeight: '700', color: '#fff', marginBottom: 4 },
  titleSub: { fontSize: 13, color: '#666' },
  section: { paddingHorizontal: 16, marginBottom: 20 },
  sectionLabel: { fontSize: 10, fontWeight: '700', color: '#666', letterSpacing: 2, marginBottom: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: '#141414', borderWidth: 1, borderColor: '#1e1e1e' },
  chipActive: { backgroundColor: 'rgba(46,204,113,0.1)', borderColor: '#2ecc71' },
  chipText: { color: '#666', fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: '#2ecc71' },
  cameraPreview: { height: 280, backgroundColor: '#111', borderRadius: 16, borderWidth: 1, borderColor: '#1e1e1e', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative' },
  cameraText: { color: '#333', fontSize: 13, marginTop: 8 },
  timerBadge: { position: 'absolute', top: 14, left: 14, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  timerDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#ff4444' },
  timerText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  flipBtn: { position: 'absolute', top: 12, right: 12, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  modeSwitcher: { position: 'absolute', bottom: 14, flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 999, padding: 4 },
  modeChipActive: { paddingHorizontal: 18, paddingVertical: 7, borderRadius: 999, backgroundColor: '#2ecc71' },
  modeChipTextActive: { color: '#003919', fontWeight: '700', fontSize: 13 },
  modeChip: { paddingHorizontal: 18, paddingVertical: 7, borderRadius: 999 },
  modeChipText: { color: '#888', fontSize: 13 },
  recordBtnRow: { alignItems: 'center', gap: 10, marginBottom: 24 },
  recordBtn: { width: 80, height: 80, borderRadius: 40, borderWidth: 4, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  recordInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#2ecc71' },
  recordHint: { color: '#555', fontSize: 12 },
  toggleCard: { backgroundColor: '#111', borderRadius: 14, borderWidth: 1, borderColor: '#1e1e1e', overflow: 'hidden' },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14 },
  toggleBorder: { borderBottomWidth: 1, borderBottomColor: '#1a1a1a' },
  toggleLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  toggleLabel: { color: '#e5e2e1', fontSize: 14 },
});
