import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut, deleteUser, type User } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { getUserProfile, setUserProfile, deleteUserData } from '../lib/firestore';

interface AuthContextType {
  user: User | null;
  profile: any;
  loading: boolean;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  logout: async () => {},
  deleteAccount: async () => {},
  refreshProfile: async () => {},
  refreshUser: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = async () => {
    if (!user?.uid) return;
    const p = await getUserProfile(user.uid);
    setProfile(p);
  };

  // Listen for auth state changes AND token refreshes (which happen after email verification)
  useEffect(() => {
    const timeout = setTimeout(() => setLoading(false), 8000);
    const unsub = onAuthStateChanged(auth, async (u) => {
      try {
        setUser(u ? { ...u } as User : null);
        if (u) {
          const p = await getUserProfile(u.uid);
          if (!p) {
            await setUserProfile(u.uid, { email: u.email || '', displayName: u.displayName || '' });
            const newP = await getUserProfile(u.uid);
            setProfile(newP);
          } else {
            setProfile(p);
          }
        } else {
          setProfile(null);
        }
      } catch (e) {
        console.warn('Auth init error:', e);
      } finally {
        clearTimeout(timeout);
        setLoading(false);
      }
    });
    return () => { unsub(); clearTimeout(timeout); };
  }, []);

  const refreshUser = async () => {
    if (!auth.currentUser) return;
    await auth.currentUser.reload();
    setUser({ ...auth.currentUser } as User);
  };

  const logout = async () => {
    await signOut(auth);
    setProfile(null);
  };

  const deleteAccount = async () => {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;
    await deleteUserData(uid);
    await deleteUser(auth.currentUser);
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, logout, deleteAccount, refreshProfile, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
