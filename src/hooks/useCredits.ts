import { useState, useEffect, useCallback, useRef } from 'react';
import { doc, getDoc, setDoc, updateDoc, increment } from 'firebase/firestore';
import { db } from '../lib/firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';

const FREE_CREDITS = 3;
const PREMIUM_CREDITS = 15;

function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

async function fetchRemaining(userId: string, maxCredits: number): Promise<number> {
  try {
    const ref = doc(db, 'users', userId, 'credits', todayKey());
    const snap = await getDoc(ref);
    const used = snap.exists() ? snap.data().used || 0 : 0;
    return Math.max(maxCredits - used, 0);
  } catch {
    return maxCredits;
  }
}

export function useCredits(userId?: string) {
  const [isPremium, setIsPremiumState] = useState(false);
  const maxCredits = isPremium ? PREMIUM_CREDITS : FREE_CREDITS;
  const [credits, setCredits] = useState(maxCredits);
  const creditsRef = useRef(credits);
  creditsRef.current = credits;

  // Load premium status from Firestore (source of truth), fallback to AsyncStorage
  useEffect(() => {
    if (!userId) return;
    // Read cached value immediately for fast UI
    AsyncStorage.getItem(`premium_${userId}`).then(val => {
      if (val === 'true') setIsPremiumState(true);
    }).catch(() => {});
    // Then sync from Firestore
    getDoc(doc(db, 'users', userId)).then(snap => {
      const val = snap.exists() && snap.data().premium === true;
      setIsPremiumState(val);
      AsyncStorage.setItem(`premium_${userId}`, val ? 'true' : 'false').catch(() => {});
    }).catch(() => {});
  }, [userId]);

  // Fetch remaining credits when userId or premium status changes
  useEffect(() => {
    if (!userId) return;
    fetchRemaining(userId, isPremium ? PREMIUM_CREDITS : FREE_CREDITS).then(c => {
      setCredits(c);
      creditsRef.current = c;
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
    const remaining = await fetchRemaining(userId, isPremium ? PREMIUM_CREDITS : FREE_CREDITS);
    creditsRef.current = remaining;
    setCredits(remaining);
  }, [userId, isPremium]);

  const setPremium = useCallback(async (value: boolean) => {
    setIsPremiumState(value);
    if (userId) {
      await AsyncStorage.setItem(`premium_${userId}`, value ? 'true' : 'false').catch(() => {});
      // Also store in Firestore so backend can check
      await setDoc(doc(db, 'users', userId), { premium: value }, { merge: true }).catch(() => {});
    }
  }, [userId]);

  const refund = useCallback(() => {
    const next = creditsRef.current + 1;
    creditsRef.current = next;
    setCredits(next);
  }, []);

  const grantAdCredit = useCallback(async () => {
    if (!userId) return;
    try {
      const ref = doc(db, 'users', userId, 'credits', todayKey());
      const snap = await getDoc(ref);
      const used = snap.exists() ? snap.data().used || 0 : 0;
      if (used > 0) {
        await updateDoc(ref, { used: increment(-1) });
      }
      await refresh();
    } catch {
      refund();
    }
  }, [userId, refresh, refund]);

  return { credits, maxCredits, isPremium, refresh, consume, refund, grantAdCredit, setPremium };
}
