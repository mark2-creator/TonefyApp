import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import SheetHeader, { useSheetInset } from './SheetHeader';

// Stacking order for the things drawn on top of the video.
//
// Overlays are drawn in array order, on the canvas and in the export alike - the export's
// filtergraph chains one overlay filter per item in the same sequence - so moving an item
// in the array IS changing which one sits in front. There is no separate z-index to keep
// in step, which is why this sheet reorders the array rather than writing a number onto
// each overlay: a number would be a second definition of the same thing.
//
// Last in the array draws last, so it is on TOP. The list is shown reversed for that
// reason - people read a layers panel top-down as front-to-back, and a panel that lists
// the backmost item first invites exactly the wrong drag.
export default function LayersSheet({ visible, overlays, onReorder, onClose }) {
  const sheetInset = useSheetInset(16);
  const shown = [...(overlays || [])].reverse();

  // Indices are into the ORIGINAL array; the arrows are labelled by what the user sees.
  const move = (displayIndex, dir) => {
    const n = overlays.length;
    const from = n - 1 - displayIndex;
    const to = from + (dir === 'front' ? 1 : -1);
    if (to < 0 || to >= n) return;
    const next = [...overlays];
    [next[from], next[to]] = [next[to], next[from]];
    onReorder(next);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, sheetInset]}>
          <SheetHeader title="Layers" onClose={onClose} />
          {shown.length === 0 ? (
            <Text style={styles.blurb}>
              Nothing is on top of the video yet. Add text or a sticker and it will
              appear here.
            </Text>
          ) : (
            <>
              <Text style={styles.blurb}>Top of the list is in front.</Text>
              <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
                {shown.map((o, i) => (
                  <View key={o.key || i} style={styles.row}>
                    <MaterialIcons
                      name={o.stickerId ? 'emoji-emotions' : 'title'}
                      size={20}
                      color="#cfcfcf"
                    />
                    <Text style={styles.name} numberOfLines={1}>
                      {o.text?.trim() || (o.stickerId ? 'Sticker' : 'Text')}
                    </Text>
                    <TouchableOpacity
                      onPress={() => move(i, 'front')}
                      disabled={i === 0}
                      hitSlop={8}
                      style={[styles.arrow, i === 0 && styles.arrowOff]}>
                      <MaterialIcons name="keyboard-arrow-up" size={20}
                        color={i === 0 ? '#333' : '#00d4d4'} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => move(i, 'back')}
                      disabled={i === shown.length - 1}
                      hitSlop={8}
                      style={[styles.arrow, i === shown.length - 1 && styles.arrowOff]}>
                      <MaterialIcons name="keyboard-arrow-down" size={20}
                        color={i === shown.length - 1 ? '#333' : '#00d4d4'} />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#111', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, maxHeight: '75%' },
  blurb: { color: '#888', fontSize: 12, lineHeight: 17, marginBottom: 12 },
  // Content-sized, not flex: 1. A child given flex: 1 inside a maxHeight sheet has
  // nothing definite to flex against and resolves to zero, which empties the list.
  list: { flexGrow: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, marginBottom: 8 },
  name: { flex: 1, color: '#fff', fontSize: 13 },
  arrow: { padding: 2 },
  arrowOff: { opacity: 0.4 },
});
