import { useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check } from 'lucide-react-native';
import { Button } from '../../components/button';
import { Card } from '../../components/card';
import { OnboardingTopBar } from './onboarding-top-bar';
import { haptics } from '../../lib/haptics';
import { getCompanyName } from '../watchlist/ticker-catalog';
import { colors, space, text } from '../../theme';

// suggested seed list per p9-5 spec; users can edit on watchlist afterward.
const SUGGESTED = ['AAPL', 'MSFT', 'NVDA', 'GOOG', 'AMZN'].map((symbol) => ({
  symbol,
  name: getCompanyName(symbol),
}));

export default function FirstTickersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState(new Set());

  const toggle = (symbol) => {
    haptics.select();
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(symbol)) next.delete(symbol);
      else next.add(symbol);
      return next;
    });
  };

  // p10-3 will write the seed selections to profiles.watchlist server-side.
  const finish = () => {
    if (selected.size > 0) haptics.success();
    else haptics.tap();
    router.replace('/today');
  };
  const skip = () => {
    haptics.tap();
    router.replace('/today');
  };

  const ctaLabel = selected.size === 0
    ? 'Continue'
    : `Add ${selected.size} ticker${selected.size === 1 ? '' : 's'}`;

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <OnboardingTopBar onSkip={skip} />
      <View style={styles.content}>
        <Text style={styles.heading}>Pick a few to start</Text>
        <Text style={styles.lede}>
          We'll seed your watchlist with these. You can add, remove, or reorder anything later.
        </Text>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Card padding={0}>
            {SUGGESTED.map((t, i) => {
              const isSelected = selected.has(t.symbol);
              return (
                <Pressable
                  key={t.symbol}
                  onPress={() => toggle(t.symbol)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={`${t.symbol}, ${t.name}${isSelected ? ', selected' : ''}`}
                  style={({ pressed }) => [
                    styles.row,
                    i !== SUGGESTED.length - 1 && styles.divider,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={styles.body}>
                    <Text style={styles.symbol}>{t.symbol}</Text>
                    <Text style={styles.name} numberOfLines={1}>{t.name}</Text>
                  </View>
                  <View style={[styles.tick, isSelected && styles.tickSelected]}>
                    {isSelected ? <Check size={14} color={colors.accent.on} strokeWidth={3} /> : null}
                  </View>
                </Pressable>
              );
            })}
          </Card>

          <Text style={styles.tip}>
            Tap to toggle. You can edit your watchlist anytime in Settings.
          </Text>
        </ScrollView>
      </View>

      <View style={styles.bottom}>
        <Button
          variant="primary"
          onPress={finish}
          fullWidth
          accessibilityLabel={ctaLabel}
        >
          {ctaLabel}
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg.base },
  content: {
    flex: 1,
    paddingHorizontal: space[5],
    paddingTop: space[3],
  },

  heading: { ...text.displaySm, color: colors.text.primary },
  lede: {
    ...text.body,
    color: colors.text.secondary,
    marginTop: space[2],
    marginBottom: space[5],
  },

  scroll: { flex: 1 },
  scrollContent: { paddingBottom: space[3] },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    minHeight: 64,
  },
  divider: {
    borderBottomColor: colors.border.subtle,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pressed: { backgroundColor: colors.bg.elevated },
  body: { flex: 1, marginRight: space[3] },
  symbol: { ...text.headlineMono, color: colors.text.primary },
  name: { ...text.footnote, color: colors.text.secondary, marginTop: 2 },

  tick: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: colors.border.strong,
    backgroundColor: colors.bg.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tickSelected: {
    backgroundColor: colors.accent.default,
    borderColor: colors.accent.default,
  },

  tip: {
    ...text.footnote,
    color: colors.text.tertiary,
    textAlign: 'center',
    marginTop: space[4],
  },

  bottom: {
    paddingHorizontal: space[5],
    paddingTop: space[3],
    paddingBottom: space[6],
  },
});
