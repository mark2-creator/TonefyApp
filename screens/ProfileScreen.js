import React, { useEffect, useState, useCallback } from 'react';
import * as Sentry from '@sentry/react-native';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, Image, Alert, ActivityIndicator, Modal
} from 'react-native';
import { signOut, updateProfile, deleteUser, multiFactor, TotpMultiFactorGenerator } from 'firebase/auth';
import QRCode from 'react-native-qrcode-svg';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../firebase';

export default function ProfileScreen({ navigation }) {
  const user = auth.currentUser;
  const [stats, setStats] = useState({ total: '—', thisMonth: '—', scheduled: '—' });
  const [editing, setEditing] = useState(false);
  const [nameInput, setNameInput] = useState(user?.displayName || '');
  const [displayName, setDisplayName] = useState(user?.displayName || 'Tonefy User');
  const [saving, setSaving] = useState(false);
  const [toastMsg, setToastMsg] = useState(null);
  const [tiktok, setTiktok] = useState({ connected: false, label: 'Checking...' });
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [mfaLoading, setMfaLoading] = useState(false);
  const [showMfaSetup, setShowMfaSetup] = useState(false);
  const [totpSecret, setTotpSecret] = useState(null);
  const [qrUri, setQrUri] = useState(null);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaSession, setMfaSession] = useState(null);

  const showToast = useCallback((msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  }, []);

  useEffect(() => {
    if (!user) return;
    // Check if MFA is already enrolled
    const enrolledFactors = multiFactor(user).enrolledFactors;
    setMfaEnabled(enrolledFactors.length > 0);
    (async () => {
      try {
        const vSnap = await getDocs(query(collection(db, 'userVideos'), where('userId', '==', user.uid)));
        const now = new Date();
        const thisMonthCount = vSnap.docs.filter((d) => {
          const created = new Date(d.data().createdAt);
          return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
        }).length;
        setStats((s) => ({ ...s, total: vSnap.size, thisMonth: thisMonthCount }));
      } catch (e) {
        setStats((s) => ({ ...s, total: 0, thisMonth: 0 }));
      }

      try {
        const sSnap = await getDocs(query(
          collection(db, 'scheduledPosts'),
          where('userId', '==', user.uid),
          where('status', '==', 'queued')
        ));
        setStats((s) => ({ ...s, scheduled: sSnap.size }));
      } catch (e) {
        setStats((s) => ({ ...s, scheduled: 0 }));
      }

      try {
        const ttSnap = await getDoc(doc(db, 'connectedAccounts', user.uid));
        if (ttSnap.exists() && ttSnap.data().tiktok) {
          const tt = ttSnap.data().tiktok;
          setTiktok({ connected: true, label: `@${tt.displayName || 'Connected'}` });
        } else {
          setTiktok({ connected: false, label: 'Not connected' });
        }
      } catch (e) {
        setTiktok({ connected: false, label: 'Not connected' });
      }
    })();
  }, [user]);

  const joined = user?.metadata?.creationTime
    ? new Date(user.metadata.creationTime).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : '—';

  async function handleSaveName() {
    const name = nameInput.trim();
    if (!name) { showToast('Name cannot be empty'); return; }
    setSaving(true);
    try {
      await updateProfile(auth.currentUser, { displayName: name });
      setDisplayName(name);
      setEditing(false);
      showToast('Name updated!');
    } catch (e) {
      showToast('Failed to update name');
    }
    setSaving(false);
  }

  async function handleLogout() {
    await signOut(auth);
  }

  function handleDelete() {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteUser(auth.currentUser);
            } catch (e) {
              showToast('Please log out and log back in before deleting.');
            }
          },
        },
      ]
    );
  }

  async function handleEnableMfa() {
    try {
      setMfaLoading(true);
      const session = await multiFactor(user).getSession();
      const totpUri = await TotpMultiFactorGenerator.generateSecret(session);
      setMfaSession(totpUri);
      setQrUri(totpUri.generateQrCodeUrl(user.email, 'Tonefy AI'));
      setShowMfaSetup(true);
    } catch (e) {
      Alert.alert('Error', 'Could not start 2FA setup. Try again.');
    } finally {
      setMfaLoading(false);
    }
  }

  async function handleVerifyMfa() {
    if (mfaCode.length !== 6) { Alert.alert('Error', 'Enter the 6-digit code from your authenticator app.'); return; }
    try {
      setMfaLoading(true);
      const cred = TotpMultiFactorGenerator.assertionForEnrollment(mfaSession, mfaCode);
      await multiFactor(user).enroll(cred, 'Authenticator App');
      setMfaEnabled(true);
      setShowMfaSetup(false);
      setMfaCode('');
      showToast('2FA enabled successfully!');
    } catch (e) {
      Alert.alert('Invalid Code', 'The code is incorrect or expired. Try again.');
    } finally {
      setMfaLoading(false);
    }
  }

  async function handleDisableMfa() {
    Alert.alert('Disable 2FA', 'Are you sure you want to disable two-factor authentication?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Disable', style: 'destructive', onPress: async () => {
        try {
          setMfaLoading(true);
          const factors = multiFactor(user).enrolledFactors;
          await multiFactor(user).unenroll(factors[0]);
          setMfaEnabled(false);
          showToast('2FA disabled.');
        } catch (e) {
          Alert.alert('Error', 'Could not disable 2FA. You may need to re-login first.');
        } finally {
          setMfaLoading(false);
        }
      }}
    ]);
  }

  function handleTikTokPress() {
    if (tiktok.connected) return;
    Alert.alert('Connect TikTok', 'TikTok connection in the app is coming soon — you can connect it on the website for now.');
  }

  const initial = (displayName || user?.email || '?')[0].toUpperCase();

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.headerTitle}>My Profile</Text>

        <View style={styles.hero}>
          <View style={styles.avatar}>
            {user?.photoURL ? (
              <Image source={{ uri: user.photoURL }} style={styles.avatarImg} />
            ) : (
              <Text style={styles.avatarText}>{initial}</Text>
            )}
          </View>
          <Text style={styles.profileName}>{displayName}</Text>
          <Text style={styles.profileEmail}>{user?.email || ''}</Text>
          <View style={styles.planBadge}><Text style={styles.planBadgeText}>⭐ Free Plan</Text></View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}><Text style={styles.statNum}>{stats.total}</Text><Text style={styles.statLabel}>Total Videos</Text></View>
          <View style={styles.statCard}><Text style={styles.statNum}>{stats.thisMonth}</Text><Text style={styles.statLabel}>This Month</Text></View>
          <View style={styles.statCard}><Text style={styles.statNum}>{stats.scheduled}</Text><Text style={styles.statLabel}>Scheduled</Text></View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Account</Text>
          <View style={styles.row}>
            <Text style={styles.rowIcon}>👤</Text>
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel}>Display Name</Text>
              <Text style={styles.rowValue}>{displayName}</Text>
            </View>
            <TouchableOpacity onPress={() => setEditing(!editing)}>
              <Text style={styles.rowAction}>Edit</Text>
            </TouchableOpacity>
          </View>
          {editing && (
            <View style={styles.editWrap}>
              <TextInput
                style={styles.editInput}
                value={nameInput}
                onChangeText={setNameInput}
                placeholder="Your name"
                placeholderTextColor="#666"
              />
              <TouchableOpacity style={styles.btnSave} onPress={handleSaveName} disabled={saving}>
                {saving ? <ActivityIndicator color="#000" size="small" /> : <Text style={styles.btnSaveText}>Save</Text>}
              </TouchableOpacity>
            </View>
          )}
          <View style={styles.row}>
            <Text style={styles.rowIcon}>✉️</Text>
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel}>Email</Text>
              <Text style={styles.rowValue}>{user?.email || '—'}</Text>
            </View>
          </View>
          <View style={[styles.row, { borderBottomWidth: 0 }]}>
            <Text style={styles.rowIcon}>📅</Text>
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel}>Member Since</Text>
              <Text style={styles.rowValue}>{joined}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Connected Accounts</Text>
          <View style={styles.connRow}>
            <View style={[styles.connLogo, { backgroundColor: '#000' }]}>
              <Text style={{ fontSize: 18 }}>🎵</Text>
            </View>
            <View style={styles.connInfo}>
              <Text style={styles.connName}>TikTok</Text>
              <Text style={[styles.connStatus, tiktok.connected && styles.connStatusOk]}>{tiktok.label}</Text>
            </View>
            <TouchableOpacity onPress={handleTikTokPress}>
              <View style={tiktok.connected ? styles.badgeConnected : styles.badgeSoon}>
                <Text style={tiktok.connected ? styles.badgeConnectedText : styles.badgeSoonText}>
                  {tiktok.connected ? 'Connected' : 'Connect'}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
          <View style={styles.connRow}>
            <View style={styles.connLogo}><Text style={{ fontSize: 18 }}>📘</Text></View>
            <View style={styles.connInfo}>
              <Text style={styles.connName}>Facebook</Text>
              <Text style={styles.connStatus}>Coming soon</Text>
            </View>
            <View style={styles.badgeSoon}><Text style={styles.badgeSoonText}>Soon</Text></View>
          </View>
          <View style={[styles.connRow, { borderBottomWidth: 0 }]}>
            <View style={styles.connLogo}><Text style={{ fontSize: 18 }}>📷</Text></View>
            <View style={styles.connInfo}>
              <Text style={styles.connName}>Instagram</Text>
              <Text style={styles.connStatus}>Coming soon</Text>
            </View>
            <View style={styles.badgeSoon}><Text style={styles.badgeSoonText}>Soon</Text></View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Security</Text>
          <View style={[styles.connRow, { borderBottomWidth: 0 }]}>
            <View style={[styles.connLogo, { backgroundColor: '#1a2a1e' }]}>
              <Text style={{ fontSize: 18 }}>🔐</Text>
            </View>
            <View style={styles.connInfo}>
              <Text style={styles.connName}>Two-Factor Auth</Text>
              <Text style={[styles.connStatus, mfaEnabled && styles.connStatusOk]}>
                {mfaEnabled ? 'Enabled' : 'Not enabled'}
              </Text>
            </View>
            {mfaLoading ? <ActivityIndicator color="#54e98a" /> : (
              <TouchableOpacity onPress={mfaEnabled ? handleDisableMfa : handleEnableMfa}>
                <View style={mfaEnabled ? styles.badgeConnected : styles.badgeSoon}>
                  <Text style={mfaEnabled ? styles.badgeConnectedText : styles.badgeSoonText}>
                    {mfaEnabled ? 'Disable' : 'Enable'}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <Modal visible={showMfaSetup} transparent animationType="slide">
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
            <View style={{ backgroundColor: '#1a1a1a', borderRadius: 20, padding: 24, width: '100%', alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 8 }}>Setup Authenticator</Text>
              <Text style={{ color: '#869486', fontSize: 13, textAlign: 'center', marginBottom: 20 }}>
                Scan this QR code with Google Authenticator or Authy, then enter the 6-digit code below.
              </Text>
              {qrUri && <QRCode value={qrUri} size={180} backgroundColor="#fff" />}
              <TextInput
                style={{ marginTop: 24, backgroundColor: '#111', color: '#fff', borderRadius: 12, padding: 14, width: '100%', fontSize: 22, letterSpacing: 8, textAlign: 'center', borderWidth: 1, borderColor: '#2a2a2a' }}
                placeholder="000000"
                placeholderTextColor="#444"
                value={mfaCode}
                onChangeText={setMfaCode}
                keyboardType="number-pad"
                maxLength={6}
              />
              <TouchableOpacity
                style={{ marginTop: 16, backgroundColor: '#2ecc71', borderRadius: 12, padding: 14, width: '100%', alignItems: 'center' }}
                onPress={handleVerifyMfa}
                disabled={mfaLoading}
              >
                {mfaLoading ? <ActivityIndicator color="#003919" /> : <Text style={{ color: '#003919', fontWeight: '700', fontSize: 15 }}>Verify & Enable 2FA</Text>}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { setShowMfaSetup(false); setMfaCode(''); }} style={{ marginTop: 12 }}>
                <Text style={{ color: '#869486', fontSize: 13 }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <TouchableOpacity style={[styles.btnLogout, { marginBottom: 10 }]} onPress={() => { Sentry.captureException(new Error('Test crash for Sentry verification')); alert('Sent to Sentry!'); }}>
          <Text style={styles.btnLogoutText}>🧪 Test Crash (temporary)</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnLogout} onPress={handleLogout}>
          <Text style={styles.btnLogoutText}>🚪 Log Out</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnDelete} onPress={handleDelete}>
          <Text style={styles.btnDeleteText}>Delete Account</Text>
        </TouchableOpacity>
      </ScrollView>

      {toastMsg && (
        <View style={styles.toast}>
          <Text style={styles.toastText}>{toastMsg}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  scrollContent: { padding: 20, paddingBottom: 48 },
  headerTitle: { color: '#fff', fontSize: 22, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  hero: { alignItems: 'center', paddingVertical: 20, marginBottom: 12 },
  avatar: { width: 88, height: 88, borderRadius: 44, backgroundColor: '#2ecc71', justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: '#2a2a2a', overflow: 'hidden', marginBottom: 14 },
  avatarImg: { width: 88, height: 88 },
  avatarText: { fontSize: 32, fontWeight: '800', color: '#000' },
  profileName: { color: '#fff', fontSize: 20, fontWeight: '800', marginBottom: 4 },
  profileEmail: { color: '#888', fontSize: 13, marginBottom: 10 },
  planBadge: { backgroundColor: '#0d2018', borderWidth: 1, borderColor: '#2ecc71', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 5 },
  planBadgeText: { color: '#2ecc71', fontSize: 12, fontWeight: '700' },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  statCard: { flex: 1, backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 14, padding: 14, alignItems: 'center' },
  statNum: { color: '#2ecc71', fontSize: 22, fontWeight: '800' },
  statLabel: { color: '#888', fontSize: 11, marginTop: 4 },
  section: { backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 14, marginBottom: 16, overflow: 'hidden' },
  sectionHeader: { padding: 14, borderBottomWidth: 1, borderBottomColor: '#2a2a2a', color: '#888', fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  row: { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: '#2a2a2a', gap: 12 },
  rowIcon: { fontSize: 18, width: 28, textAlign: 'center' },
  rowContent: { flex: 1 },
  rowLabel: { color: '#fff', fontSize: 14, fontWeight: '600' },
  rowValue: { color: '#888', fontSize: 13, marginTop: 2 },
  rowAction: { color: '#2ecc71', fontSize: 13, fontWeight: '600' },
  editWrap: { flexDirection: 'row', gap: 8, padding: 14, borderTopWidth: 1, borderTopColor: '#2a2a2a' },
  editInput: { flex: 1, backgroundColor: '#0a0a0a', borderWidth: 1.5, borderColor: '#2a2a2a', borderRadius: 10, color: '#fff', fontSize: 14, paddingHorizontal: 14, paddingVertical: 10 },
  btnSave: { backgroundColor: '#2ecc71', borderRadius: 10, paddingHorizontal: 18, justifyContent: 'center' },
  btnSaveText: { color: '#000', fontWeight: '700', fontSize: 13 },
  connRow: { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: '#2a2a2a', gap: 12 },
  connLogo: { width: 36, height: 36, borderRadius: 8, backgroundColor: '#222', justifyContent: 'center', alignItems: 'center' },
  connInfo: { flex: 1 },
  connName: { color: '#fff', fontSize: 14, fontWeight: '600' },
  connStatus: { color: '#888', fontSize: 12, marginTop: 2 },
  connStatusOk: { color: '#2ecc71' },
  badgeConnected: { backgroundColor: '#0d2018', borderWidth: 1, borderColor: '#2ecc71', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  badgeConnectedText: { color: '#2ecc71', fontSize: 11, fontWeight: '700' },
  badgeSoon: { backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  badgeSoonText: { color: '#888', fontSize: 11, fontWeight: '600' },
  btnLogout: { backgroundColor: '#2a1212', borderWidth: 1, borderColor: '#5a2020', borderRadius: 14, padding: 15, alignItems: 'center', marginBottom: 10 },
  btnLogoutText: { color: '#f87171', fontSize: 15, fontWeight: '700' },
  btnDelete: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#3a1515', borderRadius: 14, padding: 15, alignItems: 'center' },
  btnDeleteText: { color: '#f87171', fontSize: 14, fontWeight: '600', opacity: 0.7 },
  toast: { position: 'absolute', bottom: 24, left: 40, right: 40, backgroundColor: '#1a3a1a', borderWidth: 1, borderColor: '#2ecc71', borderRadius: 25, paddingVertical: 12, paddingHorizontal: 24, alignItems: 'center' },
  toastText: { color: '#2ecc71', fontSize: 14, fontWeight: '600' },
});
