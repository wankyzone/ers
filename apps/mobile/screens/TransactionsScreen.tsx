import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { useAuth } from '../src/context/AuthContext';
import {
  getTransactions,
  type ApiError,
  type Transaction,
} from '../src/services/api';

// ─── Formatter ─────────────────────────

const ngn = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
});

// ─── Screen ────────────────────────────

export default function WalletDashboard({ setTab }: any) {
  const { user } = useAuth();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // ─── FETCH (FIXED: now passes userId) ─────────────────────────

  const fetchTransactions = useCallback(async () => {
    if (!user?.id) return;

    try {
      setLoading(true);

      const data = await getTransactions(user.id);

      setTransactions(Array.isArray(data) ? data : []);
    } catch (err) {
      console.log((err as ApiError)?.message || 'Failed to load transactions');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // ─── REFRESH HANDLER ─────────────────────────

  const onRefresh = useCallback(async () => {
    if (!user?.id) return;

    try {
      setRefreshing(true);

      const data = await getTransactions(user.id);

      setTransactions(Array.isArray(data) ? data : []);
    } catch (err) {
      console.log((err as ApiError)?.message || 'Refresh failed');
    } finally {
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  // ─── ANALYTICS ENGINE ─────────────────────

  const analytics = useMemo(() => {
    let income = 0;
    let expense = 0;

    transactions.forEach((tx) => {
      const amount = Number(tx.amount) || 0;

      if (tx.type === 'payment') {
        expense += amount;
      }

      if (tx.type === 'release' || tx.type === 'refund') {
        income += amount;
      }
    });

    return { income, expense };
  }, [transactions]);

  const balance = analytics.income - analytics.expense;

  // ─── LOADING STATE ─────────────────────

  if (loading) {
    return (
      <View style={[s.container, s.center]}>
        <ActivityIndicator color="#22c55e" size="large" />
      </View>
    );
  }

  // ─── RENDER ─────────────────────────

  return (
    <ScrollView
      style={s.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#22c55e"
        />
      }
    >
      {/* HEADER */}
      <View style={s.header}>
        <Text style={s.title}>Wallet</Text>

        <TouchableOpacity onPress={() => setTab('wallet')}>
          <Text style={s.close}>Close</Text>
        </TouchableOpacity>
      </View>

      {/* BALANCE */}
      <View style={s.balanceCard}>
        <Text style={s.label}>Available Balance</Text>
        <Text style={s.balance}>{ngn.format(balance)}</Text>

        <View style={s.actions}>
          <TouchableOpacity style={s.actionBtn}>
            <Text style={s.actionText}>Deposit</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.actionBtn}>
            <Text style={s.actionText}>Withdraw</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* INCOME / EXPENSE */}
      <View style={s.stats}>
        <View style={s.statCard}>
          <Text style={s.statLabel}>Income</Text>
          <Text style={[s.statValue, { color: '#22c55e' }]}>
            {ngn.format(analytics.income)}
          </Text>
        </View>

        <View style={s.statCard}>
          <Text style={s.statLabel}>Expense</Text>
          <Text style={[s.statValue, { color: '#ef4444' }]}>
            {ngn.format(analytics.expense)}
          </Text>
        </View>
      </View>

      {/* NAV */}
      <TouchableOpacity
        style={s.viewTx}
        onPress={() => setTab('transactions')}
      >
        <Text style={s.viewTxText}>View Full Transactions →</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ─── STYLES ─────────────────────────

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
    padding: 20,
  },

  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  title: {
    color: 'white',
    fontSize: 22,
    fontWeight: '700',
  },

  close: {
    color: '#22c55e',
  },

  balanceCard: {
    backgroundColor: '#22c55e',
    padding: 20,
    borderRadius: 16,
    marginTop: 15,
  },

  label: {
    color: '#052e16',
  },

  balance: {
    color: '#052e16',
    fontSize: 28,
    fontWeight: '800',
    marginTop: 5,
  },

  actions: {
    flexDirection: 'row',
    marginTop: 15,
    gap: 10,
  },

  actionBtn: {
    backgroundColor: '#052e16',
    padding: 10,
    borderRadius: 10,
  },

  actionText: {
    color: '#22c55e',
  },

  stats: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
  },

  statCard: {
    flex: 1,
    backgroundColor: '#0f172a',
    padding: 15,
    borderRadius: 12,
  },

  statLabel: {
    color: '#94a3b8',
    fontSize: 12,
  },

  statValue: {
    fontWeight: '700',
    marginTop: 5,
  },

  viewTx: {
    marginTop: 20,
    alignItems: 'center',
  },

  viewTxText: {
    color: '#22c55e',
    fontWeight: '600',
  },
});