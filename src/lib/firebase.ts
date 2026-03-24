import { initializeApp } from 'firebase/app';
import { getAuth, initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  FIREBASE_API_KEY,
  FIREBASE_AUTH_DOMAIN,
  FIREBASE_PROJECT_ID,
  FIREBASE_STORAGE_BUCKET,
  FIREBASE_MESSAGING_SENDER_ID,
  FIREBASE_APP_ID,
  FIREBASE_MEASUREMENT_ID,
} from '@env';

const firebaseConfig = {
  apiKey: FIREBASE_API_KEY || '',
  authDomain: FIREBASE_AUTH_DOMAIN || '',
  projectId: FIREBASE_PROJECT_ID || '',
  storageBucket: FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: FIREBASE_MESSAGING_SENDER_ID || '',
  appId: FIREBASE_APP_ID || '',
  measurementId: FIREBASE_MEASUREMENT_ID || '',
};

if (!firebaseConfig.apiKey) {
  console.error('Firebase config missing — .env vars not loaded');
}

const app = initializeApp(firebaseConfig);

let auth: ReturnType<typeof getAuth>;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch {
  auth = getAuth(app);
}

export { auth };
export const db = getFirestore(app);
