import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Image,
  StyleSheet, StatusBar
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { auth } from '../firebase';

const STATUSBAR_HEIGHT = StatusBar.currentHeight || 0;

const sections = [
  {
    title: 'Video',
    icon: 'movie',
    color: '#2ecc71',
    cards: [
      { title: 'Record to Video', desc: 'Turn recordings into polished videos with subtitles.', icon: 'fiber-manual-record', color: '#ff6b6b' },
      { title: 'Auto Edit Video', desc: 'Add subtitles and B-rolls to your existing video recordings.', icon: 'auto-fix-high', color: '#58e5c2' },
      { title: 'Idea to Video', desc: 'Transform your ideas into stunning videos.', icon: 'auto-awesome', color: '#2ecc71' },
      { title: 'Script to Video', desc: 'Transform your scripts into engaging videos.', icon: 'description', color: '#92ccff' },
      { title: 'Empty Video', desc: 'Start creating video from a blank file.', icon: 'add-box', color: '#555' },
    ],
  },
  {
    title: 'Audio',
    icon: 'headphones',
    color: '#92ccff',
    cards: [
      { title: 'Empty Audio', desc: 'Start creating audio from a blank file.', icon: 'add-box', color: '#555' },
      { title: 'Idea to Audio', desc: 'Transform your ideas into stunning audio.', icon: 'auto-awesome', color: '#2ecc71' },
      { title: 'Script to Audio', desc: 'Transform your scripts into engaging voiceover.', icon: 'description', color: '#58e5c2' },
    ],
  },
  {
    title: 'Design',
    icon: 'palette',
    color: '#58e5c2',
    cards: [
      { title: 'Thumbnail', desc: 'Create stunning thumbnails for your videos.', icon: 'image', color: '#2ecc71' },
      { title: 'Social', desc: 'Create engaging social posts.', icon: 'people', color: '#92ccff' },
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
    else if (title === 'Script to Video') navigation.navigate('ScriptToVideo');
    else if (title === 'Auto Edit Video') navigation.navigate('EditVideo');
    else if (title === 'Idea to Audio') navigation.navigate('IdeaToAudio');
    else if (title === 'Script to Audio') navigation.navigate('ScriptToAudio');
    else if (title === 'Record to Video') navigation.navigate('RecordToVideo');
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a0a" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logo}>Tonefy AI</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.iconBtn}>
            <MaterialIcons name="settings" size={22} color="#888" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Profile')} style={styles.avatar}>
            {user?.photoURL ? (
              <Image source={{ uri: user.photoURL }} style={styles.avatarImg} />
            ) : (
              <Text style={styles.avatarText}>{initial}</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Greeting */}
        <View style={styles.greeting}>
          <Text style={styles.welcome}>Welcome, {firstName}! 👋</Text>
          <Text style={styles.subtitle}>Choose a workflow to get started</Text>
        </View>

        {/* Sections */}
        {sections.map((section, i) => (
          <View key={i} style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialIcons name={section.icon} size={16} color={section.color} />
              <Text style={styles.sectionTitle}>{section.title}</Text>
            </View>
            <View style={styles.grid}>
              {section.cards.map((card, j) => (
                <TouchableOpacity
                  key={j}
                  style={styles.card}
                  onPress={() => handleCardPress(card.title)}
                  activeOpacity={0.75}
                >
                  <View style={[styles.cardIconWrap, { backgroundColor: card.color + '18' }]}>
                    <MaterialIcons name={card.icon} size={22} color={card.color} />
                  </View>
                  <Text style={styles.cardTitle}>{card.title}</Text>
                  <Text style={styles.cardDesc}>{card.desc}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        {/* Featured banner */}
        <View style={styles.banner}>
          <View style={styles.bannerContent}>
            <Text style={styles.bannerTag}>FEATURED TOOL</Text>
            <Text style={styles.bannerTitle}>AI Avatar{'\n'}Generation</Text>
            <TouchableOpacity style={styles.bannerBtn}>
              <Text style={styles.bannerBtnText}>Explore Beta</Text>
            </TouchableOpacity>
          </View>
          <MaterialIcons name="smart-toy" size={80} color="#2ecc71" style={{ opacity: 0.15, position: 'absolute', right: 16, bottom: 16 }} />
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', paddingTop: STATUSBAR_HEIGHT },

  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1a1a1a' },
  logo: { color: '#2ecc71', fontSize: 20, fontWeight: '800', letterSpacing: 0.5 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBtn: { padding: 4 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2ecc7133', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  avatarImg: { width: 36, height: 36 },
  avatarText: { color: '#2ecc71', fontWeight: '800', fontSize: 16 },

  // Scroll
  scroll: { flex: 1 },
  greeting: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8 },
  welcome: { color: '#fff', fontSize: 22, fontWeight: '700' },
  subtitle: { color: '#666', fontSize: 13, marginTop: 4 },

  // Section
  section: { paddingHorizontal: 16, marginTop: 24 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionTitle: { color: '#fff', fontSize: 15, fontWeight: '700' },

  // Grid
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: { backgroundColor: '#141414', borderRadius: 14, padding: 14, width: '47%', borderWidth: 1, borderColor: '#1e1e1e' },
  cardIconWrap: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  cardTitle: { color: '#e5e2e1', fontWeight: '700', fontSize: 13, marginBottom: 4 },
  cardDesc: { color: '#555', fontSize: 11, lineHeight: 15 },

  // Banner
  banner: { marginHorizontal: 16, marginTop: 28, borderRadius: 16, backgroundColor: '#141414', borderWidth: 1, borderColor: '#1e1e1e', padding: 20, overflow: 'hidden', minHeight: 140 },
  bannerContent: { zIndex: 1 },
  bannerTag: { color: '#2ecc71', fontSize: 10, fontWeight: '700', letterSpacing: 1.5, marginBottom: 8 },
  bannerTitle: { color: '#fff', fontSize: 22, fontWeight: '700', lineHeight: 28 },
  bannerBtn: { marginTop: 14, backgroundColor: '#2ecc71', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, alignSelf: 'flex-start' },
  bannerBtnText: { color: '#000', fontWeight: '700', fontSize: 12 },

  // Bottom nav

  navItem: { alignItems: 'center', gap: 3 },
  navLabel: { color: '#555', fontSize: 10, fontWeight: '600' },
  navFab: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#2ecc71', alignItems: 'center', justifyContent: 'center', marginBottom: 8, shadowColor: '#2ecc71', shadowOpacity: 0.4, shadowRadius: 12, elevation: 8 },
});
