import React, { useMemo, useState, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, Modal, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import SheetHeader from './SheetHeader';
import { FONT_GROUPS, FONT_NAMES, fontFamilyFor } from '../constants/fonts';
import { useAppFonts } from '../constants/fontLoader';

export const DEFAULT_FONT = 'Default';

// A row of chips worked for four fonts and does not for a hundred and thirty, so
// the list moved into its own sheet: grouped, searchable, and previewing each
// family in itself.
//
// The families are laid out as a grid of specimen tiles rather than one full-width
// row each. Picking a typeface is a comparison, and a grid puts nine of them in
// the space a list gives three - the eye can sweep them together instead of
// scrolling one past another and holding the last one in memory. Each tile sets
// the same specimen in the family, rather than the family's own name: a name set
// in itself varies in length, so no two tiles are comparable, and a display face
// like Press Start 2P is chosen for its shape rather than its legibility. The name
// sits beneath in the system face, where it stays readable.
const COLUMNS = 3;

// A whole word, not a letter pair - the shape of a typeface is in its rhythm, and
// two glyphs show none of it. "Quick" is short enough to sit in a 3-column tile
// while still carrying an ascender (k), a descender (Q's tail), a dot (i), a round
// (u, c) and both cases. The width across 130 families is not uniform, though -
// Press Start 2P is near-monospaced and roughly twice the width of Inter at the
// same size - so the specimen shrinks to fit rather than truncating, which would
// hide the very letters that distinguish one face from another.
const SPECIMEN = 'Quick';

const FontTile = React.memo(function FontTile({ name, selected, ready, onPress }) {
  const family = ready ? fontFamilyFor(name) : undefined;
  return (
    <TouchableOpacity
      style={[styles.tile, selected && styles.tileSelected]}
      onPress={() => onPress(name)}
      accessibilityRole="button"
      accessibilityLabel={name}
      accessibilityState={{ selected }}
    >
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.6}
        style={[styles.tileSample, family ? { fontFamily: family } : null]}
      >
        {SPECIMEN}
      </Text>
      <Text numberOfLines={2} style={[styles.tileName, selected && styles.tileNameSelected]}>
        {name}
      </Text>
      {selected && (
        <View style={styles.tileCheck}>
          <MaterialIcons name="check" size={12} color="#0b0b0b" />
        </View>
      )}
    </TouchableOpacity>
  );
});

// A grid row is one FlatList item, so headers keep a row to themselves and
// virtualisation still measures something uniform. numColumns cannot do this -
// it lays every item into a cell, headers included.
function toRows(names, keyPrefix) {
  const rows = [];
  for (let i = 0; i < names.length; i += COLUMNS) {
    const cells = names.slice(i, i + COLUMNS);
    rows.push({ key: keyPrefix + '-r' + i, type: 'row', cells });
  }
  return rows;
}

