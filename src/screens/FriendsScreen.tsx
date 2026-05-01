import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList,
  ActivityIndicator, Alert, Image, Modal, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Contacts from 'expo-contacts';
import { colors } from '../theme/colors';
import { getFriendlyError } from '../utils/errorMessages';
import t from '../i18n';
import { getGenreColor } from '../theme/genreColors';
import { useAuth } from '../contexts/AuthContext';
import {
  getFriendRequests, subscribeToFriendRequests, acceptFriendRequest, rejectFriendRequest,
  getEnrichedFriends, getUserProfile, searchUserByUsername, sendFriendRequest,
  areFriends, hasPendingRequest, getUserStats, getMovieList,
  findUsersByEmails, getSearchCount, getFriends,
  type FriendRequest, type UserProfile, type MovieActivity, type FriendSummary,
} from '../lib/firestore';
import { getUniqueGenres, filterByGenre } from '../lib/movieUtils';
import ProfileRing, { getTier, TIER_META } from '../components/ProfileRing';
import ProfileMovieModal from '../components/ProfileMovieModal';

type Tab = 'friends' | 'requests';

export default function FriendsScreen() {
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuth();
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [friends, setFriends] = useState<FriendSummary[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState<any>(null);
  const [isFriend, setIsFriend] = useState(false);
  const [hasPending, setHasPending] = useState(false);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('friends');
  const [selectedFriend, setSelectedFriend] = useState<FriendSummary | null>(null);
  const [friendStats, setFriendStats] = useState<any>(null);
  const [friendFavs, setFriendFavs] = useState<MovieActivity[]>([]);
  const [friendWatched, setFriendWatched] = useState<MovieActivity[]>([]);
  const [friendWatchlist, setFriendWatchlist] = useState<MovieActivity[]>([]);
  const [profileLoading, setProfileLoading] = useState(false);
  const [friendTab, setFriendTab] = useState<'watched' | 'watchlist' | 'favorites'>('watched');
  const [friendSearchCounts, setFriendSearchCounts] = useState<Record<string, number>>({});
  const [friendModalSearchCount, setFriendModalSearchCount] = useState(0);
  const [friendFriendsCount, setFriendFriendsCount] = useState(0);
  const [selectedFriendMovie, setSelectedFriendMovie] = useState<MovieActivity | null>(null);
  const [friendListLoading, setFriendListLoading] = useState(false);
  const [friendPage, setFriendPage] = useState<Record<string, number>>({ watched: 1, watchlist: 1, favorites: 1 });
  const [friendGenre, setFriendGenre] = useState('all');
  const [showFriendGenreDrop, setShowFriendGenreDrop] = useState(false);

  // Suggested friends state
  const [suggestedVisible, setSuggestedVisible] = useState(false);
  const [suggestedUsers, setSuggestedUsers] = useState<(UserProfile & { _status: 'add' | 'pending' | 'friend' })[]>([]);
  const [suggestedLoading, setSuggestedLoading] = useState(false);
  const [sendingTo, setSendingTo] = useState<string | null>(null);

  const PAGE_SIZE = 18;

  const getPagedMovies = (tab: 'watched' | 'watchlist' | 'favorites') => {
    const all = tab === 'watched' ? friendWatched : tab === 'watchlist' ? friendWatchlist : friendFavs;
    const page = friendPage[tab] || 1;
    return all.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  };

  const getTotalPages = (tab: 'watched' | 'watchlist' | 'favorites') => {
    const all = tab === 'watched' ? friendWatched : tab === 'watchlist' ? friendWatchlist : friendFavs;
    return Math.max(1, Math.ceil(all.length / PAGE_SIZE));
  };

  const openFriendProfile = async (friend: FriendSummary) => {
    setSelectedFriend(friend);
    setFriendTab('watched');
    setProfileLoading(true);
    setFriendModalSearchCount(friend.totalSearches);
    setFriendFriendsCount(0);
    setFriendWatched([]);
    setFriendWatchlist([]);
    setFriendFavs([]);
    setFriendPage({ watched: 1, watchlist: 1, favorites: 1 });
    try {
      const [stats, fc, watchedAll, watchlistAll, favsAll] = await Promise.all([
        getUserStats(friend.userId),
        getFriends(friend.userId),
        getMovieList(friend.userId, 'watched'),
        getMovieList(friend.userId, 'toWatch'),
        getMovieList(friend.userId, 'favorite'),
      ]);
      setFriendStats(stats);
      setFriendFriendsCount(fc.length);
      const sortByDate = (a: MovieActivity, b: MovieActivity) => (b.updatedAt?.toMillis?.() ?? 0) - (a.updatedAt?.toMillis?.() ?? 0);
      setFriendWatched(watchedAll.sort(sortByDate));
      setFriendWatchlist(watchlistAll.sort(sortByDate));
      setFriendFavs(favsAll.sort(sortByDate));
    } catch (e) { console.warn('Friend profile load error:', e); } finally { setProfileLoading(false); }
  };

  // Real-time listener for friend requests
  useEffect(() => {
    if (!user?.uid) return;
    const unsub = subscribeToFriendRequests(user.uid, setRequests);
    return () => unsub();
  }, [user?.uid]);

  const loadData = async () => {
    if (!user?.uid) return;
    setLoading(true);
    try {
      const enriched = await getEnrichedFriends(user.uid);
      setFriends(enriched);
      const counts: Record<string, number> = {};
      enriched.forEach(f => { counts[f.userId] = f.totalSearches; });
      setFriendSearchCounts(counts);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, [user?.uid]);

  const handleSuggestedFriends = async () => {
    if (!user?.uid) return;
    const { status } = await Contacts.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'We need contacts access to find your friends.');
      return;
    }
    setSuggestedVisible(true);
    setSuggestedLoading(true);
    setSuggestedUsers([]);
    try {
      const { data } = await Contacts.getContactsAsync({ fields: [Contacts.Fields.Emails] });
      const emails = new Set<string>();
      data.forEach(c => {
        c.emails?.forEach(e => { if (e.email) emails.add(e.email.toLowerCase()); });
      });
      emails.delete((user.email || '').toLowerCase());

      const found = await findUsersByEmails([...emails], user.uid);

      const friendIds = await getFriends(user.uid);
      const friendSet = new Set(friendIds);

      const withStatus = await Promise.all(found.map(async (u) => {
        if (friendSet.has(u.uid)) return { ...u, _status: 'friend' as const };
        const pending = await hasPendingRequest(user.uid, u.uid);
        return { ...u, _status: pending ? 'pending' as const : 'add' as const };
      }));

      setSuggestedUsers(withStatus);
    } catch (e: any) {
      Alert.alert('Error', getFriendlyError(e, 'Failed to load suggestions.'));
    } finally { setSuggestedLoading(false); }
  };

  const handleSuggestedAdd = async (target: UserProfile) => {
    if (!user?.uid) return;
    setSendingTo(target.uid);
    try {
      await sendFriendRequest(user.uid, profile?.displayName || 'User', target.uid);
      setSuggestedUsers(prev => prev.map(u => u.uid === target.uid ? { ...u, _status: 'pending' } : u));
    } catch (e: any) {
      Alert.alert('Error', getFriendlyError(e, 'Failed to send request.'));
    } finally { setSendingTo(null); }
  };

  const [accepting, setAccepting] = useState<string | null>(null);

  const handleAccept = async (req: FriendRequest) => {
    if (accepting) return;
    setAccepting(req.id);
    setRequests(prev => prev.filter(r => r.id !== req.id));
    try {
      await acceptFriendRequest(user!.uid, req.id, req.fromUserId);
      await loadData();
      setTab('friends');
    } finally {
      setAccepting(null);
    }
  };

  const handleReject = async (req: FriendRequest) => {
    setRequests(prev => prev.filter(r => r.id !== req.id));
    await rejectFriendRequest(user!.uid, req.id);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim() || !user?.uid) return;
    setSearching(true);
    setSearchResult(null);
    try {
      const found = await searchUserByUsername(searchQuery.trim());
      if (!found) { Alert.alert('Not Found', 'No user with that username.'); return; }
      if (found.uid === user.uid) { Alert.alert('Error', "That's you!"); return; }
      setSearchResult(found);
      const [friendStatus, pendingStatus] = await Promise.all([
        areFriends(user.uid, found.uid),
        hasPendingRequest(user.uid, found.uid),
      ]);
      setIsFriend(friendStatus);
      setHasPending(pendingStatus);
    } catch (err: any) {
      Alert.alert('Error', getFriendlyError(err, 'Search failed. Please try again.'));
    } finally { setSearching(false); }
  };

  const handleSendRequest = async () => {
    if (!user?.uid || !searchResult) return;
    setSearching(true);
    try {
      await sendFriendRequest(user.uid, profile?.displayName || 'User', searchResult.uid);
      setHasPending(true);
      Alert.alert('Sent!', `Friend request sent to ${searchResult.displayName}`);
    } catch (err: any) {
      Alert.alert('Error', getFriendlyError(err, 'Failed to send request.'));
    } finally { setSearching(false); }
  };

  const tabs = [
    { id: 'friends' as Tab, label: 'My Friends', icon: 'people-outline', count: friends.length },
    { id: 'requests' as Tab, label: 'Requests', icon: 'notifications-outline', count: requests.length },
  ];

  return (
    <View style={[s.container, { paddingTop: insets.top + 16 }]}>
      <Text style={s.title}>Friends</Text>
      <Text style={s.subtitle}>Connect with other movie lovers</Text>

      {/* Search */}
      <View style={s.searchCard}>
        <Text style={s.searchLabel}>FIND PEOPLE</Text>
        <View style={s.searchRow}>
          <View style={{ flex: 1, position: 'relative' }}>
            <Ionicons name="search" size={14} color={colors.subtle} style={{ position: 'absolute', left: 12, top: 13, zIndex: 1 }} />
            <TextInput
              style={s.input}
              placeholder="Search by username…"
              placeholderTextColor={colors.subtle}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
            />
          </View>
          <TouchableOpacity style={s.searchBtn} onPress={handleSearch} disabled={searching || !searchQuery.trim()}>
            {searching ? <ActivityIndicator color={colors.white} size="small" /> : <Text style={s.searchBtnText}>Search</Text>}
          </TouchableOpacity>
        </View>

        {/* Search result */}
        {searchResult && (
          <View style={s.resultCard}>
            <View style={s.avatar}>
              {searchResult.photoURL && !searchResult.photoURL.startsWith('http')
                ? <Text style={{ fontSize: 22 }}>{searchResult.photoURL}</Text>
                : searchResult.photoURL?.startsWith('http')
                  ? <Image source={{ uri: searchResult.photoURL }} style={{ width: '100%', height: '100%', borderRadius: 12 }} />
                  : <Text style={s.avatarText}>{(searchResult.displayName || 'U').charAt(0).toUpperCase()}</Text>}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.name}>{searchResult.displayName}</Text>
              <Text style={s.sub}>View profile</Text>
            </View>
            {isFriend ? (
              <View style={s.friendBadge}><Ionicons name="checkmark" size={13} color="#4ade80" /><Text style={s.friendBadgeText}>Friends</Text></View>
            ) : hasPending ? (
              <View style={s.pendingBadge}><Text style={s.pendingText}>Sent ✓</Text></View>
            ) : (
              <TouchableOpacity style={s.addBtn} onPress={handleSendRequest} disabled={searching}>
                <Ionicons name="person-add" size={13} color={colors.white} /><Text style={s.addBtnText}>Add</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {/* Suggested Friends */}
      <TouchableOpacity style={s.suggestedBtn} onPress={handleSuggestedFriends} activeOpacity={0.7}>
        <Ionicons name="people-circle-outline" size={18} color={colors.red} />
        <Text style={s.suggestedBtnText}>Suggested Friends</Text>
        <Ionicons name="chevron-forward" size={14} color={colors.subtle} />
      </TouchableOpacity>

      {/* Tabs */}
      <View style={s.tabRow}>
        {tabs.map(t => (
          <TouchableOpacity key={t.id} style={[s.tab, tab === t.id && s.tabActive]} onPress={() => setTab(t.id)}>
            <Ionicons name={t.icon as any} size={14} color={tab === t.id ? colors.white : colors.subtle} />
            <Text style={[s.tabText, tab === t.id && s.tabTextActive]}>{t.label}</Text>
            {t.count > 0 && (
              <View style={[s.tabBadge, t.id === 'requests' && { backgroundColor: colors.red, borderColor: 'transparent' }]}>
                <Text style={[s.tabBadgeText, t.id === 'requests' && { color: colors.white }]}>{t.count}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {loading ? <ActivityIndicator color={colors.red} style={{ marginTop: 40 }} /> : (
        <FlatList
          data={tab === 'friends' ? friends : requests}
          keyExtractor={(item, i) => (tab === 'friends' ? (item as FriendSummary)?.userId || i.toString() : (item as FriendRequest)?.id || i.toString())}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 140 }}
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name={tab === 'friends' ? 'people-outline' : 'notifications-outline'} size={40} color="rgba(255,255,255,0.1)" />
              <Text style={s.emptyText}>{tab === 'friends' ? 'No friends yet.' : 'No pending requests.'}</Text>
              <Text style={s.emptySub}>{tab === 'friends' ? 'Search for users above to start connecting.' : 'When someone sends you a request, it\'ll appear here.'}</Text>
            </View>
          }
          renderItem={({ item }) => {
            if (tab === 'requests') {
              const req = item as FriendRequest;
              return (
                <View style={s.requestCard}>
                  <View style={s.avatar}><Text style={{ fontSize: 22 }}>{req.fromUsername.charAt(0).toUpperCase()}</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.name}>{req.fromUsername}</Text>
                    <Text style={s.sub}>Wants to connect with you</Text>
                  </View>
                  <TouchableOpacity style={s.acceptBtn} onPress={() => handleAccept(req)}>
                    <Ionicons name="checkmark" size={16} color="#4ade80" /><Text style={{ color: '#4ade80', fontSize: 12, fontWeight: '700' }}>Accept</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.rejectBtn} onPress={() => handleReject(req)}>
                    <Ionicons name="close" size={16} color={colors.muted} />
                  </TouchableOpacity>
                </View>
              );
            }
            const friend = item as FriendSummary;
            const isEmoji = friend?.photoURL && !friend.photoURL.startsWith('http');
            const isUrl = friend?.photoURL && friend.photoURL.startsWith('http');
            return (
              <TouchableOpacity style={s.friendCard} activeOpacity={0.7} onPress={() => openFriendProfile(friend)}>
                <ProfileRing tier={getTier(friendSearchCounts[friend.userId] || 0)} size="small">
                  <View style={s.avatarSmall}>
                    {isUrl ? <Image source={{ uri: friend.photoURL }} style={{ width: '100%', height: '100%', borderRadius: 16 }} />
                      : isEmoji ? <Text style={{ fontSize: 16 }}>{friend.photoURL}</Text>
                      : <Text style={s.avatarSmallText}>{(friend?.displayName || '?').charAt(0).toUpperCase()}</Text>}
                  </View>
                </ProfileRing>
                <View style={{ flex: 1 }}>
                  <Text style={s.name}>{friend?.displayName || 'User'}</Text>
                  <Text style={s.sub}>View profile →</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.subtle} />
              </TouchableOpacity>
            );
          }}
        />
      )}
      {/* Suggested Friends Modal */}
      <Modal visible={suggestedVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSuggestedVisible(false)}>
        <SafeAreaView style={s.modalContainer} edges={['top', 'bottom']}>
          <View style={s.modalHeader}>
            <TouchableOpacity onPress={() => setSuggestedVisible(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={s.modalTitle}>Suggested Friends</Text>
            <View style={{ width: 24 }} />
          </View>
          {suggestedLoading ? (
            <ActivityIndicator color={colors.red} style={{ marginTop: 60 }} />
          ) : suggestedUsers.length === 0 ? (
            <View style={s.empty}>
              <Ionicons name="people-outline" size={40} color="rgba(255,255,255,0.1)" />
              <Text style={s.emptyText}>No matches found</Text>
              <Text style={s.emptySub}>None of your contacts are on CINELYSE yet.</Text>
            </View>
          ) : (
            <FlatList
              data={suggestedUsers}
              keyExtractor={item => item.uid}
              contentContainerStyle={{ padding: 16 }}
              renderItem={({ item }) => (
                <View style={s.friendCard}>
                  <View style={s.avatar}>
                    {item.photoURL?.startsWith('http')
                      ? <Image source={{ uri: item.photoURL }} style={{ width: '100%', height: '100%', borderRadius: 12 }} />
                      : item.photoURL && !item.photoURL.startsWith('http')
                        ? <Text style={{ fontSize: 22 }}>{item.photoURL}</Text>
                        : <Text style={s.avatarText}>{(item.displayName || '?').charAt(0).toUpperCase()}</Text>}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.name}>{item.displayName || 'User'}</Text>
                    <Text style={s.sub}>From your contacts</Text>
                  </View>
                  {item._status === 'friend' ? (
                    <View style={s.friendBadge}><Ionicons name="checkmark" size={13} color="#4ade80" /><Text style={s.friendBadgeText}>Friends</Text></View>
                  ) : item._status === 'pending' ? (
                    <View style={s.pendingBadge}><Text style={s.pendingText}>Sent ✓</Text></View>
                  ) : (
                    <TouchableOpacity style={s.addBtn} onPress={() => handleSuggestedAdd(item)} disabled={sendingTo === item.uid}>
                      {sendingTo === item.uid
                        ? <ActivityIndicator color={colors.white} size="small" />
                        : <><Ionicons name="person-add" size={13} color={colors.white} /><Text style={s.addBtnText}>Add</Text></>}
                    </TouchableOpacity>
                  )}
                </View>
              )}
            />
          )}
        </SafeAreaView>
      </Modal>

      {/* Friend Profile Modal */}
      <Modal visible={!!selectedFriend} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSelectedFriend(null)}>
        <SafeAreaView style={s.modalContainer} edges={['top', 'bottom']}>
          <View style={s.modalHeader}>
            <TouchableOpacity onPress={() => setSelectedFriend(null)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={s.modalTitle}>Profile</Text>
            <View style={{ width: 24 }} />
          </View>
          {profileLoading ? (
            <ActivityIndicator color={colors.red} style={{ marginTop: 60 }} />
          ) : selectedFriend && (
            <ScrollView contentContainerStyle={s.modalContent}>
              <ProfileRing tier={getTier(friendModalSearchCount)} size="medium">
                <View style={s.profileAvatarInner}>
                  {selectedFriend.photoURL?.startsWith('http')
                    ? <Image source={{ uri: selectedFriend.photoURL }} style={{ width: '100%', height: '100%', borderRadius: 30 }} />
                    : selectedFriend.photoURL && !selectedFriend.photoURL.startsWith('http')
                      ? <Text style={{ fontSize: 28 }}>{selectedFriend.photoURL}</Text>
                      : <Text style={s.profileAvatarText}>{(selectedFriend.displayName || '?').charAt(0).toUpperCase()}</Text>}
                </View>
              </ProfileRing>
              <Text style={s.profileName}>{selectedFriend.displayName || 'User'}</Text>
              <View style={s.tierRow}>
                <View style={[s.tierDot, { backgroundColor: TIER_META[getTier(friendModalSearchCount)].color }]} />
                <Text style={[s.tierLabel, { color: TIER_META[getTier(friendModalSearchCount)].color }]}>{TIER_META[getTier(friendModalSearchCount)].label}</Text>
                <Text style={s.tierCount}>{friendModalSearchCount} {friendModalSearchCount !== 1 ? t.searches : t.search}</Text>
              </View>

              {friendStats && (
                <>
                  <View style={s.statsRow}>
                    <View style={s.statBox}>
                      <Text style={s.statNum}>{friendStats.totalWatched}</Text>
                      <Text style={s.statLabel}>Watched</Text>
                    </View>
                    <View style={s.statBox}>
                      <Text style={s.statNum}>{friendStats.totalToWatch}</Text>
                      <Text style={s.statLabel}>Watchlist</Text>
                    </View>
                    <View style={s.statBox}>
                      <Text style={s.statNum}>{friendStats.totalFavorites}</Text>
                      <Text style={s.statLabel}>Favorites</Text>
                    </View>
                    <View style={s.statBox}>
                      <Text style={s.statNum}>{friendFriendsCount}</Text>
                      <Text style={s.statLabel}>Friends</Text>
                    </View>
                    <View style={s.statBox}>
                      <Text style={s.statNum}>{friendStats.averageRating || '—'}</Text>
                      <Text style={s.statLabel}>Avg</Text>
                    </View>
                  </View>

                  {friendStats.topGenres.length > 0 && (
                    <View style={s.genreSection}>
                      <Text style={s.sectionLabel}>TOP GENRES</Text>
                      <View style={s.genreRow}>
                        {friendStats.topGenres.map((g: string, i: number) => {
                          const c = getGenreColor(g);
                          return <View key={i} style={[s.genrePill, { backgroundColor: c.bg, borderColor: c.border }]}><Text style={[s.genreText, { color: c.text }]}>{g}</Text></View>;
                        })}
                      </View>
                    </View>
                  )}
                </>
              )}

              {/* Movie list tabs */}
              <View style={s.friendTabRow}>
                {([['watched', 'Watched', friendWatched], ['watchlist', 'Watchlist', friendWatchlist], ['favorites', 'Favorites', friendFavs]] as const).map(([key, label, list]) => (
                  <TouchableOpacity key={key} style={[s.friendTabBtn, friendTab === key && s.friendTabActive]} onPress={() => {
                    setFriendTab(key as any);
                    setFriendGenre('all');
                    setShowFriendGenreDrop(false);
                  }}>
                    <Text style={[s.friendTabText, friendTab === key && s.friendTabTextActive]}>{label}</Text>
                    <Text style={[s.friendTabCount, friendTab === key && { color: colors.red }]}>
                      {key === 'watched' ? friendStats?.totalWatched ?? list.length
                        : key === 'watchlist' ? friendStats?.totalToWatch ?? list.length
                        : friendStats?.totalFavorites ?? list.length}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Genre filter */}
              {(() => {
                const currentList = friendTab === 'watched' ? friendWatched : friendTab === 'watchlist' ? friendWatchlist : friendFavs;
                const genres = getUniqueGenres(currentList);
                if (genres.length === 0) return null;
                return (
                  <View style={{ width: '100%', zIndex: 99, marginBottom: 12 }}>
                    <TouchableOpacity style={[s.friendGenreBtn, friendGenre !== 'all' && { borderColor: 'rgba(229,9,20,0.4)' }]} onPress={() => setShowFriendGenreDrop(!showFriendGenreDrop)}>
                      <Ionicons name="film-outline" size={14} color={friendGenre !== 'all' ? colors.red : colors.muted} />
                      <Text style={[s.friendGenreBtnText, friendGenre !== 'all' && { color: colors.red }]}>{friendGenre === 'all' ? 'All Genres' : friendGenre}</Text>
                      <Ionicons name="chevron-down" size={12} color={colors.subtle} />
                    </TouchableOpacity>
                    {showFriendGenreDrop && (
                      <View style={s.friendGenreDropdown}>
                        <ScrollView style={{ maxHeight: 350 }} showsVerticalScrollIndicator nestedScrollEnabled>
                          <TouchableOpacity style={[s.friendGenreDropItem, friendGenre === 'all' && s.friendGenreDropItemActive]} onPress={() => { setFriendGenre('all'); setShowFriendGenreDrop(false); }}>
                            <Text style={[s.friendGenreDropText, friendGenre === 'all' && { color: colors.red }]}>All Genres</Text>
                            {friendGenre === 'all' && <Ionicons name="checkmark" size={14} color={colors.red} style={{ marginLeft: 'auto' }} />}
                          </TouchableOpacity>
                          {genres.map(g => (
                            <TouchableOpacity key={g} style={[s.friendGenreDropItem, friendGenre === g && s.friendGenreDropItemActive]} onPress={() => { setFriendGenre(g); setShowFriendGenreDrop(false); }}>
                              <Text style={[s.friendGenreDropText, friendGenre === g && { color: colors.red }]}>{g}</Text>
                              {friendGenre === g && <Ionicons name="checkmark" size={14} color={colors.red} style={{ marginLeft: 'auto' }} />}
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </View>
                    )}
                  </View>
                );
              })()}

              {/* Movie list */}
              {(() => {
                const displayList = filterByGenre(getPagedMovies(friendTab), friendGenre);
                if (friendListLoading && displayList.length === 0) return <ActivityIndicator color={colors.red} style={{ marginTop: 30 }} />;
                if (displayList.length === 0) return (
                  <View style={s.friendMovieEmpty}>
                    <Ionicons name={friendTab === 'watched' ? 'eye-outline' : friendTab === 'watchlist' ? 'bookmark-outline' : 'heart-outline'} size={32} color="rgba(255,255,255,0.1)" />
                    <Text style={s.friendMovieEmptyText}>{friendGenre !== 'all' ? 'No movies match this genre' : `No ${friendTab} movies yet`}</Text>
                  </View>
                );
                return (
                <View style={s.friendMovieGrid}>
                  {displayList.map((m, i) => (
                    <View key={m.movieId || i} style={s.friendMovieCard}>
                      <TouchableOpacity activeOpacity={0.85} onPress={() => setSelectedFriendMovie(m)}>
                      {m.poster ? (
                        <Image source={{ uri: m.poster }} style={s.friendMoviePoster} />
                      ) : (
                        <View style={[s.friendMoviePoster, { backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }]}>
                          <Ionicons name="film-outline" size={20} color={colors.subtle} />
                        </View>
                      )}
                      </TouchableOpacity>
                      <Text style={s.friendMovieTitle} numberOfLines={1}>{m.title}</Text>
                      <View style={s.friendMovieMeta}>
                        {m.year ? <Text style={s.friendMovieYear}>{m.year}</Text> : null}
                        {m.rating && m.rating > 0 ? <Text style={s.friendMovieRating}>★ {m.rating.toFixed(1)}</Text> : null}
                      </View>
                    </View>
                  ))}
                </View>
                );
              })()}
              {getTotalPages(friendTab) > 1 && (
                <View style={s.paginationRow}>
                  {Array.from({ length: getTotalPages(friendTab) }, (_, i) => i + 1).map(p => (
                    <TouchableOpacity
                      key={p}
                      style={[s.pageBtn, friendPage[friendTab] === p && s.pageBtnActive]}
                      onPress={() => setFriendPage(prev => ({ ...prev, [friendTab]: p }))}
                      disabled={friendListLoading}
                    >
                      <Text style={[s.pageBtnText, friendPage[friendTab] === p && s.pageBtnTextActive]}>{p}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>

      <ProfileMovieModal
        movie={selectedFriendMovie}
        onClose={() => setSelectedFriendMovie(null)}
        readOnly
        allMovies={filterByGenre(friendTab === 'watched' ? friendWatched : friendTab === 'watchlist' ? friendWatchlist : friendFavs, friendGenre)}
        currentIndex={selectedFriendMovie ? filterByGenre(friendTab === 'watched' ? friendWatched : friendTab === 'watchlist' ? friendWatchlist : friendFavs, friendGenre).findIndex(m => m.movieId === selectedFriendMovie.movieId) : 0}
        onChangeIndex={(i) => { const list = filterByGenre(friendTab === 'watched' ? friendWatched : friendTab === 'watchlist' ? friendWatchlist : friendFavs, friendGenre); setSelectedFriendMovie(list[i] || null); }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.black, paddingHorizontal: 0 },
  title: { fontSize: 24, fontWeight: '900', color: colors.white, paddingHorizontal: 16 },
  subtitle: { color: colors.subtle, fontSize: 13, paddingHorizontal: 16, marginTop: 2, marginBottom: 16 },
  // Search card
  searchCard: { marginHorizontal: 16, backgroundColor: 'rgba(255,255,255,0.02)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 16, padding: 16, marginBottom: 16 },
  searchLabel: { color: colors.muted, fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 10 },
  searchRow: { flexDirection: 'row', gap: 10 },
  input: { backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: 12, paddingLeft: 36, fontSize: 14, color: colors.text },
  searchBtn: { backgroundColor: colors.red, borderRadius: 12, paddingHorizontal: 18, justifyContent: 'center' },
  searchBtnText: { color: colors.white, fontWeight: '700', fontSize: 14 },
  // Suggested friends
  suggestedBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginBottom: 16, padding: 14, backgroundColor: 'rgba(229,9,20,0.06)', borderWidth: 1, borderColor: 'rgba(229,9,20,0.2)', borderRadius: 12 },
  suggestedBtnText: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '700' },
  resultCard: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14, padding: 12, backgroundColor: 'rgba(255,255,255,0.02)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 12 },
  friendBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(74,222,128,0.1)', borderWidth: 1, borderColor: 'rgba(74,222,128,0.3)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  friendBadgeText: { color: '#4ade80', fontSize: 12, fontWeight: '700' },
  pendingBadge: { backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  pendingText: { color: colors.subtle, fontSize: 12, fontWeight: '600' },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.red, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  addBtnText: { color: colors.white, fontSize: 12, fontWeight: '700' },
  // Tabs
  tabRow: { flexDirection: 'row', paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)', marginBottom: 16 },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: 'transparent', marginBottom: -1 },
  tabActive: { borderBottomColor: colors.red },
  tabText: { color: colors.subtle, fontSize: 14, fontWeight: '600' },
  tabTextActive: { color: colors.white, fontWeight: '700' },
  tabBadge: { backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 99, paddingHorizontal: 6, paddingVertical: 1, minWidth: 20, alignItems: 'center' },
  tabBadgeText: { color: colors.subtle, fontSize: 11, fontWeight: '700' },
  // Cards
  avatar: { width: 48, height: 48, borderRadius: 12, backgroundColor: 'rgba(229,9,20,0.2)', borderWidth: 2, borderColor: 'rgba(229,9,20,0.3)', alignItems: 'center', justifyContent: 'center' },
  avatarSmall: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(229,9,20,0.2)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarSmallText: { color: colors.white, fontSize: 14, fontWeight: '800' },
  avatarText: { color: colors.white, fontSize: 18, fontWeight: '800' },
  name: { color: colors.white, fontSize: 15, fontWeight: '700' },
  sub: { color: colors.subtle, fontSize: 12, marginTop: 2 },
  friendCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, backgroundColor: 'rgba(255,255,255,0.02)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 12, marginBottom: 8 },
  requestCard: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, backgroundColor: 'rgba(229,9,20,0.04)', borderWidth: 1, borderColor: 'rgba(229,9,20,0.15)', borderRadius: 12, marginBottom: 8 },
  acceptBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(74,222,128,0.15)', borderWidth: 1, borderColor: 'rgba(74,222,128,0.3)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  rejectBtn: { backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  // Empty
  empty: { alignItems: 'center', paddingVertical: 48 },
  emptyText: { color: colors.subtle, fontSize: 14, fontWeight: '600', marginTop: 12 },
  emptySub: { color: 'rgba(255,255,255,0.2)', fontSize: 13, marginTop: 4, textAlign: 'center' },
  // Friend profile modal
  modalContainer: { flex: 1, backgroundColor: colors.dark },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)' },
  modalTitle: { color: colors.white, fontSize: 17, fontWeight: '700' },
  modalContent: { alignItems: 'center', padding: 24, paddingBottom: 60 },
  profileAvatarInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(229,9,20,0.2)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  profileAvatarText: { color: colors.white, fontSize: 26, fontWeight: '800' },
  profileName: { color: colors.white, fontSize: 22, fontWeight: '900', marginBottom: 4 },
  tierRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 20 },
  tierDot: { width: 7, height: 7, borderRadius: 4 },
  tierLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  tierCount: { color: colors.subtle, fontSize: 11 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 24, width: '100%' },
  statBox: { flex: 1, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 12, paddingVertical: 14 },
  statNum: { color: colors.white, fontSize: 20, fontWeight: '800' },
  statLabel: { color: colors.subtle, fontSize: 11, fontWeight: '600', marginTop: 4 },
  genreSection: { width: '100%', marginBottom: 24 },
  sectionLabel: { color: colors.subtle, fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 10 },
  genreRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  genrePill: { backgroundColor: 'rgba(229,9,20,0.12)', borderWidth: 1, borderColor: 'rgba(229,9,20,0.3)', borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4 },
  genreText: { color: '#ff6b6b', fontSize: 12, fontWeight: '700' },
  favsSection: { width: '100%' },
  favItem: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, backgroundColor: 'rgba(255,255,255,0.02)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 10, marginBottom: 8 },
  favPoster: { width: 40, height: 60, borderRadius: 6 },
  favTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
  favSub: { color: colors.subtle, fontSize: 12, marginTop: 2 },
  // Friend profile movie tabs & grid
  friendTabRow: { flexDirection: 'row', width: '100%', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)', marginBottom: 16 },
  friendTabBtn: { flex: 1, alignItems: 'center', paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  friendTabActive: { borderBottomColor: colors.red },
  friendTabText: { color: colors.subtle, fontSize: 13, fontWeight: '600' },
  friendTabTextActive: { color: colors.white, fontWeight: '700' },
  friendTabCount: { color: colors.subtle, fontSize: 11, fontWeight: '700', marginTop: 2 },
  friendMovieEmpty: { alignItems: 'center', paddingVertical: 40 },
  friendMovieEmptyText: { color: colors.subtle, fontSize: 13, marginTop: 8 },
  friendMovieGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, width: '100%' },
  friendMovieCard: { width: '31%', borderRadius: 10, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  friendMoviePoster: { width: '100%', aspectRatio: 2 / 3, borderTopLeftRadius: 10, borderTopRightRadius: 10 },
  friendMovieTitle: { color: colors.text, fontSize: 11, fontWeight: '700', paddingHorizontal: 6, paddingTop: 6 },
  friendMovieMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 6, paddingBottom: 6, paddingTop: 2 },
  friendMovieYear: { color: colors.subtle, fontSize: 10 },
  friendMovieRating: { color: colors.gold, fontSize: 10, fontWeight: '700' },
  paginationRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 16, width: '100%', flexWrap: 'wrap' },
  pageBtn: { width: 36, height: 36, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  pageBtnActive: { backgroundColor: colors.red, borderColor: colors.red },
  pageBtnText: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  pageBtnTextActive: { color: colors.white },
  friendGenreBtn: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  friendGenreBtnText: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  friendGenreDropdown: { position: 'absolute', top: 42, left: 0, zIndex: 999, backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', borderRadius: 10, paddingVertical: 4, minWidth: 160, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 8 },
  friendGenreDropItem: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10 },
  friendGenreDropItemActive: { backgroundColor: 'rgba(229,9,20,0.08)' },
  friendGenreDropText: { color: colors.text, fontSize: 13, fontWeight: '600' },
});
