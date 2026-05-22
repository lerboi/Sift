import { Text } from 'react-native';
import { text as textStyles, colors } from '../theme';

const SIZES = {
  displayLg: textStyles.displayLgMono,
  headline:  textStyles.headlineMono,
  body:      textStyles.bodyMono,
  callout:   textStyles.calloutMono,
  subhead:   textStyles.subheadMono,
  footnote:  textStyles.footnoteMono,
};

export function MonoNumber({
  value,
  size = 'body',
  color = colors.text.primary,
  accessibilityLabel,
  style,
  numberOfLines,
}) {
  const variant = SIZES[size] ?? SIZES.body;
  const display = String(value);
  return (
    <Text
      style={[variant, { color }, style]}
      numberOfLines={numberOfLines}
      accessibilityLabel={accessibilityLabel ?? speakable(display)}
    >
      {display}
    </Text>
  );
}

// voiceover mispronounces ▲ / + / − / % — produce a clean label
function speakable(s) {
  let label = String(s).trim();
  label = label
    .replace(/^[▲▴]\s*/, 'up ')
    .replace(/^[▼▾]\s*/, 'down ')
    .replace(/^[━─]\s*/, 'unchanged ');
  if (label.startsWith('+')) label = 'up ' + label.slice(1);
  if (label.startsWith('-') || label.startsWith('−')) label = 'down ' + label.slice(1);
  label = label.replace('%', ' percent');
  return label.trim();
}