export default function FontPicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ready = useAppFonts();

  // Headers only make sense over the whole grouped list. A search is a flat
  // answer to a question, so it drops them rather than showing a stack of
  // one-item sections.
  const data = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q) {
      const hits = [DEFAULT_FONT, ...FONT_NAMES].filter(n => n.toLowerCase().includes(q));
      return toRows(hits, 'search');
    }
    const out = [
      { key: 'h-system', type: 'header', label: 'System' },
      ...toRows([DEFAULT_FONT], 'system'),
    ];
    for (const g of FONT_GROUPS) {
      out.push({ key: 'h-' + g.label, type: 'header', label: g.label });
      out.push(...toRows(g.fonts, g.label));
    }
    return out;
  }, [query]);

  const pick = useCallback((name) => {
    onChange(name);
    setOpen(false);
    setQuery('');
  }, [onChange]);

  const renderItem = useCallback(({ item }) => {
    if (item.type === 'header') return <Text style={styles.groupLabel}>{item.label}</Text>;
    return (
      <View style={styles.gridRow}>
        {item.cells.map(name => (
          <FontTile key={name} name={name} selected={name === value} ready={ready} onPress={pick} />
        ))}
        {/* Keeps a short final row's tiles at column width instead of stretching them. */}
        {item.cells.length < COLUMNS &&
          Array.from({ length: COLUMNS - item.cells.length }, (_, i) => (
            <View key={'pad' + i} style={styles.tileSpacer} />
          ))}
      </View>
    );
  }, [value, ready, pick]);

  const triggerFamily = ready ? fontFamilyFor(value) : undefined;

  return (
    <>
      <TouchableOpacity
        style={styles.trigger}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`Font: ${value}. Tap to change.`}
      >
        <Text numberOfLines={1} style={[styles.triggerText, triggerFamily ? { fontFamily: triggerFamily } : null]}>
          {value}
        </Text>
        <MaterialIcons name="grid-view" size={18} color="#666" />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.sheet}>
            <SheetHeader title="Font" onClose={() => setOpen(false)} />
            <View style={styles.searchWrap}>
              <MaterialIcons name="search" size={18} color="#666" />
              <TextInput
                style={styles.search}
                value={query}
                onChangeText={setQuery}
                placeholder={`Search ${FONT_NAMES.length} fonts`}
                placeholderTextColor="#555"
                autoCorrect={false}
                autoCapitalize="none"
              />
              {query.length > 0 && (
                <TouchableOpacity onPress={() => setQuery('')} accessibilityLabel="Clear search">
                  <MaterialIcons name="close" size={18} color="#666" />
                </TouchableOpacity>
              )}
            </View>
            <FlatList
              data={data}
              renderItem={renderItem}
              keyExtractor={(item) => item.key}
              keyboardShouldPersistTaps="handled"
              initialNumToRender={8}
              windowSize={7}
              removeClippedSubviews
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={<Text style={styles.empty}>No font matches “{query}”.</Text>}
            />
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a1a',
    borderRadius: 10, borderWidth: 1, borderColor: '#2a2a2a',
    paddingHorizontal: 12, height: 44,
  },
  triggerText: { flex: 1, color: '#fff', fontSize: 16 },

  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    backgroundColor: '#1a1a1a', borderTopLeftRadius: 16, borderTopRightRadius: 16,
    paddingHorizontal: 20, paddingTop: 20, height: '85%',
  },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#111',
    borderRadius: 10, borderWidth: 1, borderColor: '#2a2a2a',
    paddingHorizontal: 12, height: 42, marginBottom: 8,
  },
  search: { flex: 1, color: '#fff', fontSize: 14, padding: 0 },

  groupLabel: {
    color: '#666', fontSize: 11, fontWeight: 'bold', letterSpacing: 1,
    textTransform: 'uppercase', marginTop: 16, marginBottom: 8,
  },

  gridRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  tile: {
    flex: 1, height: 84, borderRadius: 12, backgroundColor: '#111',
    borderWidth: 1, borderColor: '#2a2a2a',
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6,
  },
  tileSpacer: { flex: 1 },
  tileSelected: { borderColor: '#2ECC71', backgroundColor: 'rgba(46,204,113,0.10)' },
  // No lineHeight here on purpose: a fixed one clips the tall ascenders and deep
  // descenders that several display faces have, and adjustsFontSizeToFit shrinks
  // the glyphs without shrinking it. The tile's own height does the spacing.
  tileSample: { color: '#fff', fontSize: 22, textAlign: 'center', alignSelf: 'stretch' },
  tileName: { color: '#777', fontSize: 10, textAlign: 'center', marginTop: 2 },
  tileNameSelected: { color: '#2ECC71' },
  tileCheck: {
    position: 'absolute', top: 6, right: 6, width: 16, height: 16, borderRadius: 8,
    backgroundColor: '#2ECC71', alignItems: 'center', justifyContent: 'center',
  },
  empty: { color: '#666', fontSize: 13, textAlign: 'center', marginTop: 24 },
});
