import { useState, useEffect, useCallback, useRef } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

const MAX_CREDITS = 5;

function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
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
  const creditsRef = useRef(credits);
  creditsRef.current = credits;

  useEffect(() => {
    if (!userId) return;
    fetchRemaining(userId).then(c => { setCredits(c); creditsRef.current = c; });
  }, [userId]);

  const consume = useCallback((): boolean => {
    if (creditsRef.current <= 0) return false;
    const next = creditsRef.current - 1;
    creditsRef.current = next;
    setCredits(next);
    return true;
  }, []);

  const refresh = useCallback(async () => {
    if (!userId) return;
    const remaining = await fetchRemaining(userId);
    creditsRef.current = remaining;
    setCredits(remaining);
  }, [userId]);

  return { credits, maxCredits: MAX_CREDITS, refresh, consume };
}
