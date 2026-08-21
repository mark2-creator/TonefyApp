import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import Slider from '@react-native-community/slider';
import { MaterialIcons } from '@expo/vector-icons';
import SheetHeader from './SheetHeader';

// Shape masks. The ids must match MASK_SHAPES in server.js - an unknown shape renders
// no mask at all rather than failing, so a typo here is silent.
const SHAPES = [
  { id: 'ellipse', label: 'Oval', icon: 'panorama-fish-eye' },
  { id: 'circle', label: 'Circle', icon: 'circle' },
  { id: 'rounded', label: 'Rounded', icon: 'rounded-corner' },
  { id: 'rect', label: 'Rectangle', icon: 'crop-square' },
];

export default function MaskSheet({ visible, value, onChange, onClose }) {
  const shape = value?.shape || null;
  const feather = value?.feather ?? 40;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <SheetHeader title="Mask" onClose={onClose} />
          <Text style={styles.blurb}>
            Keeps the shape and fades everything outside it to black. Applied when you
            export.
          </Text>

          <View style={styles.grid}>
            <TouchableOpacity
              style={[styles.tile, !shape && styles.tileOn]}
              onPress={() => onChange(null)}>
              <MaterialIcons name="block" size={20} color={!shape ? '#000' : '#cfcfcf'} />
              <Text style={[styles.tileText, !shape && styles.tileTextOn]}>None</Text>
            </TouchableOpacity>
            {SHAPES.map(s => (
              <TouchableOpacity
                key={s.id}
                style={[styles.tile, shape === s.id && styles.tileOn]}
                onPress={() => onChange({ shape: s.id, feather })}>
                <MaterialIcons name={s.icon} size={20} color={shape === s.id ? '#000' : '#cfcfcf'} />
                <Text style={[styles.tileText, shape === s.id && styles.tileTextOn]}>{s.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Only once a shape is chosen. A softness slider with nothing to soften is
              the kind of live-looking control that does nothing. */}
          {!!shape && (
            <>
              <View style={styles.rowHead}>
                <Text style={styles.label}>Edge softness</Text>
                <Text style={styles.value}>{Math.round(feather)}%</Text>
              </View>
              <Slider
                minimumValue={0} maximumValue={100} step={5} value={feather}
                onValueChange={v => onChange({ shape, feather: Math.round(v) })}
                minimumTrackTintColor="#00d4d4" maximumTrackTintColor="#2a2a2a" thumbTintColor="#00d4d4"
              />
              <Text style={styles.hint}>
                Softness is a share of the frame, so it looks the same at every export size.
              </Text>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#111', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24 },
  blurb: { color: '#888', fontSize: 12, lineHeight: 17, marginBottom: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: { alignItems: 'center', gap: 4, backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 12, paddingVertical: 12, minWidth: 78, flexGrow: 1 },
  tileOn: { backgroundColor: '#00d4d4', borderColor: '#00d4d4' },
  tileText: { color: '#cfcfcf', fontSize: 11, fontWeight: '600' },
  tileTextOn: { color: '#000' },
  rowHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 18 },
  label: { color: '#fff', fontSize: 13, fontWeight: '600' },
  value: { color: '#00d4d4', fontSize: 12, fontWeight: '700' },
  hint: { color: '#888', fontSize: 11, marginTop: 4 },
});
