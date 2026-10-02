// "AI scenes" option for the three generation screens (Idea / Script / Url to Video).
//
// The server generates the first N scenes with a video model and fills the rest
// with stock footage, so this is a count, not a switch: Off, 1, 2... up to what one
// video on this plan may use. Hook first - scene 1 is always the first generated.
//
// Three states, and they are different things to tell someone:
//   - the feature is not switched on on the server   -> render nothing at all
//   - it is, and this plan has none                    -> diamond + "Pro", opens plans
//   - it is, and this plan has some                    -> chips, with what is left
//
// Reads its own status so a screen only has to hold the chosen number. Refetches on
// focus, because rendering a video spends the allowance it is showing.

import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { getAuth } from 'firebase/auth';
import { useTheme } from '../context/ThemeContext';
import { navigationRef } from '../utils/navigationRef';

const BACKEND = 'https://api.fitlifesolutions.site';

export default function AiScenesRow({ value, onChange }) {
  const { theme } = useTheme();
  const [status, setStatus] = useState(null);

  const load = useCallback(async () => {
    try {
      const user = getAuth().currentUser;
      if (!user) return;
      const token = await user.getIdToken();
      const res = await fetch(`${BACKEND}/api/ai-scenes/status`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return;
      setStatus(await res.json());
    } catch (e) {
      // A row that cannot load stays hidden; the video still renders with stock footage.
      console.warn('ai-scenes status:', e.message);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Never ask for more than is left - the server clamps anyway, but a chip that
  // promises 2 when 1 remains would make the result look like a failure.
  const max = status?.enabled ? Math.min(status.perVideo, status.remaining) : 0;
  useEffect(() => {
    if (status && value > max) onChange(max);
  }, [status, max, value, onChange]);

  if (!status?.available) return null;

  const openPlans = () => navigationRef.isReady() && navigationRef.navigate('Subscription');

  if (!status.enabled) {
    return (
      <TouchableOpacity style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]} onPress={openPlans} activeOpacity={0.7}>
        <View style={styles.head}>
          <MaterialIcons name="auto-awesome" size={20} color="#888" />
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: theme.subtext }]}>AI scenes</Text>
            <Text style={[styles.sub, { color: theme.subtext }]}>Generate your opening scenes with AI instead of stock footage</Text>
          </View>
          <MaterialIcons name="diamond" size={14} color="#f5c451" />
          <Text style={styles.pro}>Pro</Text>
        </View>
      </TouchableOpacity>
    );
  }

  const options = [0, ...Array.from({ length: status.perVideo }, (_, i) => i + 1)];
  const sub = status.remaining > 0
    ? `${status.remaining} of ${status.perCycle} left this month. Scenes that cannot be generated use stock footage and are not counted.`
    : `All ${status.perCycle} used this month. They refresh with your credits.`;

  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={styles.head}>
        <MaterialIcons name="auto-awesome" size={20} color="#888" />
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: theme.text }]}>AI scenes</Text>
          <Text style={[styles.sub, { color: theme.subtext }]}>{sub}</Text>
        </View>
      </View>
      <View style={styles.chips}>
        {options.map(n => {
          const active = value === n;
          const disabled = n > max;
          return (
            <TouchableOpacity
              key={n}
              disabled={disabled}
              onPress={() => onChange(n)}
              style={[styles.chip, { backgroundColor: theme.inputBg, borderColor: theme.border }, active && styles.chipActive, disabled && { opacity: 0.35 }]}
            >
              <Text style={[styles.chipText, { color: theme.text }, active && styles.chipTextActive]}>
                {n === 0 ? 'Off' : n === 1 ? 'First scene' : `First ${n}`}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 10 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: 15, fontWeight: '600' },
  sub: { fontSize: 12, marginTop: 2, lineHeight: 16 },
  pro: { color: '#f5c451', fontSize: 12, fontWeight: '700', marginLeft: -6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  chip: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1 },
  chipActive: { backgroundColor: '#2ECC71', borderColor: '#2ECC71' },
  chipText: { fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: '#000' },
});
