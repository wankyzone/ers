import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import AuthLogo from './AuthLogo';

interface AuthHeaderProps {
  title: string;
  subtitle?: string;
  showLogo?: boolean;
  onBack?: () => void;
  style?: StyleProp<ViewStyle>;
}

export default function AuthHeader({
  title,
  subtitle,
  showLogo = false,
  onBack,
  style,
}: AuthHeaderProps) {
  return (
    <View style={[styles.container, style]}>
      {onBack ? (
        <Pressable
          onPress={onBack}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={styles.backText}>{'<'}</Text>
        </Pressable>
      ) : null}

      {showLogo ? <AuthLogo /> : null}

      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
    paddingTop: 8,
    paddingBottom: 24,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
  },
  backText: {
    color: '#0f172a',
    fontSize: 34,
    lineHeight: 36,
    fontWeight: '500',
  },
  title: {
    color: '#0f172a',
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '800',
    letterSpacing: 0,
  },
  subtitle: {
    color: '#64748b',
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
  },
});
