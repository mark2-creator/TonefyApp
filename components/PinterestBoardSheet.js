// Choose which Pinterest board a Pin goes to (Oct 3 2026).
//
// Before this, the server took whatever board Pinterest listed first, so every Pin landed
// on the same board - the owner's went to "Fitness & Workouts" without his choosing it.
//
// One list per connected Pinterest ACCOUNT: a board belongs to one account's token, so a
// choice is made per account and travels as { boards: { accountId: boardId } }. The
// sheet opens on the last board used (remembered by the caller) or the first one, so a
// second Pin to the same board is one tap.

import React, { useEffect, useState } from 'react';
import {
  Modal, View, Text, TouchableOpacity, ScrollView, ActivityIndicator, StyleSheet,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { auth } from '../firebase';
import { SheetHeader, useSheetInset } from './SheetHeader';
import { PinterestLogo } from './BrandLogos';

const BACKEND = 'https://api.fitlifesolutions.site';

export default function PinterestBoardSheet({ visible, onClose, onConfirm, remembered = {}, posting = false }) {
  const sheetInset = useSheetInset();
  const [accounts, setAccounts] = useState(null);
  const [error, setError] = useState(null);
  const [chosen, setChosen] = useState({});   // accountId -> { id, name }

  useEffect(() => {
    if (!visible) return;
    let live = true;
    setAccounts(null); setError(null);
    (async () => {
      try {
        const token = await auth.currentUser?.getIdToken();
        const r = await fetch(`${BACKEND}/api/pinterest/boards`, { headers: { Authorization: `Bearer ${token}` } });
        const j = await r.json();
        if (!live) return;
        if (!r.ok) { setError(j.error || 'Could not load your boards.'); return; }
        const list = j.accounts || [];
        // Start from the remembered board if it still exists, else the first one.
        const start = {};
        for (const a of list) {
          const keep = a.boards.find(b => b.id === remembered[a.accountId]?.id);
          const pick = keep || a.boards[0];
          if (pick) start[a.accountId] = { id: pick.id, name: pick.name };
        }
        setChosen(start);
        setAccounts(list);
      } catch (e) {
        if (live) setError('Could not load your boards. Check your connection and try again.');
      }
    })();
    return () => { live = false; };
    // remembered is read once per opening on purpose; a change mid-sheet would undo a tap.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const noBoards = accounts && accounts.every(a => a.boards.length === 0);
  const canPost = !!accounts && !noBoards && Object.keys(chosen).length > 0 && !posting;
  const many = (accounts?.length || 0) > 1;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, sheetInset]}>
          <SheetHeader title="Choose a board" onClose={onClose} />
          <View style={styles.brand}>
            <PinterestLogo size={20} />
            <Text style={styles.brandName}>Pinterest</Text>
          </View>

          {error ? (
            <Text style={styles.error}>{error}</Text>
          ) : !accounts ? (
            <ActivityIndicator color="#2ECC71" style={{ marginVertical: 40 }} />
          ) : noBoards ? (
            <Text style={styles.error}>You have no boards yet. Create one on Pinterest, then come back.</Text>
          ) : (
            <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
              {accounts.map(a => (
                <View key={a.accountId}>
                  {many && <Text style={styles.account}>{a.name || a.accountId}</Text>}
                  {a.boards.map(b => {
                    const on = chosen[a.accountId]?.id === b.id;
                    return (
                      <TouchableOpacity
                        key={b.id}
                        style={styles.row}
                        onPress={() => setChosen(c => ({ ...c, [a.accountId]: { id: b.id, name: b.name } }))}
                      >
                        <MaterialIcons name={on ? 'radio-button-checked' : 'radio-button-unchecked'} size={20} color={on ? '#2ECC71' : '#555'} />
                        <Text style={[styles.boardName, on && styles.boardOn]} numberOfLines={1}>{b.name}</Text>
                        {b.privacy && b.privacy !== 'PUBLIC' ? (
                          <View style={styles.secret}>
                            <MaterialIcons name="visibility-off" size={12} color="#888" />
                            <Text style={styles.secretText}>Secret</Text>
                          </View>
                        ) : null}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </ScrollView>
          )}

          <TouchableOpacity
            style={[styles.postBtn, !canPost && styles.postBtnOff]}
            disabled={!canPost}
            onPress={() => onConfirm(chosen)}
          >
            {posting ? <ActivityIndicator color="#000" /> : <Text style={styles.postBtnText}>Post to Pinterest</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#111', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, maxHeight: '85%' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  brandName: { color: '#E60023', fontSize: 15, fontWeight: '700' },
  list: { flexGrow: 0, flexShrink: 1 },
  account: { color: '#888', fontSize: 12, fontWeight: '700', letterSpacing: 1, marginTop: 12, marginBottom: 2, textTransform: 'uppercase' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#2a2a2a' },
  boardName: { color: '#eee', fontSize: 15, flex: 1 },
  boardOn: { color: '#fff', fontWeight: '700' },
  secret: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  secretText: { color: '#888', fontSize: 12 },
  error: { color: '#bbb', fontSize: 14, lineHeight: 20, marginVertical: 24 },
  postBtn: { backgroundColor: '#2ECC71', borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 16 },
  postBtnOff: { backgroundColor: '#2a2a2a' },
  postBtnText: { color: '#000', fontSize: 15, fontWeight: '700' },
});
