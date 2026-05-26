import { useState } from 'react';
import { View, Text, Pressable, ScrollView, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../../components/button';
import { TextField } from '../../components/text-field';
import { haptics } from '../../lib/haptics';
import { supabase } from '../../../lib/supabase';
import { colors, space, text } from '../../theme';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignUpScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [needsConfirm, setNeedsConfirm] = useState(false);

  const emailValid = EMAIL_RE.test(email);
  const passwordValid = password.length >= 6;
  const canSubmit = emailValid && passwordValid && !submitting;

  const signUp = async () => {
    if (!canSubmit) return;
    setError(null);
    setSubmitting(true);
    try {
      const { data, error: e } = await supabase.auth.signUp({ email, password });
      if (e) {
        setError(e.message);
        haptics.error();
        return;
      }
      // supabase returns a session immediately when email confirmation is off;
      // otherwise needs the user to click the email link.
      if (data?.session) {
        haptics.success();
        router.replace('/welcome');
      } else {
        setNeedsConfirm(true);
        haptics.tap();
      }
    } catch (e) {
      setError(e?.message ?? 'Network error. Try again.');
      haptics.error();
    } finally {
      setSubmitting(false);
    }
  };

  if (needsConfirm) {
    return (
      <View style={[styles.root, styles.confirmWrap, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <Text style={styles.confirmHeading}>Check your email</Text>
        <Text style={styles.confirmBody}>
          We sent a confirmation link to <Text style={styles.email}>{email}</Text>. Open the link to verify your account, then come back here to sign in.
        </Text>
        <Button variant="primary" onPress={() => router.replace('/sign-in')} fullWidth accessibilityLabel="Back to sign in">
          Back to sign in
        </Button>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={insets.top}
    >
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + space[6], paddingBottom: insets.bottom + space[5] }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.heading}>Create your account</Text>
        <Text style={styles.lede}>Just an email and a password. You'll set notifications and a starter watchlist next.</Text>

        <View style={styles.form}>
          <TextField
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="next"
            editable={!submitting}
          />
          <TextField
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="At least 6 characters"
            secureTextEntry
            autoComplete="password-new"
            textContentType="newPassword"
            returnKeyType="go"
            onSubmitEditing={signUp}
            editable={!submitting}
          />
          {error ? <Text style={styles.formError}>{error}</Text> : null}

          <Button
            variant="primary"
            onPress={signUp}
            disabled={!canSubmit}
            loading={submitting}
            fullWidth
            accessibilityLabel="Create account"
          >
            Create account
          </Button>

          <Text style={styles.agreeNote}>
            By creating an account you agree to the Terms of Service and Privacy Policy, available in Settings.
          </Text>
        </View>

        <Pressable
          onPress={() => { haptics.tap(); router.replace('/sign-in'); }}
          hitSlop={10}
          accessibilityRole="link"
          accessibilityLabel="Sign in to an existing account"
          style={({ pressed }) => [styles.footerLink, pressed && { opacity: 0.6 }]}
        >
          <Text style={styles.footerText}>
            Already have an account? <Text style={styles.footerCta}>Sign in</Text>
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg.base },
  scroll: {
    paddingHorizontal: space[5],
    flexGrow: 1,
  },
  heading: { ...text.displaySm, color: colors.text.primary },
  lede: {
    ...text.body,
    color: colors.text.secondary,
    marginTop: space[2],
    marginBottom: space[6],
  },
  form: { gap: space[4] },
  formError: { ...text.footnote, color: colors.signal.negative },
  agreeNote: {
    ...text.footnote,
    color: colors.text.tertiary,
    textAlign: 'center',
    marginTop: space[2],
  },

  footerLink: { marginTop: space[6], alignItems: 'center' },
  footerText: { ...text.body, color: colors.text.secondary },
  footerCta: { color: colors.accent.default },

  confirmWrap: {
    paddingHorizontal: space[5],
    justifyContent: 'center',
    gap: space[4],
  },
  confirmHeading: { ...text.displaySm, color: colors.text.primary },
  confirmBody: { ...text.body, color: colors.text.secondary },
  email: { color: colors.text.primary, fontFamily: 'JetBrainsMono_400Regular' },
});
