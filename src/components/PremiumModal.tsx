import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';

interface Props {
  visible: boolean;
  onClose: () => void;
  onUpgrade: () => void;
  onRestore?: () => void;
  onDowngrade?: () => void;
  isPremium?: boolean;
  creditsLeft?: number;
  purchaseLoading?: boolean;
}

const PERKS = [
  { icon: 'flash', color: colors.gold, title: '15 AI Credits / Day', sub: 'Up from 3 — search 5x more with AI' },
  { icon: 'heart', color: '#ff6b6b', title: 'Personalized Picks', sub: 'Recommendations based on your taste' },
  { icon: 'bar-chart', color: '#a78bfa', title: 'Profile Stats', sub: 'Genre breakdown, ratings & activity insights' },
  { icon: 'infinite', color: '#4ade80', title: 'Unlimited Title Search', sub: 'Search by title with no daily limits' },
  { icon: 'star', color: colors.gold, title: 'Early Features', sub: 'Be the first to try new features' },
];

export default function PremiumModal({ visible, onClose, onUpgrade, onRestore, onDowngrade, isPremium, creditsLeft, purchaseLoading }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent>
      <View style={s.overlay}>
        <View style={[s.container, { paddingBottom: insets.bottom + 20 }]}>
          <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
            {/* Close button */}
            <TouchableOpacity style={s.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={22} color={colors.muted} />
            </TouchableOpacity>

            {/* Header */}
            <View style={s.header}>
              <LinearGradient colors={isPremium ? ['rgba(245,197,24,0.2)', 'rgba(245,197,24,0.05)'] : ['rgba(229,9,20,0.2)', 'rgba(229,9,20,0.05)']} style={s.iconGlow}>
                <View style={[s.iconCircle, isPremium && { backgroundColor: 'rgba(245,197,24,0.15)', borderColor: 'rgba(245,197,24,0.4)' }]}>
                  <Text style={s.crownEmoji}>{isPremium ? '✦' : '👑'}</Text>
                </View>
              </LinearGradient>

              {isPremium ? (
                <>
                  <Text style={s.title}>CINE<Text style={s.titleAccent}>LYSE</Text> Premium</Text>
                  <View style={s.activeBadge}>
                    <Ionicons name="checkmark-circle" size={14} color="#4ade80" />
                    <Text style={s.activeBadgeText}>Active</Text>
                  </View>
                  <Text style={s.subtitle}>
                    You have full access to all premium features
                  </Text>
                </>
              ) : (
                <>
                  <Text style={s.title}>Upgrade to{'\n'}CINE<Text style={s.titleAccent}>LYSE</Text> Premium</Text>
                  {creditsLeft === 0 && (
                    <View style={s.outBadge}>
                      <Ionicons name="alert-circle" size={14} color={colors.red} />
                      <Text style={s.outBadgeText}>You've used all your free credits today</Text>
                    </View>
                  )}
                  <Text style={s.subtitle}>
                    Unlock the full power of AI-driven movie discovery
                  </Text>
                </>
              )}
            </View>

            {/* Comparison */}
            {!isPremium && (
              <View style={s.comparison}>
                <View style={s.planCard}>
                  <Text style={s.planLabel}>FREE</Text>
                  <Text style={s.planCredits}>3</Text>
                  <Text style={s.planUnit}>credits/day</Text>
                </View>
                <View style={s.planArrow}>
                  <Ionicons name="arrow-forward" size={20} color={colors.red} />
                </View>
                <View style={[s.planCard, s.planCardPremium]}>
                  <Text style={[s.planLabel, { color: colors.gold }]}>PREMIUM</Text>
                  <Text style={[s.planCredits, { color: colors.gold }]}>15</Text>
                  <Text style={[s.planUnit, { color: 'rgba(245,197,24,0.6)' }]}>credits/day</Text>
                </View>
              </View>
            )}

            {/* Perks */}
            <View style={s.perksSection}>
              <Text style={s.perksTitle}>{isPremium ? 'Your Premium Perks' : 'Everything in Premium'}</Text>
              {PERKS.map((perk, i) => (
                <View key={i} style={s.perkRow}>
                  <View style={[s.perkIcon, { backgroundColor: `${perk.color}15` }]}>
                    <Ionicons name={perk.icon as any} size={18} color={perk.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.perkTitle}>{perk.title}</Text>
                    <Text style={s.perkSub}>{perk.sub}</Text>
                  </View>
                  <Ionicons name="checkmark-circle" size={18} color="#4ade80" />
                </View>
              ))}
            </View>

            {/* CTA */}
            {isPremium ? (
              <>
                <TouchableOpacity style={s.deactivateBtn} onPress={onDowngrade} activeOpacity={0.85}>
                  <Ionicons name="close-circle-outline" size={16} color={colors.muted} />
                  <Text style={s.deactivateText}>Deactivate Premium</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.skipBtn} onPress={onClose}>
                  <Text style={s.skipText}>Close</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity style={s.ctaBtn} onPress={onUpgrade} disabled={purchaseLoading} activeOpacity={0.85}>
                  <LinearGradient colors={['#c0392b', '#e74c3c', '#c0392b']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.ctaGradient}>
                    {purchaseLoading ? <ActivityIndicator color="#fff" size="small" /> : <><Text style={s.ctaStar}>✦</Text><Text style={s.ctaText}>Upgrade to Premium</Text></>}
                  </LinearGradient>
                </TouchableOpacity>
                <Text style={s.ctaSub}>Cancel anytime · No commitment</Text>
                {onRestore && (
                  <TouchableOpacity style={s.skipBtn} onPress={onRestore} disabled={purchaseLoading}>
                    <Text style={s.skipText}>Restore purchase</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={s.skipBtn} onPress={onClose}>
                  <Text style={s.skipText}>Maybe later</Text>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  container: {
    backgroundColor: '#111',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    maxHeight: '92%',
  },
  closeBtn: {
    position: 'absolute', top: 16, right: 16, zIndex: 10,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  header: { alignItems: 'center', paddingTop: 32, paddingHorizontal: 24 },
  iconGlow: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  iconCircle: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: 'rgba(229,9,20,0.15)', borderWidth: 1.5, borderColor: 'rgba(229,9,20,0.4)',
    alignItems: 'center', justifyContent: 'center',
  },
  crownEmoji: { fontSize: 28 },
  title: { fontSize: 26, fontWeight: '900', color: colors.white, textAlign: 'center', lineHeight: 32, marginBottom: 8 },
  titleAccent: { color: colors.red },
  activeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(74,222,128,0.1)', borderWidth: 1, borderColor: 'rgba(74,222,128,0.3)',
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 8,
  },
  activeBadgeText: { color: '#4ade80', fontSize: 12, fontWeight: '700' },
  outBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(229,9,20,0.1)', borderWidth: 1, borderColor: 'rgba(229,9,20,0.3)',
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 8,
  },
  outBadgeText: { color: colors.red, fontSize: 12, fontWeight: '600' },
  subtitle: { color: colors.subtle, fontSize: 14, textAlign: 'center', lineHeight: 20, maxWidth: 280, marginBottom: 24 },
  comparison: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 24, marginBottom: 24 },
  planCard: {
    flex: 1, alignItems: 'center', paddingVertical: 16,
    backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
  },
  planCardPremium: {
    backgroundColor: 'rgba(245,197,24,0.06)', borderColor: 'rgba(245,197,24,0.25)',
  },
  planLabel: { color: colors.subtle, fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginBottom: 4 },
  planCredits: { color: colors.white, fontSize: 36, fontWeight: '900' },
  planUnit: { color: colors.subtle, fontSize: 11, fontWeight: '600' },
  planArrow: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(229,9,20,0.12)', borderWidth: 1, borderColor: 'rgba(229,9,20,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },
  perksSection: { paddingHorizontal: 24, marginBottom: 24 },
  perksTitle: { color: colors.muted, fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 14 },
  perkRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  perkIcon: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  perkTitle: { color: colors.white, fontSize: 14, fontWeight: '700' },
  perkSub: { color: colors.subtle, fontSize: 12, marginTop: 1 },
  ctaBtn: { marginHorizontal: 24, borderRadius: 14, overflow: 'hidden', marginBottom: 8 },
  ctaGradient: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 16,
  },
  ctaStar: { color: colors.white, fontSize: 16 },
  ctaText: { color: colors.white, fontSize: 17, fontWeight: '800' },
  ctaSub: { color: colors.subtle, fontSize: 11, textAlign: 'center', marginBottom: 12 },
  deactivateBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginHorizontal: 24, borderRadius: 14, paddingVertical: 14,
    backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    marginBottom: 8,
  },
  deactivateText: { color: colors.muted, fontSize: 14, fontWeight: '600' },
  skipBtn: { alignItems: 'center', paddingVertical: 12, marginBottom: 8 },
  skipText: { color: colors.subtle, fontSize: 13, fontWeight: '600' },
});
