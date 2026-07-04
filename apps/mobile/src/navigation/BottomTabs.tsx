import React from 'react';
import { StyleSheet } from 'react-native';
import {
  createBottomTabNavigator,
} from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ClientScreen from '../../screens/ClientScreen';
import RunnerScreen from '../../screens/RunnerScreen';
import WalletScreen from '../../screens/WalletScreen';
import ProfileScreen from '../../screens/ProfileScreen';

// ─────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────

export type RootTabParamList = {
  Client: undefined;
  Runner: undefined;
  Wallet: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();

// ─────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────

export default function BottomTabs() {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      initialRouteName="Client"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#22c55e',
        tabBarInactiveTintColor: '#94a3b8',
        tabBarStyle: [
          styles.tabBar,
          {
            paddingBottom: insets.bottom,
            height: 65 + insets.bottom,
          },
        ],
        tabBarItemStyle: styles.tabBarItem,
        tabBarLabelStyle: styles.tabBarLabel,
      }}
    >
      {/* MAIN TABS */}
      <Tab.Screen name="Client" component={ClientScreen} />
      <Tab.Screen name="Runner" component={RunnerScreen} />
      <Tab.Screen name="Wallet" component={WalletScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

// ─────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#0B1220',
    borderTopWidth: 0,
    elevation: 8,
    position: 'absolute',
  },
  tabBarItem: {
    paddingVertical: 6,
  },
  tabBarLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
});