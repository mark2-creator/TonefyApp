import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, StatusBar, Switch
} from 'react-native';
import Slider from '@react-native-community/slider';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const INFLECTIONS = ['Soft', 'Natural', 'Intense', 'Dramatic'];

export default function ScriptToAudioScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [script, setScript] = useState('');
  const [pace, setPace] = useState(1.0);
  const [pitch, setPitch] = useState(0);
  const [inflection, setInflection] = useState('Natural');
  const [bgMusic, setBgMusic] = useState(false);
  const [autoBreaths, setAutoBreaths] = useState(true);

  function generate() {
    if (!script.trim()) return;
    navigation.navigate('GeneratingAudio', { idea: script, duration: '1m', tags: [inflection] });
  }

  const pitchLabel = pitch === 0 ? 'Default' : pitch > 0 ? `+${pitch}` : `${pitch}`;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor="#131313" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <MaterialIcons name="arrow-back-ios" size={20} color="#bbcbbb" />
          </TouchableOpacity>
          <Text style={styles.logo}>Tonefy AI</Text>
        </View>
        <View style={styles.headerRight}>
          <MaterialIcons name="settings" size={22} color="#bbcbbb" />
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* Title */}
        <View style={styles.titleRow}>
          <View style={styles.titleIcon}>
            <MaterialIcons name="description" size={26} color="#2ecc71" />
          </View>
          <View>
            <Text style={styles.title}>Script to Audio</Text>
            <Text style={styles.titleSub}>Transform your text into professional voiceovers</Text>
          </View>
        </View>

        {/* Script Input */}
        <View style={styles.inputBox}>
          <TextInput
            style={styles.input}
            placeholder="Paste or write your script here..."
            placeholderTextColor="#444"
            multiline
            value={script}
            onChangeText={setScript}
          />
          <View style={styles.inputToolbar}>
            <View style={styles.inputBtns}>
              <TouchableOpacity style={styles.inputBtn}>
                <MaterialIcons name="content-paste" size={16} color="#e5e2e1" />
                <Text style={styles.inputBtnText}>Paste</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.inputBtn}>
                <MaterialIcons name="upload-file" size={16} color="#e5e2e1" />
                <Text style={styles.inputBtnText}>Upload</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.charCount}>{script.length} / 5000 chars</Text>
          </View>
        </View>

        {/* Voice Selection */}
        <Text style={styles.sectionLabel}>VOICE SELECTION</Text>
        <TouchableOpacity style={styles.voiceBtn}>
          <View style={styles.voiceLeft}>
            <View style={styles.voiceAvatar}>
              <MaterialIcons name="record-voice-over" size={22} color="#3398db" />
            </View>
            <View>
              <Text style={styles.voiceName}>Marcus</Text>
              <View style={styles.voiceMeta}>
                <Text style={styles.voiceType}>Professional Male</Text>
                <View style={styles.premiumBadge}>
                  <Text style={styles.premiumText}>PREMIUM</Text>
                </View>
              </View>
            </View>
          </View>
          <MaterialIcons name="chevron-right" size={22} color="#bbcbbb" />
        </TouchableOpacity>

        {/* Audio Customization */}
        <Text style={styles.sectionLabel}>AUDIO CUSTOMIZATION</Text>
        <View style={styles.customCard}>
          {/* Pace */}
          <View style={styles.sliderRow}>
            <View style={styles.sliderLabelRow}>
              <Text style={styles.sliderLabel}>Pace</Text>
              <Text style={styles.sliderValue}>{pace.toFixed(1)}x</Text>
            </View>
            <Slider
              style={styles.slider}
              minimumValue={0.5}
              maximumValue={2.0}
              step={0.1}
              value={pace}
              minimumTrackTintColor="#2ecc71"
              maximumTrackTintColor="#353534"
              thumbTintColor="#2ecc71"
              onValueChange={setPace}
            />
          </View>

          {/* Pitch */}
          <View style={styles.sliderRow}>
            <View style={styles.sliderLabelRow}>
              <Text style={styles.sliderLabel}>Pitch</Text>
              <Text style={styles.sliderValue}>{pitchLabel}</Text>
            </View>
            <Slider
              style={styles.slider}
              minimumValue={-5}
              maximumValue={5}
              step={1}
              value={pitch}
              minimumTrackTintColor="#2ecc71"
              maximumTrackTintColor="#353534"
              thumbTintColor="#2ecc71"
              onValueChange={v => setPitch(Math.round(v))}
            />
          </View>

          {/* Inflection */}
          <Text style={styles.sliderLabel}>Emotional Inflection</Text>
          <View style={styles.chips}>
            {INFLECTIONS.map(inf => (
              <TouchableOpacity
                key={inf}
                style={[styles.chip, inflection === inf && styles.chipActive]}
                onPress={() => setInflection(inf)}
              >
                <Text style={[styles.chipText, inflection === inf && styles.chipTextActive]}>{inf}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Advanced Options */}
        <Text style={styles.sectionLabel}>ADVANCED OPTIONS</Text>
        <View style={styles.advancedCard}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleLeft}>
              <MaterialIcons name="music-note" size={20} color="#92ccff" />
              <Text style={styles.toggleLabel}>Background Music</Text>
            </View>
            <Switch
              value={bgMusic}
              onValueChange={setBgMusic}
              trackColor={{ false: '#353534', true: '#2ecc71' }}
              thumbColor="#fff"
            />
          </View>
          <View style={[styles.toggleRow, { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' }]}>
            <View style={styles.toggleLeft}>
              <MaterialIcons name="air" size={20} color="#58e5c2" />
              <Text style={styles.toggleLabel}>Auto-Breaths</Text>
            </View>
            <Switch
              value={autoBreaths}
              onValueChange={setAutoBreaths}
              trackColor={{ false: '#353534', true: '#2ecc71' }}
              thumbColor="#fff"
            />
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Generate Button */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom || 16 }]}>
        <TouchableOpacity
          style={[styles.generateBtn, !script.trim() && styles.generateBtnDisabled]}
          onPress={generate}
          disabled={!script.trim()}
        >
          <MaterialIcons name="auto-awesome" size={22} color="#003919" />
          <Text style={styles.generateBtnText}>GENERATE AUDIO</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#131313' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: { padding: 4 },
  logo: { fontSize: 20, fontWeight: '800', color: '#2ecc71' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 16 },

  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  titleIcon: { width: 48, height: 48, borderRadius: 12, backgroundColor: 'rgba(46,204,113,0.1)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(46,204,113,0.2)' },
  title: { fontSize: 22, fontWeight: '700', color: '#e5e2e1' },
  titleSub: { fontSize: 11, color: '#bbcbbb', marginTop: 2 },

  inputBox: { backgroundColor: '#201f1f', borderRadius: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' },
  input: { color: '#e5e2e1', fontSize: 14, padding: 16, height: 160, textAlignVertical: 'top' },
  inputToolbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)', backgroundColor: 'rgba(14,14,14,0.5)' },
  inputBtns: { flexDirection: 'row', gap: 8 },
  inputBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#353534', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  inputBtnText: { color: '#e5e2e1', fontSize: 11, fontWeight: '600' },
  charCount: { color: '#bbcbbb', fontSize: 10, fontWeight: '700', letterSpacing: 1 },

  sectionLabel: { fontSize: 10, fontWeight: '700', color: '#bbcbbb', letterSpacing: 2, marginTop: 4 },

  voiceBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#201f1f', borderRadius: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)', padding: 14 },
  voiceLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  voiceAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(51,152,219,0.15)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(51,152,219,0.3)' },
  voiceName: { fontSize: 18, fontWeight: '600', color: '#e5e2e1' },
  voiceMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  voiceType: { fontSize: 11, color: '#bbcbbb' },
  premiumBadge: { backgroundColor: 'rgba(46,204,113,0.1)', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  premiumText: { color: '#2ecc71', fontSize: 9, fontWeight: '700' },

  customCard: { backgroundColor: '#201f1f', borderRadius: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)', padding: 16, gap: 16 },
  sliderRow: { gap: 4 },
  sliderLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sliderLabel: { fontSize: 12, fontWeight: '600', color: '#e5e2e1' },
  sliderValue: { fontSize: 11, fontWeight: '700', color: '#2ecc71', letterSpacing: 1 },
  slider: { width: '100%', height: 32, marginTop: -4 },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: '#353534', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  chipActive: { backgroundColor: 'rgba(46,204,113,0.15)', borderColor: 'rgba(46,204,113,0.3)' },
  chipText: { color: '#bbcbbb', fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: '#2ecc71' },

  advancedCard: { backgroundColor: '#201f1f', borderRadius: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14 },
  toggleLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  toggleLabel: { fontSize: 14, color: '#e5e2e1' },

  bottomBar: { paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)', backgroundColor: '#131313' },
  generateBtn: { backgroundColor: '#2ecc71', borderRadius: 16, height: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, shadowColor: '#2ecc71', shadowOpacity: 0.3, shadowRadius: 20 },
  generateBtnDisabled: { backgroundColor: '#1c1b1b' },
  generateBtnText: { color: '#003919', fontWeight: '800', fontSize: 16, letterSpacing: 2 },
});
