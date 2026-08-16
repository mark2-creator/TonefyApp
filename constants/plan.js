import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase';

// The one place that knows whether premium features are unlocked.
//
// This used to read a device-local AsyncStorage flag - useful for flipping
// locked/unlocked UI without a build, but it meant paying on one phone did
// not unlock the app on another, and a stale local flag could quietly
// disagree with what the account actually has. Firestore's users/{uid}.plan
// is the one source of truth now, read live so a plan change (today, by
// hand in the Firestore console) shows up without restarting the app. The
// backend's own retention check (cleanupOldFiles() in server.js) reads the
// same field the same way.
//
// There is still no billing in this app - no IAP, no RevenueCat, no Stripe.
// Wiring up real billing later is a checkout flow that writes this field;
// nothing about how it's read here needs to change. Until then, an
// "upgrade" prompt has nowhere to send anyone - that is why promptUpgrade
// (in EditVideoScreen.js) says plans are coming rather than pretending
// there is a checkout, and why nothing that is merely UNBUILT ever routes
// here: a diamond on a feature that does not exist implies paying would
// unlock it, and it would not.

export const TIER_FREE = 'free';
export const TIER_PRO = 'pro';
export const TIER_CREATOR = 'creator';

const PAID = [TIER_PRO, TIER_CREATOR];

export function tierUnlocksPremium(tier) {
  return PAID.includes(tier);
}

// Mirrors TIERS in ~/Tonefy-react/backend/tiers.js - duplicated across
// repos on purpose (no shared package between them). UI-only: what to show,
// what to gray out, what number to put in an upgrade prompt. The backend is
// what actually enforces every one of these; nothing here is a security
// boundary, only a description of one that lives server-side.
export const TIER_CAPS = {
  // 2 minutes, matching tiers.js on the backend - at 1 minute a free account
  // could not export anything at all from Idea-to-Video, because the generated
  // script read aloud runs past a minute. Credits remain the real ceiling.
  [TIER_FREE]: { creditsPerCycle: 5, maxExportSeconds: 2 * 60, maxResolution: '720p', watermark: true },
  [TIER_PRO]: { creditsPerCycle: 60, maxExportSeconds: 15 * 60, maxResolution: '1080p', watermark: false },
  [TIER_CREATOR]: { creditsPerCycle: 300, maxExportSeconds: 40 * 60, maxResolution: '1080p', watermark: false },
};

/**
 * The current account's plan, credit balance and whether it unlocks premium.
 *
 * creditsRemaining/creditsResetAt are null until a real value has loaded
 * (no user, still loading, or a read failure) - kept distinct from 0, which
 * is a real "no credits left" balance, so a screen can tell "unknown yet"
 * from "genuinely empty" rather than flashing 0 before the real value loads.
 */
export function usePlan() {
  const [tier, setTier] = useState(TIER_FREE);
  const [creditsRemaining, setCreditsRemaining] = useState(null);
  const [creditsResetAt, setCreditsResetAt] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let unsubDoc = null;
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (unsubDoc) { unsubDoc(); unsubDoc = null; }
      if (!user) {
        setTier(TIER_FREE); setCreditsRemaining(null); setCreditsResetAt(null); setLoaded(true);
        return;
      }
      unsubDoc = onSnapshot(
        doc(db, 'users', user.uid),
        (snap) => {
          const data = snap.data() || {};
          setTier(data.plan || TIER_FREE);
          setCreditsRemaining(typeof data.creditsRemaining === 'number' ? data.creditsRemaining : null);
          setCreditsResetAt(data.creditsResetAt || null);
          setLoaded(true);
        },
        // A read failure (offline, permission error) must not get stuck
        // showing nothing forever - fall back to free rather than hang.
        () => {
          setTier(TIER_FREE); setCreditsRemaining(null); setCreditsResetAt(null); setLoaded(true);
        }
      );
    });
    return () => { unsubAuth(); if (unsubDoc) unsubDoc(); };
  }, []);

  return {
    tier, isPremium: tierUnlocksPremium(tier), loaded,
    creditsRemaining, creditsResetAt,
    caps: TIER_CAPS[tier] || TIER_CAPS[TIER_FREE],
  };
}
