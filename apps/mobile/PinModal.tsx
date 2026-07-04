import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet
} from 'react-native';

export default function PinModal({ onSubmit, onClose }: any) {
  const [pin, setPin] = useState('');

  return (
    <View style={styles.overlay}>
      <View style={styles.box}>
        <Text style={styles.title}>Enter PIN</Text>

        <TextInput
          value={pin}
          onChangeText={setPin}
          keyboardType="numeric"
          maxLength={4}
          secureTextEntry
          style={styles.input}
        />

        <TouchableOpacity onPress={() => onSubmit(pin)} style={styles.btn}>
          <Text style={styles.text}>Confirm</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={onClose}>
          <Text style={styles.cancel}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0, bottom: 0, left: 0, right: 0,
    backgroundColor: '#000000aa',
    justifyContent: 'center',
    alignItems: 'center'
  },
  box: {
    backgroundColor: '#0f172a',
    padding: 20,
    borderRadius: 12,
    width: '80%'
  },
  title: { color: 'white', marginBottom: 10 },
  input: {
    backgroundColor: '#020617',
    color: 'white',
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
    textAlign: 'center',
    fontSize: 20,
    letterSpacing: 8
  },
  btn: {
    backgroundColor: '#22c55e',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center'
  },
  text: { color: 'white', fontWeight: 'bold' },
  cancel: { color: '#94a3b8', marginTop: 10, textAlign: 'center' }
});