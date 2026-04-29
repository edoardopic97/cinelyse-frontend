import { useEffect, useState, useCallback, useRef } from 'react';
import { Alert, Platform } from 'react-native';

const SKU = 'cinelyse_premium_monthly';

export function useSubscription(onPremiumChange: (val: boolean) => Promise<void> | void) {
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const iapRef = useRef<any>(null);
  const onPremiumRef = useRef(onPremiumChange);
  onPremiumRef.current = onPremiumChange;

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    let purchaseSub: any = null;
    let errorSub: any = null;
    let mounted = true;

    (async () => {
      try {
        const iap = await import('react-native-iap');
        iapRef.current = iap;
        await iap.initConnection();
        if (!mounted) return;
        setConnected(true);

        purchaseSub = iap.purchaseUpdatedListener(async (purchase: any) => {
          try {
            if (purchase.productId === SKU) {
              await iap.finishTransaction({ purchase, isConsumable: false });
              await onPremiumRef.current(true);
            }
          } catch {}
          if (mounted) setLoading(false);
        });

        errorSub = iap.purchaseErrorListener((error: any) => {
          if (error.code !== 'E_USER_CANCELLED') {
            Alert.alert('Purchase failed', error.message || 'Something went wrong.');
          }
          if (mounted) setLoading(false);
        });
      } catch {
        if (mounted) setConnected(false);
      }
    })();

    return () => {
      mounted = false;
      try { purchaseSub?.remove?.(); } catch {}
      try { errorSub?.remove?.(); } catch {}
      try { iapRef.current?.endConnection?.(); } catch {}
    };
  }, []);

  const buy = useCallback(async () => {
    const iap = iapRef.current;
    if (!iap || !connected) {
      Alert.alert('Store unavailable', 'Could not connect to Google Play.');
      return;
    }
    setLoading(true);
    try {
      const subs = await iap.getSubscriptions({ skus: [SKU] });
      if (!subs.length) {
        Alert.alert('Not available', 'Subscription product not found.');
        setLoading(false);
        return;
      }
      const sub = subs[0];
      const offerToken = sub.subscriptionOfferDetails?.[0]?.offerToken;
      await iap.requestSubscription({
        sku: SKU,
        ...(offerToken && { subscriptionOffers: [{ sku: SKU, offerToken }] }),
      });
    } catch {
      setLoading(false);
    }
  }, [connected]);

  const restore = useCallback(async () => {
    const iap = iapRef.current;
    if (!iap) return;
    setLoading(true);
    try {
      const purchases = await iap.getAvailablePurchases();
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
