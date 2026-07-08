import React from 'react';
import { ActivityIndicator, Modal, StyleSheet, Text, View } from 'react-native';

interface LoadingOverlayProps {
  visible: boolean;
  message?: string;
}

export default function LoadingOverlay({
  visible,
  message = 'Please wait',
}: LoadingOverlayProps) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.panel} accessibilityRole="alert">
          <ActivityIndicator size="large" color="#16a34a" />
          <Text style={styles.message}>{message}</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.52)',
  },
  panel: {
    minWidth: 164,
    borderRadius: 8,
    alignItems: 'center',
    gap: 14,
    paddingVertical: 24,
    paddingHorizontal: 22,
    backgroundColor: '#ffffff',
  },
  message: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '700',
  },
});
