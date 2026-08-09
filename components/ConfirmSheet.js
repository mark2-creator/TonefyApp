import React from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { MaterialIcons } from '@expo/vector-icons';
import { useSheetInset } from './SheetHeader';

// A yes/no question asked in the app's own voice.
//
// Alert.alert draws the platform dialog: a grey slab in the middle of the screen with
// uppercase system buttons and no relationship to anything around it. It is fine for
// "something went wrong" and wrong for a question that is part of an edit, which is
// most of what this app asks.
//
// A bottom sheet, because that is what every other surface here is, and because a
// centre dialog covers the thing being talked about - the timeline the answer applies
// to is exactly what the user wants to see while deciding.

export default function ConfirmSheet({
  visible, icon, title, message, previewUri,
  confirmLabel = 'Confirm', cancelLabel = 'Cancel',
  destructive = false, onConfirm, onCancel, onDismiss,
}) {
  // Dismissing usually means the same as cancelling, but not always: when cancel is
  // itself destructive, a stray tap on the backdrop must not perform it.
  const dismiss = onDismiss || onCancel;
  const sheetInset = useSheetInset(16);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={dismiss}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.dismissArea} activeOpacity={1} onPress={dismiss} />
        <View style={[styles.sheet, sheetInset]}>
          <View style={styles.grabber} />

          {/* The thing being decided about, shown rather than only named. For a
              transition that is its own preview, which is the whole argument for
              picking it and costs nothing here - the file is already cached. */}
          {previewUri ? (
            <ExpoImage source={{ uri: previewUri }} style={styles.preview} contentFit="cover" transition={0} />
          ) : icon ? (
            <View style={styles.iconWrap}>
              <MaterialIcons name={icon} size={24} color="#00d4d4" />
            </View>
          ) : null}

          <Text style={styles.title}>{title}</Text>
          {!!message && <Text style={styles.message}>{message}</Text>}

          <View style={styles.buttons}>
            <TouchableOpacity style={styles.cancel} onPress={onCancel} activeOpacity={0.85}>
              <Text style={styles.cancelText}>{cancelLabel}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirm, destructive && styles.confirmDestructive]}
              onPress={onConfirm}
              activeOpacity={0.85}>
              <Text style={[styles.confirmText, destructive && styles.confirmTextDestructive]}>
                {confirmLabel}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  // Tapping away is the same as declining - the sheet asks about spreading a change
  // that has already been made, so backing out of it is safe.
  dismissArea: { flex: 1 },
  sheet: {
    backgroundColor: '#111', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 24, paddingTop: 12, paddingBottom: 24,
  },
  grabber: {
    width: 36, height: 4, borderRadius: 2, backgroundColor: '#333',
    alignSelf: 'center', marginBottom: 18,
  },
  preview: {
    width: '100%', aspectRatio: 16 / 9, borderRadius: 12, marginBottom: 18,
    backgroundColor: '#1a1a1a',
  },
  iconWrap: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: '#1a1a1a',
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  title: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 8 },
  message: { color: '#888', fontSize: 13, lineHeight: 19 },
  buttons: { flexDirection: 'row', gap: 12, marginTop: 22 },
  cancel: {
    flex: 1, backgroundColor: '#1a1a1a', borderRadius: 12, paddingVertical: 14,
    alignItems: 'center', borderWidth: 1, borderColor: '#2a2a2a',
  },
  cancelText: { color: '#cfcfcf', fontSize: 14, fontWeight: '600' },
  // Green: this is the commit. The sheet exists to land a change across every clip.
  confirm: {
    flex: 1, backgroundColor: '#2ECC71', borderRadius: 12, paddingVertical: 14,
    alignItems: 'center',
  },
  confirmDestructive: { backgroundColor: '#ff6b6b' },
  confirmText: { color: '#04211f', fontSize: 14, fontWeight: '700' },
  confirmTextDestructive: { color: '#2a0505' },
});
