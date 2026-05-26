import { useState } from 'react';
import { View, Text, Pressable, ScrollView, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Button } from '../../components/button';
import { TextField } from '../../components/text-field';
import { haptics } from '../../lib/haptics';
import { supabase } from '../../../lib/supabase';
import { colors, space, text } from '../../theme';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignInScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const emailValid = EMAIL_RE.test(email);
  const passwordValid = password.length >= 6;
  const canSubmit = emailValid && passwordValid && !submitting;

  const signIn = async () => {
    if (!canSubmit) return;
    setError(null);
    setSubmitting(true);
    try {
      const { error: e } = await supabase.auth.signInWithPassword({ email, password });
      if (e) {
        setError(e.message);
        haptics.error();
        return;
      }
      haptics.success();
      router.replace('/today');
    } catch (e) {
      setError(e?.message ?? 'Network error. Try again.');
      haptics.error();
    } finally {
      setSubmitting(false);
    }
  };

  const oauthGoogle = async () => {
    haptics.tap();
    setError(null);
    setSubmitting(true);
    try {
      const redirectTo = Linking.createURL('/auth-callback');
      const { data, error: e } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (e || !data?.url) {
        setError(e?.message ?? 'Could not start sign-in. Try again.');
        haptics.error();
        return;
      }
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type !== 'success' || !result.url) {
        // user cancelled the browser sheet
        return;
      }
      const { queryParams } = Linking.parse(result.url);
      const code = queryParams?.code;
      if (!code) {
        setError('Sign-in returned no authorisation code.');
        haptics.error();
        return;
      }
      const { error: ex } = await supabase.auth.exchangeCodeForSession(String(code));
      if (ex) {
        setError(ex.message);
        haptics.error();
        return;
      }
      haptics.success();
      router.replace('/today');
    } catch (e) {
      setError(e?.message ?? 'Network error. Try again.');
      haptics.error();
    } finally {
      setSubmitting(false);
    }
  };

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
        <Text style={styles.heading}>Welcome back</Text>
        <Text style={styles.lede}>Sign in to your Sift account.</Text>

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
            autoComplete="password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={signIn}
            editable={!submitting}
          />
          {error ? <Text style={styles.formError}>{error}</Text> : null}

          <Button
            variant="primary"
            onPress={signIn}
            disabled={!canSubmit}
            loading={submitting}
            fullWidth
            accessibilityLabel="Sign in"
          >
            Sign in
          </Button>

          <View style={styles.dividerRow}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.divider} />
          </View>

          <Button
            variant="secondary"
            onPress={oauthGoogle}
            disabled={submitting}
            fullWidth
            accessibilityLabel="Continue with Google"
          >
            Continue with Google
          </Button>
        </View>

        <Pressable
          onPress={() => { haptics.tap(); router.push('/sign-up'); }}
          hitSlop={10}
          accessibilityRole="link"
          accessibilityLabel="Create a new account"
          style={({ pressed }) => [styles.footerLink, pressed && { opacity: 0.6 }]}
        >
          <Text style={styles.footerText}>
            New to Sift? <Text style={styles.footerCta}>Create an account</Text>
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
  formError: {
    ...text.footnote,
    color: colors.signal.negative,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    marginVertical: space[2],
  },
  divider: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.border.subtle },
  dividerText: { ...text.footnote, color: colors.text.tertiary },

  footerLink: { marginTop: space[6], alignItems: 'center' },
  footerText: { ...text.body, color: colors.text.secondary },
  footerCta: { color: colors.accent.default },
});
