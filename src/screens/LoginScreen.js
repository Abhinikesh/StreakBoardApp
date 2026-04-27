import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  ActivityIndicator,
  Animated,
  Alert,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import api, { setAuthToken } from '../lib/axios';

// Required for iOS to close the auth session automatically
WebBrowser.maybeCompleteAuthSession();

// ─── Constants ────────────────────────────────────────────────────────────────
const COLORS = {
  bg:            '#0d0d1a',
  card:          '#111120',
  border:        '#1e1e2e',
  borderHover:   '#2a2a3a',
  primary:       '#7c3aed',
  textPrimary:   '#ffffff',
  textSecondary: '#888888',
  textMuted:     '#555555',
  success:       '#10b981',
  danger:        '#ef4444',
};

const OTP_LENGTH = 6;
const EMPTY_OTP  = Array(OTP_LENGTH).fill('');
const BORDER_DEFAULT = COLORS.border;
const BORDER_FOCUSED  = COLORS.primary;

// ─── Component ────────────────────────────────────────────────────────────────
export default function LoginScreen({ navigation }) {
  // Step
  const [step, setStep] = useState(1);

  // Form state
  const [email,   setEmail]   = useState('');
  const [otp,     setOtp]     = useState(EMPTY_OTP);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  // Focus / border colours
  const [emailBorderColor, setEmailBorderColor] = useState(BORDER_DEFAULT);
  const [otpBorderColors,  setOtpBorderColors]  = useState(
    Array(OTP_LENGTH).fill(BORDER_DEFAULT),
  );

  // OTP refs
  const otpRefs = useRef(Array(OTP_LENGTH).fill(null));

  // Entrance animation
  const animOpacity    = useRef(new Animated.Value(0)).current;
  const animTranslateY = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(animOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(animTranslateY, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // ─── OTP helpers ────────────────────────────────────────────────────────────
  const setOtpBorderColor = useCallback((index, color) => {
    setOtpBorderColors((prev) => {
      const next = [...prev];
      next[index] = color;
      return next;
    });
  }, []);

  const handleOtpChange = useCallback(
    (text, index) => {
      // Paste logic: if pasting 6 digits into first box
      if (index === 0 && text.length === OTP_LENGTH && /^\d{6}$/.test(text)) {
        const digits = text.split('');
        setOtp(digits);
        // Focus last box after paste
        otpRefs.current[OTP_LENGTH - 1]?.focus();
        return;
      }

      const digit = text.slice(-1); // take last char
      if (digit && !/^\d$/.test(digit)) return; // digits only

      const next = [...otp];
      next[index] = digit;
      setOtp(next);

      if (digit && index < OTP_LENGTH - 1) {
        otpRefs.current[index + 1]?.focus();
      }
    },
    [otp],
  );

  const handleOtpKeyPress = useCallback(
    (e, index) => {
      if (e.nativeEvent.key === 'Backspace' && otp[index] === '' && index > 0) {
        otpRefs.current[index - 1]?.focus();
      }
    },
    [otp],
  );

  // ─── API calls ──────────────────────────────────────────────────────────────
  const handleSendOTP = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await api.post('/api/auth/send-otp', { email });
      setStep(2);
    } catch (err) {
      setError(
        err.response?.data?.message || 'Failed to send OTP. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  }, [email]);

  const handleVerifyOTP = useCallback(async () => {
    const otpString = otp.join('');
    setLoading(true);
    setError(null);
    try {
      const response = await api.post('/api/auth/verify-otp', {
        email,
        otp: otpString,
      });
      const { token } = response.data;
      await SecureStore.setItemAsync('token', token);
      setAuthToken(token);
      navigation.reset({ index: 0, routes: [{ name: 'Dashboard' }] });
    } catch (err) {
      setError(
        err.response?.data?.message || 'Invalid OTP. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  }, [email, otp, navigation]);

  // ─── Google OAuth ────────────────────────────────────────────────────────────
  const handleGoogleLogin = useCallback(async () => {
    try {
      const redirectUrl = 'streakboard://auth/callback';
      const authUrl =
        'https://streakboard.onrender.com/api/auth/google' +
        '?redirectUrl=' + encodeURIComponent(redirectUrl);

      const result = await WebBrowser.openAuthSessionAsync(
        authUrl,
        redirectUrl,
      );

      if (result.type === 'success' && result.url) {
        // Use regex — new URL() can fail on custom schemes in some RN environments
        const tokenMatch = result.url.match(/token=([^&]+)/);
        const token = tokenMatch ? tokenMatch[1] : null;

        if (token) {
          await SecureStore.setItemAsync('token', token);
          setAuthToken(token);
          navigation.reset({ index: 0, routes: [{ name: 'Dashboard' }] });
        } else {
          setError('Google login failed. No token received.');
        }
      } else if (result.type === 'cancel') {
        // User closed browser — do nothing
      } else {
        setError('Google login failed. Try OTP instead.');
      }
    } catch (err) {
      console.error('Google auth error:', err);
      setError('Google login failed. Try OTP instead.');
    }
  }, [navigation]);

  const handleBackToEmail = useCallback(() => {
    setStep(1);
    setOtp(EMPTY_OTP);
    setError(null);
    setOtpBorderColors(Array(OTP_LENGTH).fill(BORDER_DEFAULT));
  }, []);

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={styles.keyboardView}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Animated card ── */}
        <Animated.View
          style={[
            styles.card,
            {
              opacity:   animOpacity,
              transform: [{ translateY: animTranslateY }],
            },
          ]}
        >
          {/* 1. Brand header */}
          <Text style={styles.brandEmoji}>🔥</Text>
          <Text style={styles.brandName}>StreakBoard</Text>
          <Text style={styles.brandTagline}>
            Track what you do. Not what you plan.
          </Text>

          {/* 2. Section title */}
          <Text style={styles.welcomeTitle}>Welcome back</Text>
          <Text style={styles.welcomeSub}>Log in to see your streak.</Text>

          {/* 3. Google button */}
          <TouchableOpacity
            style={styles.googleBtn}
            activeOpacity={0.7}
            onPress={handleGoogleLogin}
          >
            <Text style={styles.googleG}>G</Text>
            <Text style={styles.googleLabel}>Continue with Google</Text>
          </TouchableOpacity>

          {/* 4. Divider */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or continue with email</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* 5. Email input — step 1 only */}
          {step === 1 && (
            <>
              <Text style={styles.inputLabel}>Email</Text>
              <TextInput
                style={[styles.textInput, { borderColor: emailBorderColor }]}
                placeholder="you@example.com"
                placeholderTextColor={COLORS.textMuted}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                fontSize={16}
                onFocus={() => setEmailBorderColor(BORDER_FOCUSED)}
                onBlur={() => setEmailBorderColor(BORDER_DEFAULT)}
              />

              {/* 6. Send OTP button */}
              <TouchableOpacity
                style={[styles.primaryBtn, loading && styles.primaryBtnDisabled]}
                activeOpacity={0.85}
                onPress={handleSendOTP}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color={COLORS.textPrimary} />
                ) : (
                  <Text style={styles.primaryBtnText}>Send OTP →</Text>
                )}
              </TouchableOpacity>
            </>
          )}

          {/* 7. OTP input row — step 2 only */}
          {step === 2 && (
            <>
              <Text style={styles.otpLabel}>
                Enter the 6-digit code sent to {email}
              </Text>
              <View style={styles.otpRow}>
                {otp.map((digit, i) => (
                  <TextInput
                    key={i}
                    ref={(ref) => {
                      otpRefs.current[i] = ref;
                    }}
                    style={[styles.otpBox, { borderColor: otpBorderColors[i] }]}
                    value={digit}
                    onChangeText={(text) => handleOtpChange(text, i)}
                    onKeyPress={(e) => handleOtpKeyPress(e, i)}
                    keyboardType="number-pad"
                    maxLength={i === 0 ? OTP_LENGTH : 1}
                    textAlign="center"
                    selectionColor={COLORS.primary}
                    onFocus={() => setOtpBorderColor(i, BORDER_FOCUSED)}
                    onBlur={() => setOtpBorderColor(i, BORDER_DEFAULT)}
                    fontSize={20}
                  />
                ))}
              </View>

              {/* 8. Verify button */}
              <TouchableOpacity
                style={[
                  styles.primaryBtn,
                  (loading || otp.join('').length < OTP_LENGTH) &&
                    styles.primaryBtnDisabled,
                ]}
                activeOpacity={0.85}
                onPress={handleVerifyOTP}
                disabled={loading || otp.join('').length < OTP_LENGTH}
              >
                {loading ? (
                  <ActivityIndicator color={COLORS.textPrimary} />
                ) : (
                  <Text style={styles.primaryBtnText}>Verify & Log in →</Text>
                )}
              </TouchableOpacity>

              {/* 9. Back to email */}
              <TouchableOpacity onPress={handleBackToEmail}>
                <Text style={styles.backLink}>← Change email</Text>
              </TouchableOpacity>
            </>
          )}

          {/* 10. Error message */}
          {error !== null && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },

  // Card
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 28,
  },

  // Brand
  brandEmoji: {
    fontSize: 36,
    textAlign: 'center',
  },
  brandName: {
    color: COLORS.primary,
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 6,
  },
  brandTagline: {
    color: COLORS.textMuted,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },

  // Section titles
  welcomeTitle: {
    color: COLORS.textPrimary,
    fontSize: 20,
    fontWeight: '700',
    marginTop: 24,
    marginBottom: 4,
  },
  welcomeSub: {
    color: COLORS.textSecondary,
    fontSize: 14,
    marginBottom: 24,
  },

  // Google button
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2a2a3a',
    backgroundColor: 'transparent',
    marginBottom: 20,
  },
  googleG: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  googleLabel: {
    color: COLORS.textPrimary,
    fontSize: 14,
    marginLeft: 10,
  },

  // Divider
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
  },
  dividerText: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginHorizontal: 12,
  },

  // Input label
  inputLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginBottom: 6,
  },

  // Text input (email)
  textInput: {
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 50,
    color: COLORS.textPrimary,
    fontSize: 16,
    marginBottom: 16,
  },

  // Primary button
  primaryBtn: {
    width: '100%',
    height: 52,
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  primaryBtnDisabled: {
    opacity: 0.6,
  },
  primaryBtnText: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },

  // OTP
  otpLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginBottom: 12,
    textAlign: 'center',
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  otpBox: {
    width: 44,
    height: 52,
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderRadius: 12,
    color: COLORS.textPrimary,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },

  // Back link
  backLink: {
    color: COLORS.textMuted,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 12,
  },

  // Error
  errorBox: {
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.2)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 12,
  },
  errorText: {
    color: COLORS.danger,
    fontSize: 12,
    textAlign: 'center',
  },
});
