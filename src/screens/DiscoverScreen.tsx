import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList,
  ActivityIndicator, Dimensions, ScrollView, Modal, Keyboard, Pressable, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../theme/colors';
import { searchMovies, fetchTrending, fetchRecommended, fetchAvailableProviders, type MovieResult, type StreamingProvider } from '../api/client';
import { getFriendlyError } from '../utils/errorMessages';
import { useAuth } from '../contexts/AuthContext';
import { useCredits } from '../hooks/useCredits';
import { useRewardedAd } from '../hooks/useRewardedAd';
import { useSubscription } from '../hooks/useSubscription';
import { subscribeToSearchCount, acceptFriendRequest, rejectFriendRequest, deleteNotification, subscribeToAllMovies, type MovieActivity } from '../lib/firestore';
import ProfileRing, { getTier } from '../components/ProfileRing';
import PremiumModal from '../components/PremiumModal';
import LevelUpModal from '../components/LevelUpModal';

import MovieCard from '../components/MovieCard';

const { width: SCREEN_W } = Dimensions.get('window');

// ─── Ghost card data for the blurred preview ──────────────────────────────────
const GHOST_CARDS = [
  { rating: '9.1', genre: 'Thriller',  match: '97%', icon: '🎬' },
  { rating: '8.7', genre: 'Drama',     match: '95%', icon: '📺' },
  { rating: '8.4', genre: 'Crime',     match: '91%', icon: '🎥' },
  { rating: '7.9', genre: 'Sci-Fi',    match: '88%', icon: '🎞' },
  { rating: '8.2', genre: 'Action',    match: '86%', icon: '🍿' },
  { rating: '8.5', genre: 'Horror',    match: '83%', icon: '🎬' },
];

const RATINGS = ['Any', '7+', '8+', '9+'];

