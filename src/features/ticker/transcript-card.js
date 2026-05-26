import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, LayoutAnimation, Platform, UIManager } from 'react-native';
import { ChevronDown, MessageCircle } from 'lucide-react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { colors, space, radius, text } from '../../theme';
import { Card } from '../../components/card';
import { Pill } from '../../components/pill';
import { haptics } from '../../lib/haptics';
import { useReducedMotion } from '../../lib/use-reduced-motion';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const TONE = {
  bullish: { variant: 'positive', label: '▲ bullish' },
  neutral: { variant: 'neutral',  label: '━ neutral' },
  bearish: { variant: 'negative', label: '▼ bearish' },
};

export function TranscriptCard({ period, date, tone, novelTopics = [], snippet, showDate = true }) {
  const [expanded, setExpanded] = useState(false);
  const reduced = useReducedMotion();
  const chevron = useSharedValue(0);

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${chevron.value * 180}deg` }],
  }));

  const toggle = () => {
    if (!reduced) {
      LayoutAnimation.configureNext(LayoutAnimation.create(180, 'easeInEaseOut', 'opacity'));
    }
    chevron.value = withTiming(expanded ? 0 : 1, { duration: reduced ? 0 : 180 });
    haptics.select();
    setExpanded((v) => !v);
  };

  const t = TONE[tone] ?? TONE.neutral;

  return (
    <Card padding={4}>
      <Pressable
        onPress={toggle}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${period}, ${tone} tone, ${expanded ? 'expanded' : 'collapsed'}`}
      >
        <View style={styles.headerRow}>
          <View style={styles.glyphWrap}>
            <MessageCircle size={16} color={colors.text.tertiary} strokeWidth={1.5} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{period}</Text>
            {showDate ? <Text style={styles.date}>{date}</Text> : null}
          </View>
          <Pill variant={t.variant} size="sm">{t.label}</Pill>
          <Animated.View style={[chevronStyle, { marginLeft: space[2] }]}>
            <ChevronDown size={20} color={colors.text.secondary} strokeWidth={1.75} />
          </Animated.View>
        </View>
        <Text style={styles.body} numberOfLines={expanded ? undefined : 2}>
          {snippet}
        </Text>
        {expanded && novelTopics.length > 0 ? (
          <View style={styles.topicsWrap}>
            <Text style={styles.topicsLabel}>NOVEL TOPICS</Text>
            <View style={styles.topicsRow}>
              {novelTopics.map((topic) => (
                <View key={topic} style={styles.topicChip}>
                  <Text style={styles.topicText}>{topic}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}
      </Pressable>
    </Card>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: space[2],
    gap: space[2],
  },
  glyphWrap: { marginTop: 3 },
  title: { ...text.headline, color: colors.text.primary },
  date: { ...text.footnote, color: colors.text.tertiary, marginTop: 2 },
  body: { ...text.body, color: colors.text.secondary },
  topicsWrap: { marginTop: space[4] },
  topicsLabel: {
    ...text.micro,
    color: colors.text.tertiary,
    letterSpacing: 0.5,
    marginBottom: space[2],
  },
  topicsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[2],
  },
  topicChip: {
    backgroundColor: colors.bg.elevated,
    borderColor: colors.border.subtle,
    borderWidth: 1,
    paddingHorizontal: space[3],
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  topicText: { ...text.footnote, color: colors.text.secondary },
});
