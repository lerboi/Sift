import { View, Text, Pressable, StyleSheet } from 'react-native';
import { AlertCircle, RotateCw } from 'lucide-react-native';
import { colors, space, radius, text } from '../theme';

export function InlineError({ title, message, code, onRetry }) {
  return (
    <View style={styles.root} accessibilityRole="alert">
      <AlertCircle size={16} color={colors.signal.negative} strokeWidth={1.75} style={styles.icon} />
      <View style={styles.body}>
        {title ? <Text style={styles.title}>{title}</Text> : null}
        {message ? <Text style={styles.message}>{message}</Text> : null}
        {code ? <Text style={styles.code}>[{code}]</Text> : null}
      </View>
      {onRetry ? (
        <Pressable
          onPress={onRetry}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Retry"
          style={({ pressed }) => [styles.retry, pressed && { opacity: 0.6 }]}
        >
          <RotateCw size={16} color={colors.text.secondary} strokeWidth={1.75} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space[2],
    backgroundColor: 'rgba(248, 113, 113, 0.10)',
    borderColor: 'rgba(248, 113, 113, 0.30)',
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: space[2],
    paddingHorizontal: space[3],
  },
  icon: { marginTop: 2 },
  body: { flex: 1 },
  title: {
    ...text.subhead,
    color: colors.text.primary,
    fontFamily: 'Inter_500Medium',
  },
  message: {
    ...text.footnote,
    color: colors.text.secondary,
    marginTop: 2,
  },
  code: {
    ...text.footnoteMono,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  retry: { padding: space[1], marginTop: 2 },
});
