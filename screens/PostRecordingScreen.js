import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, StatusBar, Switch, TextInput
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function PostRecordingScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [noiseReduction, setNoiseReduction] = useState(true);
  const [faceRetouch, setFaceRetouch] = useState(false);
  const [autoLevels, setAutoLevels] = useState(true);
  const [eyeContact, setEyeContact] = useState(false);
  const [refinement, setRefinement] = useState('');

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a0a" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={20} color="#888" />
        </TouchableOpacity>
        <Text style={styles.logo}>Tonefy AI</Text>
        <View style={{ width: 20 }} />
      </View>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Video Preview */}
        <View style={styles.videoCard}>
          <View style={styles.videoPlaceholder}>
            <View style={styles.rawBadge}>
              <View style={styles.rawDot} />
              <Text style={styles.rawBadgeText}>RAW PREVIEW</Text>
            </View>
            <MaterialIcons name="videocam" size={48} color="#1a1a1a" />
            <TouchableOpacity style={styles.fullscreenBtn}>
              <MaterialIcons name="fullscreen" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
          <View style={styles.timeline}>
            <View style={styles.timelineTrack}>
              <View style={styles.timelineFill} />
            </View>
          </View>
          <View style={styles.playRow}>
            <View style={styles.playLeft}>
              <TouchableOpacity><MaterialIcons name="play-arrow" size={24} color="#fff" /></TouchableOpacity>
              <Text style={styles.timeCode}>0:12 / 0:45</Text>
            </View>
            <View style={styles.playRight}>
              <TouchableOpacity><MaterialIcons name="volume-up" size={20} color="#888" /></TouchableOpacity>
              <TouchableOpacity><MaterialIcons name="settings" size={20} color="#888" /></TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Quick Edit Toggles */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>QUICK EDITS</Text>
          <View style={styles.toggleGrid}>
            {[
              { label: 'Noise Reduction', value: noiseReduction, set: setNoiseReduction },
              { label: 'Face Retouch', value: faceRetouch, set: setFaceRetouch },
              { label: 'Auto-Levels', value: autoLevels, set: setAutoLevels },
              { label: 'Eye Contact Fix', value: eyeContact, set: setEyeContact },
            ].map(item => (
              <View key={item.label} style={styles.toggleItem}>
                <Text style={styles.toggleItemLabel}>{item.label}</Text>
                <Switch value={item.value} onValueChange={item.set} trackColor={{ false: '#333', true: '#2ECC71' }} thumbColor="#fff" />
              </View>
            ))}
          </View>
        </View>

        {/* AI Suggestions */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>AI SUGGESTIONS</Text>
          <View style={styles.aiCard}>
            <View style={styles.aiCardHeader}>
              <MaterialIcons name="auto-awesome" size={20} color="#888" />
              <Text style={styles.aiCardTitle}>AI Suggestions</Text>
            </View>
            <Text style={styles.aiCardSub}>Based on your content, we recommend these high-impact edits:</Text>
            {[
              { icon: 'bolt', label: 'Turn into motivational video' },
              { icon: 'movie', label: 'Add cinematic B-roll' },
            ].map(s => (
              <TouchableOpacity key={s.label} style={styles.suggestionBtn}>
                <View style={styles.suggestionLeft}>
                  <MaterialIcons name={s.icon} size={20} color="#e6e6e6" />
                  <Text style={styles.suggestionText}>{s.label}</Text>
                </View>
                <MaterialIcons name="chevron-right" size={20} color="#555" />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Refine */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>REFINE WITH AI</Text>
          <View style={styles.refineCard}>
            <TextInput
              style={styles.refineInput}
              placeholder="e.g. Make the colors warmer and add more film grain..."
              placeholderTextColor="#555"
              multiline
              value={refinement}
              onChangeText={setRefinement}
            />
            <TouchableOpacity style={styles.sendBtn}>
              <MaterialIcons name="send" size={20} color="#04211f" />
            </TouchableOpacity>
            <View style={styles.promptChips}>
              {['Enhance Blue Tones', 'Reduce Noise', 'Add Slow-mo'].map(p => (
                <TouchableOpacity key={p} style={styles.promptChip}>
                  <Text style={styles.promptChipText}>{p}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.enhanceBtn}>
            <MaterialIcons name="auto-fix-high" size={20} color="#04211f" />
            <Text style={styles.enhanceBtnText}>Enhance with AI</Text>
          </TouchableOpacity>
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.actionBtn}>
              <MaterialIcons name="refresh" size={20} color="#fff" />
              <Text style={styles.actionBtnText}>Retake</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn}>
              <MaterialIcons name="download" size={20} color="#fff" />
              <Text style={styles.actionBtnText}>Save Raw</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats */}
        <View style={[styles.section, { marginBottom: 40 }]}>
          <View style={styles.statsCard}>
            <View>
              <Text style={styles.statsLabel}>RESOLUTION</Text>
              <Text style={styles.statsValue}>4K (2160p)</Text>
            </View>
            <View>
              <Text style={styles.statsLabel}>FRAME RATE</Text>
              <Text style={styles.statsValue}>60 FPS</Text>
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
