import React, { useEffect, useRef } from 'react';
import { View, Animated, Easing } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import Svg, {
  Circle, Path, Rect, Polygon,
  Defs, LinearGradient, RadialGradient, Stop, G,
} from 'react-native-svg';

export type Tier = 'spectator' | 'cinephile' | 'critic' | 'director';

export const TIER_META: Record<Tier, { label: string; color: string; min: number }> = {
  spectator: { label: 'Spectator', color: '#7a9acc', min: 0 },
  cinephile: { label: 'Cinephile', color: '#ff6b6b', min: 10 },
  critic:    { label: 'Critic',    color: '#ffd700', min: 100 },
  director:  { label: 'Director',  color: '#ffaa00', min: 500 },
};

export function getTier(searchCount: number): Tier {
  if (searchCount >= 500) return 'director';
  if (searchCount >= 100) return 'critic';
  if (searchCount >= 10)  return 'cinephile';
  return 'spectator';
}

export function getNextTier(tier: Tier): { next: Tier | null; needed: number } {
  switch (tier) {
    case 'spectator': return { next: 'cinephile', needed: 10 };
    case 'cinephile': return { next: 'critic',    needed: 100 };
    case 'critic':    return { next: 'director',  needed: 500 };
    default:          return { next: null,         needed: 0 };
  }
}

interface Props {
  tier: Tier;
  size?: 'small' | 'medium' | 'large';
  children: React.ReactNode;
}

const SIZES = {
  small:  { container: 44,  avatar: 32 },
  medium: { container: 100, avatar: 60 },
  large:  { container: 120, avatar: 80 },
};

