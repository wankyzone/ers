/**
 * LOCATION: screens/SelectBankScreen.tsx
 *
 * ═══════════════════════════════════════════════════════════════════
 * ROOT CAUSE ANALYSIS
 * ═══════════════════════════════════════════════════════════════════
 *
 * BUG 1 — onSelect callback prop (impossible under React Navigation)
 * ─────────────────────────────────────────────────────────────────
 * Original: Props { onSelect: (bank: Bank) => void; setTab: (tab: string) => void }
 *
 * Stack.Screen renders components by reference:
 *   <Stack.Screen name="SelectBank" component={SelectBankScreen} />
 * There is no mechanism to pass onSelect through this.
 * onSelect is always undefined at runtime. Tapping a bank did nothing.
 *
 * FIX: On bank tap, navigate back to the returnTo screen with the
 * selected bank as a route param:
 *   navigation.navigate('Kyc', { selectedBank: { name, code } })
 *
 * The returnTo param (from AppStack: SelectBank: { returnTo: 'Kyc' | 'Wallet' })
 * tells this screen which screen to navigate back to. This makes
 * SelectBankScreen reusable from both KycScreen and any future flow.
 *
 * BUG 2 — setTab('kyc') on back button
 * ─────────────────────────────────────────────────────────────────
 * Original: <TouchableOpacity onPress={() => setTab('kyc')}>
 * setTab is undefined under React Navigation — tapping back crashes.
 *
 * FIX: navigation.goBack()
 * React Navigation automatically returns to the calling screen
 * (KycScreen in this case) without any explicit route name needed.
 *
 * BUG 3 — No navigation/route prop typing
 * ─────────────────────────────────────────────────────────────────
 * TypeScript had no knowledge of route.params.returnTo, so wrong
 * navigate calls would not be caught at compile time.
 *
 * FIX: NativeStackScreenProps<AppStackParamList, 'SelectBank'> applied.
 * TypeScript now enforces that navigation.navigate('Kyc', { selectedBank })
 * matches AppStackParamList['Kyc'].
 */

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../src/navigation/AppStack';

// ─── Types ───────────────────────────────────────────────────────────────────

type Props = NativeStackScreenProps<AppStackParamList, 'SelectBank'>;

interface Bank {
  name: string;
  code: string;
}

// ─── Static Bank List ────────────────────────────────────────────────────────

const BANKS: Bank[] = [
  { name: 'Access Bank', code: '044' },
  { name: 'GTBank', code: '058' },
  { name: 'First Bank', code: '011' },
  { name: 'UBA', code: '033' },
  { name: 'Zenith Bank', code: '057' },
  { name: 'Fidelity Bank', code: '070' },
  { name: 'Union Bank', code: '032' },
  { name: 'Sterling Bank', code: '232' },
  { name: 'Wema Bank', code: '035' },
  { name: 'Polaris Bank', code: '076' },
  { name: 'Opay', code: '999992' },
  { name: 'Palmpay', code: '999991' },
  { name: 'Moniepoint', code: '50515' },
];

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function SelectBankScreen({ navigation, route }: Props) {
  const [query, setQuery] = useState('');

  // returnTo tells us which screen to navigate back to after selection.
  // AppStack declares: SelectBank: { returnTo: 'Kyc' | 'Wallet' }
  const { returnTo } = route.params;

  const filteredBanks = useMemo(() => {
    if (!query.trim()) return BANKS;
    return BANKS.filter((b) =>
      b.name.toLowerCase().includes(query.toLowerCase())
    );
  }, [query]);

  // ── BUG 1 FIX: pass selected bank as navigation param instead of callback ──
  const handleSelect = (bank: Bank) => {
    if (returnTo === 'Kyc') {
      // Navigate to KycScreen with the selectedBank param.
      // KycScreen's useEffect watches route.params.selectedBank and
      // updates the form when this fires.
      navigation.navigate('Kyc', { selectedBank: { name: bank.name, code: bank.code } });
    } else {
      // returnTo === 'Wallet' — future use case (e.g. change payout account)
      navigation.goBack();
    }
  };

  return (
    <View style={s.container}>
      <Text style={s.title}>Select Bank</Text>

      <TextInput
        placeholder="Search bank..."
        placeholderTextColor="#475569"
        value={query}
        onChangeText={setQuery}
        style={s.search}
        autoCapitalize="none"
        autoCorrect={false}
      />

      <FlatList
        data={filteredBanks}
        keyExtractor={(item) => item.code}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={s.bankRow}
            onPress={() => handleSelect(item)}
          >
            <View style={s.logo}>
              <Text style={s.logoText}>{item.name.charAt(0)}</Text>
            </View>
            <Text style={s.bankName}>{item.name}</Text>
          </TouchableOpacity>
        )}
      />

      {/* BUG 2 FIX: goBack() replaces setTab('kyc') */}
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Text style={s.back}>← Back</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020617', padding: 20 },
  title: { color: 'white', fontSize: 22, fontWeight: '700', marginBottom: 12 },
  search: {
    backgroundColor: '#0f172a',
    color: 'white',
    padding: 12,
    borderRadius: 10,
    marginBottom: 15,
  },
  bankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: '#0f172a',
    borderRadius: 12,
    marginBottom: 8,
  },
  logo: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#22c55e',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  logoText: { color: '#052e16', fontWeight: 'bold' },
  bankName: { color: 'white', fontSize: 15 },
  back: { color: '#22c55e', marginTop: 15 },
});