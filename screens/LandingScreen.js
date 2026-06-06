import { StyleSheet, Text, View, TouchableOpacity, ScrollView } from 'react-native';

export default function LandingScreen({ navigation }) {
  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.logo}>Tonefy AI</Text>
        <TouchableOpacity style={styles.loginBtn} onPress={() => navigation.navigate('Auth')}>
          <Text style={styles.loginText}>Login</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>Turn Ideas Into Videos with AI</Text>
        <Text style={styles.heroSub}>AI voiceovers, video clips, and scripts in seconds</Text>
        <TouchableOpacity style={styles.ctaBtn} onPress={() => navigation.navigate('Auth')}>
          <Text style={styles.ctaText}>Start for Free</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.features}>
        {[
          { icon: '🎬', title: 'Idea to Video', desc: 'Transform ideas into stunning videos' },
          { icon: '🎙️', title: 'AI Voiceover', desc: '2500+ ultra-realistic voices' },
          { icon: '✍️', title: 'Script Writer', desc: 'AI generates your script instantly' },
          { icon: '🌍', title: '80+ Languages', desc: 'Translate with one click' },
        ].map((f, i) => (
          <View key={i} style={styles.featureCard}>
            <Text style={styles.featureIcon}>{f.icon}</Text>
            <Text style={styles.featureTitle}>{f.title}</Text>
            <Text style={styles.featureDesc}>{f.desc}</Text>
          </View>
        ))}
      </View>
      <TouchableOpacity style={styles.bottomCta} onPress={() => navigation.navigate('Auth')}>
        <Text style={styles.ctaText}>Get Started - Its Free</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 50 },
  logo: { color: '#2ecc71', fontSize: 22, fontWeight: 'bold' },
  loginBtn: { borderWidth: 1, borderColor: '#2ecc71', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 6 },
  loginText: { color: '#2ecc71', fontSize: 14 },
  hero: { padding: 24, paddingTop: 40, alignItems: 'center' },
  heroTitle: { color: '#fff', fontSize: 28, fontWeight: 'bold', textAlign: 'center', lineHeight: 36 },
  heroSub: { color: '#aaa', fontSize: 15, textAlign: 'center', marginTop: 12, lineHeight: 22 },
  ctaBtn: { backgroundColor: '#2ecc71', borderRadius: 25, paddingHorizontal: 32, paddingVertical: 14, marginTop: 24 },
  ctaText: { color: '#000', fontWeight: 'bold', fontSize: 16 },
  features: { padding: 16, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  featureCard: { backgroundColor: '#1a1a1a', borderRadius: 12, padding: 16, width: '48%', marginBottom: 12 },
  featureIcon: { fontSize: 28, marginBottom: 8 },
  featureTitle: { color: '#fff', fontWeight: 'bold', fontSize: 14, marginBottom: 4 },
  featureDesc: { color: '#888', fontSize: 12, lineHeight: 16 },
  bottomCta: { backgroundColor: '#2ecc71', margin: 16, borderRadius: 25, padding: 16, alignItems: 'center', marginBottom: 40 },
});
