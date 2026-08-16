import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, Modal, TouchableOpacity, FlatList, TextInput, StyleSheet, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { auth } from '../firebase';
import { useTheme } from '../context/ThemeContext';
import SheetHeader, { useSheetInset } from './SheetHeader';
import { showAlert } from './BrandedAlert';
import { VOICES } from '../constants/voices';
import { usePlan } from '../constants/plan';
import VoiceAvatar from './VoiceAvatar';

const BACKEND = 'https://api.fitlifesolutions.site';
const PREVIEW_LINE = 'Hi, this is a quick preview of my voice.';
const COLS = 3;

// Choosing from 325 voices across 75 languages, with the voice audible before you
// commit to it.
//
// The generation screens used the generic OptionModal for this - a list of rows with the
// same mic icon on every one, and no way to hear anything. Picking a voice by reading
// "US Female 2" is guessing.
//
// Grouped and searchable rather than one flat list, for the same reason the font picker
// is: 325 rows is not a list anyone reads, and the thing people actually want is
// "Swahili" or "male" or a name. English is pinned to the top because it is what almost
// every project uses; the rest follow alphabetically.
export default function VoicePicker({ visible, selectedId, onSelect, onClose }) {
  const { theme } = useTheme();
  const sheetInset = useSheetInset();
  const { isPremium } = usePlan();
  const [sound, setSound] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [playingId, setPlayingId] = useState(null);
  const [query, setQuery] = useState('');

  // A preview outlives the sheet otherwise: closing mid-playback left a voice talking
  // over the editor with nothing on screen to stop it.
  useEffect(() => { if (!visible) stop(); }, [visible]);
  useEffect(() => () => { if (sound) sound.unloadAsync().catch(() => {}); }, [sound]);

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
      // A 403 here is the plan gate, and its message names the plan - shown as written
      // rather than replaced with something vaguer.
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

  // A grid, built by chunking each group into rows of COLS and making each ROW one
  // FlatList item. numColumns cannot do this: it lays every item into a cell, language
  // headers included, so headers end up sharing a row with voices. The font picker
  // solved the same problem the same way.
  //
  // One flat list rather than a SectionList so a search can collapse to plain results
  // with no empty headings left behind.
  const rows = useMemo(() => {
    const chunk = (arr) => {
      const out = [];
      for (let i = 0; i < arr.length; i += COLS) out.push(arr.slice(i, i + COLS));
      return out;
    };
    const q = query.trim().toLowerCase();
    const match = v => !q || [v.label, v.accent, v.langName, v.country, v.gender]
      .some(f => String(f || '').toLowerCase().includes(q));
    const hits = VOICES.filter(match);
    if (q) return chunk(hits).map(cells => ({ type: 'row', cells }));

    const byLang = new Map();
    for (const v of hits) {
      if (!byLang.has(v.langName)) byLang.set(v.langName, []);
      byLang.get(v.langName).push(v);
    }
    const names = [...byLang.keys()].sort((a, b) =>
      a === 'English' ? -1 : b === 'English' ? 1 : a.localeCompare(b));
    const out = [];
    for (const name of names) {
      out.push({ type: 'header', name, count: byLang.get(name).length });
      for (const cells of chunk(byLang.get(name))) out.push({ type: 'row', cells });
    }
    return out;
  }, [query]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: theme.settingBg || '#111' }, sheetInset]}>
          <SheetHeader title="Choose Voice" onClose={onClose} titleColor={theme.text} closeColor={theme.icon} />
          <View style={[styles.search, { backgroundColor: theme.inputBg || '#1a1a1a', borderColor: theme.inputBorder || '#2a2a2a' }]}>
            <MaterialIcons name="search" size={18} color={theme.subtext} />
            <TextInput
              style={[styles.searchInput, { color: theme.text }]}
              placeholder="Search name, language or accent"
              placeholderTextColor={theme.subtext}
              value={query}
              onChangeText={setQuery}
            />
            {!!query && (
              <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <MaterialIcons name="close" size={18} color={theme.subtext} />
              </TouchableOpacity>
            )}
          </View>

          <FlatList
            data={rows}
            keyExtractor={(r, i) => (r.type === 'header' ? 'h' + r.name : 'r' + r.cells[0].id) + i}
            initialNumToRender={8}
            windowSize={9}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={<Text style={[styles.empty, { color: theme.subtext }]}>No voices match that.</Text>}
            renderItem={({ item }) => {
              if (item.type === 'header') {
                return (
                  <Text style={[styles.header, { color: theme.subtext }]}>
                    {item.name} · {item.count}
                  </Text>
                );
              }
              return (
                <View style={styles.gridRow}>
                  {item.cells.map(v => {
                    const active = selectedId === v.id;
                    const locked = !v.free && !isPremium;
                    return (
                      <TouchableOpacity
                        key={v.id}
                        style={[styles.cell, { borderColor: theme.border }, active && styles.cellActive]}
                        onPress={() => {
                          if (locked) {
                            return showAlert(v.label, 'This voice is available on the Pro and Creator plans.');
                          }
                          onSelect(v.id);
                          onClose();
                        }}
                      >
                        <VoiceAvatar voice={v} size={56} selected={active} busy={busyId === v.id} playing={playingId === v.id} locked={locked} />
                        <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>{v.label}</Text>
                        <Text style={[styles.accent, { color: theme.subtext }]} numberOfLines={1}>{v.accent}</Text>
                        {/* Preview stays available on a locked voice on purpose -
                            hearing what an upgrade buys is the point of showing it. */}
                        <TouchableOpacity
                          onPress={() => preview(v)}
                          disabled={!!busyId}
                          hitSlop={{ top: 10, bottom: 10, left: 16, right: 16 }}
                          style={styles.playBtn}
                        >
                          {busyId === v.id
                            ? <ActivityIndicator size="small" color="#2ECC71" />
                            : <MaterialIcons name={playingId === v.id ? 'stop-circle' : 'play-circle-outline'} size={22} color="#2ECC71" />}
                        </TouchableOpacity>
                      </TouchableOpacity>
                    );
                  })}
                  {/* Keeps the last row's cells at column width instead of stretching
                      them across the gap - the same fix the font grid needed. */}
                  {item.cells.length < COLS &&
                    Array.from({ length: COLS - item.cells.length }, (_, i) => (
                      <View key={'sp' + i} style={styles.cellSpacer} />
                    ))}
                </View>
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
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, height: '85%' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 12 },
  searchInput: { flex: 1, fontSize: 14, padding: 0 },
  header: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', marginTop: 14, marginBottom: 6 },
  gridRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  cell: { flex: 1, alignItems: 'center', paddingVertical: 12, paddingHorizontal: 6, borderRadius: 14, borderWidth: 1 },
  cellActive: { borderColor: '#2ECC71' },
  cellSpacer: { flex: 1 },
  name: { fontSize: 13, fontWeight: '700', marginTop: 8 },
  accent: { fontSize: 10, marginTop: 2 },
  playBtn: { marginTop: 6 },
  empty: { textAlign: 'center', marginTop: 30, fontSize: 13 },
});
