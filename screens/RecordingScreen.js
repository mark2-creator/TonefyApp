import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar, ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { showAlert } from '../components/BrandedAlert';

// A real camera, replacing a screen that had none.
//
// This used to draw a grey rectangle, animate forty random bars, count a timer that was
// just a setInterval, and hand PostRecording nothing at all - so "Record" produced no
// file and the screen after it had no video to show. Every control here except Close
// was decoration.
//
// expo-camera is required lazily inside a try, and every entry point copes with it being
// absent, per the rule in CLAUDE.md: a native module cannot ship over the air, and a
// top-level import of one that is not in the installed binary takes the app down at
// launch rather than degrading. It has been in package.json since e81870f0 and its own
// AndroidManifest merges CAMERA and RECORD_AUDIO in - which is why no permission had to
// be hand-added to a manifest no config plugin ever touches - but "should be there" is
// not a reason to import it eagerly.
function getCamera() {
  try {
    return require('expo-camera');
  } catch (e) {
    return null;
  }
}

// A ceiling regardless of what was asked for: 15 minutes at 1080p is already about
// 1.5GB, and a recording left running should not fill the phone.
const HARD_MAX_SECONDS = 15 * 60;

export default function RecordingScreen({ navigation, route }) {
  // Chosen on the setup screen before this one. They were seven pieces of state there
  // that nothing read; the length is enforced here and the look travels through to the
  // screen that can apply it.
  const {
    maxSeconds = 15 * 60,
    quality = '1080p',
    filter = 'None',
    effect = 'none',
  } = route?.params || {};
  const insets = useSafeAreaInsets();
  const Cam = useRef(getCamera()).current;
  const cameraRef = useRef(null);

  const [ready, setReady] = useState(false);
  const [granted, setGranted] = useState(null);   // null = still asking
  const [facing, setFacing] = useState('back');
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  // The length is read AFTER the await below, and an await keeps the closure it started
  // with - where seconds is 0, because setSeconds(0) is the first line of start(). The
  // state is for drawing the timer; this ref is for reading it later.
  const secondsRef = useRef(0);
  secondsRef.current = seconds;
  // The recording promise has to be resolvable from stop(), which is a different call.
  const stoppingRef = useRef(false);

  useEffect(() => {
    if (!Cam) { setGranted(false); return; }
    (async () => {
      try {
        const cam = await Cam.Camera.requestCameraPermissionsAsync();
        const mic = await Cam.Camera.requestMicrophonePermissionsAsync();
        setGranted(!!cam?.granted && !!mic?.granted);
      } catch (e) {
        setGranted(false);
      }
    })();
  }, [Cam]);

  // The timer counts only while the camera is actually recording, rather than from the
  // moment the screen opened - the old one started on mount and never stopped.
  useEffect(() => {
    if (!recording) return undefined;
    const t = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [recording]);

  const stop = useCallback(() => {
    if (!recording || stoppingRef.current) return;
    stoppingRef.current = true;
    try { cameraRef.current?.stopRecording(); } catch (e) {}
  }, [recording]);

  // A cap, so a recording left running does not fill the phone. 15 minutes at 1080p is
  // already about 1.5GB.
  const limit = Math.min(HARD_MAX_SECONDS, Math.max(5, Number(maxSeconds) || HARD_MAX_SECONDS));
  useEffect(() => {
    if (recording && seconds >= limit) stop();
  }, [recording, seconds, stop, limit]);

  const start = useCallback(async () => {
    if (!cameraRef.current || recording) return;
    setSeconds(0);
    setRecording(true);
    stoppingRef.current = false;
    try {
      // Resolves when stopRecording() is called, not when this returns.
      const video = await cameraRef.current.recordAsync();
      setRecording(false);
      stoppingRef.current = false;
      if (video?.uri) {
        navigation.replace('PostRecording', { uri: video.uri, seconds: secondsRef.current, quality, filter, effect });
      }
    } catch (e) {
      setRecording(false);
      stoppingRef.current = false;
      showAlert('Recording', e?.message || 'The recording could not be saved.');
    }
  }, [recording, navigation, quality, filter, effect]);

  const mins = String(Math.floor(seconds / 60)).padStart(2, '0');
  const secs = String(seconds % 60).padStart(2, '0');

  if (!Cam || granted === false) {
    return (
      <View style={[styles.container, styles.centerAll, { paddingTop: insets.top }]}>
        <StatusBar barStyle="light-content" backgroundColor="#0a0a0a" />
        <MaterialIcons name="videocam-off" size={40} color="#5a5a5a" />
        <Text style={styles.blockedTitle}>
          {Cam ? 'Camera access is off' : 'Recording needs a newer build'}
        </Text>
        <Text style={styles.blockedBody}>
          {Cam
            ? 'Allow camera and microphone access in Settings to record.'
            : 'This version of the app was built without the camera. Update from the Play Store.'}
        </Text>
        <TouchableOpacity style={styles.blockedBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.blockedBtnText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { CameraView } = Cam;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a0a" translucent />

      {granted === null ? (
        <View style={[styles.centerAll, StyleSheet.absoluteFill]}>
          <ActivityIndicator color="#2ecc71" />
        </View>
      ) : (
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing={facing}
          // Video, not photo: recordAsync is unavailable in the default picture mode.
          mode="video"
          onCameraReady={() => setReady(true)}
        />
      )}

      <View style={styles.header}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => (recording ? stop() : navigation.goBack())}>
          <MaterialIcons name="close" size={24} color="#fff" />
        </TouchableOpacity>
        {recording && (
          <View style={styles.timerBox}>
            <View style={styles.redDot} />
            <Text style={styles.timer}>{mins}:{secs}</Text>
            {limit < HARD_MAX_SECONDS && (
              <Text style={styles.limitText}>
                / {String(Math.floor(limit / 60)).padStart(2, '0')}:{String(limit % 60).padStart(2, '0')}
              </Text>
            )}
          </View>
        )}
        <View style={{ width: 44 }} />
      </View>

      <View style={[styles.bottom, { paddingBottom: insets.bottom || 20 }]}>
        <View style={styles.controls}>
          <View style={styles.controlItem}>
            {/* Flipping mid-recording restarts the encoder on most devices, so it is
                only offered between takes. */}
            <TouchableOpacity
              style={[styles.controlBtn, recording && styles.controlBtnOff]}
              disabled={recording}
              onPress={() => setFacing(f => (f === 'back' ? 'front' : 'back'))}>
              <MaterialIcons name="flip-camera-ios" size={28} color={recording ? '#5a5a5a' : '#e5e2e1'} />
            </TouchableOpacity>
            <Text style={styles.controlLabel}>Flip</Text>
          </View>

          <View style={styles.controlItem}>
            <TouchableOpacity
              style={[styles.recordBtn, recording && styles.recordBtnOn]}
              disabled={!ready}
              onPress={() => (recording ? stop() : start())}>
              <MaterialIcons name={recording ? 'stop' : 'fiber-manual-record'} size={recording ? 34 : 44}
                color={recording ? '#fff' : '#ff4444'} />
            </TouchableOpacity>
            <Text style={[styles.controlLabel, recording && { color: '#ff4444' }]}>
              {recording ? 'Stop' : ready ? 'Record' : 'Starting…'}
            </Text>
          </View>

          <View style={styles.controlItem}>
            <View style={styles.controlBtnGhost} />
            <Text style={[styles.controlLabel, { opacity: 0 }]}>.</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  centerAll: { alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8 },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  timerBox: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  redDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#ff4444' },
  timer: { color: '#fff', fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },
  limitText: { color: '#fff', opacity: 0.6, fontSize: 12, fontWeight: '600', fontVariant: ['tabular-nums'] },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: 16, backgroundColor: 'rgba(0,0,0,0.35)' },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  controlItem: { alignItems: 'center', gap: 6 },
  controlBtn: { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  controlBtnOff: { backgroundColor: 'rgba(255,255,255,0.05)' },
  controlBtnGhost: { width: 52, height: 52 },
  controlLabel: { color: '#fff', fontSize: 11, fontWeight: '600' },
  recordBtn: { width: 76, height: 76, borderRadius: 38, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 4, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  recordBtnOn: { backgroundColor: '#ff4444', borderColor: '#fff' },
  blockedTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginTop: 6 },
  blockedBody: { color: '#fff', opacity: 0.7, fontSize: 13, textAlign: 'center', lineHeight: 19 },
  blockedBtn: { marginTop: 14, paddingHorizontal: 22, paddingVertical: 11, borderRadius: 999, backgroundColor: '#2ecc71' },
  blockedBtnText: { color: '#04211f', fontWeight: '700' },
});
