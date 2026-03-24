import React, { useEffect, useState } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { colors } from '../theme/colors';
import { fetchProviders, type WatchProvider } from '../api/client';

interface Props {
  tmdbID: number;
  type?: string;
}

export default function WatchProviders({ tmdbID, type }: Props) {
  const [providers, setProviders] = useState<WatchProvider[]>([]);
  const [link, setLink] = useState('');

  useEffect(() => {
    fetchProviders(tmdbID, type)
      .then(d => { setProviders(d.providers); setLink(d.link); })
      .catch(() => {});
  }, [tmdbID, type]);

  if (!providers.length) return null;

  const stream = providers.filter(p => p.type === 'flatrate' || p.type === 'free' || p.type === 'ads');
  const other = providers.filter(p => p.type === 'rent' || p.type === 'buy');

  return (
    <View style={s.container}>
      <Text style={s.heading}>Where to Watch</Text>
      {stream.length > 0 && (
        <View style={s.row}>
          <Text style={s.label}>Stream</Text>
          <View style={s.logos}>
            {stream.map(p => (
              <TouchableOpacity key={p.id} onPress={() => link && Linking.openURL(link)}>
                <Image source={{ uri: p.logo }} style={s.logo} />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
      {other.length > 0 && (
        <View style={s.row}>
          <Text style={s.label}>Rent / Buy</Text>
          <View style={s.logos}>
            {other.map(p => (
              <TouchableOpacity key={p.id} onPress={() => link && Linking.openURL(link)}>
                <Image source={{ uri: p.logo }} style={s.logo} />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
      <Text style={s.attribution}>Powered by JustWatch</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { marginTop: 16, marginBottom: 4 },
  heading: { color: colors.white, fontSize: 15, fontWeight: '700', marginBottom: 10 },
  row: { marginBottom: 10 },
  label: { color: colors.muted, fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  logos: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  logo: { width: 40, height: 40, borderRadius: 8, backgroundColor: colors.surface },
  attribution: { color: colors.subtle, fontSize: 9, marginTop: 4 },
});
