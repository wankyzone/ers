import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import BottomTabs from './BottomTabs';
import CreateErrandScreen from '../../screens/CreateErrandScreen';
import TransactionsScreen from '../../screens/TransactionsScreen';

export type RootStackParamList = {
  Tabs: undefined;
  CreateErrand: undefined;
  Transactions: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>

        <Stack.Screen name="Tabs" component={BottomTabs} />

        <Stack.Screen
          name="CreateErrand"
          component={CreateErrandScreen}
          options={{ presentation: 'modal' }}
        />

        <Stack.Screen
          name="Transactions"
          component={TransactionsScreen}
        />

      </Stack.Navigator>
    </NavigationContainer>
  );
}