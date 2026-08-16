import React, { useState, useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { auth } from '../firebase';
import { useTheme } from '../context/ThemeContext';
import SheetHeader, { useSheetInset } from './SheetHeader';
import { showAlert } from './BrandedAlert';
import { VOICES } from '../constants/voices';
import VoiceAvatar from './VoiceAvatar';

const BACKEND = 'https://api.fitlifesolutions.site';
const PREVIEW_LINE = 'Hi, this is a quick preview of my voice.';

// Choosing a voice, with the voice audible before you commit to it.
//
// The generation screens used the generic OptionModal for this - a list of rows with the
// same mic icon on every one, and no way to hear anything. Picking a voice by reading
// "US Female 2" is guessing.
//
// Self-contained rather than taking a preview callback: apiFetch lives inside
// EditVideoScreen, so a callback-based version would have every screen reimplementing
// the same fetch-and-play. This owns it once.
export default function VoicePicker({ visible, selectedId, onSelect, onClose }) {
  const { theme } = useTheme();
  const sheetInset = useSheetInset();
  const [sound, setSound] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [playingId, setPlayingId] = useState(null);

  // A preview outlives the sheet otherwise: closing mid-playback left a voice talking
  // over the editor with nothing left on screen to stop it.
  useEffect(() => {
    if (!visible && sound) { stop(); }
  }, [visible]);
  useEffect(() => () => { if (sound) { sound.unloadAsync().catch(() => {}); } }, [sound]);

  async function stop() {
    try { await sound?.stopAsync(); await sound?.unloadAsync(); } catch (e) {}
    setSound(null);
    setPlayingId(null);
  }

  async function preview(voice) {
    if (busyId) return;
    if (playingId === voice.id) return stop();
    await stop();
    setBusyId(voice.id);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`${BACKEND}/api/generate-audio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ text: PREVIEW_LINE, voiceId: voice.id }),
      });
      const data = await res.json().catch(() => ({}));
      // 403 here is the plan gate, and its message names the plan - worth showing as
      // written rather than replacing with something vaguer.
      if (!res.ok || data.error) throw new Error(data.error || 'Could not play that voice.');
      const { sound: snd } = await Audio.Sound.createAsync({ uri: BACKEND + data.audioUrl }, { shouldPlay: true });
      setSound(snd);
      setPlayingId(voice.id);
      snd.setOnPlaybackStatusUpdate(st => { if (st.didJustFinish) setPlayingId(null); });
    } catch (e) {
      showAlert('Preview', e.message || 'Could not play that voice.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: theme.settingBg || '#111' }, sheetInset]}>
          <SheetHeader title="Choose Voice" onClose={onClose} titleColor={theme.text} closeColor={theme.icon} />
          <Text style={[styles.hint, { color: theme.subtext }]}>Tap play to hear a voice before you pick it.</Text>
          <FlatList
            data={VOICES}
            keyExtractor={v => v.id}
            renderItem={({ item: v }) => {
              const active = selectedId === v.id;
              return (
                <TouchableOpacity
                  style={[styles.row, { borderColor: theme.border }, active && styles.rowActive]}
                  onPress={() => { onSelect(v.id); onClose(); }}
                >
                  <VoiceAvatar voice={v} size={40} selected={active} busy={busyId === v.id} playing={playingId === v.id} />
                  <View style={styles.rowText}>
                    <Text style={[styles.name, { color: theme.text }]}>{v.label}</Text>
                    <Text style={[styles.accent, { color: theme.subtext }]}>{v.accent}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => preview(v)}
                    disabled={!!busyId}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    style={styles.playBtn}
                  >
                    {busyId === v.id
                      ? <ActivityIndicator size="small" color="#2ECC71" />
                      : <MaterialIcons name={playingId === v.id ? 'stop-circle' : 'play-circle-outline'} size={26} color="#2ECC71" />}
                  </TouchableOpacity>
                  {active && <MaterialIcons name="check" size={20} color="#2ECC71" style={styles.check} />}
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '80%' },
  hint: { fontSize: 12, marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 12, borderRadius: 14, borderWidth: 1, marginBottom: 8, gap: 12 },
  rowActive: { borderColor: '#2ECC71' },
  rowText: { flex: 1 },
  name: { fontSize: 15, fontWeight: '700' },
  accent: { fontSize: 12, marginTop: 2 },
  playBtn: { paddingHorizontal: 4 },
  check: { marginLeft: 4 },
});
