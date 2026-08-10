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

/** The current account's plan and whether it unlocks premium. */
export function usePlan() {
  const [tier, setTier] = useState(TIER_FREE);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let unsubDoc = null;
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (unsubDoc) { unsubDoc(); unsubDoc = null; }
      if (!user) { setTier(TIER_FREE); setLoaded(true); return; }
      unsubDoc = onSnapshot(
        doc(db, 'users', user.uid),
        (snap) => { setTier(snap.data()?.plan || TIER_FREE); setLoaded(true); },
        // A read failure (offline, permission error) must not get stuck
        // showing nothing forever - fall back to free rather than hang.
        () => { setTier(TIER_FREE); setLoaded(true); }
      );
    });
    return () => { unsubAuth(); if (unsubDoc) unsubDoc(); };
  }, []);

  return { tier, isPremium: tierUnlocksPremium(tier), loaded };
}
