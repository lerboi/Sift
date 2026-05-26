import { useRef, useState } from 'react';
import { View, Text, ScrollView, useWindowDimensions, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BarChart3, Sparkles, BellOff } from 'lucide-react-native';
import { Button } from '../../components/button';
import { PageDots } from '../../components/page-dots';
import { OnboardingTopBar } from './onboarding-top-bar';
import { haptics } from '../../lib/haptics';
import { colors, space, text } from '../../theme';

// compliance: factual + descriptive, no "buy" / "should" / "recommend".
const SLIDES = [
  {
    Icon: BarChart3,
    title: 'Earnings, structured.',
    body: 'Briefings before the call. Parsed numbers the moment a filing drops. Surprises summarised in plain English.',
  },
  {
    Icon: Sparkles,
    title: 'Predictions, calibrated.',
    body: 'Beat probabilities derived from twelve quarters of priors. Always neutral. Always paired with what they mean — and what they do not.',
  },
  {
    Icon: BellOff,
    title: 'Quiet by default.',
    body: 'Three pushes per ticker per day, maximum. Set your quiet hours and we batch the rest until morning.',
  },
];

export default function WelcomeScreen() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef(null);
  const [page, setPage] = useState(0);
  const router = useRouter();

  const isLast = page === SLIDES.length - 1;

  const goNext = () => {
    if (isLast) return advance();
    haptics.tap();
    scrollRef.current?.scrollTo({ x: (page + 1) * width, animated: true });
  };
  const advance = () => {
    haptics.tap();
    router.push('/how-sift-works');
  };
  const skip = () => {
    haptics.tap();
    router.replace('/today');
  };

  const onScroll = (e) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / width);
    if (next !== page) setPage(next);
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <OnboardingTopBar onSkip={skip} />

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll}
        scrollEventThrottle={16}
        style={styles.pager}
      >
        {SLIDES.map((s, i) => (
          <Slide key={i} width={width} {...s} />
        ))}
      </ScrollView>

      <View style={styles.bottom}>
        <PageDots count={SLIDES.length} current={page} />
        <View style={{ height: space[6] }} />
        <Button onPress={goNext} fullWidth accessibilityLabel={isLast ? 'Get started' : 'Next slide'}>
          {isLast ? 'Get started' : 'Next'}
        </Button>
      </View>
    </View>
  );
}

function Slide({ width, Icon, title, body }) {
  return (
    <View style={[styles.slide, { width }]}>
      <View style={styles.iconWrap}>
        <Icon size={48} color={colors.accent.default} strokeWidth={1.25} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg.base,
  },

  pager: { flex: 1 },
  slide: {
    flex: 1,
    paddingHorizontal: space[5],
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[4],
  },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.accent.muted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space[3],
  },
  title: {
    ...text.displaySm,
    color: colors.text.primary,
    textAlign: 'center',
  },
  body: {
    ...text.body,
    color: colors.text.secondary,
    textAlign: 'center',
    paddingHorizontal: space[3],
  },

  bottom: {
    paddingHorizontal: space[5],
    paddingTop: space[4],
    paddingBottom: space[6],
    gap: space[4],
  },
});
