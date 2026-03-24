import React, { useState, useEffect } from 'react';
import {
  View, Text, Image, TouchableOpacity, StyleSheet, Dimensions, Modal,
  ScrollView, Linking, Share, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { getGenreColor } from '../theme/genreColors';
import { fetchMovieDetails, type MovieResult } from '../api/client';
import MovieActivityButtons from './MovieActivityButtons';
import SimilarMovies from './SimilarMovies';
import WatchProviders from './WatchProviders';
import TrailerButton from './TrailerButton';

const { width: SCREEN_W } = Dimensions.get('window');
const CARD_W = (SCREEN_W - 48 - 16) / 3;

interface Props {
  movie: MovieResult;
  allMovies?: MovieResult[];
  currentIndex?: number;
}

export default function MovieCard({ movie, allMovies = [], currentIndex = 0 }: Props) {
  const insets = useSafeAreaInsets();
  const [expanded, setExpanded] = useState(false);
  const [displayIndex, setDisplayIndex] = useState(currentIndex);
  const [detailsCache, setDetailsCache] = useState<Record<number, MovieResult>>({});
  const [loadingDetails, setLoadingDetails] = useState(false);

  const rawCurrent = expanded && allMovies.length > 0 ? allMovies[displayIndex] : movie;
  const current = (rawCurrent.tmdbID && detailsCache[rawCurrent.tmdbID]) || rawCurrent;
  const isLightweight = !!current._lightweight;
  const rating = parseFloat(current.tmdbRating || '0');
  const genres = current.Genre ? current.Genre.split(',').map(g => g.trim()) : [];
  const hasPoster = current.Poster && current.Poster !== 'N/A';

  // Lazy-load details when modal is open and current is lightweight
  useEffect(() => {
    if (!expanded || !rawCurrent._lightweight || !rawCurrent.tmdbID) return;
    if (detailsCache[rawCurrent.tmdbID]) return;
    setLoadingDetails(true);
    fetchMovieDetails(rawCurrent.tmdbID, rawCurrent.Type || 'movie')
      .then(details => setDetailsCache(prev => ({ ...prev, [rawCurrent.tmdbID!]: details })))
      .catch(() => {})
      .finally(() => setLoadingDetails(false));
  }, [expanded, rawCurrent.tmdbID]);

  const goNext = () => { if (displayIndex < allMovies.length - 1) setDisplayIndex(displayIndex + 1); };
  const goPrev = () => { if (displayIndex > 0) setDisplayIndex(displayIndex - 1); };

  return (
    <>
      <TouchableOpacity style={s.card} activeOpacity={0.85} onPress={() => { setDisplayIndex(currentIndex); setExpanded(true); }}>
        {hasPoster ? (
          <Image source={{ uri: movie.Poster }} style={s.poster} />
        ) : (
          <View style={s.noPoster}><Ionicons name="film-outline" size={32} color="rgba(255,255,255,0.15)" /></View>
        )}
        {/* Year badge */}
        {movie.Year && (
          <View style={s.yearBadge}><Text style={s.yearText}>{movie.Year}</Text></View>
        )}
        {parseFloat(movie.tmdbRating || '0') > 0 && (
          <View style={s.ratingBadge}>
            <Ionicons name="star" size={10} color={colors.gold} />
            <Text style={s.ratingText}>{parseFloat(movie.tmdbRating || '0').toFixed(1)}</Text>
          </View>
        )}
      </TouchableOpacity>

      <Modal visible={expanded} animationType="slide" onRequestClose={() => setExpanded(false)} statusBarTranslucent>
        <View style={[s.modal, { paddingTop: insets.top }]}>
          <ScrollView bounces={false} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>
            {/* Poster */}
            <View style={s.modalPoster}>
              {hasPoster ? (
                <Image source={{ uri: current.Poster }} style={s.modalPosterImg} />
              ) : (
                <View style={[s.noPoster, { height: 400 }]}><Ionicons name="film-outline" size={64} color="rgba(255,255,255,0.15)" /></View>
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
              <TouchableOpacity style={s.closeBtn} onPress={() => setExpanded(false)}>
                <Ionicons name="close" size={22} color={colors.white} />
              </TouchableOpacity>
              {allMovies.length > 1 && (
                <View style={s.counter}><Text style={s.counterText}>{displayIndex + 1} / {allMovies.length}</Text></View>
              )}
            </View>

            {/* Info */}
            <View style={s.info}>
              {loadingDetails && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <ActivityIndicator size="small" color={colors.red} />
                  <Text style={{ color: colors.muted, fontSize: 13 }}>Loading details…</Text>
                </View>
              )}
              {(current.Type === 'series' || current.Type === 'TV Series') && (
                <View style={s.tvBadge}>
                  <Ionicons name="tv-outline" size={10} color={colors.red} />
                  <Text style={s.tvBadgeText}>TV SERIES</Text>
                </View>
              )}
              <View style={s.titleRow}>
                <Text style={[s.title, { flex: 1 }]}>{current.Title}</Text>
                <TouchableOpacity style={s.shareBtn} onPress={() => {
                  const r = parseFloat(current.tmdbRating || '0');
                  const url = current.tmdbID ? `https://backend-eta-ochre-46.vercel.app/movie/${current.tmdbID}${current.Type === 'series' ? '?type=tv' : ''}` : '';
                  const lines = [`🎬 ${current.Title}${current.Year ? ` (${current.Year})` : ''}`];
                  if (r > 0) lines.push(`⭐ ${r.toFixed(1)} TMDB`);
                  if (current.Genre && current.Genre !== 'N/A') lines.push(current.Genre);
                  if (url) lines.push(`\n${url}`);
                  Share.share({ message: lines.join('\n') });
                }}>
                  <Ionicons name="share-outline" size={18} color={colors.white} />
                </TouchableOpacity>
              </View>

              {/* Meta row */}
              <View style={s.metaRow}>
                {current.Year ? <Text style={s.metaText}>{current.Year}</Text> : null}
                {rating > 0 && (
                  <View style={s.metaItem}>
                    <Ionicons name="star" size={13} color={colors.gold} />
                    <Text style={s.metaGold}>{rating.toFixed(1)} TMDB</Text>
                  </View>
                )}
                {current.Runtime && current.Runtime !== 'N/A' && (
                  <View style={s.metaItem}>
                    <Ionicons name="time-outline" size={12} color={colors.muted} />
                    <Text style={s.metaText}>{current.Runtime}</Text>
                  </View>
                )}
                {current.Rated && current.Rated !== 'N/A' && (
                  <View style={s.ratedBadge}><Text style={s.ratedText}>{current.Rated}</Text></View>
                )}
              </View>


              {/* Genres */}
              {genres.length > 0 && (
                <View style={s.genreRow}>
                  {genres.map((g, i) => { const c = getGenreColor(g); return <View key={i} style={[s.genrePill, { backgroundColor: c.bg, borderColor: c.border }]}><Text style={[s.genreText, { color: c.text }]}>{g}</Text></View>; })}
                </View>
              )}

              {/* Plot */}
              {current.Plot && current.Plot !== 'N/A' && <Text style={s.plot}>{current.Plot}</Text>}

              {/* Details grid */}
              <View style={s.detailsGrid}>
                {current.Director && current.Director !== 'N/A' && (
                  <View style={s.detailItem}>
                    <Text style={s.detailLabel}>Director</Text>
                    <Text style={s.detailValue}>{current.Director.split(',')[0]}</Text>
                  </View>
                )}
                {current.Language && current.Language !== 'N/A' && (
                  <View style={s.detailItem}>
                    <Text style={s.detailLabel}>Language</Text>
                    <Text style={s.detailValue}>{current.Language.split(',')[0]}</Text>
                  </View>
                )}
                {current.Country && current.Country !== 'N/A' && (
                  <View style={s.detailItem}>
                    <Text style={s.detailLabel}>Country</Text>
                    <Text style={s.detailValue}>{current.Country.split(',')[0]}</Text>
                  </View>
                )}
                {(current.Type === 'series' || current.Type === 'TV Series') && current.Seasons && (
                  <View style={s.detailItem}>
                    <Text style={s.detailLabel}>Seasons</Text>
                    <Text style={s.detailValue}>{current.Seasons} seasons{current.Episodes ? ` • ${current.Episodes} episodes` : ''}</Text>
                  </View>
                )}
              </View>

              {/* Cast */}
              {current.Actors && current.Actors !== 'N/A' && (
                <View style={s.castSection}>
                  <Text style={s.detailLabel}>Cast</Text>
                  <View style={s.castRow}>
                    {current.Actors.split(',').map((a, i) => (
                      <View key={i} style={s.castPill}><Text style={s.castText}>{a.trim()}</Text></View>
                    ))}
                  </View>
                </View>
              )}


              {current.tmdbID && <TrailerButton tmdbID={current.tmdbID} type={current.Type} />}
              {current.tmdbID && <WatchProviders tmdbID={current.tmdbID} type={current.Type} />}

              {/* Activity buttons */}
              <View style={s.activitySection}>
                <Text style={s.detailLabel}>Your Activity</Text>
                <MovieActivityButtons movie={{
                  movieId: current.tmdbID?.toString() || current.imdbID || current.Title,
                  title: current.Title,
                  poster: hasPoster ? current.Poster : undefined,
                  genres,
                  year: current.Year,
                  tmdbRating: current.tmdbRating,
                  plot: current.Plot !== 'N/A' ? current.Plot : undefined,
                  runtime: current.Runtime !== 'N/A' ? current.Runtime : undefined,
                  director: current.Director !== 'N/A' ? current.Director : undefined,
                  actors: current.Actors !== 'N/A' ? current.Actors : undefined,
                  language: current.Language !== 'N/A' ? current.Language : undefined,
                  country: current.Country !== 'N/A' ? current.Country : undefined,
                  rated: current.Rated !== 'N/A' ? current.Rated : undefined,
                  type: current.Type,
                  tmdbID: current.tmdbID,
                  backdrop: current.Backdrop,
                  tagline: current.Tagline,
                }} />
              </View>

              {current.tmdbID && (
                <TouchableOpacity style={s.imdbLink} onPress={() => Linking.openURL(`https://www.themoviedb.org/${current.Type === 'series' ? 'tv' : 'movie'}/${current.tmdbID}`)}>
                  <Ionicons name="open-outline" size={14} color={colors.gold} />
                  <Text style={s.imdbText}>View on TMDB</Text>
                </TouchableOpacity>
              )}

              {current.tmdbID && <SimilarMovies tmdbID={current.tmdbID} type={current.Type} />}
            </View>
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  card: { width: CARD_W, aspectRatio: 2 / 3, borderRadius: 10, overflow: 'hidden', backgroundColor: colors.card },
  poster: { width: '100%', height: '100%' },
  noPoster: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  yearBadge: {
    position: 'absolute', top: 6, left: 6,
    backgroundColor: 'rgba(0,0,0,0.72)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  yearText: { color: '#ccc', fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
  ratingBadge: {
    position: 'absolute', top: 6, right: 6, flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(245,197,24,0.15)', borderWidth: 1, borderColor: 'rgba(245,197,24,0.35)',
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 99,
  },
  ratingText: { color: colors.gold, fontSize: 11, fontWeight: '700' },
  modal: { flex: 1, backgroundColor: colors.dark },
  modalPoster: { width: '100%', height: 400, position: 'relative' },
  modalPosterImg: { width: '100%', height: '100%', resizeMode: 'cover' },
  closeBtn: {
    position: 'absolute', top: 12, right: 16, width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center',
  },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  shareBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center', marginTop: 2,
  },
  navBtn: {
    position: 'absolute', top: '45%', width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  navPrev: { left: 12 },
  navNext: { right: 12 },
  counter: {
    position: 'absolute', bottom: 12, right: 12, backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99,
  },
  counterText: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  info: { padding: 20, paddingBottom: 60 },
  tvBadge: {
    alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(229,9,20,0.15)', borderWidth: 1,
    borderColor: 'rgba(229,9,20,0.3)', borderRadius: 4, paddingHorizontal: 8, paddingVertical: 2, marginBottom: 8,
  },
  tvBadgeText: { color: colors.red, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  title: { color: colors.white, fontSize: 24, fontWeight: '900', lineHeight: 30, marginBottom: 10 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 14 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { color: colors.muted, fontSize: 14 },
  metaGold: { color: colors.gold, fontSize: 14, fontWeight: '700' },
  ratedBadge: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', borderRadius: 3, paddingHorizontal: 6, paddingVertical: 1 },
  ratedText: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  // Scores
  scoresRow: { flexDirection: 'row', gap: 10, marginBottom: 14, flexWrap: 'wrap' },
  scoreCard: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8,
  },
  scoreValue: { color: colors.white, fontSize: 14, fontWeight: '700' },
  scoreLabel: { color: colors.subtle, fontSize: 10 },
  // Genres
  genreRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 },
  genrePill: {
    borderWidth: 1,
    borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3,
  },
  genreText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  plot: { color: '#ccc', fontSize: 14, lineHeight: 22, marginBottom: 16 },
  detailsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginBottom: 16 },
  detailItem: { minWidth: 120 },
  detailLabel: { color: colors.subtle, fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  detailValue: { color: '#ccc', fontSize: 13 },
  castSection: { marginBottom: 16 },
  castRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  castPill: {
    backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4,
  },
  castText: { color: '#ccc', fontSize: 12 },
  // Awards
  awardsCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: 'rgba(245,197,24,0.08)', borderWidth: 1, borderColor: 'rgba(245,197,24,0.2)',
    borderRadius: 8, padding: 12, marginBottom: 16,
  },
  awardsText: { color: colors.gold, fontSize: 13, fontWeight: '600', flex: 1 },
  activitySection: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)', paddingTop: 16, marginBottom: 16 },
  imdbLink: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  imdbText: { color: colors.gold, fontSize: 13, fontWeight: '600' },
});
