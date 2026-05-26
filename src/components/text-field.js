import { View, Text, TextInput, StyleSheet } from 'react-native';
import { colors, space, radius, text } from '../theme';

// labeled input with optional error state. minimal — auth + future form use.
export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType,
  autoCapitalize = 'none',
  autoComplete,
  textContentType,
  error,
  editable = true,
  returnKeyType,
  onSubmitEditing,
}) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, error && styles.inputError, !editable && styles.inputDisabled]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.text.tertiary}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoComplete={autoComplete}
        textContentType={textContentType}
        autoCorrect={false}
        editable={editable}
        returnKeyType={returnKeyType}
        onSubmitEditing={onSubmitEditing}
        accessibilityLabel={label}
        accessibilityHint={error || undefined}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space[1] },
  label: {
    ...text.subhead,
    color: colors.text.secondary,
    marginBottom: 2,
  },
  input: {
    ...text.body,
    color: colors.text.primary,
    backgroundColor: colors.bg.surface,
    borderColor: colors.border.default,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space[3],
    paddingVertical: space[3],
    minHeight: 44,
  },
  inputError: { borderColor: colors.signal.negative },
  inputDisabled: { opacity: 0.6 },
  error: {
    ...text.footnote,
    color: colors.signal.negative,
    marginTop: 2,
  },
});
