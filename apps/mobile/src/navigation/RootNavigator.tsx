/**
 * LOCATION: src/navigation/RootNavigator.tsx
 *
 * IMPORT PATH ERRORS FIXED:
 *
 * ❌ WRONG (previous version used wrong relative depth):
 *      import { useAuth } from '../context/AuthContext';
 *      — From src/navigation/ → '../context/' resolves to src/context/ ✓
 *        (this one happened to be correct)
 *
 *      import AuthStack from './AuthStack';   ✓ (same folder — correct)
 *      import AppStack from './AppStack';     ✓ (same folder — correct)
 *
 * All three imports in this file are CORRECT for src/navigation/ location.
 * No path changes needed here — documenting for audit completeness.
 *
 * NOTE: If your project has an existing NavigationContainer in App.tsx
 * or MainApp.tsx, remove it. There must be exactly ONE NavigationContainer
 * in the entire app — it lives here and nowhere else.
 */

import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
// ✓ src/navigation/ → ../context/ → src/context/AuthContext.tsx
import { useAuth } from '../context/AuthContext';
// ✓ same directory
import AuthStack from './AuthStack';
import AppStack from './AppStack';

export default function RootNavigator() {
  const { user, loading } = useAuth();

  // Loading gate: show spinner while getSession() resolves on cold start.
  // Prevents the flash of AuthScreen for already-authenticated users.
  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#22c55e" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {user ? <AppStack /> : <AuthStack />}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    backgroundColor: '#020617',
    alignItems: 'center',
    justifyContent: 'center',
  },
});