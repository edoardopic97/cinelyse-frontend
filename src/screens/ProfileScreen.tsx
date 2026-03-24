import React, { useEffect, useState, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Image, Alert,
  TextInput, FlatList, Dimensions, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { getGenreColor } from '../theme/genreColors';
import { useAuth } from '../contexts/AuthContext';
import { subscribeToAllMovies, getUserStats, getSearchCount, getFriends, type MovieActivity } from '../lib/firestore';
import { sortMovies, filterByGenre, searchByTitle, getUniqueGenres } from '../lib/movieUtils';
import EditProfileModal from '../components/EditProfileModal';
import ProfileMovieModal from '../components/ProfileMovieModal';
import ProfileRing, { getTier, getNextTier, TIER_META, type Tier } from '../components/ProfileRing';

const { width: SW } = Dimensions.get('window');
const GRID_COLS = 3;
const GRID_GAP = 8;
const GRID_W = (SW - 32 - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS;

type Tab = 'watched' | 'watchlist' | 'favorites' | 'stats';
type Sort = 'date' | 'rating' | 'title';
type ViewMode = 'grid' | 'list';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, profile, logout } = useAuth();
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

  const tabs: { id: Tab; label: string; icon: string; count: number | null }[] = [
    { id: 'watched', label: 'Watched', icon: 'eye-outline', count: watched.length },
    { id: 'watchlist', label: 'Watchlist', icon: 'bookmark-outline', count: toWatch.length },
    { id: 'favorites', label: 'Favorites', icon: 'heart-outline', count: favs.length },
    { id: 'stats', label: 'Stats', icon: 'bar-chart-outline', count: null },
  ];

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
            <TouchableOpacity style={s.sortBtn} onPress={() => setShowSortDrop(!showSortDrop)}>
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
          <View style={s.viewToggle}>
            <TouchableOpacity style={[s.viewBtn, opts.viewMode === 'grid' && s.viewBtnActive]} onPress={() => opts.setViewMode('grid')}><Ionicons name="grid-outline" size={14} color={opts.viewMode === 'grid' ? colors.red : colors.subtle} /></TouchableOpacity>
            <TouchableOpacity style={[s.viewBtn, opts.viewMode === 'list' && s.viewBtnActive]} onPress={() => opts.setViewMode('list')}><Ionicons name="list-outline" size={14} color={opts.viewMode === 'list' ? colors.red : colors.subtle} /></TouchableOpacity>
          </View>
        </View>
      </View>
      {opts.genres.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.genreScroll}>
          <TouchableOpacity style={[s.genrePill, opts.genre === 'all' && s.genrePillActive]} onPress={() => opts.setGenre('all')}><Text style={[s.genrePillText, opts.genre === 'all' && s.genrePillTextActive]}>All</Text></TouchableOpacity>
          {opts.genres.map(g => <TouchableOpacity key={g} style={[s.genrePill, opts.genre === g && s.genrePillActive]} onPress={() => opts.setGenre(g)}><Text style={[s.genrePillText, opts.genre === g && s.genrePillTextActive]}>{g}</Text></TouchableOpacity>)}
        </ScrollView>
      )}
      <Text style={s.countText}>{opts.count} film{opts.count !== 1 ? 's' : ''}</Text>
    </>
  );

  const activeViewMode = tab === 'watchlist' ? wlViewMode : tab === 'favorites' ? favViewMode : viewMode;
  const activeSearch = tab === 'watchlist' ? wlSearch : tab === 'favorites' ? favSearch : search;
  const activeGenre = tab === 'watchlist' ? wlGenre : tab === 'favorites' ? favGenre : genre;

  const renderMovieList = (movies: MovieActivity[]) => {
    if (!movies.length) return (
      <View style={s.empty}>
        <Ionicons name={tab === 'watchlist' ? 'bookmark-outline' : tab === 'favorites' ? 'heart-outline' : 'eye-outline'} size={40} color="rgba(255,255,255,0.1)" />
        <Text style={s.emptyText}>{tab === 'watched' ? (activeSearch || activeGenre !== 'all' ? 'No movies match your filters.' : 'No movies watched yet.') : tab === 'watchlist' ? (activeSearch || activeGenre !== 'all' ? 'No movies match your filters.' : 'Your watchlist is empty.') : (activeSearch || activeGenre !== 'all' ? 'No movies match your filters.' : 'No favorites yet.')}</Text>
      </View>
    );
    if (activeViewMode === 'list') return <View style={{ gap: 8 }}>{movies.map(renderMiniList)}</View>;
    const rows: MovieActivity[][] = [];
    for (let i = 0; i < movies.length; i += GRID_COLS) rows.push(movies.slice(i, i + GRID_COLS));
    return <View style={{ gap: GRID_GAP }}>{rows.map((row, ri) => <View key={ri} style={{ flexDirection: 'row', gap: GRID_GAP }}>{row.map(renderMiniGrid)}</View>)}</View>;
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
            <TouchableOpacity key={t.id} style={[s.tab, tab === t.id && s.tabActive]} onPress={() => { setTab(t.id); setShowSortDrop(false); }}>
              <Ionicons name={t.icon as any} size={16} color={tab === t.id ? colors.white : colors.subtle} />
              <Text style={[s.tabText, tab === t.id && s.tabTextActive]}>{t.label}</Text>

            </TouchableOpacity>
          ))}
        </View>

        {/* Tab content */}
        <View style={s.content}>
          {tab === 'watched' && (
            <>
              {renderFilterBar({ search, setSearch, sort, setSort, genre, setGenre, viewMode, setViewMode, genres, count: filtered.length, placeholder: 'Search watched…' })}
              {renderMovieList(filtered)}
            </>
          )}
          {tab === 'watchlist' && (
            <>
              {renderFilterBar({ search: wlSearch, setSearch: setWlSearch, sort: wlSort, setSort: setWlSort, genre: wlGenre, setGenre: setWlGenre, viewMode: wlViewMode, setViewMode: setWlViewMode, genres: wlGenres, count: filteredWl.length, placeholder: 'Search watchlist…' })}
              {renderMovieList(filteredWl)}
            </>
          )}
          {tab === 'favorites' && (
            <>
              {renderFilterBar({ search: favSearch, setSearch: setFavSearch, sort: favSort, setSort: setFavSort, genre: favGenre, setGenre: setFavGenre, viewMode: favViewMode, setViewMode: setFavViewMode, genres: favGenres, count: filteredFav.length, placeholder: 'Search favorites…' })}
              {renderMovieList(filteredFav)}
            </>
          )}
          {tab === 'stats' && (() => {
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
      <ProfileMovieModal movie={selectedMovie} onClose={() => setSelectedMovie(null)} />

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
  banner: { height: 100 },
  headerBody: { padding: 16, marginTop: -40 },
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
  tabRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 2, marginBottom: 16 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: colors.red },
  tabText: { color: colors.subtle, fontSize: 11, fontWeight: '600' },
  tabTextActive: { color: colors.white, fontWeight: '700' },
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
  genreScroll: { gap: 6, marginBottom: 10 },
  genrePill: { backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 99, paddingHorizontal: 12, paddingVertical: 6 },
  genrePillActive: { borderColor: colors.red, backgroundColor: 'rgba(229,9,20,0.15)' },
  genrePillText: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  genrePillTextActive: { color: colors.red },
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
});
