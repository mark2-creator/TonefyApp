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
  // Floats OVER the bottom chrome instead of standing under it.
  //
  // It used to be a sibling of the navigator inside a flex column, so it occupied real
  // height and the navigator shrank to make room - which pushed the tab bar up by the
  // height of the banner every time a render started, and dropped it again when the
  // banner was dismissed. Chrome that moves because a background job exists reads as a
  // layout accident rather than a design.
  //
  // Absolute, so it displaces nothing, and lifted clear of the tab bar rather than
  // tucked beneath it. TAB_H matches MainTabs' own `60 + insets.bottom`; screens with
  // no tab bar have their own bottom toolbar of about the same height, so one offset
  // is right for both without asking the navigator which screen is showing.
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
        { bottom: TAB_H + insets.bottom + 8 },
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

// The tab bar's own height in MainTabs, before its safe-area padding.
const TAB_H = 60;

const styles = StyleSheet.create({
  bar: {
    position: 'absolute', left: 10, right: 10,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#141414',
    // A card, so it reads as floating above the screen rather than as a strip welded
    // to the bottom of it. Bordered all round for the same reason - a top-only border
    // is the shape of something anchored to an edge it is no longer touching.
    borderRadius: 14, borderWidth: 1, borderColor: '#2a2a2a',
    paddingHorizontal: 14, paddingVertical: 10,
    // Lifts it off whatever it is covering. Android needs elevation; the shadow props
    // are what iOS reads.
    elevation: 8,
    shadowColor: '#000', shadowOpacity: 0.45, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
  },
  barDone: { backgroundColor: '#0f2417' },
  barFailed: { backgroundColor: '#2a1414' },
  text: { flex: 1 },
  title: { color: '#fff', fontSize: 14, fontWeight: '700' },
  sub: { color: '#888', fontSize: 12, marginTop: 2 },
  pct: { color: '#2ECC71', fontSize: 11, fontWeight: '800' },
});
