import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Every bottom sheet gets the same title + dismiss affordance, so a sheet can
// always be backed out of without hunting for its footer button. `style` is for
// sheets whose body has no padding of its own and needs it on the header.
export function SheetHeader({ title, onClose, style, titleStyle, titleColor = '#fff', closeColor = '#888' }) {
  return (
    <View style={[styles.header, style]}>
      <Text style={[styles.title, { color: titleColor }, titleStyle]}>{title}</Text>
      <TouchableOpacity onPress={onClose} style={styles.close}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <MaterialIcons name="close" size={20} color={closeColor} />
      </TouchableOpacity>
    </View>
  );
}

// Sheets sit flush against the bottom of the window, so their own bottom padding
// is all that keeps the last row clear of the system nav bar / gesture pill. A
// fixed value guesses wrong on both short and tall devices.
export function useSheetInset(extra = 20) {
  const insets = useSafeAreaInsets();
  return { paddingBottom: extra + (insets.bottom || 16) };
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 },
  title: { fontSize: 16, fontWeight: 'bold', flex: 1 },
  close: { padding: 4, marginLeft: 12, marginTop: -2 },
});

export default SheetHeader;
