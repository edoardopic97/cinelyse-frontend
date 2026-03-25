import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Modal, ScrollView, Linking, Share, Alert, ActivityIndicator, PanResponder } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { getGenreColor } from '../theme/genreColors';
import { useAuth } from '../contexts/AuthContext';
import { removeMovieFromWatched, removeMovieFromToWatch, removeMovieFromFavorites, setMovieActivity, type MovieActivity } from '../lib/firestore';
import { fetchMovieDetails, SHARE_BASE } from '../api/client';
import MovieActivityButtons, { type MovieData } from './MovieActivityButtons';
import SimilarMovies from './SimilarMovies';
import WatchProviders from './WatchProviders';
import TrailerButton from './TrailerButton';

interface Props {
  movie: MovieActivity | null;
  onClose: () => void;
  readOnly?: boolean;
  allMovies?: MovieActivity[];
  currentIndex?: number;
  onChangeIndex?: (index: number) => void;
}

export default function ProfileMovieModal({ movie, onClose, readOnly = false, allMovies = [], currentIndex = 0, onChangeIndex }: Props) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [removing, setRemoving] = useState(false);
  const [enriched, setEnriched] = useState<MovieActivity | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [displayIndex, setDisplayIndex] = useState(currentIndex);

  useEffect(() => { setDisplayIndex(Math.max(0, currentIndex)); }, [currentIndex]);

  const activeMovie = movie && allMovies.length > 0 ? allMovies[displayIndex] ?? movie : movie;

  const indexRef = useRef(displayIndex);
  const allRef = useRef(allMovies);
  indexRef.current = displayIndex;
  allRef.current = allMovies;

  const onChangeRef = useRef(onChangeIndex);
  onChangeRef.current = onChangeIndex;

  const goNext = () => {
    if (displayIndex < allMovies.length - 1) {
      const next = displayIndex + 1;
      setDisplayIndex(next);
      onChangeRef.current?.(next);
    }
  };
  const goPrev = () => {
    if (displayIndex > 0) {
      const prev = displayIndex - 1;
      setDisplayIndex(prev);
      onChangeRef.current?.(prev);
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > Math.abs(g.dy) && Math.abs(g.dx) > 15,
      onPanResponderRelease: (_, g) => {
        if (g.dx < -50 && indexRef.current < allRef.current.length - 1) {
          const next = indexRef.current + 1;
          setDisplayIndex(next);
          onChangeRef.current?.(next);
        } else if (g.dx > 50 && indexRef.current > 0) {
          const prev = indexRef.current - 1;
          setDisplayIndex(prev);
          onChangeRef.current?.(prev);
        }
      },
    })
  ).current;

  useEffect(() => {
    setEnriched(null);
    if (!activeMovie?.tmdbID) return;
    const needsEnrich = !activeMovie.plot && !activeMovie.director && !activeMovie.actors;
    if (!needsEnrich) return;
    setLoadingDetails(true);
    fetchMovieDetails(activeMovie.tmdbID, activeMovie.type || 'movie')
      .then(details => {
        setEnriched({
          ...activeMovie,
          plot: activeMovie.plot || details.Plot || undefined,
          director: activeMovie.director || details.Director || undefined,
          actors: activeMovie.actors || details.Actors || undefined,
          runtime: activeMovie.runtime || details.Runtime || undefined,
          language: activeMovie.language || details.Language || undefined,
          country: activeMovie.country || details.Country || undefined,
          rated: activeMovie.rated || details.Rated || undefined,
          backdrop: activeMovie.backdrop || details.Backdrop || undefined,
          tagline: activeMovie.tagline || details.Tagline || undefined,
          poster: activeMovie.poster || details.Poster || undefined,
          genres: activeMovie.genres?.length ? activeMovie.genres : (details.Genre ? details.Genre.split(',').map((g: string) => g.trim()) : []),
          tmdbRating: activeMovie.tmdbRating || details.tmdbRating || undefined,
          year: activeMovie.year || details.Year || undefined,
        });
      })
      .catch(() => {})
      .finally(() => setLoadingDetails(false));
  }, [activeMovie?.movieId]);

  if (!movie) return null;
  const m = enriched || activeMovie || movie;
  const genres = m.genres || [];
  const tmdbRating = parseFloat(m.tmdbRating || '0');

  return (
    <Modal visible={!!movie} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={[s.container, { paddingTop: insets.top }]}>
        <ScrollView bounces={false} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>
          {/* Poster */}
          <View style={s.posterWrap} {...(allMovies.length > 1 ? panResponder.panHandlers : {})}>
            {m.poster ? <Image source={{ uri: m.poster }} style={s.poster} /> : (
              <View style={s.noPoster}><Ionicons name="film-outline" size={64} color="rgba(255,255,255,0.15)" /></View>
            )}
            {allMovies.length > 1 && displayIndex > 0 && (
              <TouchableOpacity style={[s.navBtn, s.navPrev]} onPress={goPrev}>
                <Ionicons name="chevron-back" size={22} color={colors.white} />
              </TouchableOpacity>
            )}
            {allMovies.length > 1 && displayIndex < allMovies.length - 1 && (
              <TouchableOpacity style={[s.navBtn, s.navNext]} onPress={goNext}>
                <Ionicons name="chevron-forward" size={22} color={colors.white} />
              </TouchableOpacity>
            )}
            <TouchableOpacity style={s.closeBtn} onPress={onClose}><Ionicons name="close" size={22} color="#fff" /></TouchableOpacity>
            {allMovies.length > 1 && (
              <View style={s.counter}><Text style={s.counterText}>{displayIndex + 1} / {allMovies.length}</Text></View>
            )}
          </View>
          <View style={s.info}>
            {loadingDetails && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <ActivityIndicator size="small" color={colors.red} />
                <Text style={{ color: colors.muted, fontSize: 13 }}>Loading details…</Text>
              </View>
            )}
            {m.type === 'series' && <View style={s.tvBadge}><Text style={s.tvText}>TV SERIES</Text></View>}
            <View style={s.titleRow}>
              <Text style={[s.title, { flex: 1 }]}>{m.title}</Text>
              <TouchableOpacity style={s.shareBtn} onPress={() => {
                const url = m.tmdbID ? `${SHARE_BASE}/movie/${m.tmdbID}` : '';
                const lines = [`🎬 ${m.title}${m.year ? ` (${m.year})` : ''}`];
                if (tmdbRating > 0) lines.push(`⭐ ${tmdbRating.toFixed(1)} TMDB`);
                if (genres.length) lines.push(genres.join(', '));
                if (url) lines.push(`\n${url}`);
                Share.share({ message: lines.join('\n') });
              }}><Ionicons name="share-outline" size={18} color={colors.white} /></TouchableOpacity>
            </View>
            <View style={s.metaRow}>
              {m.year ? <Text style={s.meta}>{m.year}</Text> : null}
              {tmdbRating > 0 && <View style={s.metaItem}><Ionicons name="star" size={13} color={colors.gold} /><Text style={s.metaGold}>{tmdbRating.toFixed(1)} TMDB</Text></View>}
              {m.runtime ? <View style={s.metaItem}><Ionicons name="time-outline" size={12} color={colors.muted} /><Text style={s.meta}>{m.runtime}</Text></View> : null}
              {m.rated ? <View style={s.ratedBadge}><Text style={s.ratedText}>{m.rated}</Text></View> : null}
            </View>
            {genres.length > 0 && <View style={s.genreRow}>{genres.map((g, i) => { const c = getGenreColor(g); return <View key={i} style={[s.genrePill, { backgroundColor: c.bg, borderColor: c.border }]}><Text style={[s.genreText, { color: c.text }]}>{g}</Text></View>; })}</View>}
            {m.plot ? <Text style={s.plot}>{m.plot}</Text> : null}
            <View style={s.detailGrid}>
              {m.director ? <View style={s.detailItem}><Text style={s.detailLabel}>Director</Text><Text style={s.detailVal}>{m.director.split(',')[0]}</Text></View> : null}
              {m.language ? <View style={s.detailItem}><Text style={s.detailLabel}>Language</Text><Text style={s.detailVal}>{m.language.split(',')[0]}</Text></View> : null}
              {m.country ? <View style={s.detailItem}><Text style={s.detailLabel}>Country</Text><Text style={s.detailVal}>{m.country.split(',')[0]}</Text></View> : null}
            </View>
            {m.actors ? (
              <View style={{ marginBottom: 16 }}>
                <Text style={s.detailLabel}>Cast</Text>
                <View style={s.castRow}>{m.actors.split(',').map((a, i) => <View key={i} style={s.castPill}><Text style={s.castText}>{a.trim()}</Text></View>)}</View>
              </View>
            ) : null}
            {m.rating && m.rating > 0 && (
              <View style={s.yourRating}>
                <Text style={s.detailLabel}>Your Rating</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <Ionicons name="star" size={18} color={colors.gold} />
                  <Text style={{ color: colors.gold, fontSize: 18, fontWeight: '800' }}>{m.rating}/10</Text>
                </View>
              </View>
            )}
            {m.tmdbID && <TrailerButton tmdbID={m.tmdbID} type={m.type} />}
            {m.tmdbID && <WatchProviders tmdbID={m.tmdbID} type={m.type} />}

            {m.tmdbID && (
              <TouchableOpacity style={s.imdbLink} onPress={() => Linking.openURL(`https://www.themoviedb.org/${m.type === 'series' ? 'tv' : 'movie'}/${m.tmdbID}`)}>
                <Ionicons name="open-outline" size={14} color={colors.gold} /><Text style={s.imdbText}>View on TMDB</Text>
              </TouchableOpacity>
            )}

            {m.tmdbID && <SimilarMovies tmdbID={m.tmdbID} type={m.type} />}

            {/* Activity buttons — always show for logged-in user */}
            {user?.uid && (
              <View style={s.activitySection}>
                <Text style={s.detailLabel}>{readOnly ? 'Your Activity' : 'Actions'}</Text>
                <MovieActivityButtons movie={{
                  movieId: m.movieId,
                  title: m.title,
                  poster: m.poster,
                  genres: m.genres,
                  year: m.year,
                  tmdbRating: m.tmdbRating,
                  plot: m.plot,
                  runtime: m.runtime,
                  director: m.director,
                  actors: m.actors,
                  language: m.language,
                  country: m.country,
                  rated: m.rated,
                  type: m.type,
                  tmdbID: m.tmdbID,
                  backdrop: m.backdrop,
                  tagline: m.tagline,
                }} />
              </View>
            )}

            {!readOnly && user?.uid && (activeMovie.watched || activeMovie.toWatch || activeMovie.favorite) && (
              <View style={s.removeSection}>
                {activeMovie.toWatch && !activeMovie.watched && (
                  <>
                    <Text style={s.detailLabel}>Actions</Text>
                    <TouchableOpacity style={s.watchedBtn} disabled={removing} onPress={async () => {
                      setRemoving(true);
                      await setMovieActivity(user.uid, activeMovie.movieId, { ...activeMovie, watched: true, toWatch: false }).catch(() => {});
                      setRemoving(false);
                      onClose();
                    }}>
                      <Ionicons name="eye" size={16} color="#fff" />
                      <Text style={s.watchedBtnText}>Mark as Watched</Text>
                    </TouchableOpacity>
                  </>
                )}
                <Text style={[s.detailLabel, activeMovie.toWatch && !activeMovie.watched && { marginTop: 16 }]}>Remove From</Text>
                <View style={s.removeRow}>
                  {activeMovie.watched && (
                    <TouchableOpacity style={s.removeBtn} disabled={removing} onPress={() => {
                      Alert.alert('Remove', 'Remove from Watched?', [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Remove', style: 'destructive', onPress: async () => { setRemoving(true); await removeMovieFromWatched(user.uid, activeMovie.movieId).catch(() => {}); setRemoving(false); onClose(); }},
                      ]);
                    }}>
                      <Ionicons name="eye-off-outline" size={14} color={colors.red} />
                      <Text style={s.removeBtnText}>Watched</Text>
                    </TouchableOpacity>
                  )}
                  {activeMovie.toWatch && (
                    <TouchableOpacity style={s.removeBtn} disabled={removing} onPress={() => {
                      Alert.alert('Remove', 'Remove from Watchlist?', [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Remove', style: 'destructive', onPress: async () => { setRemoving(true); await removeMovieFromToWatch(user.uid, activeMovie.movieId).catch(() => {}); setRemoving(false); onClose(); }},
                      ]);
                    }}>
                      <Ionicons name="bookmark-outline" size={14} color={colors.red} />
                      <Text style={s.removeBtnText}>Watchlist</Text>
                    </TouchableOpacity>
                  )}
                  {activeMovie.favorite && (
                    <TouchableOpacity style={s.removeBtn} disabled={removing} onPress={() => {
                      Alert.alert('Remove', 'Remove from Favorites?', [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Remove', style: 'destructive', onPress: async () => { setRemoving(true); await removeMovieFromFavorites(user.uid, activeMovie.movieId).catch(() => {}); setRemoving(false); onClose(); }},
                      ]);
                    }}>
                      <Ionicons name="heart-dislike-outline" size={14} color={colors.red} />
                      <Text style={s.removeBtnText}>Favorites</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.dark },
  posterWrap: { width: '100%', height: 380, position: 'relative' },
  poster: { width: '100%', height: '100%', resizeMode: 'cover' },
  noPoster: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  closeBtn: { position: 'absolute', top: 12, right: 16, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  navBtn: { position: 'absolute', top: '45%', width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  navPrev: { left: 12 },
  navNext: { right: 12 },
  counter: { position: 'absolute', bottom: 12, right: 12, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99 },
  counterText: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  shareBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  info: { padding: 20, paddingBottom: 60 },
  tvBadge: { alignSelf: 'flex-start', backgroundColor: 'rgba(229,9,20,0.15)', borderWidth: 1, borderColor: 'rgba(229,9,20,0.3)', borderRadius: 4, paddingHorizontal: 8, paddingVertical: 2, marginBottom: 8 },
  tvText: { color: colors.red, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  title: { color: colors.white, fontSize: 24, fontWeight: '900', lineHeight: 30, marginBottom: 10 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 14 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  meta: { color: colors.muted, fontSize: 14 },
  metaGold: { color: colors.gold, fontSize: 14, fontWeight: '700' },
  ratedBadge: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', borderRadius: 3, paddingHorizontal: 6, paddingVertical: 1 },
  ratedText: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  scoresRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  scoreCard: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  scoreVal: { color: colors.white, fontSize: 14, fontWeight: '700' },
  scoreLbl: { color: colors.subtle, fontSize: 10 },
  genreRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 },
  genrePill: { backgroundColor: 'rgba(229,9,20,0.12)', borderWidth: 1, borderColor: 'rgba(229,9,20,0.3)', borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3 },
  genreText: { color: '#ff6b6b', fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  plot: { color: '#ccc', fontSize: 14, lineHeight: 22, marginBottom: 16 },
  detailGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginBottom: 16 },
  detailItem: { minWidth: 100 },
  detailLabel: { color: colors.subtle, fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  detailVal: { color: '#ccc', fontSize: 13 },
  castRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  castPill: { backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4 },
  castText: { color: '#ccc', fontSize: 12 },
  awardsCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: 'rgba(245,197,24,0.08)', borderWidth: 1, borderColor: 'rgba(245,197,24,0.2)', borderRadius: 8, padding: 12, marginBottom: 16 },
  awardsText: { color: colors.gold, fontSize: 13, fontWeight: '600', flex: 1 },
  yourRating: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)', paddingTop: 12, marginBottom: 12 },
  imdbLink: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  imdbText: { color: colors.gold, fontSize: 13, fontWeight: '600' },
  activitySection: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)', paddingTop: 16, marginTop: 16 },
  removeSection: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)', paddingTop: 16, marginTop: 16 },
  removeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  removeBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,59,48,0.1)', borderWidth: 1, borderColor: 'rgba(255,59,48,0.3)', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10 },
  removeBtnText: { color: '#ff3b30', fontSize: 13, fontWeight: '700' },
  watchedBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.red, borderRadius: 10, paddingVertical: 12, marginBottom: 4 },
  watchedBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
