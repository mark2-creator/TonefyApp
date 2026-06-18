import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Image,
  StyleSheet, StatusBar
} from 'react-native';
import { auth } from '../firebase';

const STATUSBAR_HEIGHT = StatusBar.currentHeight || 0;

const sections = [
  {
    title: '🎬 Video',
    cards: [
      { title: 'Idea to Video', desc: 'Transform ideas into stunning videos', icon: '✨' },
      { title: 'Script to Video', desc: 'Turn your scripts into engaging videos', icon: '📄' },
      { title: 'URL to Video', desc: 'Convert web pages into videos', icon: '🔗' },
      { title: 'PPT to Video', desc: 'Transform presentations into videos', icon: '📊' },
      { title: 'Edit Video', desc: 'Add subtitles and B-rolls', icon: '✂️' },
      { title: 'My Videos', desc: 'Browse your video library', icon: '🎬' },
      { title: 'Record', desc: 'Turn recordings into polished videos', icon: '🎙️' },
    ],
  },
  {
    title: '🎵 Audio',
    cards: [
      { title: 'Idea to Audio', desc: 'Transform ideas into audio', icon: '✨' },
      { title: 'Script to Audio', desc: 'Turn scripts into audio', icon: '📄' },
      { title: 'Voiceover', desc: 'Create AI voiceovers', icon: '🔊' },
      { title: 'Podcast', desc: 'Turn text into podcast episodes', icon: '🎧' },
      { title: 'Music', desc: 'Generate background music', icon: '🎵' },
    ],
  },
  {
    title: '🎨 Design',
    cards: [
      { title: 'Thumbnail', desc: 'Create stunning thumbnails', icon: '🖼️' },
      { title: 'Social Post', desc: 'Create engaging social posts', icon: '👥' },
      { title: 'Presentation', desc: 'Create engaging presentations', icon: '📊' },
    ],
  },
];

export default function DashboardScreen({ navigation }) {
  const user = auth.currentUser;
  const firstName =
    user?.displayName?.split(' ')[0] ||
    user?.email?.split('@')[0] ||
    'Creator';
  const initial = (user?.displayName || user?.email || '?')[0].toUpperCase();

  const handleCardPress = (title) => {
    if (title === 'Idea to Video') navigation.navigate('IdeaToVideo');
    else if (title === 'My Videos') navigation.navigate('MyVideos');
    // Other workflows aren't built yet — no-op for now
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a0a" />
      <View style={styles.header}>
        <Text style={styles.logo}>Tonefy AI</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Profile')} style={styles.avatar}>
          {user?.photoURL ? (
            <Image source={{ uri: user.photoURL }} style={styles.avatarImg} />
          ) : (
            <Text style={styles.avatarText}>{initial}</Text>
          )}
        </TouchableOpacity>
      </View>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.welcome}>Welcome, {firstName}! 👋</Text>
        <Text style={styles.subtitle}>Choose a workflow to get started</Text>
        {sections.map((section, i) => (
          <View key={i} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.grid}>
              {section.cards.map((card, j) => (
                <TouchableOpacity key={j} style={styles.card} onPress={() => handleCardPress(card.title)}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', paddingTop: STATUSBAR_HEIGHT },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#1a1a1a' },
  logo: { color: '#2ecc71', fontSize: 20, fontWeight: 'bold' },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2a2a2a', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  avatarImg: { width: 36, height: 36 },
  avatarText: { color: '#2ecc71', fontWeight: '800', fontSize: 16 },
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
