import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';

export default function ProfileScreen({ navigation }) {
  const user = auth.currentUser;

  const handleLogout = async () => {
    await signOut(auth);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.icon}>👤</Text>
      <Text style={styles.title}>{user?.displayName || 'Profile'}</Text>
      <Text style={styles.sub}>{user?.email || ''}</Text>
      <Text style={styles.comingSoon}>Full profile coming soon</Text>
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', justifyContent: 'center', alignItems: 'center', gap: 6, padding: 24 },
  icon: { fontSize: 48, marginBottom: 8 },
  title: { color: '#fff', fontSize: 18, fontWeight: '700' },
  sub: { color: '#888', fontSize: 13 },
  comingSoon: { color: '#666', fontSize: 12, marginTop: 16, marginBottom: 24 },
  logoutBtn: { borderWidth: 1, borderColor: '#444', borderRadius: 20, paddingHorizontal: 24, paddingVertical: 10 },
  logoutText: { color: '#aaa', fontSize: 14, fontWeight: '600' },
});
