import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface AuthLogoProps {
  size?: 'small' | 'large';
}

export default function AuthLogo({ size = 'large' }: AuthLogoProps) {
  return (
    <View
      style={[styles.logo, size === 'small' && styles.logoSmall]}
      accessibilityRole="image"
      accessibilityLabel="ERS logo"
    >
      <Text style={[styles.logoText, size === 'small' && styles.logoTextSmall]}>
        ERS
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  logo: {
    width: 72,
    height: 72,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#16a34a',
  },
  logoSmall: {
    width: 48,
    height: 48,
    borderRadius: 14,
  },
  logoText: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 0,
  },
  logoTextSmall: {
    fontSize: 16,
  },
});
