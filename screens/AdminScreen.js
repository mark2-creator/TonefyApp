import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { auth } from '../firebase';
import { useTheme } from '../context/ThemeContext';
import { showAlert } from '../components/BrandedAlert';

const BACKEND = 'https://api.fitlifesolutions.site';

// Who is using the app - which nothing in Tonefy could answer before this.
//
// Reads one endpoint that does the aggregating server-side. Doing it here would mean
// shipping every user's record to a phone to count them, which is both slow and the
// wrong place for that data to be.
//
// The endpoint is gated by uid on the server. Hiding the row that opens this screen is
// courtesy, not security: someone who edits the bundle still gets 404.
function Stat({ label, value, hint, theme }) {
  return (
    <View style={[styles.stat, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{value}</Text>
      <Text style={[styles.statLabel, { color: theme.subtext }]} numberOfLines={2}>{label}</Text>
      {!!hint && <Text style={styles.statHint} numberOfLines={1}>{hint}</Text>}
    </View>
  );
}

export default function AdminScreen({ navigation }) {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`${BACKEND}/api/admin/stats`, { headers: { Authorization: 'Bearer ' + token } });
      if (res.status === 404) throw new Error('This account does not have admin access.');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Could not load stats.');
      setData(json);
    } catch (e) {
      showAlert('Admin', e.message || 'Could not load stats.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const u = data?.users;
  const v = data?.videos;
  const r = data?.revenue;

  return (
    <View style={[styles.screen, { backgroundColor: theme.bg, paddingTop: insets.top, paddingBottom: insets.bottom || 16 }]}>
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <MaterialIcons name="arrow-back" size={20} color={theme.icon} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.text }]}>Admin</Text>
        <View style={{ width: 50 }} />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color="#2ECC71" /></View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.body}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#2ECC71" />}
        >
          <Text style={[styles.section, { color: theme.subtext }]}>PEOPLE</Text>
          <View style={styles.row}>
            <Stat theme={theme} label="Total accounts" value={u?.total ?? '—'} />
            <Stat theme={theme} label="Signed in this week" value={u?.signedIn7 ?? '—'} />
          </View>
          <View style={styles.row}>
            <Stat theme={theme} label="New this week" value={u?.signups7 ?? '—'} />
            <Stat theme={theme} label="Email verified" value={u?.verified ?? '—'}
              hint={u ? `${u.total - u.verified} not yet` : ''} />
          </View>

          <Text style={[styles.section, { color: theme.subtext }]}>REVENUE</Text>
          <View style={styles.row}>
            {/* Checked against Play per subscriber, not counted from the plan field. A
                paid plan in Firestore is not revenue: one of these was a licence TEST
                purchase and another was set by hand in the console. */}
            <Stat theme={theme} label="Paying subscribers" value={r?.paying ?? '—'} />
            <Stat theme={theme} label="Monthly revenue" value={r ? `$${r.mrrUsd}` : '—'}
              hint={r?.paying ? 'from real purchases' : 'no real purchases yet'} />
          </View>
          {!!r && (r.testing > 0 || r.manual > 0 || r.lapsed > 0) && (
            <View style={[styles.list, { backgroundColor: theme.card, borderColor: theme.border }]}>
              {r.testing > 0 && (
                <View style={styles.listRow}>
                  <Text style={[styles.listName, { color: theme.subtext }]}>Test purchases</Text>
                  <Text style={styles.listCount}>{r.testing}</Text>
                </View>
              )}
              {r.manual > 0 && (
                <View style={styles.listRow}>
                  <Text style={[styles.listName, { color: theme.subtext }]}>Set by hand · no purchase</Text>
                  <Text style={styles.listCount}>{r.manual}</Text>
                </View>
              )}
              {r.lapsed > 0 && (
                <View style={styles.listRow}>
                  <Text style={[styles.listName, { color: '#ff6b6b' }]}>Expired but still on a paid plan</Text>
                  <Text style={[styles.listCount, { color: '#ff6b6b' }]}>{r.lapsed}</Text>
                </View>
              )}
              <Text style={[styles.listNote, { color: theme.subtext }]}>
                Not counted as revenue. Nothing revokes an expired subscription yet.
              </Text>
            </View>
          )}

          <Text style={[styles.section, { color: theme.subtext }]}>PLANS</Text>
          <View style={styles.row}>
            <Stat theme={theme} label="Free" value={u?.plans?.free ?? 0} />
            <Stat theme={theme} label="Pro" value={u?.plans?.pro ?? 0} />
            <Stat theme={theme} label="Creator" value={u?.plans?.creator ?? 0} />
          </View>

          <Text style={[styles.section, { color: theme.subtext }]}>VIDEOS</Text>
          <View style={styles.row}>
            <Stat theme={theme} label="Made in total" value={v?.total ?? '—'} />
            <Stat theme={theme} label="This week" value={v?.last7 ?? '—'} />
          </View>
          <View style={styles.row}>
            {/* The number that says whether the app is USED rather than installed. */}
            <Stat theme={theme} label="People who made one" value={v?.creators ?? '—'}
              hint={u?.total ? `of ${u.total} accounts` : ''} />
            <Stat theme={theme} label="Storage used" value={v ? `${v.storageMB}MB` : '—'} />
          </View>

          {!!u?.countries?.length && (
            <>
              <Text style={[styles.section, { color: theme.subtext }]}>COUNTRIES</Text>
              <View style={[styles.list, { backgroundColor: theme.card, borderColor: theme.border }]}>
                {u.countries.map(([name, count]) => (
                  <View key={name} style={styles.listRow}>
                    <Text style={[styles.listName, { color: theme.text }]} numberOfLines={1}>{name}</Text>
                    <Text style={styles.listCount}>{count}</Text>
                  </View>
                ))}
                {/* Only accounts that were asked - country capture was added later, so
                    this will not add up to the total and should not be read as if it does. */}
                <Text style={[styles.listNote, { color: theme.subtext }]}>
                  Only accounts that gave a country at signup.
                </Text>
              </View>
            </>
          )}

          {!!data?.generatedAt && (
            <Text style={[styles.stamp, { color: theme.subtext }]}>
              Updated {new Date(data.generatedAt).toLocaleTimeString()} · pull to refresh
            </Text>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backText: { color: '#2ECC71', fontSize: 16, fontWeight: '600' },
  title: { fontSize: 18, fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { padding: 16, paddingBottom: 32 },
  section: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6, marginTop: 18, marginBottom: 8 },
  row: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  stat: { flex: 1, borderRadius: 14, borderWidth: 1, padding: 14, alignItems: 'center' },
  statValue: { color: '#2ECC71', fontSize: 26, fontWeight: '800' },
  statLabel: { fontSize: 11, marginTop: 4, textAlign: 'center' },
  statHint: { color: '#666', fontSize: 10, marginTop: 2 },
  list: { borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 6 },
  listRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  listName: { fontSize: 14, flex: 1 },
  listCount: { color: '#2ECC71', fontSize: 14, fontWeight: '700' },
  listNote: { fontSize: 10, paddingVertical: 8 },
  stamp: { fontSize: 11, textAlign: 'center', marginTop: 18 },
});
