import { useEffect, useRef, useState } from 'react';
import { ScrollView, Switch, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { User, Bell, Clock, Info, FileText, LogOut, Sparkles } from 'lucide-react-native';
import { SettingsGroup } from '../../components/settings-group';
import { SettingsRow } from '../../components/settings-row';
import { DisclaimerFooter } from '../../components/disclaimer-footer';
import { haptics } from '../../lib/haptics';
import { colors, space } from '../../theme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../../lib/supabase';
import { ACK_KEY } from '../../lib/use-auth-routing';
import { QuietHoursSheet, presetLabel } from './quiet-hours-sheet';
import { SignOutSheet } from './sign-out-sheet';
import { SubscriptionSheet } from './subscription-sheet';

const icon = (Icon) => <Icon size={18} color={colors.text.secondary} strokeWidth={1.75} />;

export default function SettingsScreen() {
  const router = useRouter();
  const quietSheet = useRef(null);
  const signOutSheet = useRef(null);
  const subscriptionSheet = useRef(null);

  const [email, setEmail] = useState('');
  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setEmail(data?.session?.user?.email ?? '');
    });
    return () => { cancelled = true; };
  }, []);

  // mock notification prefs — wire to supabase profile when schema lands
  const [briefings,  setBriefings]  = useState(true);
  const [eightK,     setEightK]     = useState(true);
  const [transcripts, setTranscripts] = useState(false);
  const [quiet,      setQuiet]      = useState('22-07');

  const toggle = (setter) => (v) => {
    haptics.select();
    setter(v);
  };

  const noop = () => {};
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
  // p10-3: real sign-out — supabase clears its session; we clear the local
  // ack so the next user on this device sees onboarding before /today.
  // useAuthRouting subscribes to onAuthStateChange and replaces to /sign-in
  // when supabase emits SIGNED_OUT.
  const confirmSignOut = async () => {
    await Promise.all([
      supabase.auth.signOut(),
      AsyncStorage.removeItem(ACK_KEY),
    ]);
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
            value="Free"
            onPress={openSubscription}
          />
        </SettingsGroup>

        <SettingsGroup title="NOTIFICATIONS" footer="Pushes are throttled to a maximum of three per ticker per day.">
          <SettingsRow
            icon={icon(Bell)}
            label="Pre-earnings briefings"
            trailing={<NotificationSwitch value={briefings} onChange={toggle(setBriefings)} />}
          />
          <SettingsRow
            icon={icon(Bell)}
            label="8-K release alerts"
            trailing={<NotificationSwitch value={eightK} onChange={toggle(setEightK)} />}
          />
          <SettingsRow
            icon={icon(Bell)}
            label="Post-call transcripts"
            trailing={<NotificationSwitch value={transcripts} onChange={toggle(setTranscripts)} />}
          />
          <SettingsRow
            icon={icon(Clock)}
            label="Quiet hours"
            value={presetLabel(quiet)}
            onPress={openQuiet}
          />
        </SettingsGroup>

        <SettingsGroup title="ABOUT">
          <SettingsRow icon={icon(Info)} label="Version" value="0.1.0" />
          <SettingsRow icon={icon(FileText)} label="Disclaimer" onPress={openDisclaimer} />
          <SettingsRow icon={icon(FileText)} label="Privacy policy" onPress={openPrivacy} />
          <SettingsRow icon={icon(FileText)} label="Terms of service" onPress={openTerms} />
        </SettingsGroup>

        <DisclaimerFooter />
      </ScrollView>

      <QuietHoursSheet ref={quietSheet} value={quiet} onChange={setQuiet} />
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
