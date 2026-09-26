import React, { useEffect, useState } from 'react';
import { View, Text, Modal, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { db, auth } from '../firebase';
import CountrySheet from './CountryPicker';
import { SheetHeader, useSheetInset } from './SheetHeader';

// Fills in the profile details a Google sign-in cannot collect.
//
// WHY: sign-up by email asks for a full name and a country. Google sign-in returns a
// display name and an address and nothing else, and nothing asked afterwards. Measured
// Sep 26 2026 across the real user base: 20 of 27 accounts had NO country (every Google
// account), only 8 of 27 had the name mirrored into Firestore at all, and NONE had it
// split into first and last - which is what a personalised email actually needs.
//
// It asks for as little as possible. The name is PREFILLED by splitting the display
// name Google already gave us, so for most people this is a glance and one tap rather
// than typing something the app already knew. Nobody should be asked to retype data we
// hold.
//
// A SURNAME IS OPTIONAL, deliberately. Two accounts here have a single-word name, and
// plenty of people legitimately have one name - requiring a last name would either
// block them or teach them to type a full stop into the field.
//
// Gated on the FIELDS being missing rather than on "is this a new sign-up", which is
// what makes it repair the accounts that already exist: they are signed in and never
// pass through AuthScreen again.
//
// Deliberately DISMISSIBLE, per the sheet rule that every sheet backs out from its
// header. It asks again on the next launch instead of holding the app hostage.
let askedThisSession = false;

// First token is the given name, everything after it the family name. Wrong for the
// cultures that write the family name first - which is exactly why the fields are
// shown for correction rather than saved silently from the split.
function splitName(full) {
  const parts = String(full || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { first: '', last: '' };
  return { first: parts[0], last: parts.slice(1).join(' ') };
}

export default function ProfileGate({ user }) {
  const [visible, setVisible] = useState(false);
  const [picker, setPicker] = useState(false);
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
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
        // No document at all is not this component's problem: the backend creates one
        // lazily on first use, and writing one here would leave a record holding
        // nothing but the answers to this sheet.
        if (cancelled || !snap.exists()) return;
        const d = snap.data() || {};
        if (d.country && d.firstName) return;       // nothing left to ask
        askedThisSession = true;
        const seed = splitName(d.fullName || user.displayName);
        setFirst(d.firstName || seed.first);
        setLast(d.lastName || seed.last);
        setCountry(d.country || null);
        setVisible(true);
      } catch {
        // A read failure is not a reason to interrupt anyone. Try again next launch.
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  const firstName = first.trim();
  const lastName = last.trim();
  const ready = !!firstName && !!country;

  async function save() {
    if (!ready || saving) return;
    setSaving(true);
    setError(null);
    const fullName = [firstName, lastName].filter(Boolean).join(' ');
    try {
      await setDoc(doc(db, 'users', user.uid),
        { firstName, lastName, fullName, country }, { merge: true });
      // Keep Auth in step - ProfileScreen reads displayName, so a name corrected here
      // and not mirrored there would leave the app showing two different names for the
      // same person. Non-fatal: the Firestore record is the one that matters.
      try {
        if (auth.currentUser && fullName && fullName !== auth.currentUser.displayName) {
          await updateProfile(auth.currentUser, { displayName: fullName });
        }
      } catch { /* the profile is saved; a stale displayName is cosmetic */ }
      setVisible(false);
    } catch (e) {
      setError(e.message || 'Could not save that. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  if (!visible) return null;

  // NOT nested. CountrySheet is itself a Modal, and a Modal inside a Modal is
  // unreliable on Android - the inner one can render behind its parent or not at all,
  // which bundles clean, passes lint and every static check, and fails only on a real
  // device. That is the exact shape this project has shipped four times. So the two are
  // siblings and the outer sheet hides while the picker is up.
  return (
    <>
    <Modal visible={!picker} transparent animationType="slide" onRequestClose={() => setVisible(false)}>
      <View style={styles.overlay}>
        {/* useSheetInset returns a STYLE OBJECT ({paddingBottom: n}), so it is spread
            into the array - not read as a number. Writing {paddingBottom: sheetInset}
            nests an object inside a style property, which React Native silently drops,
            and the sheet then sits flush against the Android navigation bar with its
            Save button half under the buttons. Nothing static catches it: it is valid
            JS, valid JSX, and lint has no opinion about the shape of a style value. */}
        <View style={[styles.sheet, sheetInset]}>
          <SheetHeader title="Nice to meet you" onClose={() => setVisible(false)} />
          <Text style={styles.body}>
            We would love to know who we are talking to, and which countries Tonefy is
            reaching, so we can add the languages and voices people actually need. It
            takes a moment, and none of it ever appears on anything you post.
          </Text>

          <Text style={styles.label}>First name</Text>
          <TextInput
            style={styles.input}
            value={first}
            onChangeText={setFirst}
            placeholder="First name"
            placeholderTextColor="#555"
            autoCapitalize="words"
          />

          <Text style={styles.label}>Last name <Text style={styles.optional}>(optional)</Text></Text>
          <TextInput
            style={styles.input}
            value={last}
            onChangeText={setLast}
            placeholder="Last name"
            placeholderTextColor="#555"
            autoCapitalize="words"
          />

          <Text style={styles.label}>Country</Text>
          <TouchableOpacity style={styles.row} onPress={() => setPicker(true)}>
            <MaterialIcons name="public" size={20} color="#888" />
            <Text style={[styles.rowText, { color: country ? '#fff' : '#555' }]}>
              {country || 'Choose your country'}
            </Text>
            <MaterialIcons name="chevron-right" size={20} color="#888" />
          </TouchableOpacity>

          {!!error && <Text style={styles.error}>{error}</Text>}

          <TouchableOpacity
            style={[styles.save, !ready && styles.saveOff]}
            onPress={save}
            disabled={!ready || saving}>
            {saving
              ? <ActivityIndicator color="#04211f" />
              : <Text style={[styles.saveText, !ready && { color: '#555' }]}>Save</Text>}
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
  label: { color: '#cfcfcf', fontSize: 12, fontWeight: '600', marginBottom: 6 },
  optional: { color: '#555', fontWeight: '400' },
  input: {
    backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, color: '#fff', fontSize: 15, marginBottom: 14,
  },
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
