import React, { useMemo, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, Modal,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COUNTRIES } from '../constants/countries';

// A searchable list, not a free-text field. Three sign-ups typing "USA", "United
// States" and "US" would leave three values with nothing that can group them later;
// picking from one fixed list gives the same value every time.
export default function CountrySheet({ visible, value, onSelect, onClose }) {
  const [query, setQuery] = useState('');

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? COUNTRIES.filter(c => c.toLowerCase().includes(q)) : COUNTRIES;
  }, [query]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.dismissArea} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.grabber} />
          <View style={styles.headerRow}>
            <Text style={styles.title}>Country</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <MaterialIcons name="close" size={22} color="#888" />
            </TouchableOpacity>
          </View>

          <View style={styles.searchRow}>
            <MaterialIcons name="search" size={20} color="#888" />
            <TextInput
              style={styles.search}
              placeholder="Search countries"
              placeholderTextColor="#555"
              value={query}
              onChangeText={setQuery}
              autoCorrect={false}
            />
            {query !== '' && (
              <TouchableOpacity onPress={() => setQuery('')}>
                <MaterialIcons name="close" size={18} color="#888" />
              </TouchableOpacity>
            )}
          </View>

          <FlatList
            data={rows}
            keyExtractor={c => c}
            keyboardShouldPersistTaps="handled"
            initialNumToRender={20}
            renderItem={({ item }) => {
              const selected = item === value;
              return (
                <TouchableOpacity
                  style={styles.row}
                  onPress={() => { onSelect(item); onClose(); }}>
                  <Text style={[styles.rowText, selected && styles.rowTextSelected]}>{item}</Text>
                  {selected && <MaterialIcons name="check" size={18} color="#2ECC71" />}
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={<Text style={styles.empty}>No matching country</Text>}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  dismissArea: { flex: 1 },
  sheet: {
    backgroundColor: '#111', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 20, paddingTop: 10, height: '75%',
  },
  grabber: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#333', alignSelf: 'center', marginBottom: 12 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  title: { color: '#fff', fontSize: 18, fontWeight: '700' },
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#1a1a1a',
    borderRadius: 20, borderWidth: 1, borderColor: '#2a2a2a',
    paddingHorizontal: 14, paddingVertical: 8, marginBottom: 8,
  },
  search: { flex: 1, color: '#fff', fontSize: 14, padding: 0 },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#1e1e1e',
  },
  rowText: { color: '#e6e6e6', fontSize: 15 },
  rowTextSelected: { color: '#2ECC71', fontWeight: '600' },
  empty: { color: '#666', textAlign: 'center', marginTop: 40 },
});
