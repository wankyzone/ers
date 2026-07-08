import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type PressableProps,
} from 'react-native';

type AuthButtonVariant = 'primary' | 'secondary' | 'ghost';

interface AuthButtonProps extends Omit<PressableProps, 'style'> {
  title: string;
  variant?: AuthButtonVariant;
  loading?: boolean;
}

export default function AuthButton({
  title,
  variant = 'primary',
  loading = false,
  disabled,
  ...props
}: AuthButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      {...props}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={({ pressed }) => [
        styles.button,
        styles[variant],
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? '#ffffff' : '#16a34a'} />
      ) : (
        <Text style={[styles.title, styles[`${variant}Text`]]}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 56,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  primary: {
    backgroundColor: '#16a34a',
  },
  secondary: {
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  pressed: {
    opacity: 0.82,
  },
  disabled: {
    opacity: 0.55,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0,
  },
  primaryText: {
    color: '#ffffff',
  },
  secondaryText: {
    color: '#166534',
  },
  ghostText: {
    color: '#16a34a',
  },
});
