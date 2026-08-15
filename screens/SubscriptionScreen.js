import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  initConnection,
  endConnection,
  getSubscriptions,
  requestSubscription,
  purchaseUpdatedListener,
  purchaseErrorListener,
  finishTransaction,
  getAvailablePurchases,
} from 'react-native-iap';
import { useTheme } from '../context/ThemeContext';
import { usePlan, TIER_PRO, TIER_CREATOR } from '../constants/plan';
import { showAlert } from '../components/BrandedAlert';
import Constants from 'expo-constants';
import { auth } from '../firebase';

const BACKEND = 'https://api.fitlifesolutions.site';

// Product/base-plan ids must exactly match what's created in Play Console -
// Monetise with Play -> Subscriptions. They're fixed here ahead of those
// products existing so creation over there can follow this naming, rather
// than this screen chasing whatever got typed in on the day.
const PRODUCTS = {
  [TIER_PRO]: {
    productId: 'tonefy_pro_monthly',
    label: 'Pro',
    monthlyBasePlanId: 'pro-monthly',
    yearlyBasePlanId: 'pro-yearly',
    monthlyPriceFallback: '$6.99/mo',
    yearlyPriceFallback: '$69.99/yr',
    features: ['60 credits / month', '1080p exports', 'No watermark', 'All caption styles & voices'],
  },
  [TIER_CREATOR]: {
    productId: 'tonefy_creator_monthly',
    label: 'Creator',
    monthlyBasePlanId: 'creator-monthly',
    yearlyBasePlanId: 'creator-yearly',
    monthlyPriceFallback: '$14.99/mo',
    yearlyPriceFallback: '$149.99/yr',
    features: ['300 credits / month', '1080p exports', 'No watermark', 'Priority rendering', 'All caption styles & voices'],
  },
};

