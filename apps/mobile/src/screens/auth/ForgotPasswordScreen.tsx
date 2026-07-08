import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { emailSchema } from '@ers/auth';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import AuthButton from '../../components/auth/AuthButton';
import AuthHeader from '../../components/auth/AuthHeader';
import AuthInput from '../../components/auth/AuthInput';
import type { AuthStackParamList } from '../../navigation/AuthStack';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;

export default function ForgotPasswordScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | undefined>();

  const handleSubmit = () => {
    const normalizedEmail = email.trim().toLowerCase();
    const result = emailSchema.safeParse(normalizedEmail);

    if (!result.success) {
      setError('Enter a valid email address.');
      return;
    }

    setError(undefined);
    Alert.alert(
      'Password reset',
      'Password reset delivery will be connected in the next authentication phase.'
    );
  };

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
            title="Reset password"
            subtitle="Enter your email and we will prepare the reset flow for your account."
            onBack={navigation.goBack}
          />

          <View style={styles.form}>
            <AuthInput
              label="Email address"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="emailAddress"
              autoComplete="email"
              error={error}
            />
            <AuthButton title="Continue" onPress={handleSubmit} />
            <AuthButton
              title="Back to Sign In"
              variant="ghost"
              onPress={() => navigation.navigate('Login')}
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
});
