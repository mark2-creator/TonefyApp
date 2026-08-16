import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import Flag from './Flag';

// A voice's face on a card: a tinted disc carrying its initial, with the accent's flag
// on the corner.
//
// Not a photograph. Portraits of people who do not exist, attached to synthetic voices,
// would be a licensing question and a slightly dishonest one - these are TTS engines,
// not performers. A tinted initial is the same pattern Gmail and Slack use for exactly
// this problem, it distinguishes eight voices at a glance, and it costs no assets.
//
// The flag is drawn rather than emoji: this app's convention is no emoji anywhere, and
// flag emoji render as two letters on several Android builds regardless.
export default function VoiceAvatar({ voice, size = 44, selected, busy, playing }) {
  const initial = (voice.label || '?').trim().charAt(0).toUpperCase();
  return (
    <View style={{ width: size, height: size }}>
      <View style={[
        styles.disc,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: voice.tint },
        selected && styles.discSelected,
      ]}>
        {busy
          ? <ActivityIndicator size="small" color="#04211f" />
          : playing
            ? <MaterialIcons name="graphic-eq" size={size * 0.5} color="#04211f" />
            : <Text style={[styles.initial, { fontSize: size * 0.42 }]}>{initial}</Text>}
      </View>
      {/* Sits half off the disc so it reads as a badge rather than as part of the face. */}
      <View style={styles.flag}>
        <Flag country={voice.country} size={11} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  disc: { alignItems: 'center', justifyContent: 'center' },
  discSelected: { borderWidth: 2, borderColor: '#fff' },
  initial: { color: '#04211f', fontWeight: '800' },
  flag: {
    position: 'absolute', right: -3, bottom: -2,
    borderRadius: 2, overflow: 'hidden',
    borderWidth: 1, borderColor: '#111',
  },
});
