import React, { useMemo, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, Modal,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { MaterialIcons } from '@expo/vector-icons';
import SheetHeader, { useSheetInset } from './SheetHeader';
import { STICKERS, STICKER_CATEGORIES } from '../constants/stickers';
import { STICKER_VERSION } from '../constants/stickerVersion';

const COLS = 5;

export function stickerUri(backend, id) {
  return `${backend}/stickers/${id}.png?v=${STICKER_VERSION}`;
}

const Tile = React.memo(function Tile({ item, backend, locked, onPick }) {
  return (
    <TouchableOpacity style={styles.tile} onPress={() => onPick(item)} activeOpacity={0.8}>
      <View style={styles.thumb}>
        <ExpoImage
          source={{ uri: stickerUri(backend, item.id) }}
          style={styles.img}
          contentFit="contain"
          transition={0}
          cachePolicy="disk"
        />
        {locked && (
          <View style={styles.lock}>
            <MaterialIcons name="diamond" size={10} color="#f5c451" />
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
});

export default function StickerSheet({
  visible, backend, isPremium = false, onSelect, onLocked, onClose,
}) {
  const sheetInset = useSheetInset(16);
  const [query, setQuery] = useState('');

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const chunk = (arr) => {
      const out = [];
      for (let i = 0; i < arr.length; i += COLS) out.push(arr.slice(i, i + COLS));
      return out;
    };
    if (q) {
      const hits = STICKERS.filter(s => s.label.toLowerCase().includes(q) || s.id.includes(q));
      return chunk(hits).map((r, i) => ({ type: 'row', key: 'q' + i, items: r }));
    }
    const out = [];
    STICKER_CATEGORIES.forEach(cat => {
      const items = STICKERS.filter(s => s.category === cat);
      if (!items.length) return;
      out.push({ type: 'header', key: 'h' + cat, label: cat });
      chunk(items).forEach((r, i) => out.push({ type: 'row', key: cat + i, items: r }));
    });
    return out;
  }, [query]);

  const pick = (s) => {
    if (s.premium && !isPremium) { onLocked?.(s); return; }
    onSelect(s);
  };

  const renderItem = ({ item }) => {
    if (item.type === 'header') {
      return <Text style={styles.groupHeader}>{item.label.toUpperCase()}</Text>;
    }
    return (
      <View style={styles.row}>
        {item.items.map(s => (
          <Tile key={s.id} item={s} backend={backend}
            locked={s.premium && !isPremium} onPick={pick} />
        ))}
        {item.items.length < COLS && Array.from({ length: COLS - item.items.length }, (_, i) => (
          <View key={'p' + i} style={styles.tile} />
        ))}
      </View>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, sheetInset]}>
          <SheetHeader title={`Stickers · ${STICKERS.length}`} onClose={onClose} />
          <View style={styles.searchRow}>
            <MaterialIcons name="search" size={20} color="#888" />
            <TextInput
              style={styles.search}
              placeholder="Search stickers"
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
            initialNumToRender={8}
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
    padding: 16, height: '76%',
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
  thumb: {
    width: '100%', aspectRatio: 1, borderRadius: 10, backgroundColor: '#1a1a1a',
    alignItems: 'center', justifyContent: 'center', padding: 6,
  },
  img: { width: '100%', height: '100%' },
  lock: {
    position: 'absolute', top: 3, right: 3,
    backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 8, padding: 2,
  },
});
