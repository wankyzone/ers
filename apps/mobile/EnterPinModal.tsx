import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';

export default function EnterPinModal({ visible, onSubmit, onClose }: any) {
  const [pin, setPin] = useState('');

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={s.overlay}>
        <View style={s.card}>
          <Text style={s.title}>Enter PIN</Text>

          <TextInput
            secureTextEntry
            keyboardType="numeric"
            maxLength={4}
            style={s.input}
            onChangeText={setPin}
          />

          <TouchableOpacity
            style={s.btn}
            onPress={() => onSubmit(pin)}
          >
            <Text style={s.text}>Confirm</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={onClose}>
            <Text style={s.cancel}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: '#000000aa',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#0f172a',
    padding: 20,
    borderRadius: 16,
  },
  title: { color: 'white', fontSize: 18, marginBottom: 10 },
  input: {
    backgroundColor: '#020617',
    color: 'white',
    padding: 14,
    borderRadius: 10,
    textAlign: 'center',
    fontSize: 20,
    letterSpacing: 10,
  },
  btn: {
    backgroundColor: '#22c55e',
    padding: 14,
    borderRadius: 10,
    marginTop: 15,
  },
  text: { color: 'white', textAlign: 'center' },
  cancel: { color: '#94a3b8', marginTop: 10, textAlign: 'center' },
});