import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar, Animated
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { auth } from '../firebase';
import { useTheme } from '../context/ThemeContext';

const BACKEND = 'https://api.fitlifesolutions.site';
const BARS = 8;

export default function GeneratingAudioScreen({ navigation, route }) {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { idea, duration, tags } = route.params || {};
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('Synthesizing voice...');
  const anims = useRef([...Array(BARS)].map(() => new Animated.Value(8))).current;

  useEffect(() => {
    // Animate waveform bars
    anims.forEach((anim, i) => {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(anim, { toValue: 6 + Math.random() * 26, duration: 300 + i * 80, useNativeDriver: false }),
          Animated.timing(anim, { toValue: 6, duration: 300 + i * 80, useNativeDriver: false }),
        ])
      );
      setTimeout(() => loop.start(), i * 100);
    });

    // Simulate progress
    let p = 0;
    const interval = setInterval(() => {
      p += Math.random() * 8;
      if (p >= 100) { p = 100; clearInterval(interval); }
      setProgress(Math.floor(p));
      if (p < 30) setStatus('Generating script...');
      else if (p < 60) setStatus('Synthesizing voice...');
      else if (p < 90) setStatus('Applying style...');
      else setStatus('Finalizing...');
      if (p >= 100) {
        setTimeout(() => navigation.replace('AudioResult', { idea, duration, tags }), 500);
      }
    }, 400);

    return () => clearInterval(interval);
  }, []);

  const circumference = 2 * Math.PI * 110;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <View style={[styles.container, { backgroundColor: theme.bg, paddingTop: insets.top }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.bg} />

      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <Text style={styles.logo}>Tonefy AI</Text>
        <MaterialIcons name="settings" size={22} color={theme.icon} />
      </View>

      <View style={styles.content}>
        {/* Circular Progress */}
        <View style={[styles.circleWrapper, { borderColor: theme.border }]}>
          <View style={styles.circleBg} />
          <Text style={styles.progressNum}>{progress}%</Text>
          <Text style={[styles.progressLabel, { color: theme.subtext }]}>PROCESSING</Text>
        </View>

        {/* Status */}
        <Text style={[styles.statusText, { color: theme.text }]}>{status}</Text>

        {/* Waveform */}
        <View style={styles.waveform}>
          {anims.map((anim, i) => (
            <Animated.View key={i} style={[styles.bar, { height: anim }]} />
          ))}
        </View>

        {/* Tip card */}
        <View style={[styles.tipCard, { backgroundColor: isDark ? 'rgba(26,26,26,0.6)' : 'rgba(0,0,0,0.04)', borderColor: theme.border }]}>
          <View style={styles.tipHeader}>
            <MaterialIcons name="lightbulb" size={18} color="#92ccff" />
            <Text style={styles.tipLabel}>PRO TIP</Text>
          </View>
          <Text style={[styles.tipText, { color: theme.subtext }]}>
            Adding <Text style={styles.tipHighlight}>"passionate"</Text> or <Text style={styles.tipHighlight}>"softly"</Text> in your prompt helps the AI adjust its emotional tone for a more human experience.
          </Text>
        </View>
      </View>

      {/* Cancel */}
      <View style={[styles.bottomBar, { borderTopColor: theme.border, paddingBottom: insets.bottom || 16 }]}>
        <TouchableOpacity style={[styles.cancelBtn, { backgroundColor: theme.card, borderColor: theme.border }]} onPress={() => navigation.goBack()}>
          <MaterialIcons name="close" size={16} color="#ffb4ab" />
          <Text style={styles.cancelText}>Cancel Generation</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  logo: { fontSize: 20, fontWeight: '800', color: '#54e98a' },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16, gap: 24 },
  circleWrapper: { width: 200, height: 200, borderRadius: 100, borderWidth: 10, alignItems: 'center', justifyContent: 'center', borderTopColor: '#54e98a', borderRightColor: '#54e98a' },
  circleBg: { position: 'absolute' },
  progressNum: { fontSize: 44, fontWeight: '700', color: '#54e98a' },
  progressLabel: { fontSize: 10, fontWeight: '600', letterSpacing: 2 },
  statusText: { fontSize: 18, fontWeight: '600' },
  waveform: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 40 },
  bar: { width: 3, backgroundColor: '#54e98a', borderRadius: 4 },
  tipCard: { borderRadius: 12, padding: 16, borderWidth: 1, width: '100%', gap: 8 },
  tipHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tipLabel: { fontSize: 10, fontWeight: '700', color: '#92ccff', letterSpacing: 2 },
  tipText: { fontSize: 13, lineHeight: 20 },
  tipHighlight: { color: '#54e98a', fontWeight: '600' },
  bottomBar: { paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1 },
  cancelBtn: { height: 52, borderRadius: 999, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  cancelText: { color: '#ffb4ab', fontSize: 12, fontWeight: '600' },
});
