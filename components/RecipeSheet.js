import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, FlatList, Modal, StyleSheet, Pressable,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import SheetHeader, { useSheetInset } from './SheetHeader';

// One sheet for the two catalogues that cannot be shown as a still picture.
//
// Each tile is an animated WebP rendered from the recipe itself, the same arrangement
// the transition picker uses - so a preview cannot disagree with the result. It
// replaced a MaterialIcon per CATEGORY, which meant every Glitch effect drew the same
// broken-image glyph and a grid of sixty-eight was nine distinct pictures.
//
// Motion and Effects share this because they are the same problem - a category strip,
// a grid of named tiles, a diamond and a lock. Two copies would drift the first time
// one of them got a fix.
//
// A FlatList, not a ScrollView, and that is load-bearing rather than tidy. Sixty-eight
// tiles is 3.5MB of animated WebP; rendering them all mounts every image at once and
// fetches the lot. Virtualised, a device pulls the dozen on screen. It is also what
// keeps the grid off Android's O(n^2) sibling draw path - the same reason the caption
// style picker is a FlatList.
const COLS = 3;

function Tile({ item, previewBase, version, selected, locked, onPick }) {
  return (
    <Pressable style={styles.tile} onPress={() => onPick(item)}>
      <View style={[styles.thumbWrap, selected && styles.thumbWrapActive]}>
        {item.chain ? (
          <ExpoImage
            source={{ uri: `${previewBase}/${encodeURIComponent(item.id)}.webp?v=${version}` }}
            style={styles.thumb}
            contentFit="cover"
            transition={0}
          />
        ) : (
          // "None" has no recipe and therefore nothing to render. A crossed-out icon
          // says that better than a still frame of untouched footage, which would look
          // like a tile that failed to load.
          <View style={[styles.thumb, styles.noneThumb]}>
            <MaterialIcons name="block" size={20} color="#5a5a5a" />
          </View>
        )}
        {/* Only when it is actually locked. A diamond on a plan that already includes
            the thing is not information, it is noise on every tile at once. */}
        {locked && (
          <View style={styles.lockPill}>
            <MaterialIcons name="diamond" size={11} color="#f5c451" />
          </View>
        )}
        {/* Measured, not guessed: these run 1.7-4.6x realtime, so a minute of footage
            is two to five minutes of rendering. Worth saying before the wait. */}
        {!!item.slow && <Text style={styles.slow}>SLOWER</Text>}
      </View>
      <Text
        style={[styles.label, selected && styles.labelActive, locked && styles.labelLocked]}
        numberOfLines={1}
      >
        {item.label}
      </Text>
    </Pressable>
  );
}

const MemoTile = React.memo(Tile);

export default function RecipeSheet({
  visible, title, items, categories, previewBase, version,
  value, isPremium, onSelect, onLocked, onClose,
}) {
  const sheetInset = useSheetInset(8);
  const [cat, setCat] = useState('All');
  const cats = useMemo(() => ['All', ...categories], [categories]);
  const shown = useMemo(
    () => (cat === 'All' ? items : items.filter(m => m.category === cat)),
    [cat, items]
  );

  const pick = useCallback((item) => {
    if (item.premium && !isPremium) { onLocked?.(item); return; }
    onSelect(item.id);
  }, [isPremium, onSelect, onLocked]);

  const renderItem = useCallback(({ item }) => (
    <MemoTile
      item={item}
      previewBase={previewBase}
      version={version}
      selected={value === item.id}
      locked={item.premium && !isPremium}
      onPick={pick}
    />
  ), [previewBase, version, value, isPremium, pick]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, sheetInset]}>
          <SheetHeader title={title} onClose={onClose} />

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.catRow}
            contentContainerStyle={styles.catRowContent}
          >
            {cats.map(c => (
              <TouchableOpacity
                key={c}
                style={[styles.catChip, cat === c && styles.catChipActive]}
                onPress={() => setCat(c)}
              >
                <Text style={[styles.catText, cat === c && styles.catTextActive]}>{c}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <FlatList
            data={shown}
            keyExtractor={i => i.id}
            renderItem={renderItem}
            numColumns={COLS}
            columnWrapperStyle={styles.row}
            contentContainerStyle={styles.grid}
            showsVerticalScrollIndicator={false}
            initialNumToRender={9}
            windowSize={5}
            removeClippedSubviews
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#111', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 16, paddingBottom: 24, maxHeight: '80%' },
  // paddingHorizontal on the CONTENT container, not on style: on a horizontal
  // ScrollView `style` is the clipping box, so padding there shrinks what you can see
  // rather than insetting what is in it. alignItems keeps the chips at their own height
  // instead of stretching to the row - the pair that clipped the My Videos chips
  // through the middle.
  // flexShrink: 0 as well as flexGrow: 0 - a FlatList of 128 tiles below will
  // otherwise compress this row toward nothing. Same omission that broke the music
  // filters and, before them, the My Videos chips.
  catRow: { flexGrow: 0, flexShrink: 0, marginBottom: 12 },
  catRowContent: { paddingHorizontal: 2, gap: 8, alignItems: 'center' },
  catChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2a2a2a' },
  // Teal: this switches which part of the catalogue you are looking at, it does not
  // choose a value. Green is for the tile that commits one.
  catChipActive: { backgroundColor: 'rgba(0,212,212,0.12)', borderColor: '#00d4d4' },
  catText: { color: '#888', fontSize: 11, fontWeight: '600' },
  catTextActive: { color: '#00d4d4' },
  grid: { paddingBottom: 12 },
  row: { gap: 8, marginBottom: 8 },
  tile: { flex: 1 / COLS, maxWidth: `${100 / COLS}%` },
  thumbWrap: { borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: '#2a2a2a', aspectRatio: 1.25, backgroundColor: '#1a1a1a' },
  thumb: { width: '100%', height: '100%' },
  noneThumb: { alignItems: 'center', justifyContent: 'center' },
  // Selection lives on the frame, not on the picture - a tint over the preview
  // would change the very thing the tile exists to show.
  thumbWrapActive: { borderColor: '#2ECC71', borderWidth: 2 },
  lockPill: { position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 8, paddingHorizontal: 3, paddingVertical: 2 },
  slow: { position: 'absolute', bottom: 3, left: 4, color: '#f5c451', fontSize: 7, fontWeight: '700', letterSpacing: 0.5, backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 3, borderRadius: 3 },
  label: { color: '#cfcfcf', fontSize: 10, fontWeight: '600', marginTop: 4, textAlign: 'center' },
  labelActive: { color: '#2ECC71' },
  labelLocked: { color: '#5a5a5a' },
});
