import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import AuthButton from '../../components/auth/AuthButton';
import AuthHeader from '../../components/auth/AuthHeader';
import AuthInput from '../../components/auth/AuthInput';
import type { AuthStackParamList } from '../../navigation/AuthStack';

type Props = NativeStackScreenProps<AuthStackParamList, 'VerifyOTP'>;

export default function VerifyOTPScreen({ navigation, route }: Props) {
  const [code, setCode] = useState('');
  const email = route.params?.email;
  const canContinue = code.length === 6;

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <AuthHeader
            title="Verify OTP"
            subtitle="Enter the 6-digit code sent to your contact to continue."
            onBack={navigation.goBack}
          />

          <View style={styles.form}>
            {email ? <Text style={styles.recipient}>{email}</Text> : null}
            <AuthInput
              label="Verification code"
              value={code}
              onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              maxLength={6}
              textContentType="oneTimeCode"
              autoComplete="sms-otp"
            />
            <AuthButton
              title="Verify and Continue"
              onPress={() => navigation.navigate('CreatePin')}
              disabled={!canContinue}
            />
            <AuthButton
              title="Resend Code"
              variant="ghost"
              onPress={() => undefined}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  flex: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 24,
  },
  form: {
    gap: 18,
  },
  recipient: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '800',
  },
});
