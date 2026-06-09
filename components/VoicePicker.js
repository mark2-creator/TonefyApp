import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export const VOICES = [
  { id: 'gtts-us',    label: 'Sarah',   accent: 'US Female',   icon: '🇺🇸' },
  { id: 'gtts-uk',    label: 'Emma',    accent: 'UK Female',   icon: '🇬🇧' },
  { id: 'gtts-au',    label: 'Olivia',  accent: 'AU Female',   icon: '🇦🇺' },
  { id: 'edge-guy',   label: 'Guy',     accent: 'US Male',     icon: '🇺🇸' },
  { id: 'edge-ryan',  label: 'Ryan',    accent: 'UK Male',     icon: '🇬🇧' },
  { id: 'edge-brian', label: 'Brian',   accent: 'Deep Male',   icon: '🎙️' },
  { id: 'edge-aria',  label: 'Aria',    accent: 'US Female 2', icon: '🇺🇸' },
  { id: 'edge-sonia', label: 'Sonia',   accent: 'UK Female 2', icon: '🇬🇧' },
];

export default function VoicePicker({ selectedId, onSelect }) {
  return (
    <View>
      <Text style={styles.label}>🎙️ Voice</Text>
      <View style={styles.grid}>
        {VOICES.map((v) => (
          <TouchableOpacity
            key={v.id}
            style={[styles.btn, selectedId === v.id && styles.btnActive]}
            onPress={() => onSelect(v.id)}
          >
            <Text style={styles.icon}>{v.icon}</Text>
            <Text style={[styles.name, selectedId === v.id && styles.nameActive]}>{v.label}</Text>
            <Text style={styles.accent}>{v.accent}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { color: '#2ecc71', fontWeight: 'bold', fontSize: 13, marginBottom: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  btn: { width: '22%', backgroundColor: '#1a1a1a', borderRadius: 10, padding: 8, alignItems: 'center', borderWidth: 1, borderColor: '#333' },
  btnActive: { borderColor: '#2ecc71', backgroundColor: '#0d2b1a' },
  icon: { fontSize: 16, marginBottom: 2 },
  name: { color: '#888', fontWeight: 'bold', fontSize: 11 },
  nameActive: { color: '#2ecc71' },
  accent: { color: '#555', fontSize: 9, textAlign: 'center', marginTop: 1 },
});
