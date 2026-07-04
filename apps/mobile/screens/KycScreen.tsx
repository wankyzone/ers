/**
 * LOCATION: screens/KycScreen.tsx
 *
 * ═══════════════════════════════════════════════════════════════════
 * ROOT CAUSE ANALYSIS
 * ═══════════════════════════════════════════════════════════════════
 *
 * BUG 1 — setTab prop (breaks entirely under React Navigation)
 * ─────────────────────────────────────────────────────────────────
 * Original: Props { setTab: (tab: string) => void }
 * Used in two places:
 *   (a) setTab('select-bank')  → navigate to bank picker
 *   (b) setTab('wallet')       → navigate to wallet after success
 *
 * React Navigation's Stack.Screen only passes `navigation` and `route`
 * to components. setTab will always be undefined at runtime, causing a
 * silent crash ("setTab is not a function") on both button taps.
 *
 * FIX:
 *   (a) navigation.navigate('SelectBank', { returnTo: 'Kyc' })
 *   (b) navigation.navigate('Wallet')  (or goBack if Wallet is in stack)
 *
 * BUG 2 — Bank selection return flow (completely broken)
 * ─────────────────────────────────────────────────────────────────
 * Original flow:
 *   KycScreen calls setTab('select-bank')
 *   SelectBankScreen calls onSelect(bank) callback prop
 *   ... but onSelect was never passed because there's no JSX prop mechanism
 *   through Stack.Screen.
 *
 * So even in the old setTab world, onSelect was always undefined.
 * The user could navigate to SelectBankScreen but selecting a bank
 * did nothing — form.bank_name and form.bank_code were never set.
 *
 * FIX: React Navigation params round-trip.
 *   KycScreen navigates to SelectBank with returnTo: 'Kyc'
 *   SelectBankScreen calls navigation.navigate('Kyc', { selectedBank: item })
 *   KycScreen reads route.params?.selectedBank in a useEffect and
 *   updates the form fields when it changes.
 *
 * BUG 3 — Wrong import path for apiFetch
 * ─────────────────────────────────────────────────────────────────
 * Original: import { apiFetch } from '../src/config/api'
 * src/config/api exports DEBUG_API and the API_URL config, NOT apiFetch.
 * apiFetch lives in src/services/api.
 *
 * FIX: import { apiFetch } from '../src/services/api'
 *
 * BUG 4 — saveBankAccount was a stub (console.log only)
 * ─────────────────────────────────────────────────────────────────
 * Original saveBankAccount() only logged to console. The bank account
 * was never actually saved to the backend after KYC success.
 * addBankAccount is now exported from api.ts and is called here.
 *
 * BUG 5 — user.role is not on Supabase's User type
 * ─────────────────────────────────────────────────────────────────
 * Supabase's User object does not have a top-level `.role` property
 * (that field is the system role, not the app role). The app role
 * stored at signup via options.data.role lives in:
 *   user.user_metadata.role
 *
 * FIX: user.user_metadata?.role wherever user.role was used.
 *
 * BUG 6 — TypeScript: no navigation/route prop types
 * ─────────────────────────────────────────────────────────────────
 * The screen had no navigation or route prop typing. TypeScript
 * could not catch wrong navigate() calls or missing params.
 *
 * FIX: NativeStackScreenProps<AppStackParamList, 'Kyc'> applied.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useAuth } from '../src/context/AuthContext';
import { apiFetch, addBankAccount } from '../src/services/api';
import type { AppStackParamList } from '../src/navigation/AppStack';

// ─── Types ───────────────────────────────────────────────────────────────────

type Props = NativeStackScreenProps<AppStackParamList, 'Kyc'>;

interface KycForm {
  full_name: string;
  phone: string;
  bvn: string;
  bank_code: string;
  bank_name: string;
  account_number: string;
  account_name: string;
}

// ─── Debounce Hook ───────────────────────────────────────────────────────────

function useDebounce(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function KycScreen({ navigation, route }: Props) {
  const { user } = useAuth();

  const [form, setForm] = useState<KycForm>({
    full_name: '',
    phone: '',
    bvn: '',
    bank_code: '',
    bank_name: '',
    account_number: '',
    account_name: '',
  });

  const [resolving, setResolving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resolveError, setResolveError] = useState('');

  const debouncedAccount = useDebounce(form.account_number, 700);

  // ─── BUG 2 FIX: receive selected bank from SelectBankScreen via params ──────
  // When SelectBankScreen calls navigation.navigate('Kyc', { selectedBank }),
  // this effect fires and populates the form fields.
  useEffect(() => {
    const selectedBank = route.params?.selectedBank;
    if (selectedBank) {
      setForm(prev => ({
        ...prev,
        bank_name: selectedBank.name,
        bank_code: selectedBank.code,
        // Clear account name whenever the bank changes so stale resolved
        // names don't persist from a previously selected bank.
        account_name: '',
      }));
    }
  }, [route.params?.selectedBank]);

  // ─── Reset account name when bank_code changes ───────────────────────────
  useEffect(() => {
    setForm(prev => ({ ...prev, account_name: '' }));
  }, [form.bank_code]);

  // ─── Resolve Account Name ────────────────────────────────────────────────
  useEffect(() => {
    const resolve = async () => {
      if (!user?.id) return;
      if (debouncedAccount.length !== 10 || !form.bank_code) return;

      try {
        setResolving(true);
        setResolveError('');

        // BUG 3 FIX: apiFetch is from services/api, not config/api
        const { data, res } = await apiFetch('/paystack/resolve-account', {
          method: 'POST',
          // BUG 5 FIX: role is in user_metadata, not top-level user object
          headers: {
            'x-user-id': user.id,
            'x-role': user.user_metadata?.role ?? 'client',
          },
          body: JSON.stringify({
            account_number: debouncedAccount,
            bank_code: form.bank_code,
          }),
        });

        if (!data) {
          Alert.alert('Error', 'Invalid server response');
          return;
        }

        const response = data as {
          status?: boolean;
          data?: {
            account_name?: string;
          };
        };

        if (res.ok && response.status){
          setForm(prev => ({ ...prev, account_name: response.data?.account_name }));
        } else {
          setResolveError('Invalid account details');
        }
      } catch {
        setResolveError('Could not verify account');
      } finally {
        setResolving(false);
      }
    };

    resolve();
  }, [debouncedAccount, form.bank_code, user]);

  // ─── Validation ──────────────────────────────────────────────────────────

  const isValid = useMemo(
    () =>
      Boolean(
        form.full_name.trim() &&
        form.phone.trim() &&
        form.bvn.trim() &&
        form.bank_code.trim() &&
        form.bank_name.trim() &&
        form.account_number.trim() &&
        form.account_name.trim()
      ),
    [form]
  );

  // ─── Submit ──────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!user?.id) {
      return Alert.alert('Error', 'User not authenticated');
    }
    if (!isValid) {
      return Alert.alert('Incomplete', 'Please complete all fields');
    }

    try {
      setLoading(true);

      const { data, res } = await apiFetch('/kyc/verify', {
        method: 'POST',
        headers: {
          'x-user-id': user.id,
          'x-role': user.user_metadata?.role ?? 'client',
        },
        body: JSON.stringify(form),
      });

      if (!data) {
        Alert.alert('Error', 'Invalid server response');
        return;
      }
      if (!res.ok) throw new Error(
        (data as { message?: string }).message ??
         'verification failed'
      );

      // BUG 4 FIX: actually save the bank account via API after KYC success
      await addBankAccount({
        bank_name: form.bank_name,
        bank_code: form.bank_code,
        account_number: form.account_number,
        account_name: form.account_name,
      });

      Alert.alert('KYC Complete ✅', 'Your account is now verified');

      // BUG 1 FIX: replace setTab('wallet') with navigation
      navigation.navigate('Wallet');

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Verification failed';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <ScrollView style={s.container} showsVerticalScrollIndicator={false}>
      <Text style={s.title}>Verify Your Identity</Text>
      <Text style={s.subtitle}>Required for withdrawals & higher limits</Text>

      <Section title="Personal Information">
        <Input
          label="Full Name"
          value={form.full_name}
          onChange={(v) => setForm(prev => ({ ...prev, full_name: v }))}
        />
        <Input
          label="Phone Number"
          value={form.phone}
          onChange={(v) => setForm(prev => ({ ...prev, phone: v }))}
          keyboardType="phone-pad"
        />
        <Input
          label="BVN"
          value={form.bvn}
          onChange={(v) => setForm(prev => ({ ...prev, bvn: v }))}
          keyboardType="numeric"
        />
      </Section>

      <Section title="Bank Details">
        {/* BUG 1 + 2 FIX: navigate to SelectBank instead of setTab */}
        <TouchableOpacity
          style={s.input}
          onPress={() => navigation.navigate('SelectBank', { returnTo: 'Kyc' })}
        >
          <Text style={{ color: form.bank_name ? 'white' : '#475569' }}>
            {form.bank_name || 'Select Bank'}
          </Text>
        </TouchableOpacity>

        <Input
          label="Account Number"
          value={form.account_number}
          onChange={(v) => setForm(prev => ({ ...prev, account_number: v }))}
          keyboardType="numeric"
        />

        <View style={s.accountBox}>
          {resolving ? (
            <ActivityIndicator color="#22c55e" />
          ) : form.account_name ? (
            <Text style={s.accountName}>✅ {form.account_name}</Text>
          ) : resolveError ? (
            <Text style={s.error}>❌ {resolveError}</Text>
          ) : (
            <Text style={s.placeholder}>Account name will appear here</Text>
          )}
        </View>
      </Section>

      <TouchableOpacity
        style={[s.button, (!isValid || loading) && s.disabled]}
        onPress={handleSubmit}
        disabled={!isValid || loading}
      >
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={s.buttonText}>Verify Identity</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

