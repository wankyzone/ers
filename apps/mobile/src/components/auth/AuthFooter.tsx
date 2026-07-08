import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface AuthFooterProps {
  prompt: string;
  actionLabel: string;
  onPress: () => void;
}

export default function AuthFooter({
  prompt,
  actionLabel,
  onPress,
}: AuthFooterProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.prompt}>{prompt}</Text>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={actionLabel}
        hitSlop={10}
      >
        <Text style={styles.action}>{actionLabel}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
  },
  prompt: {
    color: '#64748b',
    fontSize: 15,
    fontWeight: '600',
  },
  action: {
    color: '#16a34a',
    fontSize: 15,
    fontWeight: '800',
  },
});
