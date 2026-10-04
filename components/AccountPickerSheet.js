// Which of several connected accounts a post goes to (Oct 4 2026).
//
// Creator lets someone connect several LinkedIn, Pinterest, Facebook or Instagram accounts,
// and every post used to go to ALL of them. Only TikTok's sheet let them choose. All are
// ticked by default (the old behaviour), and at least one must stay ticked.

import React, { useEffect, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { SheetHeader, useSheetInset } from './SheetHeader';

export default function AccountPickerSheet({ visible, onClose, onConfirm, label, color = '#fff', Logo, accounts = [], selected }) {
  const sheetInset = useSheetInset();
  const [on, setOn] = useState([]);

  useEffect(() => {
    if (!visible) return;
    setOn(Array.isArray(selected) && selected.length ? selected : accounts.map(a => a.accountId));
  }, [visible, selected, accounts]);

  const toggle = (id) => setOn(cur => (cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id]));

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, sheetInset]}>
          <SheetHeader title="Post to which accounts?" onClose={onClose} />
          <View style={styles.brand}>
            {Logo ? <Logo size={20} /> : null}
            <Text style={[styles.brandName, { color }]}>{label}</Text>
          </View>
          <ScrollView style={{ flexGrow: 0, flexShrink: 1 }}>
            {accounts.map(a => {
              const ticked = on.includes(a.accountId);
              return (
                <TouchableOpacity key={a.accountId} style={styles.row} onPress={() => toggle(a.accountId)}>
                  <MaterialIcons name={ticked ? 'check-box' : 'check-box-outline-blank'} size={22} color={ticked ? '#2ECC71' : '#555'} />
                  <Text style={[styles.name, ticked && styles.nameOn]} numberOfLines={1}>{a.name || a.accountId}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <TouchableOpacity
            style={[styles.btn, !on.length && styles.btnOff]} disabled={!on.length}
            onPress={() => onConfirm(on.length === accounts.length ? null : on)}
          >
            <Text style={styles.btnText}>{on.length ? `Use ${on.length} account${on.length === 1 ? '' : 's'}` : 'Choose at least one'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#111', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, maxHeight: '80%' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  brandName: { fontSize: 15, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#2a2a2a' },
  name: { color: '#eee', fontSize: 15, flex: 1 },
  nameOn: { color: '#fff', fontWeight: '700' },
  btn: { backgroundColor: '#2ECC71', borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 16 },
  btnOff: { backgroundColor: '#2a2a2a' },
  btnText: { color: '#000', fontSize: 15, fontWeight: '700' },
});