function useRotation(duration: number, direction: 1 | -1 = 1, active = true) {
  const anim = useRef(new Animated.Value(0)).current;
  const loopRef = useRef<Animated.CompositeAnimation | null>(null);
  useEffect(() => {
    if (active) {
      loopRef.current = Animated.loop(
        Animated.timing(anim, {
          toValue: direction,
          duration,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      );
      loopRef.current.start();
    } else {
      loopRef.current?.stop();
    }
    return () => { loopRef.current?.stop(); };
  }, [active]);
  return anim.interpolate({
    inputRange:  [0, 1],
    outputRange: ['0deg', `${direction * 360}deg`],
  });
}

function usePulse(min: number, max: number, duration: number, active = true) {
  const anim = useRef(new Animated.Value(min)).current;
  const loopRef = useRef<Animated.CompositeAnimation | null>(null);
  useEffect(() => {
    if (active) {
      loopRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(anim, { toValue: max, duration: duration / 2, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(anim, { toValue: min, duration: duration / 2, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
      );
      loopRef.current.start();
    } else {
      loopRef.current?.stop();
    }
    return () => { loopRef.current?.stop(); };
  }, [active]);
  return anim;
}

/* ─────────────────────────────────────────
   Spectator
───────────────────────────────────────── */
function SpectatorFrame({ children, size, active }: { children: React.ReactNode; size: 'small' | 'medium' | 'large'; active: boolean }) {
  const s = SIZES[size];
  const breathe = usePulse(0.4, 0.85, 4000, active);

  return (
    <View style={{ width: s.container, height: s.container, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={{
        position: 'absolute',
        width: s.container - 8, height: s.container - 8,
        borderRadius: (s.container - 8) / 2,
        shadowColor: '#7a9acc', shadowOffset: { width: 0, height: 0 },
        shadowRadius: size === 'small' ? 6 : 12,
        shadowOpacity: 1,
        opacity: breathe,
      }} />
      <Svg width={s.container} height={s.container} viewBox="0 0 100 100" style={{ position: 'absolute' }}>
        <Circle cx={50} cy={50} r={45} stroke="#4a5a7a" strokeWidth={1} opacity={0.3} fill="none" />
        <Circle cx={50} cy={50} r={45} stroke="#7a9acc" strokeWidth={size === 'small' ? 1.5 : 2} opacity={0.85} fill="none" />
        <Circle cx={50} cy={50} r={38} stroke="#5a6a8a" strokeWidth={0.75} strokeDasharray="3 5" opacity={0.5} fill="none" />
      </Svg>
      {children}
    </View>
  );
}

/* ─────────────────────────────────────────
   Cinephile
───────────────────────────────────────── */
function CinephileFrame({ children, size, active }: { children: React.ReactNode; size: 'small' | 'medium' | 'large'; active: boolean }) {
  const s = SIZES[size];
  const pulse = usePulse(0.3, 0.6, 2500, active);

  return (
    <View style={{ width: s.container, height: s.container, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={{
        position: 'absolute',
        width: s.container - 8, height: s.container - 8,
        borderRadius: (s.container - 8) / 2,
        shadowColor: '#ff5050', shadowOffset: { width: 0, height: 0 },
        shadowRadius: size === 'small' ? 8 : 18,
        shadowOpacity: 1,
        opacity: pulse,
      }} />
      <Svg width={s.container} height={s.container} viewBox="0 0 120 120" style={{ position: 'absolute' }}>
        <Circle cx={60} cy={60} r={52} stroke="#3a2a2a" strokeWidth={1} opacity={0.2} fill="none" />
        <Circle cx={60} cy={60} r={48} stroke="#ff6b6b" strokeWidth={size === 'small' ? 2 : 2.5} opacity={0.9} fill="none" />
        <Circle cx={60} cy={60} r={42} stroke="#cc3333" strokeWidth={1.5} opacity={0.6} fill="none" />
        <Circle cx={60} cy={60} r={48} stroke="#ff6b6b" strokeWidth={size === 'small' ? 1.5 : 2} opacity={0.5} strokeDasharray="4 6" fill="none" />
      </Svg>
      {children}
    </View>
  );
}

/* ─────────────────────────────────────────
   Critic
───────────────────────────────────────── */
function CriticFrame({ children, size, active }: { children: React.ReactNode; size: 'small' | 'medium' | 'large'; active: boolean }) {
  const s = SIZES[size];
  const cwRotation  = useRotation(10000, 1, active);
  const ccwRotation = useRotation(18000, -1, active);

  const R1 = 55;
  const R2 = 45;
  const C1 = 2 * Math.PI * R1;
  const C2 = 2 * Math.PI * R2;
  const s1 = parseFloat((C1 / 4 * 0.82).toFixed(2));
  const g1 = parseFloat((C1 / 4 - s1).toFixed(2));
  const s2 = parseFloat((C2 / 6 * 0.6).toFixed(2));
  const g2 = parseFloat((C2 / 6 - s2).toFixed(2));

  return (
    <View style={{ width: s.container, height: s.container, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{
        position: 'absolute',
        width: s.container - 12, height: s.container - 12,
        borderRadius: (s.container - 12) / 2,
        shadowColor: '#ffd700', shadowOffset: { width: 0, height: 0 },
        shadowRadius: size === 'small' ? 10 : 20, shadowOpacity: 0.2,
      }} />
      <Svg width={s.container} height={s.container} viewBox="0 0 140 140" style={{ position: 'absolute' }}>
        <Defs>
          <RadialGradient id="criticCoreFill" cx="50%" cy="50%" r="50%">
            <Stop offset="0%"   stopColor="#ffd700" stopOpacity={0.08} />
            <Stop offset="60%"  stopColor="#cc9900" stopOpacity={0.03} />
            <Stop offset="100%" stopColor="#000000" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={70} cy={70} r={54} fill="url(#criticCoreFill)" />
        <Circle cx={70} cy={70} r={60} stroke="#5a4800" strokeWidth={1} opacity={0.2} fill="none" />
        <Circle cx={70} cy={70} r={50} stroke="#7a6a00" strokeWidth={0.75} opacity={0.3} fill="none" />
      </Svg>
      <Animated.View style={{ position: 'absolute', width: s.container, height: s.container, transform: [{ rotate: cwRotation }] }}>
        <Svg width={s.container} height={s.container} viewBox="0 0 140 140">
          <Defs>
            <LinearGradient id="gold-grad-o" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%"   stopColor="#ffd700" />
              <Stop offset="50%"  stopColor="#ffed4e" />
              <Stop offset="100%" stopColor="#cc9900" />
            </LinearGradient>
          </Defs>
          <Circle
            cx={70} cy={70} r={R1}
            stroke="url(#gold-grad-o)"
            strokeWidth={size === 'small' ? 3 : 5}
            fill="none"
            strokeDasharray={`${s1} ${g1}`}
            strokeLinecap="round"
          />
        </Svg>
      </Animated.View>
      {size !== 'small' && (
        <Animated.View style={{ position: 'absolute', width: s.container, height: s.container, transform: [{ rotate: ccwRotation }] }}>
          <Svg width={s.container} height={s.container} viewBox="0 0 140 140">
            <Defs>
              <LinearGradient id="gold-grad-i" x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%"   stopColor="#ffd700" />
                <Stop offset="50%"  stopColor="#ffed4e" />
                <Stop offset="100%" stopColor="#cc9900" />
              </LinearGradient>
            </Defs>
            <Circle
              cx={70} cy={70} r={R2}
              stroke="url(#gold-grad-i)"
              strokeWidth={2}
              fill="none"
              strokeDasharray={`${s2} ${g2}`}
              strokeLinecap="round"
              opacity={0.7}
            />
          </Svg>
        </Animated.View>
      )}
      {children}
    </View>
  );
}

/* ─────────────────────────────────────────
   Director
───────────────────────────────────────── */
function DirectorFrame({ children, size, active }: { children: React.ReactNode; size: 'small' | 'medium' | 'large'; active: boolean }) {
  const s = SIZES[size];
  const c = s.container;
  const isSmall = size === 'small';
  const isLarge = size === 'large';

  const R1 = 86;
  const R2 = 73;
  const R3 = 61;
  const C1 = 2 * Math.PI * R1;
  const C2 = 2 * Math.PI * R2;

  const s1 = parseFloat((C1 / 4 * 0.72).toFixed(2));
  const g1 = parseFloat((C1 / 4 - s1).toFixed(2));
  const s2 = parseFloat((C2 / 8 * 0.55).toFixed(2));
  const g2 = parseFloat((C2 / 8 - s2).toFixed(2));
  const s3 = parseFloat((C1 / 24 * 0.4).toFixed(2));
  const g3 = parseFloat((C1 / 24 - s3).toFixed(2));

  const sw = isSmall ? 4 : isLarge ? 7 : 5.5;

  const cwRotation   = useRotation(11000, 1, active);
  const ccwRotation  = useRotation(19000, -1, active);
  const slowRotation = useRotation(32000, 1, active);

  const glowPulse = usePulse(0.22, 0.42, 3000, active);

  const ember1 = usePulse(0, 1, 3000, active);
  const ember2 = usePulse(0, 1, 4000, active);
  const ember3 = usePulse(0, 1, 2500, active);

  const ember1Opacity    = ember1.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.95, 0.4,  0.95] });
  const ember1TranslateY = ember1.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -7, 0] });
  const ember2Opacity    = ember2.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.9,  0.35, 0.9] });
  const ember2TranslateY = ember2.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -5, 0] });
  const ember3Opacity    = ember3.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.8,  0.3,  0.8] });
  const ember3TranslateY = ember3.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -6, 0] });

  return (
    <View style={{ width: c, height: c, alignItems: 'center', justifyContent: 'center' }}>

      {/* Pulsing ambient glow — no elevation */}
      <Animated.View style={{
        position: 'absolute',
        width: c * 0.78, height: c * 0.78,
        borderRadius: c * 0.39,
        shadowColor: '#ffaa00',
        shadowOffset: { width: 0, height: 0 },
        shadowRadius: isSmall ? 12 : 25,
        shadowOpacity: 1,
        opacity: glowPulse,
      }} />

      {/* ── Layer 1: Static base rings ── */}
      <Svg width={c} height={c} viewBox="0 0 200 200" style={{ position: 'absolute' }}>
        <Defs>
          <RadialGradient id="dirCoreFill" cx="50%" cy="50%" r="50%">
            <Stop offset="0%"   stopColor="#ffaa00" stopOpacity={0.22} />
            <Stop offset="55%"  stopColor="#ff7700" stopOpacity={0.07} />
            <Stop offset="100%" stopColor="#ff4400" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={100} cy={100} r={84} fill="url(#dirCoreFill)" />
        <Circle cx={100} cy={100} r={R1} stroke="#110900" strokeWidth={sw + 3} fill="none" opacity={0.75} />
        <Circle cx={100} cy={100} r={R1} stroke="#ffaa00" strokeWidth={0.5}     fill="none" opacity={0.35} />
        {!isSmall && (
          <>
            <Circle cx={100} cy={100} r={R2} stroke="#0e0800" strokeWidth={4}    fill="none" opacity={0.6} />
            <Circle cx={100} cy={100} r={R2} stroke="#ffaa00" strokeWidth={0.4}  fill="none" opacity={0.2} />
            <Circle cx={100} cy={100} r={R3} stroke="#ffaa00" strokeWidth={0.75} fill="none" opacity={0.25} strokeDasharray="2 8" />
          </>
        )}
      </Svg>

      {/* ── Layer 2: Outer arcs, clockwise 11s ── */}
      <Animated.View style={{ position: 'absolute', width: c, height: c, transform: [{ rotate: cwRotation }] }}>
        <Svg width={c} height={c} viewBox="0 0 200 200">
          <Defs>
            <LinearGradient id="dirArc1" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%"   stopColor="#fff0aa" />
              <Stop offset="40%"  stopColor="#ffcc22" />
              <Stop offset="100%" stopColor="#cc7700" />
            </LinearGradient>
          </Defs>
          <Circle
            cx={100} cy={100} r={R1}
            stroke="url(#dirArc1)"
            strokeWidth={sw}
            fill="none"
            strokeDasharray={`${s1} ${g1}`}
            strokeLinecap="round"
          />
        </Svg>
      </Animated.View>

      {!isSmall && (
        <>
          {/* ── Layer 3: Mid arcs, counter-clockwise 19s ── */}
          <Animated.View style={{ position: 'absolute', width: c, height: c, transform: [{ rotate: ccwRotation }] }}>
            <Svg width={c} height={c} viewBox="0 0 200 200">
              <Defs>
                <LinearGradient id="dirArc2" x1="0%" y1="0%" x2="100%" y2="100%">
                  <Stop offset="0%"   stopColor="#ffee66" />
                  <Stop offset="100%" stopColor="#bb5500" />
                </LinearGradient>
              </Defs>
              <Circle
                cx={100} cy={100} r={R2}
                stroke="url(#dirArc2)"
                strokeWidth={isLarge ? 3 : 2.5}
                fill="none"
                strokeDasharray={`${s2} ${g2}`}
                strokeLinecap="round"
                opacity={0.8}
              />
            </Svg>
          </Animated.View>

          {/* ── Layer 4: Outer tick halo, slow CW 32s (large only) ── */}
          {isLarge && (
            <Animated.View style={{ position: 'absolute', width: c, height: c, transform: [{ rotate: slowRotation }] }}>
              <Svg width={c} height={c} viewBox="0 0 200 200">
                <Circle
                  cx={100} cy={100} r={R1 + 8}
                  stroke="#ffaa00"
                  strokeWidth={1.5}
                  fill="none"
                  strokeDasharray={`${s3} ${g3}`}
                  strokeLinecap="round"
                  opacity={0.3}
                />
              </Svg>
            </Animated.View>
          )}

          {/* Ember particles */}
          <Animated.View style={{
            position: 'absolute',
            left: c * 0.41, top: isLarge ? c * 0.07 : c * 0.09,
            width: 5, height: 5, borderRadius: 2.5,
            backgroundColor: '#ffaa00',
            opacity: ember1Opacity,
            transform: [{ translateY: ember1TranslateY }],
          }} />
          <Animated.View style={{
            position: 'absolute',
            left: c * 0.55, top: isLarge ? c * 0.09 : c * 0.11,
            width: 4, height: 4, borderRadius: 2,
            backgroundColor: '#ffee44',
            opacity: ember2Opacity,
            transform: [{ translateY: ember2TranslateY }],
          }} />
          {isLarge && (
            <Animated.View style={{
              position: 'absolute',
              left: c * 0.49, top: c * 0.06,
              width: 3, height: 3, borderRadius: 1.5,
              backgroundColor: '#ffffff',
              opacity: ember3Opacity,
              transform: [{ translateY: ember3TranslateY }],
            }} />
          )}
        </>
      )}

      {/* Avatar / children */}
      {children}

      {/* ── Crown ── */}
      {!isSmall && (
        <Svg
          width={c} height={c}
          viewBox="0 0 200 200"
          style={{ position: 'absolute' }}
          pointerEvents="none"
        >
          <Defs>
            <LinearGradient id="crownVertical" x1="0%" y1="100%" x2="0%" y2="0%">
              <Stop offset="0%"   stopColor="#cc7700" />
              <Stop offset="40%"  stopColor="#ffcc33" />
              <Stop offset="85%"  stopColor="#fff0a0" />
              <Stop offset="100%" stopColor="#ffffff" />
            </LinearGradient>
            <LinearGradient id="crownHorizontal" x1="0%" y1="0%" x2="100%" y2="0%">
              <Stop offset="0%"   stopColor="#6a2e00" />
              <Stop offset="35%"  stopColor="#ffbb33" />
              <Stop offset="65%"  stopColor="#ffbb33" />
              <Stop offset="100%" stopColor="#6a2e00" />
            </LinearGradient>
          </Defs>

          <Polygon
            points={`${100 + R1 + 6},100 ${100 + R1 + 1},105 ${100 + R1 - 4},100 ${100 + R1 + 1},95`}
            fill="#ffcc44" stroke="#7a4400" strokeWidth={0.8} opacity={0.95}
          />
          <Polygon
            points={`100,${100 + R1 + 6} 105,${100 + R1 + 1} 100,${100 + R1 - 4} 95,${100 + R1 + 1}`}
            fill="#ffcc44" stroke="#7a4400" strokeWidth={0.8} opacity={0.95}
          />
          <Polygon
            points={`${100 - R1 - 6},100 ${100 - R1 - 1},105 ${100 - R1 + 4},100 ${100 - R1 - 1},95`}
            fill="#ffcc44" stroke="#7a4400" strokeWidth={0.8} opacity={0.95}
          />

          <G transform="translate(100, 14)">
            <Path
              d="M-18,10 L-15,-9 L-8,0 L0,-17 L8,0 L15,-9 L18,10 Q18,14 0,14 Q-18,14 -18,10 Z"
              fill="#0d0204" opacity={0.92}
            />
            <Path
              d="M-16,8 L-13,-8 L-7,0 L0,-16 L7,0 L13,-8 L16,8 L16,13 L-16,13 Z"
              fill="none" stroke="#1a0a00" strokeWidth={2.5} strokeLinejoin="round"
            />
            <Path
              d="M-16,8 L-13,-8 L-7,0 L0,-16 L7,0 L13,-8 L16,8 Z"
              fill="url(#crownVertical)"
            />
            <Rect x={-16} y={8} width={32} height={6} rx={1.5} fill="url(#crownHorizontal)" />
            <Path
              d="M-16,8 L-13,-8 L-7,0 L0,-16 L7,0 L13,-8 L16,8"
              fill="none" stroke="#7a3a00" strokeWidth={1} strokeLinejoin="round" opacity={0.7}
            />
            <Path
              d="M-14,8 L-11,-6 L-6,0.5 L0,-13 L6,0.5 L11,-6 L14,8"
              fill="none" stroke="#fff5cc" strokeWidth={0.7} strokeLinejoin="round" opacity={0.55}
            />

            <Circle cx={-13} cy={-6}  r={3}   fill="#7a3a00" />
            <Circle cx={-13} cy={-6}  r={2}   fill="#fff8e0" />
            <Circle cx={-13} cy={-6}  r={0.8} fill="#ffcc44" />

            <Circle cx={0}   cy={-13} r={3.5} fill="#7a3a00" />
            <Circle cx={0}   cy={-13} r={2.4} fill="#fff8e0" />
            <Circle cx={0}   cy={-13} r={1}   fill="#ffcc44" />

            <Circle cx={13}  cy={-6}  r={3}   fill="#7a3a00" />
            <Circle cx={13}  cy={-6}  r={2}   fill="#fff8e0" />
            <Circle cx={13}  cy={-6}  r={0.8} fill="#ffcc44" />

            {isLarge && (
              <>
                <Circle cx={0}  cy={11} r={1.6} fill="#ffcc44" opacity={0.8} />
                <Circle cx={-9} cy={11} r={1.1} fill="#ffcc44" opacity={0.5} />
                <Circle cx={9}  cy={11} r={1.1} fill="#ffcc44" opacity={0.5} />
              </>
            )}
          </G>
        </Svg>
      )}

    </View>
  );
}

/* ─────────────────────────────────────────
   Main export
───────────────────────────────────────── */
export default function ProfileRing({ tier, size = 'medium', children }: Props) {
  const focused = useIsFocused();
  switch (tier) {
    case 'cinephile': return <CinephileFrame size={size} active={focused}>{children}</CinephileFrame>;
    case 'critic':    return <CriticFrame    size={size} active={focused}>{children}</CriticFrame>;
    case 'director':  return <DirectorFrame  size={size} active={focused}>{children}</DirectorFrame>;
    default:          return <SpectatorFrame size={size} active={focused}>{children}</SpectatorFrame>;
  }
}
