import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';

import { apiFetch } from '../src/config/api';
import { useAuth } from '../src/context/AuthContext';
import { NativeStackScreenProps } from '@react-navigation/native-stack';  
import { AppStackParamList } from '../src/navigation/AppStack';

type Props = NativeStackScreenProps<AppStackParamList, 'OtpScreen'>;

export default function OtpScreen({ navigation }: Props) {
  const { user } = useAuth();
  const [code, setCode] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const isValidOtp = (value: string) => /^\d{6}$/.test(value);

  const verify = async () => {
    const otp = code.trim();

    if (loading) return;

    if (!user?.id) {
      Alert.alert('Error', 'User session not ready. Please re-login.');
      return;
    }

    if (!isValidOtp(otp)) {
      Alert.alert('Invalid OTP', 'Enter a valid 6-digit code');
      return;
    }

    try {
      setLoading(true);

      const { data, res } = await apiFetch('/otp/verify', {
        method: 'POST',
        headers: {
          'x-user-id': String(user.id),
          'x-role': String(user.role ?? ''),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code: otp }),
      });

      if (!res?.ok) {
        throw new Error(data?.message || 'OTP verification failed');
      }

      Alert.alert('Success', 'Device verified successfully');

      // 🚀 Navigation-native flow (replace setTab)
      navigation.replace('Wallet');

    } catch (err: any) {
      Alert.alert(
        'Error',
        err?.message || 'Something went wrong. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={s.container}>
      <Text style={s.title}>Enter OTP</Text>

      <TextInput
        value={code}
        onChangeText={(v) => setCode(v.replace(/[^0-9]/g, ''))}
        style={s.input}
        keyboardType="number-pad"
        placeholder="6-digit code"
        placeholderTextColor="#475569"
        maxLength={6}
      />

      <TouchableOpacity
        style={[s.button, loading && s.buttonDisabled]}
        onPress={verify}
        activeOpacity={0.8}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={s.text}>Verify</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    color: 'white',
    fontSize: 24,
    marginBottom: 20,
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#0f172a',
    color: 'white',
    padding: 14,
    borderRadius: 10,
    marginBottom: 12,
    letterSpacing: 6,
    fontSize: 18,
  },
  button: {
    backgroundColor: '#22c55e',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  text: {
    color: 'white',
    fontWeight: 'bold',
  },
});