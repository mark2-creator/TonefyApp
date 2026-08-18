import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, StatusBar
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { VOICES } from '../constants/voices';
import VoicePicker from '../components/VoicePicker';
import VoiceAvatar from '../components/VoiceAvatar';
import Flag from '../components/Flag';
import { usePlan } from '../constants/plan';
import { showAlert } from '../components/BrandedAlert';

// Seconds, not labels. The label is what a person reads; the number is what the
// script writer is actually told to hit, and keeping both in one place is what stops
// a chip saying 5m while the request asks for something else.
const DURATIONS = [
  { label: '30s', seconds: 30 },
  { label: '1m', seconds: 60 },
  { label: '2m', seconds: 120 },
  { label: '5m', seconds: 300 },
];
const STYLES = ['Motivational', 'Podcast', 'Storytelling', 'Educational', 'Casual'];

export default function IdeaToAudioScreen({ navigation }) {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { caps } = usePlan();
  const [idea, setIdea] = useState('');
  const [seconds, setSeconds] = useState(60);
  const [tags, setTags] = useState(['Motivational']);
  const [voiceId, setVoiceId] = useState('gtts-us');
  const [showVoices, setShowVoices] = useState(false);

  const voice = VOICES.find(v => v.id === voiceId) || VOICES[0];
  // Length is capped by the same plan limit the rest of the app already uses, so a
  // locked chip needs no policy of its own and no second number to keep in step.
  const maxSeconds = caps?.maxExportSeconds || 120;

  function toggleTag(tag) {
    setTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  }

  function pickDuration(d) {
    if (d.seconds > maxSeconds) {
      showAlert(
        `${d.label} audio`,
        `Your plan can generate up to ${Math.round(maxSeconds / 60)} minutes at a time. Pro and Creator go longer.`,
      );
      return;
    }
    setSeconds(d.seconds);
  }

  function generate() {
    if (!idea.trim()) return;
    // The style tags are folded into the prompt rather than sent as a field: the
    // script endpoint takes a prompt and nothing else, and inventing a parameter it
    // would ignore is how a control ends up looking live while doing nothing.
    const styled = tags.length
      ? `${idea.trim()}\n\nTone and style: ${tags.join(', ')}.`
      : idea.trim();
    navigation.navigate('GeneratingAudio', {
      mode: 'idea',
      prompt: styled,
      title: idea.trim(),
      seconds,
      voiceId,
    });
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.bg, paddingTop: insets.top }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.bg} />

      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <Text style={styles.logo}>Tonefy AI</Text>
        <MaterialIcons name="settings" size={22} color={theme.icon} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Title */}
        <View style={styles.titleRow}>
          <MaterialIcons name="auto-awesome" size={22} color="#54e98a" />
          <Text style={[styles.title, { color: theme.text }]}>Idea to Audio</Text>
        </View>

        {/* Idea Input */}
        <Text style={[styles.label, { color: theme.subtext }]}>Describe your idea...</Text>
        <View style={[styles.inputBox, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <TextInput
            style={[styles.input, { color: theme.text }]}
            placeholder="A motivational talk about overcoming failure for young entrepreneurs"
            placeholderTextColor={theme.subtext}
            multiline
            value={idea}
            onChangeText={setIdea}
          />
          <MaterialIcons name="edit-note" size={22} color={theme.border} style={styles.inputIcon} />
        </View>

        {/* Voice */}
        <Text style={[styles.label, { color: theme.subtext }]}>Voice</Text>
        <TouchableOpacity
          style={[styles.voiceBtn, { backgroundColor: theme.card, borderColor: theme.border }]}
          onPress={() => setShowVoices(true)}
        >
          <View style={styles.voiceLeft}>
            <VoiceAvatar voice={voice} size={36} />
            <View>
              <Text style={[styles.voiceText, { color: theme.text }]}>{voice.label}</Text>
              <View style={styles.voiceMeta}>
                <Flag country={voice.country} size={12} />
                <Text style={[styles.voiceSub, { color: theme.subtext }]}>
                  {voice.langName} · {voice.gender}
                </Text>
              </View>
            </View>
          </View>
          <MaterialIcons name="expand-more" size={22} color={theme.icon} />
        </TouchableOpacity>

        {/* Duration */}
        <Text style={[styles.label, { color: theme.subtext }]}>Duration</Text>
        <View style={styles.chips}>
          {DURATIONS.map(d => {
            const locked = d.seconds > maxSeconds;
            const active = seconds === d.seconds;
            return (
              <TouchableOpacity
                key={d.label}
                style={[styles.chip, { backgroundColor: theme.card, borderColor: theme.border }, active && styles.chipActive, locked && styles.chipLocked]}
                onPress={() => pickDuration(d)}
              >
                {locked && <MaterialIcons name="lock" size={11} color="#5a5a5a" />}
                <Text style={[styles.chipText, { color: theme.subtext }, active && styles.chipTextActive, locked && styles.chipTextLocked]}>{d.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Style Tags */}
        <Text style={[styles.label, { color: theme.subtext }]}>Style Tags</Text>
        <View style={styles.chips}>
          {STYLES.map(tag => (
            <TouchableOpacity
              key={tag}
              style={[styles.chip, { backgroundColor: theme.card, borderColor: theme.border }, tags.includes(tag) && styles.chipActive]}
              onPress={() => toggleTag(tag)}
            >
              {tags.includes(tag) && <MaterialIcons name="check" size={12} color="#54e98a" />}
              <Text style={[styles.chipText, { color: theme.subtext }, tags.includes(tag) && styles.chipTextActive]}>{tag}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Generate Button */}
      <View style={[styles.bottomBar, { borderTopColor: theme.border, backgroundColor: theme.bg, paddingBottom: insets.bottom || 16 }]}>
        <TouchableOpacity
          style={[styles.generateBtn, !idea.trim() && { backgroundColor: theme.card }]}
          onPress={generate}
          disabled={!idea.trim()}
        >
          <MaterialIcons name="auto-fix-high" size={20} color="#003919" />
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
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  logo: { fontSize: 20, fontWeight: '800', color: '#54e98a' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20 },
  title: { fontSize: 22, fontWeight: '700' },
  label: { fontSize: 11, fontWeight: '600', letterSpacing: 1, marginBottom: 6, marginLeft: 2 },
  inputBox: { borderRadius: 12, borderWidth: 1, marginBottom: 20, position: 'relative' },
  input: { fontSize: 14, padding: 16, height: 160, textAlignVertical: 'top' },
  inputIcon: { position: 'absolute', bottom: 12, right: 12 },
  voiceBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 20 },
  voiceLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  voiceIcon: { width: 36, height: 36, borderRadius: 8, backgroundColor: 'rgba(51,152,219,0.15)', alignItems: 'center', justifyContent: 'center' },
  voiceText: { fontSize: 14, fontWeight: '600' },
  voiceMeta: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  voiceSub: { fontSize: 11 },
  chipLocked: { opacity: 0.55 },
  chipTextLocked: { color: '#5a5a5a' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 4 },
  chipActive: { backgroundColor: 'rgba(46,204,113,0.1)', borderColor: '#2ecc71' },
  chipText: { fontSize: 11, fontWeight: '600' },
  chipTextActive: { color: '#54e98a' },
  bottomBar: { paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1 },
  generateBtn: { backgroundColor: '#54e98a', borderRadius: 12, height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, shadowColor: '#2ecc71', shadowOpacity: 0.3, shadowRadius: 20 },
  generateBtnText: { color: '#003919', fontWeight: '700', fontSize: 12, letterSpacing: 2 },
});
