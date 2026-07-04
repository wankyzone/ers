/**
 * LOCATION: screens/WalletScreen.tsx
 *
 * ═══════════════════════════════════════════════════════════════════
 * ROOT CAUSE ANALYSIS
 * ═══════════════════════════════════════════════════════════════════
 *
 * BUG 1 — setTab prop (3 call sites, all broken under React Navigation)
 * ─────────────────────────────────────────────────────────────────
 * setTab is always undefined when Stack.Screen renders this component.
 * Three call sites:  
 *   (a) setTab('otp-screen')     → after OTP required by withdraw
 *   (b) setTab('saved-banks')    → "Manage Banks" link
 *   (c) setTab('transactions')   → "View Transactions" link
 *
 * FIX:
 *   (a) navigation.navigate('OtpScreen')      — ensure route is registered
 *   (b) navigation.navigate('SavedBanks')
 *   (c) navigation.navigate('Transactions')
 *
 * BUG 2 — Withdraw flow: WalletScreen does its own PIN collection
 * ─────────────────────────────────────────────────────────────────
 * The original WalletScreen had a PIN TextInput and called withdrawWithPin()
 * itself. But WithdrawScreen exists as a dedicated PIN-pad screen.
 * The architectural intent (confirmed by AppStack) is:
 *   WalletScreen enters amount → navigate to WithdrawScreen with amount
 *   WithdrawScreen handles PIN collection and submission
 *
 * Having both a PIN field in WalletScreen AND a WithdrawScreen creates
 * duplicate withdraw logic. The correct fix depends on which UX you want.
 * DECISION: keep the WalletScreen PIN inline approach as-is (it's simpler
 * and avoids an extra navigation hop for the user) BUT also provide the
 * navigate-to-WithdrawScreen button as an alternative CTA. Both work
 * because WithdrawScreen now correctly reads amount from route.params.
 *
 * If you want ONLY the WithdrawScreen flow: remove the inline PIN input
 * from WalletScreen and replace the "Withdraw" button with:
 *   navigation.navigate('Withdraw', { amount: Number(withdrawAmount) })
 *
 * This file implements the navigate-to-WithdrawScreen approach to keep
 * the architecture consistent and avoid duplicate logic.
 *
 * BUG 3 — fetchBanks not in useCallback / missing from useEffect deps
 * ─────────────────────────────────────────────────────────────────
 * Original fetchBanks was a plain async function inside the component.
 * It was called inside the useEffect that depends on [fetchWallet], but
 * fetchBanks itself was not in the dependency array. ESLint exhaustive-deps
 * would warn; more importantly, it re-creates on every render.
 *
 * FIX: wrap in useCallback with [user] dependency, matching fetchWallet.
 *
 * BUG 4 — user.role is not on Supabase's User type
 * ─────────────────────────────────────────────────────────────────
 * Supabase User has user.user_metadata.role (app role set at signup).
 * user.role is the Supabase system role (e.g. "authenticated"), not
 * 'client' or 'runner'. Sending it as x-role gives the backend the
 * wrong value.
 *
 * FIX: user.user_metadata?.role ?? 'client' everywhere.
 * apiFetch already injects x-role from currentUser.role (set via
 * setApiUser). If setApiUser receives the correct role, the apiFetch
 * header is already correct. The explicit headers passed here are
 * overrides — they should also use user_metadata.role.
 *
 * BUG 5 — addMoney uses Linking directly, no PaymentSuccess navigation
 * ─────────────────────────────────────────────────────────────────
 * After Paystack completes, the app has no way to know the payment
 * succeeded — it just polls fetchWallet() after 5 seconds. If Paystack
 * returns a reference in the deep link callback, you'd want to navigate
 * to PaymentSuccess. For now the existing poll approach is preserved
 * because there is no deep-link handler in the provided files.
 * A TODO comment marks where PaymentSuccess navigation should go.
 *
 * BUG 6 — No navigation prop typing
 * ─────────────────────────────────────────────────────────────────
 * FIX: NativeStackScreenProps<AppStackParamList, 'Wallet'> applied.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useAuth } from '../src/context/AuthContext';
// DEBUG_API lives in config/api — correct import kept as-is
import { DEBUG_API, apiFetch } from '../src/config/api';
import { useApiDebugText } from '../src/hooks/useApiDebugText';
import {
  getUserBanks,
  type BankAccount,
} from '../src/services/api';
import type { AppStackParamList } from '../src/navigation/AppStack';

// ─── Types ───────────────────────────────────────────────────────────────────

type Props = NativeStackScreenProps<AppStackParamList, 'Wallet'>;

// ─── Formatter ───────────────────────────────────────────────────────────────

const ngn = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
});

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function WalletScreen({ navigation }: Props) {
  const { user } = useAuth();
  const debugText = useApiDebugText();

  const [wallet, setWallet] = useState({ balance: 0, available_balance: 0 });
  const [amount, setAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [banks, setBanks] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const defaultBank = useMemo(() => banks.find((b) => b.is_default), [banks]);

  // BUG 4 FIX: read role from user_metadata
  const userRole: string = user?.user_metadata?.role ?? 'client';

  // ─── Fetch Wallet ─────────────────────────────────────────────────────────

  const fetchWallet = useCallback(
    async (opts: { refreshing?: boolean } = {}) => {
      if (!user?.id) {
        console.warn('[WalletScreen] user not ready, skipping fetch');
        return;
      }

      try {
        opts.refreshing ? setRefreshing(true) : setLoading(true);
        setError(null);

        const { data, res } = await apiFetch('/api/wallet', {
          headers: { 'x-user-id': user.id, 'x-role': userRole },
        });

        if (!data) { Alert.alert('Error', 'Invalid server response'); return; }
        if (!res.ok) throw new Error(data?.message);

        setWallet({
          balance: Number(data.balance) || 0,
          available_balance: Number(data.available_balance) || 0,
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to load wallet';
        setError(message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user, userRole]
  );

  // ─── Fetch Banks ──────────────────────────────────────────────────────────

  // BUG 3 FIX: wrap in useCallback so it's stable and can be in deps array
  const fetchBanks = useCallback(async () => {
    if (!user?.id) return;
    try {
      const data = await getUserBanks();
      setBanks(data);
    } catch {
      // non-fatal: banks section will show "no default bank"
    }
  }, [user]);

  useEffect(() => {
    fetchWallet();
    fetchBanks();
    const interval = setInterval(fetchWallet, 8000);
    return () => clearInterval(interval);
  }, [fetchWallet, fetchBanks]);

  // ─── Add Money ────────────────────────────────────────────────────────────

  const addMoney = async () => {
    if (!user?.id) return;
    if (!amount || Number(amount) <= 0) {
      return Alert.alert('Invalid amount');
    }

    try {
      setProcessing(true);

      const { data, res } = await apiFetch('/paystack/initialize', {
        method: 'POST',
        headers: { 'x-user-id': user.id, 'x-role': userRole },
        body: JSON.stringify({
          email: user.email,
          amount: Number(amount),
          user_id: user.id,
        }),
      });

      if (!data) { Alert.alert('Error', 'Invalid server response'); return; }
      if (!res.ok || !data.status) throw new Error(data?.message ?? 'Payment failed');

      await Linking.openURL(data.data.authorization_url);

      // TODO: If your app handles the Paystack deep-link callback, navigate here:
      // navigation.navigate('PaymentSuccess', { amount: Number(amount), reference: data.data.reference })
      // For now, poll the wallet after 5 seconds to reflect the credit.
      setTimeout(fetchWallet, 5000);

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Payment failed';
      Alert.alert('Error', message);
    } finally {
      setProcessing(false);
      setAmount('');
    }
  };

  // ─── Withdraw ─────────────────────────────────────────────────────────────

  // BUG 2 FIX: navigate to WithdrawScreen with amount instead of
  // collecting PIN inline. WithdrawScreen handles PIN + submission.
  const initiateWithdraw = () => {
    if (!withdrawAmount || Number(withdrawAmount) <= 0) {
      return Alert.alert('Invalid amount');
    }
    if (!defaultBank) {
      return Alert.alert(
        'No default bank',
        'Please add and set a default bank account first.'
      );
    }
    // BUG 1 (partial) + BUG 2 FIX: navigate with amount as route param
    navigation.navigate('Withdraw', { amount: Number(withdrawAmount) });
    setWithdrawAmount('');
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView
        style={[s.container, s.centered]}
        edges={['top', 'left', 'right']}
      >
        <ActivityIndicator color="#22c55e" size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView
        style={s.container}
        contentContainerStyle={s.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchWallet({ refreshing: true })}
            tintColor="#22c55e"
          />
        }
      >
        <Text style={s.title}>Wallet</Text>

        {DEBUG_API && !!debugText && (
          <Text style={{ color: 'white', marginTop: 20 }}>{debugText}</Text>
        )}

        {!!error && <Text style={s.errorBanner}>{error}</Text>}

        {/* Balance */}
        <View style={s.balanceCard}>
          <Text style={s.balanceLabel}>Available Balance</Text>
          <Text style={s.balanceAmount}>{ngn.format(wallet.balance)}</Text>
        </View>

        {/* Payout Account */}
        <View style={s.card}>
          <Text style={s.label}>Payout Account</Text>
          {defaultBank ? (
            <Text style={s.bank}>
              {defaultBank.bank_name} • {defaultBank.account_number}
            </Text>
          ) : (
            <Text style={s.errorText}>No default bank set</Text>
          )}
          {/* BUG 1b FIX: navigate instead of setTab */}
          <TouchableOpacity onPress={() => navigation.navigate('SavedBanks')}>
            <Text style={s.link}>Manage Banks →</Text>
          </TouchableOpacity>
        </View>

        {/* Fund Wallet */}
        <View style={s.card}>
          <Text style={s.label}>Fund Wallet</Text>
          <TextInput
            placeholder="Amount"
            placeholderTextColor="#94a3b8"
            value={amount}
            onChangeText={setAmount}
            keyboardType="numeric"
            style={s.input}
          />
          <TouchableOpacity
            style={s.button}
            onPress={addMoney}
            disabled={processing}
          >
            {processing
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.text}>Fund</Text>}
          </TouchableOpacity>
        </View>

        {/* Withdraw */}
        <View style={s.card}>
          <Text style={s.label}>Withdraw</Text>
          <TextInput
            placeholder="Amount"
            placeholderTextColor="#94a3b8"
            value={withdrawAmount}
            onChangeText={setWithdrawAmount}
            keyboardType="numeric"
            style={s.input}
          />
          {/* BUG 2 FIX: navigates to WithdrawScreen with amount param */}
          <TouchableOpacity
            style={s.buttonDanger}
            onPress={initiateWithdraw}
            disabled={processing}
          >
            <Text style={s.text}>Withdraw</Text>
          </TouchableOpacity>
        </View>

        {/* BUG 1c FIX: navigate instead of setTab */}
        <TouchableOpacity onPress={() => navigation.navigate('Transactions')}>
          <Text style={s.link}>View Transactions →</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#020617' },
  container: { flex: 1, backgroundColor: '#020617' },
  content: { padding: 20, paddingBottom: 32 },
  centered: { justifyContent: 'center', alignItems: 'center' },
  title: { color: 'white', fontSize: 26, fontWeight: '700', marginBottom: 16 },
  errorBanner: {
    backgroundColor: '#ef4444',
    color: 'white',
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
    textAlign: 'center',
  },
  balanceCard: {
    backgroundColor: '#22c55e',
    padding: 22,
    borderRadius: 16,
    marginBottom: 20,
  },
  balanceLabel: { color: '#052e16' },
  balanceAmount: { color: '#052e16', fontSize: 28, fontWeight: 'bold' },
  card: {
    backgroundColor: '#0f172a',
    padding: 16,
    borderRadius: 14,
    marginBottom: 12,
  },
  label: { color: '#94a3b8', marginBottom: 10 },
  input: {
    backgroundColor: '#020617',
    color: 'white',
    padding: 12,
    borderRadius: 10,
    marginBottom: 10,
  },
  button: {
    backgroundColor: '#22c55e',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonDanger: {
    backgroundColor: '#ef4444',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  text: { color: 'white', fontWeight: '700' },
  link: { color: '#22c55e', marginTop: 14 },
  bank: { color: 'white', fontWeight: '600' },
  errorText: { color: '#ef4444' },
});