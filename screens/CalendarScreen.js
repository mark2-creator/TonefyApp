import React, { useState, useEffect } from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, StatusBar, ActivityIndicator, Alert
} from 'react-native';
import { auth, db } from '../firebase';
import { collection, query, where, getDocs, doc, deleteDoc } from 'firebase/firestore';

const STATUSBAR_HEIGHT = StatusBar.currentHeight || 0;

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

export default function CalendarScreen({ navigation }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [currentDate, setCurrentDate] = useState(new Date());
  const user = auth.currentUser;

  useEffect(() => { loadPosts(); }, []);

  async function loadPosts() {
    setLoading(true);
    try {
      const q = query(collection(db, 'scheduledPosts'), where('userId', '==', user.uid));
      const snap = await getDocs(q);
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setPosts(all);
    } catch (e) {}
    setLoading(false);
  }

  async function deletePost(id) {
    Alert.alert('Delete Post', 'Are you sure you want to delete this post?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await deleteDoc(doc(db, 'scheduledPosts', id));
            setPosts(posts.filter(p => p.id !== id));
          } catch (e) { Alert.alert('Error', e.message); }
        }
      }
    ]);
  }

  function editPost(post) {
    navigation.navigate('EditPostVideo', { videoUrl: post.videoUrl, videoPath: '' });
  }

  // Calendar helpers
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();

  const postDays = new Set(
    posts.map(p => {
      const d = new Date(p.scheduledFor);
      return d.getMonth() === month && d.getFullYear() === year ? d.getDate() : null;
    }).filter(Boolean)
  );

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const filteredPosts = filter === 'all' ? posts :
    filter === 'scheduled' ? posts.filter(p => p.status === 'queued') :
    filter === 'posted' ? posts.filter(p => p.status === 'posted') : posts;

  // Stats
  const scheduled = posts.filter(p => p.status === 'queued').length;
  const posted = posts.filter(p => p.status === 'posted').length;
  const thisMonth = posts.filter(p => {
    const d = new Date(p.createdAt);
    return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
  }).length;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a0a" />
      <View style={styles.header}>
        <Text style={styles.title}>Content Calendar</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNum}>{scheduled}</Text>
            <Text style={styles.statLabel}>Scheduled</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNum}>{posted}</Text>
            <Text style={styles.statLabel}>Posted</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNum}>{thisMonth}</Text>
            <Text style={styles.statLabel}>This Month</Text>
          </View>
        </View>

        {/* Calendar */}
        <View style={styles.calCard}>
          <View style={styles.calHeader}>
            <TouchableOpacity onPress={prevMonth} style={styles.calNav}>
              <Text style={styles.calNavText}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.calMonth}>{MONTHS[month]} {year}</Text>
            <TouchableOpacity onPress={nextMonth} style={styles.calNav}>
              <Text style={styles.calNavText}>›</Text>
            </TouchableOpacity>
          </View>
          {/* Day headers */}
          <View style={styles.calGrid}>
            {DAYS.map(d => (
              <Text key={d} style={styles.calDow}>{d}</Text>
            ))}
          </View>
          {/* Days grid */}
          <View style={styles.calGrid}>
            {Array.from({ length: firstDay }).map((_, i) => (
              <View key={`e${i}`} style={styles.calDay} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
              const hasPost = postDays.has(day);
              return (
                <View key={day} style={[styles.calDay, isToday && styles.calDayToday]}>
                  <Text style={[styles.calDayText, isToday && styles.calDayTodayText]}>{day}</Text>
                  {hasPost && <View style={[styles.calDot, isToday && styles.calDotToday]} />}
                </View>
              );
            })}
          </View>
        </View>

        {/* Filter tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterWrap}>
          {['all', 'scheduled', 'posted'].map(f => (
            <TouchableOpacity
              key={f}
              style={[styles.filterTab, filter === f && styles.filterTabActive]}
              onPress={() => setFilter(f)}
            >
              <Text style={[styles.filterTabText, filter === f && styles.filterTabTextActive]}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Posts list */}
        {loading ? (
          <ActivityIndicator color="#2ecc71" style={{ marginTop: 20 }} />
        ) : filteredPosts.length === 0 ? (
          <View style={styles.empty}>
            <MaterialIcons name="inbox" size={48} color="#333" style={styles.emptyIcon} />
            <Text style={styles.emptyTitle}>No posts here</Text>
            <Text style={styles.emptySub}>Create a video and schedule it to get started</Text>
            <TouchableOpacity style={styles.btnCreate} onPress={() => navigation.navigate('IdeaToVideo')}>
              <Text style={styles.btnCreateText}>Create Video</Text>
            </TouchableOpacity>
          </View>
        ) : filteredPosts.map(post => (
          <View key={post.id} style={styles.postCard}>
            <View style={styles.postHeader}>
              <Text style={styles.postPlatform}>{(post.platforms || []).join(', ') || 'No platform'}</Text>
              <Text style={styles.postTime}>{new Date(post.scheduledFor).toLocaleDateString()}</Text>
            </View>
            <Text style={styles.postCaption} numberOfLines={2}>{post.caption || 'Untitled'}</Text>
            <View style={[styles.postStatus, post.status === 'posted' && styles.postStatusPosted]}>
              <Text style={[styles.postStatusText, post.status === 'posted' && styles.postStatusPostedText]}>
                {post.status === 'posted' ? 'Posted' : 'Scheduled'}
              </Text>
            </View>
            <View style={styles.postActions}>
              <TouchableOpacity style={styles.btnEdit} onPress={() => editPost(post)}>
                <Text style={styles.btnEditText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnDelete} onPress={() => deletePost(post.id)}>
                <Text style={styles.btnDeleteText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', paddingTop: STATUSBAR_HEIGHT },
  header: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#1a1a1a' },
  title: { color: '#fff', fontSize: 20, fontWeight: '700' },
  statsRow: { flexDirection: 'row', gap: 10, padding: 16 },
  statCard: { flex: 1, backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 12, padding: 12, alignItems: 'center' },
  statNum: { color: '#2ecc71', fontSize: 24, fontWeight: '800' },
  statLabel: { color: '#888', fontSize: 11, marginTop: 2 },
  calCard: { backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 14, margin: 16, padding: 14 },
  calHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  calMonth: { color: '#fff', fontSize: 16, fontWeight: '700' },
  calNav: { width: 32, height: 32, borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  calNavText: { color: '#fff', fontSize: 18 },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calDow: { width: '14.28%', textAlign: 'center', color: '#888', fontSize: 11, fontWeight: '700', paddingBottom: 8 },
  calDay: { width: '14.28%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 8, marginBottom: 2 },
  calDayToday: { backgroundColor: '#2ecc71' },
  calDayText: { color: '#fff', fontSize: 13, fontWeight: '500' },
  calDayTodayText: { color: '#000', fontWeight: '800' },
  calDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#2ecc71', position: 'absolute', bottom: 3 },
  calDotToday: { backgroundColor: '#000' },
  filterWrap: { paddingHorizontal: 16, marginBottom: 12 },
  filterTab: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: '#2a2a2a', marginRight: 8 },
  filterTabActive: { backgroundColor: '#2ecc71', borderColor: '#2ecc71' },
  filterTabText: { color: '#888', fontSize: 13, fontWeight: '600' },
  filterTabTextActive: { color: '#000' },
  empty: { alignItems: 'center', padding: 40 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 6 },
  emptySub: { color: '#888', fontSize: 13, textAlign: 'center', marginBottom: 16 },
  btnCreate: { backgroundColor: '#2ecc71', borderRadius: 25, paddingHorizontal: 24, paddingVertical: 12 },
  btnCreateText: { color: '#000', fontWeight: '700', fontSize: 14 },
  postCard: { backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 14, marginHorizontal: 16, marginBottom: 12, padding: 14, borderLeftWidth: 3, borderLeftColor: '#2ecc71' },
  postHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  postPlatform: { color: '#2ecc71', fontSize: 13, fontWeight: '700' },
  postTime: { color: '#888', fontSize: 13 },
  postCaption: { color: '#fff', fontSize: 14, lineHeight: 20, marginBottom: 8 },
  postStatus: { alignSelf: 'flex-start', backgroundColor: '#0d2018', borderWidth: 1, borderColor: '#1a4a2a', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3, marginBottom: 10 },
  postStatusPosted: { backgroundColor: '#1a2a0d' },
  postStatusText: { color: '#2ecc71', fontSize: 11, fontWeight: '700' },
  postStatusPostedText: { color: '#86efac' },
  postActions: { flexDirection: 'row', gap: 8 },
  btnEdit: { flex: 1, padding: 10, borderRadius: 20, borderWidth: 1, borderColor: '#2a2a2a', alignItems: 'center' },
  btnEditText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  btnDelete: { flex: 1, padding: 10, borderRadius: 20, borderWidth: 1, borderColor: '#5a2020', backgroundColor: '#2a1212', alignItems: 'center' },
  btnDeleteText: { color: '#f87171', fontSize: 13, fontWeight: '600' },
});
