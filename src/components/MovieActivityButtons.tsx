import React, { useEffect, useState } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { useAuth } from '../contexts/AuthContext';
import {
  getMovieActivity, setMovieActivity, rateMovie,
  removeMovieFromWatched, removeMovieFromToWatch, removeMovieFromFavorites,
} from '../lib/firestore';

export interface MovieData {
  movieId: string;
  title: string;
  poster?: string;
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

interface Props {
  movie: MovieData;
  compact?: boolean;
}

export default function MovieActivityButtons({ movie, compact = false }: Props) {
  const { user } = useAuth();
  const [watched, setWatched] = useState(false);
  const [toWatch, setToWatch] = useState(false);
  const [favorite, setFavorite] = useState(false);
  const [rating, setRating] = useState(0);
  const [showRating, setShowRating] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setWatched(false);
    setToWatch(false);
    setFavorite(false);
    setRating(0);
    setShowRating(false);
    if (!user?.uid) return;
    getMovieActivity(user.uid, movie.movieId).then(a => {
      if (a) { setWatched(a.watched); setToWatch(a.toWatch); setFavorite(a.favorite); setRating(a.rating || 0); }
    }).catch(() => {});
  }, [user?.uid, movie.movieId]);

  const handleToggle = async (field: 'watched' | 'toWatch' | 'favorite') => {
    if (!user?.uid) { Alert.alert('Sign In', 'Please sign in to track movies'); return; }
    setLoading(true);
    try {
      const current = field === 'watched' ? watched : field === 'toWatch' ? toWatch : favorite;
      if (current) {
        // Remove
        if (field === 'watched') { await removeMovieFromWatched(user.uid, movie.movieId); setWatched(false); }
        if (field === 'toWatch') { await removeMovieFromToWatch(user.uid, movie.movieId); setToWatch(false); }
        if (field === 'favorite') { await removeMovieFromFavorites(user.uid, movie.movieId); setFavorite(false); }
      } else {
        const newState = {
          ...movie,
          watched: field === 'watched' ? true : watched,
          toWatch: field === 'toWatch' ? true : toWatch,
          favorite: field === 'favorite' ? true : favorite,
        };
        await setMovieActivity(user.uid, movie.movieId, newState);
        if (field === 'watched') setWatched(true);
        if (field === 'toWatch') setToWatch(true);
        if (field === 'favorite') setFavorite(true);
      }
    } catch { Alert.alert('Error', 'Failed to update'); }
    finally { setLoading(false); }
  };

  const handleRate = async (r: number) => {
    if (!user?.uid) return;
    setLoading(true);
    try {
      await rateMovie(user.uid, movie.movieId, r);
      setRating(r);
      setShowRating(false);
    } catch { Alert.alert('Error', 'Failed to rate'); }
    finally { setLoading(false); }
  };

  if (compact) {
    return (
      <View style={s.compactRow}>
        <TouchableOpacity style={[s.compactBtn, watched && s.compactBtnActiveRed]} onPress={() => handleToggle('watched')} disabled={loading}>
          <Ionicons name={watched ? 'eye' : 'eye-outline'} size={14} color={watched ? '#fff' : colors.muted} />
          <Text style={[s.compactLabel, watched && { color: '#fff' }]}>Watched</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.compactBtn, toWatch && s.compactBtnActiveGold]} onPress={() => handleToggle('toWatch')} disabled={loading}>
          <Ionicons name={toWatch ? 'bookmark' : 'bookmark-outline'} size={14} color={toWatch ? '#000' : colors.muted} />
          <Text style={[s.compactLabel, toWatch && { color: '#000' }]}>Watch</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.compactBtn, favorite && s.compactBtnActiveRed]} onPress={() => handleToggle('favorite')} disabled={loading}>
          <Ionicons name={favorite ? 'heart' : 'heart-outline'} size={14} color={favorite ? '#fff' : colors.muted} />
          <Text style={[s.compactLabel, favorite && { color: '#fff' }]}>Fav</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.compactBtn, rating > 0 && s.compactBtnActiveGold]} onPress={() => setShowRating(!showRating)} disabled={loading}>
          <Ionicons name="star" size={14} color={rating > 0 ? '#000' : colors.muted} />
          <Text style={[s.compactLabel, rating > 0 && { color: '#000' }]}>{rating > 0 ? `${rating}/10` : 'Rate'}</Text>
        </TouchableOpacity>
        {showRating && (
          <View style={s.ratingGrid}>
            <View style={s.ratingRow}>
              {[1, 2, 3, 4, 5].map(r => (
                <TouchableOpacity key={r} style={[s.ratingStar, rating === r && s.ratingStarActive]} onPress={() => handleRate(r)}>
                  <Text style={{ color: rating === r ? colors.gold : colors.subtle, fontSize: 12, fontWeight: '700' }}>{r}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={s.ratingRow}>
              {[6, 7, 8, 9, 10].map(r => (
                <TouchableOpacity key={r} style={[s.ratingStar, rating === r && s.ratingStarActive]} onPress={() => handleRate(r)}>
                  <Text style={{ color: rating === r ? colors.gold : colors.subtle, fontSize: 12, fontWeight: '700' }}>{r}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={s.fullCol}>
      <TouchableOpacity style={[s.fullBtn, watched && s.fullBtnActiveRed]} onPress={() => handleToggle('watched')} disabled={loading}>
        <Ionicons name={watched ? 'eye' : 'eye-outline'} size={18} color={watched ? '#fff' : colors.muted} />
        <Text style={[s.fullLabel, watched && { color: '#fff' }]}>{watched ? 'Watched ✓' : 'Mark as Watched'}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[s.fullBtn, toWatch && s.fullBtnActiveGold]} onPress={() => handleToggle('toWatch')} disabled={loading}>
        <Ionicons name={toWatch ? 'bookmark' : 'bookmark-outline'} size={18} color={toWatch ? '#000' : colors.muted} />
        <Text style={[s.fullLabel, toWatch && { color: '#000' }]}>{toWatch ? 'In Watchlist ✓' : 'Add to Watchlist'}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[s.fullBtn, favorite && s.fullBtnActiveRed]} onPress={() => handleToggle('favorite')} disabled={loading}>
        <Ionicons name={favorite ? 'heart' : 'heart-outline'} size={18} color={favorite ? '#fff' : colors.muted} />
        <Text style={[s.fullLabel, favorite && { color: '#fff' }]}>{favorite ? 'Favorited ✓' : 'Add to Favorites'}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[s.fullBtn, rating > 0 && s.fullBtnActiveGold]} onPress={() => setShowRating(!showRating)} disabled={loading}>
        <Ionicons name="star" size={18} color={rating > 0 ? '#000' : colors.muted} />
        <Text style={[s.fullLabel, rating > 0 && { color: '#000' }]}>{rating > 0 ? `Rated ${rating}/10` : 'Rate Movie'}</Text>
      </TouchableOpacity>
      {showRating && (
        <View style={s.ratingGridFull}>
          <View style={s.ratingRowFull}>
            {[1, 2, 3, 4, 5].map(r => (
              <TouchableOpacity key={r} style={[s.ratingStarFull, rating === r && s.ratingStarActive]} onPress={() => handleRate(r)}>
                <Text style={{ color: rating === r ? colors.gold : colors.subtle, fontSize: 15, fontWeight: '700' }}>{r}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={s.ratingRowFull}>
            {[6, 7, 8, 9, 10].map(r => (
              <TouchableOpacity key={r} style={[s.ratingStarFull, rating === r && s.ratingStarActive]} onPress={() => handleRate(r)}>
                <Text style={{ color: rating === r ? colors.gold : colors.subtle, fontSize: 15, fontWeight: '700' }}>{r}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  // Compact
  compactRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  compactBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 6, paddingHorizontal: 10, paddingVertical: 8,
  },
  compactBtnActiveRed: { backgroundColor: colors.red, borderColor: colors.red },
  compactBtnActiveGold: { backgroundColor: colors.gold, borderColor: colors.gold },
  compactLabel: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  ratingGrid: { width: '100%', marginTop: 4, gap: 4 },
  ratingRow: { flexDirection: 'row', gap: 4 },
  ratingStar: {
    flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 6,
  },
  ratingStarActive: { backgroundColor: 'rgba(245,197,24,0.25)', borderWidth: 1, borderColor: 'rgba(245,197,24,0.5)' },
  // Full
  fullCol: { gap: 10 },
  fullBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8, paddingVertical: 12,
  },
  fullBtnActiveRed: { backgroundColor: colors.red, borderColor: colors.red },
  fullBtnActiveGold: { backgroundColor: colors.gold, borderColor: colors.gold },
  fullLabel: { color: colors.muted, fontSize: 14, fontWeight: '600' },
  ratingGridFull: { gap: 6, padding: 10, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 8 },
  ratingRowFull: { flexDirection: 'row', gap: 6 },
  ratingStarFull: {
    flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 6,
  },
});
