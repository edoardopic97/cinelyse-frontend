import { useState, useEffect, useCallback, useRef } from 'react';
import { RewardedAd, RewardedAdEventType, AdEventType } from 'react-native-google-mobile-ads';

const AD_UNIT_ID = 'ca-app-pub-4172706723924366/1399132172';

export function useRewardedAd() {
  const [loaded, setLoaded] = useState(false);
  const [showing, setShowing] = useState(false);
  const rewardedRef = useRef<RewardedAd | null>(null);
  const onRewardRef = useRef<(() => void) | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  const loadAd = useCallback(() => {
    setLoaded(false);
    cleanupRef.current?.();

    const rewarded = RewardedAd.createForAdRequest(AD_UNIT_ID);
    rewardedRef.current = rewarded;

    const unsubLoaded = rewarded.addAdEventListener(RewardedAdEventType.LOADED, () => setLoaded(true));
    const unsubEarned = rewarded.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => onRewardRef.current?.());
    const unsubClosed = rewarded.addAdEventListener(AdEventType.CLOSED, () => { setShowing(false); loadAd(); });
    const unsubError = rewarded.addAdEventListener(AdEventType.ERROR, () => { setLoaded(false); setTimeout(loadAd, 5000); });

    rewarded.load();

    cleanupRef.current = () => { unsubLoaded(); unsubEarned(); unsubClosed(); unsubError(); };
    return cleanupRef.current;
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => { loadAd(); }, 500);
    return () => { clearTimeout(timer); cleanupRef.current?.(); };
  }, [loadAd]);

  const showAd = useCallback((onReward: () => void): boolean => {
    if (!loaded || !rewardedRef.current) return false;
    onRewardRef.current = onReward;
    setShowing(true);
    rewardedRef.current.show();
    return true;
  }, [loaded]);

  return { loaded, showing, showAd };
}
