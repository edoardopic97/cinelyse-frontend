import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { sendEmailVerification, signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { colors } from '../theme/colors';
import t from '../i18n';

export default function VerifyEmailScreen() {
  const { refreshUser } = useAuth();
  const insets = useSafeAreaInsets();
  const [sending, setSending] = useState(false);
  const [checking, setChecking] = useState(false);



  const handleResend = async () => {
    if (!auth.currentUser) return;
    setSending(true);
    try {
      await sendEmailVerification(auth.currentUser);
      Alert.alert(t.sent, t.verificationSent);
    } catch (err: any) {
      Alert.alert(t.error, err.code?.includes('too-many-requests') ? t.tooManyAttempts : t.failedToSend);
    } finally { setSending(false); }
  };

  const handleCheck = async () => {
    if (!auth.currentUser) return;
    setChecking(true);
    try {
      await auth.currentUser.reload();
      if (auth.currentUser.emailVerified) {
        await refreshUser();
      } else {
        Alert.alert(t.notVerifiedYet, t.checkEmailFirst);
      }
    } catch {} finally { setChecking(false); }
  };

  const handleSignOut = () => signOut(auth);

  return (
    <View style={[s.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={s.card}>
        <View style={s.iconWrap}>
          <Ionicons name="mail-outline" size={48} color={colors.red} />
        </View>
        <Text style={s.title}>{t.verifyYourEmail}</Text>
        <Text style={s.sub}>{t.weSentVerification}</Text>
        <Text style={s.email}>{auth.currentUser?.email}</Text>
        <Text style={s.desc}>{t.clickLinkToActivate}</Text>

        <TouchableOpacity style={s.primaryBtn} onPress={handleCheck} disabled={checking}>
          {checking ? <ActivityIndicator color={colors.white} size="small" /> : (
            <><Ionicons name="refresh" size={16} color={colors.white} /><Text style={s.primaryText}>{t.iveVerified}</Text></>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={s.secondaryBtn} onPress={handleResend} disabled={sending}>
          {sending ? <ActivityIndicator color={colors.red} size="small" /> : (
            <><Ionicons name="send-outline" size={14} color={colors.red} /><Text style={s.secondaryText}>{t.resendEmail}</Text></>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={s.signOutBtn} onPress={handleSignOut}>
          <Ionicons name="log-out-outline" size={14} color={colors.muted} />
          <Text style={s.signOutText}>{t.signOut}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.black, alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', backgroundColor: 'rgba(255,255,255,0.02)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 20, padding: 28, alignItems: 'center' },
  iconWrap: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(229,9,20,0.12)', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  title: { color: colors.white, fontSize: 22, fontWeight: '900', marginBottom: 8 },
  sub: { color: colors.muted, fontSize: 14 },
  email: { color: colors.text, fontSize: 15, fontWeight: '700', marginBottom: 12 },
  desc: { color: colors.subtle, fontSize: 13, textAlign: 'center', lineHeight: 20, marginBottom: 28 },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.red, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 24, width: '100%', justifyContent: 'center', marginBottom: 12 },
  primaryText: { color: colors.white, fontSize: 15, fontWeight: '700' },
  secondaryBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(229,9,20,0.12)', borderWidth: 1, borderColor: 'rgba(229,9,20,0.3)', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 20, width: '100%', justifyContent: 'center', marginBottom: 12 },
  secondaryText: { color: colors.red, fontSize: 14, fontWeight: '600' },
  signOutBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10 },
  signOutText: { color: colors.muted, fontSize: 13, fontWeight: '600' },
});
