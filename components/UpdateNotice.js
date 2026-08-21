import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// What happened to the update, said out loud.
//
// Both outcomes used to be silent. A download that finished late applied itself on the
// next launch with no indication, and one that failed left the app looking current when
// it was not - which is how a fix that shipped gets reported as still broken. It did,
// twice, on Aug 18, and the second time cost a full round trip to establish that the
// phone simply did not have the code yet.
//
// Floats over the bottom chrome rather than taking a row of its own, the same shape and
// offset as the jobs bar - anything that pushes the tab bar up when a background task
// exists reads as a layout accident.
const TAB_H = 60;

export default function UpdateNotice({ state, onDismiss }) {
  const insets = useSafeAreaInsets();
  const ready = state === 'ready';
  return (
    <TouchableOpacity
      style={[styles.bar, ready ? styles.ready : styles.failed, { bottom: TAB_H + insets.bottom + 8 }]}
      activeOpacity={0.85}
      onPress={onDismiss}
    >
      <MaterialIcons name={ready ? 'system-update' : 'cloud-off'} size={18} color={ready ? '#2ECC71' : '#ffb4ab'} />
      <View style={styles.text}>
        <Text style={styles.title}>
          {ready ? 'Update downloaded' : 'Update could not download'}
        </Text>
        <Text style={styles.sub} numberOfLines={2}>
          {ready
            ? 'It will apply the next time you open Tonefy.'
            : 'You are still on the previous version. It will retry on a better connection.'}
        </Text>
      </View>
      <MaterialIcons name="close" size={18} color="#fff" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute', left: 10, right: 10,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#141414', borderRadius: 14, borderWidth: 1,
    paddingHorizontal: 14, paddingVertical: 10,
    elevation: 8,
    shadowColor: '#000', shadowOpacity: 0.45, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
  },
  ready: { borderColor: '#1f4d33' },
  failed: { borderColor: '#4d1f1f' },
  text: { flex: 1 },
  title: { color: '#fff', fontSize: 13, fontWeight: '700' },
  sub: { color: '#fff', opacity: 0.7, fontSize: 11, marginTop: 2 },
});
