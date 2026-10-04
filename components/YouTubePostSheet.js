// What a YouTube upload needs that a caption cannot give it (Oct 4 2026).
//
// - A real TITLE. It used to be the caption's first line, hashtags and all - fine for
//   TikTok words, poor as a YouTube title. Prefilled from that line with hashtags removed,
//   and editable (YouTube caps titles at 100 characters).
// - The AUDIENCE declaration YouTube requires of every upload ("made for kids?"). The app
//   used to answer "no" for everyone; it is the creator's legal declaration to make. The
//   answer is remembered on the account, so it is a one-time question, not a toll.
//
// Uploads are forced PRIVATE until Google's API review passes - said here, before posting,
// so the result is not a surprise.

import React, { useEffect, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, TextInput, ActivityIndicator, StyleSheet, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { SheetHeader, useSheetInset } from './SheetHeader';
import { YouTubeLogo } from './BrandLogos';

/** The first line of a caption, without hashtags, as a YouTube title. */
export function youtubeTitleFrom(caption) {
  const first = String(caption || '').split('\n')[0] || '';
  return first.replace(/(^|\s)#[^\s#]+/g, ' ').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 100);
}

export default function YouTubePostSheet({ visible, onClose, onConfirm, caption, madeForKids, posting = false, mode = 'post' }) {
  const sheetInset = useSheetInset();
  const [title, setTitle] = useState('');
  const [kids, setKids] = useState(null);

  useEffect(() => {
    if (!visible) return;
    setTitle(youtubeTitleFrom(caption));
    setKids(typeof madeForKids === 'boolean' ? madeForKids : null);
  }, [visible, caption, madeForKids]);

  const canGo = !posting && kids !== null && (mode === 'settings' || title.trim().length > 0);

  const option = (value, label, desc) => (
    <TouchableOpacity style={styles.row} onPress={() => setKids(value)}>
      <MaterialIcons name={kids === value ? 'radio-button-checked' : 'radio-button-unchecked'} size={20} color={kids === value ? '#2ECC71' : '#555'} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.optText, kids === value && styles.optOn]}>{label}</Text>
        <Text style={styles.optDesc}>{desc}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, sheetInset]}>
          <SheetHeader title={mode === 'post' ? 'Post to YouTube' : 'YouTube audience'} onClose={onClose} />
          <View style={styles.brand}>
            <YouTubeLogo size={20} />
            <Text style={styles.brandName}>YouTube</Text>
          </View>
          <ScrollView style={{ flexGrow: 0, flexShrink: 1 }} keyboardShouldPersistTaps="handled">
            {mode === 'post' && (
              <>
                <Text style={styles.section}>Title</Text>
                <TextInput
                  style={styles.input} value={title} onChangeText={t => setTitle(t.replace(/[<>]/g, ''))}
                  maxLength={100} placeholder="What is this video about?" placeholderTextColor="#666"
                />
                <Text style={styles.count}>{title.length}/100</Text>
                <Text style={styles.hint}>Your caption becomes the description.</Text>
              </>
            )}
            <Text style={styles.section}>Is this video made for kids?</Text>
            <Text style={styles.hint}>YouTube asks every creator this. We remember your answer.</Text>
            {option(false, 'No, it is not made for kids', 'The usual answer for most creators.')}
            {option(true, 'Yes, it is made for kids', 'Comments and some features are turned off on YouTube.')}
            {mode === 'post' && (
              <View style={styles.note}>
                <MaterialIcons name="lock-outline" size={16} color="#888" />
                <Text style={styles.noteText}>
                  While our YouTube app is under Google's review, uploads arrive as private. Open it in YouTube Studio to make it public.
                </Text>
              </View>
            )}
          </ScrollView>
          <TouchableOpacity
            style={[styles.postBtn, !canGo && styles.postBtnOff]} disabled={!canGo}
            onPress={() => onConfirm({ title: title.trim(), madeForKids: kids })}
          >
            {posting ? <ActivityIndicator color="#000" />
              : <Text style={styles.postBtnText}>{mode === 'post' ? 'Upload to YouTube' : 'Save'}</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#111', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, maxHeight: '90%' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  brandName: { color: '#FF0000', fontSize: 15, fontWeight: '700' },
  section: { color: '#888', fontSize: 12, fontWeight: '700', letterSpacing: 1, marginTop: 16, marginBottom: 4, textTransform: 'uppercase' },
  input: { backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 12, color: '#fff', fontSize: 15, padding: 12 },
  count: { color: '#666', fontSize: 12, textAlign: 'right', marginTop: 4 },
  hint: { color: '#888', fontSize: 13, lineHeight: 18, marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 10 },
  optText: { color: '#eee', fontSize: 15 },
  optOn: { color: '#fff', fontWeight: '700' },
  optDesc: { color: '#888', fontSize: 12, marginTop: 2 },
  note: { flexDirection: 'row', gap: 8, backgroundColor: '#181818', borderRadius: 12, padding: 12, marginTop: 12 },
  noteText: { color: '#bbb', fontSize: 13, lineHeight: 18, flex: 1 },
  postBtn: { backgroundColor: '#2ECC71', borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 16 },
  postBtnOff: { backgroundColor: '#2a2a2a' },
  postBtnText: { color: '#000', fontSize: 15, fontWeight: '700' },
});
