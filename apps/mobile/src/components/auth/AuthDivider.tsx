import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface AuthDividerProps {
  label?: string;
}

export default function AuthDivider({ label = 'or' }: AuthDividerProps) {
  return (
    <View style={styles.container} accessibilityRole="text">
      <View style={styles.line} />
      <Text style={styles.label}>{label}</Text>
      <View style={styles.line} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: '#e2e8f0',
  },
  label: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0,
  },
});
