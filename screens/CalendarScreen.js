import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function CalendarScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>📅</Text>
      <Text style={styles.title}>Content Calendar</Text>
      <Text style={styles.sub}>Coming soon</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', justifyContent: 'center', alignItems: 'center', gap: 8 },
  icon: { fontSize: 48, marginBottom: 8 },
  title: { color: '#fff', fontSize: 18, fontWeight: '700' },
  sub: { color: '#888', fontSize: 13 },
});
