import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import AuthButton from '../../components/auth/AuthButton';
import AuthHeader from '../../components/auth/AuthHeader';
import AuthInput from '../../components/auth/AuthInput';
import type { AuthStackParamList } from '../../navigation/AuthStack';

type Props = NativeStackScreenProps<AuthStackParamList, 'CreatePin'>;

export default function CreatePinScreen({ navigation }: Props) {
  const [pin, setPin] = useState('');
  const canContinue = pin.length === 4;

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
            title="Create PIN"
            subtitle="Use a 4-digit PIN for quick access to wallet and errand actions."
            onBack={navigation.goBack}
          />

          <View style={styles.form}>
            <View style={styles.pinPreview} accessibilityLabel={`${pin.length} of 4 PIN digits entered`}>
              {[0, 1, 2, 3].map((index) => (
                <View
                  key={index}
                  style={[styles.pinDot, pin.length > index && styles.pinDotActive]}
                />
              ))}
            </View>

            <AuthInput
              label="4-digit PIN"
              value={pin}
              onChangeText={(value) => setPin(value.replace(/\D/g, '').slice(0, 4))}
              keyboardType="number-pad"
              maxLength={4}
              secureTextEntry
              textContentType="password"
              autoComplete="off"
            />
            <Text style={styles.note}>
              PIN storage will be connected after profile completion is implemented.
            </Text>
            <AuthButton
              title="Continue"
              disabled={!canContinue}
              onPress={() => navigation.navigate('CompleteProfile')}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 24,
  },
  form: {
    gap: 18,
  },
  pinPreview: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 14,
    paddingVertical: 8,
  },
  pinDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#e2e8f0',
  },
  pinDotActive: {
    backgroundColor: '#16a34a',
  },
  note: {
    color: '#64748b',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
    textAlign: 'center',
  },
});
