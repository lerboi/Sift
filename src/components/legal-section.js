import { View, Text, StyleSheet } from 'react-native';
import { colors, space, text } from '../theme';

// micro eyebrow + body — used by disclaimer, privacy, terms screens
export function LegalSection({ title, children }) {
  return (
    <View style={styles.section}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: space[6] },
  title: {
    ...text.micro,
    color: colors.text.tertiary,
    letterSpacing: 0.6,
    marginBottom: space[2],
  },
  body: { ...text.body, color: colors.text.secondary },
});
