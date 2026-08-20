import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useJobs } from '../context/JobsContext';
import ProgressRing from './ProgressRing';

// The reason it is safe to walk away from a render.
//
// Leaving the screen used to mean losing sight of the job entirely - so people sat and
// watched a bar for minutes. This keeps it visible everywhere: what is running, how far,
// and a way back to it. Without something like this, "you can leave the screen" is a
// claim the user has no reason to believe.
//
// Finished jobs stay until dismissed, because the notification may well have arrived
// while the phone was in a pocket.
export default function ActiveJobsBar({ onOpen }) {
  const { jobs, forget } = useJobs();
  // Mounted at the root, outside any screen, so nothing else is insetting it. On a
  // phone with gesture navigation or on-screen buttons it sat underneath them: the
  // subtitle was covered and the dismiss X was as good as unreachable.
  //
  // Padding rather than margin - the bar's background should reach the bottom of the
  // screen, or a strip of whatever is behind it shows through under the bar.
  //
  // The 10 is the paddingVertical the style already has, kept as the floor so a device
  // reporting no bottom inset looks exactly as it did.
  const insets = useSafeAreaInsets();
  if (!jobs.length) return null;

  // One bar, showing the oldest unfinished job - or the first finished one waiting to be
  // acknowledged. A stack of bars would cover the screen it is meant to let you use.
  const running = jobs.find(j => j.status !== 'done' && j.status !== 'error' && j.status !== 'failed');
  const job = running || jobs[0];
  const done = job.status === 'done';
  const failed = job.status === 'error' || job.status === 'failed';

  return (
    <TouchableOpacity
      style={[
        styles.bar,
        done && styles.barDone,
        failed && styles.barFailed,
        { paddingBottom: Math.max(10, insets.bottom) },
      ]}
      activeOpacity={0.85}
      onPress={() => (done || failed ? forget(job.id) : onOpen?.(job))}
    >
      {done ? (
        <MaterialIcons name="check-circle" size={26} color="#2ECC71" />
      ) : failed ? (
        <MaterialIcons name="error-outline" size={26} color="#ff6b6b" />
      ) : (
        <ProgressRing progress={job.progress || 0} size={30} stroke={2.5} iconSize={0} color="#2ECC71">
          <Text style={styles.pct}>{Math.round(job.progress || 0)}</Text>
        </ProgressRing>
      )}

      <View style={styles.text}>
        <Text style={styles.title} numberOfLines={1}>
          {done ? 'Your video is ready' : failed ? 'Video failed' : (job.label || 'Rendering your video')}
        </Text>
        <Text style={styles.sub} numberOfLines={1}>
          {done ? 'Find it in My Videos · tap to dismiss'
            : failed ? (job.error || job.message || 'Tap to dismiss')
            : (job.message || 'Working…')}
        </Text>
      </View>

      <MaterialIcons name={done || failed ? 'close' : 'chevron-right'} size={20} color="#888" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#141414', borderTopWidth: 1, borderTopColor: '#2a2a2a',
    paddingHorizontal: 16, paddingVertical: 10,
  },
  barDone: { backgroundColor: '#0f2417' },
  barFailed: { backgroundColor: '#2a1414' },
  text: { flex: 1 },
  title: { color: '#fff', fontSize: 14, fontWeight: '700' },
  sub: { color: '#888', fontSize: 12, marginTop: 2 },
  pct: { color: '#2ECC71', fontSize: 11, fontWeight: '800' },
});
