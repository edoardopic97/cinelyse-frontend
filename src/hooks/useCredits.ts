import { useState, useEffect, useCallback, useRef } from 'react';
import { doc, getDoc, setDoc, updateDoc, increment, getDocFromServer } from 'firebase/firestore';
import { db } from '../lib/firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';

const FREE_CREDITS = 3;
const PREMIUM_CREDITS = 15;

function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

async function fetchRemaining(userId: string, maxCredits: number): Promise<number> {
  const ref = doc(db, 'users', userId, 'credits', todayKey());
  try {
    const snap = await getDocFromServer(ref);
    const used = snap.exists() ? snap.data().used || 0 : 0;
    return Math.max(maxCredits - used, 0);
  } catch {
    try {
      const snap = await getDoc(ref);
      const used = snap.exists() ? snap.data().used || 0 : 0;
      return Math.max(maxCredits - used, 0);
    } catch {
      return maxCredits;
    }
  }
}

async function fetchAdCreditUsed(userId: string): Promise<boolean> {
  try {
    const snap = await getDocFromServer(doc(db, 'users', userId, 'adCredits', todayKey()));
    return snap.exists() && snap.data().used === true;
  } catch {
    try {
      const snap = await getDoc(doc(db, 'users', userId, 'adCredits', todayKey()));
      return snap.exists() && snap.data().used === true;
    } catch {
      return false;
    }
  }
}

export function useCredits(userId?: string) {
  const [isPremium, setIsPremiumState] = useState(false);
  const maxCredits = isPremium ? PREMIUM_CREDITS : FREE_CREDITS;
  const [credits, setCredits] = useState(maxCredits);
  const [adCreditUsed, setAdCreditUsed] = useState(false);
  const creditsRef = useRef(credits);
  const adCreditUsedRef = useRef(adCreditUsed);

  // Keep refs in sync
  creditsRef.current = credits;
  adCreditUsedRef.current = adCreditUsed;

  // Load premium status
  useEffect(() => {
    if (!userId) return;
    AsyncStorage.getItem(`premium_${userId}`).then(val => {
      if (val === 'true') setIsPremiumState(true);
    }).catch(() => {});
    getDoc(doc(db, 'users', userId)).then(snap => {
      const val = snap.exists() && snap.data().premium === true;
      setIsPremiumState(val);
      AsyncStorage.setItem(`premium_${userId}`, val ? 'true' : 'false').catch(() => {});
    }).catch(() => {});
  }, [userId]);

  // Fetch credits and ad credit status from server on mount and when premium changes
  useEffect(() => {
    if (!userId) return;
    const mc = isPremium ? PREMIUM_CREDITS : FREE_CREDITS;
    fetchRemaining(userId, mc).then(c => {
      setCredits(c);
      creditsRef.current = c;
    });
    fetchAdCreditUsed(userId).then(used => {
      setAdCreditUsed(used);
      adCreditUsedRef.current = used;
    });
  }, [userId, isPremium]);

  const consume = useCallback((): boolean => {
    if (creditsRef.current <= 0) return false;
    const next = creditsRef.current - 1;
    creditsRef.current = next;
    setCredits(next);
    return true;
  }, []);

  const refresh = useCallback(async () => {
    if (!userId) return;
    const mc = isPremium ? PREMIUM_CREDITS : FREE_CREDITS;
    const remaining = await fetchRemaining(userId, mc);
    creditsRef.current = remaining;
    setCredits(remaining);
  }, [userId, isPremium]);

  const setPremium = useCallback(async (value: boolean) => {
    setIsPremiumState(value);
    if (userId) {
      await AsyncStorage.setItem(`premium_${userId}`, value ? 'true' : 'false').catch(() => {});
      await setDoc(doc(db, 'users', userId), { premium: value }, { merge: true }).catch(() => {});
    }
  }, [userId]);

  const refund = useCallback(() => {
    const next = creditsRef.current + 1;
    creditsRef.current = next;
    setCredits(next);
  }, []);

  const grantAdCredit = useCallback(async () => {
    if (!userId || adCreditUsedRef.current) return;
    try {
      // Mark ad credit as used FIRST to prevent double-tap
      adCreditUsedRef.current = true;
      setAdCreditUsed(true);
      await setDoc(doc(db, 'users', userId, 'adCredits', todayKey()), { used: true }, { merge: true });

      const ref = doc(db, 'users', userId, 'credits', todayKey());
      const snap = await getDoc(ref);
      const used = snap.exists() ? snap.data().used || 0 : 0;
      if (used > 0) {
        await updateDoc(ref, { used: increment(-1) });
      }
      await refresh();
    } catch {
      // Revert on failure
      adCreditUsedRef.current = false;
      setAdCreditUsed(false);
      refund();
    }
  }, [userId, refresh, refund]);

  return { credits, maxCredits, isPremium, adCreditUsed, refresh, consume, refund, grantAdCredit, setPremium };
}
