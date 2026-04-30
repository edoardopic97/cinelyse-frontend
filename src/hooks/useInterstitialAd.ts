import { useState, useEffect, useCallback, useRef } from 'react';
import { InterstitialAd, AdEventType } from 'react-native-google-mobile-ads';

const AD_UNIT_ID = 'ca-app-pub-4172706723924366/5058328127';

export function useInterstitialAd() {
  const [loaded, setLoaded] = useState(false);
  const [showing, setShowing] = useState(false);
  const adRef = useRef<InterstitialAd | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  const loadAd = useCallback(() => {
    setLoaded(false);
    cleanupRef.current?.();

    const ad = InterstitialAd.createForAdRequest(AD_UNIT_ID);
    adRef.current = ad;

    const unsubLoaded = ad.addAdEventListener(AdEventType.LOADED, () => setLoaded(true));
    const unsubClosed = ad.addAdEventListener(AdEventType.CLOSED, () => { setShowing(false); loadAd(); });
    const unsubError = ad.addAdEventListener(AdEventType.ERROR, () => { setLoaded(false); setTimeout(loadAd, 5000); });

    ad.load();

    cleanupRef.current = () => { unsubLoaded(); unsubClosed(); unsubError(); };
    return cleanupRef.current;
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => { loadAd(); }, 1000);
    return () => { clearTimeout(timer); cleanupRef.current?.(); };
  }, [loadAd]);

  const showAd = useCallback((): boolean => {
    if (!loaded || !adRef.current) return false;
    setShowing(true);
    adRef.current.show();
    return true;
  }, [loaded]);

  return { loaded, showing, showAd };
}
