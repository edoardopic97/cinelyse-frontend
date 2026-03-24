import {
  doc, getDoc, setDoc, updateDoc, collection, query, where,
  getDocs, deleteDoc, Timestamp, onSnapshot, type Unsubscribe,
  limit, startAfter, orderBy, type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from './firebase';

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface FriendRequest {
  id: string;
  fromUserId: string;
  fromUsername: string;
  toUserId: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: Timestamp;
}

export interface MovieActivity {
  movieId: string;
  title: string;
  poster?: string;
  watched: boolean;
  toWatch: boolean;
  favorite: boolean;
  rating?: number;
  review?: string;
  addedAt: Timestamp;
  watchedAt?: Timestamp;
  updatedAt: Timestamp;
  genres?: string[];
  year?: string;
  tmdbRating?: string;
  plot?: string;
  runtime?: string;
  director?: string;
  actors?: string;
  language?: string;
  country?: string;
  rated?: string;
  type?: string;
  tmdbID?: number;
  backdrop?: string;
  tagline?: string;
}

// ── User Profile ──

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, 'users', userId));
  return snap.exists() ? (snap.data() as UserProfile) : null;
}

export async function setUserProfile(userId: string, profile: Partial<UserProfile>): Promise<void> {
  const ref = doc(db, 'users', userId);
  const now = Timestamp.now();
  const data: any = { uid: userId, email: profile.email || '', updatedAt: now };
  if (profile.displayName) data.displayName = profile.displayName;
  if (profile.photoURL !== undefined) data.photoURL = profile.photoURL;
  if (profile.marketingOptIn !== undefined) data.marketingOptIn = profile.marketingOptIn;
  const snap = await getDoc(ref);
  if (!snap.exists()) data.createdAt = now;
  await setDoc(ref, data, { merge: true });
  if (profile.displayName) {
    const usernameRef = doc(db, 'usernames', profile.displayName.toLowerCase().trim());
    await setDoc(usernameRef, { userId, displayName: profile.displayName }).catch(() => {});
  }
}

export function subscribeToUserProfile(userId: string, callback: (profile: UserProfile | null) => void): Unsubscribe {
  return onSnapshot(doc(db, 'users', userId), (snap) => {
    callback(snap.exists() ? (snap.data() as UserProfile) : null);
  });
}

export async function checkUsernameExists(username: string): Promise<boolean> {
  const snap = await getDoc(doc(db, 'usernames', username.toLowerCase().trim()));
  return snap.exists();
}

// ── Friends ──

export async function getFriendRequests(userId: string): Promise<FriendRequest[]> {
  const q = query(collection(db, 'users', userId, 'friendRequests'), where('status', '==', 'pending'));
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data() as FriendRequest);
}

export function subscribeToFriendRequests(userId: string, callback: (reqs: FriendRequest[]) => void): Unsubscribe {
  const q = query(collection(db, 'users', userId, 'friendRequests'), where('status', '==', 'pending'));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => d.data() as FriendRequest));
  });
}

export async function acceptFriendRequest(userId: string, requestId: string, fromUserId: string): Promise<void> {
  await deleteDoc(doc(db, 'users', userId, 'friendRequests', requestId));
  await setDoc(doc(db, 'users', userId, 'friends', fromUserId), { userId: fromUserId, addedAt: Timestamp.now() });
  await setDoc(doc(db, 'users', fromUserId, 'friends', userId), { userId, addedAt: Timestamp.now() });
  const profile = await getDoc(doc(db, 'users', userId));
  const name = profile.exists() ? profile.data().displayName || 'Someone' : 'Someone';
  await addNotification(fromUserId, 'friend_accepted', `${name} accepted your friend request`);
}

export async function rejectFriendRequest(userId: string, requestId: string): Promise<void> {
  await deleteDoc(doc(db, 'users', userId, 'friendRequests', requestId));
}

export async function getFriends(userId: string): Promise<string[]> {
  const snap = await getDocs(collection(db, 'users', userId, 'friends'));
  return snap.docs.map(d => d.data().userId);
}

export async function searchUserByUsername(username: string) {
  const snap = await getDoc(doc(db, 'usernames', username.toLowerCase().trim()));
  if (!snap.exists()) return null;
  const userId = snap.data().userId;
  const profile = await getDoc(doc(db, 'users', userId));
  if (!profile.exists()) return null;
  const data = profile.data();
  return { uid: userId, displayName: data.displayName, photoURL: data.photoURL };
}

export async function sendFriendRequest(fromUserId: string, fromUsername: string, toUserId: string): Promise<void> {
  const ref = doc(collection(db, 'users', toUserId, 'friendRequests'));
  await setDoc(ref, { id: ref.id, fromUserId, fromUsername, toUserId, status: 'pending', createdAt: Timestamp.now() });
  await addNotification(toUserId, 'friend_request', `${fromUsername} sent you a friend request`, { fromUserId, requestId: ref.id });
}

export async function areFriends(userId: string, otherUserId: string): Promise<boolean> {
  const snap = await getDoc(doc(db, 'users', userId, 'friends', otherUserId));
  return snap.exists();
}

