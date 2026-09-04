import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar, Switch, Linking, ScrollView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { diagnosticsEnabled, setDiagnosticsEnabled } from '../utils/diagnostics';

const PRIVACY_URL = 'https://tonefy-ai.fitlifesolutions.site/privacy.html';
const SUPPORT_EMAIL = 'ahumuzamark21213@gmail.com';

/**
 * The screen the privacy policy points at. Its one real job is the diagnostics toggle,
 * which actually gates Sentry (see utils/diagnostics.js) - so the policy's opt-out claim
 * is now true. The rest surfaces the rights the policy already grants (read the policy,
 * manage/delete the account, contact for a data request) so they are reachable in the
 * app rather than only described on a web page.
 */
export default function PrivacyScreen({ navigation }) {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [diag, setDiag] = useState(true);

  useEffect(() => {
    diagnosticsEnabled().then(setDiag);
  }, []);

  async function onToggleDiag(next) {
    setDiag(next);
    await setDiagnosticsEnabled(next);
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.bg, paddingTop: insets.top }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.bg} />
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backRow}>
          <MaterialIcons name="arrow-back" size={20} color={theme.icon} />
          <Text style={[styles.backText, { color: theme.accent }]}>Back</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Privacy</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* The real control. */}
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <MaterialIcons name="bug-report" size={22} color={theme.accent} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowLabel, { color: theme.text }]}>Share diagnostics &amp; crash reports</Text>
                <Text style={[styles.rowDesc, { color: theme.subtext }]}>
                  Helps us find and fix crashes. Includes error details and device type — never
                  your videos, captions, or account content. Turn this off and nothing is sent.
                </Text>
              </View>
            </View>
            <Switch
              value={diag}
              onValueChange={onToggleDiag}
              trackColor={{ false: '#333', true: theme.accent + '80' }}
              thumbColor={diag ? theme.accent : '#888'}
            />
          </View>
        </View>

        {/* Rights the policy grants, made reachable. */}
        <Text style={[styles.sectionLabel, { color: theme.subtext }]}>YOUR DATA</Text>
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border, padding: 0 }]}>
          <TouchableOpacity style={[styles.linkRow, { borderBottomColor: theme.border }]} onPress={() => Linking.openURL(PRIVACY_URL)}>
            <MaterialIcons name="description" size={20} color={theme.icon} />
            <Text style={[styles.linkText, { color: theme.text }]}>Read our Privacy Policy</Text>
            <MaterialIcons name="open-in-new" size={18} color={theme.subtext} />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.linkRow, { borderBottomColor: theme.border }]} onPress={() => navigation.navigate('Profile')}>
            <MaterialIcons name="manage-accounts" size={20} color={theme.icon} />
            <Text style={[styles.linkText, { color: theme.text }]}>Manage or delete your account</Text>
            <MaterialIcons name="chevron-right" size={20} color={theme.subtext} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.linkRow, { borderBottomWidth: 0 }]}
            onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Data request — Tonefy AI')}`)}
          >
            <MaterialIcons name="mail-outline" size={20} color={theme.icon} />
            <Text style={[styles.linkText, { color: theme.text }]}>Request a copy of your data</Text>
            <MaterialIcons name="open-in-new" size={18} color={theme.subtext} />
          </TouchableOpacity>
        </View>

        <Text style={[styles.footNote, { color: theme.subtext }]}>
          You can access, correct, export, or delete your data at any time. Deleting your
          account from Profile removes your account and its data from our servers. For any
          other request, email {SUPPORT_EMAIL} and we&apos;ll respond within 30 days.
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
  sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6, marginTop: 22, marginBottom: 8, marginLeft: 4 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 15, borderBottomWidth: 1 },
  linkText: { flex: 1, fontSize: 14, fontWeight: '500' },
  footNote: { fontSize: 12, marginTop: 18, lineHeight: 18, textAlign: 'center' },
});
