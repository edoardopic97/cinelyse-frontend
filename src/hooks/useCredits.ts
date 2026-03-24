import { useState, useEffect, useCallback } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

const MAX_CREDITS = 5;

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

async function fetchRemaining(userId: string): Promise<number> {
  try {
    const ref = doc(db, 'users', userId, 'credits', todayKey());
    const snap = await getDoc(ref);
    const used = snap.exists() ? snap.data().used || 0 : 0;
    return Math.max(MAX_CREDITS - used, 0);
  } catch {
    return MAX_CREDITS;
  }
}

export function useCredits(userId?: string) {
  const [credits, setCredits] = useState(MAX_CREDITS);

  useEffect(() => {
    if (!userId) return;
    fetchRemaining(userId).then(setCredits);
  }, [userId]);

  const refresh = useCallback(async () => {
    if (!userId) return;
    const remaining = await fetchRemaining(userId);
    setCredits(remaining);
  }, [userId]);

  return { credits, maxCredits: MAX_CREDITS, refresh };
}
