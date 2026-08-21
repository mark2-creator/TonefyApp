import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, ScrollView, Modal, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import SheetHeader, { useSheetInset } from './SheetHeader';
import CaptionText from './CaptionText';
import { useAppFonts } from '../constants/fontLoader';
import {
  CAPTION_STYLES, CAPTION_CATEGORIES, resolveCaptionStyle, captionChunkSize,
  captionHighlight,
} from '../constants/captionStyles';

// A hundred and thirty styles will not fit in a grid inside the Auto Captions
// sheet - and a vertical list nested in that sheet's ScrollView is the one
// arrangement React Native handles worst, since neither scroller can virtualise.
// So the sheet keeps a single row showing the current style, drawn in itself, and
// the catalogue opens over it: searchable, filtered by category, two columns of
// live previews.

const COLUMNS = 2;

// Long enough to show a face's rhythm and its ascenders and descenders, short
// enough that the widest display families still fit a half-width tile. Sentence
// case on purpose - a style with `upper` capitalises it and one without does not,
// so the tile shows which of the two you are picking.
const SAMPLE = 'Say this';
// A style that chips the spoken word has nothing to show at rest, so the tile is
// drawn mid-phrase - the second word of the sample, chipped as it would be on the
// canvas. Every other style ignores this and draws plain.
const SAMPLE_WORD = 1;
const sampleWordFor = style => (captionHighlight(style) ? SAMPLE_WORD : -1);

const ALL = 'All';

function StyleTile({ style, selected, ready, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.tile, selected && styles.tileSelected]}
      onPress={() => onPress(style.id)}
      accessibilityRole="button"
      accessibilityLabel={style.label + ' caption style'}
      accessibilityState={{ selected }}
    >
      <View style={styles.stage}>
        {/* The families register a frame or two after mount; until then every
            tile would preview in the system face and they would all look alike,
            so the sample is held back rather than shown wrong. */}
        {ready ? (
          <CaptionText style={style} text={SAMPLE} size={15} numberOfLines={1} activeWord={sampleWordFor(style)} />
        ) : null}
      </View>
      <Text numberOfLines={1} style={[styles.tileName, selected && styles.tileNameSelected]}>
        {style.label}
      </Text>
      {selected && (
        <View style={styles.tileCheck}>
          <MaterialIcons name="check" size={12} color="#0b0b0b" />
        </View>
      )}
    </TouchableOpacity>
  );
}

const MemoTile = React.memo(StyleTile);

