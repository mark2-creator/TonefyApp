import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, StatusBar
} from 'react-native';
import Slider from '@react-native-community/slider';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { showAlert } from '../components/BrandedAlert';
import * as Clipboard from 'expo-clipboard';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { VOICES } from '../constants/voices';
import VoicePicker from '../components/VoicePicker';
import VoiceAvatar from '../components/VoiceAvatar';
import Flag from '../components/Flag';

const INFLECTIONS = ['Soft', 'Natural', 'Intense', 'Dramatic'];

export default function ScriptToAudioScreen({ navigation, route }) {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  // Prefilled when arriving from Edit Script on the result screen, so a reworded
  // line keeps the voice it was written for instead of resetting to the default.
  const [script, setScript] = useState(route?.params?.script || '');

  // Paste and Upload were drawn and wired to nothing. Both are ordinary: the clipboard
  // is one call, and a script is a text file.
  async function pasteScript() {
    try {
      const text = await Clipboard.getStringAsync();
      if (!text?.trim()) { showAlert('Paste', 'There is no text on your clipboard.'); return; }
      // Appended rather than replacing, so a paste cannot silently discard what is
      // already typed.
      setScript(prev => (prev ? `${prev.trimEnd()}\n${text.trim()}` : text.trim()));
    } catch (e) {
      showAlert('Paste', e?.message || 'Could not read the clipboard.');
    }
  }

  async function uploadScript() {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
      if (res.canceled || !res.assets?.[0]) return;
      const text = new File(res.assets[0].uri).textSync();
      if (!text?.trim()) { showAlert('Upload', 'That file has no text in it.'); return; }
      // A script long enough to be a book is a paste accident, not a voiceover.
      setScript(text.trim().slice(0, 20000));
    } catch (e) {
      showAlert('Upload', 'Could not read that file. A plain .txt works best.');
    }
  }
  const [pace, setPace] = useState(1.0);
  const [pitch, setPitch] = useState(0);
  const [voiceId, setVoiceId] = useState(route?.params?.voiceId || 'gtts-us');
  const [showVoices, setShowVoices] = useState(false);

  const voice = VOICES.find(v => v.id === voiceId) || VOICES[0];

  function generate() {
    if (!script.trim()) return;
    // mode 'script': the text IS the script, so there is nothing to write first and
    // the generating screen skips straight to synthesis.
    navigation.navigate('GeneratingAudio', {
      mode: 'script',
      script: script.trim(),
      title: script.trim().slice(0, 60),
      voiceId,
      rate: pace,
      pitch,
    });
  }

  const pitchLabel = pitch === 0 ? 'Default' : pitch > 0 ? `+${pitch}` : `${pitch}`;

  return (
    <View style={[styles.container, { backgroundColor: theme.bg, paddingTop: insets.top }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.bg} />

      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <MaterialIcons name="arrow-back-ios" size={20} color={theme.icon} />
          </TouchableOpacity>
          <Text style={styles.logo}>Tonefy AI</Text>
        </View>
        <View style={styles.headerRight}>
          <MaterialIcons name="settings" size={22} color={theme.icon} />
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* Title */}
        <View style={styles.titleRow}>
          <View style={styles.titleIcon}>
            <MaterialIcons name="description" size={26} color="#2ecc71" />
          </View>
          <View>
            <Text style={[styles.title, { color: theme.text }]}>Script to Audio</Text>
            <Text style={[styles.titleSub, { color: theme.subtext }]}>Transform your text into professional voiceovers</Text>
          </View>
        </View>

        {/* Script Input */}
        <View style={[styles.inputBox, { backgroundColor: theme.card, borderTopColor: theme.border }]}>
          <TextInput
            style={[styles.input, { color: theme.text }]}
            placeholder="Paste or write your script here..."
            placeholderTextColor={theme.subtext}
            multiline
            value={script}
            onChangeText={setScript}
          />
          <View style={[styles.inputToolbar, { borderTopColor: theme.border, backgroundColor: isDark ? 'rgba(14,14,14,0.5)' : 'rgba(0,0,0,0.03)' }]}>
            <View style={styles.inputBtns}>
              <TouchableOpacity onPress={pasteScript} style={[styles.inputBtn, { backgroundColor: theme.divider }]}>
                <MaterialIcons name="content-paste" size={16} color={theme.text} />
                <Text style={[styles.inputBtnText, { color: theme.text }]}>Paste</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={uploadScript} style={[styles.inputBtn, { backgroundColor: theme.divider }]}>
                <MaterialIcons name="upload-file" size={16} color={theme.text} />
                <Text style={[styles.inputBtnText, { color: theme.text }]}>Upload</Text>
              </TouchableOpacity>
            </View>
            <Text style={[styles.charCount, { color: theme.subtext }]}>{script.length} / 5000 chars</Text>
          </View>
        </View>

        {/* Voice Selection */}
        <Text style={[styles.sectionLabel, { color: theme.subtext }]}>VOICE SELECTION</Text>
        <TouchableOpacity
          style={[styles.voiceBtn, { backgroundColor: theme.card, borderTopColor: theme.border }]}
          onPress={() => setShowVoices(true)}
        >
          <View style={styles.voiceLeft}>
            <VoiceAvatar voice={voice} size={48} />
            <View>
              <Text style={[styles.voiceName, { color: theme.text }]}>{voice.label}</Text>
              <View style={styles.voiceMeta}>
                <Flag country={voice.country} size={12} />
                <Text style={[styles.voiceType, { color: theme.subtext }]}>
                  {voice.langName} · {voice.gender}
                </Text>
                {!voice.free && (
                  <View style={styles.premiumBadge}>
                    <Text style={styles.premiumText}>PREMIUM</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
          <MaterialIcons name="chevron-right" size={22} color={theme.icon} />
        </TouchableOpacity>

        {/* Audio Customization */}
        <Text style={[styles.sectionLabel, { color: theme.subtext }]}>AUDIO CUSTOMIZATION</Text>
        <View style={[styles.customCard, { backgroundColor: theme.card, borderTopColor: theme.border }]}>
          {/* Pace */}
          <View style={styles.sliderRow}>
            <View style={styles.sliderLabelRow}>
              <Text style={[styles.sliderLabel, { color: theme.text }]}>Pace</Text>
              <Text style={styles.sliderValue}>{pace.toFixed(1)}x</Text>
            </View>
            <Slider
              style={styles.slider}
              minimumValue={0.5}
              maximumValue={2.0}
              step={0.1}
              value={pace}
              minimumTrackTintColor="#2ecc71"
              maximumTrackTintColor={theme.border}
              thumbTintColor="#2ecc71"
              onValueChange={setPace}
            />
          </View>

          {/* Pitch */}
          <View style={styles.sliderRow}>
            <View style={styles.sliderLabelRow}>
              <Text style={[styles.sliderLabel, { color: theme.text }]}>Pitch</Text>
              <Text style={styles.sliderValue}>{pitchLabel}</Text>
            </View>
            <Slider
              style={styles.slider}
              minimumValue={-5}
              maximumValue={5}
              step={1}
              value={pitch}
              minimumTrackTintColor="#2ecc71"
              maximumTrackTintColor={theme.border}
              thumbTintColor="#2ecc71"
              onValueChange={v => setPitch(Math.round(v))}
            />
          </View>

          {/* Inflection */}
          {/* Dimmed and inert on purpose. Pace and pitch above are real - they go
              through rubberband on the server - but neither TTS engine here exposes
              emotion, so a live-looking chip that changed nothing would be the worst
              of the three states. Kept rather than deleted, the same way the editor's
              unbuilt tools are: this is a roadmap, not a defect. */}
          <View style={styles.soonHeader}>
            <Text style={[styles.sliderLabel, { color: '#5a5a5a' }]}>Emotional Inflection</Text>
            <Text style={styles.soonTag}>COMING SOON</Text>
          </View>
          <View style={styles.chips}>
            {INFLECTIONS.map(inf => (
              <TouchableOpacity
                key={inf}
                style={[styles.chip, { backgroundColor: theme.divider, borderColor: theme.border }, styles.chipDim]}
                onPress={() => showAlert('Emotional Inflection', 'Coming soon. For now, Pace and Pitch above shape the delivery.')}
              >
                <Text style={[styles.chipText, { color: '#5a5a5a' }]}>{inf}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Advanced Options */}
        <Text style={[styles.sectionLabel, { color: theme.subtext }]}>ADVANCED OPTIONS</Text>
        <View style={[styles.advancedCard, { backgroundColor: theme.card, borderTopColor: theme.border }]}>
          <TouchableOpacity
            style={styles.toggleRow}
            onPress={() => showAlert('Background Music', 'Coming soon. You can add a music track to this voiceover in the editor today — tap Add to Video on the result screen.')}
          >
            <View style={styles.toggleLeft}>
              <MaterialIcons name="music-note" size={20} color="#5a5a5a" />
              <Text style={[styles.toggleLabel, { color: '#5a5a5a' }]}>Background Music</Text>
            </View>
            <Text style={styles.soonTag}>COMING SOON</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleRow, { borderTopWidth: 1, borderTopColor: theme.border }]}
            onPress={() => showAlert('Auto-Breaths', 'Coming soon.')}
          >
            <View style={styles.toggleLeft}>
              <MaterialIcons name="air" size={20} color="#5a5a5a" />
              <Text style={[styles.toggleLabel, { color: '#5a5a5a' }]}>Auto-Breaths</Text>
            </View>
            <Text style={styles.soonTag}>COMING SOON</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Generate Button */}
      <View style={[styles.bottomBar, { borderTopColor: theme.border, backgroundColor: theme.bg, paddingBottom: insets.bottom || 16 }]}>
        <TouchableOpacity
          style={[styles.generateBtn, !script.trim() && { backgroundColor: theme.card }]}
          onPress={generate}
          disabled={!script.trim()}
        >
          <MaterialIcons name="auto-awesome" size={22} color="#003919" />
          <Text style={styles.generateBtnText}>GENERATE AUDIO</Text>
        </TouchableOpacity>
      </View>
    <VoicePicker
        visible={showVoices}
        selectedId={voiceId}
        onSelect={setVoiceId}
        onClose={() => setShowVoices(false)}
      />
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

  soonHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  soonTag: { color: '#5a5a5a', fontSize: 9, fontWeight: '700', letterSpacing: 1 },
  chipDim: { opacity: 0.6 },
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
