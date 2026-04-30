import { useEffect, useState, useRef, useCallback } from 'react';
import { Alert, Platform } from 'react-native';

const SKU = 'cinelyse_premium_monthly';

// Static require - Metro needs this at bundle time
let RNIap: any = null;
try {
  RNIap = require('react-native-iap');
} catch (e) {
  // native module not available
}

export function useSubscription(onPremiumChange: (val: boolean) => Promise<void> | void) {
  const [loading, setLoading] = useState(false);
  const connectedRef = useRef(false);
  const onPremiumRef = useRef(onPremiumChange);
  onPremiumRef.current = onPremiumChange;

  useEffect(() => {
    if (Platform.OS !== 'android' || !RNIap) return;

    let purchaseSub: any = null;
    let errorSub: any = null;
    let mounted = true;

    RNIap.initConnection()
      .then(() => {
        if (!mounted) return;
        connectedRef.current = true;

        purchaseSub = RNIap.purchaseUpdatedListener(async (purchase: any) => {
          try {
            if (purchase.productId === SKU) {
              await RNIap.finishTransaction({ purchase, isConsumable: false });
              await onPremiumRef.current(true);
            }
          } catch {}
          if (mounted) setLoading(false);
        });

        errorSub = RNIap.purchaseErrorListener((error: any) => {
          if (error.code !== 'E_USER_CANCELLED') {
            Alert.alert('Purchase failed', error.message || 'Something went wrong.');
          }
          if (mounted) setLoading(false);
        });
      })
      .catch(() => {
        if (mounted) connectedRef.current = false;
      });

    return () => {
      mounted = false;
      try { purchaseSub?.remove?.(); } catch {}
      try { errorSub?.remove?.(); } catch {}
      try { RNIap?.endConnection?.(); } catch {}
    };
  }, []);

  const buy = useCallback(async () => {
    if (!RNIap || !connectedRef.current) {
      Alert.alert('Store unavailable', `Could not connect to Google Play. (module: ${!!RNIap}, connected: ${connectedRef.current})`);
      return;
    }
    setLoading(true);
    try {
      const subs = await RNIap.getSubscriptions({ skus: [SKU] });
      if (!subs.length) {
        Alert.alert('Not available', 'Subscription product not found.');
        setLoading(false);
        return;
      }
      const sub = subs[0];
      const offerToken = sub.subscriptionOfferDetails?.[0]?.offerToken;
      await RNIap.requestSubscription({
        sku: SKU,
        ...(offerToken && { subscriptionOffers: [{ sku: SKU, offerToken }] }),
      });
    } catch (e: any) {
      Alert.alert('Purchase error', e?.message || 'Unknown error');
      setLoading(false);
    }
  }, []);

  const restore = useCallback(async () => {
    if (!RNIap) return;
    setLoading(true);
    try {
      const purchases = await RNIap.getAvailablePurchases();
      const hasPremium = purchases.some((p: any) => p.productId === SKU);
      await onPremiumRef.current(hasPremium);
      if (!hasPremium) Alert.alert('No subscription found', 'No active Premium subscription on this account.');
    } catch {
      Alert.alert('Restore failed', 'Could not restore purchases.');
    } finally {
      setLoading(false);
    }
  }, []);

  return { buy, restore, loading };
}