export function CaptionStyleSheet({ visible, value, onChange, onClose }) {
  const sheetInset = useSheetInset(16);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState(ALL);
  const ready = useAppFonts();
  const listRef = useRef(null);

  const selected = resolveCaptionStyle(value);

  const data = useMemo(() => {
    const q = query.trim().toLowerCase();
    return CAPTION_STYLES.filter(s => {
      if (category !== ALL && s.category !== category) return false;
      if (!q) return true;
      return s.label.toLowerCase().includes(q)
        || s.category.toLowerCase().includes(q)
        || (s.font || '').toLowerCase().includes(q);
    });
  }, [query, category]);

  // Switching category leaves the list scrolled where the last one ended, which
  // looks like an empty category until you scroll back up.
  useEffect(() => {
    if (listRef.current && data.length > 0) {
      listRef.current.scrollToOffset({ offset: 0, animated: false });
    }
  }, [category, query, data.length]);

  const pick = useCallback((id) => {
    onChange(id);
    onClose();
  }, [onChange, onClose]);

  const renderItem = useCallback(({ item }) => (
    <MemoTile style={item} selected={item.id === selected.id} ready={ready} onPress={pick} />
  ), [selected.id, ready, pick]);

  return (
      <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <View style={styles.modalOverlay}>
          <View style={[styles.sheet, sheetInset]}>
            <SheetHeader title={`Caption Style · ${CAPTION_STYLES.length}`} onClose={onClose} />

            <View style={styles.searchWrap}>
              <MaterialIcons name="search" size={18} color="#666" />
              <TextInput
                style={styles.search}
                value={query}
                onChangeText={setQuery}
                placeholder="Search styles, categories, fonts"
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

            <View style={styles.chipRowWrap}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipRow}
                keyboardShouldPersistTaps="handled"
              >
                {[ALL, ...CAPTION_CATEGORIES].map(c => (
                  <TouchableOpacity
                    key={c}
                    onPress={() => setCategory(c)}
                    style={[styles.chip, category === c && styles.chipActive]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: category === c }}
                  >
                    <Text style={[styles.chipText, category === c && styles.chipTextActive]}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <FlatList
              ref={listRef}
              data={data}
              renderItem={renderItem}
              keyExtractor={(item) => item.id}
              numColumns={COLUMNS}
              columnWrapperStyle={styles.gridRow}
              keyboardShouldPersistTaps="handled"
              initialNumToRender={8}
              windowSize={7}
              removeClippedSubviews
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={<Text style={styles.empty}>No style matches “{query}”.</Text>}
            />
          </View>
        </View>
      </Modal>
  );
}

// Trigger row plus sheet, for a screen with nowhere else to open it from. Screens
// that already have a settings row of their own use CaptionStyleSheet directly
// rather than growing a second row beside it.
export default function CaptionStylePicker({ value, onChange, label = 'Caption Style' }) {
  const [open, setOpen] = useState(false);
  const ready = useAppFonts();
  const selected = resolveCaptionStyle(value);
  const chunk = captionChunkSize(selected);

  return (
    <>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity
        style={styles.trigger}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`Caption style: ${selected.label}. Tap to change.`}
      >
        <View style={styles.triggerStage}>
          {ready ? <CaptionText style={selected} text={SAMPLE} size={16} numberOfLines={1} activeWord={sampleWordFor(selected)} /> : null}
        </View>
        <View style={styles.triggerMeta}>
          <Text style={styles.triggerName} numberOfLines={1}>{selected.label}</Text>
          <Text style={styles.triggerSub} numberOfLines={1}>
            {selected.category} · {chunk === 1 ? 'word by word' : `${chunk} words`}
          </Text>
        </View>
        <MaterialIcons name="grid-view" size={18} color="#666" />
      </TouchableOpacity>
      <CaptionStyleSheet visible={open} value={value} onChange={onChange} onClose={() => setOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  label: { color: '#aaa', fontSize: 12, marginBottom: 8 },

  trigger: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#111',
    borderRadius: 12, borderWidth: 1, borderColor: '#2a2a2a',
    paddingHorizontal: 10, paddingVertical: 10, marginBottom: 18,
  },
  triggerStage: {
    width: 120, height: 40, borderRadius: 8, backgroundColor: '#000',
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  triggerMeta: { flex: 1 },
  triggerName: { color: '#fff', fontSize: 14, fontWeight: '600' },
  triggerSub: { color: '#666', fontSize: 11, marginTop: 2 },

  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    backgroundColor: '#1a1a1a', borderTopLeftRadius: 16, borderTopRightRadius: 16,
    paddingHorizontal: 20, paddingTop: 20, height: '88%',
  },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#111',
    borderRadius: 10, borderWidth: 1, borderColor: '#2a2a2a',
    paddingHorizontal: 12, height: 42,
  },
  search: { flex: 1, color: '#fff', fontSize: 14, padding: 0 },

  chipRowWrap: { marginTop: 10, marginBottom: 4 },
  chipRow: { gap: 8, paddingRight: 20 },
  chip: {
    paddingHorizontal: 12, height: 30, borderRadius: 15, justifyContent: 'center',
    backgroundColor: '#111', borderWidth: 1, borderColor: '#2a2a2a',
  },
  chipActive: { backgroundColor: 'rgba(46,204,113,0.14)', borderColor: '#2ECC71' },
  chipText: { color: '#888', fontSize: 12 },
  chipTextActive: { color: '#2ECC71', fontWeight: '600' },

  gridRow: { gap: 10, marginBottom: 10 },
  tile: {
    flex: 1, borderRadius: 12, backgroundColor: '#111',
    borderWidth: 1, borderColor: '#2a2a2a', paddingBottom: 6, overflow: 'hidden',
  },
  tileSelected: { borderColor: '#2ECC71', backgroundColor: 'rgba(46,204,113,0.08)' },
  // A near-black stage rather than the tile's own grey: a caption is judged
  // against video, and most of these styles are light text meant to survive it.
  stage: {
    height: 62, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 6, overflow: 'hidden',
  },
  tileName: { color: '#999', fontSize: 11, textAlign: 'center', marginTop: 6 },
  tileNameSelected: { color: '#2ECC71', fontWeight: '600' },
  tileCheck: {
    position: 'absolute', top: 6, right: 6, width: 16, height: 16, borderRadius: 8,
    backgroundColor: '#2ECC71', alignItems: 'center', justifyContent: 'center',
  },
  empty: { color: '#666', fontSize: 13, textAlign: 'center', marginTop: 24 },
});
