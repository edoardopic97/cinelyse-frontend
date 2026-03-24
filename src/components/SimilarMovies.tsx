import React, { useEffect, useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { fetchSimilar, type MovieResult } from '../api/client';
import { useSharedMovie } from '../contexts/SharedMovieContext';

interface Props {
  tmdbID: number;
  type?: string;
}

export default function SimilarMovies({ tmdbID, type }: Props) {
  const [movies, setMovies] = useState<MovieResult[]>([]);
  const [loading, setLoading] = useState(true);
  const { openSharedMovie } = useSharedMovie();

  useEffect(() => {
    setLoading(true);
    setMovies([]);
    fetchSimilar(tmdbID, type)
      .then(setMovies)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [tmdbID, type]);

  if (loading) return <ActivityIndicator color={colors.red} style={{ marginTop: 16 }} />;
  if (!movies.length) return null;

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Ionicons name="sparkles" size={14} color={colors.red} />
        <Text style={s.title}>You Might Also Like</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.scroll}>
        {movies.map((m, i) => (
          <TouchableOpacity key={m.tmdbID || i} style={s.card} activeOpacity={0.8} onPress={() => openSharedMovie(m)}>
            {m.Poster ? (
              <Image source={{ uri: m.Poster }} style={s.poster} />
            ) : (
              <View style={[s.poster, s.noPoster]}><Ionicons name="film-outline" size={20} color="rgba(255,255,255,0.15)" /></View>
            )}
            <Text style={s.name} numberOfLines={2}>{m.Title}</Text>
            {parseFloat(m.tmdbRating || '0') > 0 && (
              <View style={s.rating}>
                <Ionicons name="star" size={9} color={colors.gold} />
                <Text style={s.ratingText}>{parseFloat(m.tmdbRating!).toFixed(1)}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const CARD_W = 100;

const s = StyleSheet.create({
  container: { marginTop: 20, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)', paddingTop: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  title: { color: colors.white, fontSize: 15, fontWeight: '700' },
  scroll: { gap: 10 },
  card: { width: CARD_W },
  poster: { width: CARD_W, height: CARD_W * 1.5, borderRadius: 8, backgroundColor: colors.surface },
  noPoster: { alignItems: 'center', justifyContent: 'center' },
  name: { color: colors.text, fontSize: 11, fontWeight: '600', marginTop: 6, lineHeight: 14 },
  rating: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3 },
  ratingText: { color: colors.gold, fontSize: 10, fontWeight: '700' },
});
