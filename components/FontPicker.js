import React, { useMemo, useState, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, Modal, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import SheetHeader from './SheetHeader';
import { FONT_GROUPS, FONT_NAMES, fontFamilyFor } from '../constants/fonts';
import { useAppFonts } from '../constants/fontLoader';

export const DEFAULT_FONT = 'Default';

// A row of chips worked for four fonts and does not for a hundred and thirty, so
// the list moved into its own sheet: grouped, searchable, and previewing each
// family in itself. The name is drawn twice - once in the family and once in the
// system face beneath it - because a display face like Press Start 2P is chosen
// for its shape rather than its legibility, and an unreadable name is not a
// preview of anything.

const ROW_HEIGHT = 56;

const FontRow = React.memo(function FontRow({ name, selected, ready, onPress }) {
  const family = ready ? fontFamilyFor(name) : undefined;
  return (
    <TouchableOpacity
      style={[styles.row, selected && styles.rowSelected]}
      onPress={() => onPress(name)}
      accessibilityRole="button"
      accessibilityLabel={name}
      accessibilityState={{ selected }}
    >
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={[styles.sample, family ? { fontFamily: family } : null]}>
          {name}
        </Text>
        <Text style={styles.sampleName}>{name}</Text>
      </View>
      {selected && <MaterialIcons name="check" size={20} color="#2ECC71" />}
    </TouchableOpacity>
  );
});

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
      return [DEFAULT_FONT, ...FONT_NAMES]
        .filter(n => n.toLowerCase().includes(q))
        .map(name => ({ key: name, type: 'font', name }));
    }
    const out = [
      { key: 'h-system', type: 'header', label: 'System' },
      { key: DEFAULT_FONT, type: 'font', name: DEFAULT_FONT },
    ];
    for (const g of FONT_GROUPS) {
      out.push({ key: 'h-' + g.label, type: 'header', label: g.label });
      for (const name of g.fonts) out.push({ key: name, type: 'font', name });
    }
    return out;
  }, [query]);

  const pick = useCallback((name) => {
    onChange(name);
    setOpen(false);
    setQuery('');
  }, [onChange]);

  const renderItem = useCallback(({ item }) => (
    item.type === 'header'
      ? <Text style={styles.groupLabel}>{item.label}</Text>
      : <FontRow name={item.name} selected={item.name === value} ready={ready} onPress={pick} />
  ), [value, ready, pick]);

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
        <MaterialIcons name="expand-more" size={20} color="#666" />
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
              initialNumToRender={14}
              windowSize={7}
              removeClippedSubviews
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
    textTransform: 'uppercase', marginTop: 16, marginBottom: 4,
  },
  row: {
    height: ROW_HEIGHT, flexDirection: 'row', alignItems: 'center',
    borderBottomWidth: 1, borderBottomColor: '#222', paddingHorizontal: 4,
  },
  rowSelected: { backgroundColor: 'rgba(46,204,113,0.10)' },
  sample: { color: '#fff', fontSize: 19 },
  sampleName: { color: '#666', fontSize: 10, marginTop: 1 },
  empty: { color: '#666', fontSize: 13, textAlign: 'center', marginTop: 24 },
});
