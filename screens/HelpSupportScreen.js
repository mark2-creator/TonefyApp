import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar, ScrollView, Linking,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';

const SUPPORT_EMAIL = 'ahumuzamark21213@gmail.com';

const FAQS = [
  {
    q: 'Why is my export stuck or shows 0%?',
    a: 'Exporting needs you to be signed in. If a render seems stuck, try logging out and back in, then export again.',
  },
  {
    q: 'Why don’t I see captions in my exported video?',
    a: 'Auto captions need a voiceover track on the timeline first - captions are generated from its audio. Manual text overlays don’t need one.',
  },
  {
    q: 'A video in My Videos won’t play.',
    a: 'This usually means the video file was moved or deleted from your device, or the upload never finished. Try re-generating or re-uploading it.',
  },
  {
    q: 'How do I change a caption’s style, font or colour?',
    a: 'Tap the caption on the canvas to select it, then use the style, font and colour tools in the toolbar that appears at the bottom.',
  },
  {
    q: 'How do I connect TikTok?',
    a: 'Go to Profile → Connected Accounts → Connect TikTok. Facebook and Instagram are still in development.',
  },
  {
    q: 'Can I use Tonefy AI without an internet connection?',
    a: 'No - video generation, transcription and rendering all happen on our servers, so an internet connection is required.',
  },
];

export default function HelpSupportScreen({ navigation }) {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [openIndex, setOpenIndex] = useState(null);

  function reportIssue() {
    const subject = encodeURIComponent('Tonefy AI - Support Request');
    const body = encodeURIComponent('Describe what happened:\n\n\n\nWhat you expected instead:\n\n');
    Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`).catch(() => {});
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.bg, paddingTop: insets.top }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.bg} />
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backRow}>
          <MaterialIcons name="arrow-back" size={20} color={theme.icon} />
          <Text style={[styles.backText, { color: theme.accent }]}>Back</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Help & Support</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.sectionHeader, { color: theme.subtext }]}>FREQUENTLY ASKED</Text>
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          {FAQS.map((f, i) => {
            const open = openIndex === i;
            return (
              <View key={f.q}>
                <TouchableOpacity
                  style={[styles.faqRow, i > 0 && { borderTopWidth: 1, borderTopColor: theme.border }]}
                  onPress={() => setOpenIndex(open ? null : i)}
                >
                  <Text style={[styles.faqQ, { color: theme.text }]}>{f.q}</Text>
                  <MaterialIcons name={open ? 'expand-less' : 'expand-more'} size={22} color={theme.icon} />
                </TouchableOpacity>
                {open && <Text style={[styles.faqA, { color: theme.subtext }]}>{f.a}</Text>}
              </View>
            );
          })}
        </View>

        <Text style={[styles.sectionHeader, { color: theme.subtext, marginTop: 24 }]}>STILL NEED HELP</Text>
        <TouchableOpacity style={[styles.card, styles.contactCard, { backgroundColor: theme.card, borderColor: theme.border }]} onPress={reportIssue}>
          <View style={styles.rowLeft}>
            <MaterialIcons name="mail-outline" size={22} color={theme.accent} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowLabel, { color: theme.text }]}>Report an Issue</Text>
              <Text style={[styles.rowDesc, { color: theme.subtext }]}>Opens your email app with a support message ready to send</Text>
            </View>
          </View>
          <MaterialIcons name="chevron-right" size={22} color={theme.icon} />
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1 },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 4, width: 70 },
  backText: { fontSize: 15, fontWeight: '600' },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  content: { padding: 16, paddingBottom: 48 },
  sectionHeader: { fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 8 },
  card: { borderWidth: 1, borderRadius: 14, overflow: 'hidden' },
  faqRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: 14 },
  faqQ: { flex: 1, fontSize: 14, fontWeight: '600' },
  faqA: { fontSize: 13, lineHeight: 19, paddingHorizontal: 14, paddingBottom: 14 },
  contactCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14 },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  rowLabel: { fontSize: 15, fontWeight: '600' },
  rowDesc: { fontSize: 12, marginTop: 3, lineHeight: 17 },
});
