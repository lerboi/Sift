import { Text, StyleSheet } from 'react-native';
import { colors, space, text } from '../theme';

const SHORT = 'Educational use only. Not investment advice.';
const LONG =
  'Sift provides general market information and educational content. Nothing in this app constitutes investment, financial, legal, or tax advice, or a personal recommendation. You are solely responsible for your investment decisions. Past performance is not indicative of future results. Backtest results are hypothetical.';

export function DisclaimerFooter({ variant = 'short', align = 'center', style }) {
  return (
    <Text style={[styles.text, align === 'left' && { textAlign: 'left' }, style]}>
      {variant === 'long' ? LONG : SHORT}
    </Text>
  );
}

const styles = StyleSheet.create({
  text: {
    ...text.caption,
    color: colors.text.tertiary,
    textAlign: 'center',
    marginTop: space[6],
    marginBottom: space[4],
    paddingHorizontal: space[4],
  },
});