export async function hasPendingRequest(fromUserId: string, toUserId: string): Promise<boolean> {
  const q = query(
    collection(db, 'users', toUserId, 'friendRequests'),
    where('fromUserId', '==', fromUserId),
    where('status', '==', 'pending')
  );
  const snap = await getDocs(q);
  return !snap.empty;
}

// ── Movie Activity ──

export async function getMovieActivity(userId: string, movieId: string): Promise<MovieActivity | null> {
  const snap = await getDoc(doc(db, 'users', userId, 'movies', movieId));
  return snap.exists() ? (snap.data() as MovieActivity) : null;
}

export async function setMovieActivity(userId: string, movieId: string, activity: Partial<MovieActivity>): Promise<void> {
  const ref = doc(db, 'users', userId, 'movies', movieId);
  const now = Timestamp.now();
  const data: any = {
    movieId, title: activity.title || '', watched: activity.watched || false,
    toWatch: activity.toWatch || false, favorite: activity.favorite || false, updatedAt: now,
  };
  if (activity.poster) data.poster = activity.poster;
  if (activity.genres) data.genres = activity.genres;
  if (activity.year) data.year = activity.year;
  if (activity.tmdbRating) data.tmdbRating = activity.tmdbRating;
  if (activity.plot) data.plot = activity.plot;
  if (activity.runtime) data.runtime = activity.runtime;
  if (activity.director) data.director = activity.director;
  if (activity.actors) data.actors = activity.actors;
  if (activity.language) data.language = activity.language;
  if (activity.country) data.country = activity.country;
  if (activity.rated) data.rated = activity.rated;
  if (activity.type) data.type = activity.type;
  if (activity.tmdbID) data.tmdbID = activity.tmdbID;
  if (activity.backdrop) data.backdrop = activity.backdrop;
  if (activity.tagline) data.tagline = activity.tagline;
  if (activity.rating !== undefined) data.rating = activity.rating;
  if (activity.review) data.review = activity.review;
  if (activity.watchedAt) data.watchedAt = activity.watchedAt;
  if (activity.watched && !data.watchedAt) data.watchedAt = now;
  const snap = await getDoc(ref);
  if (!snap.exists()) data.addedAt = now;
  await setDoc(ref, data, { merge: true });
}

export async function rateMovie(userId: string, movieId: string, rating: number): Promise<void> {
  const ref = doc(db, 'users', userId, 'movies', movieId);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    await updateDoc(ref, { rating, updatedAt: Timestamp.now() });
  } else {
    await setDoc(ref, { movieId, rating, watched: false, toWatch: false, favorite: false, addedAt: Timestamp.now(), updatedAt: Timestamp.now() }, { merge: true });
  }
}


export async function removeMovieFromWatched(userId: string, movieId: string): Promise<void> {
  const ref = doc(db, 'users', userId, 'movies', movieId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const data = snap.data() as MovieActivity;
  if (!data.toWatch && !data.favorite) {
    await deleteDoc(ref);
  } else {
    await updateDoc(ref, { watched: false, updatedAt: Timestamp.now() });
  }
}

export async function removeMovieFromToWatch(userId: string, movieId: string): Promise<void> {
  const ref = doc(db, 'users', userId, 'movies', movieId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const data = snap.data() as MovieActivity;
  if (!data.watched && !data.favorite) {
    await deleteDoc(ref);
  } else {
    await updateDoc(ref, { toWatch: false, updatedAt: Timestamp.now() });
  }
}

export async function removeMovieFromFavorites(userId: string, movieId: string): Promise<void> {
  const ref = doc(db, 'users', userId, 'movies', movieId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const data = snap.data() as MovieActivity;
  if (!data.watched && !data.toWatch) {
    await deleteDoc(ref);
  } else {
    await updateDoc(ref, { favorite: false, updatedAt: Timestamp.now() });
  }
}

export async function getMovieList(userId: string, listType: 'watched' | 'toWatch' | 'favorite'): Promise<MovieActivity[]> {
  const q = query(collection(db, 'users', userId, 'movies'), where(listType, '==', true));
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data() as MovieActivity);
}

export function subscribeToMovieList(userId: string, listType: 'watched' | 'toWatch' | 'favorite', callback: (movies: MovieActivity[]) => void): Unsubscribe {
  const q = query(collection(db, 'users', userId, 'movies'), where(listType, '==', true));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => d.data() as MovieActivity));
  });
}

export async function getMovieListPaginated(
  userId: string,
  listType: 'watched' | 'toWatch' | 'favorite',
  pageSize: number = 20,
  lastDoc?: QueryDocumentSnapshot,
): Promise<{ movies: MovieActivity[]; lastDoc: QueryDocumentSnapshot | null }> {
  const constraints: any[] = [where(listType, '==', true), orderBy('updatedAt', 'desc'), limit(pageSize)];
  if (lastDoc) constraints.push(startAfter(lastDoc));
  const q = query(collection(db, 'users', userId, 'movies'), ...constraints);
  const snap = await getDocs(q);
  return {
    movies: snap.docs.map(d => d.data() as MovieActivity),
    lastDoc: snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null,
  };
}

