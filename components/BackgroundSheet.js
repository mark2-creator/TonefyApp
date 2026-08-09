import React from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, StyleSheet } from 'react-native';
import Slider from '@react-native-community/slider';
import { MaterialIcons } from '@expo/vector-icons';
import SheetHeader, { useSheetInset } from './SheetHeader';
import {
  FIT_MODES, BG_TYPES, BG_COLOURS, DEFAULT_BACKGROUND, normaliseBackground,
} from '../constants/background';

// The canvas behind the footage.
//
// Fit comes first because nothing below it matters until the shot stops filling the
// frame - on Fill there is no background to see, and offering colours for an area
// that does not exist is the kind of control that makes people distrust the rest.

export default function BackgroundSheet({ visible, value, onChange, onClose }) {
  const sheetInset = useSheetInset(16);
  const bg = normaliseBackground(value);
  const fitted = bg.fit === 'fit';
  const set = patch => onChange({ ...bg, ...patch });

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, sheetInset]}>
          <SheetHeader title="Background" onClose={onClose} />

          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.label}>HOW THE SHOT MEETS THE FRAME</Text>
            <View style={styles.modeRow}>
              {FIT_MODES.map(m => {
                const on = bg.fit === m.id;
                return (
                  <TouchableOpacity
                    key={m.id}
                    style={[styles.mode, on && styles.modeOn]}
                    onPress={() => set({ fit: m.id })}>
                    <MaterialIcons name={m.icon} size={20} color={on ? '#04211f' : '#cfcfcf'} />
                    <Text style={[styles.modeLabel, on && styles.modeLabelOn]}>{m.label}</Text>
                    <Text style={[styles.modeNote, on && { color: '#04211f' }]}>{m.note}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Everything below is meaningless on Fill, so it says so rather than
                sitting there enabled and doing nothing when tapped. */}
            {!fitted ? (
              <Text style={styles.hint}>
                On Fill the shot is cropped to cover the whole frame, so there is no
                background to set. Choose Fit to show the whole shot.
              </Text>
            ) : (
              <>
                <Text style={styles.label}>BACKGROUND</Text>
                <View style={styles.modeRow}>
                  {BG_TYPES.map(t => {
                    const on = bg.type === t.id;
                    return (
                      <TouchableOpacity
                        key={t.id}
                        style={[styles.mode, on && styles.modeOn]}
                        onPress={() => set({ type: t.id })}>
                        <MaterialIcons name={t.icon} size={20} color={on ? '#04211f' : '#cfcfcf'} />
                        <Text style={[styles.modeLabel, on && styles.modeLabelOn]}>{t.label}</Text>
                        <Text style={[styles.modeNote, on && { color: '#04211f' }]}>{t.note}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {bg.type === 'colour' ? (
                  <View style={styles.swatches}>
                    {BG_COLOURS.map(c => (
                      <TouchableOpacity
                        key={c}
                        style={[
                          styles.swatch,
                          { backgroundColor: c },
                          bg.colour === c && styles.swatchOn,
                        ]}
                        onPress={() => set({ colour: c })}
                      />
                    ))}
                  </View>
                ) : (
                  <>
                    <View style={styles.sliderHead}>
                      <Text style={styles.sliderLabel}>Blur</Text>
                      <Text style={styles.sliderValue}>{Math.round(bg.blur)}</Text>
                    </View>
                    <Slider
                      style={styles.slider}
                      minimumValue={0} maximumValue={60} step={1}
                      value={bg.blur}
                      minimumTrackTintColor="#00d4d4"
                      maximumTrackTintColor="#333"
                      thumbTintColor="#00d4d4"
                      onValueChange={v => set({ blur: Math.round(v) })}
                    />
                    <Text style={styles.hint}>
                      The blurred backdrop is drawn when the video is exported. The
                      canvas shows the fitted shot on a plain backdrop until then.
                    </Text>
                  </>
                )}
              </>
            )}
          </ScrollView>

          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.reset}
              onPress={() => onChange({ ...DEFAULT_BACKGROUND })}>
              <MaterialIcons name="restart-alt" size={18} color="#cfcfcf" />
              <Text style={styles.resetText}>Reset</Text>
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
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16, maxHeight: '80%',
  },
  label: {
    color: '#888', fontSize: 11, fontWeight: '700', letterSpacing: 2,
    marginTop: 8, marginBottom: 10,
  },
  modeRow: { flexDirection: 'row', gap: 10 },
  mode: {
    flex: 1, backgroundColor: '#1a1a1a', borderRadius: 12, padding: 12, gap: 3,
    borderWidth: 1, borderColor: '#2a2a2a',
  },
  // Green: these commit a change to how every clip is framed.
  modeOn: { backgroundColor: '#2ECC71', borderColor: '#2ECC71' },
  modeLabel: { color: '#fff', fontSize: 14, fontWeight: '700' },
  modeLabelOn: { color: '#04211f' },
  modeNote: { color: '#888', fontSize: 10 },
  hint: { color: '#888', fontSize: 11, lineHeight: 16, marginTop: 12 },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  swatch: {
    width: 42, height: 42, borderRadius: 21, borderWidth: 2, borderColor: '#2a2a2a',
  },
  swatchOn: { borderColor: '#2ECC71', borderWidth: 3 },
  sliderHead: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginTop: 14,
  },
  sliderLabel: { color: '#fff', fontSize: 13, fontWeight: '600' },
  sliderValue: { color: '#00d4d4', fontSize: 13, fontFamily: 'monospace' },
  slider: { width: '100%', height: 32 },
  actions: {
    flexDirection: 'row', gap: 12, paddingTop: 12, marginTop: 6,
    borderTopWidth: 1, borderTopColor: '#2a2a2a',
  },
  reset: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#1a1a1a', borderRadius: 12, paddingVertical: 13,
    borderWidth: 1, borderColor: '#2a2a2a',
  },
  resetText: { color: '#cfcfcf', fontSize: 14, fontWeight: '600' },
  done: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#2ECC71', borderRadius: 12, paddingVertical: 13,
  },
  doneText: { color: '#04211f', fontSize: 14, fontWeight: '700' },
});
