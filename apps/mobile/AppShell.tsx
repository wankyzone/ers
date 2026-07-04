import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { useAuth } from './src/context/AuthContext';
import AuthScreen from './screens/AuthScreen';
import MainApp from './MainApp';

export default function AppShell() {
  const auth = useAuth();

  const user = (auth as any)?.user;
  const initializing = (auth as any)?.initializing;

  const [booting, setBooting] = useState(true);

  useEffect(() => {
    // fallback boot gate if initializing is not implemented in context
    const timer = setTimeout(() => setBooting(false), 300);
    return () => clearTimeout(timer);
  }, []);

  // ─── LOADING STATE (robust fallback) ─────────────────────

  if (initializing || booting) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: '#020617',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <ActivityIndicator color="#22c55e" size="large" />
      </View>
    );
  }

  // ─── ROUTING GATE ─────────────────────

  return user ? <MainApp /> : <AuthScreen />;
}