import React, { useEffect, useState, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Image, Alert,
  TextInput, FlatList, Dimensions, Modal, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { getGenreColor } from '../theme/genreColors';
import { useAuth } from '../contexts/AuthContext';
import { subscribeToAllMovies, getUserStats, getSearchCount, getFriends, updateUserProfile, type MovieActivity } from '../lib/firestore';
import { sortMovies, filterByGenre, searchByTitle, getUniqueGenres } from '../lib/movieUtils';
import { fetchAvailableProviders, type StreamingProvider } from '../api/client';
import { useCredits } from '../hooks/useCredits';
import EditProfileModal from '../components/EditProfileModal';
import ProfileMovieModal from '../components/ProfileMovieModal';
import ProfileRing, { getTier, getNextTier, TIER_META, type Tier } from '../components/ProfileRing';

const { width: SW } = Dimensions.get('window');

const GRID_COLS = 3;
const GRID_GAP = 8;
const GRID_W = (SW - 32 - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS;

type Tab = 'watched' | 'watchlist' | 'favorites' | 'stats' | 'services';
type Sort = 'date' | 'rating' | 'title';
type ViewMode = 'grid' | 'list';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, profile, logout } = useAuth();
  const { isPremium, setPremium, refresh: refreshCredits } = useCredits(user?.uid);
  const [watched, setWatched] = useState<MovieActivity[]>([]);
  const [toWatch, setToWatch] = useState<MovieActivity[]>([]);
  const [favs, setFavs] = useState<MovieActivity[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [tab, setTab] = useState<Tab>('watched');
  const [sort, setSort] = useState<Sort>('date');
  const [genre, setGenre] = useState('all');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [wlSort, setWlSort] = useState<Sort>('date');
  const [wlGenre, setWlGenre] = useState('all');
  const [wlSearch, setWlSearch] = useState('');
  const [wlViewMode, setWlViewMode] = useState<ViewMode>('grid');
  const [favSort, setFavSort] = useState<Sort>('date');
  const [favGenre, setFavGenre] = useState('all');
  const [favSearch, setFavSearch] = useState('');
  const [favViewMode, setFavViewMode] = useState<ViewMode>('grid');
  const [editVisible, setEditVisible] = useState(false);
  const [selectedMovie, setSelectedMovie] = useState<MovieActivity | null>(null);
  const [searchCount, setSearchCount] = useState(0);
  const [friendsCount, setFriendsCount] = useState(0);
  const [showTierInfo, setShowTierInfo] = useState(false);
  const [availableProviders, setAvailableProviders] = useState<StreamingProvider[]>([]);
  const [selectedProviders, setSelectedProviders] = useState<number[]>([]);
  const [providersLoading, setProvidersLoading] = useState(false);
  const [savingProviders, setSavingProviders] = useState(false);
  const [page, setPage] = useState<Record<string, number>>({ watched: 1, watchlist: 1, favorites: 1 });
  const PAGE_SIZE = 18;

  useEffect(() => {
    if (!user?.uid) return;
    const unsub = subscribeToAllMovies(user.uid, {
      watched: setWatched,
      toWatch: setToWatch,
      favorite: setFavs,
    });
    getUserStats(user.uid).then(setStats).catch(() => {});
    getSearchCount(user.uid).then(setSearchCount).catch(() => {});
    getFriends(user.uid).then(f => setFriendsCount(f.length)).catch(() => {});
    // Load saved streaming services
    import('../lib/firestore').then(({ getUserProfile }) => {
      getUserProfile(user.uid).then(p => {
        if (p?.streamingServices) setSelectedProviders(p.streamingServices);
      }).catch(() => {});
    });
    return unsub;
  }, [user?.uid]);

  // Refresh stats when lists change
  useEffect(() => {
    if (!user?.uid) return;
    getUserStats(user.uid).then(setStats).catch(() => {});
  }, [watched.length, toWatch.length, favs.length]);

  const filtered = useMemo(() => {
    let m = watched;
    if (search) m = searchByTitle(m, search);
    if (genre !== 'all') m = filterByGenre(m, genre);
    return sortMovies(m, sort);
  }, [watched, search, genre, sort]);

  const genres = useMemo(() => getUniqueGenres(watched), [watched]);

  const filteredWl = useMemo(() => {
    let m = toWatch;
    if (wlSearch) m = searchByTitle(m, wlSearch);
    if (wlGenre !== 'all') m = filterByGenre(m, wlGenre);
    return sortMovies(m, wlSort);
  }, [toWatch, wlSearch, wlGenre, wlSort]);
  const wlGenres = useMemo(() => getUniqueGenres(toWatch), [toWatch]);

  const filteredFav = useMemo(() => {
    let m = favs;
    if (favSearch) m = searchByTitle(m, favSearch);
    if (favGenre !== 'all') m = filterByGenre(m, favGenre);
    return sortMovies(m, favSort);
  }, [favs, favSearch, favGenre, favSort]);
  const favGenres = useMemo(() => getUniqueGenres(favs), [favs]);

  const topGenresByList = useMemo(() => {
    const map: Record<string, { watched: number; watchlist: number; favorites: number }> = {};
    const count = (list: MovieActivity[], key: 'watched' | 'watchlist' | 'favorites') => {
      list.forEach(m => (m.genres || []).forEach(g => {
        if (!map[g]) map[g] = { watched: 0, watchlist: 0, favorites: 0 };
        map[g][key]++;
      }));
    };
    count(watched, 'watched');
    count(toWatch, 'watchlist');
    count(favs, 'favorites');
    return Object.entries(map)
      .map(([g, c]) => ({ genre: g, ...c, total: c.watched + c.watchlist + c.favorites }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [watched, toWatch, favs]);
  const avgRating = useMemo(() => {
    const rated = watched.filter(m => m.rating && m.rating > 0);
    if (!rated.length) return '—';
    return (rated.reduce((s, m) => s + (m.rating || 0), 0) / rated.length).toFixed(1);
  }, [watched]);

  const displayName = profile?.displayName || user?.email?.split('@')[0] || 'User';
  const initials = displayName.charAt(0).toUpperCase();
  const isEmoji = profile?.photoURL && !profile.photoURL.startsWith('http');

  const handleLogout = () => Alert.alert('Sign Out', 'Are you sure?', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Sign Out', style: 'destructive', onPress: logout },
  ]);

  const tabs: { id: Tab; label: string; icon: string; count: number | null; premium?: boolean }[] = [
    { id: 'watched', label: 'Watched', icon: 'eye-outline', count: watched.length },
    { id: 'watchlist', label: 'Watchlist', icon: 'bookmark-outline', count: toWatch.length },
    { id: 'favorites', label: 'Favs', icon: 'heart-outline', count: favs.length },
    { id: 'stats', label: 'Stats', icon: 'bar-chart-outline', count: null, premium: true },
    { id: 'services', label: 'Services', icon: 'tv-outline', count: null, premium: true },
  ];

  const toggleProvider = (id: number) => {
    setSelectedProviders(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
  };

  const saveProviders = async () => {
    if (!user?.uid) return;
    setSavingProviders(true);
    try {
      await updateUserProfile(user.uid, { streamingServices: selectedProviders } as any);
      Alert.alert('Saved', 'Your streaming services have been updated.');
    } catch {
      Alert.alert('Error', 'Failed to save. Try again.');
    } finally {
      setSavingProviders(false);
    }
  };

  useEffect(() => {
    if (tab !== 'services' || !isPremium || availableProviders.length > 0) return;
    setProvidersLoading(true);
    fetchAvailableProviders().then(setAvailableProviders).catch(() => {}).finally(() => setProvidersLoading(false));
  }, [tab, isPremium]);

  const renderMiniGrid = (movie: MovieActivity) => (
    <TouchableOpacity key={movie.movieId} style={s.miniCard} onPress={() => setSelectedMovie(movie)}>
      {movie.poster ? <Image source={{ uri: movie.poster }} style={s.miniPoster} /> : (
        <View style={[s.miniPoster, s.noPoster]}><Ionicons name="film-outline" size={24} color="rgba(255,255,255,0.15)" /></View>
      )}
      <View style={s.miniInfo}>
        <Text style={s.miniTitle} numberOfLines={1}>{movie.title}</Text>
        <View style={s.miniMeta}>
          {movie.year ? <Text style={s.miniYear}>{movie.year}</Text> : null}
          {movie.rating && movie.rating > 0 ? <View style={s.miniRating}><Ionicons name="star" size={10} color={colors.gold} /><Text style={s.miniRatingText}>{movie.rating.toFixed(1)}</Text></View> : null}
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderMiniList = (movie: MovieActivity) => (
    <TouchableOpacity key={movie.movieId} style={s.listCard} onPress={() => setSelectedMovie(movie)}>
      {movie.poster ? <Image source={{ uri: movie.poster }} style={s.listPoster} /> : (
        <View style={[s.listPoster, s.noPoster]}><Ionicons name="film-outline" size={16} color="rgba(255,255,255,0.2)" /></View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={s.listTitle} numberOfLines={1}>{movie.title}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
          {movie.year ? <Text style={s.miniYear}>{movie.year}</Text> : null}
          {(movie.genres || []).slice(0, 2).map((g, i) => { const c = getGenreColor(g); return <View key={i} style={[s.tinyGenre, { backgroundColor: c.bg, borderColor: c.border }]}><Text style={[s.tinyGenreText, { color: c.text }]}>{g}</Text></View>; })}
        </View>
      </View>
      {movie.rating && movie.rating > 0 ? <View style={s.miniRating}><Ionicons name="star" size={11} color={colors.gold} /><Text style={s.miniRatingText}>{movie.rating.toFixed(1)}</Text></View> : null}
    </TouchableOpacity>
  );

  const [showSortDrop, setShowSortDrop] = useState(false);
  const [showGenreDrop, setShowGenreDrop] = useState(false);

  const SORT_OPTIONS: { value: Sort; label: string; icon: string }[] = [
    { value: 'date', label: 'Recent', icon: 'time-outline' },
    { value: 'rating', label: 'Rating', icon: 'star-outline' },
    { value: 'title', label: 'A-Z', icon: 'text-outline' },
  ];

  const renderFilterBar = (opts: {
    search: string; setSearch: (v: string) => void;
    sort: Sort; setSort: (v: Sort) => void;
    genre: string; setGenre: (v: string) => void;
    viewMode: ViewMode; setViewMode: (v: ViewMode) => void;
    genres: string[]; count: number; placeholder: string;
  }) => (
    <>
      <View style={s.filterBar}>
        <View style={s.searchWrap}>
          <Ionicons name="search" size={14} color={colors.subtle} style={{ position: 'absolute', left: 10, top: 10, zIndex: 1 }} />
          <TextInput style={s.searchInput} placeholder={opts.placeholder} placeholderTextColor={colors.subtle} value={opts.search} onChangeText={opts.setSearch} />
        </View>
        <View style={s.filterActions}>
          <View style={{ position: 'relative', zIndex: 99 }}>
            <TouchableOpacity style={s.sortBtn} onPress={() => { setShowSortDrop(!showSortDrop); setShowGenreDrop(false); }}>
              <Text style={s.sortLabel}>Sort by</Text>
              <Ionicons name={SORT_OPTIONS.find(o => o.value === opts.sort)!.icon as any} size={14} color={colors.red} />
              <Text style={s.sortText}>{SORT_OPTIONS.find(o => o.value === opts.sort)!.label}</Text>
              <Ionicons name="chevron-down" size={12} color={colors.subtle} />
            </TouchableOpacity>
            {showSortDrop && (
              <View style={s.sortDropdown}>
                {SORT_OPTIONS.map(o => (
                  <TouchableOpacity key={o.value} style={[s.sortDropItem, opts.sort === o.value && s.sortDropItemActive]} onPress={() => { opts.setSort(o.value); setShowSortDrop(false); }}>
                    <Ionicons name={o.icon as any} size={14} color={opts.sort === o.value ? colors.red : colors.muted} />
                    <Text style={[s.sortDropText, opts.sort === o.value && { color: colors.red }]}>{o.label}</Text>
                    {opts.sort === o.value && <Ionicons name="checkmark" size={14} color={colors.red} style={{ marginLeft: 'auto' }} />}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
          {opts.genres.length > 0 && (
            <View style={{ position: 'relative', zIndex: 98 }}>
              <TouchableOpacity style={[s.sortBtn, opts.genre !== 'all' && { borderColor: 'rgba(229,9,20,0.4)' }]} onPress={() => { setShowGenreDrop(!showGenreDrop); setShowSortDrop(false); }}>
                <Ionicons name="film-outline" size={14} color={opts.genre !== 'all' ? colors.red : colors.muted} />
                <Text style={[s.sortText, opts.genre !== 'all' && { color: colors.red }]}>{opts.genre === 'all' ? 'Genre' : opts.genre}</Text>
                <Ionicons name="chevron-down" size={12} color={colors.subtle} />
              </TouchableOpacity>
              {showGenreDrop && (
                <View style={s.genreDropdown}>
                  <ScrollView style={{ maxHeight: 220 }} showsVerticalScrollIndicator nestedScrollEnabled>
                    <TouchableOpacity style={[s.sortDropItem, opts.genre === 'all' && s.sortDropItemActive]} onPress={() => { opts.setGenre('all'); setShowGenreDrop(false); }}>
                      <Text style={[s.sortDropText, opts.genre === 'all' && { color: colors.red }]}>All Genres</Text>
                      {opts.genre === 'all' && <Ionicons name="checkmark" size={14} color={colors.red} style={{ marginLeft: 'auto' }} />}
                    </TouchableOpacity>
                    {opts.genres.map(g => (
                      <TouchableOpacity key={g} style={[s.sortDropItem, opts.genre === g && s.sortDropItemActive]} onPress={() => { opts.setGenre(g); setShowGenreDrop(false); }}>
                        <Text style={[s.sortDropText, opts.genre === g && { color: colors.red }]}>{g}</Text>
                        {opts.genre === g && <Ionicons name="checkmark" size={14} color={colors.red} style={{ marginLeft: 'auto' }} />}
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>
          )}
          <View style={s.viewToggle}>
            <TouchableOpacity style={[s.viewBtn, opts.viewMode === 'grid' && s.viewBtnActive]} onPress={() => opts.setViewMode('grid')}><Ionicons name="grid-outline" size={14} color={opts.viewMode === 'grid' ? colors.red : colors.subtle} /></TouchableOpacity>
            <TouchableOpacity style={[s.viewBtn, opts.viewMode === 'list' && s.viewBtnActive]} onPress={() => opts.setViewMode('list')}><Ionicons name="list-outline" size={14} color={opts.viewMode === 'list' ? colors.red : colors.subtle} /></TouchableOpacity>
          </View>
        </View>
      </View>
      <Text style={s.countText}>{opts.count} film{opts.count !== 1 ? 's' : ''}</Text>
    </>
  );

  const activeViewMode = tab === 'watchlist' ? wlViewMode : tab === 'favorites' ? favViewMode : viewMode;
  const activeSearch = tab === 'watchlist' ? wlSearch : tab === 'favorites' ? favSearch : search;
  const activeGenre = tab === 'watchlist' ? wlGenre : tab === 'favorites' ? favGenre : genre;

  const getPagedMovies = (movies: MovieActivity[]) => {
    const currentPage = page[tab] || 1;
    return movies.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  };
  const getTotalPages = (movies: MovieActivity[]) => Math.max(1, Math.ceil(movies.length / PAGE_SIZE));

  const renderMovieList = (movies: MovieActivity[]) => {
    const paged = getPagedMovies(movies);
    if (!paged.length) return (
      <View style={s.empty}>
        <Ionicons name={tab === 'watchlist' ? 'bookmark-outline' : tab === 'favorites' ? 'heart-outline' : 'eye-outline'} size={40} color="rgba(255,255,255,0.1)" />
        <Text style={s.emptyText}>{tab === 'watched' ? (activeSearch || activeGenre !== 'all' ? 'No movies match your filters.' : 'No movies watched yet.') : tab === 'watchlist' ? (activeSearch || activeGenre !== 'all' ? 'No movies match your filters.' : 'Your watchlist is empty.') : (activeSearch || activeGenre !== 'all' ? 'No movies match your filters.' : 'No favorites yet.')}</Text>
      </View>
    );
    const totalPages = getTotalPages(movies);
    const content = activeViewMode === 'list'
      ? <View style={{ gap: 8 }}>{paged.map(renderMiniList)}</View>
      : (() => { const rows: MovieActivity[][] = []; for (let i = 0; i < paged.length; i += GRID_COLS) rows.push(paged.slice(i, i + GRID_COLS)); return <View style={{ gap: GRID_GAP }}>{rows.map((row, ri) => <View key={ri} style={{ flexDirection: 'row', gap: GRID_GAP }}>{row.map(renderMiniGrid)}</View>)}</View>; })();
    return (
      <>
        {content}
        {totalPages > 1 && (
          <View style={s.paginationRow}>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
              <TouchableOpacity
                key={p}
                style={[s.pageBtn, (page[tab] || 1) === p && s.pageBtnActive]}
                onPress={() => setPage(prev => ({ ...prev, [tab]: p }))}
              >
                <Text style={[s.pageBtnText, (page[tab] || 1) === p && s.pageBtnTextActive]}>{p}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </>
    );
  };

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        {/* Top buttons */}
        <View style={s.topBar}>
          <TouchableOpacity style={s.editBtn} onPress={() => setEditVisible(true)}>
            <Ionicons name="create-outline" size={15} color={colors.red} /><Text style={s.editBtnText}>Edit Profile</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.signOutBtn} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={15} color={colors.muted} /><Text style={s.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>

        {/* Profile header card */}
        <View style={s.headerCard}>
          <LinearGradient colors={['#1a0505', '#0d0d0d']} start={{ x: 0.3, y: 0 }} end={{ x: 1, y: 1 }} style={s.banner} />
          <View style={s.headerBody}>
            <View style={s.avatarRow}>
              <ProfileRing tier={getTier(searchCount)}>
                <View style={s.avatarInner}>
                  {isEmoji ? <Text style={{ fontSize: 32 }}>{profile!.photoURL}</Text> :
                    profile?.photoURL?.startsWith('http') ? <Image source={{ uri: profile.photoURL }} style={{ width: '100%', height: '100%', borderRadius: 30 }} /> :
                    <Text style={s.avatarText}>{initials}</Text>}
                </View>
              </ProfileRing>
              <View style={{ flex: 1 }}>
                <Text style={s.displayName}>{displayName}</Text>
                {user?.email ? <Text style={s.email}>{user.email}</Text> : null}
                <View style={s.tierRow}>
                  <View style={[s.tierDot, { backgroundColor: TIER_META[getTier(searchCount)].color }]} />
                  <Text style={[s.tierLabel, { color: TIER_META[getTier(searchCount)].color }]}>{TIER_META[getTier(searchCount)].label}</Text>
                </View>
                <Text style={s.tierDesc}>
                  {searchCount} search{searchCount !== 1 ? 'es' : ''}
                  {getNextTier(getTier(searchCount)).next
                    ? ` · ${getNextTier(getTier(searchCount)).needed - searchCount} more to ${TIER_META[getNextTier(getTier(searchCount)).next!].label}`
                    : ' · Max level reached 🏆'}
                </Text>
              </View>
            </View>
            {/* Stat cards */}
            <View style={s.statsRow}>
              <View style={s.statCard}><Ionicons name="eye-outline" size={16} color={colors.red} /><Text style={s.statNum}>{watched.length}</Text><Text style={s.statLabel} numberOfLines={1}>Watched</Text></View>
              <View style={s.statCard}><Ionicons name="bookmark-outline" size={16} color={colors.gold} /><Text style={s.statNum}>{toWatch.length}</Text><Text style={s.statLabel} numberOfLines={1}>Watchlist</Text></View>
              <View style={s.statCard}><Ionicons name="heart-outline" size={16} color="#ff6b6b" /><Text style={s.statNum}>{favs.length}</Text><Text style={s.statLabel} numberOfLines={1}>Favorites</Text></View>
              <View style={s.statCard}><Ionicons name="people-outline" size={16} color="#4ade80" /><Text style={s.statNum}>{friendsCount}</Text><Text style={s.statLabel} numberOfLines={1}>Friends</Text></View>
              <View style={s.statCard}><Ionicons name="star-outline" size={16} color={colors.gold} /><Text style={s.statNum}>{avgRating}</Text><Text style={s.statLabel} numberOfLines={1}>Avg</Text></View>
            </View>
          </View>
        </View>

        {/* Tabs */}
        <View style={s.tabRow}>
          {tabs.map(t => (
            <TouchableOpacity key={t.id} style={[s.tab, tab === t.id && s.tabActive]} onPress={() => { setTab(t.id); setShowSortDrop(false); setShowGenreDrop(false); setPage(p => ({ ...p, [t.id]: 1 })); }}>
              <View style={{ position: 'relative' }}>
                <Ionicons name={t.icon as any} size={15} color={tab === t.id ? colors.white : colors.subtle} />
                {t.premium && <Text style={s.crownBadge}>👑</Text>}
              </View>
              <Text style={[s.tabText, tab === t.id && s.tabTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tab content */}
        <View style={s.content}>
          {tab === 'watched' && (
            <>
              {renderFilterBar({ search, setSearch: (v) => { setSearch(v); setPage(p => ({ ...p, watched: 1 })); }, sort, setSort: (v) => { setSort(v); setPage(p => ({ ...p, watched: 1 })); }, genre, setGenre: (v) => { setGenre(v); setPage(p => ({ ...p, watched: 1 })); }, viewMode, setViewMode, genres, count: filtered.length, placeholder: 'Search watched…' })}
              {renderMovieList(filtered)}
            </>
          )}
          {tab === 'watchlist' && (
            <>
              {renderFilterBar({ search: wlSearch, setSearch: (v) => { setWlSearch(v); setPage(p => ({ ...p, watchlist: 1 })); }, sort: wlSort, setSort: (v) => { setWlSort(v); setPage(p => ({ ...p, watchlist: 1 })); }, genre: wlGenre, setGenre: (v) => { setWlGenre(v); setPage(p => ({ ...p, watchlist: 1 })); }, viewMode: wlViewMode, setViewMode: setWlViewMode, genres: wlGenres, count: filteredWl.length, placeholder: 'Search watchlist…' })}
              {renderMovieList(filteredWl)}
            </>
          )}
          {tab === 'favorites' && (
            <>
              {renderFilterBar({ search: favSearch, setSearch: (v) => { setFavSearch(v); setPage(p => ({ ...p, favorites: 1 })); }, sort: favSort, setSort: (v) => { setFavSort(v); setPage(p => ({ ...p, favorites: 1 })); }, genre: favGenre, setGenre: (v) => { setFavGenre(v); setPage(p => ({ ...p, favorites: 1 })); }, viewMode: favViewMode, setViewMode: setFavViewMode, genres: favGenres, count: filteredFav.length, placeholder: 'Search favorites…' })}
              {renderMovieList(filteredFav)}
            </>
          )}
          {tab === 'stats' && !isPremium && (
            <View style={ps.wrapper}>
              <View style={ps.gridContainer}>
                {/* Ghost: mirrors actual stats layout */}
                <View style={{ opacity: 0.55, gap: 16 }}>
                  {/* Ghost tier card */}
                  <View style={s.card}>
                    <View style={{ alignItems: 'center', gap: 10 }}>
                      <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 2, borderColor: 'rgba(255,255,255,0.08)' }} />
                      <View style={{ width: 100, height: 14, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.1)' }} />
                      <View style={{ width: 160, height: 10, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.06)' }} />
                      <View style={{ width: '100%', height: 6, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 99 }} />
                    </View>
                  </View>
                  {/* Ghost genres card */}
                  <View style={s.card}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                      <View style={{ width: 15, height: 15, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.08)' }} />
                      <View style={{ width: 90, height: 12, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.1)' }} />
                    </View>
                    {[0.9, 0.7, 0.55, 0.4, 0.25].map((w, i) => (
                      <View key={i} style={{ marginBottom: 12 }}>
                        <View style={{ width: 70, height: 10, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.08)', marginBottom: 4 }} />
                        <View style={{ height: 6, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 99, overflow: 'hidden' }}>
                          <View style={{ width: `${w * 100}%`, height: '100%', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 99 }} />
                        </View>
                      </View>
                    ))}
                  </View>
                  {/* Ghost activity card */}
                  <View style={s.card}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                      <View style={{ width: 15, height: 15, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.08)' }} />
                      <View style={{ width: 120, height: 12, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.1)' }} />
                    </View>
                    {[1, 2, 3, 4].map(i => (
                      <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                        <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: 'rgba(255,255,255,0.08)' }} />
                        <View style={{ flex: 1, height: 10, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.06)' }} />
                        <View style={{ width: 28, height: 14, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.08)' }} />
                      </View>
                    ))}
                  </View>
                </View>
                {/* Lock overlay */}
                <View style={ps.overlay}>
                  <View style={ps.lockCircle}>
                    <Ionicons name="lock-closed" size={22} color={colors.red} />
                  </View>
                  <Text style={ps.overlayTitle}>{'Unlock Your Viewing\nInsights'}</Text>
                  <Text style={ps.overlaySub}>Your stats are ready. See your genres, ratings, and activity — upgrade to Premium.</Text>
                  <TouchableOpacity style={ps.unlockBtn} onPress={() => { setPremium(true); refreshCredits(); }} activeOpacity={0.85}>
                    <LinearGradient colors={['#c0392b', '#e74c3c']} style={ps.unlockGradient}>
                      <Text style={ps.unlockStar}>✦</Text>
                      <Text style={ps.unlockText}>Unlock with Premium</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                  <View style={ps.perks}>
                    {['Detailed genre breakdown', 'Personal rating analytics', 'Full activity overview'].map((perk, i) => (
                      <View key={i} style={ps.perkRow}>
                        <View style={ps.perkDot} />
                        <Text style={ps.perkText}>{perk}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            </View>
          )}
          {tab === 'services' && !isPremium && (
            <View style={ps.wrapper}>
              <View style={ps.gridContainer}>
                <View style={{ opacity: 0.55, gap: 16 }}>
                  <View style={s.card}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                      <View style={{ width: 15, height: 15, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.08)' }} />
                      <View style={{ width: 130, height: 12, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.1)' }} />
                    </View>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                      {[1,2,3,4,5,6,7,8].map(i => (
                        <View key={i} style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }} />
                      ))}
                    </View>
                  </View>
                  <View style={s.card}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                      <View style={{ width: 15, height: 15, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.08)' }} />
                      <View style={{ width: 90, height: 12, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.1)' }} />
                    </View>
                    {[1,2,3].map(i => (
                      <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                        <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: 'rgba(255,255,255,0.08)' }} />
                        <View style={{ flex: 1, height: 10, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.06)' }} />
                      </View>
                    ))}
                  </View>
                </View>
                <View style={ps.overlay}>
                  <View style={ps.lockCircle}>
                    <Ionicons name="lock-closed" size={22} color={colors.red} />
                  </View>
                  <Text style={ps.overlayTitle}>{'Filter by Your\nStreaming Services'}</Text>
                  <Text style={ps.overlaySub}>Select your platforms and only see content available to you.</Text>
                  <TouchableOpacity style={ps.unlockBtn} onPress={() => { setPremium(true); refreshCredits(); }} activeOpacity={0.85}>
                    <LinearGradient colors={['#c0392b', '#e74c3c']} style={ps.unlockGradient}>
                      <Text style={ps.unlockStar}>✦</Text>
                      <Text style={ps.unlockText}>Unlock with Premium</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                  <View style={ps.perks}>
                    {['Filter recommendations by platform', 'Region-aware availability', 'Works across all searches'].map((perk, i) => (
                      <View key={i} style={ps.perkRow}>
                        <View style={ps.perkDot} />
                        <Text style={ps.perkText}>{perk}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            </View>
          )}
          {tab === 'services' && isPremium && (
            <View style={{ gap: 16 }}>
              <View style={s.card}>
                <View style={s.cardHeader}><Ionicons name="tv-outline" size={15} color={colors.red} /><Text style={s.cardTitle}>Your Streaming Services</Text></View>
                <Text style={{ color: colors.subtle, fontSize: 12, marginBottom: 14 }}>Select the platforms you have access to. This filters recommendations and search results.</Text>
                {providersLoading ? (
                  <View style={{ alignItems: 'center', paddingVertical: 24 }}>
                    <ActivityIndicator color={colors.red} />
                  </View>
                ) : (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                    {availableProviders.map(p => {
                      const selected = selectedProviders.includes(p.id);
                      return (
                        <TouchableOpacity key={p.id} onPress={() => toggleProvider(p.id)} activeOpacity={0.7}
                          style={[s.providerCard, selected && s.providerCardActive]}>
                          <Image source={{ uri: p.logo }} style={s.providerLogo} />
                          {selected && <View style={s.providerCheck}><Ionicons name="checkmark" size={10} color={colors.white} /></View>}
                          <Text style={[s.providerName, selected && { color: colors.white }]} numberOfLines={1}>{p.name}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
              {selectedProviders.length > 0 && (
                <TouchableOpacity style={s.saveBtn} onPress={saveProviders} disabled={savingProviders} activeOpacity={0.85}>
                  <LinearGradient colors={['#c0392b', '#e74c3c']} style={s.saveGradient}>
                    {savingProviders ? <ActivityIndicator color={colors.white} size="small" /> : (
                      <><Ionicons name="checkmark-circle" size={16} color={colors.white} /><Text style={s.saveText}>Save ({selectedProviders.length} selected)</Text></>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </View>
          )}
          {tab === 'stats' && isPremium && (() => {
            const tier = getTier(searchCount);
            const { next, needed } = getNextTier(tier);
            const tierMeta = TIER_META[tier];
            const progress = next ? searchCount / needed : 1;
            return (
            <View style={{ gap: 16 }}>
              {/* Tier ring card */}
              <View style={s.card}>
                <View style={{ alignItems: 'center', gap: 10 }}>
                  <TouchableOpacity onPress={() => setShowTierInfo(true)} activeOpacity={0.7}>
                    <ProfileRing tier={tier}>
                      <View style={[s.avatarInner, { width: 60, height: 60 }]}>
                        <Text style={{ color: tierMeta.color, fontSize: 22, fontWeight: '900' }}>{searchCount}</Text>
                      </View>
                    </ProfileRing>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setShowTierInfo(true)} activeOpacity={0.7}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={{ color: tierMeta.color, fontSize: 16, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 }}>{tierMeta.label}</Text>
                      <Ionicons name="information-circle-outline" size={16} color={colors.subtle} />
                    </View>
                  </TouchableOpacity>
                  <Text style={{ color: colors.subtle, fontSize: 12 }}>
                    {next ? `${needed - searchCount} more searches to ${TIER_META[next].label}` : 'Max level reached 🏆'}
                  </Text>
                  <View style={{ width: '100%', height: 6, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 99, overflow: 'hidden' }}>
                    <View style={{ height: '100%', width: `${Math.min(progress * 100, 100)}%`, backgroundColor: tierMeta.color, borderRadius: 99 }} />
                  </View>
                </View>
              </View>
              {/* Top genres grouped bar chart */}
              {topGenresByList.length > 0 && (
                <View style={s.card}>
                  <View style={s.cardHeader}><Ionicons name="bar-chart-outline" size={15} color={colors.red} /><Text style={s.cardTitle}>Top Genres</Text></View>
                  {/* Legend */}
                  <View style={{ flexDirection: 'row', gap: 14, marginBottom: 14 }}>
                    {([['Watched', colors.red], ['Watchlist', colors.gold], ['Favorites', '#ff6b6b']] as const).map(([l, c]) => (
                      <View key={l} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                        <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: c }} />
                        <Text style={{ color: colors.subtle, fontSize: 10, fontWeight: '600' }}>{l}</Text>
                      </View>
                    ))}
                  </View>
                  {topGenresByList.map(g => {
                    const max = topGenresByList[0].total || 1;
                    return (
                      <View key={g.genre} style={{ marginBottom: 12 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                          <Text style={{ color: '#ccc', fontSize: 13, fontWeight: '600' }} numberOfLines={1}>{g.genre}</Text>
                          <Text style={{ color: colors.subtle, fontSize: 11, fontWeight: '600' }}>{g.total}</Text>
                        </View>
                        <View style={{ flexDirection: 'row', height: 6, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 99, overflow: 'hidden' }}>
                          {g.watched > 0 && <View style={{ width: `${(g.watched / max) * 100}%`, backgroundColor: colors.red, height: '100%' }} />}
                          {g.watchlist > 0 && <View style={{ width: `${(g.watchlist / max) * 100}%`, backgroundColor: colors.gold, height: '100%' }} />}
                          {g.favorites > 0 && <View style={{ width: `${(g.favorites / max) * 100}%`, backgroundColor: '#ff6b6b', height: '100%' }} />}
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
              {/* Activity overview */}
              <View style={s.card}>
                <View style={s.cardHeader}><Ionicons name="trending-up-outline" size={15} color={colors.red} /><Text style={s.cardTitle}>Activity Overview</Text></View>
                {[
                  { label: 'Movies Watched', value: watched.length, icon: 'eye-outline', color: colors.red },
                  { label: 'In Watchlist', value: toWatch.length, icon: 'bookmark-outline', color: colors.gold },
                  { label: 'Marked Favorite', value: favs.length, icon: 'heart-outline', color: '#ff6b6b' },
                  { label: 'Rated', value: watched.filter(m => m.rating && m.rating > 0).length, icon: 'star-outline', color: '#a78bfa' },
                ].map(item => (
                  <View key={item.label} style={s.actRow}>
                    <Ionicons name={item.icon as any} size={14} color={item.color} />
                    <Text style={s.actLabel}>{item.label}</Text>
                    <Text style={s.actValue}>{item.value}</Text>
                  </View>
                ))}
                {avgRating !== '—' && (
                  <View style={s.actDivider}>
                    <Ionicons name="star" size={14} color={colors.gold} />
                    <Text style={s.actLabel}>Average Rating</Text>
                    <Text style={[s.actValue, { color: colors.gold }]}>{avgRating}/10</Text>
                  </View>
                )}
              </View>
            </View>
            );
          })()}
        </View>
      </ScrollView>

      <EditProfileModal visible={editVisible} onClose={() => setEditVisible(false)} onSaved={() => {}} />
      <ProfileMovieModal
        movie={selectedMovie}
        onClose={() => setSelectedMovie(null)}
        allMovies={tab === 'watchlist' ? filteredWl : tab === 'favorites' ? filteredFav : filtered}
        currentIndex={selectedMovie ? (tab === 'watchlist' ? filteredWl : tab === 'favorites' ? filteredFav : filtered).findIndex(m => m.movieId === selectedMovie.movieId) : 0}
        onChangeIndex={(i) => { const list = tab === 'watchlist' ? filteredWl : tab === 'favorites' ? filteredFav : filtered; setSelectedMovie(list[i] || null); }}
      />

      {/* Tier Info Modal */}
      <Modal visible={showTierInfo} transparent animationType="fade" onRequestClose={() => setShowTierInfo(false)}>
        <TouchableOpacity style={s.tierOverlay} activeOpacity={1} onPress={() => setShowTierInfo(false)}>
          <View style={s.tierModal}>
            <View style={s.tierModalHeader}>
              <Text style={s.tierModalTitle}>Tier Levels</Text>
              <TouchableOpacity onPress={() => setShowTierInfo(false)}>
                <Ionicons name="close" size={20} color={colors.muted} />
              </TouchableOpacity>
            </View>
            <Text style={s.tierModalSub}>Earn tiers by searching with AI</Text>
            {(['spectator', 'cinephile', 'critic', 'director'] as Tier[]).map((t) => {
              const meta = TIER_META[t];
              const current = getTier(searchCount) === t;
              return (
                <View key={t} style={[s.tierInfoRow, current && s.tierInfoRowActive]}>
                  <ProfileRing tier={t} size="small">
                    <View style={[s.tierInfoAvatar, { borderColor: meta.color }]}>
                      <Text style={{ color: meta.color, fontSize: 12, fontWeight: '900' }}>{meta.min}</Text>
                    </View>
                  </ProfileRing>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={[s.tierInfoName, { color: meta.color }]}>{meta.label}</Text>
                      {current && <View style={[s.tierInfoBadge, { backgroundColor: meta.color }]}><Text style={s.tierInfoBadgeText}>YOU</Text></View>}
                    </View>
                    <Text style={s.tierInfoReq}>{meta.min === 0 ? 'Starting tier' : `${meta.min}+ AI searches`}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.black },
  topBar: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(229,9,20,0.15)', borderWidth: 1, borderColor: 'rgba(229,9,20,0.3)', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  editBtnText: { color: colors.red, fontSize: 13, fontWeight: '600' },
  signOutBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  signOutText: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  // Header card
  // Header card
  headerCard: { marginHorizontal: 16, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(255,255,255,0.02)', marginBottom: 16 },
  banner: { height: 50 },
  headerBody: { padding: 16, marginTop: -30 },
  avatarRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, marginBottom: 16 },
  avatarInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(229,9,20,0.2)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  tierRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  tierDot: { width: 6, height: 6, borderRadius: 3 },
  tierLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  tierDesc: { color: colors.subtle, fontSize: 10, marginTop: 2 },
  avatarText: { color: colors.white, fontSize: 32, fontWeight: '900' },
  displayName: { color: colors.white, fontSize: 20, fontWeight: '900' },
  email: { color: colors.subtle, fontSize: 12, marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: 6 },
  statCard: { flex: 1, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 2, alignItems: 'center', gap: 2 },
  statNum: { color: colors.white, fontSize: 17, fontWeight: '900' },
  statLabel: { color: colors.subtle, fontSize: 8, fontWeight: '600', textTransform: 'uppercase', textAlign: 'center' },
  // Tabs
  tabRow: { flexDirection: 'row', paddingHorizontal: 12, gap: 0, marginBottom: 16 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, paddingVertical: 8, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: colors.red },
  tabText: { color: colors.subtle, fontSize: 10, fontWeight: '600' },
  tabTextActive: { color: colors.white, fontWeight: '700' },
  crownBadge: { position: 'absolute', top: -6, right: -8, fontSize: 7 },
  tabBadge: { backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 99, paddingHorizontal: 5, paddingVertical: 1 },
  tabBadgeActive: { backgroundColor: 'rgba(229,9,20,0.2)', borderColor: 'rgba(229,9,20,0.35)' },
  tabBadgeText: { color: colors.subtle, fontSize: 10, fontWeight: '700' },
  // Content
  content: { paddingHorizontal: 16, zIndex: 1 },
  // Filter bar
  filterBar: { gap: 8, marginBottom: 10 },
  searchWrap: { position: 'relative' },
  searchInput: { backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 8, padding: 10, paddingLeft: 34, fontSize: 13, color: colors.text },
  filterActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sortBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  sortLabel: { color: colors.subtle, fontSize: 11, fontWeight: '600' },
  sortText: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  sortDropdown: { position: 'absolute', top: 42, left: 0, zIndex: 999, backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', borderRadius: 10, paddingVertical: 4, minWidth: 150, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 8 },
  sortDropItem: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10 },
  sortDropItemActive: { backgroundColor: 'rgba(229,9,20,0.08)' },
  sortDropText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  viewToggle: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 8, padding: 3 },
  viewBtn: { padding: 6, borderRadius: 5 },
  viewBtnActive: { backgroundColor: 'rgba(229,9,20,0.2)' },
  genreDropdown: { position: 'absolute', top: 42, right: 0, zIndex: 998, backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', borderRadius: 10, paddingVertical: 4, minWidth: 160, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 8 },
  countText: { color: colors.subtle, fontSize: 12, fontWeight: '600', marginBottom: 10, textAlign: 'right' },
  // Mini grid card
  miniCard: { width: GRID_W, borderRadius: 10, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  miniPoster: { width: '100%', height: GRID_W * 1.5, resizeMode: 'cover' },
  noPoster: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  miniInfo: { padding: 8 },
  miniTitle: { color: colors.white, fontSize: 12, fontWeight: '700' },
  miniMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 3 },
  miniYear: { color: colors.subtle, fontSize: 11 },
  miniRating: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  miniRatingText: { color: colors.gold, fontSize: 11, fontWeight: '700' },
  // List card
  listCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, backgroundColor: 'rgba(255,255,255,0.02)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', borderRadius: 10 },
  listPoster: { width: 44, height: 62, borderRadius: 6, overflow: 'hidden', backgroundColor: colors.surface },
  listTitle: { color: colors.white, fontSize: 14, fontWeight: '700' },
  tinyGenre: { backgroundColor: 'rgba(229,9,20,0.12)', borderWidth: 1, borderColor: 'rgba(229,9,20,0.3)', borderRadius: 99, paddingHorizontal: 6, paddingVertical: 1 },
  tinyGenreText: { color: '#ff6b6b', fontSize: 9, fontWeight: '700', textTransform: 'uppercase' },
  // Empty
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48, backgroundColor: 'rgba(255,255,255,0.02)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', borderRadius: 16 },
  emptyText: { color: colors.subtle, fontSize: 14, fontWeight: '600', marginTop: 12 },
  // Stats cards
  card: { backgroundColor: 'rgba(255,255,255,0.02)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', borderRadius: 12, padding: 16 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  cardTitle: { color: colors.white, fontSize: 15, fontWeight: '700' },
  // Genre bar chart
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  barLabel: { color: '#ccc', fontSize: 13, fontWeight: '600', width: 90 },
  barTrack: { flex: 1, height: 6, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 99, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: colors.red, borderRadius: 99 },
  barCount: { color: colors.subtle, fontSize: 12, fontWeight: '600', width: 24, textAlign: 'right' },
  // Activity overview
  actRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  actLabel: { color: colors.muted, fontSize: 13, flex: 1 },
  actValue: { color: colors.white, fontSize: 16, fontWeight: '800' },
  actDivider: { flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', paddingTop: 12, marginTop: 4 },
  // Tier info modal
  tierOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  tierModal: { width: '100%', backgroundColor: '#1a1a1a', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', padding: 20 },
  tierModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  tierModalTitle: { color: colors.white, fontSize: 18, fontWeight: '800' },
  tierModalSub: { color: colors.subtle, fontSize: 12, marginBottom: 16 },
  tierInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  tierInfoRowActive: { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 10, paddingHorizontal: 8, marginHorizontal: -8 },
  tierInfoAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center' },
  tierInfoName: { fontSize: 14, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  tierInfoReq: { color: colors.subtle, fontSize: 11, marginTop: 1 },
  tierInfoBadge: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1 },
  tierInfoBadgeText: { color: colors.white, fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  // Streaming providers
  providerCard: { width: 68, alignItems: 'center', gap: 4, padding: 6, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(255,255,255,0.02)', position: 'relative' },
  providerCardActive: { borderColor: 'rgba(229,9,20,0.5)', backgroundColor: 'rgba(229,9,20,0.1)' },
  providerLogo: { width: 36, height: 36, borderRadius: 8 },
  providerCheck: { position: 'absolute', top: 3, right: 3, width: 16, height: 16, borderRadius: 8, backgroundColor: colors.red, alignItems: 'center', justifyContent: 'center' },
  providerName: { color: colors.subtle, fontSize: 8, fontWeight: '600', textAlign: 'center' },
  saveBtn: { borderRadius: 12, overflow: 'hidden' },
  saveGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14 },
  saveText: { color: colors.white, fontSize: 14, fontWeight: '700' },
  paginationRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 16, flexWrap: 'wrap' },
  pageBtn: { width: 36, height: 36, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  pageBtnActive: { backgroundColor: colors.red, borderColor: colors.red },
  pageBtnText: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  pageBtnTextActive: { color: colors.white },
});

const ps = StyleSheet.create({
  wrapper: { flex: 1 },
  gridContainer: { position: 'relative', overflow: 'hidden', borderRadius: 14 },

  overlay: {
    position: 'absolute', inset: 0, backgroundColor: 'rgba(13,2,4,0.80)',
    borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 16, paddingHorizontal: 20, gap: 10,
  },
  lockCircle: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(229,9,20,0.12)',
    borderWidth: 1.5, borderColor: 'rgba(229,9,20,0.45)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 2,
  },
  overlayTitle: { fontSize: 16, fontWeight: '700', color: '#fff', textAlign: 'center', lineHeight: 22 },
  overlaySub: { fontSize: 12, color: 'rgba(255,255,255,0.42)', textAlign: 'center', lineHeight: 18, maxWidth: 230 },
  unlockBtn: { borderRadius: 12, overflow: 'hidden', marginTop: 4 },
  unlockGradient: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 24, paddingVertical: 12 },
  unlockStar: { color: '#fff', fontSize: 12 },
  unlockText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  perks: { gap: 6, marginTop: 4, alignSelf: 'flex-start', paddingLeft: 16 },
  perkRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  perkDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: 'rgba(229,9,20,0.7)' },
  perkText: { color: 'rgba(255,255,255,0.45)', fontSize: 11 },
});
