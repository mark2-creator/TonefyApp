import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import Slider from '@react-native-community/slider';
import SheetHeader, { useSheetInset } from './SheetHeader';

// Green screen, and it says which problem it solves.
//
// This opens from BG Remover, and the two are not the same thing. Removing an arbitrary
// background needs a model that knows where the person is. Keying a green screen needs
// only a colour, which is why one of them is here today and the other is not - so the
// sheet says so rather than letting someone point it at their kitchen and conclude the
// app is broken.
const KEYS = [
  { id: '#00b140', label: 'Green', swatch: '#00b140' },
  { id: '#0047bb', label: 'Blue', swatch: '#0047bb' },
];

const DEFAULTS = { colour: '#00b140', similarity: 0.30, blend: 0.10 };

export default function ChromaSheet({ visible, value, onChange, onClose }) {
  const sheetInset = useSheetInset(12);
  const v = value || DEFAULTS;
  const on = !!value;
  const set = (patch) => onChange({ ...v, ...patch });

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, sheetInset]}>
          <SheetHeader title="Green screen" onClose={onClose} />

          <Text style={styles.blurb}>
            Removes a solid colour backdrop and puts your chosen Background behind the
            subject. It needs a real green or blue screen - it cannot cut a person out
            of an ordinary room.
          </Text>

          <View style={styles.row}>
            <TouchableOpacity
              style={[styles.toggle, !on && styles.toggleOn]}
              onPress={() => onChange(null)}>
              <Text style={[styles.toggleText, !on && styles.toggleTextOn]}>Off</Text>
            </TouchableOpacity>
            {KEYS.map(k => (
              <TouchableOpacity
                key={k.id}
                style={[styles.toggle, on && v.colour === k.id && styles.toggleOn]}
                onPress={() => set({ colour: k.id })}>
                <View style={[styles.swatch, { backgroundColor: k.swatch }]} />
                <Text style={[styles.toggleText, on && v.colour === k.id && styles.toggleTextOn]}>{k.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {on && (
            <>
              {/* Teal, because these handle the picture rather than commit a choice. */}
              <View style={styles.sliderRow}>
                <Text style={styles.sliderLabel}>Strength</Text>
                <Text style={styles.sliderValue}>{Math.round(v.similarity * 100)}%</Text>
              </View>
              <Slider
                minimumValue={0.05} maximumValue={0.7} step={0.01} value={v.similarity}
                minimumTrackTintColor="#00d4d4" maximumTrackTintColor="#2a2a2a" thumbTintColor="#00d4d4"
                onValueChange={(n) => set({ similarity: n })}
              />
              <Text style={styles.hint}>
                Too low leaves patches of the screen behind. Too high starts eating the
                subject, usually the hair first.
              </Text>

              <View style={styles.sliderRow}>
                <Text style={styles.sliderLabel}>Edge softness</Text>
                <Text style={styles.sliderValue}>{Math.round(v.blend * 100)}%</Text>
              </View>
              <Slider
                minimumValue={0} maximumValue={0.4} step={0.01} value={v.blend}
                minimumTrackTintColor="#00d4d4" maximumTrackTintColor="#2a2a2a" thumbTintColor="#00d4d4"
                onValueChange={(n) => set({ blend: n })}
              />
              <Text style={styles.hint}>
                Softens the cut-out edge. A little stops it looking pasted on.
              </Text>

              <TouchableOpacity style={styles.reset} onPress={() => onChange({ ...DEFAULTS })}>
                <Text style={styles.resetText}>Reset to defaults</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#111', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 32 },
  blurb: { color: '#fff', opacity: 0.75, fontSize: 12, lineHeight: 18, marginBottom: 14 },
  row: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2a2a2a' },
  toggleOn: { borderColor: '#2ECC71', backgroundColor: 'rgba(46,204,113,0.10)' },
  toggleText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  toggleTextOn: { color: '#2ECC71' },
  swatch: { width: 12, height: 12, borderRadius: 3 },
  sliderRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  sliderLabel: { color: '#fff', fontSize: 13, fontWeight: '600' },
  sliderValue: { color: '#00d4d4', fontSize: 13, fontWeight: '700' },
  hint: { color: '#fff', opacity: 0.5, fontSize: 11, lineHeight: 16, marginTop: 2 },
  reset: { alignSelf: 'flex-start', marginTop: 14 },
  resetText: { color: '#00d4d4', fontSize: 12, fontWeight: '600' },
});
