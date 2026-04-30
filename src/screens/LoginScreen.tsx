import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, ScrollView,
  Animated, Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail, updateProfile, GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { auth } from '../lib/firebase';
import { setUserProfile, checkUsernameExists, getUserProfile } from '../lib/firestore';
import { registerForPushNotifications } from '../lib/notifications';
import { colors } from '../theme/colors';
import { getFriendlyError } from '../utils/errorMessages';
import t from '../i18n';

GoogleSignin.configure({
  webClientId: '226486672662-7hl37cks66rl2o37cv1cja6uveg4sl5m.apps.googleusercontent.com',
});


export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [username, setUsername] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [splashDone, setSplashDone] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const [googleLoading, setGoogleLoading] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);

  const logoScale = useRef(new Animated.Value(0.3)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(logoOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(logoScale, { toValue: 1.2, duration: 800, easing: Easing.out(Easing.back(1.5)), useNativeDriver: true }),
      ]),
      Animated.timing(logoScale, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.delay(400),
      Animated.timing(contentOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
    ]).start(() => setSplashDone(true));
  }, []);

  const getErrorMessage = (error: any): string => {
    const code = error.code || '';
    if (code.includes('email-already-in-use')) return t.emailAlreadyInUse;
    if (code.includes('invalid-email')) return t.invalidEmail;
    if (code.includes('weak-password')) return t.weakPassword;
    if (code.includes('user-not-found')) return t.userNotFound;
    if (code.includes('wrong-password')) return t.wrongPassword;
    if (code.includes('invalid-credential')) return t.invalidCredential;
    if (code.includes('too-many-requests')) return t.tooManyRequests;
    if (code.includes('network-request-failed')) return t.networkError;
    return t.somethingWentWrong;
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      await GoogleSignin.hasPlayServices();
      const response = await GoogleSignin.signIn();
      const idToken = response.data?.idToken;
      if (!idToken) throw new Error('No ID token returned');
      const credential = GoogleAuthProvider.credential(idToken);
      const cred = await signInWithCredential(auth, credential);
      // Create profile if first time
      const existing = await getUserProfile(cred.user.uid);
      if (!existing) {
        const name = cred.user.displayName || cred.user.email?.split('@')[0] || 'User';
        await setUserProfile(cred.user.uid, {
          email: cred.user.email || '',
          displayName: name,
          photoURL: cred.user.photoURL || undefined,
          marketingOptIn,
        });
      }
      registerForPushNotifications(cred.user.uid).catch(() => {});
    } catch (err: any) {
      if (err.code !== 'SIGN_IN_CANCELLED') {
        Alert.alert(t.error, getFriendlyError(err, t.googleSignInFailed));
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      Alert.alert(t.error, t.enterEmailToReset);
      return;
    }
    setResetLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      Alert.alert(t.resetEmailSent, t.resetEmailSentBody);
    } catch (err: any) {
      Alert.alert(t.error, getErrorMessage(err));
    } finally {
      setResetLoading(false);
    }
  };

  const handleAuth = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert(t.error, t.enterEmailAndPassword);
      return;
    }
    setLoading(true);
    try {
      if (isSignUp) {
        if (!username.trim()) { Alert.alert(t.error, t.usernameRequired); setLoading(false); return; }
        if (username.includes(' ')) { Alert.alert(t.error, t.usernameNoSpaces); setLoading(false); return; }
        if (password !== confirmPassword) { Alert.alert(t.error, t.passwordsNoMatch); setLoading(false); return; }
        const exists = await checkUsernameExists(username);
        if (exists) { Alert.alert(t.error, t.usernameTaken); setLoading(false); return; }
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        await updateProfile(cred.user, { displayName: username.trim() });
        await setUserProfile(cred.user.uid, { email: email.trim(), displayName: username.trim(), marketingOptIn });
        await sendEmailVerification(cred.user);
        registerForPushNotifications(cred.user.uid).catch(() => {});
        Alert.alert(t.checkEmail, t.checkEmailBody);
      } else {
        const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
        registerForPushNotifications(cred.user.uid).catch(() => {});
        if (!cred.user.emailVerified) {
          Alert.alert(t.verifyEmail, t.verifyEmailBody);
        }
      }
    } catch (err: any) {
      Alert.alert(t.error, getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={[s.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <LinearGradient colors={['#0d0d0d', '#1a0505', '#0a0a0a']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <Animated.View style={{ opacity: logoOpacity, transform: [{ scale: logoScale }] }}>
          <Text style={s.logo}>CINE<Text style={s.logoAccent}>LYSE</Text></Text>
          <Text style={s.tagline}>{t.tagline}</Text>
        </Animated.View>

        <Animated.View style={{ opacity: contentOpacity, width: '100%' }}>

        <View style={s.form}>

          {isSignUp && (
            <View style={s.fieldWrap}>
              <Text style={s.label}>{t.username}</Text>
              <View style={s.inputWrap}>
                <Ionicons name="person-outline" size={16} color={colors.subtle} style={s.inputIcon} />
                <TextInput
                  style={s.input}
                  placeholder={t.chooseUsername}
                  placeholderTextColor={colors.subtle}
                  value={username}
                  onChangeText={(v) => setUsername(v.replace(/\s/g, ''))}
                  autoCapitalize="none"
                />
              </View>
            </View>
          )}

          <View style={s.fieldWrap}>
            <Text style={s.label}>{t.email}</Text>
            <View style={s.inputWrap}>
              <Ionicons name="mail-outline" size={16} color={colors.subtle} style={s.inputIcon} />
              <TextInput
                style={s.input}
                placeholder={t.emailPlaceholder}
                placeholderTextColor={colors.subtle}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
          </View>

          <View style={s.fieldWrap}>
            <Text style={s.label}>{t.password}</Text>
            <View style={s.inputWrap}>
              <Ionicons name="lock-closed-outline" size={16} color={colors.subtle} style={s.inputIcon} />
              <TextInput
                style={[s.input, { paddingRight: 48 }]}
                placeholder="••••••••"
                placeholderTextColor={colors.subtle}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity style={s.eyeBtn} onPress={() => setShowPassword(!showPassword)}>
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.subtle} />
              </TouchableOpacity>
            </View>
          </View>

          {isSignUp && (
            <View style={s.fieldWrap}>
              <Text style={s.label}>{t.confirmPassword}</Text>
              <View style={s.inputWrap}>
                <Ionicons name="lock-closed-outline" size={16} color={colors.subtle} style={s.inputIcon} />
                <TextInput
                  style={s.input}
                  placeholder="••••••••"
                  placeholderTextColor={colors.subtle}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showPassword}
                />
              </View>
            </View>
          )}

          {!isSignUp && (
            <TouchableOpacity onPress={handleForgotPassword} disabled={resetLoading} style={s.forgotBtn}>
              <Text style={s.forgotText}>{resetLoading ? t.loading : t.forgotPassword}</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={s.btn} onPress={handleAuth} disabled={loading} activeOpacity={0.8}>
            {loading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <View style={s.btnInner}>
                <Text style={s.btnText}>{isSignUp ? t.createAccount : t.signIn}</Text>
                <Ionicons name="arrow-forward" size={18} color={colors.white} />
              </View>
            )}
          </TouchableOpacity>

          {isSignUp && (
            <TouchableOpacity style={s.checkboxRow} onPress={() => setMarketingOptIn(!marketingOptIn)} activeOpacity={0.7}>
              <View style={[s.checkbox, marketingOptIn && s.checkboxActive]}>
                {marketingOptIn && <Ionicons name="checkmark" size={14} color={colors.white} />}
              </View>
              <Text style={s.checkboxText}>{t.marketingOptIn}</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity onPress={() => { setIsSignUp(!isSignUp); setConfirmPassword(''); }} style={s.toggle}>
            <Text style={s.toggleText}>
              {isSignUp ? t.alreadyHaveAccount : t.dontHaveAccount}
              <Text style={s.toggleAccent}>{isSignUp ? t.signInLink : t.signUpFree}</Text>
            </Text>
          </TouchableOpacity>

          <View style={s.divider}>
            <View style={s.dividerLine} />
            <Text style={s.dividerText}>{t.or}</Text>
            <View style={s.dividerLine} />
          </View>

          <TouchableOpacity style={s.googleBtn} onPress={handleGoogleSignIn} disabled={googleLoading} activeOpacity={0.8}>
            {googleLoading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <View style={s.btnInner}>
                <Ionicons name="logo-google" size={18} color={colors.white} />
                <Text style={s.googleBtnText}>{t.continueWithGoogle}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.black },
  scroll: { flexGrow: 1, padding: 24, paddingBottom: 40 },
  logo: { fontSize: 42, fontWeight: '900', color: colors.white, letterSpacing: -1, textAlign: 'center' },
  logoAccent: { color: colors.red },
  tagline: { color: colors.muted, fontSize: 14, textAlign: 'center', marginTop: 6, marginBottom: 20 },
  form: { gap: 12 },
  fieldWrap: { gap: 6 },
  label: { color: colors.muted, fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
  inputWrap: { position: 'relative' },
  inputIcon: { position: 'absolute', left: 14, top: 16, zIndex: 1 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10, padding: 14, paddingLeft: 42, fontSize: 15, color: colors.text,
  },
  eyeBtn: { position: 'absolute', right: 14, top: 14 },
  btn: {
    backgroundColor: colors.red, borderRadius: 10, padding: 16,
    alignItems: 'center', marginTop: 8,
  },
  btnInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btnText: { color: colors.white, fontSize: 16, fontWeight: '700' },
  toggle: { alignItems: 'center', marginTop: 8 },
  toggleText: { color: colors.muted, fontSize: 14 },
  toggleAccent: { color: colors.red, fontWeight: '700' },
  divider: { flexDirection: 'row', alignItems: 'center', marginTop: 12, marginBottom: 4 },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.1)' },
  dividerText: { color: colors.subtle, fontSize: 12, fontWeight: '600', marginHorizontal: 12 },
  googleBtn: {
    backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 10, padding: 16, alignItems: 'center',
  },
  googleBtnText: { color: colors.white, fontSize: 16, fontWeight: '700' },
  checkboxRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 4 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.2)', backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  checkboxActive: { backgroundColor: colors.red, borderColor: colors.red },
  checkboxText: { color: colors.subtle, fontSize: 12, lineHeight: 18, flex: 1 },
  forgotBtn: { alignSelf: 'flex-end', marginTop: 4 },
  forgotText: { color: colors.red, fontSize: 13, fontWeight: '600' },
});
