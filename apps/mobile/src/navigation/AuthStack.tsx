import React from 'react';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import CreatePinScreen from '../screens/auth/CreatePinScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import VerifyOTPScreen from '../screens/auth/VerifyOTPScreen';
import WelcomeScreen from '../screens/auth/WelcomeScreen';

export type AuthStackParamList = {
  Welcome: undefined;
  Login: undefined;
  Register: { method?: 'email' | 'phone' } | undefined;
  ForgotPassword: undefined;
  VerifyOTP: { email?: string } | undefined;
  CreatePin: undefined;
  CompleteProfile: undefined;
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

function CompleteProfilePlaceholder() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.placeholder}>
        <Text style={styles.title}>Complete Profile</Text>
        <Text style={styles.subtitle}>
          Profile setup will be connected in the next implementation phase.
        </Text>
      </View>
    </SafeAreaView>
  );
}

export default function AuthStack() {
  return (
    <Stack.Navigator
      initialRouteName="Welcome"
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="VerifyOTP" component={VerifyOTPScreen} />
      <Stack.Screen name="CreatePin" component={CreatePinScreen} />
      <Stack.Screen name="CompleteProfile" component={CompleteProfilePlaceholder} />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 24,
  },
  title: {
    color: '#0f172a',
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '800',
    letterSpacing: 0,
  },
  subtitle: {
    color: '#64748b',
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
  },
});
