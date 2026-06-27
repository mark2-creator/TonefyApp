import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, StatusBar
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const DURATIONS = ['30s', '1m', '2m', '5m'];
const STYLES = ['Motivational', 'Podcast', 'Storytelling', 'Educational', 'Casual'];

export default function IdeaToAudioScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [idea, setIdea] = useState('');
  const [duration, setDuration] = useState('1m');
  const [tags, setTags] = useState(['Motivational']);

  function toggleTag(tag) {
    setTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  }

  function generate() {
    if (!idea.trim()) return;
    navigation.navigate('GeneratingAudio', { idea, duration, tags });
  }

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
        <View style={styles.titleRow}>
          <MaterialIcons name="auto-awesome" size={22} color="#54e98a" />
          <Text style={styles.title}>Idea to Audio</Text>
        </View>

        {/* Idea Input */}
        <Text style={styles.label}>Describe your idea...</Text>
        <View style={styles.inputBox}>
          <TextInput
            style={styles.input}
            placeholder="A motivational talk about overcoming failure for young entrepreneurs"
            placeholderTextColor="#444"
            multiline
            value={idea}
            onChangeText={setIdea}
          />
          <MaterialIcons name="edit-note" size={22} color="#333" style={styles.inputIcon} />
        </View>

        {/* Voice */}
        <Text style={styles.label}>Voice</Text>
        <TouchableOpacity style={styles.voiceBtn}>
          <View style={styles.voiceLeft}>
            <View style={styles.voiceIcon}>
              <MaterialIcons name="record-voice-over" size={20} color="#3398db" />
            </View>
            <Text style={styles.voiceText}>Marcus - Professional Male</Text>
          </View>
          <MaterialIcons name="expand-more" size={22} color="#bbcbbb" />
        </TouchableOpacity>

        {/* Duration */}
        <Text style={styles.label}>Duration</Text>
        <View style={styles.chips}>
          {DURATIONS.map(d => (
            <TouchableOpacity
              key={d}
              style={[styles.chip, duration === d && styles.chipActive]}
              onPress={() => setDuration(d)}
            >
              <Text style={[styles.chipText, duration === d && styles.chipTextActive]}>{d}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Style Tags */}
        <Text style={styles.label}>Style Tags</Text>
        <View style={styles.chips}>
          {STYLES.map(tag => (
            <TouchableOpacity
              key={tag}
              style={[styles.chip, tags.includes(tag) && styles.chipActive]}
              onPress={() => toggleTag(tag)}
            >
              {tags.includes(tag) && <MaterialIcons name="check" size={12} color="#54e98a" />}
              <Text style={[styles.chipText, tags.includes(tag) && styles.chipTextActive]}>{tag}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Generate Button */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom || 16 }]}>
        <TouchableOpacity
          style={[styles.generateBtn, !idea.trim() && styles.generateBtnDisabled]}
          onPress={generate}
          disabled={!idea.trim()}
        >
          <MaterialIcons name="auto-fix-high" size={20} color="#003919" />
          <Text style={styles.generateBtnText}>GENERATE AUDIO</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#131313' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  logo: { fontSize: 20, fontWeight: '800', color: '#54e98a' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20 },
  title: { fontSize: 22, fontWeight: '700', color: '#e5e2e1' },
  label: { fontSize: 11, fontWeight: '600', color: '#bbcbbb', letterSpacing: 1, marginBottom: 6, marginLeft: 2 },
  inputBox: { backgroundColor: 'rgba(26,26,26,0.6)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', marginBottom: 20, position: 'relative' },
  input: { color: '#e5e2e1', fontSize: 14, padding: 16, height: 160, textAlignVertical: 'top' },
  inputIcon: { position: 'absolute', bottom: 12, right: 12 },
  voiceBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(26,26,26,0.6)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', padding: 14, marginBottom: 20 },
  voiceLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  voiceIcon: { width: 36, height: 36, borderRadius: 8, backgroundColor: 'rgba(51,152,219,0.15)', alignItems: 'center', justifyContent: 'center' },
  voiceText: { color: '#e5e2e1', fontSize: 14, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, backgroundColor: '#1c1b1b', borderWidth: 1, borderColor: '#353534', flexDirection: 'row', alignItems: 'center', gap: 4 },
  chipActive: { backgroundColor: 'rgba(46,204,113,0.1)', borderColor: '#2ecc71' },
  chipText: { color: '#bbcbbb', fontSize: 11, fontWeight: '600' },
  chipTextActive: { color: '#54e98a' },
  bottomBar: { paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)', backgroundColor: '#131313' },
  generateBtn: { backgroundColor: '#54e98a', borderRadius: 12, height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, shadowColor: '#2ecc71', shadowOpacity: 0.3, shadowRadius: 20 },
  generateBtnDisabled: { backgroundColor: '#1c1b1b' },
  generateBtnText: { color: '#003919', fontWeight: '700', fontSize: 12, letterSpacing: 2 },
});
