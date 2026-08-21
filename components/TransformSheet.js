import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import Slider from '@react-native-community/slider';
import { MaterialIcons } from '@expo/vector-icons';
import SheetHeader, { useSheetInset } from './SheetHeader';

// Geometry and opacity, as two sheets from one file because they share every control
// pattern and differ only in which numbers they set.
//
// They are kept as separate TOOLS rather than merged into one because they answer
// different questions - Transform is "where is the camera pointing", Transparency is
// "how solid is this" - and a sheet that answers both is the kind of catch-all the
// toolbar already has too many of.

const DEFAULT_TRANSFORM = { zoom: 1, x: 0, y: 0 };

function Row({ label, value, min, max, step, onChange, format }) {
  const changed = Math.abs(value - (label === 'Zoom' ? 1 : 0)) > 0.001;
  return (
    <View style={styles.row}>
      <View style={styles.rowHead}>
        <Text style={[styles.label, changed && styles.labelOn]}>{label}</Text>
        <Text style={styles.value}>{format ? format(value) : value}</Text>
      </View>
      <Slider
        minimumValue={min} maximumValue={max} step={step} value={value}
        onValueChange={onChange}
        minimumTrackTintColor="#00d4d4" maximumTrackTintColor="#2a2a2a" thumbTintColor="#00d4d4"
      />
    </View>
  );
}

export function TransformSheet({ visible, value, rotate = 0, onChange, onRotate, onClose }) {
  const sheetInset = useSheetInset(16);
  const t = { ...DEFAULT_TRANSFORM, ...(value || {}) };
  const set = (patch) => onChange({ ...t, ...patch });
  const touched = t.zoom !== 1 || t.x !== 0 || t.y !== 0 || rotate !== 0;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, sheetInset]}>
          <SheetHeader title="Transform" onClose={onClose} />
          <Text style={styles.blurb}>
            Zoom into the shot and choose what stays in frame. Applied when you export.
          </Text>

          {/* Quarter turns, not a free angle. An arbitrary rotation leaves empty
              corners that have to be covered by zooming in, which silently crops the
              shot - so the control offers the turns that are always exact. */}
          <Text style={styles.section}>Rotate</Text>
          <View style={styles.turns}>
            {[0, 90, 180, 270].map(deg => (
              <TouchableOpacity
                key={deg}
                style={[styles.turn, rotate === deg && styles.turnOn]}
                onPress={() => onRotate(deg)}>
                <MaterialIcons
                  name={deg === 0 ? 'crop-portrait' : 'rotate-right'}
                  size={20}
                  color={rotate === deg ? '#000' : '#cfcfcf'}
                />
                <Text style={[styles.turnText, rotate === deg && styles.turnTextOn]}>
                  {deg === 0 ? 'None' : `${deg}°`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.section}>Frame</Text>
          <Row label="Zoom" value={t.zoom} min={1} max={3} step={0.05}
            onChange={v => set({ zoom: v })} format={v => `${v.toFixed(2)}x`} />
          {/* Panning only means anything once there is hidden picture to pan into. At
              1.00x the offset is a percentage of a zero-width margin, so the server
              correctly ignores it - saying so beats a control that does nothing. */}
          <Row label="Move across" value={t.x} min={-100} max={100} step={1}
            onChange={v => set({ x: Math.round(v) })} format={v => `${Math.round(v)}`} />
          <Row label="Move up/down" value={t.y} min={-100} max={100} step={1}
            onChange={v => set({ y: Math.round(v) })} format={v => `${Math.round(v)}`} />
          {t.zoom === 1 && (t.x !== 0 || t.y !== 0) && (
            <Text style={styles.hint}>Zoom in past 1.00x to move the shot around.</Text>
          )}

          {touched && (
            <TouchableOpacity
              style={styles.reset}
              onPress={() => { onChange(null); onRotate(0); }}>
              <Text style={styles.resetText}>Reset</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

export function TransparencySheet({ visible, value, onChange, onClose }) {
  const sheetInset = useSheetInset(16);
  const o = value == null ? 1 : value;
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, sheetInset]}>
          <SheetHeader title="Transparency" onClose={onClose} />
          <Text style={styles.blurb}>
            Fades the clip toward black. Useful under text, or to open and close on
            something rather than cutting to it.
          </Text>
          <Row label="Opacity" value={o} min={0.05} max={1} step={0.05}
            onChange={v => onChange(v >= 1 ? null : v)}
            format={v => `${Math.round(v * 100)}%`} />
          {o < 1 && (
            <TouchableOpacity style={styles.reset} onPress={() => onChange(null)}>
              <Text style={styles.resetText}>Reset</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#111', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24 },
  blurb: { color: '#888', fontSize: 12, lineHeight: 17, marginBottom: 8 },
  section: { color: '#fff', fontSize: 12, fontWeight: '700', marginTop: 14, marginBottom: 8 },
  turns: { flexDirection: 'row', gap: 8 },
  turn: { flex: 1, alignItems: 'center', gap: 4, backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 12, paddingVertical: 10 },
  turnOn: { backgroundColor: '#00d4d4', borderColor: '#00d4d4' },
  turnText: { color: '#cfcfcf', fontSize: 11, fontWeight: '600' },
  turnTextOn: { color: '#000' },
  row: { marginTop: 6 },
  rowHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { color: '#888', fontSize: 13 },
  labelOn: { color: '#fff', fontWeight: '600' },
  value: { color: '#00d4d4', fontSize: 12, fontWeight: '700' },
  hint: { color: '#888', fontSize: 11, marginTop: 4 },
  reset: { alignSelf: 'flex-start', marginTop: 14, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#2a2a2a' },
  resetText: { color: '#cfcfcf', fontSize: 12, fontWeight: '600' },
});
