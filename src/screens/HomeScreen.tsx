import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator, Dimensions,
  Image, TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { useAuth } from '../contexts/AuthContext';
import { getEnrichedFriends, getMovieList, type MovieActivity, type FriendSummary } from '../lib/firestore';
import { fetchTrending, fetchMovieDetails, type MovieResult } from '../api/client';
import MovieCard from '../components/MovieCard';
import t from '../i18n';

const { width: SCREEN_W } = Dimensions.get('window');
const CARD_W = (SCREEN_W - 48 - 16) / 3;

const INITIAL_SHOW = 10;

interface FriendMovie {
  movie: MovieActivity;
  friend: FriendSummary;
}

function SectionHeader({ icon, color, title }: { icon: string; color: string; title: string }) {
  return (
    <View style={s.sectionHeader}>
      <Ionicons name={icon as any} size={16} color={color} />
      <Text style={s.sectionTitle}>{title}</Text>
    </View>
  );
}

function FriendMovieCard({ item, allItems, index }: { item: FriendMovie; allItems: FriendMovie[]; index: number }) {
  const m = item.movie;
  const f = item.friend;
  const hasPoster = m.poster && m.poster !== 'N/A';
  const isEmoji = f.photoURL && !f.photoURL.startsWith('http');
  const isUrl = f.photoURL && f.photoURL.startsWith('http');
  const initial = (f.displayName || '?').charAt(0).toUpperCase();

  const movieResult: MovieResult = {
    Title: m.title,
    Year: m.year || '',
    Poster: m.poster || '',
    Genre: (m.genres || []).join(', '),
    Plot: m.plot || '',
    tmdbRating: m.tmdbRating || '',
    Runtime: m.runtime,
    Country: m.country,
    Type: m.type,
    Director: m.director,
    Actors: m.actors,
    Language: m.language,
    tmdbID: m.tmdbID,
    Rated: m.rated,
    Backdrop: m.backdrop,
    Tagline: m.tagline,
    _lightweight: true,
  };

  const allMovieResults = allItems.map(i => ({
    Title: i.movie.title,
    Year: i.movie.year || '',
    Poster: i.movie.poster || '',
    Genre: (i.movie.genres || []).join(', '),
    Plot: i.movie.plot || '',
    tmdbRating: i.movie.tmdbRating || '',
    Runtime: i.movie.runtime,
    Country: i.movie.country,
    Type: i.movie.type,
    Director: i.movie.director,
    Actors: i.movie.actors,
    Language: i.movie.language,
    tmdbID: i.movie.tmdbID,
    Rated: i.movie.rated,
    Backdrop: i.movie.backdrop,
    Tagline: i.movie.tagline,
    _lightweight: true,
  } as MovieResult));

  return (
    <View style={s.friendCardWrap}>
      <MovieCard movie={movieResult} allMovies={allMovieResults} currentIndex={index} />
      <View style={s.friendBadge}>
        <View style={s.friendAvatarMini}>
          {isUrl ? <Image source={{ uri: f.photoURL }} style={s.friendAvatarImg} />
            : isEmoji ? <Text style={{ fontSize: 8 }}>{f.photoURL}</Text>
            : <Text style={s.friendAvatarText}>{initial}</Text>}
        </View>
        <Text style={s.friendNameText} numberOfLines={1}>{f.displayName?.split(' ')[0] || '?'}</Text>
      </View>
      {m.rating && m.rating > 0 && (
        <View style={s.friendRatingBadge}>
          <Ionicons name="star" size={8} color={colors.gold} />
          <Text style={s.friendRatingText}>{m.rating}/10</Text>
        </View>
      )}
    </View>
  );
}

function HorizontalFriendRow({ items, limit, onLoadMore }: { items: FriendMovie[]; limit: number; onLoadMore: () => void }) {
  if (!items.length) return null;
  const visible = items.slice(0, limit);
  const hasMore = items.length > limit && limit < 40;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingHorizontal: 16 }}>
      {visible.map((item, i) => (
        <FriendMovieCard key={item.movie.movieId + item.friend.userId} item={item} allItems={visible} index={i} />
      ))}
      {hasMore && (
        <TouchableOpacity style={s.loadMoreCard} onPress={onLoadMore} activeOpacity={0.7}>
          <Ionicons name="chevron-forward" size={20} color={colors.red} />
          <Text style={s.loadMoreCardText}>{items.length - limit} {t.more}</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

function HorizontalMovieRow({ movies }: { movies: MovieResult[] }) {
  if (!movies.length) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingHorizontal: 16 }}>
      {movies.map((m, i) => (
        <MovieCard key={m.tmdbID || i} movie={m} allMovies={movies} currentIndex={i} />
      ))}
    </ScrollView>
  );
}

