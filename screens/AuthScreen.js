import React, { useState } from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, ActivityIndicator, Alert, Image, Modal
} from 'react-native';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile,
  GoogleAuthProvider,
  signInWithCredential,
  getMultiFactorResolver,
  TotpMultiFactorGenerator,
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth, db } from '../firebase';
import CountrySheet from '../components/CountryPicker';
import { useTheme } from '../context/ThemeContext';
import { showAlert } from '../components/BrandedAlert';

const BACKEND = 'https://api.fitlifesolutions.site';
const MAX_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

export default function AuthScreen({ navigation }) {
  const { theme, isDark } = useTheme();
  const [isLogin, setIsLogin] = useState(true);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [country, setCountry] = useState('');
  const [showCountrySheet, setShowCountrySheet] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState(null);
  const [mfaResolver, setMfaResolver] = useState(null);
  const [showMfaPrompt, setShowMfaPrompt] = useState(false);
  const [mfaLoginCode, setMfaLoginCode] = useState('');
  const [mfaLoading, setMfaLoading] = useState(false);

  React.useEffect(() => {
    GoogleSignin.configure({
      webClientId: '527163602306-0md351bdfr597aa0s3jjd78tcku847t0.apps.googleusercontent.com',
    });
  }, []);

  React.useEffect(() => {
    if (!email) {
      setFailedAttempts(0);
      setLockedUntil(null);
      return;
    }
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(`lockout_${email.toLowerCase()}`);
        if (raw) {
          const data = JSON.parse(raw);
          setFailedAttempts(data.attempts || 0);
          setLockedUntil(data.lockedUntil || null);
        } else {
          setFailedAttempts(0);
          setLockedUntil(null);
        }
      } catch (e) {
        // ignore storage read errors, fall back to in-memory state
      }
    })();
  }, [email]);

  const isLockedOut = () => {
    if (!lockedUntil) return false;
    if (Date.now() < lockedUntil) return true;
    setLockedUntil(null);
    setFailedAttempts(0);
    if (email) AsyncStorage.removeItem(`lockout_${email.toLowerCase()}`).catch(() => {});
    return false;
  };

  const getRemainingLockoutMinutes = () => {
    if (!lockedUntil) return 0;
    return Math.ceil((lockedUntil - Date.now()) / 60000);
  };

  const handleFailedAttempt = () => {
    const newCount = failedAttempts + 1;
    setFailedAttempts(newCount);
    let lockUntil = null;
    if (newCount >= MAX_ATTEMPTS) {
      lockUntil = Date.now() + LOCKOUT_MINUTES * 60 * 1000;
      setLockedUntil(lockUntil);
      showAlert('Account Locked', `Too many failed attempts. Please try again in ${LOCKOUT_MINUTES} minutes.`);
    }
    if (email) {
      AsyncStorage.setItem(
        `lockout_${email.toLowerCase()}`,
        JSON.stringify({ attempts: newCount, lockedUntil: lockUntil })
      ).catch(() => {});
    }
  };

  const handleVerifyMfaLogin = async () => {
    if (mfaLoginCode.length !== 6) {
      return showAlert('Error', 'Enter the 6-digit code from your authenticator app.');
    }
    try {
      setMfaLoading(true);
      const factorInfo = mfaResolver.hints[0];
      const cred = TotpMultiFactorGenerator.assertionForSignIn(factorInfo.uid, mfaLoginCode);
      await mfaResolver.resolveSignIn(cred);
      setShowMfaPrompt(false);
      setMfaLoginCode('');
      setMfaResolver(null);
      setFailedAttempts(0);
      setLockedUntil(null);
      if (email) AsyncStorage.removeItem(`lockout_${email.toLowerCase()}`).catch(() => {});
    } catch (e) {
      showAlert('Invalid Code', 'The code is incorrect or expired. Try again.');
    } finally {
      setMfaLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (isLockedOut()) {
      return showAlert('Too Many Attempts', `Please wait ${getRemainingLockoutMinutes()} more minute(s) before trying again.`);
    }
    try {
      setLoading(true);
      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();
      const idToken = userInfo.data?.idToken || userInfo.idToken;
      const credential = GoogleAuthProvider.credential(idToken);
      await signInWithCredential(auth, credential);
      setFailedAttempts(0);
      setLockedUntil(null);
    } catch (error) {
      handleFailedAttempt();
      showAlert('Google Sign-In Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const getFriendlyError = (error) => {
    switch (error.code) {
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return 'Incorrect email or password';
      case 'auth/email-already-in-use':
        return 'An account with this email already exists';
      case 'auth/weak-password':
        return 'Password should be at least 6 characters';
      case 'auth/invalid-email':
        return 'Please enter a valid email address';
      case 'auth/too-many-requests':
        return 'Too many attempts. Please try again later';
      default:
        return error.message;
    }
  };

  const handleSubmit = async () => {
    if (isLockedOut()) {
      return showAlert('Too Many Attempts', `Please wait ${getRemainingLockoutMinutes()} more minute(s) before trying again.`);
    }
    if (!email || !password) return showAlert('Error', 'Please fill all fields');
    if (!isLogin && (!fullName.trim() || !country)) {
      return showAlert('Error', 'Please enter your full name and select your country');
    }
    setLoading(true);
    try {
      if (isLogin) {
        const userCred = await signInWithEmailAndPassword(auth, email, password);
        if (!userCred.user.emailVerified) {
          await auth.signOut();
          showAlert('Email Not Verified', 'Please verify your email before logging in.', [
            { text: 'Resend Email', onPress: async () => { await sendEmailVerification(userCred.user); showAlert('Sent!', 'Verification email resent.'); }},
            { text: 'OK' },
          ]);
          setLoading(false);
          return;
        }
        setFailedAttempts(0);
        setLockedUntil(null);
        if (email) AsyncStorage.removeItem(`lockout_${email.toLowerCase()}`).catch(() => {});
      } else {
        if (password !== confirmPassword) {
          setLoading(false);
          return showAlert('Error', 'Passwords do not match');
        }
        const userCred = await createUserWithEmailAndPassword(auth, email, password);
        // The app's own convention: ProfileScreen reads and writes the name through
        // Firebase Auth's built-in displayName, not a custom field, so sign-up feeds
        // the same one rather than starting a second, disconnected copy of it.
        await updateProfile(userCred.user, { displayName: fullName.trim() });
        // displayName has nowhere to put a country. This is the one field that needs
        // its own record, kept minimal - just what was asked for, not a profile
        // schema nothing yet reads. Its own try/catch, and deliberately not fatal:
        // the account and its display name already exist by this point, and a
        // Firestore hiccup here must not cost the person the verification email that
        // is the one thing standing between them and actually being able to log in.
        try {
          // Credits/plan fields written explicitly here rather than left to
          // the backend's lazy-init (tiers.js's getUserPlanData, which only
          // ever fires on a render attempt - a migration safety net for
          // accounts that predate this feature, not meant to be the primary
          // path). Without this, a brand new account would show no credits
          // at all on the Profile screen until its first render request.
          // 5 credits / 30-day window must match TIERS.free in
          // ~/Tonefy-react/backend/tiers.js - duplicated across repos on
          // purpose (no shared package between them), not a value to change
          // in only one place.
          await setDoc(doc(db, 'users', userCred.user.uid), {
            fullName: fullName.trim(),
            email: email.trim(),
            country,
            createdAt: serverTimestamp(),
            plan: 'free',
            creditsRemaining: 5,
            creditsResetAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            subscriptionStatus: null,
          });
        } catch (profileErr) {
          console.warn('[signup] could not write user profile:', profileErr.message);
        }
        // The Tonefy-branded email (real logo/green button, not a raw link) from
        // the backend's own SMTP account, replacing Firebase's default template -
        // that template turned out not to be editable once CUSTOM_SMTP is
        // configured for this project (confirmed against the live Identity
        // Platform config, not assumed). Falls back to Firebase's own default
        // verification email if the backend call fails for any reason - the
        // one thing worse than an unbranded email is no email at all.
        try {
          const idToken = await userCred.user.getIdToken();
          const res = await fetch(BACKEND + '/api/send-verification-email', {
            method: 'POST',
            headers: { Authorization: 'Bearer ' + idToken },
          });
          if (!res.ok) throw new Error('backend send failed: ' + res.status);
        } catch (mailErr) {
          console.warn('[signup] branded verification email failed, falling back:', mailErr.message);
          await sendEmailVerification(userCred.user);
        }
        await auth.signOut();
        showAlert('Account Created!', 'A verification email has been sent to ' + email + '. Please verify before logging in.');
        setIsLogin(true);
        setFullName('');
        setPassword('');
        setConfirmPassword('');
        setCountry('');
      }
    } catch (error) {
      if (error.code === 'auth/multi-factor-auth-required') {
        const resolver = getMultiFactorResolver(auth, error);
        setMfaResolver(resolver);
        setShowMfaPrompt(true);
      } else {
        handleFailedAttempt();
        showAlert('Error', getFriendlyError(error));
      }
    }
    setLoading(false);
  };

  const RESET_COOLDOWN_SECONDS = 60;

  const handleForgotPassword = async () => {
    if (!email) return showAlert('Error', 'Enter your email first');
    const key = `reset_cooldown_${email.toLowerCase()}`;
    try {
      const lastSentRaw = await AsyncStorage.getItem(key);
      if (lastSentRaw) {
        const lastSent = parseInt(lastSentRaw, 10);
        const elapsed = (Date.now() - lastSent) / 1000;
        if (elapsed < RESET_COOLDOWN_SECONDS) {
          const remaining = Math.ceil(RESET_COOLDOWN_SECONDS - elapsed);
          return showAlert('Please Wait', `You can request another reset email in ${remaining} second(s).`);
        }
      }
      await sendPasswordResetEmail(auth, email);
      await AsyncStorage.setItem(key, Date.now().toString());
      showAlert('Success', 'Password reset email sent!');
    } catch (error) {
      showAlert('Error', error.message);
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.bg }]} contentContainerStyle={styles.content}>
      <Text style={[styles.logo, { color: theme.accent }]}>Tonefy AI</Text>
      <Text style={[styles.title, { color: theme.text }]}>{isLogin ? 'Login to Tonefy' : 'Create Account'}</Text>

      {isLockedOut() && (
        <View style={[styles.lockoutBanner, { backgroundColor: isDark ? '#3a0000' : '#ffe5e5' }]}>
          <Text style={[styles.lockoutText, { color: isDark ? '#ff6666' : '#cc0000' }]}>Account locked. Try again in {getRemainingLockoutMinutes()} minute(s).</Text>
        </View>
      )}

      {failedAttempts > 0 && failedAttempts < MAX_ATTEMPTS && !isLockedOut() && (
        <View style={[styles.warningBanner, { backgroundColor: isDark ? '#2a1f00' : '#fff3cd' }]}>
          <Text style={[styles.warningText, { color: isDark ? '#ffcc44' : '#8a6500' }]}>{MAX_ATTEMPTS - failedAttempts} attempt(s) remaining before lockout</Text>
        </View>
      )}

      {!isLogin && (
        <TextInput
          style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.text }]}
          placeholder="Full Name"
          placeholderTextColor={theme.subtext}
          value={fullName}
          onChangeText={setFullName}
          autoCapitalize="words"
          textContentType="name"
        />
      )}

      <TextInput style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.text }]} placeholder="Email" placeholderTextColor={theme.subtext} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />

      {!isLogin && (
        <TouchableOpacity style={[styles.countryRow, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder }]} onPress={() => setShowCountrySheet(true)}>
          <MaterialIcons name="public" size={20} color={country ? theme.text : theme.subtext} />
          <Text style={[styles.countryText, { color: country ? theme.text : theme.subtext }]}>
            {country || 'Country'}
          </Text>
          <MaterialIcons name="expand-more" size={22} color={theme.icon} />
        </TouchableOpacity>
      )}

      <View style={styles.passwordRow}>
        <TextInput style={[styles.input, { flex: 1, backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.text }]} placeholder="Password" placeholderTextColor={theme.subtext} value={password} onChangeText={setPassword} secureTextEntry={!showPassword} />
        <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={[styles.eyeBtn, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder }]}>
          <MaterialIcons name={showPassword ? 'visibility-off' : 'visibility'} size={20} color={theme.icon} />
        </TouchableOpacity>
      </View>

      {!isLogin && (
        <TextInput style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.text }]} placeholder="Confirm Password" placeholderTextColor={theme.subtext} value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry />
      )}

      {isLogin && (
        <TouchableOpacity onPress={handleForgotPassword}>
          <Text style={[styles.forgotText, { color: theme.accent }]}>Forgot Password?</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity style={[styles.submitBtn, { backgroundColor: theme.accent }, isLockedOut() && styles.disabledBtn]} onPress={handleSubmit} disabled={loading || isLockedOut()}>
        {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.submitText}>{isLogin ? 'Login' : 'Sign Up'}</Text>}
      </TouchableOpacity>

      <View style={styles.divider}>
        <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
        <Text style={[styles.dividerText, { color: theme.subtext }]}>OR</Text>
        <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
      </View>

      <TouchableOpacity style={[styles.googleBtn, isLockedOut() && styles.disabledBtn]} onPress={handleGoogleSignIn} disabled={loading || isLockedOut()}>
        <Image source={require('../assets/google-logo.png')} style={{ width: 20, height: 20, marginRight: 10 }} />
        <Text style={styles.googleText}>Continue with Google</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => setIsLogin(!isLogin)}>
        <Text style={[styles.switchText, { color: theme.subtext }]}>
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <Text style={[styles.switchLink, { color: theme.accent }]}>{isLogin ? 'Sign Up' : 'Login'}</Text>
        </Text>
      </TouchableOpacity>

      <Modal visible={showMfaPrompt} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <View style={{ backgroundColor: theme.settingBg, borderRadius: 20, padding: 24, width: '100%', alignItems: 'center' }}>
            <Text style={{ color: theme.text, fontSize: 18, fontWeight: '700', marginBottom: 8 }}>Two-Factor Authentication</Text>
            <Text style={{ color: theme.subtext, fontSize: 13, textAlign: 'center', marginBottom: 20 }}>
              Enter the 6-digit code from your authenticator app.
            </Text>
            <TextInput
              style={{ backgroundColor: theme.inputBg, color: theme.text, borderRadius: 12, padding: 14, width: '100%', fontSize: 22, letterSpacing: 8, textAlign: 'center', borderWidth: 1, borderColor: theme.inputBorder }}
              placeholder="000000"
              placeholderTextColor={theme.subtext}
              value={mfaLoginCode}
              onChangeText={setMfaLoginCode}
              keyboardType="number-pad"
              maxLength={6}
            />
            <TouchableOpacity
              style={{ marginTop: 16, backgroundColor: theme.accent, borderRadius: 12, padding: 14, width: '100%', alignItems: 'center' }}
              onPress={handleVerifyMfaLogin}
              disabled={mfaLoading}
            >
              {mfaLoading ? <ActivityIndicator color="#000" /> : <Text style={{ color: '#000', fontWeight: '700', fontSize: 15 }}>Verify</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setShowMfaPrompt(false); setMfaLoginCode(''); setMfaResolver(null); }} style={{ marginTop: 12 }}>
              <Text style={{ color: theme.subtext, fontSize: 13 }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <CountrySheet
        visible={showCountrySheet}
        value={country}
        onSelect={setCountry}
        onClose={() => setShowCountrySheet(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  content: { padding: 24, paddingTop: 80, alignItems: 'center' },
  logo: { color: '#2ecc71', fontSize: 28, fontWeight: 'bold', marginBottom: 8 },
  title: { color: '#fff', fontSize: 22, fontWeight: 'bold', marginBottom: 32 },
  input: { backgroundColor: '#1a1a1a', color: '#fff', borderRadius: 10, padding: 14, width: '100%', marginBottom: 14, borderWidth: 1, borderColor: '#333', fontSize: 15 },
  passwordRow: { flexDirection: 'row', alignItems: 'center', width: '100%', marginBottom: 14 },
  eyeBtn: { padding: 14, backgroundColor: '#1a1a1a', borderRadius: 10, marginLeft: 8, borderWidth: 1, borderColor: '#333' },
  eyeText: { fontSize: 18 },
  forgotText: { color: '#2ecc71', alignSelf: 'flex-end', marginBottom: 20, fontSize: 13 },
  submitBtn: { backgroundColor: '#2ecc71', borderRadius: 25, padding: 16, width: '100%', alignItems: 'center', marginBottom: 20 },
  submitText: { color: '#000', fontWeight: 'bold', fontSize: 16 },
  disabledBtn: { opacity: 0.4 },
  divider: { flexDirection: 'row', alignItems: 'center', width: '100%', marginBottom: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#333' },
  dividerText: { color: '#666', marginHorizontal: 12, fontSize: 13 },
  googleBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', borderRadius: 25, padding: 14, width: '100%', marginBottom: 24 },
  googleText: { color: '#333', fontWeight: 'bold', fontSize: 15 },
  switchText: { color: '#aaa', fontSize: 14, textAlign: 'center' },
  switchLink: { color: '#2ecc71', fontWeight: 'bold' },
  countryRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#1a1a1a',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 14, width: '100%',
    marginBottom: 14, borderWidth: 1, borderColor: '#333',
  },
  countryText: { flex: 1, color: '#fff', fontSize: 15 },
  countryPlaceholder: { color: '#666' },
  lockoutBanner: { backgroundColor: '#3a0000', borderRadius: 10, padding: 12, width: '100%', marginBottom: 16, borderWidth: 1, borderColor: '#ff4444' },
  lockoutText: { color: '#ff6666', fontSize: 13, textAlign: 'center', fontWeight: '600' },
  warningBanner: { backgroundColor: '#2a1f00', borderRadius: 10, padding: 12, width: '100%', marginBottom: 16, borderWidth: 1, borderColor: '#ffaa00' },
  warningText: { color: '#ffcc44', fontSize: 13, textAlign: 'center', fontWeight: '600' },
});
