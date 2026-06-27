import React, { useEffect, useRef } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity,
  ScrollView, StatusBar, Animated, Dimensions
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');
const STATUSBAR_HEIGHT = StatusBar.currentHeight || 0;

const features = [
  { icon: 'auto-awesome', title: 'Idea to Video', desc: 'Transform ideas into stunning videos instantly', color: '#00e38d' },
  { icon: 'mic', title: 'AI Voiceover', desc: '2500+ ultra-realistic voices & accents', color: '#4cd6ff' },
  { icon: 'edit-note', title: 'Script Writer', desc: 'AI generates engaging scripts instantly', color: '#ecb2ff' },
  { icon: 'language', title: '80+ Languages', desc: 'Go global with one click translation', color: '#00e38d' },
];

export default function LandingScreen({ navigation }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 900, useNativeDriver: true }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 0.12, duration: 2500, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0.04, duration: 2500, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.logoRow}>
          <MaterialIcons name="graphic-eq" size={26} color="#00e38d" />
          <Text style={styles.logo}>Tonefy AI</Text>
        </View>
        <TouchableOpacity style={styles.loginBtn} onPress={() => navigation.navigate('Auth')}>
          <Text style={styles.loginText}>Login</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Hero */}
        <Animated.View style={[styles.hero, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          {/* Ambient glow */}
          <Animated.View style={[styles.ambientGlow, { opacity: glowAnim }]} />
          <Animated.View style={[styles.ambientGlow2, { opacity: glowAnim }]} />

          <View style={styles.badge}>
            <View style={styles.badgeDot} />
            <Text style={styles.badgeText}>NEW: AI STUDIO 2.0</Text>
          </View>

          <Text style={styles.heroTitle}>Turn Ideas Into</Text>
          <Text style={styles.heroTitleGradient}>Videos with AI</Text>

          <Text style={styles.heroSub}>
            AI voiceovers, video clips, scripts, and more — in seconds. The ultimate creative suite.
          </Text>

          <TouchableOpacity
            style={styles.ctaBtn}
            onPress={() => navigation.navigate('Auth')}
            activeOpacity={0.85}
          >
            <Text style={styles.ctaBtnText}>Start for Free</Text>
            <MaterialIcons name="arrow-forward" size={18} color="#00391f" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryBtn} activeOpacity={0.85}>
            <MaterialIcons name="play-circle" size={16} color="#b9cbbc" />
            <Text style={styles.secondaryBtnText}>Watch Demo</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Preview card */}
        <View style={styles.previewCard}>
          <View style={styles.previewInner}>
            <View style={styles.previewGlow} />
            <View style={styles.previewContent}>
              <View style={styles.previewIconWrap}>
                <MaterialIcons name="play-circle" size={22} color="#00e38d" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.previewTitle}>Space Documentary</Text>
                <Text style={styles.previewSub}>RENDERING AI CONTENT...</Text>
              </View>
            </View>
            <View style={styles.progressBar}>
              <View style={styles.progressFill} />
            </View>
          </View>
        </View>

        {/* Features */}
        <View style={styles.section}>
          <Text style={styles.sectionEyebrow}>CORE CAPABILITIES</Text>
          <Text style={styles.sectionTitle}>Powerful Toolset for{'\n'}Modern Creators</Text>
          <View style={styles.featuresGrid}>
            {features.map((f, i) => (
              <View key={i} style={styles.featureCard}>
                <View style={[styles.featureIconWrap, { backgroundColor: f.color + '18' }]}>
                  <MaterialIcons name={f.icon} size={22} color={f.color} />
                </View>
                <Text style={styles.featureTitle}>{f.title}</Text>
                <Text style={styles.featureDesc}>{f.desc}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          {[
            { value: '10x', label: 'Faster Production' },
            { value: '50K+', label: 'Creators' },
            { value: '99%', label: 'Cost Reduction' },
          ].map((s, i) => (
            <View key={i} style={styles.statCard}>
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* CTA Banner */}
        <View style={styles.ctaBanner}>
          <View style={styles.ctaBannerGlow} />
          <Text style={styles.ctaBannerTitle}>Ready to amplify{'\n'}your creativity?</Text>
          <Text style={styles.ctaBannerSub}>
            Join 50,000+ creators redefining the industry standard with Tonefy AI.
          </Text>
          <TouchableOpacity
            style={styles.ctaBannerBtn}
            onPress={() => navigation.navigate('Auth')}
            activeOpacity={0.85}
          >
            <Text style={styles.ctaBannerBtnText}>Get Started — It's Free</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.ctaBannerSecondary} activeOpacity={0.85}>
            <Text style={styles.ctaBannerSecondaryText}>Book a Demo</Text>
          </TouchableOpacity>
          <Text style={styles.ctaBannerNote}>No credit card required. Cancel anytime.</Text>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.logoRow}>
            <MaterialIcons name="graphic-eq" size={16} color="#00e38d" />
            <Text style={styles.footerLogo}>Tonefy AI</Text>
          </View>
          <View style={styles.footerLinks}>
            {['Privacy', 'Terms', 'Twitter', 'YouTube'].map((l, i) => (
              <Text key={i} style={styles.footerLink}>{l}</Text>
            ))}
          </View>
          <Text style={styles.footerCopy}>© 2025 Tonefy AI. All rights reserved.</Text>
        </View>

        <View style={{ height: 90 }} />
      </ScrollView>

      {/* Bottom Nav */}
      <View style={styles.bottomNav}>
        <View style={styles.navItemActive}>
          <MaterialIcons name="home" size={22} color="#00e38d" />
          <Text style={[styles.navLabel, { color: '#00e38d' }]}>Home</Text>
        </View>
        <View style={styles.navItem}>
          <MaterialIcons name="folder-open" size={22} color="#555" />
          <Text style={styles.navLabel}>Projects</Text>
        </View>
        <View style={styles.navItem}>
          <MaterialIcons name="auto-awesome" size={22} color="#555" />
          <Text style={styles.navLabel}>AI Tools</Text>
        </View>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Auth')}>
          <MaterialIcons name="person" size={22} color="#555" />
          <Text style={styles.navLabel}>Profile</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', paddingTop: STATUSBAR_HEIGHT },

  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#ffffff10' },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logo: { color: '#00e38d', fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  loginBtn: { borderWidth: 1, borderColor: '#00e38d', borderRadius: 20, paddingHorizontal: 18, paddingVertical: 7 },
  loginText: { color: '#00e38d', fontSize: 13, fontWeight: '600' },

  scroll: { paddingBottom: 20 },

  // Hero
  hero: { padding: 20, paddingTop: 36, alignItems: 'center', position: 'relative', overflow: 'hidden' },
  ambientGlow: { position: 'absolute', top: -40, left: -40, width: width * 0.8, height: width * 0.8, backgroundColor: '#00e38d', borderRadius: width, transform: [{ scaleX: 1.5 }] },
  ambientGlow2: { position: 'absolute', bottom: -60, right: -60, width: width * 0.6, height: width * 0.6, backgroundColor: '#4cd6ff', borderRadius: width },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#00e38d10', borderWidth: 1, borderColor: '#00e38d30', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, marginBottom: 24 },
  badgeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#00e38d' },
  badgeText: { color: '#00e38d', fontSize: 10, fontWeight: '700', letterSpacing: 1.5 },
  heroTitle: { color: '#e4e1e6', fontSize: 34, fontWeight: '800', textAlign: 'center', letterSpacing: -0.5 },
  heroTitleGradient: { color: '#00e38d', fontSize: 34, fontWeight: '800', textAlign: 'center', letterSpacing: -0.5, marginBottom: 16 },
  heroSub: { color: '#b9cbbc', fontSize: 15, textAlign: 'center', lineHeight: 23, marginBottom: 28, maxWidth: 300 },
  ctaBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#00e38d', borderRadius: 14, paddingHorizontal: 32, paddingVertical: 16, marginBottom: 14, width: '100%', justifyContent: 'center', shadowColor: '#00e38d', shadowOpacity: 0.3, shadowRadius: 20, elevation: 8 },
  ctaBtnText: { color: '#00391f', fontWeight: '800', fontSize: 16 },
  secondaryBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#ffffff20', borderRadius: 14, paddingHorizontal: 32, paddingVertical: 14, width: '100%', justifyContent: 'center' },
  secondaryBtnText: { color: '#b9cbbc', fontWeight: '600', fontSize: 15 },

  // Preview card
  previewCard: { marginHorizontal: 20, marginTop: 24, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: '#ffffff10', backgroundColor: '#1f1f22' },
  previewInner: { padding: 16 },
  previewGlow: { position: 'absolute', top: 0, left: 0, right: 0, height: 2, backgroundColor: '#00e38d', opacity: 0.6 },
  previewContent: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  previewIconWrap: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#00e38d20', alignItems: 'center', justifyContent: 'center' },
  previewTitle: { color: '#00e38d', fontSize: 13, fontWeight: '600' },
  previewSub: { color: '#b9cbbc', fontSize: 9, letterSpacing: 1, marginTop: 2 },
  progressBar: { height: 4, backgroundColor: '#ffffff10', borderRadius: 2, overflow: 'hidden' },
  progressFill: { width: '66%', height: '100%', backgroundColor: '#00e38d', borderRadius: 2 },

  // Features
  section: { padding: 20, paddingTop: 32 },
  sectionEyebrow: { color: '#00e38d', fontSize: 10, fontWeight: '700', letterSpacing: 2, marginBottom: 8 },
  sectionTitle: { color: '#e4e1e6', fontSize: 22, fontWeight: '700', lineHeight: 30, marginBottom: 20 },
  featuresGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  featureCard: { backgroundColor: '#1f1f22', borderRadius: 20, padding: 18, width: (width - 52) / 2, borderWidth: 1, borderColor: '#ffffff08' },
  featureIconWrap: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  featureTitle: { color: '#e4e1e6', fontWeight: '700', fontSize: 13, marginBottom: 6 },
  featureDesc: { color: '#b9cbbc', fontSize: 11, lineHeight: 16 },

  // Stats
  statsRow: { flexDirection: 'row', marginHorizontal: 20, marginTop: 4, gap: 10 },
  statCard: { flex: 1, backgroundColor: '#1f1f22', borderRadius: 16, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#ffffff08' },
  statValue: { color: '#00e38d', fontSize: 22, fontWeight: '800', marginBottom: 4 },
  statLabel: { color: '#b9cbbc', fontSize: 10, fontWeight: '600', textAlign: 'center' },

  // CTA Banner
  ctaBanner: { margin: 20, marginTop: 28, backgroundColor: '#1f1f22', borderRadius: 28, padding: 28, alignItems: 'center', borderWidth: 1, borderColor: '#ffffff10', overflow: 'hidden' },
  ctaBannerGlow: { position: 'absolute', top: -60, right: -60, width: 180, height: 180, backgroundColor: '#00e38d', borderRadius: 90, opacity: 0.05 },
  ctaBannerTitle: { color: '#e4e1e6', fontSize: 24, fontWeight: '800', textAlign: 'center', lineHeight: 32, marginBottom: 10 },
  ctaBannerSub: { color: '#b9cbbc', fontSize: 13, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  ctaBannerBtn: { backgroundColor: '#00e38d', borderRadius: 25, paddingHorizontal: 32, paddingVertical: 15, marginBottom: 12, width: '100%', alignItems: 'center', shadowColor: '#00e38d', shadowOpacity: 0.25, shadowRadius: 15, elevation: 6 },
  ctaBannerBtnText: { color: '#00391f', fontWeight: '800', fontSize: 15 },
  ctaBannerSecondary: { borderWidth: 1, borderColor: '#ffffff20', borderRadius: 25, paddingHorizontal: 32, paddingVertical: 13, marginBottom: 16, width: '100%', alignItems: 'center' },
  ctaBannerSecondaryText: { color: '#e4e1e6', fontWeight: '600', fontSize: 14 },
  ctaBannerNote: { color: '#3a4a3f', fontSize: 11 },

  // Footer
  footer: { padding: 24, alignItems: 'center', gap: 14, borderTopWidth: 1, borderTopColor: '#ffffff08', marginTop: 8 },
  footerLogo: { color: '#00e38d', fontWeight: '700', fontSize: 15, marginLeft: 6 },
  footerLinks: { flexDirection: 'row', gap: 20 },
  footerLink: { color: '#3a4a3f', fontSize: 12 },
  footerCopy: { color: '#3a4a3f', fontSize: 11 },

  // Bottom nav
  bottomNav: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', height: 64, backgroundColor: '#1f1f22', borderTopWidth: 1, borderTopColor: '#ffffff08', paddingBottom: 6, shadowColor: '#00e38d', shadowOpacity: 0.1, shadowRadius: 20 },
  navItem: { alignItems: 'center', gap: 3 },
  navItemActive: { alignItems: 'center', gap: 3, backgroundColor: '#00e38d15', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 6 },
  navLabel: { color: '#555', fontSize: 10, fontWeight: '600' },
});
