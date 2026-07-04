import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import BottomTabs from './BottomTabs';
import CreateErrandScreen from '../../screens/CreateErrandScreen';
import TransactionsScreen from '../../screens/TransactionsScreen';
import KycScreen from '../../screens/KycScreen';
import ProfileScreen from '../../screens/ProfileScreen';
import WalletScreen from '../../screens/WalletScreen';
import WithdrawScreen from '../../screens/WithdrawScreen';
import WithdrawHistoryScreen from '../../screens/WithdrawHistoryScreen';
import SavedBanksScreen from '../../screens/SavedBanksScreen';
import SelectBankScreen from '../../screens/SelectBankScreen';
import PaymentSuccessScreen from '../../screens/PaymentSuccessScreen';
import CreatePinScreen from '../../screens/CreatePinScreen';
import OtpScreen from '../../screens/otpscreen';

// ─── PARAM LIST ─────────────────────────────────────────────

export type AppStackParamList = {
  Tabs: undefined;
  CreateErrand: undefined;
  Transactions: undefined;
  Profile: undefined;
  Wallet: undefined;
  SavedBanks: undefined;
  WithdrawHistory: undefined;
  CreatePin: undefined;

  Withdraw: { amount: number };
  SelectBank: { returnTo: 'Kyc' | 'Wallet' };
  PaymentSuccess: { amount: number; reference?: string };

  Kyc: { selectedBank?: { name: string; code: string } };

  OtpScreen: { redirectTo?: string } | undefined;
};

const Stack = createNativeStackNavigator<AppStackParamList>();

export default function AppStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs" component={BottomTabs} />
      <Stack.Screen name="CreateErrand" component={CreateErrandScreen} />
      <Stack.Screen name="Transactions" component={TransactionsScreen} />
      <Stack.Screen name="Kyc" component={KycScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="Wallet" component={WalletScreen} />
      <Stack.Screen name="Withdraw" component={WithdrawScreen} />
      <Stack.Screen name="WithdrawHistory" component={WithdrawHistoryScreen} />
      <Stack.Screen name="SavedBanks" component={SavedBanksScreen} />
      <Stack.Screen name="SelectBank" component={SelectBankScreen} />
      <Stack.Screen name="PaymentSuccess" component={PaymentSuccessScreen} />
      <Stack.Screen name="CreatePin" component={CreatePinScreen} />
      <Stack.Screen name="OtpScreen" component={OtpScreen} />
    </Stack.Navigator>
  );
}