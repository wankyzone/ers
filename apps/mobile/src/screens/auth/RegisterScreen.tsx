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
import { emailSchema, passwordSchema } from '@ers/auth';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import AuthButton from '../../components/auth/AuthButton';
import AuthFooter from '../../components/auth/AuthFooter';
import AuthHeader from '../../components/auth/AuthHeader';
import AuthInput from '../../components/auth/AuthInput';
import LoadingOverlay from '../../components/auth/LoadingOverlay';
import { useAuth } from '../../hooks/useAuth';
import type { AuthStackParamList } from '../../navigation/AuthStack';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

interface RegisterErrors {
  email?: string;
  password?: string;
  confirmPassword?: string;
}

export default function RegisterScreen({ navigation, route }: Props) {
  const { signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<RegisterErrors>({});
  const [loading, setLoading] = useState(false);
  const method = route.params?.method ?? 'email';

  const normalizedEmail = email.trim().toLowerCase();

  const validate = () => {
    const nextErrors: RegisterErrors = {};
    const emailResult = emailSchema.safeParse(normalizedEmail);
    const passwordResult = passwordSchema.safeParse(password);

    if (!emailResult.success) {
      nextErrors.email = 'Enter a valid email address.';
    }

    if (!passwordResult.success) {
      nextErrors.password = 'Password must be at least 8 characters.';
    }

    if (confirmPassword !== password) {
      nextErrors.confirmPassword = 'Passwords do not match.';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    setLoading(true);
    try {
      await signUp(normalizedEmail, password);
      navigation.navigate('VerifyOTP', { email: normalizedEmail });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to create account.';
      Alert.alert('Registration failed', message);
    } finally {
      setLoading(false);
    }
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
            title="Create your account"
            subtitle={
              method === 'phone'
                ? 'Phone onboarding is almost ready. Continue with email to secure your ERS account today.'
                : 'Start with your email and set a secure password for your ERS account.'
            }
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
              editable={!loading}
              error={errors.email}
            />
            <AuthInput
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              textContentType="newPassword"
              autoComplete="new-password"
              editable={!loading}
              error={errors.password}
            />
            <AuthInput
              label="Confirm password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              textContentType="newPassword"
              autoComplete="new-password"
              editable={!loading}
              error={errors.confirmPassword}
            />

            <AuthButton
              title="Create Account"
              onPress={handleSubmit}
              loading={loading}
            />
          </View>

          <AuthFooter
            prompt="Already have an account?"
            actionLabel="Sign in"
            onPress={() => navigation.navigate('Login')}
          />
        </ScrollView>
      </KeyboardAvoidingView>
      <LoadingOverlay visible={loading} message="Creating account" />
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
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 24,
  },
  form: {
    gap: 18,
  },
});
