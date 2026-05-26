import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, LayoutAnimation, Platform, UIManager } from 'react-native';
import { ChevronDown, FileText } from 'lucide-react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { colors, space, text } from '../theme';
import { Card } from './card';
import { haptics } from '../lib/haptics';
import { useReducedMotion } from '../lib/use-reduced-motion';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export function BriefingCard({ title, date, content, showDate = true }) {
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

  return (
    <Card padding={4}>
      <Pressable
        onPress={toggle}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${title}, ${expanded ? 'expanded' : 'collapsed'}`}
      >
        <View style={styles.headerRow}>
          <View style={styles.glyphWrap}>
            <FileText size={16} color={colors.text.tertiary} strokeWidth={1.5} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{title}</Text>
            {showDate ? <Text style={styles.date}>{date}</Text> : null}
          </View>
          <Animated.View style={chevronStyle}>
            <ChevronDown size={20} color={colors.text.secondary} strokeWidth={1.75} />
          </Animated.View>
        </View>
        <Text
          style={styles.body}
          numberOfLines={expanded ? undefined : 2}
        >
          {content}
        </Text>
      </Pressable>
    </Card>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space[3],
    marginBottom: space[2],
  },
  glyphWrap: { marginTop: 3 },
  title: {
    ...text.headline,
    color: colors.text.primary,
  },
  date: {
    ...text.footnote,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  body: {
    ...text.body,
    color: colors.text.secondary,
  },
});
