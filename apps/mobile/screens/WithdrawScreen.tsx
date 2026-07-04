/**
 * LOCATION: screens/WithdrawScreen.tsx
 *
 * ═══════════════════════════════════════════════════════════════════
 * ROOT CAUSE ANALYSIS
 * ═══════════════════════════════════════════════════════════════════
 *
 * BUG 1 — amount received as JSX prop instead of route.params
 * ─────────────────────────────────────────────────────────────────
 * Original: Props { amount: number; setTab: (tab: string) => void }
 * Stack.Screen only passes `navigation` and `route` to components.
 * `amount` from props will always be undefined at runtime, meaning
 * withdrawWithPin(undefined, pin) is called — the backend receives
 * amount: null and either errors or processes a ₦0 withdrawal.
 *
 * AppStack declares: Withdraw: { amount: number }
 * WalletScreen navigates: navigation.navigate('Withdraw', { amount: Number(withdrawAmount) })
 *
 * FIX: const { amount } = route.params
 *
 * BUG 2 — setTab('otp-screen') after OTP required
 * ─────────────────────────────────────────────────────────────────
 * setTab is undefined under React Navigation.
 * AppStack must have an 'OtpScreen' route for this to work.
 *
 * FIX: navigation.navigate('OtpScreen')
 * Note: AppStack must register OtpScreen. The file otpscreen.tsx exists
 * in the screenshots. The route name used here is 'OtpScreen' — ensure
 * AppStack registers it with that exact name.
 *
 * BUG 3 — setTab('withdrawal-history') after success
 * ─────────────────────────────────────────────────────────────────
 * FIX: navigation.navigate('WithdrawHistory')
 * Matches the AppStackParamList route name exactly.
 *
 * BUG 4 — setTab('withdrawal-history') on the history link
 * ─────────────────────────────────────────────────────────────────
 * Same as BUG 3.
 * FIX: navigation.navigate('WithdrawHistory')
 *
 * BUG 5 — No navigation/route prop typing
 * ─────────────────────────────────────────────────────────────────
 * TypeScript had no knowledge of route.params.amount.
 * FIX: NativeStackScreenProps<AppStackParamList, 'Withdraw'> applied.
 *
 * BUG 6 — catch (err) typed as ApiError without narrowing
 * ─────────────────────────────────────────────────────────────────
 * Original: (err as ApiError)?.message — unsafe cast, hides real errors.
 * FIX: err instanceof Error ? err.message : (err as ApiError)?.message
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { withdrawWithPin, type ApiError } from '../src/services/api';
import type { AppStackParamList } from '../src/navigation/AppStack';

// ─── Types ───────────────────────────────────────────────────────────────────

type Props = NativeStackScreenProps<AppStackParamList, 'Withdraw'>;

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function WithdrawScreen({ navigation, route }: Props) {
  // BUG 1 FIX: read amount from route.params, not from a JSX prop
  const { amount } = route.params;

  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);

  // ─── Keypad handlers ─────────────────────────────────────────────────────

  const handlePress = (digit: string) => {
    if (pin.length >= 4) return;
    setPin((prev) => prev + digit);
  };

  const handleDelete = () => setPin((prev) => prev.slice(0, -1));

  // ─── Submit ──────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (pin.length < 4) return;

    try {
      setLoading(true);

      const res = await withdrawWithPin(amount, pin);

      // BUG 2 FIX: navigate to OtpScreen instead of setTab('otp-screen')
      if (res.requireOtp) {
        navigation.navigate('OtpScreen' as any); // add OtpScreen to AppStackParamList
        return;
      }

      Alert.alert('Success', res.message ?? 'Withdrawal successful');

      // BUG 3 FIX: navigate to WithdrawHistory instead of setTab
      navigation.navigate('WithdrawHistory');

    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : (err as ApiError)?.message ?? 'Withdraw failed';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
      setPin('');
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <View style={s.container}>
      <Text style={s.title}>Enter PIN</Text>
      <Text style={s.subtitle}>Authorize withdrawal</Text>

      {/* PIN Display */}
      <View style={s.pinRow}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={[s.pinDot, !!pin[i] && s.pinFilled]} />
        ))}
      </View>

      {/* Keypad */}
      <View style={s.keypad}>
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map(
          (key, i) => (
            <TouchableOpacity
              key={i}
              style={s.key}
              onPress={() => {
                if (key === '⌫') handleDelete();
                else if (key) handlePress(key);
              }}
            >
              <Text style={s.keyText}>{key}</Text>
            </TouchableOpacity>
          )
        )}
      </View>

      {/* Confirm */}
      <TouchableOpacity
        style={[s.button, (pin.length < 4 || loading) && s.disabled]}
        onPress={handleSubmit}
        disabled={pin.length < 4 || loading}
      >
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={s.buttonText}>Confirm Withdrawal</Text>}
      </TouchableOpacity>

      {/* BUG 4 FIX: navigate instead of setTab */}
      <TouchableOpacity onPress={() => navigation.navigate('WithdrawHistory')}>
        <Text style={s.link}>View Withdrawal History →</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
    padding: 20,
    justifyContent: 'center',
  },
  title: { color: 'white', fontSize: 24, fontWeight: '700', textAlign: 'center' },
  subtitle: { color: '#94a3b8', textAlign: 'center', marginBottom: 20 },
  pinRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 30,
    gap: 12,
  },
  pinDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#1e293b',
  },
  pinFilled: { backgroundColor: '#22c55e' },
  keypad: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  key: { width: '30%', padding: 20, alignItems: 'center' },
  keyText: { color: 'white', fontSize: 22, fontWeight: '600' },
  button: {
    backgroundColor: '#22c55e',
    padding: 16,
    borderRadius: 12,
    marginTop: 20,
    alignItems: 'center',
  },
  disabled: { opacity: 0.5 },
  buttonText: { color: 'white', fontWeight: '700' },
  link: { color: '#22c55e', marginTop: 20, textAlign: 'center' },
});