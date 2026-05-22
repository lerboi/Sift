import { View, Text, StyleSheet } from 'react-native';
import { colors, space, text } from '../theme';
import { Button } from './button';

export function EmptyState({ title, description, icon, cta }) {
  return (
    <View style={styles.root}>
      {icon ? <View style={styles.icon}>{icon}</View> : null}
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
      {cta ? (
        <View style={styles.cta}>
          <Button onPress={cta.onPress} variant={cta.variant ?? 'primary'}>
            {cta.label}
          </Button>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space[6],
    paddingVertical: space[10],
  },
  icon: { marginBottom: space[3] },
  title: {
    ...text.headline,
    color: colors.text.primary,
    textAlign: 'center',
  },
  description: {
    ...text.subhead,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: space[2],
    maxWidth: 280,
  },
  cta: { marginTop: space[5] },
});
