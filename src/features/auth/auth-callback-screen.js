import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Button } from '../../components/button';
import { supabase } from '../../../lib/supabase';
import { colors, space, text } from '../../theme';

// fallback path: if the oauth callback is reached as a cold-start deep link
// (user closed the in-app browser and tapped the email link in mail.app etc),
// expo-router resolves /auth-callback?code=... to this screen. exchange and route.
// the in-app webBrowser.openAuthSessionAsync flow on sign-in handles its own
// exchange directly without entering this route.
export default function AuthCallbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [error, setError] = useState(null);

  useEffect(() => {
    const code = params?.code;
    if (!code) {
      setError('Missing authorisation code in callback URL.');
      return;
    }
    let cancelled = false;
    supabase.auth
      .exchangeCodeForSession(String(code))
      .then(({ error: e }) => {
        if (cancelled) return;
        if (e) setError(e.message);
        else router.replace('/today');
      })
      .catch((e) => {
        if (!cancelled) setError(e?.message ?? 'Sign-in could not complete.');
      });
    return () => { cancelled = true; };
  }, [params?.code, router]);

  if (error) {
    return (
      <View style={styles.root}>
        <Text style={styles.errorHeading}>Sign-in didn't complete</Text>
        <Text style={styles.errorBody}>{error}</Text>
        <Button variant="primary" onPress={() => router.replace('/sign-in')} accessibilityLabel="Back to sign in">
          Back to sign in
        </Button>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ActivityIndicator color={colors.accent.default} />
      <Text style={styles.status}>Completing sign-in…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg.base,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[4],
    paddingHorizontal: space[5],
  },
  status: { ...text.body, color: colors.text.secondary },
  errorHeading: { ...text.title, color: colors.text.primary, textAlign: 'center' },
  errorBody: { ...text.body, color: colors.text.secondary, textAlign: 'center' },
});
