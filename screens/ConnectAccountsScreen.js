import React, { useState, useEffect } from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import {
  View, Text, TouchableOpacity, StyleSheet,
  StatusBar, Linking, ActivityIndicator, Alert, Image
} from 'react-native';
import { auth, db } from '../firebase';
import { doc, getDoc, setDoc, updateDoc, deleteField } from 'firebase/firestore';

const STATUSBAR_HEIGHT = StatusBar.currentHeight || 0;
const BACKEND = 'https://api.fitlifesolutions.site';

export default function ConnectAccountsScreen({ navigation }) {
  const [tiktok, setTiktok] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const user = auth.currentUser;

  useEffect(() => {
    loadTikTok();
  }, []);

  async function loadTikTok() {
    try {
      const snap = await getDoc(doc(db, 'connectedAccounts', user.uid));
      if (snap.exists() && snap.data().tiktok) {
        setTiktok(snap.data().tiktok);
      } else {
        setTiktok(null);
      }
    } catch (e) {}
    setLoading(false);
  }

  async function connectTikTok() {
    setConnecting(true);
    try {
      await Linking.openURL(`${BACKEND}/tiktok/auth`);
    } catch (e) {
      Alert.alert('Error', 'Could not open TikTok auth page');
    }
    setConnecting(false);
  }

  async function disconnectTikTok() {
    Alert.alert('Disconnect TikTok', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disconnect', style: 'destructive',
        onPress: async () => {
          try {
            await updateDoc(doc(db, 'connectedAccounts', user.uid), { tiktok: deleteField() });
            setTiktok(null);
          } catch (e) { Alert.alert('Error', e.message); }
        }
      }
    ]);
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a0a" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={20} color="#888" />
            <Text style={styles.back}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Connect Accounts</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={styles.main}>
        <Text style={styles.pageTitle}>Connect Accounts</Text>
        <Text style={styles.pageSub}>Link your social platforms to post directly</Text>

        {/* TikTok */}
        <View style={styles.card}>
          <View style={styles.cardLogo}>
            <MaterialIcons name="music-note" size={40} color="#fff" />
          </View>
          <Text style={styles.cardTitle}>Connect TikTok</Text>
          {loading ? (
            <ActivityIndicator color="#2ecc71" style={{ marginVertical: 20 }} />
          ) : tiktok ? (
            <>
              <View style={styles.connectedBox}>
                <View style={styles.connectedAvatar}>
                  {tiktok.avatar ? (
                    <Image source={{ uri: tiktok.avatar }} style={{ width: 44, height: 44, borderRadius: 22 }} />
                  ) : (
                    <MaterialIcons name="music-note" size={20} color="#fff" />
                  )}
                </View>
                <View>
                  <Text style={styles.connectedName}>{tiktok.displayName || 'TikTok User'}</Text>
                  <Text style={styles.connectedSub}>TikTok · Connected</Text>
                </View>
              </View>
              <TouchableOpacity style={styles.btnDisconnect} onPress={disconnectTikTok}>
                <Text style={styles.btnDisconnectText}>Disconnect TikTok</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.cardDesc}>To post videos to TikTok, connect your account below</Text>
              <View style={styles.perms}>
                <Text style={styles.permsTitle}>THIS WILL AUTHORIZE TONEFY AI TO:</Text>
                {['Upload videos to your TikTok', 'View your basic profile info', 'Receive post notifications'].map((p, i) => (
                  <View key={i} style={styles.permRow}>
                    <MaterialIcons name="check" size={16} color="#2ecc71" />
                    <Text style={styles.permText}>{p}</Text>
                  </View>
                ))}
              </View>
              <TouchableOpacity style={styles.btnConnect} onPress={connectTikTok} disabled={connecting}>
                {connecting ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnConnectText}>Connect TikTok Account</Text>}
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Coming soon platforms */}
        {['Facebook', 'Instagram', 'X (Twitter)'].map((p, i) => (
          <View key={i} style={styles.comingSoonCard}>
            <Text style={styles.comingSoonTitle}>{p} Coming Soon</Text>
            <Text style={styles.comingSoonSub}>{p} integration is in development.</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', paddingTop: STATUSBAR_HEIGHT },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#1a1a1a' },
  back: { color: '#2ecc71', fontSize: 15, fontWeight: '600' },
  title: { color: '#fff', fontSize: 16, fontWeight: '700' },
  main: { flex: 1, padding: 20 },
  pageTitle: { color: '#fff', fontSize: 22, fontWeight: '700', marginBottom: 4 },
  pageSub: { color: '#888', fontSize: 14, marginBottom: 24 },
  card: { backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 14, padding: 20, alignItems: 'center', marginBottom: 16 },
  cardLogo: { marginBottom: 12 },
  cardTitle: { color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 8 },
  cardDesc: { color: '#888', fontSize: 14, textAlign: 'center', marginBottom: 20, lineHeight: 20 },
  perms: { width: '100%', marginBottom: 20 },
  permsTitle: { color: '#888', fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 10 },
  permRow: { flexDirection: 'row', gap: 10, paddingVertical: 6 },
  permCheck: { color: '#2ecc71', fontWeight: '700' },
  permText: { color: '#aaa', fontSize: 14 },
  btnConnect: { width: '100%', backgroundColor: '#2ecc71', borderRadius: 25, padding: 16, alignItems: 'center' },
  btnConnectText: { color: '#000', fontWeight: '700', fontSize: 16 },
  connectedBox: { flexDirection: 'row', gap: 12, backgroundColor: '#0d2018', borderWidth: 1, borderColor: '#1a4a2a', borderRadius: 12, padding: 14, width: '100%', alignItems: 'center', marginBottom: 16 },
  connectedAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#1a4a2a', justifyContent: 'center', alignItems: 'center' },
  connectedName: { color: '#fff', fontSize: 15, fontWeight: '600' },
  connectedSub: { color: '#888', fontSize: 12, marginTop: 2 },
  btnDisconnect: { width: '100%', backgroundColor: '#2a1212', borderWidth: 1, borderColor: '#5a2020', borderRadius: 25, padding: 14, alignItems: 'center' },
  btnDisconnectText: { color: '#f87171', fontSize: 15, fontWeight: '600' },
  comingSoonCard: { backgroundColor: '#1a1a2e', borderWidth: 1, borderColor: '#2a2a4a', borderRadius: 14, padding: 20, alignItems: 'center', marginBottom: 12 },
  comingSoonTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 4 },
  comingSoonSub: { color: '#888', fontSize: 13 },
});
