import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView
} from 'react-native';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';

const sections = [
  {
    title: '🎬 Video',
    cards: [
      { title: 'Idea to Video', desc: 'Transform ideas into stunning videos', icon: '✨', color: '#7c3aed' },
      { title: 'Script to Video', desc: 'Turn your scripts into engaging videos', icon: '📄', color: '#2563eb' },
      { title: 'URL to Video', desc: 'Convert web pages into videos', icon: '🔗', color: '#0d9488' },
      { title: 'PPT to Video', desc: 'Transform presentations into videos', icon: '📊', color: '#ea580c' },
      { title: 'Edit Video', desc: 'Add subtitles and B-rolls', icon: '✂️', color: '#dc2626' },
      { title: 'Record', desc: 'Turn recordings into polished videos', icon: '🎙️', color: '#16a34a' },
    ],
  },
  {
    title: '🎵 Audio',
    cards: [
      { title: 'Idea to Audio', desc: 'Transform ideas into audio', icon: '✨', color: '#7c3aed' },
      { title: 'Script to Audio', desc: 'Turn scripts into audio', icon: '📄', color: '#2563eb' },
      { title: 'Voiceover', desc: 'Create AI voiceovers', icon: '🔊', color: '#0ea5e9' },
      { title: 'Podcast', desc: 'Turn text into podcast episodes', icon: '🎙️', color: '#ca8a04' },
      { title: 'Music', desc: 'Generate background music', icon: '🎵', color: '#ec4899' },
    ],
  },
  {
    title: '🎨 Design',
    cards: [
      { title: 'Thumbnail', desc: 'Create stunning thumbnails', icon: '🖼️', color: '#7c3aed' },
      { title: 'Social Post', desc: 'Create engaging social posts', icon: '👥', color: '#2563eb' },
      { title: 'Presentation', desc: 'Create engaging presentations', icon: '📊', color: '#ea580c' },
    ],
  },
];

export default function DashboardScreen({ navigation }) {
  const handleLogout = async () => {
    await signOut(auth);
    navigation.replace('Auth');
  };

  const handleCardPress = (title) => {
    if (title === 'Idea to Video') {
      navigation.navigate('IdeaToVideo');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logo}>Tonefy AI</Text>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.welcome}>Welcome! 👋</Text>
        <Text style={styles.subtitle}>Choose a workflow to get started</Text>

        {sections.map((section, i) => (
          <View key={i} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.grid}>
              {section.cards.map((card, j) => (
                <TouchableOpacity
                  key={j}
                  style={styles.card}
                  onPress={() => handleCardPress(card.title)}
                >
                  <Text style={styles.cardIcon}>{card.icon}</Text>
                  <Text style={styles.cardTitle}>{card.title}</Text>
                  <Text style={styles.cardDesc}>{card.desc}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#1a1a1a' },
  logo: { color: '#2ecc71', fontSize: 20, fontWeight: 'bold' },
  logoutBtn: { borderWidth: 1, borderColor: '#444', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 6 },
  logoutText: { color: '#aaa', fontSize: 13 },
  scroll: { flex: 1, padding: 16 },
  welcome: { color: '#fff', fontSize: 24, fontWeight: 'bold', marginTop: 8 },
  subtitle: { color: '#888', fontSize: 14, marginTop: 4, marginBottom: 24 },
  section: { marginBottom: 28 },
  sectionTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: { backgroundColor: '#1a1a1a', borderRadius: 12, padding: 14, width: '47%', borderWidth: 1, borderColor: '#2a2a2a' },
  cardIcon: { fontSize: 28, marginBottom: 8 },
  cardTitle: { color: '#fff', fontWeight: 'bold', fontSize: 13, marginBottom: 4 },
  cardDesc: { color: '#666', fontSize: 11, lineHeight: 15 },
});
