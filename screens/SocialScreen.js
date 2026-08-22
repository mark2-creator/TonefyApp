import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, StatusBar, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialIcons, FontAwesome6 } from '@expo/vector-icons';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { useTheme } from '../context/ThemeContext';

// The social hub: what is connected, what is queued, and one way in to posting.
//
// Deliberately does NOT reimplement Calendar or EditPostVideo. Managing the queue -
// filtering, deleting, seeing what posted - already exists on Calendar, and composing
// already exists on EditPostVideo. What did not exist was a single place that answers
// "what is my social presence right now", which is why the Dashboard's Social card had
// nowhere to go. Every row here is a door to a screen that already works.
//
// The counts are a plain read of the same `scheduledPosts` collection Calendar reads, so
// there is no second source of truth to drift - if the two ever disagree, one of them is
// reading wrong rather than one of them being stale.
const BACKEND = 'https://api.fitlifesolutions.site';

// Icon and colour only. WHICH platforms exist and whether each is live comes from the
// server's /api/platforms, so a platform coming online is a credential and a restart
// rather than an app update - which matters because this list would otherwise be a
// constant compiled into a bundle.
const LOOK = {
  tiktok: { icon: 'tiktok', colour: '#000000' },
  youtube: { icon: 'youtube', colour: '#FF0000' },
  pinterest: { icon: 'pinterest', colour: '#E60023' },
  facebook: { icon: 'facebook', colour: '#1877F2' },
  instagram: { icon: 'instagram', colour: '#E4405F' },
  x: { icon: 'x-twitter', colour: '#000000' },
};

// Shown until the server answers, and as the fallback if it cannot be reached - so the
// screen is never empty and never claims a platform is missing because a request failed.
const FALLBACK_PLATFORMS = [
  { id: 'tiktok', label: 'TikTok', enabled: true },
  { id: 'youtube', label: 'YouTube', enabled: false },
  { id: 'pinterest', label: 'Pinterest', enabled: false },
];