export async function updateUserProfile(userId: string, updates: Partial<UserProfile>): Promise<void> {
  const ref = doc(db, 'users', userId);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setUserProfile(userId, updates);
  } else {
    await updateDoc(ref, { ...updates, updatedAt: Timestamp.now() });
  }
}

export async function deleteMovieActivity(userId: string, movieId: string): Promise<void> {
  await deleteDoc(doc(db, 'users', userId, 'movies', movieId));
}

export async function getAllUserMovies(userId: string): Promise<MovieActivity[]> {
  const snap = await getDocs(collection(db, 'users', userId, 'movies'));
  return snap.docs.map(d => d.data() as MovieActivity);
}

export interface AppNotification {
  id: string;
  type: 'friend_request' | 'friend_accepted' | 'general';
  message: string;
  read: boolean;
  createdAt: Timestamp;
}

export function subscribeToNotifications(userId: string, callback: (notifs: AppNotification[]) => void): Unsubscribe {
  const q = query(collection(db, 'users', userId, 'notifications'));
  return onSnapshot(q, (snap) => {
    const notifs = snap.docs.map(d => ({ id: d.id, ...d.data() } as AppNotification)).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    callback(notifs);
  });
}

export async function markNotificationsRead(userId: string): Promise<void> {
  const q = query(collection(db, 'users', userId, 'notifications'), where('read', '==', false));
  const snap = await getDocs(q);
  const updates = snap.docs.map(d => updateDoc(d.ref, { read: true }));
  await Promise.all(updates);
}

export async function deleteNotification(userId: string, notifId: string): Promise<void> {
  await deleteDoc(doc(db, 'users', userId, 'notifications', notifId));
}

export async function addNotification(userId: string, type: AppNotification['type'], message: string, extra?: Record<string, any>): Promise<void> {
  const ref = doc(collection(db, 'users', userId, 'notifications'));
  await setDoc(ref, { id: ref.id, type, message, read: false, createdAt: Timestamp.now(), ...extra });
  // Trigger push notification
  fetch('https://cinelyse-api.vercel.app/api/notify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, title: 'CINELYSE', body: message }),
  }).catch(() => {});
}

export async function findUsersByEmails(emails: string[], excludeUid: string): Promise<UserProfile[]> {
  if (!emails.length) return [];
  const results: UserProfile[] = [];
  for (let i = 0; i < emails.length; i += 30) {
    const batch = emails.slice(i, i + 30);
    const q = query(collection(db, 'users'), where('email', 'in', batch));
    const snap = await getDocs(q);
    snap.forEach(d => {
      const u = d.data() as UserProfile;
      if (u.uid !== excludeUid) results.push(u);
    });
  }
  return results;
}



export async function incrementSearchCount(userId: string): Promise<void> {
  const ref = doc(db, 'users', userId);
  const snap = await getDoc(ref);
  const current = snap.exists() ? (snap.data().totalSearches || 0) : 0;
  await setDoc(ref, { totalSearches: current + 1, updatedAt: Timestamp.now() }, { merge: true });
}

export async function getSearchCount(userId: string): Promise<number> {
  const snap = await getDoc(doc(db, 'users', userId));
  return snap.exists() ? (snap.data().totalSearches || 0) : 0;
}

export async function deleteUserData(userId: string): Promise<void> {
  const subs = ['movies', 'friends', 'friendRequests', 'notifications'];
  for (const sub of subs) {
    const snap = await getDocs(collection(db, 'users', userId, sub));
    await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
  }
  // Remove username mapping
  const profile = await getDoc(doc(db, 'users', userId));
  if (profile.exists()) {
    const name = profile.data().displayName;
    if (name) await deleteDoc(doc(db, 'usernames', name.toLowerCase().trim())).catch(() => {});
  }
  await deleteDoc(doc(db, 'users', userId));
}

export async function getUserStats(userId: string) {
  const snap = await getDocs(collection(db, 'users', userId, 'movies'));
  let totalWatched = 0, totalToWatch = 0, totalFavorites = 0, ratingSum = 0, ratingCount = 0;
  const genreMap = new Map<string, number>();
  snap.forEach(d => {
    const m = d.data() as MovieActivity;
    if (m.watched) totalWatched++;
    if (m.toWatch) totalToWatch++;
    if (m.favorite) totalFavorites++;
    if (m.rating && m.rating > 0) { ratingSum += m.rating; ratingCount++; }
    if (m.watched && m.genres) m.genres.forEach(g => genreMap.set(g, (genreMap.get(g) || 0) + 1));
  });
  const averageRating = ratingCount > 0 ? Math.round((ratingSum / ratingCount) * 10) / 10 : 0;
  const topGenres = Array.from(genreMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([g]) => g);
  const genreCounts = Array.from(genreMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6);
  return { totalWatched, totalToWatch, totalFavorites, averageRating, topGenres, genreCounts };
}
