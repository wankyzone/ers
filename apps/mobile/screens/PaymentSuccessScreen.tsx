import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import {
  useNavigation,
  useRoute,
} from '@react-navigation/native';

// ─── Formatter ───────────────────────────────────────────────────

const ngn = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
});

// ─── Screen ──────────────────────────────────────────────────────

export default function PaymentSuccessScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();

  const amount = Number(route.params?.amount ?? 0);
  const reference = route.params?.reference;

  return (
    <View style={styles.container}>
      <View style={styles.iconWrapper}>
        <Text style={styles.icon}>✓</Text>
      </View>

      <Text style={styles.title}>
        Payment Successful
      </Text>

      <Text style={styles.amount}>
        {ngn.format(amount)}
      </Text>

      <Text style={styles.subtitle}>
        Your wallet has been credited successfully.
      </Text>

      {!!reference && (
        <Text style={styles.ref}>
          Ref: {String(reference).slice(0, 10)}...
        </Text>
      )}

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => navigation.navigate('Wallet')}
        >
          <Text style={styles.primaryText}>
            Back to Wallet
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={() =>
            navigation.navigate('Transactions')
          }
        >
          <Text style={styles.secondaryText}>
            View Transactions
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },

  iconWrapper: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#22c55e',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },

  icon: {
    color: 'white',
    fontSize: 40,
    fontWeight: 'bold',
  },

  title: {
    color: 'white',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 10,
  },

  amount: {
    color: '#22c55e',
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 10,
  },

  subtitle: {
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 10,
  },

  ref: {
    color: '#475569',
    fontSize: 12,
    marginBottom: 30,
  },

  actions: {
    width: '100%',
  },

  primaryBtn: {
    backgroundColor: '#22c55e',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 10,
  },

  primaryText: {
    color: 'white',
    fontWeight: '700',
  },

  secondaryBtn: {
    borderWidth: 1,
    borderColor: '#22c55e',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },

  secondaryText: {
    color: '#22c55e',
    fontWeight: '700',
  },
});