export default function SubscriptionScreen({ navigation }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { tier: currentTier } = usePlan();
  const [connected, setConnected] = useState(false);
  const [skuDetails, setSkuDetails] = useState({});
  const [purchasing, setPurchasing] = useState(null);
  // Set when the Play Billing native module is missing from the running
  // binary. Distinct from `connected`, which is about reaching the store.
  const [iapUnavailable, setIapUnavailable] = useState(null);
  const [billingCycle, setBillingCycle] = useState('monthly');

  // Shared by the live listener and the restore-on-mount pass below, so a
  // purchase reaches the backend by whichever route gets to it first. Both
  // are needed: Play delivers a purchase asynchronously and may do it while
  // this screen is gone, and a purchase left unverified is also left
  // unacknowledged, which Google auto-refunds after three days.
  const verifyPurchase = useCallback(async (purchase, { silent = false } = {}) => {
    const token = purchase?.purchaseToken;
    if (!token) return false;
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const res = await fetch(`${BACKEND}/api/verify-purchase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ purchaseToken: token, productId: purchase.productId }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        // Acknowledge only after the backend has recorded the grant. Doing it
        // first would tell Google the entitlement was delivered when it might
        // not have been.
        await finishTransaction({ purchase, isConsumable: false });
        setPurchasing(null);
        showAlert(
          "You're upgraded!",
          `Welcome to ${data.plan === TIER_CREATOR ? 'Creator' : 'Pro'}. Your credits are ready.`,
          [{ text: 'Great', onPress: () => navigation.goBack() }]
        );
        return true;
      }
      setPurchasing(null);
      if (!silent) {
        showAlert(
          'Purchase not verified',
          data.error || "Something went wrong confirming this purchase. If you were charged, contact support and we'll sort it out.",
          [{ text: 'OK' }]
        );
      }
      return false;
    } catch (e) {
      setPurchasing(null);
      if (!silent) {
        showAlert(
          'Purchase not verified',
          "Something went wrong confirming this purchase. If you were charged, contact support and we'll sort it out.",
          [{ text: 'OK' }]
        );
      }
      return false;
    }
  }, [navigation]);

  // Held in a ref so the setup effect below can keep empty deps. Listing
  // verifyPurchase as a dependency re-runs the whole effect whenever its
  // identity changes, and each re-run repeats initConnection, the listener
  // registration and the restore pass. That is what put four parallel
  // /api/verify-purchase calls for one purchase token into the backend log
  // within 55ms on the first successful grant - harmless only because the
  // server claims each token atomically, which is not a thing to lean on.
  const verifyRef = useRef(verifyPurchase);
  useEffect(() => { verifyRef.current = verifyPurchase; }, [verifyPurchase]);

  useEffect(() => {
    let purchaseUpdateSub;
    let purchaseErrorSub;

    (async () => {
      try {
        await initConnection();
        setConnected(true);
        const skus = Object.values(PRODUCTS).map((p) => p.productId);
        const subs = await getSubscriptions({ skus });
        const bySku = {};
        subs.forEach((s) => { bySku[s.productId] = s; });
        setSkuDetails(bySku);
      } catch (e) {
        // Store unreachable, products not published yet, or a build without
        // Play Billing available (e.g. Expo Go) - screen still renders with
        // fallback prices below rather than crashing.
        console.log('[IAP] init/getSubscriptions failed:', e.message);
        return;
      }

      // Restore pass. purchaseUpdatedListener only fires while this screen is
      // mounted, and Play hands a purchase over asynchronously - after its own
      // "require authentication?" prompt, and often after the user has already
      // navigated away. That is exactly what happened on the first real test
      // purchase: Play took the payment, the screen had unmounted, nothing was
      // listening, and the backend was never called at all. Anything still
      // unacknowledged here is a purchase that was paid for and never
      // delivered, so it gets verified now. Silent, because on the ordinary
      // path there is nothing to report.
      try {
        const owned = await getAvailablePurchases();
        for (const purchase of owned || []) {
          if (purchase?.isAcknowledgedAndroid) continue;
          await verifyRef.current(purchase, { silent: true });
        }
      } catch (e) {
        console.log('[IAP] restore failed:', e.message);
      }
    })();

    // purchaseUpdatedListener/purchaseErrorListener are not passive
    // subscriptions - each builds a NativeEventEmitter over the IAP native
    // module and throws E_IAP_NOT_AVAILABLE synchronously if it is absent
    // (checkNativeAndroidAvailable, react-native-iap/src/internal/platform.ts).
    // Thrown from inside an effect that is not wrapped, that unmounts the whole
    // tree - the screen was going grey rather than falling back to the prices
    // below, which is what the catch above was already written to allow for.
    try {
    purchaseUpdateSub = purchaseUpdatedListener((purchase) => {
      verifyRef.current(purchase);
    });

    purchaseErrorSub = purchaseErrorListener((error) => {
      setPurchasing(null);
      if (error.code !== 'E_USER_CANCELLED') {
        showAlert('Purchase failed', error.message || 'Could not complete the purchase.', [{ text: 'OK' }]);
      }
    });
    } catch (e) {
      setIapUnavailable(e?.message || 'E_IAP_NOT_AVAILABLE');
      console.log('[IAP] listeners unavailable:', e?.message);
    }

    return () => {
      purchaseUpdateSub?.remove();
      purchaseErrorSub?.remove();
      // endConnection reaches the same native module and throws the same way.
      try { endConnection(); } catch (e) {}
    };
  }, []);

  const handleSubscribe = useCallback(async (tierKey) => {
    const plan = PRODUCTS[tierKey];
    const basePlanId = billingCycle === 'yearly' ? plan.yearlyBasePlanId : plan.monthlyBasePlanId;
    const detail = skuDetails[plan.productId];
    const offer = detail?.subscriptionOfferDetails?.find((o) => o.basePlanId === basePlanId);

    if (iapUnavailable) {
      showAlert(
        'Purchases need a newer version',
        'This installed version was built without Google Play Billing, so it cannot start a purchase. Update Tonefy from the Play Store and try again.',
        [{ text: 'OK' }]
      );
      return;
    }

    if (!connected || !detail || !offer) {
      showAlert(
        'Not available yet',
        "Subscriptions aren't live on the Play Store yet for this build. This screen is ready and will work as soon as the products are published.",
        [{ text: 'OK' }]
      );
      return;
    }

    setPurchasing(tierKey);
    try {
      await requestSubscription({
        subscriptionOffers: [{ sku: plan.productId, offerToken: offer.offerToken }],
      });
    } catch (e) {
      setPurchasing(null);
      if (e.code !== 'E_USER_CANCELLED') {
        showAlert('Purchase failed', e.message || 'Could not start the purchase.', [{ text: 'OK' }]);
      }
    }
  }, [connected, skuDetails, billingCycle]);

  const priceFor = (tierKey) => {
    const plan = PRODUCTS[tierKey];
    const basePlanId = billingCycle === 'yearly' ? plan.yearlyBasePlanId : plan.monthlyBasePlanId;
    const detail = skuDetails[plan.productId];
    const offer = detail?.subscriptionOfferDetails?.find((o) => o.basePlanId === basePlanId);
    const phase = offer?.pricingPhases?.pricingPhaseList?.[0];
    if (phase?.formattedPrice) return phase.formattedPrice;
    return billingCycle === 'yearly' ? plan.yearlyPriceFallback : plan.monthlyPriceFallback;
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.bg }]}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <MaterialIcons name="close" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Upgrade</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {!!iapUnavailable && (
          <View style={styles.notice}>
            <View style={styles.noticeHead}>
              <MaterialIcons name="info-outline" size={20} color="#f5c451" />
              <Text style={styles.noticeTitle}>Purchases need a newer version</Text>
            </View>
            <Text style={styles.noticeBody}>
              The prices below are the standard ones, not this store's converted prices, and Subscribe will not open Play. Update Tonefy from the Play Store to buy a plan.
            </Text>
            <Text style={styles.noticeMeta}>
              {`Installed ${Constants.expoConfig?.version || '?'} (build ${Constants.nativeBuildVersion || '?'}) · ${iapUnavailable}`}
            </Text>
          </View>
        )}

        <View style={styles.cycleRow}>
          <TouchableOpacity
            style={[styles.cyclePill, billingCycle === 'monthly' && styles.cyclePillActive]}
            onPress={() => setBillingCycle('monthly')}
          >
            <Text style={[styles.cycleText, billingCycle === 'monthly' && styles.cycleTextActive]}>Monthly</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.cyclePill, billingCycle === 'yearly' && styles.cyclePillActive]}
            onPress={() => setBillingCycle('yearly')}
          >
            <Text style={[styles.cycleText, billingCycle === 'yearly' && styles.cycleTextActive]}>Yearly · Save ~17%</Text>
          </TouchableOpacity>
        </View>

        {[TIER_PRO, TIER_CREATOR].map((tierKey) => {
          const plan = PRODUCTS[tierKey];
          const isCurrent = currentTier === tierKey;
          return (
            <View key={tierKey} style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <View style={styles.cardHeader}>
                <Text style={[styles.cardTitle, { color: theme.text }]}>{plan.label}</Text>
                <Text style={styles.cardPrice}>{priceFor(tierKey)}</Text>
              </View>
              {plan.features.map((f) => (
                <View key={f} style={styles.featureRow}>
                  <MaterialIcons name="check" size={16} color="#2ECC71" />
                  <Text style={[styles.featureText, { color: theme.subtext }]}>{f}</Text>
                </View>
              ))}
              <TouchableOpacity
                style={[styles.subscribeBtn, isCurrent && { backgroundColor: theme.border }]}
                disabled={isCurrent || purchasing === tierKey}
                onPress={() => handleSubscribe(tierKey)}
              >
                {purchasing === tierKey ? (
                  <ActivityIndicator color="#04211f" size="small" />
                ) : (
                  <Text style={[styles.subscribeBtnText, isCurrent && { color: theme.subtext }]}>
                    {isCurrent ? 'Current Plan' : `Subscribe to ${plan.label}`}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          );
        })}

        <Text style={[styles.disclaimer, { color: theme.subtext }]}>
          Subscriptions renew automatically and are billed through Google Play. Cancel anytime from your Play Store subscriptions page.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 12 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  content: { padding: 20, paddingBottom: 40 },
  cycleRow: { flexDirection: 'row', gap: 8, marginBottom: 20, alignSelf: 'center' },
  cyclePill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2a2a2a' },
  cyclePillActive: { backgroundColor: '#00d4d4', borderColor: '#00d4d4' },
  cycleText: { color: '#cfcfcf', fontSize: 13, fontWeight: '600' },
  cycleTextActive: { color: '#000' },
  card: { borderRadius: 16, borderWidth: 1, padding: 20, marginBottom: 16 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  cardTitle: { fontSize: 20, fontWeight: '700' },
  cardPrice: { fontSize: 16, fontWeight: '700', color: '#2ECC71' },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  featureText: { fontSize: 14 },
  subscribeBtn: { marginTop: 12, backgroundColor: '#2ECC71', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  subscribeBtnText: { color: '#04211f', fontWeight: '700', fontSize: 15 },
  disclaimer: { fontSize: 12, textAlign: 'center', marginTop: 8, lineHeight: 18 },
  notice: { backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 12, padding: 14, marginBottom: 20 },
  noticeHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  noticeTitle: { color: '#fff', fontSize: 14, fontWeight: '700' },
  noticeBody: { color: '#888', fontSize: 13, lineHeight: 19 },
  noticeMeta: { color: '#555', fontSize: 11, marginTop: 8 },
});
