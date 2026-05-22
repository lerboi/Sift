import { View, Text, StyleSheet } from 'react-native';
import { colors, space, radius, text } from '../theme';

export function SettingsGroup({ title, footer, children }) {
  const items = Array.isArray(children) ? children.filter(Boolean) : [children];
  const total = items.length;
  return (
    <View style={styles.wrap}>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      <View style={styles.group}>
        {items.map((child, i) =>
          // pass last=true to suppress trailing divider on final row
          child?.props && typeof child.type === 'function'
            ? <child.type {...child.props} key={i} last={i === total - 1} />
            : child,
        )}
      </View>
      {footer ? <Text style={styles.footer}>{footer}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: space[5] },
  title: {
    ...text.micro,
    color: colors.text.tertiary,
    letterSpacing: 0.5,
    marginBottom: space[2],
    paddingHorizontal: space[4],
  },
  group: {
    backgroundColor: colors.bg.surface,
    borderColor: colors.border.subtle,
    borderWidth: 1,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  footer: {
    ...text.footnote,
    color: colors.text.tertiary,
    marginTop: space[2],
    paddingHorizontal: space[4],
  },
});
