import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Modal, Animated, Easing, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import ProfileRing, { TIER_META, type Tier } from './ProfileRing';

interface Props {
  visible: boolean;
  tier: Tier;
  onClose: () => void;
}

export default function LevelUpModal({ visible, tier, onClose }: Props) {
  const scale = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const ringScale = useRef(new Animated.Value(0.3)).current;
  const textSlide = useRef(new Animated.Value(30)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const btnOpacity = useRef(new Animated.Value(0)).current;
  const flash = useRef(new Animated.Value(0)).current;
  const particles = useRef(Array.from({ length: 8 }, () => ({
    x: new Animated.Value(0),
    y: new Animated.Value(0),
    opacity: new Animated.Value(0),
    scale: new Animated.Value(0),
  }))).current;

  const meta = TIER_META[tier];

  useEffect(() => {
    if (!visible) return;
    // Reset
    scale.setValue(0);
    opacity.setValue(0);
    ringScale.setValue(0.3);
    textSlide.setValue(30);
    textOpacity.setValue(0);
    btnOpacity.setValue(0);
    flash.setValue(0);
    particles.forEach(p => { p.x.setValue(0); p.y.setValue(0); p.opacity.setValue(0); p.scale.setValue(0); });

    // Sequence
    Animated.sequence([
      // Flash
      Animated.timing(flash, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(flash, { toValue: 0, duration: 400, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        // Ring bounces in
        Animated.spring(ringScale, { toValue: 1, friction: 4, tension: 60, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, friction: 5, tension: 50, useNativeDriver: true }),
        // Particles burst out
        ...particles.map((p, i) => {
          const angle = (i / particles.length) * Math.PI * 2;
          const dist = 80 + Math.random() * 40;
          return Animated.parallel([
            Animated.timing(p.x, { toValue: Math.cos(angle) * dist, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
            Animated.timing(p.y, { toValue: Math.sin(angle) * dist, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
            Animated.sequence([
              Animated.timing(p.opacity, { toValue: 1, duration: 150, useNativeDriver: true }),
              Animated.timing(p.opacity, { toValue: 0, duration: 450, useNativeDriver: true }),
            ]),
            Animated.sequence([
              Animated.timing(p.scale, { toValue: 1.5, duration: 200, useNativeDriver: true }),
              Animated.timing(p.scale, { toValue: 0, duration: 400, useNativeDriver: true }),
            ]),
          ]);
        }),
      ]),
      // Text slides up
      Animated.parallel([
        Animated.timing(textSlide, { toValue: 0, duration: 400, easing: Easing.out(Easing.back(1.5)), useNativeDriver: true }),
        Animated.timing(textOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]),
      // Button fades in
      Animated.timing(btnOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
  }, [visible]);

  if (!visible) return null;

  const particleColors = ['#ffd700', '#ff6b6b', '#4ade80', '#a78bfa', '#ff9500', '#00d4ff', meta.color, '#ffffff'];

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent>
      <Animated.View style={[s.overlay, { opacity }]}>
        {/* Flash */}
        <Animated.View style={[s.flash, { backgroundColor: meta.color, opacity: flash }]} pointerEvents="none" />

        {/* Particles */}
        {particles.map((p, i) => (
          <Animated.View
            key={i}
            style={[s.particle, {
              backgroundColor: particleColors[i % particleColors.length],
              transform: [{ translateX: p.x }, { translateY: p.y }, { scale: p.scale }],
              opacity: p.opacity,
            }]}
          />
        ))}

        {/* Content */}
        <Animated.View style={[s.content, { transform: [{ scale }] }]}>
          {/* Glow behind ring */}
          <View style={[s.glow, { shadowColor: meta.color }]} />

          {/* Level up label */}
          <View style={s.levelUpBadge}>
            <Ionicons name="arrow-up" size={12} color={meta.color} />
            <Text style={[s.levelUpText, { color: meta.color }]}>LEVEL UP!</Text>
          </View>

          {/* Tier ring */}
          <Animated.View style={{ transform: [{ scale: ringScale }] }}>
            <ProfileRing tier={tier} size="large">
              <View style={[s.ringInner, { borderColor: meta.color }]}>
                <Text style={{ fontSize: 32 }}>
                  {tier === 'spectator' ? '👁' : tier === 'cinephile' ? '🎬' : tier === 'critic' ? '⭐' : '🏆'}
                </Text>
              </View>
            </ProfileRing>
          </Animated.View>

          {/* Tier name */}
          <Animated.View style={{ transform: [{ translateY: textSlide }], opacity: textOpacity }}>
            <Text style={[s.tierName, { color: meta.color }]}>{meta.label}</Text>
            <Text style={s.tierSub}>
              {tier === 'cinephile' ? 'You\'re becoming a true movie lover!' :
               tier === 'critic' ? 'Your taste is refined and sharp!' :
               tier === 'director' ? 'You\'ve reached the highest level!' :
               'Welcome to CINELYSE!'}
            </Text>
            <View style={[s.divider, { backgroundColor: meta.color }]} />
            <Text style={s.tierMin}>{meta.min}+ AI searches</Text>
          </Animated.View>

          {/* Continue button */}
          <Animated.View style={{ opacity: btnOpacity, width: '100%' }}>
            <TouchableOpacity style={[s.btn, { borderColor: meta.color }]} onPress={onClose} activeOpacity={0.8}>
              <Text style={[s.btnText, { color: meta.color }]}>Continue</Text>
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.85)',
    alignItems: 'center', justifyContent: 'center',
  },
  flash: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
  },
  particle: {
    position: 'absolute', width: 8, height: 8, borderRadius: 4,
  },
  content: {
    alignItems: 'center', gap: 20, paddingHorizontal: 40,
  },
  glow: {
    position: 'absolute', width: 160, height: 160, borderRadius: 80,
    shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 60,
  },
  levelUpBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 20, paddingHorizontal: 16, paddingVertical: 6,
  },
  levelUpText: { fontSize: 13, fontWeight: '900', letterSpacing: 2 },
  ringInner: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  tierName: { fontSize: 32, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 2, textAlign: 'center' },
  tierSub: { color: colors.subtle, fontSize: 14, textAlign: 'center', marginTop: 4, lineHeight: 20 },
  divider: { width: 40, height: 2, borderRadius: 1, alignSelf: 'center', marginTop: 12, opacity: 0.4 },
  tierMin: { color: colors.muted, fontSize: 12, fontWeight: '600', textAlign: 'center', marginTop: 8 },
  btn: {
    alignItems: 'center', paddingVertical: 14, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1,
    marginTop: 8,
  },
  btnText: { fontSize: 16, fontWeight: '800' },
});
