import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  StatusBar, Animated
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const BAR_COUNT = 40;

export default function RecordingScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [seconds, setSeconds] = useState(0);
  const [paused, setPaused] = useState(false);
  const bars = useRef([...Array(BAR_COUNT)].map(() => new Animated.Value(10))).current;

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [paused]);

  useEffect(() => {
    bars.forEach((bar, i) => {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(bar, { toValue: Math.random() * 60 + 10, duration: 100 + i * 2, useNativeDriver: false }),
          Animated.timing(bar, { toValue: 10, duration: 100 + i * 2, useNativeDriver: false }),
        ])
      );
      setTimeout(() => loop.start(), i * 20);
    });
  }, []);

  const mins = String(Math.floor(seconds / 60)).padStart(2, '0');
  const secs = String(seconds % 60).padStart(2, '0');

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a0a" translucent />
      <View style={styles.cameraBg} />
      <View style={styles.gradientTop} />
      <View style={styles.gradientBottom} />
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
          <MaterialIcons name="close" size={24} color="#e5e2e1" />
        </TouchableOpacity>
        <View style={styles.timerBox}>
          <View style={styles.redDot} />
          <Text style={styles.timer}>{mins}:{secs}</Text>
        </View>
        <TouchableOpacity style={styles.iconBtn}>
          <MaterialIcons name="settings" size={24} color="#e5e2e1" />
        </TouchableOpacity>
      </View>
      <View style={styles.aiLabel}>
        <MaterialIcons name="auto-awesome" size={14} color="#2ecc71" />
        <Text style={styles.aiLabelText}>Tonefy AI analyzing frequencies...</Text>
      </View>
      <View style={styles.center}>
        <View style={styles.recordGlow} />
        <TouchableOpacity style={styles.stopBtn} onPress={() => navigation.replace('PostRecording')}>
          <MaterialIcons name="stop" size={40} color="#fff" />
        </TouchableOpacity>
        <View style={styles.recordRing} />
      </View>
      <View style={[styles.bottom, { paddingBottom: insets.bottom || 20 }]}>
        <View style={styles.waveform}>
          {bars.map((bar, i) => (
            <Animated.View key={i} style={[styles.waveBar, { height: bar }]} />
          ))}
        </View>
        <View style={styles.controls}>
          <View style={styles.controlItem}>
            <TouchableOpacity style={styles.controlBtn} onPress={() => setPaused(!paused)}>
              <MaterialIcons name={paused ? 'play-arrow' : 'pause'} size={28} color="#e5e2e1" />
            </TouchableOpacity>
            <Text style={styles.controlLabel}>{paused ? 'Resume' : 'Pause'}</Text>
          </View>
          <View style={styles.controlItem}>
            <TouchableOpacity style={styles.finishBtn} onPress={() => navigation.replace('PostRecording')}>
              <MaterialIcons name="check" size={36} color="#003919" />
            </TouchableOpacity>
            <Text style={[styles.controlLabel, { color: '#2ecc71' }]}>Finish</Text>
          </View>
          <View style={styles.controlItem}>
            <TouchableOpacity style={styles.controlBtn}>
              <MaterialIcons name="flip-camera-ios" size={28} color="#e5e2e1" />
            </TouchableOpacity>
            <Text style={styles.controlLabel}>Flip</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  cameraBg: { ...StyleSheet.absoluteFillObject, backgroundColor: '#111' },
  gradientTop: { position: 'absolute', top: 0, left: 0, right: 0, height: 200, backgroundColor: 'rgba(0,0,0,0.6)' },
  gradientBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 300, backgroundColor: 'rgba(0,0,0,0.8)' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 16, zIndex: 10 },
  iconBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(20,20,20,0.7)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#1e1e1e' },
  timerBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(20,20,20,0.7)', paddingHorizontal: 20, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: '#1e1e1e' },
  redDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#ff4444' },
  timer: { color: '#e5e2e1', fontSize: 22, fontWeight: '700' },
  aiLabel: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center', backgroundColor: 'rgba(46,204,113,0.1)', borderWidth: 1, borderColor: 'rgba(46,204,113,0.2)', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8, zIndex: 10 },
  aiLabelText: { color: '#2ecc71', fontSize: 11, fontWeight: '500' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  recordGlow: { position: 'absolute', width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(255,68,68,0.12)' },
  stopBtn: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#ff4444', alignItems: 'center', justifyContent: 'center' },
  recordRing: { position: 'absolute', width: 120, height: 120, borderRadius: 60, borderWidth: 2, borderColor: 'rgba(255,68,68,0.3)' },
  bottom: { paddingHorizontal: 20, zIndex: 10 },
  waveform: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 3, height: 70, marginBottom: 20, overflow: 'hidden' },
  waveBar: { width: 4, backgroundColor: '#2ecc71', borderRadius: 4, opacity: 0.7 },
  controls: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingBottom: 10 },
  controlItem: { alignItems: 'center', gap: 6 },
  controlBtn: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(20,20,20,0.7)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#1e1e1e' },
  finishBtn: { width: 68, height: 68, borderRadius: 34, backgroundColor: '#2ecc71', alignItems: 'center', justifyContent: 'center', shadowColor: '#2ecc71', shadowOpacity: 0.4, shadowRadius: 20 },
  controlLabel: { color: '#888', fontSize: 11, fontWeight: '500' },
});
