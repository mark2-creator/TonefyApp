import React, { useEffect, useState } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import CountrySheet from './CountryPicker';
import { SheetHeader, useSheetInset } from './SheetHeader';

// Asks a signed-in account for its country when the profile has none.
//
// WHY THIS EXISTS: sign-up by email asks for a full name and a country; Google
// sign-in cannot, because Google hands back a name and an address and nothing else.
// Nothing asked afterwards, so the field simply stayed empty - and measured on
// Sep 26 2026 that was 20 of 27 accounts, EVERY Google account, with only 6 of 27
// carrying a country at all. The admin screen's country breakdown was reporting on
// a quarter of the user base without saying so.
//
// Gated on the FIELD being missing rather than on "is this a new sign-up", which is
// what makes it fix the existing accounts too: the twenty already signed in never
// pass through the auth screen again, so anything hooked to sign-up would only ever
// have helped future users.
//
// Deliberately DISMISSIBLE, per the sheet rule that every sheet backs out from its
// header. A required field would capture marginally more on the first showing and
// trap anyone whose country is genuinely not on the list; this asks again on the
// next launch instead, which gets there without holding the app hostage.
let askedThisSession = false;

export default function CountryGate({ user }) {
  const [visible, setVisible] = useState(false);
  const [picker, setPicker] = useState(false);
  const [country, setCountry] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const sheetInset = useSheetInset(16);

  useEffect(() => {
    if (!user || askedThisSession) return;
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        // No document at all is not this component's problem to solve - the backend
        // creates one lazily on first use, and asking someone for a country before
        // anything of theirs exists would write a document with nothing else in it.
        if (cancelled || !snap.exists() || snap.data()?.country) return;
        askedThisSession = true;
        setVisible(true);
      } catch {
        // A read failure is not a reason to interrupt someone. Try again next launch.
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  async function save() {
    if (!country || saving) return;
    setSaving(true);
    setError(null);
    try {
      await setDoc(doc(db, 'users', user.uid), { country }, { merge: true });
      setVisible(false);
    } catch (e) {
      setError(e.message || 'Could not save that. Try again.');
    } finally {
      setSaving(false);
    }
  }

  if (!visible) return null;

  // NOT nested. CountrySheet is itself a Modal, and a Modal inside a Modal is unreliable
  // on Android - the inner one can render behind its parent or not at all, which bundles
  // clean, passes lint and every static check, and fails only on a real device. That is
  // the exact failure shape this project has shipped four times. So the two are siblings
  // and the outer one hides while the picker is up: never two modals on screen at once.
  return (
    <>
    <Modal visible={!picker} transparent animationType="slide" onRequestClose={() => setVisible(false)}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { paddingBottom: sheetInset }]}>
          <SheetHeader title="Where are you based?" onClose={() => setVisible(false)} />
          <Text style={styles.body}>
            It helps us know which countries Tonefy is reaching, and which languages and
            voices to add next. It is never shown on anything you post.
          </Text>

          <TouchableOpacity style={styles.row} onPress={() => setPicker(true)}>
            <MaterialIcons name="public" size={20} color="#888" />
            <Text style={[styles.rowText, { color: country ? '#fff' : '#888' }]}>
              {country || 'Choose your country'}
            </Text>
            <MaterialIcons name="chevron-right" size={20} color="#888" />
          </TouchableOpacity>

          {!!error && <Text style={styles.error}>{error}</Text>}

          <TouchableOpacity
            style={[styles.save, !country && styles.saveOff]}
            onPress={save}
            disabled={!country || saving}>
            {saving
              ? <ActivityIndicator color="#04211f" />
              : <Text style={[styles.saveText, !country && { color: '#555' }]}>Save</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>

    <CountrySheet
      visible={picker}
      value={country}
      onSelect={setCountry}
      onClose={() => setPicker(false)}
    />
    </>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#111', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24 },
  body: { color: '#888', fontSize: 13, lineHeight: 19, marginBottom: 18 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2a2a2a',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14,
  },
  rowText: { flex: 1, fontSize: 15 },
  error: { color: '#ff6b6b', fontSize: 13, marginTop: 12 },
  // Green: this is the control that lands the value.
  save: {
    backgroundColor: '#2ECC71', borderRadius: 12, paddingVertical: 15,
    alignItems: 'center', marginTop: 18,
  },
  saveOff: { backgroundColor: '#1a1a1a' },
  saveText: { color: '#04211f', fontSize: 15, fontWeight: '700' },
});
