import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';

import {
  getUserBanks,
  setDefaultBank,
  deleteBank,
  type BankAccount,
} from '../src/services/api';

export default function SavedBanksScreen() {
  const navigation = useNavigation<any>();

  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchBanks = useCallback(async (refresh = false) => {
    try {
      refresh ? setRefreshing(true) : setLoading(true);

      const data = await getUserBanks();
      setAccounts(data);
    } catch {
      Alert.alert('Error', 'Failed to load bank accounts');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchBanks();
  }, [fetchBanks]);

  const handleSetDefault = async (id: string) => {
    try {
      setProcessingId(id);

      await setDefaultBank(id);

      setAccounts(prev =>
        prev.map(acc => ({
          ...acc,
          is_default: acc.id === id,
        })),
      );
    } catch {
      Alert.alert('Error', 'Could not set default account');
    } finally {
      setProcessingId(null);
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert('Remove account?', '', [
      { text: 'Cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            setProcessingId(id);

            await deleteBank(id);

            setAccounts(prev =>
              prev.filter(account => account.id !== id),
            );
          } catch {
            Alert.alert('Error', 'Could not delete account');
          } finally {
            setProcessingId(null);
          }
        },
      },
    ]);
  };

  const renderItem = ({ item }: { item: BankAccount }) => (
    <View
      style={[
        styles.card,
        item.is_default && styles.cardPrimary,
      ]}
    >
      <View style={{ flex: 1 }}>
        <Text style={styles.name}>
          {item.account_name}
        </Text>

        <Text style={styles.details}>
          {item.bank_name} • ****{item.account_number.slice(-4)}
        </Text>

        {item.is_default && (
          <Text style={styles.default}>
            DEFAULT
          </Text>
        )}
      </View>

      <View style={styles.actions}>
        {!item.is_default && (
          <TouchableOpacity
            disabled={processingId === item.id}
            onPress={() => handleSetDefault(item.id)}
          >
            {processingId === item.id ? (
              <ActivityIndicator color="#22c55e" />
            ) : (
              <Text style={styles.setDefault}>
                Make Default
              </Text>
            )}
          </TouchableOpacity>
        )}

        <TouchableOpacity
          disabled={processingId === item.id}
          onPress={() => handleDelete(item.id)}
        >
          <Text style={styles.delete}>
            Remove
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator
          size="large"
          color="#22c55e"
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        Bank Accounts
      </Text>

      <FlatList
        data={accounts}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchBanks(true)}
            tintColor="#22c55e"
          />
        }
        ListEmptyComponent={
          <Text style={styles.empty}>
            No bank accounts yet
          </Text>
        }
      />

      <TouchableOpacity
        style={styles.addBtn}
        onPress={() =>
          navigation.navigate('SelectBank', {
            returnTo: 'Wallet',
          })
        }
      >
        <Text style={styles.addText}>
          + Add Bank Account
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.back}>
          ← Back
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
    padding: 20,
  },

  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  title: {
    color: 'white',
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 20,
  },

  empty: {
    color: '#64748b',
    textAlign: 'center',
    marginTop: 40,
  },

  card: {
    backgroundColor: '#0f172a',
    padding: 16,
    borderRadius: 14,
    marginBottom: 12,
    flexDirection: 'row',
  },

  cardPrimary: {
    borderWidth: 1,
    borderColor: '#22c55e',
  },

  name: {
    color: 'white',
    fontWeight: '700',
  },

  details: {
    color: '#94a3b8',
    fontSize: 12,
  },

  default: {
    color: '#22c55e',
    fontSize: 12,
    marginTop: 4,
  },

  actions: {
    justifyContent: 'center',
    gap: 8,
  },

  setDefault: {
    color: '#22c55e',
    fontSize: 12,
  },

  delete: {
    color: '#ef4444',
    fontSize: 12,
  },

  addBtn: {
    backgroundColor: '#22c55e',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },

  addText: {
    color: 'white',
    fontWeight: '700',
  },

  back: {
    color: '#22c55e',
    marginTop: 15,
    textAlign: 'center',
  },
});