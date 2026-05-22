import { ScrollView, StyleSheet } from 'react-native';
import { User, Bell, Clock, Info, FileText, LogOut } from 'lucide-react-native';
import { SettingsGroup } from '../../components/settings-group';
import { SettingsRow } from '../../components/settings-row';
import { DisclaimerFooter } from '../../components/disclaimer-footer';
import { colors, space } from '../../theme';

const icon = (Icon) => <Icon size={18} color={colors.text.secondary} strokeWidth={1.75} />;

export default function SettingsScreen() {
  const noop = () => {};
  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.scroll}
      contentInsetAdjustmentBehavior="automatic"
    >
      <SettingsGroup title="ACCOUNT">
        <SettingsRow icon={icon(User)} label="Email" value="you@example.com" />
        <SettingsRow icon={icon(LogOut)} label="Sign out" destructive onPress={noop} />
      </SettingsGroup>

      <SettingsGroup title="NOTIFICATIONS" footer="Pushes are throttled to a maximum of three per ticker per day.">
        <SettingsRow icon={icon(Bell)} label="Pre-earnings briefings" value="On" onPress={noop} />
        <SettingsRow icon={icon(Bell)} label="8-K release alerts" value="On" onPress={noop} />
        <SettingsRow icon={icon(Bell)} label="Post-call transcripts" value="Off" onPress={noop} />
        <SettingsRow icon={icon(Clock)} label="Quiet hours" value="22:00 – 07:00" onPress={noop} />
      </SettingsGroup>

      <SettingsGroup title="ABOUT">
        <SettingsRow icon={icon(Info)} label="Version" value="0.1.0" />
        <SettingsRow icon={icon(FileText)} label="Disclaimer" onPress={noop} />
        <SettingsRow icon={icon(FileText)} label="Privacy policy" onPress={noop} />
        <SettingsRow icon={icon(FileText)} label="Terms of service" onPress={noop} />
      </SettingsGroup>

      <DisclaimerFooter variant="long" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg.base },
  scroll: { paddingHorizontal: space[4], paddingBottom: space[8] },
});
