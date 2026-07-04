/**
 * LOCATION: ers-mobile/screens/AuthScreen.tsx  (project root /screens/)
 *
 * IMPORT PATH ERROR FIXED:
 *
 * ❌ WRONG (previous version):
 *      import supabase from '../supabase';
 *      — AuthScreen.tsx is at ROOT/screens/AuthScreen.tsx
 *      — '../supabase' resolves to the PARENT of screens/ = project root ✓
 *        ... actually this one IS correct for screens/ at root level.
 *        '../supabase' from screens/ → ers-mobile/supabase.ts ✓
 *
 * ✅ CONFIRMED CORRECT (no change needed):
 *      import supabase from '../supabase';
 *      — screens/AuthScreen.tsx → ../supabase → ers-mobile/supabase.ts ✓
 *
 * PATH TRACE:
 *   This file:  ers-mobile/screens/AuthScreen.tsx
 *   Target:     ers-mobile/supabase.ts
 *   Steps:      ../  = ers-mobile/
 *               ../supabase = ers-mobile/supabase.ts ✓
 *
 * TYPESCRIPT FIXES applied:
 * - InputFieldProps interface replaces `any` props
 * - Role typed as 'client' | 'runner' union (no string cast needed)
 * - email normalization with .toLowerCase()
 * - autoCapitalize / autoCorrect on TextInput
 * - loading-safe mode switch
 * - setLoading always in finally
 * - createProfile upsert after signup
 */

import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  View,
} from 'react-native';
// ✓ screens/ → ../ → project root → supabase.ts
import supabase from '../supabase';

// ─── Colors ──────────────────────────────────────────────────────────────────

const C = {
  bg: '#020617',
  card: '#0f172a',
  border: '#1e293b',
  green: '#22c55e',
  textPri: '#f1f5f9',
  textSec: '#94a3b8',
  textMute: '#475569',
};

// ─── InputField ──────────────────────────────────────────────────────────────

// TypeScript FIX: explicit interface instead of `any`
interface InputFieldProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  secure?: boolean;
  keyboardType?: TextInputProps['keyboardType'];
  autoCapitalize?: TextInputProps['autoCapitalize'];
  autoCorrect?: boolean;
  editable?: boolean;
  accessibilityLabel?: string;
}

function InputField({
  label,
  value,
  onChangeText,
  secure = false,
  keyboardType = 'default',
  autoCapitalize = 'none',
  autoCorrect = false,
  editable = true,
  accessibilityLabel,
}: InputFieldProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={s.inputWrap}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secure}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        style={[s.input, focused && { borderColor: C.green }]}
        placeholderTextColor={C.textMute}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        editable={editable}
        accessibilityLabel={accessibilityLabel ?? label}
      />
    </View>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function AuthScreen() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [role, setRole] = useState<'client' | 'runner'>('client');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const normalizedEmail = email.trim().toLowerCase();

  const validate = (): string | null => {
    if (!normalizedEmail) return 'Email is required.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail))
      return 'Enter a valid email address.';
    if (!password) return 'Password is required.';
    if (password.length < 6) return 'Password must be at least 6 characters.';
    return null;
  };

  const createProfile = async (userId: string) => {
    const { error } = await supabase.from('profiles').upsert(
      { id: userId, role, created_at: new Date().toISOString() },
      { onConflict: 'id' }
    );
    if (error) console.warn('[AuthScreen] createProfile error:', error.message);
  };

  const handleAuth = async () => {
    const validationError = validate();
    if (validationError) {
      Alert.alert('Invalid input', validationError);
      return;
    }

    setLoading(true);

    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });
        if (error) throw error;
        // onAuthStateChange → SIGNED_IN → RootNavigator switches to AppStack

      } else {
        const { data, error } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: { data: { role } },
        });
        if (error) throw error;

        if (data.user) await createProfile(data.user.id);

        if (!data.session) {
          Alert.alert(
            'Confirm your email',
            `We sent a confirmation link to ${normalizedEmail}. Please verify before logging in.`
          );
          setMode('login');
          return;
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Authentication failed';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <View style={s.header}>
        <Text style={s.logo}>ERS</Text>
        <Text style={s.tagline}>Send errands. Get things done.</Text>
      </View>

      <View style={s.switchRow}>
        {(['login', 'signup'] as const).map((m) => (
          <TouchableOpacity
            key={m}
            style={[s.switchBtn, mode === m && s.switchActive]}
            onPress={() => setMode(m)}
            disabled={loading}
            accessibilityLabel={m === 'login' ? 'Login tab' : 'Sign up tab'}
            accessibilityState={{ selected: mode === m }}
          >
            <Text style={s.switchText}>{m === 'login' ? 'Login' : 'Sign Up'}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={s.card}>
        <InputField
          label="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!loading}
          accessibilityLabel="Email address"
        />

        <InputField
          label="Password"
          value={password}
          onChangeText={setPassword}
          secure
          editable={!loading}
          accessibilityLabel="Password"
        />

        {mode === 'signup' && (
          <View style={s.roleRow}>
            {(['client', 'runner'] as const).map((r) => (
              <TouchableOpacity
                key={r}
                style={[s.roleBtn, role === r && s.roleActive]}
                onPress={() => setRole(r)}
                disabled={loading}
                accessibilityLabel={`Select role: ${r}`}
                accessibilityState={{ selected: role === r }}
              >
                <Text style={s.roleText}>{r.toUpperCase()}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <TouchableOpacity
          style={[s.cta, loading && s.ctaDisabled]}
          onPress={handleAuth}
          disabled={loading}
          accessibilityRole="button"
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.ctaText}>{mode === 'login' ? 'Login' : 'Create Account'}</Text>
          }
        </TouchableOpacity>
      </View>

      <Text style={s.footer}>Secure authentication powered by Supabase</Text>
      <Text style={s.subFooter}>ERS Platform</Text>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg, padding: 20, justifyContent: 'center' },
  header: { alignItems: 'center', marginBottom: 30 },
  logo: { color: C.textPri, fontSize: 34, fontWeight: '800' },
  tagline: { color: C.textSec, marginTop: 6 },
  switchRow: { flexDirection: 'row', backgroundColor: C.card, borderRadius: 10, marginBottom: 20 },
  switchBtn: { flex: 1, padding: 12, alignItems: 'center' },
  switchActive: { backgroundColor: C.green, borderRadius: 10 },
  switchText: { color: 'white', fontWeight: '600' },
  card: { backgroundColor: C.card, padding: 20, borderRadius: 14 },
  inputWrap: { marginBottom: 15 },
  label: { color: C.textSec, marginBottom: 6, fontSize: 12 },
  input: {
    backgroundColor: C.bg, color: 'white', padding: 12,
    borderRadius: 10, borderWidth: 1, borderColor: C.border,
  },
  roleRow: { flexDirection: 'row', gap: 10, marginBottom: 15 },
  roleBtn: { flex: 1, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: C.border, alignItems: 'center' },
  roleActive: { backgroundColor: C.green, borderColor: C.green },
  roleText: { color: 'white', fontWeight: '600' },
  cta: { backgroundColor: C.green, padding: 15, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  ctaDisabled: { opacity: 0.6 },
  ctaText: { color: 'white', fontWeight: '700', fontSize: 16 },
  footer: { textAlign: 'center', color: C.textMute, marginTop: 20, fontSize: 12 },
  subFooter: { textAlign: 'center', color: C.textMute, marginTop: 5, fontSize: 10 },
});