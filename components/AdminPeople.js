import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, FlatList, Modal, StyleSheet, Text, TextInput,
  TouchableOpacity, View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { auth } from '../firebase';
import { SheetHeader, useSheetInset } from './SheetHeader';
import { showAlert } from './BrandedAlert';

const BACKEND = 'https://api.fitlifesolutions.site';
const PLANS = ['free', 'pro', 'creator'];

/**
 * The people behind the numbers, and the one thing this screen exists to let you DO:
 * change somebody's plan without opening the Firebase console.
 *
 * The list is server-aggregated. Counting 24 accounts on a phone would mean shipping
 * every user record to it, which is both slow and the wrong place for that data.
 *
 * Search runs on the SERVER too, against the full set, not over the sixty rows that
 * happen to have been fetched - otherwise looking someone up would only find them if
 * they were recent enough to be in the page already.
 *
 * Collapsed by default, and nothing is fetched until it is opened. The count in the
 * header comes from the stats already on screen, so the section can say how many
 * accounts there are without asking for any of them.
 */

function planColour(plan) {
  // Paid plans are marked, free is not. Every account is free until something happens,
  // so colouring the default would mean colouring almost everything.
  if (plan === 'creator') return '#f5c451';
  if (plan === 'pro') return '#2ECC71';
  return null;
}

function Row({ item, theme, onPress }) {
  const colour = planColour(item.plan);
  return (
    <TouchableOpacity style={[styles.row, { borderBottomColor: theme.border }]} onPress={() => onPress(item)}>
      <View style={styles.rowMain}>
        <Text style={[styles.rowEmail, { color: theme.text }]} numberOfLines={1}>
          {item.email || item.name || item.uid}
        </Text>
        <Text style={[styles.rowMeta, { color: theme.subtext }]} numberOfLines={1}>
          {item.videos} video{item.videos === 1 ? '' : 's'}
          {item.credits !== null ? ` · ${item.credits} credits` : ''}
          {item.country ? ` · ${item.country}` : ''}
        </Text>
      </View>

      <View style={styles.rowRight}>
        {/* Flags worth seeing at a glance, because each one means something is off:
            a paid plan nobody paid for, an account with no Firestore record, and an
            address that was never confirmed. */}
        {item.source === 'manual' && <MaterialIcons name="build" size={12} color="#f5c451" />}
        {item.orphan && <MaterialIcons name="link-off" size={12} color="#ff6b6b" />}
        {!item.verified && <MaterialIcons name="mark-email-unread" size={12} color="#888" />}
        {colour ? (
          <Text style={[styles.plan, { color: colour }]}>{item.plan}</Text>
        ) : (
          <Text style={[styles.plan, { color: theme.subtext }]}>free</Text>
        )}
        <MaterialIcons name="chevron-right" size={20} color={theme.icon} />
      </View>
    </TouchableOpacity>
  );
}

