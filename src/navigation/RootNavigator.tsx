import React, { useEffect, useRef, useCallback } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, ActivityIndicator, StyleSheet, Linking } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { SharedMovieProvider, useSharedMovie } from '../contexts/SharedMovieContext';
import LoginScreen from '../screens/LoginScreen';
import VerifyEmailScreen from '../screens/VerifyEmailScreen';
import TabNavigator from './TabNavigator';
import SharedMovieModal from '../components/SharedMovieModal';
import { colors } from '../theme/colors';
import api from '../api/client';

const Stack = createNativeStackNavigator();

function DeepLinkHandler({ ready }: { ready: boolean }) {
  const { openSharedMovie } = useSharedMovie();
  const openRef = useRef(openSharedMovie);
  openRef.current = openSharedMovie;
  const pendingUrl = useRef<string | null>(null);
  const readyRef = useRef(ready);
  readyRef.current = ready;

  const handleUrl = useCallback(async (url: string): Promise<boolean> => {
    const match = url.match(/movie\/(\w+)/);
    if (!match) return false;
    const id = match[1];
    const mediaType = url.includes('type=tv') ? 'tv' : 'movie';
    try {
      const res = await api.get(`/api/movie/details?id=${id}&type=${mediaType}`);
      const m = res.data;
      if (!m?.id && !m?.title && !m?.name) return false;
      const isTV = mediaType === 'tv' || !!m.first_air_date;
      const directors = isTV
        ? (m.created_by || []).map((c: any) => c.name).join(', ')
        : (m.credits?.crew || []).filter((c: any) => c.job === 'Director').map((c: any) => c.name).join(', ');
      const actors = (m.credits?.cast || []).slice(0, 6).map((c: any) => c.name).join(', ');
      openRef.current({
        Title: isTV ? m.name : m.title,
        Year: ((isTV ? m.first_air_date : m.release_date) || '').slice(0, 4),
        Poster: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : '',
        Genre: (m.genres || []).map((g: any) => g.name).join(', '),
        Plot: m.overview || '',
        tmdbRating: m.vote_average ? m.vote_average.toFixed(1) : '',
        Runtime: m.runtime ? `${m.runtime} min` : undefined,
        Country: (m.production_countries || []).map((c: any) => c.name).join(', ') || undefined,
        Type: isTV ? 'series' : 'movie',
        Director: directors || undefined,
        Actors: actors || undefined,
        Language: (m.spoken_languages || []).map((l: any) => l.english_name).join(', ') || undefined,
        tmdbID: m.id,
        imdbID: m.external_ids?.imdb_id || m.imdb_id || undefined,
        Rated: m.adult ? '18+' : undefined,
      });
      return true;
    } catch (e) {
      console.warn('[DeepLink] Failed to load movie:', e);
      return false;
    }
  }, []);

  // Capture initial URL on mount — always runs regardless of ready state
  useEffect(() => {
    Linking.getInitialURL().then(url => {
      if (url && url.match(/movie\/(\w+)/)) {
        pendingUrl.current = url;
        // If already ready, process immediately
        if (readyRef.current) {
          pendingUrl.current = null;
          handleUrl(url);
        }
      }
    }).catch(() => {});
  }, [handleUrl]);

  // Listen for URLs while app is already open (warm start)
  useEffect(() => {
    const sub = Linking.addEventListener('url', ({ url }) => {
      if (readyRef.current) {
        handleUrl(url);
      } else {
        pendingUrl.current = url;
      }
    });
    return () => sub?.remove?.();
  }, [handleUrl]);

  // When ready becomes true, process any pending URL with retries
  useEffect(() => {
    if (!ready || !pendingUrl.current) return;
    const url = pendingUrl.current;
    pendingUrl.current = null;

    let attempts = 0;
    const maxAttempts = 5;
    const tryHandle = async () => {
      attempts++;
      const success = await handleUrl(url);
      if (!success && attempts < maxAttempts) {
        setTimeout(tryHandle, 1000);
      }
    };
    // Delay first attempt to ensure auth token is available
    setTimeout(tryHandle, 800);
  }, [ready, handleUrl]);

  return null;
}

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={s.loading}>
        <ActivityIndicator size="large" color={colors.red} />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {user ? (
        user.emailVerified || user.providerData?.some(p => p.providerId === 'google.com') ? (
          <Stack.Screen name="Main" component={TabNavigator} />
        ) : (
          <Stack.Screen name="VerifyEmail" component={VerifyEmailScreen} />
        )
      ) : (
        <Stack.Screen name="Login" component={LoginScreen} />
      )}
    </Stack.Navigator>
  );
}

export default function RootNavigator() {
  const { user, loading } = useAuth();
  const ready = !loading && !!user;

  return (
    <SharedMovieProvider>
      <NavigationContainer>
        <DeepLinkHandler ready={ready} />
        <AppContent />
        <SharedMovieModal />
      </NavigationContainer>
    </SharedMovieProvider>
  );
}

const s = StyleSheet.create({
  loading: { flex: 1, backgroundColor: colors.black, alignItems: 'center', justifyContent: 'center' },
});
