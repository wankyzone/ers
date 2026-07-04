import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';

import { apiFetch } from '../src/config/api';
import { useAuth } from '../src/context/AuthContext';

export default function CreatePinScreen({ setTab }: any) {
  const { user } = useAuth();
  const [pin, setPin] = useState('');

  const handleCreate = async () => {
    console.log('USER:', user);

    if (!user?.id) {
      console.warn('User not ready, skipping API call');
      return;
    }

    if (pin.length !== 4) {
      return Alert.alert('PIN must be 4 digits');
    }

    const { data } = await apiFetch('/pin/set', {
      method: 'POST',
      headers: {
        'x-user-id': user.id,
        ...(user.role ? { 'x-role': user.role } : {}),
      },
      body: JSON.stringify({ pin }),
    });

    if (!data) {
      return Alert.alert('Error', 'Invalid server response');
    }

    Alert.alert('PIN Created');
    setTab('wallet');
  };

  return (
    <View style={s.container}>
      <Text style={s.title}>Create Withdrawal PIN</Text>

      <TextInput
        secureTextEntry
        keyboardType="numeric"
        maxLength={4}
        style={s.input}
        onChangeText={setPin}
      />

      <TouchableOpacity style={s.btn} onPress={handleCreate}>
        <Text style={s.text}>Set PIN</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020617', padding: 20 },
  title: { color: 'white', fontSize: 22, marginBottom: 20 },
  input: {
    backgroundColor: '#0f172a',
    color: 'white',
    padding: 16,
    borderRadius: 12,
    textAlign: 'center',
    fontSize: 20,
    letterSpacing: 10,
  },
  btn: {
    backgroundColor: '#22c55e',
    padding: 16,
    borderRadius: 12,
    marginTop: 20,
  },
  text: { color: 'white', textAlign: 'center' },
});
