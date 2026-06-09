import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export const CAPTION_STYLES = [
  { id: 'classic', label: 'Classic',  preview: 'Aa', textColor: '#fff',    bg: 'transparent', border: '#555',    desc: 'White + outline' },
  { id: 'tiktok',  label: 'TikTok',   preview: 'Aa', textColor: '#FFD700', bg: 'transparent', border: '#FFD700', desc: 'Bold yellow' },
  { id: 'bold',    label: 'Bold',     preview: 'Aa', textColor: '#fff',    bg: 'transparent', border: '#fff',    desc: 'Large & thick' },
  { id: 'neon',    label: 'Neon',     preview: 'Aa', textColor: '#00FF7F', bg: 'transparent', border: '#00FF7F', desc: 'Green glow' },
  { id: 'fire',    label: 'Fire',     preview: 'Aa', textColor: '#FF6600', bg: 'transparent', border: '#FF6600', desc: 'Orange fire' },
  { id: 'minimal', label: 'Minimal',  preview: 'Aa', textColor: '#ddd',    bg: 'transparent', border: '#444',    desc: 'Clean & simple' },
];

export default function CaptionStylePicker({ selectedId, onSelect }) {
  return (
    <View>
      <Text style={styles.label}>💬 Caption Style</Text>
      <View style={styles.grid}>
        {CAPTION_STYLES.map((s) => (
          <TouchableOpacity
            key={s.id}
            style={[styles.btn, selectedId === s.id && styles.btnActive, { borderColor: selectedId === s.id ? '#2ecc71' : '#333' }]}
            onPress={() => onSelect(s.id)}
          >
            <View style={[styles.previewBox, { backgroundColor: '#000' }]}>
              <Text style={[styles.previewText, { color: s.textColor, textShadowColor: '#000', textShadowRadius: 4 }]}>{s.preview}</Text>
            </View>
            <Text style={[styles.name, selectedId === s.id && styles.nameActive]}>{s.label}</Text>
            <Text style={styles.desc}>{s.desc}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { color: '#2ecc71', fontWeight: 'bold', fontSize: 13, marginBottom: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  btn: { width: '30%', backgroundColor: '#1a1a1a', borderRadius: 10, padding: 8, alignItems: 'center', borderWidth: 1 },
  btnActive: { backgroundColor: '#0d2b1a' },
  previewBox: { width: '100%', height: 36, borderRadius: 6, justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
  previewText: { fontSize: 18, fontWeight: 'bold' },
  name: { color: '#888', fontWeight: 'bold', fontSize: 11 },
  nameActive: { color: '#2ecc71' },
  desc: { color: '#555', fontSize: 9, textAlign: 'center', marginTop: 2 },
});
