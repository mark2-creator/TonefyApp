import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// A drop-in replacement for React Native's Alert.alert - the same signature
// (title, message, buttons, options), so converting a call site is a literal
// token swap. Native Alert.alert renders the OS's own dialog, which nothing
// in this app can style; this renders the same bottom-sheet chrome every
// other modal in the app already uses, so a popup finally looks like it
// belongs to Tonefy AI instead of to Android.
//
// Imperative by design, like the thing it replaces: a module-level ref to
// the mounted host's own state setter, set once in App.js and never touched
// by any of the ~180 call sites that just want to call a function.
let _open = null;

export function showAlert(title, message, buttons, options) {
  if (_open) _open(title, message, buttons, options);
  else console.warn('[BrandedAlert] host not mounted yet:', title, message);
}

function buttonVariant(style) {
  if (style === 'destructive') return { btn: styles.buttonDestructive, text: styles.buttonTextDestructive };
  if (style === 'cancel') return { btn: styles.buttonCancel, text: styles.buttonTextCancel };
  return { btn: styles.buttonDefault, text: styles.buttonTextDefault };
}

export default function BrandedAlertHost() {
  const [state, setState] = useState(null);
  const insets = useSafeAreaInsets();

  const open = useCallback((title, message, buttons, options) => {
    // A bare Alert.alert(title, message) with no buttons array still shows a
    // dismissible "OK" - the same default the thing being replaced has.
    const normalized = buttons && buttons.length > 0 ? buttons : [{ text: 'OK' }];
    setState({ title, message, buttons: normalized, cancelable: options?.cancelable !== false });
  }, []);

  useEffect(() => {
    _open = open;
    return () => { if (_open === open) _open = null; };
  }, [open]);

  const dismiss = useCallback(() => setState(null), []);

  const press = useCallback((btn) => {
    dismiss();
    // Closing first, matching the OS dialog this replaces - a button's own
    // action (often a navigation or another modal) should never have to
    // fight this sheet for the screen.
    if (btn.onPress) btn.onPress();
  }, [dismiss]);

  if (!state) return null;

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={() => { if (state.cancelable) dismiss(); }}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={() => { if (state.cancelable) dismiss(); }}
      >
        {/* Swallows the touch so tapping the sheet itself doesn't fall through
            to the overlay's own dismiss handler behind it. */}
        <TouchableOpacity activeOpacity={1} onPress={() => {}} style={{ width: '100%' }}>
          <View style={[styles.sheet, { paddingBottom: 20 + insets.bottom }]}>
            {!!state.title && <Text style={styles.title}>{state.title}</Text>}
            {!!state.message && <Text style={styles.message}>{state.message}</Text>}
            <View style={styles.buttonRow}>
              {state.buttons.map((btn, i) => {
                const v = buttonVariant(btn.style);
                return (
                  <TouchableOpacity
                    key={i}
                    style={[styles.button, v.btn]}
                    onPress={() => press(btn)}
                  >
                    <Text style={[styles.buttonText, v.text]} numberOfLines={1}>{btn.text}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#111', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 24, borderWidth: 1, borderColor: '#2a2a2a', borderBottomWidth: 0,
  },
  title: { color: '#fff', fontSize: 17, fontWeight: 'bold', marginBottom: 10 },
  message: { color: '#cfcfcf', fontSize: 14, lineHeight: 20, marginBottom: 24 },
  buttonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  button: { flexGrow: 1, flexBasis: '45%', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 10 },
  buttonText: { fontSize: 14, fontWeight: '700' },
  buttonDefault: { backgroundColor: '#2ECC71' },
  buttonTextDefault: { color: '#000' },
  buttonCancel: { backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2a2a2a' },
  buttonTextCancel: { color: '#fff' },
  buttonDestructive: { backgroundColor: '#2a1a1a', borderWidth: 1, borderColor: '#ff6b6b' },
  buttonTextDestructive: { color: '#ff6b6b' },
});
