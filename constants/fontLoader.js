import { useEffect, useState } from 'react';
import * as Font from 'expo-font';
import { FONT_ASSETS } from './fonts';

// The families are registered once per app launch and shared by every screen, so
// the work is held in a module-level promise rather than a hook - two screens
// mounting at once should wait on one load, not start two.
//
// Nothing blocks on this. Text renders in the system face until the families are
// registered and then swaps, which costs a frame on the picker and keeps a cold
// start off the critical path of a hundred-odd typeface registrations.
let loadPromise = null;
let loaded = false;

export function loadAppFonts() {
  if (!loadPromise) {
    loadPromise = Font.loadAsync(FONT_ASSETS)
      .then(() => { loaded = true; })
      .catch((e) => {
        // A family that fails to register falls back to the system face, which is
        // survivable - failing the screen over it would not be.
        console.warn('[fonts] load failed:', e?.message || e);
        loaded = true;
      });
  }
  return loadPromise;
}

export function useAppFonts() {
  const [ready, setReady] = useState(loaded);
  useEffect(() => {
    if (loaded) return undefined;
    let alive = true;
    loadAppFonts().then(() => { if (alive) setReady(true); });
    return () => { alive = false; };
  }, []);
  return ready;
}
