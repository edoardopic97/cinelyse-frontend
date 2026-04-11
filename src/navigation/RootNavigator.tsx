import React, { useEffect, useRef } from 'react';
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
  const queueRef = useRef<string | null>(null);

  const handleUrl = async (url: string) => {
    const match = url.match(/\/movie\/(\w+)/);
    if (!match) return;
    const id = match[1];
    const typeParam = url.match(/[?&]type=(tv|movie)/)?.[1];
    const mediaType = typeParam === 'tv' ? 'tv' : 'movie';
    try {
      const res = await api.get(`/api/movie/details?id=${id}&type=${mediaType}`);
      const m = res.data;
      if (!m?.id && !m?.title && !m?.name) return;
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
    } catch (e) {
      console.warn('[DeepLink] Failed to load movie:', e);
    }
  };

  // Capture URLs immediately, but only process when ready
  useEffect(() => {
    Linking.getInitialURL().then(url => {
      if (url) queueRef.current = url;
    }).catch(() => {});
    const sub = Linking.addEventListener('url', ({ url }) => {
      if (ready) {
        handleUrl(url);
      } else {
        queueRef.current = url;
      }
    });
    return () => sub?.remove?.();
  }, [ready]);

  // Replay queued URL once auth is ready — retry if first attempt fails
  useEffect(() => {
    if (ready && queueRef.current) {
      const url = queueRef.current;
      queueRef.current = null;
      // Small delay to ensure auth token is available for API calls
      setTimeout(() => handleUrl(url), 500);
    }
  }, [ready]);

  return null;
}

export default function RootNavigator() {
  const { user, loading } = useAuth();
  const ready = !loading && !!user;

  if (loading) {
    return (
      <View style={s.loading}>
        <ActivityIndicator size="large" color={colors.red} />
      </View>
    );
  }

  return (
    <SharedMovieProvider>
      <NavigationContainer>
        <DeepLinkHandler ready={ready} />
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
        <SharedMovieModal />
      </NavigationContainer>
    </SharedMovieProvider>
  );
}

const s = StyleSheet.create({
  loading: { flex: 1, backgroundColor: colors.black, alignItems: 'center', justifyContent: 'center' },
});
