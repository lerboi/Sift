import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { supabase } from '../../lib/supabase';

// upsert this device's expo push token for the current user. callable from
// onboarding (after Allow) and from cold-start in the root layout. safe to
// call when permission isn't granted (returns early).
export async function registerPushTokenIfPossible() {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return null;

    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData?.session?.user?.id;
    if (!uid) return null;

    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ||
      Constants?.easConfig?.projectId ||
      Constants?.expoConfig?.extra?.projectId;

    const tokenResponse = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    const token = tokenResponse?.data;
    if (!token) return null;

    const platform = Platform.OS === 'ios' ? 'ios' : 'android';
    const { error } = await supabase
      .from('push_tokens')
      .upsert(
        {
          user_id: uid,
          token,
          platform,
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,token' },
      );
    if (error && __DEV__) console.warn('[push] upsert failed', error.message);
    return token;
  } catch (e) {
    // expo go on sdk 53+ has reduced push support; getExpoPushTokenAsync may
    // throw with no projectId. swallow so onboarding still completes.
    if (__DEV__) console.warn('[push] register skipped', e?.message);
    return null;
  }
}
