import React from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import AuthButton from '../../components/auth/AuthButton';
import AuthDivider from '../../components/auth/AuthDivider';
import AuthLogo from '../../components/auth/AuthLogo';
import type { AuthStackParamList } from '../../navigation/AuthStack';

type Props = NativeStackScreenProps<AuthStackParamList, 'Welcome'>;

export default function WelcomeScreen({ navigation }: Props) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.hero}>
          <AuthLogo />
          <View style={styles.copy}>
            <Text style={styles.eyebrow}>Errand Runners System</Text>
            <Text style={styles.title}>Move anything around town with confidence.</Text>
            <Text style={styles.subtitle}>
              Book trusted runners, track errands, and manage payments from one secure account.
            </Text>
          </View>
        </View>

        <View style={styles.actions}>
          <AuthButton
            title="Continue with Phone"
            variant="secondary"
            onPress={() => navigation.navigate('Register', { method: 'phone' })}
          />
          <AuthButton
            title="Continue with Email"
            onPress={() => navigation.navigate('Register', { method: 'email' })}
          />
          <AuthDivider />
          <AuthButton
            title="Sign In"
            variant="ghost"
            onPress={() => navigation.navigate('Login')}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  content: {
    flexGrow: 1,
    justifyContent: 'space-between',
    gap: 36,
    paddingHorizontal: 24,
    paddingTop: 34,
    paddingBottom: 28,
  },
  hero: {
    gap: 34,
    paddingTop: 24,
  },
  copy: {
    gap: 14,
  },
  eyebrow: {
    color: '#16a34a',
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0,
  },
  title: {
    color: '#0f172a',
    fontSize: 36,
    lineHeight: 42,
    fontWeight: '900',
    letterSpacing: 0,
  },
  subtitle: {
    color: '#64748b',
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
  },
  actions: {
    gap: 14,
  },
});