export default function SocialScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();

  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState({});
  const [queued, setQueued] = useState([]);
  const [postedCount, setPostedCount] = useState(0);
  const [platforms, setPlatforms] = useState(FALLBACK_PLATFORMS);

  // useFocusEffect rather than a mount effect: connecting an account happens on ANOTHER
  // screen (and, for TikTok, in a browser), so arriving back here is exactly the moment
  // this is most likely to be out of date.
  useFocusEffect(useCallback(() => {
    let cancelled = false;
    (async () => {
      const user = auth.currentUser;
      if (!user) { setLoading(false); return; }
      try {
        const token = await user.getIdToken();
        const [acc, posts, plat] = await Promise.all([
          getDoc(doc(db, 'connectedAccounts', user.uid)),
          getDocs(query(collection(db, 'scheduledPosts'), where('userId', '==', user.uid))),
          fetch(BACKEND + '/api/platforms', { headers: { Authorization: 'Bearer ' + token } })
            .then(r => r.json()).catch(() => null),
        ]);
        if (cancelled) return;
        setConnected(acc.exists() ? acc.data() : {});
        if (plat?.platforms?.length) setPlatforms(plat.platforms);
        const all = posts.docs.map(d => ({ id: d.id, ...d.data() }));
        setQueued(
          all.filter(p => p.status === 'queued')
            .sort((a, b) => new Date(a.scheduledFor || 0) - new Date(b.scheduledFor || 0))
            .slice(0, 3)
        );
        setPostedCount(all.filter(p => p.status === 'posted').length);
      } catch (e) {
        // A read failure is not worth a popup on arrival - the empty states below
        // already say there is nothing here and what to do about it.
        if (!cancelled) { setConnected({}); setQueued([]); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []));

  const liveCount = platforms.filter(p => p.enabled && connected[p.id]).length;

  const fmt = (iso) => {
    if (!iso) return 'No time set';
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
      + ' · ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.bg, paddingTop: insets.top }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.bg} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <MaterialIcons name="arrow-back" size={20} color={theme.text} />
          <Text style={[styles.backText, { color: theme.text }]}>Back</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.text }]}>Social</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 + insets.bottom }}>
        {loading ? (
          <ActivityIndicator color="#2ECC71" style={{ marginVertical: 30 }} />
        ) : (
          <>
            {/* 1 - who you can post as */}
            <Text style={[styles.section, { color: theme.text }]}>Accounts</Text>
            <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
              {platforms.map((p, i) => {
                const on = p.enabled && !!connected[p.id];
                const look = LOOK[p.id] || { icon: 'share-nodes', colour: '#888888' };
                return (
                  <TouchableOpacity
                    key={p.id}
                    style={[styles.accRow, i > 0 && { borderTopWidth: 1, borderTopColor: theme.border }]}
                    disabled={!p.enabled}
                    onPress={() => navigation.navigate('ConnectAccounts')}>
                    <View style={[styles.badge, { backgroundColor: p.enabled ? look.colour : theme.border }]}>
                      <FontAwesome6 name={look.icon} size={14} color="#fff" />
                    </View>
                    <Text style={[styles.accLabel, { color: p.enabled ? theme.text : theme.subtext }]}>
                      {p.label}
                    </Text>
                    {!p.enabled ? (
                      <Text style={[styles.accState, { color: theme.subtext }]}>Coming soon</Text>
                    ) : on ? (
                      <Text style={[styles.accState, styles.accOn]}>
                        {connected[p.id]?.displayName || 'Connected'}
                      </Text>
                    ) : (
                      <Text style={[styles.accState, styles.accConnect]}>Connect</Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* 2 - what is going out, and what already has */}
            <Text style={[styles.section, { color: theme.text }]}>Queue</Text>
            <View style={styles.stats}>
              <View style={[styles.stat, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <Text style={styles.statNum}>{queued.length}</Text>
                <Text style={[styles.statLabel, { color: theme.subtext }]}>Scheduled</Text>
              </View>
              <View style={[styles.stat, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <Text style={styles.statNum}>{postedCount}</Text>
                <Text style={[styles.statLabel, { color: theme.subtext }]}>Posted</Text>
              </View>
              <View style={[styles.stat, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <Text style={styles.statNum}>{liveCount}</Text>
                <Text style={[styles.statLabel, { color: theme.subtext }]}>Connected</Text>
              </View>
            </View>

            {queued.length > 0 ? (
              <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                {queued.map((p, i) => (
                  <TouchableOpacity
                    key={p.id}
                    style={[styles.queueRow, i > 0 && { borderTopWidth: 1, borderTopColor: theme.border }]}
                    onPress={() => navigation.navigate('Calendar')}>
                    <MaterialIcons name="schedule" size={18} color="#00d4d4" />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.queueCaption, { color: theme.text }]} numberOfLines={1}>
                        {p.caption?.trim() || 'Untitled post'}
                      </Text>
                      <Text style={[styles.queueWhen, { color: theme.subtext }]}>
                        {fmt(p.scheduledFor)} · {(p.platforms || []).join(', ') || 'No platform'}
                      </Text>
                    </View>
                    <MaterialIcons name="chevron-right" size={20} color={theme.subtext} />
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <View style={[styles.card, styles.emptyCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <Text style={[styles.emptyText, { color: theme.subtext }]}>
                  Nothing queued. Post a video now or schedule one for later.
                </Text>
              </View>
            )}

            {/* 3 - the way in. A post starts from a finished video, so this goes where
                the videos are rather than to a composer with nothing to compose. */}
            <TouchableOpacity
              style={styles.cta}
              onPress={() => navigation.navigate('MainTabs', { screen: 'MyVideos' })}>
              <MaterialIcons name="add" size={20} color="#04211f" />
              <Text style={styles.ctaText}>Create a post</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.secondary, { borderColor: theme.border }]}
              onPress={() => navigation.navigate('Calendar')}>
              <MaterialIcons name="calendar-today" size={18} color={theme.subtext} />
              <Text style={[styles.secondaryText, { color: theme.text }]}>Open the full calendar</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  // flexDirection row, or RN's default column stacks the arrow above the label.
  back: { flexDirection: 'row', alignItems: 'center', gap: 4, width: 60 },
  backText: { fontSize: 13 },
  title: { fontSize: 16, fontWeight: '700' },
  section: { fontSize: 13, fontWeight: '700', marginTop: 18, marginBottom: 8 },
  card: { borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  accRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 13 },
  badge: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  accLabel: { flex: 1, fontSize: 14, fontWeight: '600' },
  accState: { fontSize: 12 },
  accOn: { color: '#2ECC71', fontWeight: '600' },
  accConnect: { color: '#00d4d4', fontWeight: '700' },
  stats: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, alignItems: 'center', borderRadius: 12, borderWidth: 1, paddingVertical: 14 },
  statNum: { color: '#2ECC71', fontSize: 20, fontWeight: '800' },
  statLabel: { fontSize: 11, marginTop: 2 },
  queueRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  queueCaption: { fontSize: 13, fontWeight: '600' },
  queueWhen: { fontSize: 11, marginTop: 2 },
  emptyCard: { padding: 16 },
  emptyText: { fontSize: 12, lineHeight: 18 },
  cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#2ECC71', borderRadius: 12, paddingVertical: 15, marginTop: 20 },
  ctaText: { color: '#04211f', fontSize: 14, fontWeight: '800' },
  secondary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, borderWidth: 1, paddingVertical: 13, marginTop: 10 },
  secondaryText: { fontSize: 13, fontWeight: '600' },
});
