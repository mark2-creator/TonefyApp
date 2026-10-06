import React, { useEffect, useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import GradientBorder from '../components/GradientBorder';
import {
  View, Text, ScrollView, TouchableOpacity, Image,
  StyleSheet, StatusBar, Modal, Switch
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { auth } from '../firebase';
import { onIdTokenChanged } from 'firebase/auth';
import SheetHeader, { useSheetInset } from '../components/SheetHeader';
import { showAlert } from '../components/BrandedAlert';
import { askForReminders } from '../utils/notifications';
import { hasMadeVideo, onMadeVideo } from '../utils/firstVideo';
import { logStep } from '../utils/funnel';
import VerifyEmailBanner from '../components/VerifyEmailBanner';

// Ideas a new user can tap instead of facing an empty box. Short, concrete, and the
// kind of thing stock footage covers well, so the first video looks good.
const STARTER_IDEAS = [
  '3 easy ways to save money',
  'Why sleep matters for your health',
  'Fun facts about Lake Victoria',
];


const sections = [
  {
    title: 'Video',
    icon: 'movie',
    color: '#2ecc71',
    cards: [
      { title: 'Idea to Video', desc: 'Transform your ideas into stunning videos.', icon: 'auto-awesome', color: '#2ecc71' },
      { title: 'Script to Video', desc: 'Transform your scripts into engaging videos.', icon: 'description', color: '#92ccff' },
      { title: 'URL to Video', desc: 'Convert web pages into videos.', icon: 'link', color: '#92ccff' },
      { title: 'Edit Video', desc: 'Edit and combine your media into one video.', icon: 'content-cut', color: '#58e5c2' },
      { title: 'My Videos', desc: 'Browse your video library.', icon: 'video-library', color: '#2ecc71' },
      { title: 'Record to Video', desc: 'Turn recordings into polished videos.', icon: 'fiber-manual-record', color: '#ff6b6b' },
    ],
  },
  {
    title: 'Audio',
    icon: 'headphones',
    color: '#92ccff',
    cards: [
      { title: 'Empty Audio', desc: 'Write your own script and voice it.', icon: 'add-box', color: '#92ccff' },
      { title: 'Idea to Audio', desc: 'Transform your ideas into stunning audio.', icon: 'auto-awesome', color: '#2ecc71' },
      { title: 'Script to Audio', desc: 'Transform your scripts into engaging voiceover.', icon: 'description', color: '#58e5c2' },
    ],
  },
  {
    title: 'Design',
    icon: 'palette',
    color: '#58e5c2',
    cards: [
      // No route exists for either of these yet. `soon` is what dims them and
      // routes the tap to the "coming soon" alert, so wiring one up is a matter
      // of adding its branch to handleCardPress and deleting this flag - the
      // card cannot end up live-looking and inert again by accident.
      { title: 'Thumbnail', desc: 'Create stunning thumbnails for your videos.', icon: 'image', color: '#2ecc71' },
      { title: 'Social', desc: 'Post and schedule to your accounts.', icon: 'people', color: '#92ccff' },
    ],
  },
];

export default function DashboardScreen({ navigation }) {
  // Re-read the current user every time this tab regains focus. updateProfile (used by
  // the Profile screen to set a photo or name) mutates auth.currentUser IN PLACE, so it
  // neither fires onAuthStateChanged reliably nor changes the object's identity - reading
  // it once at mount left this avatar stale until a full restart. Bumping a tick on focus
  // forces a re-render that reads the freshly-mutated currentUser below.
  const [focusTick, setFocusTick] = useState(0);
  useEffect(() => navigation.addListener('focus', () => setFocusTick((t) => t + 1)), [navigation]);

  // Reminders for someone who has had the app a day and has not been asked yet - mostly
  // people who never finished a video, who are exactly who the reminders are for. Asked
  // once ever (askForReminders keeps track), never on the first day.
  useEffect(() => {
    const created = Date.parse(auth.currentUser?.metadata?.creationTime || '');
    if (!created || Date.now() - created < 24 * 60 * 60 * 1000) return;
    const t = setTimeout(() => { askForReminders(showAlert); }, 1500);
    return () => clearTimeout(t);
  }, [focusTick]);
  // The "Make your first video" card: shown only when we KNOW this account has not
  // finished a video (false), never on a guess (null - offline). Rechecked on each visit
  // and hidden the instant a render finishes anywhere in the app.
  const [needsFirstVideo, setNeedsFirstVideo] = useState(false);
  useEffect(() => {
    let live = true;
    hasMadeVideo(auth.currentUser?.uid).then((made) => { if (live) setNeedsFirstVideo(made === false); });
    return () => { live = false; };
  }, [focusTick]);
  useEffect(() => onMadeVideo(() => setNeedsFirstVideo(false)), []);
  useEffect(() => { logStep('dashboard'); }, []);

  // A new email account is signed in the instant it is created, and its name is written a
  // moment later (AuthScreen's updateProfile). Without this the dashboard greets a brand-new
  // person with the first half of their email address until something else re-renders it.
  const [, setNameTick] = useState(0);
  useEffect(() => onIdTokenChanged(auth, () => setNameTick((t) => t + 1)), []);

  const user = auth.currentUser;
  const firstName =
    user?.displayName?.split(' ')[0] ||
    user?.email?.split('@')[0] ||
    'Creator';
  const initial = (user?.displayName || user?.email || '?')[0].toUpperCase();

  const [showSettings, setShowSettings] = useState(false);
  const { theme, isDark, toggleTheme } = useTheme();
  const insets = useSafeAreaInsets();
  const sheetInset = useSheetInset();
  const darkMode = isDark;

  const handleCardPress = (card) => {
    const title = typeof card === 'string' ? card : card.title;
    if (typeof card === 'object' && card.soon) {
      return showAlert(title, 'This one is still being built. It will appear here as soon as it is ready.');
    }
    const step = { 'Idea to Video': 'open_idea', 'Script to Video': 'open_script', 'URL to Video': 'open_url',
      'Edit Video': 'open_edit', 'Record to Video': 'open_record' }[title];
    if (step) logStep(step);
    if (title === 'Idea to Video') navigation.navigate('IdeaToVideo');
    else if (title === 'Script to Video') navigation.navigate('ScriptToVideo');
    else if (title === 'URL to Video') navigation.navigate('UrlToVideo');
    else if (title === 'Edit Video') navigation.navigate('EditVideo');
    else if (title === 'My Videos') navigation.navigate('MainTabs', { screen: 'Videos' });
    else if (title === 'Idea to Audio') navigation.navigate('IdeaToAudio');
    else if (title === 'Script to Audio') navigation.navigate('ScriptToAudio');
    else if (title === 'Record to Video') navigation.navigate('RecordToVideo');
    // Script to Audio with nothing in the box IS the blank file this card describes.
    // It used to open Idea to Audio, which asks for an idea and writes the script for
    // you - the opposite of starting from blank, and a card whose description and
    // destination disagreed.
    else if (title === 'Empty Audio') navigation.navigate('ScriptToAudio', { script: '' });
    else if (title === 'Thumbnail') navigation.navigate('Thumbnail');
    else if (title === 'Social') navigation.navigate('Social');
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.bg, paddingTop: insets.top }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={theme.bg} />

      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.border, backgroundColor: theme.header }]}>
        <Text style={styles.logo}>Tonefy AI</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => setShowSettings(true)}>
            <MaterialIcons name="settings" size={22} color={theme.icon} />
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

      {/* Settings Modal */}
      <Modal visible={showSettings} transparent animationType="slide" onRequestClose={() => setShowSettings(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowSettings(false)}>
          <View style={[styles.modalSheet, { backgroundColor: theme.settingBg }, sheetInset]}>
            <View style={[styles.modalHandle, { backgroundColor: theme.handle }]} />
            <SheetHeader title="Settings" onClose={() => setShowSettings(false)}
              titleColor={theme.text} titleStyle={styles.sheetTitle} style={styles.sheetHeaderPad} />

            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <MaterialIcons name={darkMode ? 'dark-mode' : 'light-mode'} size={22} color="#2ecc71" />
                <View>
                  <Text style={[styles.settingLabel, { color: theme.text }]}>Dark Mode</Text>
                  <Text style={styles.settingDesc}>Switch between dark and light theme</Text>
                </View>
              </View>
              <Switch
                value={darkMode}
                onValueChange={toggleTheme}
                trackColor={{ false: '#333', true: '#2ecc7150' }}
                thumbColor={darkMode ? '#2ecc71' : '#888'}
              />
            </View>

            <View style={[styles.settingDivider, { backgroundColor: theme.divider }]} />

            <TouchableOpacity style={styles.settingRow} onPress={() => { setShowSettings(false); navigation.navigate('Profile'); }}>
              <View style={styles.settingLeft}>
                <MaterialIcons name="person" size={22} color="#2ecc71" />
                <View>
                  <Text style={[styles.settingLabel, { color: theme.text }]}>Profile</Text>
                  <Text style={styles.settingDesc}>Manage your account</Text>
                </View>
              </View>
              <MaterialIcons name="chevron-right" size={22} color="#555" />
            </TouchableOpacity>

            <View style={[styles.settingDivider, { backgroundColor: theme.divider }]} />

            <TouchableOpacity style={styles.settingRow} onPress={() => { setShowSettings(false); navigation.navigate('Notifications'); }}>
              <View style={styles.settingLeft}>
                <MaterialIcons name="notifications" size={22} color="#2ecc71" />
                <View>
                  <Text style={[styles.settingLabel, { color: theme.text }]}>Notifications</Text>
                  <Text style={styles.settingDesc}>Manage push notifications</Text>
                </View>
              </View>
              <MaterialIcons name="chevron-right" size={22} color="#555" />
            </TouchableOpacity>

            <View style={[styles.settingDivider, { backgroundColor: theme.divider }]} />

            <TouchableOpacity style={styles.settingRow} onPress={() => { setShowSettings(false); navigation.navigate('Privacy'); }}>
              <View style={styles.settingLeft}>
                <MaterialIcons name="lock" size={22} color="#2ecc71" />
                <View>
                  <Text style={[styles.settingLabel, { color: theme.text }]}>Privacy</Text>
                  <Text style={styles.settingDesc}>Diagnostics and your data</Text>
                </View>
              </View>
              <MaterialIcons name="chevron-right" size={22} color="#555" />
            </TouchableOpacity>

            <View style={[styles.settingDivider, { backgroundColor: theme.divider }]} />

            <TouchableOpacity style={styles.settingRow} onPress={() => { setShowSettings(false); navigation.navigate('HelpSupport'); }}>
              <View style={styles.settingLeft}>
                <MaterialIcons name="help" size={22} color="#2ecc71" />
                <View>
                  <Text style={[styles.settingLabel, { color: theme.text }]}>Help & Support</Text>
                  <Text style={styles.settingDesc}>Get help or report an issue</Text>
                </View>
              </View>
              <MaterialIcons name="chevron-right" size={22} color="#555" />
            </TouchableOpacity>

            <TouchableOpacity style={[styles.closeBtn, { backgroundColor: theme.divider }]} onPress={() => setShowSettings(false)}>
              <Text style={[styles.closeBtnText, { color: theme.subtext }]}>Close</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Greeting */}
        <View style={styles.greeting}>
          <Text style={[styles.welcome, { color: theme.text }]}>Welcome, {firstName}!</Text>
          <Text style={[styles.subtitle, { color: theme.subtext }]}>Choose a workflow to get started</Text>
        </View>

        {/* First video. Nine strangers installed after launch and none finished a video;
            the dashboard offered eleven equal cards and no first step. This is that first
            step: the quickest path (Idea to Video, about two minutes end to end, measured
            on the live server Oct 6 2026) with example ideas so nobody starts from an
            empty box. Gone once the account has a video. */}
        {needsFirstVideo && (
          <GradientBorder radius={14} backgroundColor={theme.card} style={styles.firstCard}>
            <Text style={[styles.firstTag, { color: theme.subtext }]}>START HERE</Text>
            <Text style={[styles.firstTitle, { color: theme.text }]}>Make your first video</Text>
            <Text style={[styles.firstBody, { color: theme.subtext }]}>
              Type an idea and Tonefy writes the script, adds a voice and finds the clips for
              you. It takes about two minutes.
            </Text>
            <TouchableOpacity
              style={styles.firstBtn}
              activeOpacity={0.85}
              onPress={() => { logStep('first_video_card'); logStep('open_idea'); navigation.navigate('IdeaToVideo'); }}
            >
              <MaterialIcons name="auto-awesome" size={20} color="#000" />
              <Text style={styles.firstBtnText}>Start with an idea</Text>
            </TouchableOpacity>
            <Text style={[styles.firstOr, { color: theme.subtext }]}>Or tap an idea to try:</Text>
            <View style={styles.ideaRow}>
              {STARTER_IDEAS.map((idea) => (
                <TouchableOpacity
                  key={idea}
                  style={[styles.ideaChip, { backgroundColor: theme.bg, borderColor: theme.border }]}
                  activeOpacity={0.75}
                  onPress={() => {
                    logStep('idea_example'); logStep('open_idea');
                    navigation.navigate('IdeaToVideo', { prompt: idea });
                  }}
                >
                  <MaterialIcons name="lightbulb-outline" size={12} color={theme.subtext} />
                  <Text style={[styles.ideaText, { color: theme.text }]}>{idea}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </GradientBorder>
        )}

        {/* Below the first-video card on purpose: the first thing a new person should
            see is what to DO, and this is a reminder, not a gate. Renders nothing for
            Google accounts and for anyone already confirmed. */}
        <VerifyEmailBanner theme={theme} focusTick={focusTick} />

        {/* Sections */}
        {sections.map((section, i) => (
          <View key={i} style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialIcons name={section.icon} size={16} color={section.color} />
              <Text style={[styles.sectionTitle, { color: theme.text }]}>{section.title}</Text>
            </View>
            <View style={styles.grid}>
              {section.cards.map((card, j) => (
                <TouchableOpacity
                  key={j}
                  style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }, card.soon && styles.cardSoon]}
                  onPress={() => handleCardPress(card)}
                  activeOpacity={0.75}
                >
                  <View style={[styles.cardIconWrap, { backgroundColor: (card.soon ? '#5a5a5a' : card.color) + '18' }]}>
                    <MaterialIcons name={card.icon} size={22} color={card.soon ? '#5a5a5a' : card.color} />
                  </View>
                  <Text style={[styles.cardTitle, { color: card.soon ? '#5a5a5a' : theme.text }]}>{card.title}</Text>
                  <Text style={[styles.cardDesc, { color: card.soon ? '#4a4a4a' : theme.subtext }]}>{card.desc}</Text>
                  {card.soon && <Text style={styles.cardSoonTag}>Coming soon</Text>}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        {/* Featured banner.
            It used to promote "AI Avatar Generation" behind a button reading "Explore
            Beta" that only ever said "Coming soon" - the most misleading control in the
            app, because "Explore Beta" states you can use it today while avatar
            generation needs a model nothing here has.
            It now features something REAL and hard to stumble on: Video Translator is
            built, does 14 languages, and lives in the editor's clip toolbar where
            nobody would find it. Promo space is worth more pointing at a shipped
            feature than at an intention. */}
        <GradientBorder radius={14} backgroundColor={theme.card} style={styles.banner}>
          <View style={styles.bannerContent}>
            <Text style={styles.bannerTag}>FEATURED TOOL</Text>
            <Text style={[styles.bannerTitle, { color: theme.text }]}>Video{'\n'}Translator</Text>
            <Text style={[styles.bannerSub, { color: theme.subtext }]}>
              Re-voice any clip in 14 languages
            </Text>
            <TouchableOpacity style={styles.bannerBtn} onPress={() => navigation.navigate('EditVideo')}>
              <Text style={styles.bannerBtnText}>Try it</Text>
            </TouchableOpacity>
          </View>
          <MaterialIcons name="translate" size={80} color="#2ecc71" style={{ opacity: 0.15, position: 'absolute', right: 16, bottom: 16 }} />
        </GradientBorder>

        <View style={{ height: 100 }} />
      </ScrollView>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },

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
  card: { backgroundColor: '#141414', borderRadius: 14, padding: 14, width: '47%' },
  cardIconWrap: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  cardTitle: { color: '#e5e2e1', fontWeight: '700', fontSize: 13, marginBottom: 4 },
  cardDesc: { color: '#555', fontSize: 11, lineHeight: 15 },
  cardSoon: { opacity: 0.65 },
  cardSoonTag: { color: '#5a5a5a', fontSize: 10, fontWeight: '600', marginTop: 6 },

  // First-video card
  firstCard: { marginHorizontal: 16, marginTop: 16, padding: 18 },
  firstTag: { fontSize: 10, fontWeight: '700', letterSpacing: 1.5, marginBottom: 6 },
  firstTitle: { fontSize: 20, fontWeight: '700' },
  firstBody: { fontSize: 13, lineHeight: 19, marginTop: 6 },
  firstBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#2ECC71', borderRadius: 12, paddingVertical: 13, marginTop: 16 },
  firstBtnText: { color: '#000', fontWeight: '700', fontSize: 15 },
  firstOr: { fontSize: 12, marginTop: 16, marginBottom: 8 },
  ideaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  ideaChip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8 },
  ideaText: { fontSize: 12, fontWeight: '600' },

  // Banner
  banner: { marginHorizontal: 16, marginTop: 28, borderRadius: 16, backgroundColor: '#141414', borderWidth: 1, borderColor: '#1e1e1e', padding: 20, overflow: 'hidden', minHeight: 140 },
  bannerContent: { zIndex: 1 },
  bannerTag: { color: '#2ecc71', fontSize: 10, fontWeight: '700', letterSpacing: 1.5, marginBottom: 8 },
  bannerTitle: { color: '#fff', fontSize: 22, fontWeight: '700', lineHeight: 28 },
  bannerSub: { fontSize: 12, marginTop: 4, marginBottom: 10 },
  bannerBtn: { marginTop: 14, backgroundColor: '#2ecc71', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, alignSelf: 'flex-start' },
  bannerBtnText: { color: '#000', fontWeight: '700', fontSize: 12 },

  // Bottom nav

  navItem: { alignItems: 'center', gap: 3 },
  navLabel: { color: '#555', fontSize: 10, fontWeight: '600' },
  navFab: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#2ecc71', alignItems: 'center', justifyContent: 'center', marginBottom: 8, shadowColor: '#2ecc71', shadowOpacity: 0.4, shadowRadius: 12, elevation: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#111', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalHandle: { width: 40, height: 4, backgroundColor: '#333', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  sheetTitle: { fontSize: 18, fontWeight: '700' },
  sheetHeaderPad: { marginBottom: 20 },
  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14 },
  settingLeft: { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 },
  settingLabel: { color: '#fff', fontSize: 14, fontWeight: '600' },
  settingDesc: { color: '#666', fontSize: 11, marginTop: 2 },
  settingDivider: { height: 1, backgroundColor: '#1a1a1a' },
  closeBtn: { marginTop: 24, backgroundColor: '#1a1a1a', borderRadius: 14, padding: 14, alignItems: 'center' },
  closeBtnText: { color: '#888', fontWeight: '600', fontSize: 14 },
});
