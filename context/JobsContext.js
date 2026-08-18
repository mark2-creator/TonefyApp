import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from '../firebase';

const BACKEND = 'https://api.fitlifesolutions.site';
const KEY = 'tonefy.activeJobs.v1';
const POLL_MS = 3000;

// Renders and generations that outlive the screen that started them.
//
// Every one of these already runs server-side and returns a jobId - the work continues
// whether the phone is looking or not. But each screen polled it in its own setInterval,
// so navigating away lost track of a render that was still happening, and the user was
// pinned to a progress bar for minutes. On the connections these testers are on, that is
// most of the time they spend in the app.
//
// One poller, above the screens, for every active job. Ids are persisted, so closing the
// app and coming back picks the render up again rather than orphaning it.
const JobsContext = createContext({ jobs: [], track: () => {}, forget: () => {} });

export function useJobs() { return useContext(JobsContext); }

// Lazily required, like utils/notifications.js: expo-notifications is a native module
// and a build without it must degrade rather than crash. A finished render that cannot
// notify is still a finished render.
function notifier() {
  try { return require('expo-notifications'); } catch (e) { return null; }
}

async function notifyDone(job) {
  const Notifications = notifier();
  if (!Notifications) return;
  try {
    const perm = await Notifications.getPermissionsAsync();
    if (!perm.granted) return;   // never prompt here - the moment work finishes is the
                                 // worst possible time to ask for permission
    await Notifications.scheduleNotificationAsync({
      content: {
        title: job.status === 'done' ? 'Your video is ready' : 'Video failed',
        body: job.status === 'done'
          ? (job.label || 'Tap to open it in Tonefy.')
          : (job.error || job.message || 'Something went wrong while rendering.'),
      },
      trigger: null,
    });
  } catch (e) {
    // A notification that will not send must never take the render down with it.
  }
}

export function JobsProvider({ children }) {
  const [jobs, setJobs] = useState([]);
  const timer = useRef(null);
  const seen = useRef(new Set());   // jobs already notified about, so a late poll cannot notify twice

  // Restore anything that was still running when the app was last closed.
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(KEY);
        if (raw) setJobs(JSON.parse(raw).filter(j => j && j.id));
      } catch (e) {}
    })();
  }, []);

  // Persist only what is needed to resume: the server holds the truth about progress.
  useEffect(() => {
    const live = jobs.filter(j => j.status !== 'done' && j.status !== 'error' && j.status !== 'failed');
    AsyncStorage.setItem(KEY, JSON.stringify(live.map(j => ({ id: j.id, kind: j.kind, label: j.label }))))
      .catch(() => {});
  }, [jobs]);

  // Kept in a ref so the poller below can read current jobs without being rebuilt on
  // every progress update - rebuilding it every three seconds would reset its own clock.
  const jobsRef = useRef(jobs);
  useEffect(() => { jobsRef.current = jobs; }, [jobs]);

  const track = useCallback((id, { kind = 'render', label = '' } = {}) => {
    if (!id) return;
    setJobs(prev => (prev.some(j => j.id === id) ? prev : [...prev, { id, kind, label, status: 'pending', progress: 0, message: 'Starting…' }]));
  }, []);

  const forget = useCallback((id) => {
    setJobs(prev => prev.filter(j => j.id !== id));
    seen.current.delete(id);
  }, []);

  useEffect(() => {
    const active = jobs.filter(j => j.status !== 'done' && j.status !== 'error' && j.status !== 'failed');
    if (!active.length) {
      if (timer.current) { clearInterval(timer.current); timer.current = null; }
      return undefined;
    }
    if (timer.current) return undefined;

    timer.current = setInterval(async () => {
      const token = await auth.currentUser?.getIdToken().catch(() => null);
      if (!token) return;
      // Snapshot the ids rather than closing over `jobs`, so the interval does not need
      // recreating every time progress ticks.
      const ids = jobsRef.current
        .filter(j => j.status !== 'done' && j.status !== 'error' && j.status !== 'failed')
        .map(j => j.id);
      for (const id of ids) {
        try {
          const res = await fetch(`${BACKEND}/api/job/${id}`, { headers: { Authorization: 'Bearer ' + token } });
          if (!res.ok) continue;
          const data = await res.json();
          setJobs(prev => prev.map(j => (j.id === id ? { ...j, ...data } : j)));
          const finished = data.status === 'done' || data.status === 'error' || data.status === 'failed';
          if (finished && !seen.current.has(id)) {
            seen.current.add(id);
            const job = jobsRef.current.find(j => j.id === id) || {};
            notifyDone({ ...job, ...data });
          }
        } catch (e) {
          // A failed poll is a blip, not a failed job. The next tick tries again.
        }
      }
    }, POLL_MS);

    return () => { if (timer.current) { clearInterval(timer.current); timer.current = null; } };
  }, [jobs.length]);

  return (
    <JobsContext.Provider value={{ jobs, track, forget }}>
      {children}
    </JobsContext.Provider>
  );
}
