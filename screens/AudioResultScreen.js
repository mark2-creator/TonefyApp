import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, PanResponder,
  StyleSheet, StatusBar, ActivityIndicator
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Audio } from 'expo-av';
import * as Clipboard from 'expo-clipboard';
import { getAuth } from 'firebase/auth';
import { useTheme } from '../context/ThemeContext';
import { VOICES } from '../constants/voices';
import { saveAudioToDevice } from '../utils/saveVideo';
import { showAlert } from '../components/BrandedAlert';

const BACKEND = 'https://api.fitlifesolutions.site';
const BARS = 60;
const SKIP_MS = 15000;

function fmt(ms) {
  const total = Math.max(0, Math.round((ms || 0) / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export default function AudioResultScreen({ navigation, route }) {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { audioUrl, script = '', title = '', voiceId = 'gtts-us' } = route.params || {};
  const voice = VOICES.find(v => v.id === voiceId);

  const soundRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [peaks, setPeaks] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadPct, setDownloadPct] = useState(0);

  // --- playback -----------------------------------------------------------
  useEffect(() => {
    if (!audioUrl) return;
    let cancelled = false;
    (async () => {
      try {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: false });
        const { sound } = await Audio.Sound.createAsync({ uri: audioUrl }, { progressUpdateIntervalMillis: 200 });
        if (cancelled) { sound.unloadAsync().catch(() => {}); return; }
        soundRef.current = sound;
        sound.setOnPlaybackStatusUpdate((st) => {
          if (!st.isLoaded) return;
          setPosition(st.positionMillis || 0);
          setDuration(st.durationMillis || 0);
          setPlaying(st.isPlaying);
          // Leaving it parked at the end means the next tap on play does nothing
          // visible - it restarts, but only after the user has pressed twice.
          if (st.didJustFinish) {
            setPlaying(false);
            sound.setPositionAsync(0).catch(() => {});
          }
        });
        setReady(true);
      } catch (e) {
        showAlert('Playback', 'Could not load this audio.');
      }
    })();
    // Unloaded on the way out, or the voice keeps talking over whatever screen
    // comes next - the same failure the voice previews had.
    return () => { cancelled = true; soundRef.current?.unloadAsync().catch(() => {}); soundRef.current = null; };
  }, [audioUrl]);

  // --- real waveform ------------------------------------------------------
  // Asked of the backend rather than drawn from random numbers: this card used to
  // render 60 random bars, so every track looked identical and the picture had no
  // relationship to the sound. Peaks come from ffmpeg on the actual file.
  useEffect(() => {
    if (!audioUrl) return;
    let cancelled = false;
    (async () => {
      try {
        const user = getAuth().currentUser;
        const headers = { 'Content-Type': 'application/json' };
        if (user) headers.Authorization = `Bearer ${await user.getIdToken()}`;
        const res = await fetch(`${BACKEND}/api/audio-waveform`, {
          method: 'POST', headers, body: JSON.stringify({ url: audioUrl, samples: BARS }),
        });
        const data = await res.json();
        if (!cancelled && Array.isArray(data.peaks) && data.peaks.length) setPeaks(data.peaks);
      } catch (e) { /* the flat placeholder stays; not worth an alert */ }
    })();
    return () => { cancelled = true; };
  }, [audioUrl]);

  const progress = duration > 0 ? Math.min(1, position / duration) : 0;

  async function togglePlay() {
    const s = soundRef.current;
    if (!s) return;
    try { playing ? await s.pauseAsync() : await s.playAsync(); } catch (e) {}
  }

  const seekTo = useCallback(async (ms) => {
    const s = soundRef.current;
    if (!s || !duration) return;
    const clamped = Math.max(0, Math.min(duration, ms));
    setPosition(clamped);           // immediate, so the thumb tracks the finger
    try { await s.setPositionAsync(clamped); } catch (e) {}
  }, [duration]);

  // --- scrubbing ----------------------------------------------------------
  const trackWidth = useRef(0);
  // The bar's left edge in SCREEN coordinates, worked out at the moment of the grab.
  // onLayout gives x relative to the parent, which is a different number and would put
  // every drag out by however far the card is inset. pageX - locationX is the one pair
  // that is always in the same space as the gesture's own moveX.
  const originX = useRef(0);
  const durationRef = useRef(0);
  durationRef.current = duration;

  const scrub = useCallback((x) => {
    const d = durationRef.current;
    if (!trackWidth.current || !d) return;
    seekTo((Math.max(0, Math.min(trackWidth.current, x)) / trackWidth.current) * d);
  }, [seekTo]);

  // panHandlers, not the wrapper: spreading PanResponder.create() itself sets one
  // ignored prop and attaches no callbacks at all (see useDragTracker in CLAUDE.md).
  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    // The parent ScrollView asks for the touch back the moment the finger moves,
    // and every scrub is a sideways move - the same trap the timeline trim handles hit.
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: (e) => {
      originX.current = e.nativeEvent.pageX - e.nativeEvent.locationX;
      scrub(e.nativeEvent.locationX);
    },
    onPanResponderMove: (e, g) => scrub(g.moveX - originX.current),
  }).panHandlers, [scrub]);

  // --- actions ------------------------------------------------------------
  async function download() {
    if (!audioUrl || downloading) return;
    setDownloading(true); setDownloadPct(0);
    try {
      const { method } = await saveAudioToDevice(audioUrl, { prompt: title || 'Tonefy audio' }, setDownloadPct);
      if (method === 'gallery') showAlert('Saved', 'The audio is on your phone.');
    } catch (e) {
      showAlert('Download failed', e?.message || 'Could not save this audio.');
    } finally { setDownloading(false); }
  }

  async function copyScript() {
    if (!script) return;
    await Clipboard.setStringAsync(script);
    showAlert('Copied', 'The script is on your clipboard.');
  }

  function addToVideo() {
    // Handed over as a voiceover track rather than dropped on the timeline as a
    // clip: it is narration with no picture, and the editor already knows how to
    // carry one.
    navigation.navigate('EditVideo', {
      useVoiceover: { uri: audioUrl, name: title ? `Voiceover: ${title.slice(0, 30)}` : 'Generated voiceover' },
    });
  }

  function editScript() {
    navigation.navigate('ScriptToAudio', { script, voiceId });
  }

  if (!audioUrl) {
    return (
      <View style={[styles.container, { backgroundColor: theme.bg, paddingTop: insets.top }]}>
        <View style={styles.empty}>
          <MaterialIcons name="graphic-eq" size={40} color={theme.border} />
          <Text style={[styles.subtitle, { color: theme.subtext }]}>No audio to show.</Text>
          <TouchableOpacity onPress={() => navigation.navigate('IdeaToAudio')}>
            <Text style={styles.copyAll}>CREATE ONE</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.bg, paddingTop: insets.top, paddingBottom: insets.bottom || 16 }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.bg} />

      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backRow}>
          <MaterialIcons name="arrow-back" size={20} color={theme.icon} />
        </TouchableOpacity>
        <Text style={styles.logo}>Tonefy AI</Text>
        <View style={{ width: 20 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={[styles.title, { color: theme.text }]}>Audio Result</Text>
        <Text style={[styles.subtitle, { color: theme.subtext }]} numberOfLines={2}>
          {title || 'Your track is ready.'}
        </Text>

        <View style={[styles.audioCard, { backgroundColor: theme.card, borderTopColor: theme.border }]}>
          <View style={styles.trackInfo}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.trackName, { color: theme.text }]} numberOfLines={1}>
                {voice ? `${voice.label} · ${voice.accent}` : 'Generated voice'}
              </Text>
              <View style={styles.trackMeta}>
                <View style={styles.aiBadge}><Text style={styles.aiBadgeText}>AI GENERATED</Text></View>
                <Text style={[styles.trackDuration, { color: theme.subtext }]}>{fmt(duration)}</Text>
              </View>
            </View>
          </View>

          {/* Bars are the real peaks once they arrive; before that a flat row, which
              is honestly "not measured yet" rather than a shape invented for it. */}
          <View style={styles.waveform}>
            {(peaks || Array(BARS).fill(0.18)).map((p, i) => (
              <View
                key={i}
                style={[
                  styles.waveBar,
                  {
                    height: Math.max(3, p * 72),
                    opacity: (i / BARS) <= progress ? 1 : 0.28,
                  },
                ]}
              />
            ))}
          </View>

          <View
            style={styles.scrubber}
            onLayout={(e) => { trackWidth.current = e.nativeEvent.layout.width; }}
            {...pan}
          >
            <View style={[styles.scrubberTrack, { backgroundColor: theme.border }]}>
              <View style={[styles.scrubberFill, { width: `${progress * 100}%` }]} />
            </View>
            <View style={[styles.scrubberThumb, { left: `${progress * 100}%` }]} />
          </View>

          <View style={styles.controls}>
            <Text style={[styles.timeLabel, { color: theme.subtext }]}>{fmt(position)}</Text>
            <View style={styles.playerBtns}>
              <TouchableOpacity onPress={() => seekTo(position - SKIP_MS)} disabled={!ready}>
                <MaterialIcons name="replay-10" size={28} color={ready ? theme.text : theme.border} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.playBtn} onPress={togglePlay} disabled={!ready}>
                {ready
                  ? <MaterialIcons name={playing ? 'pause' : 'play-arrow'} size={36} color="#003919" />
                  : <ActivityIndicator size="small" color="#003919" />}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => seekTo(position + SKIP_MS)} disabled={!ready}>
                <MaterialIcons name="forward-10" size={28} color={ready ? theme.text : theme.border} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.timeLabel, { color: theme.subtext }]}>{fmt(duration)}</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.addToVideoBtn} onPress={addToVideo}>
          <MaterialIcons name="movie" size={20} color="#005027" />
          <Text style={styles.addToVideoText}>Add to Video</Text>
        </TouchableOpacity>

        <View style={styles.actionGrid}>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: theme.card, borderColor: theme.border }]} onPress={editScript}>
            <MaterialIcons name="edit-note" size={22} color={theme.icon} />
            <Text style={[styles.actionLabel, { color: theme.subtext }]}>Edit Script</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: theme.card, borderColor: theme.border }]}
            onPress={download}
            disabled={downloading}
          >
            {/* Fills left-to-right like every other download in the app. */}
            {downloading && <View style={[styles.actionFill, { width: `${downloadPct}%` }]} />}
            <MaterialIcons name="download" size={22} color={downloading ? '#2ECC71' : theme.icon} />
            <Text style={[styles.actionLabel, { color: downloading ? '#2ECC71' : theme.subtext }]}>
              {downloading ? `${downloadPct}%` : 'Download'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: theme.card, borderColor: theme.border }]} onPress={copyScript}>
            <MaterialIcons name="content-copy" size={22} color={theme.icon} />
            <Text style={[styles.actionLabel, { color: theme.subtext }]}>Copy Script</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.transcriptHeader}>
          <Text style={[styles.transcriptTitle, { color: theme.text }]}>Script</Text>
          <TouchableOpacity onPress={copyScript}><Text style={styles.copyAll}>COPY ALL</Text></TouchableOpacity>
        </View>
        {/* One block, no timestamps. Per-line timings would need real word timing from
            whisper; printing plausible ones next to the text would be a fabrication. */}
        <View style={[styles.transcriptCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.transcriptText, { color: theme.text }]}>{script || 'No script available.'}</Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#131313' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  backRow: { width: 20 },
  logo: { fontSize: 20, fontWeight: '800', color: '#54e98a' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16 },
  title: { fontSize: 20, fontWeight: '700', color: '#e5e2e1', marginBottom: 4 },
  subtitle: { fontSize: 13, color: '#bbcbbb', marginBottom: 20 },
  audioCard: { backgroundColor: '#2a2a2a', borderRadius: 12, padding: 16, marginBottom: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' },
  trackInfo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  trackName: { fontSize: 16, fontWeight: '700', color: '#e5e2e1', marginBottom: 6 },
  trackMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  aiBadge: { backgroundColor: 'rgba(46,204,113,0.1)', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: 'rgba(46,204,113,0.2)' },
  aiBadgeText: { color: '#54e98a', fontSize: 9, fontWeight: '700' },
  trackDuration: { color: '#bbcbbb', fontSize: 11 },
  // Teal, not green: a waveform and a scrubber are how you handle the media, and the
  // one green thing on this screen should be Add to Video, which commits. (tonefy-design)
  waveform: { flexDirection: 'row', alignItems: 'center', gap: 2, height: 80, marginBottom: 12, overflow: 'hidden' },
  waveBar: { flex: 1, backgroundColor: '#00d4d4', borderRadius: 4 },
  scrubber: { marginBottom: 12, paddingVertical: 10, justifyContent: 'center' },
  scrubberTrack: { height: 4, backgroundColor: '#353534', borderRadius: 4 },
  scrubberFill: { height: '100%', backgroundColor: '#00d4d4', borderRadius: 4 },
  // top pins it to the middle of the 24pt row: 10pt padding + half the 4pt bar - half the thumb.
  scrubberThumb: { position: 'absolute', top: 5, width: 14, height: 14, borderRadius: 7, backgroundColor: '#00d4d4', marginLeft: -7 },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  timeLabel: { color: '#bbcbbb', fontSize: 11, fontWeight: '600', minWidth: 32 },
  playerBtns: { flexDirection: 'row', alignItems: 'center', gap: 24 },
  playBtn: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#54e98a', alignItems: 'center', justifyContent: 'center', shadowColor: '#2ecc71', shadowOpacity: 0.4, shadowRadius: 16 },
  addToVideoBtn: { backgroundColor: '#2ecc71', borderRadius: 12, height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 12 },
  addToVideoText: { color: '#005027', fontSize: 16, fontWeight: '700' },
  actionGrid: { flexDirection: 'row', gap: 8, marginBottom: 24 },
  actionBtn: { flex: 1, backgroundColor: '#2a2a2a', borderRadius: 12, paddingVertical: 16, alignItems: 'center', gap: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', overflow: 'hidden' },
  actionFill: { ...StyleSheet.absoluteFillObject, right: undefined, backgroundColor: 'rgba(46,204,113,0.18)' },
  actionLabel: { color: '#bbcbbb', fontSize: 11, fontWeight: '600' },
  transcriptHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  transcriptTitle: { fontSize: 16, fontWeight: '700', color: '#e5e2e1' },
  copyAll: { color: '#54e98a', fontSize: 11, fontWeight: '600', letterSpacing: 1 },
  transcriptCard: { backgroundColor: '#201f1f', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  transcriptText: { color: '#e5e2e1', fontSize: 14, lineHeight: 22 },
});
