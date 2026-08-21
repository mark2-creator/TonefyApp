import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, StatusBar
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { showAlert } from '../components/BrandedAlert';
import FilterSheet from '../components/FilterPicker';
import EffectPicker from '../components/EffectPicker';
import { resolveFilter } from '../constants/filters';
import { resolveEffect } from '../constants/effects';
import { usePlan } from '../constants/plan';

const BACKEND = 'https://api.fitlifesolutions.site';

// What the render can actually produce. "4K 60" was offered and the export has no 4K
// path at all - the resolution picker in the editor tops out at 1080p and the free plan
// is clamped to 720p, so the old list promised two things that could not happen.
const QUALITIES = ['720p', '1080p'];
// Seconds, so the recorder can enforce them rather than the label being decorative.
const DURATIONS = [15, 30, 60, 180];

export default function RecordToVideoScreen({ navigation }) {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { isPremium, caps } = usePlan();
  // These were seven useStates that nothing read - two chip rows and five Switches, all
  // of them a value written and never used again. Quality and duration are real
  // recording settings now, and the look is chosen from the same sheets the editor uses
  // and carried through to the screen that can apply it.
  const [quality, setQuality] = useState('1080p');
  const [duration, setDuration] = useState(60);
  const [filter, setFilter] = useState('None');
  const [effect, setEffect] = useState('none');
  const [sheet, setSheet] = useState(null);

  return (
    <View style={[styles.container, { backgroundColor: theme.bg, paddingTop: insets.top, paddingBottom: insets.bottom || 16 }]}>
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
              <TouchableOpacity key={q}
                style={[styles.chip, { backgroundColor: theme.card, borderColor: theme.border }, quality === q && styles.chipActive]}
                onPress={() => (q === '1080p' && caps?.maxResolution === '720p'
                  ? showAlert('1080p', 'Your plan records at 720p. Pro and Creator go to 1080p.')
                  : setQuality(q))}>
                <Text style={[styles.chipText, { color: theme.subtext }, quality === q && styles.chipTextActive]}>{q}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: theme.subtext }]}>DURATION</Text>
          <View style={styles.chips}>
            {DURATIONS.map(d => (
              <TouchableOpacity key={d}
                style={[styles.chip, { backgroundColor: theme.card, borderColor: theme.border }, duration === d && styles.chipActive]}
                onPress={() => setDuration(d)}>
                <Text style={[styles.chipText, { color: theme.subtext }, duration === d && styles.chipTextActive]}>
                  {d < 60 ? `${d}s` : `${d / 60}m`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        <View style={styles.section}>
          <View style={styles.cameraPreview}>
            <MaterialIcons name="videocam" size={56} color="#1e1e1e" />
            <Text style={styles.cameraText}>The camera opens when you tap record</Text>
            <View style={styles.timerBadge}>
              <View style={styles.timerDot} />
              <Text style={styles.timerText}>00:00</Text>
            </View>
            {/* The preview here is a placeholder, not a live camera - the real one is the
              Recording screen. Flipping a still has nothing to flip. */}
            <TouchableOpacity style={styles.flipBtn} onPress={() => showAlert('Flip camera', 'Start recording first - the camera opens on the next screen.')}>
              <MaterialIcons name="flip-camera-ios" size={20} color="#fff" />
            </TouchableOpacity>
            {/* The Video/Photo switcher is gone. Neither chip was pressable and there is
                no photo path anywhere in the app, so it was a control that could not be
                used offering a mode that did not exist. */}
          </View>
        </View>
        <View style={styles.recordBtnRow}>
          <TouchableOpacity style={styles.recordBtn}
            onPress={() => navigation.navigate('Recording', { maxSeconds: duration, quality, filter, effect })}>
            <View style={styles.recordInner} />
          </TouchableOpacity>
          <Text style={[styles.recordHint, { color: theme.subtext }]}>Tap to start recording</Text>
        </View>
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: theme.subtext }]}>LOOK</Text>
          {/* Five Switches lived here - Auto-subtitles, Music, Effects, B-roll,
              Voiceover - each bound to a useState nothing read. Three of them did not
              belong on a screen about recording yourself anyway: B-roll is stock footage
              for a generated video, Voiceover is a synthesised one over footage you did
              not record, and subtitles need the words before they can exist.
              What DOES belong is the look, chosen before you record so the screen after
              opens with it already applied - and chosen from the same sheets the editor
              uses rather than a boolean. */}
          <View style={[styles.toggleCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            {[
              { key: 'filter', icon: 'photo-filter', label: 'Filter', value: resolveFilter(filter).label },
              { key: 'effect', icon: 'auto-awesome', label: 'Effect', value: resolveEffect(effect).label },
            ].map((r, i, arr) => (
              <TouchableOpacity key={r.key} onPress={() => setSheet(r.key)}
                style={[styles.toggleRow, i < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.border }]}>
                <View style={styles.toggleLeft}>
                  <MaterialIcons name={r.icon} size={20} color="#2ecc71" />
                  <Text style={[styles.toggleLabel, { color: theme.text }]}>{r.label}</Text>
                </View>
                <Text style={[styles.rowValue, { color: theme.subtext }]} numberOfLines={1}>{r.value}</Text>
                <MaterialIcons name="chevron-right" size={20} color={theme.icon} />
              </TouchableOpacity>
            ))}
          </View>
          <Text style={[styles.lookHint, { color: theme.subtext }]}>
            Music, subtitles and more are on the next screen, once there is something to
            put them on.
          </Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      <FilterSheet visible={sheet === 'filter'} value={filter} backend={BACKEND} isPremium={isPremium}
        onSelect={(id) => { setFilter(id); setSheet(null); }}
        onLocked={(f) => showAlert(f.label, 'Available on the Pro and Creator plans.')}
        onClose={() => setSheet(null)} />
      <EffectPicker visible={sheet === 'effect'} value={effect} backend={BACKEND} isPremium={isPremium}
        onSelect={(id) => { setEffect(id); setSheet(null); }}
        onLocked={(e) => showAlert(e.label, 'Available on the Pro and Creator plans.')}
        onClose={() => setSheet(null)} />
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
  rowValue: { fontSize: 12, maxWidth: 120, textAlign: 'right' },
  lookHint: { fontSize: 11, lineHeight: 16, marginTop: 8 },
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
