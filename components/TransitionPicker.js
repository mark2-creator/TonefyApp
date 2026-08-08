import React, { useMemo, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, Modal,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { MaterialIcons } from '@expo/vector-icons';
import SheetHeader, { useSheetInset } from './SheetHeader';
import { TRANSITIONS, TRANSITION_GROUPS } from '../constants/transitions';

// One tile per transition, and every tile shows its OWN transition running.
//
// The previous picker animated two Unsplash images with a hand-written switch in which
// each case covered a whole group of ids - so a dozen transitions showed the identical
// clip, none of them showed what the export would do, and adding a transition meant
// writing another case. These previews are rendered by ffmpeg from the same recipe the
// export runs (scripts/gen-transition-previews.mjs), so a tile cannot be generic and
// cannot disagree with the result.

const COLS = 3;

function previewUri(backend, id) {
  return `${backend}/transitions/${id}.webp`;
}

const Tile = React.memo(function Tile({ item, selected, backend, locked, onPick }) {
  return (
    <TouchableOpacity
      style={styles.tile}
      onPress={() => onPick(item)}
      activeOpacity={0.85}>
      <View style={[styles.thumb, selected && styles.thumbSelected]}>
        {item.id === 'none' ? (
          <View style={styles.noneThumb}>
            <MaterialIcons name="content-cut" size={18} color="#888" />
          </View>
        ) : (
          <ExpoImage
            source={{ uri: previewUri(backend, item.id) }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            // The file is one short loop; letting it fade in makes the grid flicker as
            // it scrolls, since a tile remounts every time it re-enters the window.
            transition={0}
            cachePolicy="disk"
          />
        )}
        {/* The preview still plays at full strength behind this. Showing a locked
            transition doing its actual job is the argument for paying for it; a
            greyed-out thumbnail would just look broken. */}
        {locked && (
          <View style={styles.lockWash}>
            <MaterialIcons name="diamond" size={13} color="#f5c451" />
          </View>
        )}
      </View>
      <Text numberOfLines={1} style={[styles.label, selected && styles.labelSelected, locked && styles.labelLocked]}>
        {item.label}
      </Text>
    </TouchableOpacity>
  );
});

/**
 * The sheet on its own. `value` is the current transition id for the clip being edited.
 */
export function TransitionSheet({ visible, value, backend, isPremium = false, onSelect, onLocked, onClose }) {
  const sheetInset = useSheetInset(16);
  const [query, setQuery] = useState('');

  // Rows rather than numColumns: a group header has to span the full width, and
  // numColumns lays every item into a cell of the same size, headers included. Same
  // arrangement FontPicker settled on for the same reason.
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const chunk = (arr) => {
      const out = [];
      for (let i = 0; i < arr.length; i += COLS) out.push(arr.slice(i, i + COLS));
      return out;
    };
    if (q) {
      const hits = TRANSITIONS.filter(t => t.label.toLowerCase().includes(q) || t.id.includes(q));
      return chunk(hits).map((r, i) => ({ type: 'row', key: 'q' + i, items: r }));
    }
    const out = [];
    TRANSITION_GROUPS.forEach(group => {
      const items = TRANSITIONS.filter(t => t.group === group);
      if (!items.length) return;
      out.push({ type: 'header', key: 'h' + group, label: group });
      chunk(items).forEach((r, i) => out.push({ type: 'row', key: group + i, items: r }));
    });
    return out;
  }, [query]);

  const pick = (t) => {
    // A locked tile is not inert - it explains itself. Silently doing nothing is the
    // worst of the options, and swapping in a free transition behind the user's back
    // is worse still.
    if (t.premium && !isPremium) { onLocked?.(t); return; }
    onSelect(t.id);
  };

  const renderItem = ({ item }) => {
    if (item.type === 'header') {
      return <Text style={styles.groupHeader}>{item.label.toUpperCase()}</Text>;
    }
    return (
      <View style={styles.row}>
        {item.items.map(t => (
          <Tile key={t.id} item={t} backend={backend} selected={t.id === value}
            locked={t.premium && !isPremium} onPick={pick} />
        ))}
        {/* Keeps a short last row at column width instead of stretching its tiles. */}
        {item.items.length < COLS
          && Array.from({ length: COLS - item.items.length }, (_, i) => (
            <View key={'pad' + i} style={styles.tilePad} />
          ))}
      </View>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, sheetInset]}>
          <SheetHeader title={`Transition · ${TRANSITIONS.length}`} onClose={onClose} />
          <View style={styles.searchRow}>
            <MaterialIcons name="search" size={20} color="#888" />
            <TextInput
              style={styles.search}
              placeholder="Search transitions"
              placeholderTextColor="#555"
              value={query}
              onChangeText={setQuery}
              autoCorrect={false}
            />
            {query !== '' && (
              <TouchableOpacity onPress={() => setQuery('')}>
                <MaterialIcons name="close" size={20} color="#888" />
              </TouchableOpacity>
            )}
          </View>
          <FlatList
            data={rows}
            keyExtractor={r => r.key}
            renderItem={renderItem}
            initialNumToRender={6}
            windowSize={5}
            removeClippedSubviews
            showsVerticalScrollIndicator={false}
          />
        </View>
      </View>
    </Modal>
  );
}

export default TransitionSheet;

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#111', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 16, height: '82%',
  },
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#1a1a1a',
    borderRadius: 20, borderWidth: 1, borderColor: '#2a2a2a',
    paddingHorizontal: 14, paddingVertical: 8, marginBottom: 12,
  },
  search: { flex: 1, color: '#fff', fontSize: 13, padding: 0 },
  groupHeader: {
    color: '#888', fontSize: 11, fontWeight: '700', letterSpacing: 2,
    marginTop: 10, marginBottom: 8,
  },
  row: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  tile: { flex: 1 },
  tilePad: { flex: 1 },
  // The ring goes on the tile, not the thumb, so it surrounds the label too and a
  // selected transition stays legible while its own preview is mid-flash.
  tileSelected: { opacity: 1 },
  thumb: {
    width: '100%', aspectRatio: 16 / 9, borderRadius: 8, overflow: 'hidden',
    backgroundColor: '#1a1a1a', borderWidth: 1.5, borderColor: '#2a2a2a',
  },
  thumbSelected: { borderColor: '#2ECC71', borderWidth: 2 },
  noneThumb: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  lockWash: {
    position: 'absolute', top: 3, right: 3,
    backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: 9,
    paddingHorizontal: 3, paddingVertical: 3,
  },
  label: { color: '#cfcfcf', fontSize: 10, fontWeight: '600', textAlign: 'center', marginTop: 5 },
  labelSelected: { color: '#2ECC71' },
  labelLocked: { color: '#888' },
});
