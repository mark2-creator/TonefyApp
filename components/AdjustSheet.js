import React from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, StyleSheet } from 'react-native';
import Slider from '@react-native-community/slider';
import { MaterialIcons } from '@expo/vector-icons';
import SheetHeader, { useSheetInset } from './SheetHeader';
import { ADJUSTMENTS, ADJUST_DEFAULTS, hasAdjustments } from '../constants/adjustments';

// Hand adjustment for one clip: ten sliders, all centred at zero.
//
// Zero in the middle rather than at the left, because these are corrections. A
// brightness that runs 0..100 with the default at 50 makes "unchanged" a number you
// have to remember; centred, it is the position the thumb is already in, and a glance
// down the sheet shows exactly what has been touched.

export default function AdjustSheet({ visible, value, onChange, onClose }) {
  const sheetInset = useSheetInset(16);
  const adjust = { ...ADJUST_DEFAULTS, ...(value || {}) };
  const touched = hasAdjustments(adjust);

  const set = (key, n) => onChange({ ...adjust, [key]: Math.round(n) });

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, sheetInset]}>
          <SheetHeader title="Adjust" onClose={onClose} />

          <ScrollView showsVerticalScrollIndicator={false}>
            {ADJUSTMENTS.map(a => {
              const n = adjust[a.key] || 0;
              return (
                <View key={a.key} style={styles.row}>
                  <View style={styles.rowHead}>
                    <MaterialIcons name={a.icon} size={16} color={n ? '#00d4d4' : '#888'} />
                    <Text style={[styles.label, n !== 0 && styles.labelActive]}>{a.label}</Text>
                    {/* Tap the number to put this one control back. Faster than
                        dragging for a value that has a single correct position. */}
                    <TouchableOpacity onPress={() => set(a.key, 0)} hitSlop={10}>
                      <Text style={[styles.value, n !== 0 && styles.valueActive]}>
                        {n > 0 ? `+${n}` : n}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <Slider
                    style={styles.slider}
                    minimumValue={-100}
                    maximumValue={100}
                    step={1}
                    value={n}
                    minimumTrackTintColor="#00d4d4"
                    maximumTrackTintColor="#333"
                    thumbTintColor="#00d4d4"
                    onValueChange={v => set(a.key, v)}
                  />
                </View>
              );
            })}
            <Text style={styles.note}>
              Adjustments are applied when the video is exported. The canvas cannot show
              a colour change yet.
            </Text>
          </ScrollView>

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.reset, !touched && styles.resetDim]}
              disabled={!touched}
              onPress={() => onChange({ ...ADJUST_DEFAULTS })}>
              <MaterialIcons name="restart-alt" size={18} color={touched ? '#cfcfcf' : '#555'} />
              <Text style={[styles.resetText, !touched && { color: '#555' }]}>Reset all</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.done} onPress={onClose}>
              <MaterialIcons name="check" size={18} color="#04211f" />
              <Text style={styles.doneText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#111', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16, maxHeight: '85%',
  },
  row: { marginBottom: 6 },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { flex: 1, color: '#888', fontSize: 13 },
  labelActive: { color: '#fff', fontWeight: '600' },
  value: { color: '#555', fontSize: 12, fontFamily: 'monospace', minWidth: 34, textAlign: 'right' },
  valueActive: { color: '#00d4d4' },
  slider: { width: '100%', height: 30 },
  note: { color: '#888', fontSize: 11, lineHeight: 15, marginTop: 6, marginBottom: 4 },
  actions: {
    flexDirection: 'row', gap: 12, paddingTop: 12, marginTop: 4,
    borderTopWidth: 1, borderTopColor: '#2a2a2a',
  },
  reset: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#1a1a1a', borderRadius: 12, paddingVertical: 13,
    borderWidth: 1, borderColor: '#2a2a2a',
  },
  resetDim: { opacity: 0.6 },
  resetText: { color: '#cfcfcf', fontSize: 14, fontWeight: '600' },
  done: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#2ECC71', borderRadius: 12, paddingVertical: 13,
  },
  doneText: { color: '#04211f', fontSize: 14, fontWeight: '700' },
});
