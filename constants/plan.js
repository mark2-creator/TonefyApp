import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// The one place that knows whether premium features are unlocked.
//
// There is no billing in this app yet - no IAP, no RevenueCat, no Stripe. So this
// reads a stored tier and defaults to free, and it exists so that wiring a real
// entitlement later is a change to ONE function rather than a hunt through every
// screen that gates something.
//
// Until billing exists, an "upgrade" prompt has nowhere to send anyone. That is why
// promptUpgrade below says plans are coming rather than pretending there is a
// checkout, and why nothing that is merely UNBUILT ever routes here: a diamond on a
// feature that does not exist implies paying would unlock it, and it would not.

const KEY = 'tonefy.planTier';

export const TIER_FREE = 'free';
export const TIER_STANDARD = 'standard';
export const TIER_PRO = 'pro';

const PAID = [TIER_STANDARD, TIER_PRO];

export function tierUnlocksPremium(tier) {
  return PAID.includes(tier);
}

/**
 * The current tier and whether it unlocks premium.
 *
 * `setTier` is here so the tier can be flipped while testing the locked and unlocked
 * states without a build. Real entitlement should replace the AsyncStorage read.
 */
export function usePlan() {
  const [tier, setTierState] = useState(TIER_FREE);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(KEY)
      .then(v => { if (alive) { setTierState(v || TIER_FREE); setLoaded(true); } })
      .catch(() => { if (alive) setLoaded(true); });
    return () => { alive = false; };
  }, []);

  const setTier = useCallback((next) => {
    setTierState(next);
    AsyncStorage.setItem(KEY, next).catch(() => {});
  }, []);

  return { tier, isPremium: tierUnlocksPremium(tier), loaded, setTier };
}
