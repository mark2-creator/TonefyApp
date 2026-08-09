import React, { useMemo, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, Modal,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { MaterialIcons } from '@expo/vector-icons';
import SheetHeader, { useSheetInset } from './SheetHeader';
import { FILTERS, FILTER_CATEGORIES } from '../constants/filters';
import { FILTER_PREVIEW_VERSION } from '../constants/filterPreviewVersion';

// A tile per filter, each showing the grade applied to the SAME photograph.
//
// One photo for every tile on purpose: a filter is a difference, and comparing grades
// means holding the subject still. A grid where each tile has a different picture
// shows the pictures. The tiles are ffmpeg renders of the real chain, so what is on
// the tile is what the export produces.

const COLS = 3;

const Tile = React.memo(function Tile({ item, selected, backend, locked, onPick }) {
  return (
    <TouchableOpacity style={styles.tile} onPress={() => onPick(item)} activeOpacity={0.85}>
      <View style={[styles.thumb, selected && styles.thumbSelected]}>
        <ExpoImage
          source={{ uri: `${backend}/filters/${encodeURIComponent(item.id)}.webp?v=${FILTER_PREVIEW_VERSION}` }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={0}
          cachePolicy="disk"
        />
        {locked && (
          <View style={styles.lockWash}>
            <MaterialIcons name="diamond" size={12} color="#f5c451" />
          </View>
        )}
        {selected && (
          <View style={styles.tick}>
            <MaterialIcons name="check" size={13} color="#04211f" />
          </View>
        )}
      </View>
      <Text numberOfLines={1} style={[styles.label, selected && styles.labelSelected]}>
        {item.label}
      </Text>
    </TouchableOpacity>
  );
});

export default function FilterSheet({
  visible, value, backend, isPremium = false, onSelect, onLocked, onClose,
}) {
  const sheetInset = useSheetInset(16);
  const [query, setQuery] = useState('');

  // Rows rather than numColumns: a category header spans the full width, and
  // numColumns lays every item into an identical cell, headers included.
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const chunk = (arr) => {
      const out = [];
      for (let i = 0; i < arr.length; i += COLS) out.push(arr.slice(i, i + COLS));
      return out;
    };
    if (q) {
      const hits = FILTERS.filter(f => f.label.toLowerCase().includes(q) || f.id.toLowerCase().includes(q));
      return chunk(hits).map((r, i) => ({ type: 'row', key: 'q' + i, items: r }));
    }
    const out = [];
    FILTER_CATEGORIES.forEach(cat => {
      const items = FILTERS.filter(f => f.category === cat);
      if (!items.length) return;
      out.push({ type: 'header', key: 'h' + cat, label: cat });
      chunk(items).forEach((r, i) => out.push({ type: 'row', key: cat + i, items: r }));
    });
    return out;
  }, [query]);

  const pick = (f) => {
    if (f.premium && !isPremium) { onLocked?.(f); return; }
    onSelect(f.id);
  };

  const renderItem = ({ item }) => {
    if (item.type === 'header') {
      return <Text style={styles.groupHeader}>{item.label.toUpperCase()}</Text>;
    }
    return (
      <View style={styles.row}>
        {item.items.map(f => (
          <Tile key={f.id} item={f} backend={backend} selected={f.id === value}
            locked={f.premium && !isPremium} onPick={pick} />
        ))}
        {item.items.length < COLS && Array.from({ length: COLS - item.items.length }, (_, i) => (
          <View key={'pad' + i} style={styles.tile} />
        ))}
      </View>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, sheetInset]}>
          <SheetHeader title={`Filters · ${FILTERS.length}`} onClose={onClose} />
          <View style={styles.searchRow}>
            <MaterialIcons name="search" size={20} color="#888" />
            <TextInput
              style={styles.search}
              placeholder="Search filters"
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
  row: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  tile: { flex: 1 },
  thumb: {
    width: '100%', aspectRatio: 3 / 4, borderRadius: 10, overflow: 'hidden',
    backgroundColor: '#1a1a1a', borderWidth: 2, borderColor: 'transparent',
  },
  // Green: choosing a filter commits a change to the clip.
  thumbSelected: { borderColor: '#2ECC71' },
  lockWash: {
    position: 'absolute', top: 4, right: 4,
    backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: 9, padding: 3,
  },
  tick: {
    position: 'absolute', bottom: 4, right: 4, backgroundColor: '#2ECC71',
    borderRadius: 9, padding: 2,
  },
  label: { color: '#cfcfcf', fontSize: 10, fontWeight: '600', textAlign: 'center', marginTop: 4 },
  labelSelected: { color: '#2ECC71' },
});
