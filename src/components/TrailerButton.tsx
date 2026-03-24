import React, { useEffect, useState } from 'react';
import { TouchableOpacity, Text, StyleSheet, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { fetchTrailer } from '../api/client';

interface Props {
  tmdbID: number;
  type?: string;
}

export default function TrailerButton({ tmdbID, type }: Props) {
  const [key, setKey] = useState<string | null>(null);

  useEffect(() => {
    fetchTrailer(tmdbID, type).then(setKey).catch(() => {});
  }, [tmdbID, type]);

  if (!key) return null;

  return (
    <TouchableOpacity style={s.btn} onPress={() => Linking.openURL(`https://youtube.com/watch?v=${key}`)}>
      <Ionicons name="play-circle" size={18} color={colors.red} />
      <Text style={s.text}>Watch Trailer</Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  btn: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 8,
    backgroundColor: 'rgba(229,9,20,0.12)', borderWidth: 1, borderColor: 'rgba(229,9,20,0.3)',
    borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10, marginBottom: 16,
  },
  text: { color: colors.red, fontSize: 14, fontWeight: '700' },
});
