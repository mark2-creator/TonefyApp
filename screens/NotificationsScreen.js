import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar, Switch, Alert, ScrollView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import {
  notificationsAvailable,
  remindersEnabled,
  requestNotificationPermission,
  scheduleReminders,
  cancelReminders,
} from '../utils/notifications';
import { showAlert } from '../components/BrandedAlert';

export default function NotificationsScreen({ navigation }) {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const available = notificationsAvailable();
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!available) return;
    remindersEnabled().then(setEnabled);
  }, [available]);

  async function onToggle(next) {
    if (!available || busy) return;
    setBusy(true);
    if (next) {
      const granted = await requestNotificationPermission();
      if (!granted) {
        showAlert(
          'Notifications Off',
          'Tonefy AI needs notification permission to send reminders. You can allow it in your phone\'s system settings.'
        );
        setBusy(false);
        return;
      }
      const ok = await scheduleReminders();
      setEnabled(ok);
    } else {
      await cancelReminders();
      setEnabled(false);
    }
    setBusy(false);
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.bg, paddingTop: insets.top }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.bg} />
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backRow}>
          <MaterialIcons name="arrow-back" size={20} color={theme.icon} />
          <Text style={[styles.backText, { color: theme.accent }]}>Back</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Notifications</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <MaterialIcons name="notifications-active" size={22} color={theme.accent} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowLabel, { color: theme.text }]}>Re-engagement Reminders</Text>
                <Text style={[styles.rowDesc, { color: theme.subtext }]}>
                  Occasional nudges if you haven't made a video in a while.
                </Text>
              </View>
            </View>
            {busy ? (
              <Text style={[styles.status, { color: theme.subtext }]}>…</Text>
            ) : (
              <Switch
                value={enabled}
                onValueChange={onToggle}
                disabled={!available}
                trackColor={{ false: '#333', true: theme.accent + '80' }}
                thumbColor={enabled ? theme.accent : '#888'}
              />
            )}
          </View>
        </View>

        {!available && (
          <View style={[styles.noteCard, { backgroundColor: isDark ? '#2a1f00' : '#fff3cd', borderColor: '#ffaa00' }]}>
            <MaterialIcons name="info-outline" size={18} color={isDark ? '#ffcc44' : '#8a6500'} />
            <Text style={[styles.noteText, { color: isDark ? '#ffcc44' : '#8a6500' }]}>
              Reminders need a small app update that hasn't reached this install yet. This
              setting will turn on automatically once you're on the newest version.
            </Text>
          </View>
        )}

        <Text style={[styles.footNote, { color: theme.subtext }]}>
          You can also turn notifications off entirely for Tonefy AI in your phone's system
          settings at any time.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1 },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 4, width: 70 },
  backText: { fontSize: 15, fontWeight: '600' },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  content: { padding: 16, paddingBottom: 48 },
  card: { borderWidth: 1, borderRadius: 14, padding: 14 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  rowLabel: { fontSize: 15, fontWeight: '600' },
  rowDesc: { fontSize: 12, marginTop: 3, lineHeight: 17 },
  status: { fontSize: 13 },
  noteCard: { flexDirection: 'row', gap: 10, borderWidth: 1, borderRadius: 12, padding: 14, marginTop: 14, alignItems: 'flex-start' },
  noteText: { flex: 1, fontSize: 12, lineHeight: 18 },
  footNote: { fontSize: 12, marginTop: 18, lineHeight: 18, textAlign: 'center' },
});
