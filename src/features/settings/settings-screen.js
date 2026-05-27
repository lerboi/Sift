import { useEffect, useRef, useState } from 'react';
import { ScrollView, Switch, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { User, Bell, Clock, Info, FileText, LogOut, Sparkles } from 'lucide-react-native';
import { SettingsGroup } from '../../components/settings-group';
import { SettingsRow } from '../../components/settings-row';
import { DisclaimerFooter } from '../../components/disclaimer-footer';
import { haptics } from '../../lib/haptics';
import { colors, space } from '../../theme';
import { supabase } from '../../../lib/supabase';
import { QuietHoursSheet, presetLabel } from './quiet-hours-sheet';
import { SignOutSheet } from './sign-out-sheet';
import { SubscriptionSheet } from './subscription-sheet';

const APP_VERSION = Constants?.expoConfig?.version || '0.1.0';

const icon = (Icon) => <Icon size={18} color={colors.text.secondary} strokeWidth={1.75} />;

export default function SettingsScreen() {
  const router = useRouter();
  const quietSheet = useRef(null);
  const signOutSheet = useRef(null);
  const subscriptionSheet = useRef(null);

  const [email, setEmail] = useState('');
  const [tier, setTier] = useState('free');
  const [userId, setUserId] = useState(null);

  // notification prefs sourced from profiles row; written back optimistically on toggle.
  const [briefings,  setBriefings]  = useState(true);
  const [eightK,     setEightK]     = useState(true);
  const [transcripts, setTranscripts] = useState(false);
  const [quiet,      setQuiet]      = useState('22-07');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData?.session;
      if (cancelled) return;
      setEmail(session?.user?.email ?? '');
      const uid = session?.user?.id;
      setUserId(uid ?? null);
      if (!uid) return;
      const { data, error } = await supabase
        .from('profiles')
        .select('tier, notify_briefings, notify_events, notify_transcripts, quiet_hours_preset')
        .eq('id', uid)
        .maybeSingle();
      if (cancelled || error || !data) return;
      setTier(data.tier || 'free');
      setBriefings(!!data.notify_briefings);
      setEightK(!!data.notify_events);
      setTranscripts(!!data.notify_transcripts);
      setQuiet(data.quiet_hours_preset || '22-07');
    })();
    return () => { cancelled = true; };
  }, []);

  const persistPref = async (column, value) => {
    if (!userId) return;
    const { error } = await supabase
      .from('profiles')
      .update({ [column]: value })
      .eq('id', userId);
    if (error && __DEV__) console.warn('[settings] update', column, error.message);
  };

  const toggle = (setter, column) => (v) => {
    haptics.select();
    setter(v);
    if (column) persistPref(column, v);
  };

  const setQuietPersistent = (preset) => {
    setQuiet(preset);
    persistPref('quiet_hours_preset', preset);
  };

  const planLabel = tier === 'pro' ? 'Pro' : 'Free';

  const openDisclaimer = () => router.push('/settings/disclaimer');
  const openPrivacy = () => router.push('/settings/privacy');
  const openTerms = () => router.push('/settings/terms');
  const openQuiet = () => {
    haptics.tap();
    quietSheet.current?.expand();
  };
  const openSignOut = () => {
    haptics.tap();
    signOutSheet.current?.expand();
  };
  const openSubscription = () => {
    haptics.tap();
    subscriptionSheet.current?.expand();
  };
  // ack now lives in profiles.disclaimer_ack_at; server-side per-user. signing
  // out doesn't clear it — the same user signing back in stays acked. a different
  // user signing in has their own profile row with their own ack state.
  const confirmSignOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <>
      <ScrollView
        style={styles.root}
        contentContainerStyle={styles.scroll}
        contentInsetAdjustmentBehavior="automatic"
      >
        <SettingsGroup title="ACCOUNT">
          <SettingsRow icon={icon(User)} label="Email" value={email || '—'} />
          <SettingsRow icon={icon(LogOut)} label="Sign out" destructive onPress={openSignOut} />
        </SettingsGroup>

        <SettingsGroup title="PLAN" footer="Subscription tiers will be available before public launch.">
          <SettingsRow
            icon={icon(Sparkles)}
            label="Plan"
            value={planLabel}
            onPress={openSubscription}
          />
        </SettingsGroup>

        <SettingsGroup title="NOTIFICATIONS" footer="Pushes are throttled to a maximum of three per ticker per day.">
          <SettingsRow
            icon={icon(Bell)}
            label="Pre-earnings briefings"
            trailing={<NotificationSwitch value={briefings} onChange={toggle(setBriefings, 'notify_briefings')} />}
          />
          <SettingsRow
            icon={icon(Bell)}
            label="8-K release alerts"
            trailing={<NotificationSwitch value={eightK} onChange={toggle(setEightK, 'notify_events')} />}
          />
          <SettingsRow
            icon={icon(Bell)}
            label="Post-call transcripts"
            trailing={<NotificationSwitch value={transcripts} onChange={toggle(setTranscripts, 'notify_transcripts')} />}
          />
          <SettingsRow
            icon={icon(Clock)}
            label="Quiet hours"
            value={presetLabel(quiet)}
            onPress={openQuiet}
          />
        </SettingsGroup>

        <SettingsGroup title="ABOUT">
          <SettingsRow icon={icon(Info)} label="Version" value={APP_VERSION} />
          <SettingsRow icon={icon(FileText)} label="Disclaimer" onPress={openDisclaimer} />
          <SettingsRow icon={icon(FileText)} label="Privacy policy" onPress={openPrivacy} />
          <SettingsRow icon={icon(FileText)} label="Terms of service" onPress={openTerms} />
        </SettingsGroup>

        <DisclaimerFooter />
      </ScrollView>

      <QuietHoursSheet ref={quietSheet} value={quiet} onChange={setQuietPersistent} />
      <SignOutSheet ref={signOutSheet} onConfirm={confirmSignOut} />
      <SubscriptionSheet ref={subscriptionSheet} />
    </>
  );
}

function NotificationSwitch({ value, onChange }) {
  return (
    <Switch
      value={value}
      onValueChange={onChange}
      trackColor={{ false: colors.bg.elevated, true: colors.accent.default }}
      thumbColor={colors.text.primary}
      ios_backgroundColor={colors.bg.elevated}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg.base },
  scroll: { paddingHorizontal: space[4], paddingBottom: space[8] },
});
