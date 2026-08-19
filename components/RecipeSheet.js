import React, { useMemo, useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, Modal, StyleSheet, Pressable,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import SheetHeader from './SheetHeader';

// One sheet for the two catalogues that cannot be previewed as a picture.
//
// No rendered tile, unlike the filter and transition sheets, and that is a decision
// rather than an omission: a grade can be shown in a still frame and a movement cannot.
// A tile of a zoom is a photograph. An icon that names the shape of the thing is worth
// more than a picture that says nothing.
//
// Motion and Effects are the same sheet because they are the same problem - a category
// strip, a grid of named tiles, a premium diamond and a lock. Two copies of that would
// drift the first time one of them got a fix, which is the failure this codebase keeps
// recording. The catalogue, the title and the icon per category are the only
// differences, so they are the props.
export default function RecipeSheet({
  visible, title, items, categories, icons, value, isPremium, onSelect, onLocked, onClose,
}) {
  const [cat, setCat] = useState('All');
  const cats = useMemo(() => ['All', ...categories], [categories]);
  const shown = useMemo(
    () => (cat === 'All' ? items : items.filter(m => m.category === cat)),
    [cat, items]
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
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

          <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
            {shown.map(m => {
              const locked = m.premium && !isPremium;
              const active = value === m.id;
              return (
                <Pressable
                  key={m.id}
                  style={[styles.tile, active && styles.tileActive]}
                  onPress={() => (locked ? onLocked?.(m) : onSelect(m.id))}
                >
                  <View style={styles.iconWrap}>
                    <MaterialIcons
                      name={icons[m.category] || 'auto-awesome'}
                      size={22}
                      color={active ? '#2ECC71' : locked ? '#5a5a5a' : '#e6e6e6'}
                    />
                    {m.premium && (
                      <MaterialIcons name="diamond" size={11} color="#f5c451" style={styles.gem} />
                    )}
                  </View>
                  <Text
                    style={[styles.label, active && styles.labelActive, locked && styles.labelLocked]}
                    numberOfLines={1}
                  >
                    {m.label}
                  </Text>
                  {/* Measured, not guessed - these run 1.7-4.6x realtime, so a minute of
                      footage is two to five minutes of rendering. Saying so before the
                      wait is the same courtesy Stabilize already extends. */}
                  {!!m.slow && <Text style={styles.slow}>SLOWER</Text>}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#111', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 16, paddingBottom: 24, maxHeight: '78%' },
  // paddingHorizontal on the CONTENT container, not on style: on a horizontal
  // ScrollView `style` is the clipping box, so padding there shrinks what you can see
  // rather than insetting what is in it. alignItems keeps the chips at their own
  // height instead of stretching to the row - both are the pair that clipped the
  // My Videos filter chips through the middle.
  catRow: { flexGrow: 0, marginBottom: 12 },
  catRowContent: { paddingHorizontal: 2, gap: 8, alignItems: 'center' },
  catChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2a2a2a' },
  // Teal: this switches which part of the catalogue you are looking at, it does not
  // choose a value. Green is for the tile that commits one.
  catChipActive: { backgroundColor: 'rgba(0,212,212,0.12)', borderColor: '#00d4d4' },
  catText: { color: '#888', fontSize: 11, fontWeight: '600' },
  catTextActive: { color: '#00d4d4' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 8 },
  tile: { width: '31.5%', aspectRatio: 1.25, borderRadius: 12, backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2a2a2a', alignItems: 'center', justifyContent: 'center', gap: 6 },
  tileActive: { borderColor: '#2ECC71', backgroundColor: 'rgba(46,204,113,0.10)' },
  iconWrap: { width: 30, height: 24, alignItems: 'center', justifyContent: 'center' },
  gem: { position: 'absolute', top: -2, right: -4 },
  label: { color: '#cfcfcf', fontSize: 10, fontWeight: '600', paddingHorizontal: 4 },
  labelActive: { color: '#2ECC71' },
  labelLocked: { color: '#5a5a5a' },
  slow: { color: '#f5c451', fontSize: 7, fontWeight: '700', letterSpacing: 0.5 },
});
