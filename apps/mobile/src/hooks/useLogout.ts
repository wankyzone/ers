/**
 * LOCATION: src/hooks/useLogout.ts
 *
 * IMPORT PATH ERROR FIXED:
 *
 * ❌ WRONG (previous version):
 *      import { useAuth } from '../context/AuthContext';
 *      — From src/hooks/ → '../context/' resolves to src/context/ ✓
 *        (this was actually CORRECT for the src/ sub-structure)
 *
 * ✅ CONFIRMED CORRECT (no change needed for this import):
 *      import { useAuth } from '../context/AuthContext';
 *      — src/hooks/ → ../context/ → src/context/AuthContext.tsx ✓
 *
 * PATH TRACE:
 *   This file:    ers-mobile/src/hooks/useLogout.ts
 *   Target:       ers-mobile/src/context/AuthContext.tsx
 *   Steps:        ../  = ers-mobile/src/
 *                 ../context/AuthContext = ers-mobile/src/context/AuthContext ✓
 *
 * TYPESCRIPT FIX:
 *   ❌ catch (err: any)  — avoid `any` where possible
 *   ✅ catch (err: unknown) with type narrowing
 */

import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
// ✓ src/hooks/ → ../context/ → src/context/AuthContext.tsx
import { useAuth } from '../context/AuthContext';

export function useLogout() {
  const { signOut } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  const logout = useCallback(async () => {
    if (loggingOut) return; // guard against double-tap

    setLoggingOut(true);
    try {
      await signOut();
      // Navigation handled automatically:
      // signOut() → onAuthStateChange fires SIGNED_OUT → user = null
      // → RootNavigator re-renders → AuthStack shown. No navigate() needed.
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Logout failed';
      Alert.alert('Logout failed', message);
    } finally {
      setLoggingOut(false);
    }
  }, [signOut, loggingOut]);

  return { logout, loggingOut };
}