function TrendingSkeleton() {
  return (
    <View style={{ gap: 20 }}>
      {[0, 1].map(section => (
        <View key={section}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <View style={{ width: 16, height: 16, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.06)' }} />
            <View style={{ width: 160, height: 14, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.06)' }} />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingHorizontal: 0 }}>
            {[0, 1, 2, 3].map(i => (
              <View key={i} style={{ width: (SCREEN_W - 44 - 14) / 3, aspectRatio: 2 / 3, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' }} />
            ))}
          </ScrollView>
        </View>
      ))}
    </View>
  );
}

type Category = 'all' | 'movie' | 'tv';

function getResetTime(): string {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const diff = midnight.getTime() - now.getTime();
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

// ─── Ghost movie card (blurred behind the overlay) ────────────────────────────
function GhostCard({ rating, genre, match }: { rating: string; genre: string; match: string }) {
  return (
    <View style={g.card}>
      {/* skeleton poster body */}
      <View style={g.cardBody} />
      {/* match badge top-left */}
      <View style={g.matchBadge}>
        <Text style={g.matchText}>{match}</Text>
      </View>
      {/* rating badge top-right */}
      <View style={g.ratingBadge}>
        <Text style={g.ratingText}>★ {rating}</Text>
      </View>
      {/* genre tag bottom-left */}
      <View style={g.genreTag}>
        <Text style={g.genreText}>{genre}</Text>
      </View>
      {/* skeleton title lines */}
      <View style={g.titleLine} />
      <View style={[g.titleLine, { width: '60%', marginTop: 4 }]} />
    </View>
  );
}

// ─── Premium locked section ───────────────────────────────────────────────────
function PremiumPicksSection({ onUnlock }: { onUnlock?: () => void }) {
  const CARD_W = (SCREEN_W - 44 - 14) / 3; // 3 cols, 22px side padding each, 7px gaps

  return (
    <View style={p.wrapper}>
      {/* blurred ghost grid + overlay in one container */}
      <View style={p.gridContainer}>
        {/* ghost cards — visually blurred via opacity + overlay */}
        <View style={p.ghostGrid}>
          {GHOST_CARDS.map((card, i) => (
            <View key={i} style={{ width: CARD_W }}>
              <GhostCard rating={card.rating} genre={card.genre} match={card.match} />
            </View>
          ))}
        </View>

        {/* premium lock overlay */}
        <View style={p.overlay}>
          {/* lock icon */}
          <View style={p.lockCircle}>
            <Ionicons name="lock-closed" size={22} color={colors.red} />
          </View>

          {/* copy */}
          <Text style={p.overlayTitle}>Recommendations{'\n'}Built Around You</Text>
          <Text style={p.overlaySub}>
            Based on what you watch and love. The more you explore, the sharper your picks get.
          </Text>

          {/* CTA */}
          <TouchableOpacity style={p.unlockBtn} onPress={onUnlock} activeOpacity={0.85}>
            <LinearGradient colors={['#c0392b', '#e74c3c']} style={p.unlockGradient}>
              <Text style={p.unlockStar}>✦</Text>
              <Text style={p.unlockText}>Unlock with Premium</Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* perks */}
          <View style={p.perks}>
            {[
              'Powered by your favorites & history',
              'Gets smarter the more you use it',
              'Discover hidden gems matched to you',
            ].map((perk, i) => (
              <View key={i} style={p.perkRow}>
                <View style={p.perkDot} />
                <Text style={p.perkText}>{perk}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}

export default function DiscoverScreen() {
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuth();
  const { credits, maxCredits, isPremium, adCreditUsed, refresh, consume, refund, grantAdCredit, setPremium } = useCredits(user?.uid);
  const { loaded: adLoaded, showAd } = useRewardedAd();
  const { buy, restore, loading: purchaseLoading } = useSubscription(setPremium);
  const [showPremium, setShowPremium] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MovieResult[]>([]);
  const [allResults, setAllResults] = useState<MovieResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [category, setCategory] = useState<Category>('all');
  const [error, setError] = useState<string | null>(null);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showRatingDrop, setShowRatingDrop] = useState(false);
  const [minRating, setMinRating] = useState('Any');
  const [showNotifs, setShowNotifs] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const deletedNotifIds = useRef(new Set<string>());
  const inputRef = useRef<TextInput>(null);
  const [searchCount, setSearchCount] = useState(0);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [levelUpTier, setLevelUpTier] = useState<import('../components/ProfileRing').Tier>('spectator');
  const prevTierRef = useRef<import('../components/ProfileRing').Tier | null>(null);
  const initializedRef = useRef(false);
  const [celebratedTiers, setCelebratedTiers] = useState<Set<string>>(new Set());

  // Load celebrated tiers from storage on mount
  useEffect(() => {
    if (!user?.uid) return;
    AsyncStorage.getItem(`celebratedTiers_${user.uid}`).then(val => {
      if (val) setCelebratedTiers(new Set(JSON.parse(val)));
    }).catch(() => {});
  }, [user?.uid]);
  const [lastQuery, setLastQuery] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);
  const [aiMode, setAiMode] = useState(true);
  const [trendingMovies, setTrendingMovies] = useState<MovieResult[]>([]);
  const [trendingTV, setTrendingTV] = useState<MovieResult[]>([]);
  const [trendingLoading, setTrendingLoading] = useState(false);
  const [favorites, setFavorites] = useState<MovieActivity[]>([]);
  const [recMovies, setRecMovies] = useState<MovieResult[]>([]);
  const [recTV, setRecTV] = useState<MovieResult[]>([]);
  const [recLoading, setRecLoading] = useState(false);

  const [watched, setWatched] = useState<MovieActivity[]>([]);
  const [userProviders, setUserProviders] = useState<number[]>([]);
  const [providerList, setProviderList] = useState<StreamingProvider[]>([]);
  const [selectedProviderIds, setSelectedProviderIds] = useState<number[]>([]);
  const [showProviderDrop, setShowProviderDrop] = useState(false);

  useEffect(() => {
    if (!user?.uid) return;
    import('../lib/firestore').then(({ getUserProfile }) => {
      getUserProfile(user.uid).then(p => {
        if (p?.streamingServices?.length) {
          setUserProviders(p.streamingServices);
          fetchAvailableProviders().then(all => {
            setProviderList(all.filter(pr => p.streamingServices!.includes(pr.id)));
          }).catch(() => {});
        }
      }).catch(() => {});
    });
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;
    return subscribeToAllMovies(user.uid, {
      watched: setWatched,
      toWatch: () => {},
      favorite: setFavorites,
    });
  }, [user?.uid]);

  useEffect(() => {
    if (!isPremium) return;
    if (!favorites.length) { setRecMovies([]); setRecTV([]); return; }
    const favs = favorites.filter(f => f.tmdbID).map(f => ({ tmdbID: f.tmdbID!, type: f.type || 'movie' }));
    if (!favs.length) return;
    const excludeIds = watched.filter(w => w.tmdbID).map(w => w.tmdbID!);
    setRecLoading(true);
    fetchRecommended(favs, excludeIds)
      .then(({ movies, tv }) => { setRecMovies(movies); setRecTV(tv); })
      .catch(() => {})
      .finally(() => setRecLoading(false));
  }, [favorites, isPremium, watched]);

  useEffect(() => {
    if (!user?.uid) return;
    setTrendingLoading(true);
    fetchTrending()
      .then(({ movies, tv }) => { setTrendingMovies(movies); setTrendingTV(tv); })
      .catch(() => {})
      .finally(() => setTrendingLoading(false));
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;
    return subscribeToSearchCount(user.uid, (c) => {
      const newTier = getTier(c);
      if (!initializedRef.current) {
        initializedRef.current = true;
        prevTierRef.current = newTier;
        setSearchCount(c);
        return;
      }
      if (prevTierRef.current && newTier !== prevTierRef.current && !celebratedTiers.has(newTier) && newTier !== 'spectator') {
        setLevelUpTier(newTier);
        setShowLevelUp(true);
        const updated = new Set(celebratedTiers);
        updated.add(newTier);
        setCelebratedTiers(updated);
        AsyncStorage.setItem(`celebratedTiers_${user!.uid}`, JSON.stringify([...updated])).catch(() => {});
      }
      prevTierRef.current = newTier;
      setSearchCount(c);
    });
  }, [user?.uid]);

  const [acceptingNotif, setAcceptingNotif] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.uid) return;
    let unsub: (() => void) | undefined;
    import('../lib/firestore').then(({ subscribeToNotifications }) => {
      unsub = subscribeToNotifications(user.uid, (notifs) => {
        setNotifications(notifs.filter(n => !deletedNotifIds.current.has(n.id)));
      });
    });
    return () => { unsub?.(); };
  }, [user?.uid]);

  const openNotifs = async () => {
    setShowNotifs(true);
    if (!user?.uid || notifications.every(n => n.read)) return;
    import('../lib/firestore').then(({ markNotificationsRead }) => {
      markNotificationsRead(user.uid).catch(() => {});
    });
  };

  useEffect(() => {
    if (!user?.uid) return;
    AsyncStorage.getItem(`searchHistory_${user.uid}`).then(saved => {
      if (saved) setSearchHistory(JSON.parse(saved));
    }).catch(() => {});
  }, [user?.uid]);

  const addToHistory = useCallback(async (q: string) => {
    if (!user?.uid) return;
    const updated = [q, ...searchHistory.filter(h => h !== q)].slice(0, 10);
    setSearchHistory(updated);
    await AsyncStorage.setItem(`searchHistory_${user.uid}`, JSON.stringify(updated)).catch(() => {});
  }, [user?.uid, searchHistory]);

  const handleSearch = async (q?: string) => {
    const searchQuery = (q || query).trim();
    if (!searchQuery) return;

    if (aiMode && !consume()) {
      if (adLoaded && !adCreditUsed) {
        showAd(() => { grantAdCredit().then(() => handleSearch(searchQuery)); });
      } else if (!isPremium) {
        setShowPremium(true);
      } else {
        setError(`All ${maxCredits} AI credits used today. Resets in ${getResetTime()}`);
      }
      return;
    }

    setError(null);
    setLoading(true);
    setHasSearched(true);
    setQuery('');
    setShowHistory(false);
    setLastQuery(searchQuery);
    addToHistory(searchQuery);

    if (!aiMode) {
      try {
        const res = await searchMovies(searchQuery, category, user?.uid, undefined, false);
        const movies = res.movies || [];
        setAllResults(movies);
        setResults(movies);
      } catch (err: any) {
        setError(getFriendlyError(err, 'Search failed. Please try again.'));
        setAllResults([]);
        setResults([]);
      } finally {
        setLoading(false);
      }
      return;
    }

    let llmQuery = searchQuery;
    if (category === 'movie') llmQuery += ', only movies (no TV series)';
    else if (category === 'tv') llmQuery += ', only TV series (no movies)';
    if (minRating !== 'Any') llmQuery += `, minimum TMDB rating ${minRating}`;
    const providerNames = selectedProviderIds.map(id => providerList.find(p => p.id === id)?.name).filter(Boolean);
    if (providerNames.length) llmQuery += `, only available on: ${providerNames.join(', ')}`;

    try {
      const res = await searchMovies(llmQuery, category, user?.uid, undefined, aiMode);
      const movies = res.movies || [];
      setAllResults(movies);
      setResults(movies);
    } catch (err: any) {
      if (aiMode) refund();
      setError(err?.response?.status === 429
        ? `No AI credits left. Resets in ${getResetTime()}`
        : getFriendlyError(err, 'Search failed. Please try again.'));
      setAllResults([]);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadMore = async () => {
    if (!lastQuery || loadingMore) return;
    if (aiMode && !consume()) {
      if (adLoaded && !adCreditUsed) {
        showAd(() => { grantAdCredit().then(() => handleLoadMore()); });
      } else if (!isPremium) {
        setShowPremium(true);
      } else {
        setError(`All ${maxCredits} AI credits used today. Resets in ${getResetTime()}`);
      }
      return;
    }
    setLoadingMore(true);
    setError(null);
    let llmQuery = lastQuery;
    if (category === 'movie') llmQuery += ', only movies (no TV series)';
    else if (category === 'tv') llmQuery += ', only TV series (no movies)';
    if (minRating !== 'Any') llmQuery += `, minimum TMDB rating ${minRating}`;
    const providerNames2 = selectedProviderIds.map(id => providerList.find(p => p.id === id)?.name).filter(Boolean);
    if (providerNames2.length) llmQuery += `, only available on: ${providerNames2.join(', ')}`;
    const exclude = allResults.map(m => m.Title);
    try {
      const res = await searchMovies(llmQuery, category, user?.uid, exclude, aiMode);
      const movies = res.movies || [];
      const merged = [...allResults, ...movies];
      setAllResults(merged);
      setResults(merged);
    } catch (err: any) {
      if (aiMode) refund();
      setError(getFriendlyError(err, 'Failed to load more. Please try again.'));
    } finally {
      setLoadingMore(false);
    }
  };

  const filteredResults = React.useMemo(() => {
    if (!hasSearched) return results;
    let filtered = allResults;
    if (category === 'movie') filtered = filtered.filter(m => (m.Type || '').toLowerCase() === 'movie');
    else if (category === 'tv') filtered = filtered.filter(m => ['series', 'tv series'].includes((m.Type || '').toLowerCase()));
    if (minRating !== 'Any') {
      const min = parseFloat(minRating);
      filtered = filtered.filter(m => parseFloat(m.tmdbRating || '0') >= min);
    }
    return filtered;
  }, [allResults, category, minRating, hasSearched]);

  const displayName = profile?.displayName || user?.email?.split('@')[0] || 'User';

  const FilterPill = ({ label, value }: { label: string; value: Category }) => (
    <TouchableOpacity style={[s.pill, category === value && s.pillActive]} onPress={() => setCategory(value)}>
      <Text style={[s.pillText, category === value && s.pillTextActive]}>{label}</Text>
    </TouchableOpacity>
  );


  const RatingDropdown = () => (
    <View style={{ position: 'relative', zIndex: 99 }}>
      <TouchableOpacity style={[s.ratingPill, minRating !== 'Any' && s.ratingPillActive]} onPress={() => { setShowRatingDrop(!showRatingDrop); setShowProviderDrop(false); }}>
        <Text style={[s.pillText, minRating !== 'Any' && { color: colors.gold }]}>{minRating === 'Any' ? '★ Rating' : `★ ${minRating}`}</Text>
        <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>▾</Text>
      </TouchableOpacity>
      {showRatingDrop && (
        <View style={s.dropdown}>
          {RATINGS.map(r => (
            <TouchableOpacity key={r} style={[s.dropItem, minRating === r && s.dropItemActive]} onPress={() => { setMinRating(r); setShowRatingDrop(false); }}>
              <Text style={[s.dropItemText, minRating === r && { color: colors.gold }]}>{r === 'Any' ? 'Any rating' : `★ ${r}`}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );

  // Clear provider selection when premium is deactivated
  useEffect(() => {
    if (!isPremium) { setSelectedProviderIds([]); setShowProviderDrop(false); }
  }, [isPremium]);

  const ProviderDropdown = () => {
    if (!providerList.length || !aiMode) return null;
    const hasSelection = isPremium && selectedProviderIds.length > 0;
    return (
      <View style={{ position: 'relative', zIndex: 98 }}>
        <TouchableOpacity style={[s.ratingPill, { marginLeft: 0 }, hasSelection && { borderColor: 'rgba(229,9,20,0.4)' }]} onPress={() => {
          if (!isPremium) { setShowPremium(true); return; }
          setShowProviderDrop(!showProviderDrop); setShowRatingDrop(false);
        }}>
          <Ionicons name="tv-outline" size={12} color={hasSelection ? colors.red : 'rgba(255,255,255,0.5)'} />
          <Text style={[s.pillText, hasSelection && { color: colors.red }]}>{hasSelection ? `${selectedProviderIds.length} selected` : 'Streamers'}</Text>
          <Text style={{ fontSize: 7, marginTop: -8, marginRight: -4 }}>👑</Text>
        </TouchableOpacity>
        {showProviderDrop && (
          <View style={[s.dropdown, { minWidth: 200 }]}> 
            <TouchableOpacity style={[s.dropItem, !hasSelection && s.dropItemActive]} onPress={() => { setSelectedProviderIds([]); }}>
              <Text style={[s.dropItemText, !hasSelection && { color: colors.red }]}>Any provider</Text>
              {!hasSelection && <Ionicons name="checkmark" size={14} color={colors.red} style={{ marginLeft: 'auto' }} />}
            </TouchableOpacity>
            {providerList.map(p => {
              const sel = selectedProviderIds.includes(p.id);
              return (
                <TouchableOpacity key={p.id} style={[s.dropItem, sel && s.dropItemActive]} onPress={() => {
                  setSelectedProviderIds(prev => sel ? prev.filter(x => x !== p.id) : [...prev, p.id]);
                }}>
                  <Image source={{ uri: p.logo }} style={{ width: 20, height: 20, borderRadius: 4 }} />
                  <Text style={[s.dropItemText, sel && { color: colors.red }]}>{p.name}</Text>
                  {sel && <Ionicons name="checkmark" size={14} color={colors.red} style={{ marginLeft: 'auto' }} />}
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity style={{ alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)', marginTop: 4 }} onPress={() => setShowProviderDrop(false)}>
              <Text style={{ color: colors.red, fontSize: 13, fontWeight: '700' }}>Done</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  // ─── PRE-SEARCH HOME SCREEN ────────────────────────────────────────────────
  if (!hasSearched) {
    return (
      <Pressable style={s.container} onPress={() => { setShowHistory(false); Keyboard.dismiss(); }}>
        <LinearGradient
          colors={['rgba(180,20,20,0.35)', 'transparent']}
          style={s.topGlow}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
        />
        <LinearGradient
          colors={['rgba(200,30,30,0.12)', 'transparent']}
          style={s.sideGlow}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0.5 }}
        />

        {/* Top bar */}
        <View style={[s.topBarWrap, { paddingTop: insets.top + 8 }]}>
          <View style={s.topBarRow}>
            <View style={s.topBarLeft}>
              <ProfileRing tier={getTier(searchCount)} size="small">
                <LinearGradient colors={['#c0392b', '#7b1111']} style={s.topAvatarInner}>
                  <Text style={s.topAvatarText}>{displayName.charAt(0).toUpperCase()}</Text>
                </LinearGradient>
              </ProfileRing>
              <View>
                <Text style={s.topWelcome}>WELCOME BACK</Text>
                <Text style={s.topName} numberOfLines={1}>{displayName}</Text>
              </View>
            </View>
            <View style={s.topBarRight}>
              {aiMode && (
                <>
                  <View style={s.aiPill}>
                    <Text style={s.aiStar}>✦</Text>
                    <Text style={s.topChipTextRed}>AI</Text>
                  </View>
                  <TouchableOpacity style={[s.streakPill, credits <= 1 && credits !== Infinity && s.streakPillLow]} onPress={() => setShowPremium(true)}>
                    <Ionicons name="flash" size={12} color={credits <= 1 && credits !== Infinity ? colors.red : credits > 0 ? colors.gold : colors.subtle} />
                    <Text style={[s.topChipTextGold, credits <= 1 && credits !== Infinity && { color: colors.red }, credits === 0 && { color: colors.subtle }]}>
                      {credits === Infinity ? '∞' : credits}/{maxCredits === Infinity ? '∞' : maxCredits}
                    </Text>
                  </TouchableOpacity>
                </>
              )}
              <TouchableOpacity style={s.bellBtn} onPress={openNotifs}>
                <Text style={{ fontSize: 15 }}>🔔</Text>
                {notifications.filter(n => !n.read).length > 0 && <View style={s.topBellDot} />}
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Fixed content */}
        <View style={s.fixedContent}>
          {/* Hero */}
          <View style={s.heroSection}>
            <Text style={s.heroLabel}>🎬 Discover</Text>
            <Text style={s.heroTitle}>Find Your Next</Text>
            <Text style={s.heroAccent}>Favorite Show</Text>
            <Text style={s.heroSub}>
              {aiMode
                ? 'Describe any mood, genre, or vibe — our AI finds the perfect match for you.'
                : "Search by movie or TV show title to find what you're looking for."}
            </Text>
          </View>

          {/* AI Toggle */}
          <TouchableOpacity style={s.aiToggle} onPress={() => setAiMode(!aiMode)} activeOpacity={0.7}>
            <View style={[s.aiToggleTrack, aiMode && s.aiToggleTrackActive]}>
              <View style={[s.aiToggleThumb, aiMode && s.aiToggleThumbActive]} />
            </View>
            <Text style={[s.aiToggleLabel, aiMode && s.aiToggleLabelActive]}>{aiMode ? 'AI Search' : 'Title Search'}</Text>
          </TouchableOpacity>

          {/* Search */}
          <View style={s.searchRow}>
            <View style={s.inputWrap}>
              <Text style={s.searchIconEmoji}>🔍</Text>
              <TextInput
                ref={inputRef}
                style={s.input}
                placeholder={aiMode ? 'Try "dark thriller" or "90s"' : 'Try "The Godfather" or "Seven"'}
                placeholderTextColor={'rgba(255,255,255,0.35)'}
                value={query}
                onChangeText={setQuery}
                onSubmitEditing={() => handleSearch()}
                onFocus={() => setShowHistory(true)}
                returnKeyType="search"
              />
            </View>
            <TouchableOpacity onPress={() => handleSearch()} disabled={!query.trim() || loading}>
              <LinearGradient colors={['#c0392b', '#e74c3c']} style={s.searchBtn}>
                {loading
                  ? <ActivityIndicator color={colors.white} size="small" />
                  : <Text style={s.playIcon}>▶</Text>
                }
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Credit banner with watch-ad option */}
          {aiMode && !isPremium && credits !== Infinity && (
            <View style={s.creditBanner}>
              <Ionicons name={credits === 0 ? 'alert-circle' : 'flash'} size={16} color={credits === 0 ? colors.red : colors.gold} />
              <Text style={[s.creditBannerText, credits === 0 && { color: colors.red }]}>
                {credits === 0
                  ? `No AI credits left · Resets in ${getResetTime()}`
                  : `${credits}/${maxCredits} credits · Resets in ${getResetTime()}`}
              </Text>
              {!adCreditUsed && (
                <TouchableOpacity
                  style={[s.watchAdBtn, !adLoaded && { opacity: 0.4 }]}
                  onPress={() => adLoaded && showAd(() => grantAdCredit())}
                  disabled={!adLoaded}
                >
                  <Ionicons name="play-circle" size={14} color={colors.white} />
                  <Text style={s.watchAdText}>+1 Free</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Filters */}
          <View style={s.filterRow}>
            <FilterPill label="All" value="all" />
            <FilterPill label="Movies" value="movie" />
            <FilterPill label="TV Series" value="tv" />
            {aiMode && <ProviderDropdown />}
          </View>

          {/* Search history dropdown */}
          {showHistory && searchHistory.length > 0 && (
            <View style={s.historyDropdown}>
              {searchHistory.slice(0, 6).map((h, i) => (
                <TouchableOpacity
                  key={i}
                  style={s.historyItem}
                  onPress={() => { setQuery(h); setShowHistory(false); handleSearch(h); }}
                >
                  <Ionicons name="time-outline" size={13} color={colors.subtle} />
                  <Text style={s.historyText}>{h}</Text>
                  <Ionicons name="arrow-up-outline" size={13} color={colors.subtle} style={{ marginLeft: 'auto', transform: [{ rotate: '-45deg' }] }} />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* ── Bottom section: Recommendations (AI) or Trending (Title Search) ── */}
        <View style={{ flex: 1, paddingHorizontal: 22 }}>
          {aiMode ? (
            !isPremium ? (
              <PremiumPicksSection onUnlock={buy} />
            ) : recLoading ? (
              <TrendingSkeleton />
            ) : favorites.length === 0 ? (
              <View style={s.recEmpty}>
                <Ionicons name="heart-outline" size={40} color="rgba(255,255,255,0.1)" />
                <Text style={s.recEmptyTitle}>No Recommendations Yet</Text>
                <Text style={s.recEmptySub}>Start adding movies to your favorites to get personalized suggestions here.</Text>
              </View>
            ) : (recMovies.length === 0 && recTV.length === 0) ? (
              <View style={s.recEmpty}>
                <Ionicons name="sparkles-outline" size={40} color="rgba(255,255,255,0.1)" />
                <Text style={s.recEmptyTitle}>No Recommendations Found</Text>
                <Text style={s.recEmptySub}>Add more favorites to improve your suggestions.</Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
                {recMovies.length > 0 && (
                  <View style={{ marginBottom: 20 }}>
                    <View style={s.trendingHeader}>
                      <Ionicons name="sparkles" size={16} color={colors.red} />
                      <Text style={s.trendingTitle}>Movies You Might Like</Text>
                    </View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 22 }}>
                      {recMovies.map((m, i) => (
                        <MovieCard key={m.tmdbID || i} movie={m} allMovies={recMovies} currentIndex={i} />
                      ))}
                    </ScrollView>
                  </View>
                )}
                <View style={{ marginBottom: 20 }}>
                  <View style={s.trendingHeader}>
                    <Ionicons name="sparkles" size={16} color={colors.red} />
                    <Text style={s.trendingTitle}>TV Shows You Might Like</Text>
                  </View>
                  {recTV.length > 0 ? (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 22 }}>
                      {recTV.map((m, i) => (
                        <MovieCard key={m.tmdbID || i} movie={m} allMovies={recTV} currentIndex={i} />
                      ))}
                    </ScrollView>
                  ) : (
                    <View style={s.recEmptyInline}>
                      <Ionicons name="tv-outline" size={20} color="rgba(255,255,255,0.15)" />
                      <Text style={s.recEmptyInlineText}>Start adding TV series to favorites to build your taste</Text>
                    </View>
                  )}
                </View>
              </ScrollView>
            )
          ) : trendingLoading ? (
            <TrendingSkeleton />
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
              {trendingMovies.length > 0 && (
                <View style={{ marginBottom: 20 }}>
                  <View style={s.trendingHeader}>
                    <Ionicons name="flame" size={16} color={colors.red} />
                    <Text style={s.trendingTitle}>Trending Movies Today</Text>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 22 }}>
                    {trendingMovies.map((m, i) => (
                      <MovieCard key={m.tmdbID || i} movie={m} allMovies={trendingMovies} currentIndex={i} />
                    ))}
                  </ScrollView>
                </View>
              )}
              {trendingTV.length > 0 && (
                <View>
                  <View style={s.trendingHeader}>
                    <Ionicons name="flame" size={16} color={colors.red} />
                    <Text style={s.trendingTitle}>Trending TV Today</Text>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 22 }}>
                    {trendingTV.map((m, i) => (
                      <MovieCard key={m.tmdbID || i} movie={m} allMovies={trendingTV} currentIndex={i} />
                    ))}
                  </ScrollView>
                </View>
              )}
            </ScrollView>
          )}
        </View>

        {/* Notifications Modal (outside Pressable is fine — it's a Modal) */}
        <Modal visible={showNotifs} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowNotifs(false)}>
          <SafeAreaView style={s.notifModal} edges={['top', 'bottom']}>
            <View style={s.notifHeader}>
              <TouchableOpacity onPress={() => setShowNotifs(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
              <Text style={s.notifTitle}>Notifications</Text>
              <View style={{ width: 24 }} />
            </View>
            <FlatList
              data={notifications}
              keyExtractor={(item, i) => item.id || i.toString()}
              contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
              ListEmptyComponent={
                <View style={s.notifEmpty}>
                  <Ionicons name="notifications-off-outline" size={40} color="rgba(255,255,255,0.1)" />
                  <Text style={s.notifEmptyText}>No notifications yet</Text>
                  <Text style={s.notifEmptySub}>Friend requests, acceptances and updates will appear here.</Text>
                </View>
              }
              renderItem={({ item }) => (
                <View style={[s.notifCard, !item.read && s.notifUnread]}>
                  <View style={s.notifIcon}>
                    <Ionicons
                      name={item.type === 'friend_request' ? 'person-add' : item.type === 'friend_accepted' ? 'people' : 'notifications'}
                      size={16}
                      color={colors.red}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.notifText}>{item.message}</Text>
                    <Text style={s.notifTime}>{item.createdAt?.toDate?.()?.toLocaleDateString?.() || ''}</Text>
                  </View>
                  {item.type === 'friend_request' && item.fromUserId && item.requestId && !item.accepted && !item.rejected ? (
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      <TouchableOpacity
                        style={s.notifAcceptBtn}
                        disabled={acceptingNotif === item.id}
                        onPress={async () => {
                          if (acceptingNotif) return;
                          setAcceptingNotif(item.id);
                          try {
                            await acceptFriendRequest(user!.uid, item.requestId, item.fromUserId);
                            setNotifications(prev => prev.map(n => n.id === item.id ? { ...n, accepted: true } : n));
                          } finally {
                            setAcceptingNotif(null);
                          }
                        }}
                      >
                        <Ionicons name="checkmark" size={14} color="#4ade80" />
                        <Text style={{ color: '#4ade80', fontSize: 11, fontWeight: '700' }}>Accept</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={s.notifRejectBtn}
                        onPress={async () => {
                          await rejectFriendRequest(user!.uid, item.requestId);
                          setNotifications(prev => prev.map(n => n.id === item.id ? { ...n, rejected: true } : n));
                        }}
                      >
                        <Ionicons name="close" size={14} color={colors.muted} />
                      </TouchableOpacity>
                    </View>
                  ) : item.type === 'friend_request' && item.accepted ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <View style={s.notifAcceptedBadge}>
                        <Ionicons name="checkmark" size={13} color="#4ade80" />
                        <Text style={{ color: '#4ade80', fontSize: 11, fontWeight: '700' }}>Friends</Text>
                      </View>
                      <TouchableOpacity style={s.notifDeleteBtn} onPress={() => { deletedNotifIds.current.add(item.id); setNotifications(prev => prev.filter(n => n.id !== item.id)); deleteNotification(user!.uid, item.id); }}>
                        <Ionicons name="trash-outline" size={14} color={colors.subtle} />
                      </TouchableOpacity>
                    </View>
                  ) : item.type === 'friend_request' && item.rejected ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={{ color: colors.subtle, fontSize: 11 }}>Declined</Text>
                      <TouchableOpacity style={s.notifDeleteBtn} onPress={() => { deletedNotifIds.current.add(item.id); setNotifications(prev => prev.filter(n => n.id !== item.id)); deleteNotification(user!.uid, item.id); }}>
                        <Ionicons name="trash-outline" size={14} color={colors.subtle} />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      {!item.read && <View style={s.notifDot} />}
                      <TouchableOpacity style={s.notifDeleteBtn} onPress={() => { deletedNotifIds.current.add(item.id); setNotifications(prev => prev.filter(n => n.id !== item.id)); deleteNotification(user!.uid, item.id); }}>
                        <Ionicons name="trash-outline" size={14} color={colors.subtle} />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}
            />
          </SafeAreaView>
        </Modal>
        <PremiumModal
          visible={showPremium}
          onClose={() => setShowPremium(false)}
          onUpgrade={() => { buy(); setShowPremium(false); }}
          onRestore={() => { restore(); setShowPremium(false); }}
          isPremium={isPremium}
          creditsLeft={credits}
          purchaseLoading={purchaseLoading}
        />
        <LevelUpModal visible={showLevelUp} tier={levelUpTier} onClose={() => setShowLevelUp(false)} />
      </Pressable>
    );
  }

  // ─── POST-SEARCH RESULTS SCREEN ────────────────────────────────────────────
  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => { setHasSearched(false); setResults([]); }} style={s.backBtn}>
          <Ionicons name="arrow-back" size={20} color={colors.text} />
        </TouchableOpacity>
        <View style={[s.inputWrap, { flex: 1 }]}>
          <Ionicons name="search" size={14} color={colors.subtle} />
          <TextInput
            style={[s.input, { fontSize: 14 }]}
            placeholder="New search…"
            placeholderTextColor={colors.subtle}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => handleSearch()}
            returnKeyType="search"
          />
        </View>
        <TouchableOpacity onPress={() => handleSearch()}>
          <LinearGradient colors={['#c0392b', '#e74c3c']} style={[s.searchBtn, { width: 44, height: 44 }]}>
            <Ionicons name="search" size={16} color={colors.white} />
          </LinearGradient>
        </TouchableOpacity>
      </View>

      <View style={[s.filterRow, { paddingHorizontal: 16, marginBottom: 12 }]}>
        <FilterPill label="All" value="all" />
        <FilterPill label="Movies" value="movie" />
        <FilterPill label="TV Series" value="tv" />
        <RatingDropdown />
        <ProviderDropdown />
        <Text style={s.resultCount}>{filteredResults.length} result{filteredResults.length !== 1 ? 's' : ''}</Text>
      </View>

      {loading ? (
        <View style={s.loadingWrap}>
          <ActivityIndicator size="large" color={colors.red} />
          <Text style={s.loadingText}>{aiMode ? '✦ AI is finding your movies…' : 'Searching…'}</Text>
        </View>
      ) : error ? (
        <View style={s.errorWrap}>
          <Ionicons name="alert-circle" size={20} color="#ff6b6b" />
          <Text style={s.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => { setError(null); setHasSearched(false); }}>
            <Text style={{ color: colors.red, fontWeight: '700', fontSize: 13, marginTop: 8 }}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredResults}
          keyExtractor={(item) => item.tmdbID?.toString() || item.imdbID || item.Title}
          numColumns={3}
          contentContainerStyle={s.grid}
          columnWrapperStyle={s.gridRow}
          renderItem={({ item, index }) => (
            <MovieCard movie={item} allMovies={filteredResults} currentIndex={index} />
          )}
          ListEmptyComponent={
            <View style={s.emptyWrap}>
              <Ionicons name="search-outline" size={48} color={colors.subtle} />
              <Text style={s.emptyText}>No results found. Try a different search.</Text>
              <TouchableOpacity style={s.retryBtn} onPress={() => setHasSearched(false)}>
                <Text style={s.retryText}>New Search</Text>
              </TouchableOpacity>
            </View>
          }
          ListFooterComponent={
            aiMode && filteredResults.length > 0 ? (
              <TouchableOpacity style={s.loadMoreBtn} onPress={handleLoadMore} disabled={loadingMore} activeOpacity={0.8}>
                {loadingMore
                  ? <ActivityIndicator color={colors.white} size="small" />
                  : <><Text style={s.loadMoreAi}>✦</Text><Text style={s.loadMoreText}>Load More</Text><Text style={s.loadMoreCost}>+1</Text></>
                }
              </TouchableOpacity>
            ) : null
          }
        />
      )}
      <PremiumModal
        visible={showPremium}
        onClose={() => setShowPremium(false)}
        onUpgrade={() => { buy(); setShowPremium(false); }}
        onRestore={() => { restore(); setShowPremium(false); }}
        isPremium={isPremium}
        creditsLeft={credits}
        purchaseLoading={purchaseLoading}
      />
      <LevelUpModal visible={showLevelUp} tier={levelUpTier} onClose={() => setShowLevelUp(false)} />
    </View>
  );
}

// ─── StyleSheet ────────────────────────────────────────────────────────────────

/** Ghost card styles */
const g = StyleSheet.create({
  card: {
    borderRadius: 10, overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    aspectRatio: 2 / 3, position: 'relative',
  },
  cardBody: {
    position: 'absolute', inset: 0,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  matchBadge: {
    position: 'absolute', top: 5, left: 5,
    backgroundColor: 'rgba(229,9,20,0.85)',
    borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2,
  },
  matchText: { color: '#fff', fontSize: 8, fontWeight: '700' },
  ratingBadge: {
    position: 'absolute', top: 5, right: 5,
    backgroundColor: 'rgba(245,197,24,0.2)',
    borderWidth: 1, borderColor: 'rgba(245,197,24,0.4)',
    borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2,
  },
  ratingText: { color: '#f5c518', fontSize: 8, fontWeight: '700' },
  genreTag: {
    position: 'absolute', bottom: 22, left: 5,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2,
  },
  genreText: { color: 'rgba(255,255,255,0.6)', fontSize: 8, fontWeight: '500' },
  titleLine: {
    position: 'absolute', bottom: 8, left: 6, right: 6,
    height: 6, borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
});

/** PremiumPicksSection styles */
const p = StyleSheet.create({
  wrapper: { marginBottom: 100 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 10,
  },
  headerTitle: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.88)' },
  headerSub: { fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 2 },
  aiBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(200,50,50,0.4)',
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4,
  },
  aiStar: { fontSize: 10, color: '#e05050' },
  aiBadgeText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginBottom: 14 },
  gridContainer: { position: 'relative', overflow: 'hidden', borderRadius: 14 },
  ghostGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 7,
    opacity: 0.55,
  },
  overlay: {
    position: 'absolute', inset: 0,
    backgroundColor: 'rgba(13,2,4,0.80)',
    borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 16, paddingHorizontal: 20,
    gap: 10,
  },
  lockCircle: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: 'rgba(229,9,20,0.12)',
    borderWidth: 1.5, borderColor: 'rgba(229,9,20,0.45)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 2,
  },
  overlayTitle: {
    fontSize: 16, fontWeight: '700', color: '#fff',
    textAlign: 'center', lineHeight: 22,
  },
  overlaySub: {
    fontSize: 12, color: 'rgba(255,255,255,0.42)',
    textAlign: 'center', lineHeight: 18, maxWidth: 230,
  },
  unlockBtn: { borderRadius: 12, overflow: 'hidden', marginTop: 4 },
  unlockGradient: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingHorizontal: 24, paddingVertical: 12,
  },
  unlockStar: { color: '#fff', fontSize: 12 },
  unlockText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  perks: { gap: 6, marginTop: 4, alignSelf: 'flex-start', paddingLeft: 16 },
  perkRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  perkDot: {
    width: 5, height: 5, borderRadius: 3,
    backgroundColor: 'rgba(229,9,20,0.7)',
  },
  perkText: { color: 'rgba(255,255,255,0.45)', fontSize: 11 },
});

/** Main screen styles (unchanged from original) */
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0204' },
  topGlow: { position: 'absolute', top: 0, left: 0, right: 0, height: 420, zIndex: 0 },
  sideGlow: { position: 'absolute', top: 0, left: -SCREEN_W * 0.2, width: SCREEN_W * 0.6, height: 300, zIndex: 0 },
  fixedContent: { paddingHorizontal: 22 },
  trendingScroll: { flex: 1, paddingHorizontal: 22 },
  trendingScrollContent: { paddingBottom: 120 },
  topBarWrap: { paddingHorizontal: 22, paddingBottom: 10, zIndex: 10 },
  topBarRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  topBarLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, marginRight: 10 },
  topAvatarInner: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  topAvatarText: { color: colors.white, fontWeight: '700', fontSize: 15 },
  topWelcome: { color: 'rgba(255,255,255,0.5)', fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase' },
  topName: { color: colors.white, fontWeight: '600', fontSize: 14, flexShrink: 1 },
  topBarRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  aiPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(200,50,50,0.4)' },
  aiStar: { fontSize: 11, color: '#e05050' },
  topChipTextRed: { color: colors.white, fontSize: 12, fontWeight: '600' },
  streakPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 11, paddingVertical: 5, borderRadius: 20, backgroundColor: 'rgba(255,200,0,0.08)', borderWidth: 1, borderColor: 'rgba(255,180,0,0.3)' },
  streakPillLow: { backgroundColor: 'rgba(229,9,20,0.1)', borderColor: 'rgba(229,9,20,0.4)' },
  topChipTextGold: { color: colors.gold, fontSize: 12, fontWeight: '700' },
  bellBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', position: 'relative' },
  topBellDot: { position: 'absolute', top: 4, right: 4, width: 7, height: 7, borderRadius: 4, backgroundColor: colors.red },
  heroSection: { marginTop: 16, marginBottom: 14 },
  heroLabel: { fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', color: 'rgba(200,60,60,0.8)', fontWeight: '600', marginBottom: 8 },
  heroTitle: { fontSize: 36, fontWeight: '700', color: colors.white, letterSpacing: -0.5, lineHeight: 40 },
  heroAccent: { fontSize: 38, fontWeight: '800', color: '#e8403a', letterSpacing: -1, lineHeight: 44 },
  heroSub: { color: 'rgba(255,255,255,0.4)', fontSize: 13.5, lineHeight: 21, marginTop: 10, maxWidth: 280 },
  aiToggle: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  aiToggleTrack: { width: 44, height: 24, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', paddingHorizontal: 2 },
  aiToggleTrackActive: { backgroundColor: 'rgba(229,9,20,0.3)', borderColor: 'rgba(229,9,20,0.5)' },
  aiToggleThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.4)' },
  aiToggleThumbActive: { backgroundColor: colors.red, alignSelf: 'flex-end' },
  aiToggleLabel: { color: colors.subtle, fontSize: 13, fontWeight: '600' },
  aiToggleLabelActive: { color: colors.red },
  searchRow: { flexDirection: 'row', gap: 10, width: '100%', marginBottom: 12 },
  inputWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 16, paddingHorizontal: 16, height: 50 },
  searchIconEmoji: { color: 'rgba(255,255,255,0.35)', fontSize: 16 },
  input: { flex: 1, fontSize: 14, color: colors.white, padding: 0 },
  searchBtn: { height: 50, width: 58, borderRadius: 16, alignItems: 'center', justifyContent: 'center', shadowColor: 'rgba(200,40,40,0.45)', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 1, shadowRadius: 20, elevation: 8 },
  playIcon: { color: colors.white, fontSize: 20 },
  creditBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,200,0,0.08)', borderWidth: 1, borderColor: 'rgba(255,180,0,0.2)', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 12 },
  watchAdBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.red, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  watchAdText: { color: colors.white, fontSize: 11, fontWeight: '700' },
  creditBannerText: { color: colors.gold, fontSize: 12, fontWeight: '600', flex: 1 },
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 20, alignItems: 'center', width: '100%', zIndex: 99 },
  pill: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.07)', flexDirection: 'row', alignItems: 'center' },
  pillActive: { backgroundColor: '#c0392b', shadowColor: 'rgba(192,57,43,0.4)', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 12, elevation: 6 },
  pillText: { color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: '600' },
  pillTextActive: { color: colors.white },
  ratingPillActive: { borderColor: 'rgba(255,255,255,0.12)', backgroundColor: 'transparent' },
  dropdown: { position: 'absolute', top: 40, right: 0, zIndex: 999, backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', borderRadius: 10, paddingVertical: 4, minWidth: 120, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 8 },
  dropItem: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10 },
  dropItemActive: { backgroundColor: 'rgba(245,197,24,0.08)' },
  dropItemText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  ratingPill: { flexDirection: 'row', alignItems: 'center', gap: 5, marginLeft: 'auto', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: 'transparent' },
  topBar: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 10, alignItems: 'center' },
  backBtn: { padding: 8 },
  resultCount: { color: colors.subtle, fontSize: 12, fontWeight: '600', marginLeft: 'auto' },
  grid: { paddingHorizontal: 16, paddingBottom: 100 },
  gridRow: { gap: 8, marginBottom: 8 },
  loadingWrap: { flex: 1, alignItems: 'center', paddingTop: 40, gap: 12 },
  loadingText: { color: colors.subtle, fontSize: 14 },
  errorWrap: { alignItems: 'center', margin: 16, padding: 24, backgroundColor: 'rgba(229,9,20,0.08)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(229,9,20,0.2)' },
  errorText: { color: '#ff6b6b', fontSize: 14, textAlign: 'center', marginTop: 8 },
  emptyWrap: { alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 12 },
  emptyText: { color: colors.subtle, fontSize: 14 },
  retryBtn: { backgroundColor: colors.red, borderRadius: 8, paddingHorizontal: 20, paddingVertical: 10, marginTop: 8 },
  retryText: { color: colors.white, fontWeight: '700', fontSize: 14 },
  loadMoreBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: 'rgba(229,9,20,0.15)', borderWidth: 1, borderColor: 'rgba(229,9,20,0.3)', borderRadius: 12, paddingVertical: 14, marginTop: 16, marginBottom: 20 },
  loadMoreText: { color: colors.white, fontSize: 14, fontWeight: '700' },
  loadMoreAi: { color: '#e05050', fontSize: 14 },
  loadMoreCost: { color: colors.gold, fontSize: 12, fontWeight: '800', backgroundColor: 'rgba(245,197,24,0.15)', borderWidth: 1, borderColor: 'rgba(245,197,24,0.3)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1, overflow: 'hidden' },
  historyDropdown: { width: '100%', backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderTopWidth: 0, borderBottomLeftRadius: 12, borderBottomRightRadius: 12, marginTop: -12, paddingTop: 4, marginBottom: 16 },
  historyItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' },
  historyText: { color: colors.muted, fontSize: 14, fontWeight: '500' },
  trendingHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  trendingTitle: { color: colors.white, fontSize: 15, fontWeight: '700' },
  recEmpty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 32, paddingHorizontal: 24, backgroundColor: 'rgba(255,255,255,0.02)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', borderRadius: 16 },
  recEmptyTitle: { color: colors.muted, fontSize: 15, fontWeight: '700', marginTop: 12 },
  recEmptySub: { color: colors.subtle, fontSize: 13, textAlign: 'center', marginTop: 6, maxWidth: 260, lineHeight: 20 },
  recEmptyInline: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 20, paddingHorizontal: 16, backgroundColor: 'rgba(255,255,255,0.02)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', borderRadius: 12 },
  recEmptyInlineText: { color: colors.subtle, fontSize: 13, flex: 1 },
  notifModal: { flex: 1, backgroundColor: colors.dark },
  notifHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)' },
  notifTitle: { color: colors.white, fontSize: 17, fontWeight: '700' },
  notifEmpty: { alignItems: 'center', paddingVertical: 60 },
  notifEmptyText: { color: colors.subtle, fontSize: 14, fontWeight: '600', marginTop: 12 },
  notifEmptySub: { color: 'rgba(255,255,255,0.2)', fontSize: 13, marginTop: 4, textAlign: 'center', maxWidth: 260 },
  notifCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, backgroundColor: 'rgba(255,255,255,0.02)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', borderRadius: 12, marginBottom: 8 },
  notifUnread: { backgroundColor: 'rgba(229,9,20,0.04)', borderColor: 'rgba(229,9,20,0.15)' },
  notifIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(229,9,20,0.12)', alignItems: 'center', justifyContent: 'center' },
  notifText: { color: colors.text, fontSize: 14, fontWeight: '600' },
  notifTime: { color: colors.subtle, fontSize: 11, marginTop: 2 },
  notifDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.red },
  notifAcceptBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(74,222,128,0.15)', borderWidth: 1, borderColor: 'rgba(74,222,128,0.3)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  notifRejectBtn: { backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  notifAcceptedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(74,222,128,0.1)', borderWidth: 1, borderColor: 'rgba(74,222,128,0.3)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  notifDeleteBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
});
