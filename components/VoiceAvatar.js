import React from 'react';
import { View, Image, StyleSheet, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import Flag from './Flag';
import { avatarFor } from '../constants/avatars';

// A voice's face on a card: an illustrated portrait with its accent's flag on the
// corner, and a lock when the plan cannot use it.
//
// The portraits are bundled, not fetched - 60 of them, assigned deterministically by a
// hash of the voice id, so a voice keeps the same face between launches and between
// screens, and adding a voice does not reshuffle everyone else's. Two sets, because a
// male voice wearing a female face reads as a bug rather than a style.
//
// It replaced a tinted disc with the voice's initial, which was the right call with no
// assets and the wrong one once there were.
export default function VoiceAvatar({ voice, size = 44, selected, busy, playing, locked }) {
  return (
    <View style={{ width: size, height: size }}>
      <Image
        source={avatarFor(voice)}
        style={[
          styles.face,
          { width: size, height: size, borderRadius: size / 2 },
          selected && styles.faceSelected,
          locked && styles.faceLocked,
        ]}
      />
      {/* Overlays sit on the portrait rather than replacing it, so the face never
          disappears mid-preview and the card does not change shape. */}
      {(busy || playing) && (
        <View style={[styles.overlay, { borderRadius: size / 2 }]}>
          {busy
            ? <ActivityIndicator size="small" color="#fff" />
            : <MaterialIcons name="graphic-eq" size={size * 0.46} color="#fff" />}
        </View>
      )}
      {locked && !busy && !playing && (
        <View style={[styles.overlay, { borderRadius: size / 2 }]}>
          {/* Diamond rather than a padlock: this voice is not forbidden, it is on a
              paid plan, and the premium gold already says which one. */}
          <MaterialIcons name="diamond" size={size * 0.4} color="#f5c451" />
        </View>
      )}
      <View style={styles.flag}>
        <Flag country={voice.country} size={Math.max(11, size * 0.3)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  face: { backgroundColor: '#2a2a2a' },
  faceSelected: { borderWidth: 2, borderColor: '#2ECC71' },
  faceLocked: { opacity: 0.45 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center',
  },
  // Half off the portrait so it reads as a badge rather than as part of the picture.
  flag: { position: 'absolute', right: -4, bottom: -3 },
});
