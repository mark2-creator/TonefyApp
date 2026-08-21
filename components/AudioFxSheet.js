import React, { useMemo, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, FlatList } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import SheetHeader, { useSheetInset } from './SheetHeader';
import { AUDIO_FX, AUDIO_FX_CATEGORIES } from '../constants/audioFx';

// One audio effect at a time, for a clip's own sound or for an audio track.
//
// Deliberately NOT RecipeSheet, which every other catalogue in the app uses. That sheet
// is built around an animated WebP preview tile per item, and there is no such thing as
// a picture of a reverb. Forcing these into it would give twenty-three identical grey
// squares - a grid that looks like it failed to load rather than one you can choose from.
// A list with the name and what it sounds like is the honest shape for this catalogue.
//
// FlatList rather than a ScrollView of rows: twenty-three is not many, but the sheet
// caps its own height and this file is the app's fifth list of catalogue items - the
// virtualising one is the habit worth keeping. (Not the O(n^2) sibling problem from
// CLAUDE.md either way, which needs hundreds of children in one parent.)
function Row({ item, active, locked, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.row, active && styles.rowOn]}
      onPress={() => onPress(item)}
      activeOpacity={0.8}>
      <View style={styles.rowText}>
        <View style={styles.labelLine}>
          <Text style={[styles.label, active && styles.labelOn]} numberOfLines={1}>{item.label}</Text>
          {locked ? <MaterialIcons name="diamond" size={12} color="#f5c451" /> : null}
        </View>
        <Text style={styles.desc} numberOfLines={2}>{item.desc}</Text>
      </View>
      {active ? <MaterialIcons name="check" size={20} color="#2ECC71" /> : null}
    </TouchableOpacity>
  );
}
const MemoRow = React.memo(Row);

export default function AudioFxSheet({ visible, title, value, isPremium, onSelect, onLocked, onClose }) {
  const sheetInset = useSheetInset(16);
  const [cat, setCat] = useState('All');
  const cats = useMemo(() => ['All', ...AUDIO_FX_CATEGORIES], []);
  const shown = useMemo(
    () => (cat === 'All' ? AUDIO_FX : AUDIO_FX.filter(f => f.category === cat)),
    [cat]
  );

  // Every audio effect is premium, so `locked` is purely about the viewer's plan. The
  // diamond appears only when it would actually stop them - a badge on a plan that
  // already includes it is noise telling a paying user what they cannot have.
  const pick = useCallback((item) => {
    if (!isPremium) { onLocked?.(item); return; }
    onSelect(item.id === value ? null : item.id);
  }, [isPremium, onSelect, onLocked, value]);

  const renderItem = useCallback(({ item }) => (
    <MemoRow item={item} active={item.id === value} locked={!isPremium} onPress={pick} />
  ), [value, isPremium, pick]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, sheetInset]}>
          <SheetHeader title={title || 'Audio effects'} onClose={onClose} />

          <Text style={styles.blurb}>
            Applied when you export. The preview above plays your original sound.
          </Text>

          {/* Category pills switch which view you are looking at, so teal - the same
              rule that makes the voice pill green and the music/voiceover tabs teal. */}
          <View style={styles.pills}>
            {cats.map(c => (
              <TouchableOpacity
                key={c}
                style={[styles.pill, cat === c && styles.pillOn]}
                onPress={() => setCat(c)}>
                <Text style={[styles.pillText, cat === c && styles.pillTextOn]}>{c}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.none, !value && styles.noneOn]}
            onPress={() => onSelect(null)}>
            <Text style={[styles.noneText, !value && styles.noneTextOn]}>No effect</Text>
          </TouchableOpacity>

          <FlatList
            data={shown}
            keyExtractor={f => f.id}
            renderItem={renderItem}
            style={styles.list}
            contentContainerStyle={{ paddingBottom: 8 }}
            showsVerticalScrollIndicator={false}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#111', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, maxHeight: '80%' },
  blurb: { color: '#888', fontSize: 12, lineHeight: 17, marginBottom: 14 },
  // flexShrink: 0 so a long list cannot compress the controls above it - the same
  // defect that clipped the My Videos filter row, and the music filter row after it.
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12, flexShrink: 0 },
  pill: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2a2a2a' },
  pillOn: { backgroundColor: '#00d4d4', borderColor: '#00d4d4' },
  pillText: { color: '#cfcfcf', fontSize: 12, fontWeight: '600' },
  pillTextOn: { color: '#000' },
  none: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2a2a2a', marginBottom: 10, flexShrink: 0 },
  noneOn: { backgroundColor: '#2ECC71', borderColor: '#2ECC71' },
  noneText: { color: '#cfcfcf', fontSize: 13, fontWeight: '600' },
  noneTextOn: { color: '#000' },
  list: { flexGrow: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingHorizontal: 14, borderRadius: 12, backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2a2a2a', marginBottom: 8 },
  rowOn: { borderColor: '#2ECC71' },
  rowText: { flex: 1 },
  labelLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: { color: '#fff', fontSize: 14, fontWeight: '700' },
  labelOn: { color: '#2ECC71' },
  desc: { color: '#888', fontSize: 11, lineHeight: 15, marginTop: 2 },
});
