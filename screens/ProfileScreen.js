import React, { useEffect, useState, useCallback } from 'react';
import { MaterialIcons, FontAwesome6 } from '@expo/vector-icons';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, Image, Alert, ActivityIndicator, Modal
} from 'react-native';
import { signOut, updateProfile, deleteUser, multiFactor, TotpMultiFactorGenerator } from 'firebase/auth';
import QRCode from 'react-native-qrcode-svg';
import { doc, getDoc, deleteDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { useTheme } from '../context/ThemeContext';
import { usePlan, TIER_PRO, TIER_CREATOR } from '../constants/plan';
import { showAlert } from '../components/BrandedAlert';

const PLAN_LABELS = { [TIER_PRO]: 'Pro Plan', [TIER_CREATOR]: 'Creator Plan' };

function formatResetDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return '—';
  }
}

export default function ProfileScreen({ navigation }) {
  const { theme, isDark } = useTheme();
  const { tier, creditsRemaining, creditsResetAt, caps } = usePlan();
  const planLabel = PLAN_LABELS[tier] || 'Free Plan';
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
    showAlert(
      'Delete Account',
      'Are you sure you want to delete your account? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const uid = auth.currentUser.uid;
              // Firestore rules require auth.uid == userId, so this must run
              // before the Auth user is gone - deleting the Auth user first
              // would leave this doc permanently unreachable.
              await deleteDoc(doc(db, 'users', uid));
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
      showAlert('Error', 'Could not start 2FA setup. Try again.');
    } finally {
      setMfaLoading(false);
    }
  }

  async function handleVerifyMfa() {
    if (mfaCode.length !== 6) { showAlert('Error', 'Enter the 6-digit code from your authenticator app.'); return; }
    try {
      setMfaLoading(true);
      const cred = TotpMultiFactorGenerator.assertionForEnrollment(mfaSession, mfaCode);
      await multiFactor(user).enroll(cred, 'Authenticator App');
      setMfaEnabled(true);
      setShowMfaSetup(false);
      setMfaCode('');
      showToast('2FA enabled successfully!');
    } catch (e) {
      showAlert('Invalid Code', 'The code is incorrect or expired. Try again.');
    } finally {
      setMfaLoading(false);
    }
  }

  async function handleDisableMfa() {
    showAlert('Disable 2FA', 'Are you sure you want to disable two-factor authentication?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Disable', style: 'destructive', onPress: async () => {
        try {
          setMfaLoading(true);
          const factors = multiFactor(user).enrolledFactors;
          await multiFactor(user).unenroll(factors[0]);
          setMfaEnabled(false);
          showToast('2FA disabled.');
        } catch (e) {
          showAlert('Error', 'Could not disable 2FA. You may need to re-login first.');
        } finally {
          setMfaLoading(false);
        }
      }}
    ]);
  }

  function handleTikTokPress() {
    if (tiktok.connected) return;
    showAlert('Connect TikTok', 'TikTok connection in the app is coming soon — you can connect it on the website for now.');
  }

  const initial = (displayName || user?.email || '?')[0].toUpperCase();

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>My Profile</Text>

        <View style={styles.hero}>
          <View style={styles.avatar}>
            {user?.photoURL ? (
              <Image source={{ uri: user.photoURL }} style={styles.avatarImg} />
            ) : (
              <Text style={styles.avatarText}>{initial}</Text>
            )}
          </View>
          <Text style={[styles.profileName, { color: theme.text }]}>{displayName}</Text>
          <Text style={[styles.profileEmail, { color: theme.subtext }]}>{user?.email || ''}</Text>
          <View style={styles.planBadge}><Text style={styles.planBadgeText}>{planLabel}</Text></View>
        </View>

        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: theme.card, borderColor: theme.border }]}><Text style={[styles.statNum, { color: theme.accent }]}>{stats.total}</Text><Text style={[styles.statLabel, { color: theme.subtext }]}>Total Videos</Text></View>
          <View style={[styles.statCard, { backgroundColor: theme.card, borderColor: theme.border }]}><Text style={[styles.statNum, { color: theme.accent }]}>{stats.thisMonth}</Text><Text style={[styles.statLabel, { color: theme.subtext }]}>This Month</Text></View>
          <View style={[styles.statCard, { backgroundColor: theme.card, borderColor: theme.border }]}><Text style={[styles.statNum, { color: theme.accent }]}>{stats.scheduled}</Text><Text style={[styles.statLabel, { color: theme.subtext }]}>Scheduled</Text></View>
        </View>

        <View style={[styles.section, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.sectionHeader, { borderBottomColor: theme.border, color: theme.subtext }]}>Plan & Credits</Text>
          <View style={[styles.row, { borderBottomColor: theme.border }]}>
            <MaterialIcons name="bolt" size={18} color={theme.icon} style={styles.rowIcon} />
            <View style={styles.rowContent}>
              <Text style={[styles.rowLabel, { color: theme.text }]}>Credits Remaining</Text>
              <Text style={[styles.rowValue, { color: theme.subtext }]}>
                {creditsRemaining === null ? '—' : `${creditsRemaining} of ${caps.creditsPerCycle} this month`}
              </Text>
            </View>
          </View>
          <View style={[styles.row, { borderBottomWidth: 0 }]}>
            <MaterialIcons name="event-repeat" size={18} color={theme.icon} style={styles.rowIcon} />
            <View style={styles.rowContent}>
              <Text style={[styles.rowLabel, { color: theme.text }]}>Next Reset</Text>
              <Text style={[styles.rowValue, { color: theme.subtext }]}>{formatResetDate(creditsResetAt)}</Text>
            </View>
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.sectionHeader, { borderBottomColor: theme.border, color: theme.subtext }]}>Account</Text>
          <View style={[styles.row, { borderBottomColor: theme.border }]}>
            <MaterialIcons name="person" size={18} color={theme.icon} style={styles.rowIcon} />
            <View style={styles.rowContent}>
              <Text style={[styles.rowLabel, { color: theme.text }]}>Display Name</Text>
              <Text style={[styles.rowValue, { color: theme.subtext }]}>{displayName}</Text>
            </View>
            <TouchableOpacity onPress={() => setEditing(!editing)}>
              <Text style={[styles.rowAction, { color: theme.accent }]}>Edit</Text>
            </TouchableOpacity>
          </View>
          {editing && (
            <View style={[styles.editWrap, { borderTopColor: theme.border }]}>
              <TextInput
                style={[styles.editInput, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.text }]}
                value={nameInput}
                onChangeText={setNameInput}
                placeholder="Your name"
                placeholderTextColor={theme.subtext}
              />
              <TouchableOpacity style={styles.btnSave} onPress={handleSaveName} disabled={saving}>
                {saving ? <ActivityIndicator color="#000" size="small" /> : <Text style={styles.btnSaveText}>Save</Text>}
              </TouchableOpacity>
            </View>
          )}
          <View style={[styles.row, { borderBottomColor: theme.border }]}>
            <MaterialIcons name="email" size={18} color={theme.icon} style={styles.rowIcon} />
            <View style={styles.rowContent}>
              <Text style={[styles.rowLabel, { color: theme.text }]}>Email</Text>
              <Text style={[styles.rowValue, { color: theme.subtext }]}>{user?.email || '—'}</Text>
            </View>
          </View>
          <View style={[styles.row, { borderBottomWidth: 0 }]}>
            <MaterialIcons name="calendar-today" size={18} color={theme.icon} style={styles.rowIcon} />
            <View style={styles.rowContent}>
              <Text style={[styles.rowLabel, { color: theme.text }]}>Member Since</Text>
              <Text style={[styles.rowValue, { color: theme.subtext }]}>{joined}</Text>
            </View>
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.sectionHeader, { borderBottomColor: theme.border, color: theme.subtext }]}>Connected Accounts</Text>
          <View style={[styles.connRow, { borderBottomColor: theme.border }]}>
            <View style={[styles.connLogo, { backgroundColor: '#000' }]}>
              <FontAwesome6 name="tiktok" size={17} color="#fff" />
            </View>
            <View style={styles.connInfo}>
              <Text style={[styles.connName, { color: theme.text }]}>TikTok</Text>
              <Text style={[styles.connStatus, { color: theme.subtext }, tiktok.connected && styles.connStatusOk]}>{tiktok.label}</Text>
            </View>
            <TouchableOpacity onPress={handleTikTokPress}>
              <View style={tiktok.connected ? styles.badgeConnected : [styles.badgeSoon, { backgroundColor: theme.divider, borderColor: theme.border }]}>
                <Text style={tiktok.connected ? styles.badgeConnectedText : [styles.badgeSoonText, { color: theme.subtext }]}>
                  {tiktok.connected ? 'Connected' : 'Connect'}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
          <View style={[styles.connRow, { borderBottomColor: theme.border }]}>
            <View style={[styles.connLogo, { backgroundColor: '#1877F2' }]}>
              <FontAwesome6 name="facebook-f" size={16} color="#fff" />
            </View>
            <View style={styles.connInfo}>
              <Text style={[styles.connName, { color: theme.text }]}>Facebook</Text>
              <Text style={[styles.connStatus, { color: theme.subtext }]}>Coming soon</Text>
            </View>
            <View style={[styles.badgeSoon, { backgroundColor: theme.divider, borderColor: theme.border }]}><Text style={[styles.badgeSoonText, { color: theme.subtext }]}>Soon</Text></View>
          </View>
          <View style={[styles.connRow, { borderBottomWidth: 0 }]}>
            <View style={[styles.connLogo, { backgroundColor: '#E4405F' }]}>
              <FontAwesome6 name="instagram" size={18} color="#fff" />
            </View>
            <View style={styles.connInfo}>
              <Text style={[styles.connName, { color: theme.text }]}>Instagram</Text>
              <Text style={[styles.connStatus, { color: theme.subtext }]}>Coming soon</Text>
            </View>
            <View style={[styles.badgeSoon, { backgroundColor: theme.divider, borderColor: theme.border }]}><Text style={[styles.badgeSoonText, { color: theme.subtext }]}>Soon</Text></View>
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.sectionHeader, { borderBottomColor: theme.border, color: theme.subtext }]}>Security</Text>
          <View style={[styles.connRow, { borderBottomWidth: 0 }]}>
            <View style={[styles.connLogo, { backgroundColor: isDark ? '#1a2a1e' : '#e0f5e9' }]}>
              <MaterialIcons name="lock" size={18} color={isDark ? '#fff' : '#1a7a41'} />
            </View>
            <View style={styles.connInfo}>
              <Text style={[styles.connName, { color: theme.text }]}>Two-Factor Auth</Text>
              <Text style={[styles.connStatus, { color: theme.subtext }, mfaEnabled && styles.connStatusOk]}>
                {mfaEnabled ? 'Enabled' : 'Not enabled'}
              </Text>
            </View>
            {mfaLoading ? <ActivityIndicator color="#54e98a" /> : (
              <TouchableOpacity onPress={mfaEnabled ? handleDisableMfa : handleEnableMfa}>
                <View style={mfaEnabled ? styles.badgeConnected : [styles.badgeSoon, { backgroundColor: theme.divider, borderColor: theme.border }]}>
                  <Text style={mfaEnabled ? styles.badgeConnectedText : [styles.badgeSoonText, { color: theme.subtext }]}>
                    {mfaEnabled ? 'Disable' : 'Enable'}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <Modal visible={showMfaSetup} transparent animationType="slide">
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
            <View style={{ backgroundColor: theme.settingBg, borderRadius: 20, padding: 24, width: '100%', alignItems: 'center' }}>
              <Text style={{ color: theme.text, fontSize: 18, fontWeight: '700', marginBottom: 8 }}>Setup Authenticator</Text>
              <Text style={{ color: theme.subtext, fontSize: 13, textAlign: 'center', marginBottom: 20 }}>
                Scan this QR code with Google Authenticator or Authy, then enter the 6-digit code below.
              </Text>
              {qrUri && <QRCode value={qrUri} size={180} backgroundColor="#fff" />}
              <TextInput
                style={{ marginTop: 24, backgroundColor: theme.inputBg, color: theme.text, borderRadius: 12, padding: 14, width: '100%', fontSize: 22, letterSpacing: 8, textAlign: 'center', borderWidth: 1, borderColor: theme.inputBorder }}
                placeholder="000000"
                placeholderTextColor={theme.subtext}
                value={mfaCode}
                onChangeText={setMfaCode}
                keyboardType="number-pad"
                maxLength={6}
              />
              <TouchableOpacity
                style={{ marginTop: 16, backgroundColor: theme.accent, borderRadius: 12, padding: 14, width: '100%', alignItems: 'center' }}
                onPress={handleVerifyMfa}
                disabled={mfaLoading}
              >
                {mfaLoading ? <ActivityIndicator color="#003919" /> : <Text style={{ color: '#003919', fontWeight: '700', fontSize: 15 }}>Verify & Enable 2FA</Text>}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { setShowMfaSetup(false); setMfaCode(''); }} style={{ marginTop: 12 }}>
                <Text style={{ color: theme.subtext, fontSize: 13 }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <TouchableOpacity style={[styles.btnLogout, { backgroundColor: isDark ? '#2a1212' : '#ffe5e5', borderColor: isDark ? '#5a2020' : '#f5b5b5' }]} onPress={handleLogout}>
          <Text style={styles.btnLogoutText}>Log Out</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btnDelete, { borderColor: isDark ? '#3a1515' : '#f0c0c0' }]} onPress={handleDelete}>
          <Text style={styles.btnDeleteText}>Delete Account</Text>
        </TouchableOpacity>
      </ScrollView>

      {toastMsg && (
        <View style={[styles.toast, { backgroundColor: isDark ? '#1a3a1a' : '#e0f5e9' }]}>
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
