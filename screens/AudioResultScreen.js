import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, StatusBar
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const BARS = 60;
const barHeights = [...Array(BARS)].map(() => Math.floor(Math.random() * 70) + 15);

export default function AudioResultScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const [playing, setPlaying] = useState(false);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor="#131313" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logo}>Tonefy AI</Text>
        <MaterialIcons name="settings" size={22} color="#bbcbbb" />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Title */}
        <Text style={styles.title}>Audio Result</Text>
        <Text style={styles.subtitle}>Your high-fidelity AI track is ready.</Text>

        {/* Audio Card */}
        <View style={styles.audioCard}>
          <View style={styles.trackInfo}>
            <View>
              <Text style={styles.trackName}>Marcus - Motivational</Text>
              <View style={styles.trackMeta}>
                <View style={styles.aiBadge}><Text style={styles.aiBadgeText}>AI GENERATED</Text></View>
                <Text style={styles.trackDuration}>1:20</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.moreBtn}>
              <MaterialIcons name="more-vert" size={22} color="#bbcbbb" />
            </TouchableOpacity>
          </View>

          {/* Waveform */}
          <View style={styles.waveform}>
            {barHeights.map((h, i) => (
              <View key={i} style={[styles.waveBar, { height: h * 0.8, opacity: i > BARS / 3 ? 0.3 : 1 }]} />
            ))}
          </View>

          {/* Scrubber */}
          <View style={styles.scrubber}>
            <View style={styles.scrubberTrack}>
              <View style={styles.scrubberFill} />
            </View>
          </View>

          {/* Controls */}
          <View style={styles.controls}>
            <Text style={styles.timeLabel}>0:28</Text>
            <View style={styles.playerBtns}>
              <TouchableOpacity><MaterialIcons name="skip-previous" size={28} color="#e5e2e1" /></TouchableOpacity>
              <TouchableOpacity style={styles.playBtn} onPress={() => setPlaying(!playing)}>
                <MaterialIcons name={playing ? 'pause' : 'play-arrow'} size={36} color="#003919" />
              </TouchableOpacity>
              <TouchableOpacity><MaterialIcons name="skip-next" size={28} color="#e5e2e1" /></TouchableOpacity>
            </View>
            <Text style={styles.timeLabel}>1:20</Text>
          </View>
        </View>

        {/* Add to Video */}
        <TouchableOpacity style={styles.addToVideoBtn} onPress={() => navigation.navigate('EditVideo')}>
          <MaterialIcons name="movie" size={20} color="#005027" />
          <Text style={styles.addToVideoText}>Add to Video</Text>
        </TouchableOpacity>

        {/* Action Grid */}
        <View style={styles.actionGrid}>
          {[
            { icon: 'edit-note', label: 'Edit Script' },
            { icon: 'download', label: 'Download' },
            { icon: 'share', label: 'Share' },
          ].map(a => (
            <TouchableOpacity key={a.label} style={styles.actionBtn}>
              <MaterialIcons name={a.icon} size={22} color="#bbcbbb" />
              <Text style={styles.actionLabel}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Transcript */}
        <View style={styles.transcriptHeader}>
          <Text style={styles.transcriptTitle}>Generated Transcript</Text>
          <TouchableOpacity><Text style={styles.copyAll}>COPY ALL</Text></TouchableOpacity>
        </View>
        <View style={styles.transcriptCard}>
          <View style={styles.transcriptRow}>
            <Text style={styles.timestamp}>0:00</Text>
            <Text style={styles.transcriptText}>Success isn't about being the best. It's about being better than you were yesterday. The journey of a thousand miles begins with a single, intentional step.</Text>
          </View>
          <View style={styles.transcriptRow}>
            <Text style={[styles.timestamp, { color: '#555' }]}>0:12</Text>
            <Text style={[styles.transcriptText, { opacity: 0.5 }]}>Every challenge you face is an opportunity to grow, to refine your craft, and to define your purpose in this digital studio of life.</Text>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#131313' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  logo: { fontSize: 20, fontWeight: '800', color: '#54e98a' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16 },
  title: { fontSize: 20, fontWeight: '700', color: '#e5e2e1', marginBottom: 4 },
  subtitle: { fontSize: 13, color: '#bbcbbb', marginBottom: 20 },
  audioCard: { backgroundColor: '#2a2a2a', borderRadius: 12, padding: 16, marginBottom: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' },
  trackInfo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  trackName: { fontSize: 16, fontWeight: '700', color: '#e5e2e1', marginBottom: 6 },
  trackMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  aiBadge: { backgroundColor: 'rgba(46,204,113,0.1)', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: 'rgba(46,204,113,0.2)' },
  aiBadgeText: { color: '#54e98a', fontSize: 9, fontWeight: '700' },
  trackDuration: { color: '#bbcbbb', fontSize: 11 },
  moreBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#201f1f', alignItems: 'center', justifyContent: 'center' },
  waveform: { flexDirection: 'row', alignItems: 'center', gap: 2, height: 80, marginBottom: 16, overflow: 'hidden' },
  waveBar: { width: 3, backgroundColor: '#2ecc71', borderRadius: 4 },
  scrubber: { marginBottom: 12 },
  scrubberTrack: { height: 4, backgroundColor: '#353534', borderRadius: 4, overflow: 'hidden' },
  scrubberFill: { width: '33%', height: '100%', backgroundColor: '#54e98a', borderRadius: 4 },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  timeLabel: { color: '#bbcbbb', fontSize: 11, fontWeight: '600', minWidth: 32 },
  playerBtns: { flexDirection: 'row', alignItems: 'center', gap: 24 },
  playBtn: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#54e98a', alignItems: 'center', justifyContent: 'center', shadowColor: '#2ecc71', shadowOpacity: 0.4, shadowRadius: 16 },
  addToVideoBtn: { backgroundColor: '#2ecc71', borderRadius: 12, height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 12 },
  addToVideoText: { color: '#005027', fontSize: 16, fontWeight: '700' },
  actionGrid: { flexDirection: 'row', gap: 8, marginBottom: 24 },
  actionBtn: { flex: 1, backgroundColor: '#2a2a2a', borderRadius: 12, paddingVertical: 16, alignItems: 'center', gap: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  actionLabel: { color: '#bbcbbb', fontSize: 11, fontWeight: '600' },
  transcriptHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  transcriptTitle: { fontSize: 16, fontWeight: '700', color: '#e5e2e1' },
  copyAll: { color: '#54e98a', fontSize: 11, fontWeight: '600', letterSpacing: 1 },
  transcriptCard: { backgroundColor: '#201f1f', borderRadius: 12, padding: 14, gap: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  transcriptRow: { flexDirection: 'row', gap: 12 },
  timestamp: { color: '#54e98a', fontSize: 11, fontWeight: '600', minWidth: 32, marginTop: 2 },
  transcriptText: { flex: 1, color: '#e5e2e1', fontSize: 13, lineHeight: 20 },
});
