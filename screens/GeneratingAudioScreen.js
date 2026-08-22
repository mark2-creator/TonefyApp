import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar, Animated
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getAuth } from 'firebase/auth';
import { useTheme } from '../context/ThemeContext';
import { showAlert } from '../components/BrandedAlert';

const BACKEND = 'https://api.fitlifesolutions.site';
const BARS = 8;

// Two real stages, and the ceiling each one may creep to before it has actually
// finished. This screen used to run a setInterval that added a random number until it
// hit 100 and then navigated to a hardcoded result - it never called anything, and no
// audio was ever made.
//
// The number now moves for a reason: it eases toward the current stage's ceiling and
// can only CROSS it when the real await resolves. So it never sits frozen, and it can
// never report finished work that has not happened - which is the property the old
// timer had backwards.
const STAGE_CEILING = { script: 45, audio: 95 };

async function authFetch(path, body, signal) {
  const headers = { 'Content-Type': 'application/json' };
  try {
    const user = getAuth().currentUser;
    if (user) headers.Authorization = `Bearer ${await user.getIdToken()}`;
  } catch (e) { console.warn('Token error:', e); }
  const res = await fetch(BACKEND + path, { method: 'POST', headers, body: JSON.stringify(body), signal });
  let data = null;
  try { data = await res.json(); } catch (e) { /* non-JSON error page */ }
  if (!res.ok || data?.error) {
    const err = new Error(data?.error || `Server error (${res.status}).`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export default function GeneratingAudioScreen({ navigation, route }) {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const {
    mode = 'idea',
    prompt = '',
    script: givenScript = '',
    title = '',
    seconds = 60,
    voiceId = 'gtts-us',
    rate = 1,
    pitch = 0,
    // Absent on the Idea-to-Audio path, which has no music control - the endpoint
    // treats a null musicId as "no bed" and costs exactly what it did before.
    musicId = null,
    musicVolume = 0.18,
  } = route.params || {};

  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState(mode === 'idea' ? 'Writing your script…' : 'Synthesizing voice…');
  const anims = useRef([...Array(BARS)].map(() => new Animated.Value(8))).current;
  const abortRef = useRef(null);
  const ceilingRef = useRef(mode === 'idea' ? STAGE_CEILING.script : STAGE_CEILING.audio);
  // Navigation away must not be attempted twice, and a state write after unmount is a
  // warning nobody can act on. One ref answers both.
  const doneRef = useRef(false);

  useEffect(() => {
    anims.forEach((anim, i) => {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(anim, { toValue: 6 + Math.random() * 26, duration: 300 + i * 80, useNativeDriver: false }),
          Animated.timing(anim, { toValue: 6, duration: 300 + i * 80, useNativeDriver: false }),
        ])
      );
      setTimeout(() => loop.start(), i * 100);
    });
  }, [anims]);

  useEffect(() => {
    const controller = new AbortController();
    abortRef.current = controller;

    // Eases toward whatever ceiling the current stage has set, never past it. Slower
    // the closer it gets, so a long stage decelerates instead of stopping dead.
    const ticker = setInterval(() => {
      if (doneRef.current) return;
      setProgress(p => (p >= ceilingRef.current ? p : p + Math.max(0.3, (ceilingRef.current - p) * 0.04)));
    }, 200);

    (async () => {
      try {
        let script = givenScript;

        if (mode === 'idea') {
          const data = await authFetch('/api/generate-script', { prompt, targetSeconds: seconds }, controller.signal);
          script = (data.script || '').trim();
          if (!script) throw new Error('The script came back empty. Try rewording your idea.');
          ceilingRef.current = STAGE_CEILING.audio;
          setProgress(p => Math.max(p, STAGE_CEILING.script));
          setStatus('Synthesizing voice…');
        }

        if (!script) throw new Error('There is no script to read.');

        // rate/pitch default to 1/0, which the server treats as "nothing asked for"
        // and skips the shaping pass entirely - so the Idea-to-Audio path, which has
        // no such controls, costs exactly what it did before.
        const audio = await authFetch('/api/generate-audio', { text: script, voiceId, rate, pitch, musicId, musicVolume }, controller.signal);
        if (!audio.audioUrl) throw new Error('No audio came back from the server.');

        doneRef.current = true;
        setProgress(100);
        setStatus('Done');
        // Replace, not navigate: going back from the result belongs on the screen the
        // idea was typed into, not on a progress ring for work already finished.
        navigation.replace('AudioResult', {
          audioUrl: BACKEND + audio.audioUrl,
          script,
          title: title || prompt.slice(0, 60),
          voiceId,
          seconds,
        });
      } catch (e) {
        if (doneRef.current || e.name === 'AbortError') return;
        doneRef.current = true;
        // 403 is the plan gate - the backend's message names the voice or the limit,
        // so it is shown as written rather than replaced with a generic one.
        showAlert(
          e.status === 403 ? 'Not on your plan' : 'Could not generate audio',
          e.message || 'Something went wrong. Please try again.',
        );
        navigation.goBack();
      }
    })();

    return () => { clearInterval(ticker); controller.abort(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function cancel() {
    doneRef.current = true;
    abortRef.current?.abort();
    navigation.goBack();
  }

  const shown = Math.min(100, Math.floor(progress));

  return (
    <View style={[styles.container, { backgroundColor: theme.bg, paddingTop: insets.top }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.bg} />

      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <Text style={styles.logo}>Tonefy AI</Text>
        <MaterialIcons name="graphic-eq" size={22} color={theme.icon} />
      </View>

      <View style={styles.content}>
        <View style={[styles.circleWrapper, { borderColor: theme.border }]}>
          <View style={styles.circleBg} />
          <Text style={styles.progressNum}>{shown}%</Text>
          <Text style={[styles.progressLabel, { color: theme.subtext }]}>PROCESSING</Text>
        </View>

        <Text style={[styles.statusText, { color: theme.text }]}>{status}</Text>

        <View style={styles.waveform}>
          {anims.map((anim, i) => (
            <Animated.View key={i} style={[styles.bar, { height: anim }]} />
          ))}
        </View>

        <View style={[styles.tipCard, { backgroundColor: isDark ? 'rgba(26,26,26,0.6)' : 'rgba(0,0,0,0.04)', borderColor: theme.border }]}>
          <View style={styles.tipHeader}>
            <MaterialIcons name="lightbulb" size={18} color="#92ccff" />
            <Text style={styles.tipLabel}>PRO TIP</Text>
          </View>
          <Text style={[styles.tipText, { color: theme.subtext }]}>
            Naming an audience in your idea — <Text style={styles.tipHighlight}>"for first-time founders"</Text> — gives the script something to aim at, and makes it sound written rather than generic.
          </Text>
        </View>
      </View>

      <View style={[styles.bottomBar, { borderTopColor: theme.border, paddingBottom: insets.bottom || 16 }]}>
        <TouchableOpacity style={[styles.cancelBtn, { backgroundColor: theme.card, borderColor: theme.border }]} onPress={cancel}>
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
