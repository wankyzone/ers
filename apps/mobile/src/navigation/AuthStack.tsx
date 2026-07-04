/**
 * LOCATION: src/navigation/AuthStack.tsx
 *
 * IMPORT PATH ERROR FIXED:
 *
 * ❌ WRONG (previous version assumed screens/ was at src/screens/):
 *      import AuthScreen from '../screens/AuthScreen';
 *      — From src/navigation/ → '../screens/' resolves to src/screens/
 *        but screens/ lives at PROJECT ROOT, not inside src/!
 *
 * ✅ FIXED:
 *      import AuthScreen from '../../screens/AuthScreen';
 *      — src/navigation/ → ../../ → project root → screens/AuthScreen.tsx ✓
 *
 * PATH TRACE:
 *   This file:    ers-mobile/src/navigation/AuthStack.tsx
 *   Target:       ers-mobile/screens/AuthScreen.tsx
 *   Steps:        ../  = ers-mobile/src/
 *                 ../../ = ers-mobile/           ← project root
 *                 ../../screens/AuthScreen       ✓
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
// ─── PATH FIX ────────────────────────────────────────────────────────────────
// ❌ was: '../screens/AuthScreen'   → resolves to src/screens/ (wrong)
// ✅ now: '../../screens/AuthScreen' → resolves to root screens/ (correct)
import AuthScreen from '../../screens/AuthScreen';

export type AuthStackParamList = {
  Auth: undefined;
  // Future: ForgotPassword, OTPVerify, etc.
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

export default function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Auth" component={AuthScreen} />
    </Stack.Navigator>
  );
}