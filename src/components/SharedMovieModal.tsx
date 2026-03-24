import React from 'react';
import {
  View, Text, Image, TouchableOpacity, StyleSheet, Modal, ScrollView,
  Linking, Share,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { getGenreColor } from '../theme/genreColors';
import { useSharedMovie } from '../contexts/SharedMovieContext';
import MovieActivityButtons from './MovieActivityButtons';

export default function SharedMovieModal() {
  const insets = useSafeAreaInsets();
  const { sharedMovie: movie, clearSharedMovie } = useSharedMovie();
  if (!movie) return null;

  const rating = parseFloat(movie.tmdbRating || '0');
  const genres = movie.Genre ? movie.Genre.split(',').map(g => g.trim()) : [];
  const hasPoster = movie.Poster && movie.Poster !== 'N/A' && movie.Poster !== '';
  const rtScore = movie.Ratings?.find(r => r.Source === 'Rotten Tomatoes')?.Value;
  const metaScore = movie.Ratings?.find(r => r.Source === 'Metacritic')?.Value;

  const handleShare = () => {
    const url = movie.tmdbID ? `https://cinelyse-api.vercel.app/movie/${movie.tmdbID}` : '';
    const lines = [`🎬 ${movie.Title}${movie.Year ? ` (${movie.Year})` : ''}`];
    if (rating > 0) lines.push(`⭐ ${rating.toFixed(1)} IMDb`);
    if (movie.Genre) lines.push(movie.Genre);
    if (url) lines.push(`\n${url}`);
    Share.share({ message: lines.join('\n') });
  };

  return (
    <Modal visible animationType="slide" onRequestClose={clearSharedMovie} statusBarTranslucent>
      <View style={[s.modal, { paddingTop: insets.top }]}>
        <ScrollView bounces={false} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>
          <View style={s.posterWrap}>
            {hasPoster ? (
              <Image source={{ uri: movie.Poster }} style={s.posterImg} />
            ) : (
              <View style={[s.noPoster, { height: 400 }]}><Ionicons name="film-outline" size={64} color="rgba(255,255,255,0.15)" /></View>
            )}
            <TouchableOpacity style={s.closeBtn} onPress={clearSharedMovie}>
              <Ionicons name="close" size={22} color={colors.white} />
            </TouchableOpacity>
          </View>

          <View style={s.info}>
            {(movie.Type === 'series' || movie.Type === 'TV Series') && (
              <View style={s.tvBadge}>
                <Ionicons name="tv-outline" size={10} color={colors.red} />
                <Text style={s.tvBadgeText}>TV SERIES</Text>
              </View>
            )}
            <View style={s.titleRow}>
              <Text style={[s.title, { flex: 1 }]}>{movie.Title}</Text>
              <TouchableOpacity style={s.shareBtn} onPress={handleShare}>
                <Ionicons name="share-outline" size={18} color={colors.white} />
              </TouchableOpacity>
            </View>

            <View style={s.metaRow}>
              {movie.Year ? <Text style={s.metaText}>{movie.Year}</Text> : null}
              {rating > 0 && (
                <View style={s.metaItem}>
                  <Ionicons name="star" size={13} color={colors.gold} />
                  <Text style={s.metaGold}>{rating.toFixed(1)} IMDb</Text>
                </View>
              )}
              {movie.Runtime && <View style={s.metaItem}><Ionicons name="time-outline" size={12} color={colors.muted} /><Text style={s.metaText}>{movie.Runtime}</Text></View>}
              {movie.Rated && <View style={s.ratedBadge}><Text style={s.ratedText}>{movie.Rated}</Text></View>}
            </View>

            {(rtScore || metaScore) && (
              <View style={s.scoresRow}>
                {rtScore && <View style={s.scoreCard}><Text style={{ fontSize: 18 }}>{parseInt(rtScore) >= 60 ? '🍅' : '🦠'}</Text><View><Text style={s.scoreValue}>{rtScore}</Text><Text style={s.scoreLabel}>Rotten Tomatoes</Text></View></View>}
                {metaScore && <View style={s.scoreCard}><Text style={{ fontSize: 18 }}>🎯</Text><View><Text style={s.scoreValue}>{metaScore}</Text><Text style={s.scoreLabel}>Metacritic</Text></View></View>}
              </View>
            )}

            {genres.length > 0 && (
              <View style={s.genreRow}>
                {genres.map((g, i) => { const c = getGenreColor(g); return <View key={i} style={[s.genrePill, { backgroundColor: c.bg, borderColor: c.border }]}><Text style={[s.genreText, { color: c.text }]}>{g}</Text></View>; })}
              </View>
            )}

            {movie.Plot && movie.Plot !== 'N/A' && <Text style={s.plot}>{movie.Plot}</Text>}

            <View style={s.detailsGrid}>
              {movie.Director && <View style={s.detailItem}><Text style={s.detailLabel}>Director</Text><Text style={s.detailValue}>{movie.Director.split(',')[0]}</Text></View>}
              {movie.Language && <View style={s.detailItem}><Text style={s.detailLabel}>Language</Text><Text style={s.detailValue}>{movie.Language.split(',')[0]}</Text></View>}
              {movie.Country && <View style={s.detailItem}><Text style={s.detailLabel}>Country</Text><Text style={s.detailValue}>{movie.Country.split(',')[0]}</Text></View>}
            </View>

            {movie.Actors && (
              <View style={s.castSection}>
                <Text style={s.detailLabel}>Cast</Text>
                <View style={s.castRow}>
                  {movie.Actors.split(',').map((a, i) => (
                    <View key={i} style={s.castPill}><Text style={s.castText}>{a.trim()}</Text></View>
                  ))}
                </View>
              </View>
            )}

            {movie.Awards && movie.Awards.toLowerCase().includes('oscar') && (
              <View style={s.awardsCard}>
                <Text style={{ fontSize: 18 }}>🏆</Text>
                <Text style={s.awardsText}>{movie.Awards}</Text>
              </View>
            )}

            <View style={s.activitySection}>
              <Text style={s.detailLabel}>Your Activity</Text>
              <MovieActivityButtons movie={{
                movieId: movie.imdbID || movie.Title,
                title: movie.Title,
                poster: hasPoster ? movie.Poster : undefined,
                genres,
                year: movie.Year,
                tmdbRating: movie.tmdbRating,
                plot: movie.Plot !== 'N/A' ? movie.Plot : undefined,
                runtime: movie.Runtime,
                director: movie.Director,
                actors: movie.Actors,
                language: movie.Language,
                country: movie.Country,
                rated: movie.Rated,
                type: movie.Type,
                awards: movie.Awards,
                ratings: movie.Ratings,
              }} />
            </View>

            {movie.tmdbID && (
              <TouchableOpacity style={s.imdbLink} onPress={() => Linking.openURL(`https://www.themoviedb.org/movie/${movie.tmdbID}`)}>
                <Ionicons name="open-outline" size={14} color={colors.gold} />
                <Text style={s.imdbText}>View on TMDB</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  modal: { flex: 1, backgroundColor: colors.dark },
  posterWrap: { width: '100%', height: 400, position: 'relative' },
  posterImg: { width: '100%', height: '100%', resizeMode: 'cover' },
  noPoster: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  closeBtn: { position: 'absolute', top: 12, right: 16, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  shareBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  info: { padding: 20, paddingBottom: 60 },
  tvBadge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(229,9,20,0.15)', borderWidth: 1, borderColor: 'rgba(229,9,20,0.3)', borderRadius: 4, paddingHorizontal: 8, paddingVertical: 2, marginBottom: 8 },
  tvBadgeText: { color: colors.red, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  title: { color: colors.white, fontSize: 24, fontWeight: '900', lineHeight: 30, marginBottom: 10 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 14 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { color: colors.muted, fontSize: 14 },
  metaGold: { color: colors.gold, fontSize: 14, fontWeight: '700' },
  ratedBadge: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', borderRadius: 3, paddingHorizontal: 6, paddingVertical: 1 },
  ratedText: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  scoresRow: { flexDirection: 'row', gap: 10, marginBottom: 14, flexWrap: 'wrap' },
  scoreCard: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  scoreValue: { color: colors.white, fontSize: 14, fontWeight: '700' },
  scoreLabel: { color: colors.subtle, fontSize: 10 },
  genreRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 },
  genrePill: { borderWidth: 1, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3 },
  genreText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  plot: { color: '#ccc', fontSize: 14, lineHeight: 22, marginBottom: 16 },
  detailsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginBottom: 16 },
  detailItem: { minWidth: 120 },
  detailLabel: { color: colors.subtle, fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  detailValue: { color: '#ccc', fontSize: 13 },
  castSection: { marginBottom: 16 },
  castRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  castPill: { backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4 },
  castText: { color: '#ccc', fontSize: 12 },
  awardsCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: 'rgba(245,197,24,0.08)', borderWidth: 1, borderColor: 'rgba(245,197,24,0.2)', borderRadius: 8, padding: 12, marginBottom: 16 },
  awardsText: { color: colors.gold, fontSize: 13, fontWeight: '600', flex: 1 },
  activitySection: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)', paddingTop: 16, marginBottom: 16 },
  imdbLink: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  imdbText: { color: colors.gold, fontSize: 13, fontWeight: '600' },
});