interface InputProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  keyboardType?: 'default' | 'numeric' | 'phone-pad';
}

function Input({ label, value, onChange, keyboardType = 'default' }: InputProps) {
  return (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        style={s.input}
        placeholderTextColor="#475569"
        keyboardType={keyboardType}
      />
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020617', padding: 20 },
  title: { color: 'white', fontSize: 26, fontWeight: '700' },
  subtitle: { color: '#94a3b8', marginBottom: 20 },
  section: { marginBottom: 20 },
  sectionTitle: { color: '#64748b', marginBottom: 10, fontWeight: '600' },
  field: { marginBottom: 12 },
  label: { color: '#94a3b8', marginBottom: 4, fontSize: 12 },
  input: {
    backgroundColor: '#0f172a',
    color: 'white',
    padding: 14,
    borderRadius: 10,
    marginBottom: 10,
  },
  accountBox: {
    backgroundColor: '#0f172a',
    padding: 12,
    borderRadius: 10,
    marginTop: 6,
  },
  accountName: { color: '#22c55e', fontWeight: '600' },
  error: { color: '#ef4444' },
  placeholder: { color: '#475569' },
  button: {
    backgroundColor: '#22c55e',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 40,
  },
  disabled: { opacity: 0.5 },
  buttonText: { color: 'white', fontWeight: '700' },
});