export default function AdminPeople({ theme, onChanged, count }) {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);
  const sheetInset = useSheetInset();

  const load = useCallback(async (query) => {
    setLoading(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const url = `${BACKEND}/api/admin/users?limit=60${query ? `&q=${encodeURIComponent(query)}` : ''}`;
      const res = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Could not load accounts.');
      setRows(json.rows || []);
      setTotal(json.total || 0);
    } catch (e) {
      showAlert('Admin', e.message || 'Could not load accounts.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Nothing is fetched until the section is opened. Listing accounts walks the entire
  // auth list and every video document server-side, and doing that on a screen nobody
  // expanded is work spent on a question nobody asked.
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => load(q.trim()), q ? 400 : 0);
    return () => clearTimeout(t);
  }, [open, q, load]);

  async function setPlan(plan) {
    if (!selected || plan === selected.plan) return setSelected(null);
    setSaving(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`${BACKEND}/api/admin/user/${selected.uid}/plan`, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Could not change the plan.');
      // Update in place rather than refetching the whole list: the row the user is
      // looking at should change immediately, and a reload would scroll them away.
      setRows((prev) => prev.map((r) => (
        r.uid === selected.uid ? { ...r, plan, credits: json.credits, source: plan === 'free' ? null : 'manual' } : r
      )));
      setSelected(null);
      onChanged?.();
    } catch (e) {
      showAlert('Admin', e.message || 'Could not change the plan.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.wrap}>
      <TouchableOpacity
        style={[styles.toggle, { backgroundColor: theme.card, borderColor: theme.border }]}
        onPress={() => setOpen((v) => !v)}
      >
        <MaterialIcons name="people" size={20} color={theme.icon} />
        <Text style={[styles.toggleLabel, { color: theme.text }]}>Accounts</Text>
        <Text style={[styles.toggleCount, { color: theme.subtext }]}>
          {count || total || ''}
        </Text>
        <MaterialIcons name={open ? 'expand-less' : 'expand-more'} size={20} color={theme.icon} />
      </TouchableOpacity>

      {!open ? null : (
      <>
      <View style={[styles.search, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder }]}>
        <MaterialIcons name="search" size={20} color={theme.subtext} />
        <TextInput
          style={[styles.searchInput, { color: theme.text }]}
          placeholder="Search by email or name"
          placeholderTextColor={theme.subtext}
          value={q}
          onChangeText={setQ}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {q.length > 0 && (
          <TouchableOpacity onPress={() => setQ('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <MaterialIcons name="close" size={20} color={theme.subtext} />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <ActivityIndicator color="#2ECC71" style={styles.loading} />
      ) : rows.length === 0 ? (
        <Text style={[styles.empty, { color: theme.subtext }]}>
          {q ? `Nobody matches "${q}".` : 'No accounts yet.'}
        </Text>
      ) : (
        <>
          <Text style={[styles.count, { color: theme.subtext }]}>
            {q ? `${total} match${total === 1 ? '' : 'es'}` : `${total} accounts`}
            {rows.length < total ? ` · showing ${rows.length}` : ''}
          </Text>
          <FlatList
            data={rows}
            keyExtractor={(i) => i.uid}
            renderItem={({ item }) => <Row item={item} theme={theme} onPress={setSelected} />}
            scrollEnabled={false}
          />
        </>
      )}
      </>
      )}

      <Modal visible={!!selected} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        <View style={styles.overlay}>
          <View style={[styles.sheet, sheetInset]}>
            <SheetHeader title={selected?.email || selected?.uid || ''} onClose={() => setSelected(null)} />

            <Text style={styles.sheetMeta}>
              {selected?.name ? `${selected.name} · ` : ''}
              {selected?.videos} video{selected?.videos === 1 ? '' : 's'}
              {selected?.credits !== null ? ` · ${selected?.credits} credits` : ''}
            </Text>
            <Text style={styles.sheetMeta}>
              Joined {selected?.created ? new Date(selected.created).toLocaleDateString() : 'unknown'}
              {selected?.lastSignIn ? ` · last seen ${new Date(selected.lastSignIn).toLocaleDateString()}` : ' · never signed in'}
            </Text>

            {selected?.source === 'manual' && (
              <Text style={styles.warn}>
                On a paid plan with no purchase behind it — set by hand, not revenue.
              </Text>
            )}
            {selected?.orphan && (
              <Text style={styles.warn}>
                No Firestore record. Predates the users collection, or was half-deleted.
              </Text>
            )}

            <Text style={styles.sheetLabel}>Plan</Text>
            <View style={styles.plans}>
              {PLANS.map((p) => {
                const active = selected?.plan === p;
                return (
                  <TouchableOpacity
                    key={p}
                    style={[styles.planChip, active && styles.planChipActive]}
                    disabled={saving}
                    onPress={() => setPlan(p)}
                  >
                    <Text style={[styles.planChipText, active && styles.planChipTextActive]}>{p}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {saving && <ActivityIndicator color="#2ECC71" style={styles.saving} />}
            <Text style={styles.note}>
              Changing a plan resets credits to that tier&apos;s allowance and restarts the cycle.
              It does not cancel anything at Google Play.
            </Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 4 },
  toggle: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 13, marginBottom: 10,
  },
  toggleLabel: { flex: 1, fontSize: 14, fontWeight: '600' },
  toggleCount: { fontSize: 13, fontWeight: '600' },
  search: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 9, marginBottom: 10,
  },
  searchInput: { flex: 1, fontSize: 14, padding: 0 },
  loading: { marginVertical: 24 },
  empty: { textAlign: 'center', paddingVertical: 24, fontSize: 14 },
  count: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 },

  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderBottomWidth: 1 },
  rowMain: { flex: 1, marginRight: 10 },
  rowEmail: { fontSize: 14, fontWeight: '600' },
  rowMeta: { fontSize: 12, marginTop: 2 },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  plan: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#111', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24 },
  sheetMeta: { color: '#888', fontSize: 13, marginBottom: 3 },
  warn: { color: '#f5c451', fontSize: 12.5, marginTop: 10, lineHeight: 18 },
  sheetLabel: { color: '#888', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 18, marginBottom: 8 },
  plans: { flexDirection: 'row', gap: 8 },
  planChip: {
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2a2a2a',
  },
  planChipActive: { backgroundColor: '#2ECC71', borderColor: '#2ECC71' },
  planChipText: { color: '#cfcfcf', fontSize: 13, fontWeight: '600', textTransform: 'capitalize' },
  planChipTextActive: { color: '#000' },
  saving: { marginTop: 12 },
  note: { color: '#666', fontSize: 11.5, marginTop: 16, lineHeight: 17 },
});
