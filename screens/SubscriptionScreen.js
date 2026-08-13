import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import {
  initConnection,
  endConnection,
  getSubscriptions,
  requestSubscription,
  purchaseUpdatedListener,
  purchaseErrorListener,
  finishTransaction,
} from 'react-native-iap';
import { useTheme } from '../context/ThemeContext';
import { usePlan, TIER_PRO, TIER_CREATOR } from '../constants/plan';
import { showAlert } from '../components/BrandedAlert';
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
  const { tier: currentTier } = usePlan();
  const [connected, setConnected] = useState(false);
  const [skuDetails, setSkuDetails] = useState({});
  const [purchasing, setPurchasing] = useState(null);
  const [billingCycle, setBillingCycle] = useState('monthly');

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
      }
    })();

    purchaseUpdateSub = purchaseUpdatedListener(async (purchase) => {
      try {
        const token = purchase.purchaseToken;
        if (!token) return;
        const idToken = await auth.currentUser?.getIdToken();
        const res = await fetch(`${BACKEND}/api/verify-purchase`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
          body: JSON.stringify({ purchaseToken: token, productId: purchase.productId }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.ok) {
          await finishTransaction({ purchase, isConsumable: false });
          setPurchasing(null);
          showAlert(
            "You're upgraded!",
            `Welcome to ${data.plan === TIER_CREATOR ? 'Creator' : 'Pro'}. Your credits are ready.`,
            [{ text: 'Great', onPress: () => navigation.goBack() }]
          );
        } else {
          setPurchasing(null);
          showAlert(
            'Purchase not verified',
            data.error || "Something went wrong confirming this purchase. If you were charged, contact support and we'll sort it out.",
            [{ text: 'OK' }]
          );
        }
      } catch (e) {
        setPurchasing(null);
        showAlert(
          'Purchase not verified',
          "Something went wrong confirming this purchase. If you were charged, contact support and we'll sort it out.",
          [{ text: 'OK' }]
        );
      }
    });

    purchaseErrorSub = purchaseErrorListener((error) => {
      setPurchasing(null);
      if (error.code !== 'E_USER_CANCELLED') {
        showAlert('Purchase failed', error.message || 'Could not complete the purchase.', [{ text: 'OK' }]);
      }
    });

    return () => {
      purchaseUpdateSub?.remove();
      purchaseErrorSub?.remove();
      endConnection();
    };
  }, []);

  const handleSubscribe = useCallback(async (tierKey) => {
    const plan = PRODUCTS[tierKey];
    const basePlanId = billingCycle === 'yearly' ? plan.yearlyBasePlanId : plan.monthlyBasePlanId;
    const detail = skuDetails[plan.productId];
    const offer = detail?.subscriptionOfferDetails?.find((o) => o.basePlanId === basePlanId);

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
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <MaterialIcons name="close" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Upgrade</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
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
});
