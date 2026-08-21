import React, { useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, StatusBar, TextInput
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useVideoPlayer, VideoView } from 'expo-video';
import { saveVideoToDevice } from '../utils/saveVideo';
import { showAlert } from '../components/BrandedAlert';
import ProgressButton from '../components/ProgressButton';

export default function PostRecordingScreen({ navigation, route }) {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  // The clip that was just recorded. This screen used to receive nothing at all and
  // drew a videocam icon on a grey rectangle in place of the footage.
  const uri = route?.params?.uri || null;
  const recordedSeconds = Number(route?.params?.seconds) || 0;
  const [refinement, setRefinement] = useState('');
  const [saving, setSaving] = useState(false);
  const [savePct, setSavePct] = useState(0);

  const player = useVideoPlayer(uri || null, p => { if (p) p.loop = false; });
  const soonRef = useRef(null);

  const soon = (what) => showAlert(what, 'Coming soon.');

  async function saveRaw() {
    if (!uri || saving) return;
    setSaving(true); setSavePct(0);
    try {
      const { method } = await saveVideoToDevice(uri, { prompt: 'Tonefy recording' }, setSavePct);
      if (method === 'gallery') showAlert('Saved', 'The recording is in your gallery.');
    } catch (e) {
      showAlert('Save failed', e?.message || 'Could not save the recording.');
    } finally { setSaving(false); }
  }

  function openInEditor() {
    if (!uri) return;
    // The editor already knows how to take a clip handed to it this way.
    navigation.navigate('EditVideo', { useVideo: { uri, seconds: recordedSeconds } });
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.bg, paddingTop: insets.top }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.bg} />
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={20} color={theme.icon} />
        </TouchableOpacity>
        <Text style={[styles.logo, { color: theme.text }]}>Tonefy AI</Text>
        <View style={{ width: 20 }} />
      </View>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Video Preview */}
        <View style={[styles.videoCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.videoPlaceholder}>
            <View style={styles.rawBadge}>
              <View style={styles.rawDot} />
              <Text style={styles.rawBadgeText}>RAW PREVIEW</Text>
            </View>
            {uri ? (
              // expo-video's own controls, rather than a play button and a timecode of
              // "0:12 / 0:45" that were painted on and wired to nothing.
              <VideoView player={player} style={StyleSheet.absoluteFill}
                nativeControls allowsFullscreen contentFit="contain" />
            ) : (
              <>
                <MaterialIcons name="videocam-off" size={40} color="#333" />
                <Text style={styles.noClipText}>No recording to show.</Text>
              </>
            )}
          </View>
          {/* The scrubber, play button, timecode and volume/settings icons that used to
              sit here were all painted on - none had a handler and the timecode was the
              literal string "0:12 / 0:45". The player above has real ones. */}
        </View>

        {/* Quick Edit Toggles */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: theme.subtext }]}>QUICK EDITS</Text>
          {/* These were four Switches bound to four useStates that nothing anywhere
              read - flicking one changed a boolean and then nothing. Dimmed and
              labelled, per the rule that an unbuilt control must not look live.
              Reduce noise genuinely exists, but on a clip in the editor rather than as
              a toggle here, so it points there instead of claiming to do it. */}
          <View style={[styles.toggleGrid, { backgroundColor: theme.card, borderColor: theme.border }]}>
            {[
              { label: 'Noise Reduction', where: 'editor' },
              { label: 'Face Retouch', where: 'soon' },
              { label: 'Auto-Levels', where: 'soon' },
              { label: 'Eye Contact Fix', where: 'soon' },
            ].map(item => (
              <TouchableOpacity
                key={item.label}
                style={styles.toggleItem}
                onPress={() => (item.where === 'editor'
                  ? showAlert(item.label, 'Open this clip in the editor and use Reduce noise on it.')
                  : soon(item.label))}
              >
                <Text style={[styles.toggleItemLabel, { color: '#5a5a5a' }]}>{item.label}</Text>
                <Text style={styles.soonTag}>{item.where === 'editor' ? 'IN EDITOR' : 'SOON'}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* AI Suggestions */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: theme.subtext }]}>AI SUGGESTIONS</Text>
          <View style={[styles.aiCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.aiCardHeader}>
              <MaterialIcons name="auto-awesome" size={20} color={theme.icon} />
              <Text style={[styles.aiCardTitle, { color: theme.text }]}>AI Suggestions</Text>
            </View>
            <Text style={[styles.aiCardSub, { color: theme.subtext }]}>Based on your content, we recommend these high-impact edits:</Text>
            {[
              { icon: 'bolt', label: 'Turn into motivational video' },
              { icon: 'movie', label: 'Add cinematic B-roll' },
            ].map(s => (
              <TouchableOpacity key={s.label} onPress={() => soon(s.label)}
                style={[styles.suggestionBtn, { backgroundColor: theme.divider, borderColor: theme.border }]}>
                <View style={styles.suggestionLeft}>
                  <MaterialIcons name={s.icon} size={20} color="#5a5a5a" />
                  <Text style={[styles.suggestionText, { color: '#5a5a5a' }]}>{s.label}</Text>
                </View>
                <Text style={styles.soonTag}>SOON</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Refine */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: theme.subtext }]}>REFINE WITH AI</Text>
          <View style={[styles.refineCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <TextInput
              style={[styles.refineInput, { color: theme.text, borderBottomColor: theme.border }]}
              placeholder="e.g. Make the colors warmer and add more film grain..."
              placeholderTextColor={theme.subtext}
              multiline
              value={refinement}
              onChangeText={setRefinement}
            />
            <TouchableOpacity style={styles.sendBtn} onPress={() => soon('Refine with AI')}>
              <MaterialIcons name="send" size={20} color="#04211f" />
            </TouchableOpacity>
            <View style={styles.promptChips}>
              {['Enhance Blue Tones', 'Reduce Noise', 'Add Slow-mo'].map(p => (
                <TouchableOpacity key={p} onPress={() => setRefinement(p)}
                  style={[styles.promptChip, { borderColor: theme.border }]}>
                  <Text style={[styles.promptChipText, { color: theme.subtext }]}>{p}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.section}>
          {/* The primary action is the editor, where the tools this screen only named
              actually exist - filters, motion, effects, captions and Reduce noise. It
              was "Enhance with AI" and did nothing. */}
          <TouchableOpacity style={styles.enhanceBtn} onPress={openInEditor} disabled={!uri}>
            <MaterialIcons name="auto-fix-high" size={20} color="#04211f" />
            <Text style={styles.enhanceBtnText}>Edit this clip</Text>
          </TouchableOpacity>
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: theme.card, borderColor: theme.border }]}
              onPress={() => navigation.replace('Recording')}>
              <MaterialIcons name="refresh" size={20} color={theme.text} />
              <Text style={[styles.actionBtnText, { color: theme.text }]}>Retake</Text>
            </TouchableOpacity>
            <ProgressButton
              variant="outline"
              label={saving ? `${savePct}%` : 'Save Raw'}
              progress={savePct}
              busy={saving}
              borderColor={theme.border}
              textColor={theme.text}
              icon="download"
              style={styles.saveRawBtn}
              labelStyle={styles.saveRawLabel}
              onPress={saveRaw}
            />
          </View>
        </View>

        {/* Stats */}
        <View style={[styles.section, { marginBottom: 40 }]}>
          <View style={[styles.statsCard, { backgroundColor: theme.card, borderLeftColor: theme.border }]}>
            <View>
              <Text style={[styles.statsLabel, { color: theme.subtext }]}>RESOLUTION</Text>
              <Text style={[styles.statsValue, { color: theme.text }]}>4K (2160p)</Text>
            </View>
            <View>
              <Text style={[styles.statsLabel, { color: theme.subtext }]}>FRAME RATE</Text>
              <Text style={[styles.statsValue, { color: theme.text }]}>60 FPS</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1a1a1a' },
  logo: { fontSize: 18, fontWeight: '800', color: '#fff' },
  videoCard: { margin: 16, backgroundColor: '#111', borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: '#2a2a2a' },
  videoPlaceholder: { height: 200, backgroundColor: '#0a0a0a', alignItems: 'center', justifyContent: 'center', position: 'relative' },
  rawBadge: { position: 'absolute', top: 12, left: 12, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  rawDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#00d4d4' },
  rawBadgeText: { color: '#fff', fontSize: 10, fontWeight: '600' },
  fullscreenBtn: { position: 'absolute', top: 10, right: 10, width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  timeline: { paddingHorizontal: 14, paddingTop: 10 },
  timelineTrack: { height: 3, backgroundColor: '#2a2a2a', borderRadius: 4, overflow: 'hidden' },
  timelineFill: { width: '33%', height: '100%', backgroundColor: '#00d4d4', borderRadius: 4 },
  playRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12 },
  playLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  playRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  timeCode: { color: '#888', fontSize: 11 },
  section: { paddingHorizontal: 16, marginBottom: 16 },
  sectionLabel: { fontSize: 10, fontWeight: '700', color: '#555', letterSpacing: 2, marginBottom: 10 },
  toggleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, backgroundColor: '#111', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#2a2a2a' },
  toggleItem: { width: '46%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  soonTag: { color: '#5a5a5a', fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
  noClipText: { color: '#5a5a5a', fontSize: 12, marginTop: 6 },
  saveRawBtn: { flex: 1, minHeight: 46, borderRadius: 10 },
  saveRawLabel: { fontSize: 13 },
  toggleItemLabel: { color: '#cfcfcf', fontSize: 12, flex: 1 },
  aiCard: { backgroundColor: '#111', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#2a2a2a', gap: 10 },
  aiCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  aiCardTitle: { fontSize: 16, fontWeight: '700', color: '#fff' },
  aiCardSub: { fontSize: 12, color: '#888' },
  suggestionBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1a1a1a', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#2a2a2a' },
  suggestionLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  suggestionText: { color: '#fff', fontSize: 13, fontWeight: '500' },
  refineCard: { backgroundColor: '#111', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#2a2a2a', gap: 10 },
  refineInput: { color: '#fff', fontSize: 13, minHeight: 70, textAlignVertical: 'top', borderBottomWidth: 1, borderBottomColor: '#2a2a2a', paddingBottom: 8 },
  sendBtn: { alignSelf: 'flex-end', backgroundColor: '#2ECC71', borderRadius: 8, padding: 8 },
  promptChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  promptChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: '#2a2a2a' },
  promptChipText: { color: '#888', fontSize: 11 },
  enhanceBtn: { backgroundColor: '#2ECC71', borderRadius: 12, height: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 10, shadowColor: '#2ECC71', shadowOpacity: 0.3, shadowRadius: 12 },
  enhanceBtnText: { color: '#04211f', fontWeight: '700', fontSize: 14 },
  actionRow: { flexDirection: 'row', gap: 10 },
  actionBtn: { flex: 1, height: 46, backgroundColor: '#111', borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: '#2a2a2a' },
  actionBtnText: { color: '#fff', fontSize: 13, fontWeight: '500' },
  statsCard: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#111', borderRadius: 12, padding: 14, borderLeftWidth: 3, borderLeftColor: '#2a2a2a' },
  statsLabel: { fontSize: 10, color: '#555', letterSpacing: 1, marginBottom: 4 },
  statsValue: { fontSize: 14, fontWeight: '700', color: '#fff' },
});
