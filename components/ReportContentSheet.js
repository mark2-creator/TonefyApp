import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, Modal, StyleSheet, TextInput, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { getAuth } from 'firebase/auth';
import SheetHeader, { useSheetInset } from './SheetHeader';
import { showAlert } from './BrandedAlert';
import { friendlyError } from '../utils/friendlyError';

// Report offensive AI-generated content without leaving the app.
//
// Google Play's AI-Generated Content policy requires it, and Play REMOVED the app on
// Oct 12 2026 because there was no such feature. Every surface that shows something the
// AI made (finished videos, scripts, voiceovers, My Videos) carries a ReportLink that
// opens this sheet; the report goes to POST /api/report-content, which stores it and
// emails the owner.

const BACKEND = 'https://api.fitlifesolutions.site';

const REASONS = [
  { id: 'sexual', label: 'Sexual or explicit' },
  { id: 'violent', label: 'Violent or graphic' },
  { id: 'hateful', label: 'Hateful or discriminatory' },
  { id: 'harassment', label: 'Harassment or bullying' },
  { id: 'dangerous', label: 'Dangerous or illegal' },
  { id: 'misleading', label: 'False or misleading' },
  { id: 'copyright', label: 'Copyright or someone else\'s work' },
  { id: 'other', label: 'Something else' },
];

export default function ReportContentSheet({ visible, onClose, kind = 'video', contentUrl, contentText, screen }) {
  const [reason, setReason] = useState(null);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const sheetInset = useSheetInset(16);

  const close = () => { if (!sending) { setReason(null); setNote(''); onClose?.(); } };

  const send = async () => {
    if (!reason || sending) return;
    setSending(true);
    try {
      const user = getAuth().currentUser;
      const token = user ? await user.getIdToken() : null;
      const res = await fetch(`${BACKEND}/api/report-content`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          kind, reason, note: note.trim() || null, screen,
          contentUrl: contentUrl || null,
          contentText: contentText || null,
        }),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok || !out.ok) throw Object.assign(new Error(out.error || `HTTP ${res.status}`), { userMessage: out.error });
      setSending(false);
      setReason(null); setNote('');
      onClose?.();
      // After the sheet has closed: never a Modal over a Modal.
      setTimeout(() => showAlert('Thank you for your report',
        'Our team will review it. Reports help us improve what Tonefy AI creates.'), 350);
    } catch (e) {
      setSending(false);
      onClose?.();
      setTimeout(() => showAlert('Report not sent', e.userMessage || friendlyError(e, 'Your report could not be sent. Please try again.')), 350);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TouchableOpacity style={styles.dismissArea} activeOpacity={1} onPress={close} />
        <View style={[styles.sheet, sheetInset]}>
          <SheetHeader title="Report content" onClose={close} />
          <ScrollView style={{ flexGrow: 0 }} keyboardShouldPersistTaps="handled">
            <Text style={styles.intro}>
              Tell us what is wrong with this AI-generated content. Your report goes to our team for review.
            </Text>
            {REASONS.map(r => {
              const on = reason === r.id;
              return (
                <TouchableOpacity key={r.id} style={styles.row} onPress={() => setReason(r.id)} activeOpacity={0.8}>
                  <MaterialIcons name={on ? 'radio-button-checked' : 'radio-button-unchecked'} size={20} color={on ? '#2ECC71' : '#888'} />
                  <Text style={[styles.rowText, on && { color: '#fff' }]}>{r.label}</Text>
                </TouchableOpacity>
              );
            })}
            <TextInput
              style={styles.note}
              value={note}
              onChangeText={setNote}
              placeholder="Add details (optional)"
              placeholderTextColor="#555"
              multiline
              maxLength={1000}
            />
          </ScrollView>
          <TouchableOpacity
            style={[styles.send, !reason && styles.sendOff]}
            onPress={send}
            disabled={!reason || sending}
            activeOpacity={0.85}>
            {sending
              ? <ActivityIndicator color="#04211f" />
              : <Text style={[styles.sendText, !reason && { color: '#555' }]}>Send report</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// The entry point placed under each AI result: a quiet flag + label, not a green
// action - it is neither a commit nor media handling, so it stays neutral.
export function ReportLink({ onPress, label = 'Report this content', style }) {
  return (
    <TouchableOpacity style={[styles.link, style]} onPress={onPress} activeOpacity={0.7}
      accessibilityRole="button" accessibilityLabel={label}>
      <MaterialIcons name="outlined-flag" size={20} color="#888" />
      <Text style={styles.linkText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  dismissArea: { flex: 1 },
  sheet: {
    backgroundColor: '#111', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 24, paddingTop: 16, maxHeight: '90%',
  },
  intro: { color: '#888', fontSize: 13, lineHeight: 19, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
  rowText: { color: '#cfcfcf', fontSize: 15, flex: 1 },
  note: {
    marginTop: 8, minHeight: 72, maxHeight: 140, backgroundColor: '#1a1a1a', borderRadius: 12,
    borderWidth: 1, borderColor: '#2a2a2a', color: '#fff', padding: 12, fontSize: 14,
    textAlignVertical: 'top',
  },
  send: {
    marginTop: 16, backgroundColor: '#2ECC71', borderRadius: 12, paddingVertical: 14, alignItems: 'center',
  },
  sendOff: { backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2a2a2a' },
  sendText: { color: '#04211f', fontSize: 15, fontWeight: '700' },
  link: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 12, alignSelf: 'center',
  },
  linkText: { color: '#888', fontSize: 13, fontWeight: '600' },
});
