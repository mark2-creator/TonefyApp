import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, SafeAreaView, ScrollView,
  ActivityIndicator, Alert
} from 'react-native';

const BACKEND = 'http://173.212.232.182:5000';

export default function IdeaToVideoScreen({ navigation }) {
  const [prompt, setPrompt] = useState('');
  const [script, setScript] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);

  const generateScript = async () => {
    if (!prompt.trim()) return Alert.alert('Error', 'Enter a prompt first');
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND}/api/generate-script`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      if (data.script) {
        setScript(data.script);
        setStep(2);
      } else {
        Alert.alert('Error', data.error || 'Failed to generate script');
      }
    } catch (err) {
      Alert.alert('Error', 'Could not connect to server');
    }
    setLoading(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Idea to Video</Text>
        <View />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.stepCard}>
          <Text style={styles.stepLabel}>Step 1 — Your Idea</Text>
          <TextInput
            style={styles.textArea}
            placeholder="e.g. A motivational video about morning routines..."
            placeholderTextColor="#555"
            value={prompt}
            onChangeText={setPrompt}
            multiline
            numberOfLines={4}
          />
          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={generateScript}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={styles.btnText}>✨ Generate Script</Text>
            )}
          </TouchableOpacity>
        </View>

        {script ? (
          <View style={styles.stepCard}>
            <Text style={styles.stepLabel}>Step 2 — Generated Script</Text>
            <TextInput
              style={styles.textArea}
              value={script}
              onChangeText={setScript}
              multiline
              numberOfLines={8}
              color="#fff"
            />
            <TouchableOpacity
              style={styles.btn}
              onPress={() => Alert.alert('Coming Soon', 'Voice generation coming next!')}
            >
              <Text style={styles.btnText}>🎙️ Generate Voiceover</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#1a1a1a' },
  back: { color: '#2ecc71', fontSize: 16 },
  title: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  scroll: { flex: 1 },
  content: { padding: 16 },
  stepCard: { backgroundColor: '#1a1a1a', borderRadius: 12, padding: 16, marginBottom: 16 },
  stepLabel: { color: '#2ecc71', fontWeight: 'bold', fontSize: 14, marginBottom: 12 },
  textArea: { backgroundColor: '#0a0a0a', color: '#fff', borderRadius: 8, padding: 12, minHeight: 100, textAlignVertical: 'top', borderWidth: 1, borderColor: '#333', fontSize: 14, marginBottom: 12 },
  btn: { backgroundColor: '#2ecc71', borderRadius: 25, padding: 14, alignItems: 'center' },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#000', fontWeight: 'bold', fontSize: 15 },
});