function EmptySection({ message }: { message: string }) {
  return (
    <View style={s.emptySection}>
      <Text style={s.emptySectionText}>{message}</Text>
    </View>
  );
}

function SkeletonRow() {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingHorizontal: 16 }}>
      {[0, 1, 2, 3].map(i => (
        <View key={i} style={s.skeleton} />
      ))}
    </ScrollView>
  );
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [trendingMovies, setTrendingMovies] = useState<MovieResult[]>([]);
  const [trendingTV, setTrendingTV] = useState<MovieResult[]>([]);
  const [friendMovies, setFriendMovies] = useState<FriendMovie[]>([]);
  const [friends, setFriends] = useState<FriendSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLimits, setShowLimits] = useState<Record<string, number>>({
    rated: INITIAL_SHOW, favorites: INITIAL_SHOW, watchlist: INITIAL_SHOW,
  });

  const expandLimit = (key: string) => setShowLimits(p => ({ ...p, [key]: Math.min(p[key] + INITIAL_SHOW, 40) }));

  useEffect(() => {
    if (!user?.uid) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const [enrichedFriends] = await Promise.all([
          getEnrichedFriends(user!.uid),
        ]);
        if (cancelled) return;
        setFriends(enrichedFriends);

        const [trending, ...friendLists] = await Promise.all([
          fetchTrending(),
          ...enrichedFriends.slice(0, 15).map(async (friend) => {
            const [watched, favs, wl] = await Promise.all([
              getMovieList(friend.userId, 'watched'),
              getMovieList(friend.userId, 'favorite'),
              getMovieList(friend.userId, 'toWatch'),
            ]);
            return { friend, watched, favs, wl };
          }),
        ]);

        if (cancelled) return;

        setTrendingMovies(trending.movies || []);
        setTrendingTV(trending.tv || []);

        const all: FriendMovie[] = [];
        const seen = new Map<string, FriendMovie>();

        for (const { friend, watched, favs, wl } of friendLists) {
          for (const m of watched) {
            const key = m.movieId;
            if (!seen.has(key)) {
              const item = { movie: { ...m }, friend };
              seen.set(key, item);
              all.push(item);
            }
          }
          for (const m of favs) {
            const key = m.movieId;
            if (seen.has(key)) {
              seen.get(key)!.movie.favorite = true;
            } else {
              const item = { movie: { ...m }, friend };
              seen.set(key, item);
              all.push(item);
            }
          }
          for (const m of wl) {
            const key = m.movieId;
            if (seen.has(key)) {
              seen.get(key)!.movie.toWatch = true;
            } else {
              const item = { movie: { ...m }, friend };
              seen.set(key, item);
              all.push(item);
            }
          }
        }

        setFriendMovies(all);
      } catch (e) {
        console.warn('[Home] Load error:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [user?.uid]);

  const sortByDate = (a: FriendMovie, b: FriendMovie) =>
    (b.movie.updatedAt?.toMillis?.() ?? 0) - (a.movie.updatedAt?.toMillis?.() ?? 0);

  const highestRated = useMemo(() => {
    return friendMovies
      .filter(fm => fm.movie.watched && fm.movie.rating && fm.movie.rating >= 7 && fm.movie.poster)
      .sort(sortByDate);
  }, [friendMovies]);

  const friendFavorites = useMemo(() => {
    return friendMovies
      .filter(fm => fm.movie.favorite && fm.movie.poster)
      .sort(sortByDate);
  }, [friendMovies]);

  const friendWatchlist = useMemo(() => {
    return friendMovies
      .filter(fm => fm.movie.toWatch && !fm.movie.watched && fm.movie.poster)
      .sort(sortByDate);
  }, [friendMovies]);

  const hasFriends = friends.length > 0;

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={{ paddingHorizontal: 16, marginTop: 16 }}>
          <Text style={s.pageTitle}>{t.home}</Text>
          <Text style={s.pageSubtitle}>{t.whatFriendsWatching}</Text>
        </View>

        {loading ? (
          <View style={{ gap: 24, marginTop: 16 }}>
            {[0, 1, 2, 3].map(i => (
              <View key={i}>
                <View style={s.sectionHeader}>
                  <View style={{ width: 16, height: 16, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.06)' }} />
                  <View style={{ width: 160, height: 14, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.06)' }} />
                </View>
                <SkeletonRow />
              </View>
            ))}
          </View>
        ) : (
          <View style={{ gap: 24, marginTop: 8 }}>
            {/* Highest Rated by Friends */}
            <View>
              <SectionHeader icon="star" color={colors.gold} title={t.highestRatedByFriends} />
              {highestRated.length > 0 ? (
                <HorizontalFriendRow items={highestRated} limit={showLimits.rated} onLoadMore={() => expandLimit('rated')} />
              ) : (
                <EmptySection message={hasFriends ? t.noRatedFromFriends : t.addFriendsRating} />
              )}
            </View>

            {/* Friends' Favorites */}
            <View>
              <SectionHeader icon="heart" color="#ff6b6b" title={t.friendsFavorites} />
              {friendFavorites.length > 0 ? (
                <HorizontalFriendRow items={friendFavorites} limit={showLimits.favorites} onLoadMore={() => expandLimit('favorites')} />
              ) : (
                <EmptySection message={hasFriends ? t.noFavoritesFromFriends : t.addFriendsFavorites} />
              )}
            </View>

            {/* Friends' Watchlist */}
            <View>
              <SectionHeader icon="bookmark" color={colors.gold} title={t.friendsWantToWatch} />
              {friendWatchlist.length > 0 ? (
                <HorizontalFriendRow items={friendWatchlist} limit={showLimits.watchlist} onLoadMore={() => expandLimit('watchlist')} />
              ) : (
                <EmptySection message={hasFriends ? t.noWatchlistFromFriends : t.addFriendsWatchlist} />
              )}
            </View>

            {/* Trending Movies */}
            {trendingMovies.length > 0 && (
              <View>
                <SectionHeader icon="flame" color={colors.red} title={t.trendingMovies} />
                <HorizontalMovieRow movies={trendingMovies} />
              </View>
            )}

            {/* Trending TV */}
            {trendingTV.length > 0 && (
              <View>
                <SectionHeader icon="flame" color={colors.red} title={t.trendingTV} />
                <HorizontalMovieRow movies={trendingTV} />
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.black },
  pageTitle: { fontSize: 24, fontWeight: '900', color: colors.white },
  pageSubtitle: { color: colors.subtle, fontSize: 13, marginTop: 2, marginBottom: 8 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, marginBottom: 12 },
  sectionTitle: { color: colors.white, fontSize: 15, fontWeight: '700' },
  skeleton: { width: CARD_W, aspectRatio: 2 / 3, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  emptySection: { marginHorizontal: 16, paddingVertical: 24, paddingHorizontal: 16, backgroundColor: 'rgba(255,255,255,0.02)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', borderRadius: 12, alignItems: 'center' },
  emptySectionText: { color: colors.subtle, fontSize: 13, textAlign: 'center' },
  // Friend movie card wrapper
  friendCardWrap: { position: 'relative' },
  friendBadge: {
    position: 'absolute', bottom: 4, left: 4, right: 4,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.75)', borderRadius: 6,
    paddingHorizontal: 5, paddingVertical: 3,
  },
  friendAvatarMini: {
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: 'rgba(229,9,20,0.3)',
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  friendAvatarImg: { width: '100%', height: '100%', borderRadius: 7 },
  friendAvatarText: { color: colors.white, fontSize: 7, fontWeight: '800' },
  friendNameText: { color: colors.muted, fontSize: 9, fontWeight: '600', flex: 1 },
  friendRatingBadge: {
    position: 'absolute', top: 4, left: 4,
    flexDirection: 'row', alignItems: 'center', gap: 2,
    backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 4,
    paddingHorizontal: 4, paddingVertical: 2,
  },
  friendRatingText: { color: colors.gold, fontSize: 9, fontWeight: '700' },
  loadMoreCard: {
    width: CARD_W, aspectRatio: 2 / 3, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  loadMoreCardText: { color: colors.red, fontSize: 11, fontWeight: '700' },
});
