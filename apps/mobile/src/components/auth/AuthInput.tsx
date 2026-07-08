import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';

interface AuthInputProps extends TextInputProps {
  label: string;
  error?: string;
}

export default function AuthInput({
  label,
  error,
  onFocus,
  onBlur,
  style,
  ...props
}: AuthInputProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...props}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        placeholderTextColor="#94a3b8"
        style={[
          styles.input,
          focused && styles.inputFocused,
          error ? styles.inputError : null,
          style,
        ]}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  label: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0,
  },
  input: {
    minHeight: 56,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '600',
  },
  inputFocused: {
    borderColor: '#16a34a',
  },
  inputError: {
    borderColor: '#dc2626',
  },
  error: {
    color: '#dc2626',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
});
