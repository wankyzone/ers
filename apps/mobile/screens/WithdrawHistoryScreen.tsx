import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
} from 'react-native';

import { getTransactions, type Transaction } from '../src/services/api';
import { connectSocket } from '../src/services/socket';
import { useAuth } from '../src/context/AuthContext';

// ─── Formatter ─────────────────────────

const ngn = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
});

// ─── Timeline Logic ─────────────────────

function getTimeline(status: string) {
  return [
    { label: 'Requested', done: true },
    { label: 'Processing', done: status !== 'pending' },
    { label: 'Completed', done: status === 'completed' },
  ];
}

// ─── Timeline Component ─────────────────

function Timeline({ status }: { status: string }) {
  const steps = getTimeline(status);

  return (
    <View style={t.container}>
      {steps.map((step, i) => (
        <View key={i} style={t.row}>
          <View
            style={[
              t.dot,
              step.done ? t.activeDot : t.inactiveDot,
            ]}
          />

          {i !== steps.length - 1 && (
            <View
              style={[
                t.line,
                steps[i + 1].done ? t.activeLine : t.inactiveLine,
              ]}
            />
          )}

          <Text
            style={[
              t.label,
              step.done ? t.activeText : t.inactiveText,
            ]}
          >
            {step.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

// ─── Screen ─────────────────────────

export default function WithdrawHistoryScreen({ setTab }: any) {
  const { user } = useAuth();

  const [withdraws, setWithdraws] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // ─── FETCH (FIXED: pass userId) ─────────────────────────

  const fetchWithdraws = useCallback(
    async (opts: any = {}) => {
      if (!user?.id) return;

      try {
        opts.refreshing ? setRefreshing(true) : setLoading(true);

        const data = await getTransactions(user.id);

        const filtered = (data || []).filter(
          (tx: Transaction) => tx.type === 'release'
        );

        setWithdraws(filtered);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user?.id]
  );

  useEffect(() => {
    fetchWithdraws();
  }, [fetchWithdraws]);

  // ─── REALTIME SOCKET ─────────────────────────

  useEffect(() => {
    if (!user?.id) return;

    let socket: any;

    (async () => {
      socket = await connectSocket(user.id);

      socket.on('withdrawal:update', (update: any) => {
        setWithdraws((prev) =>
          prev.map((tx) =>
            tx.id === update.id
              ? { ...tx, status: update.status }
              : tx
          )
        );
      });
    })();

    return () => {
      socket?.off('withdrawal:update');
      socket?.disconnect?.();
    };
  }, [user?.id]);

  // ─── GROUPING ─────────────────────────

  const grouped = useMemo(() => {
    const groups: Record<string, Transaction[]> = {
      Today: [],
      Earlier: [],
    };

    const now = new Date();

    withdraws.forEach((tx) => {
      const d = new Date(tx.created_at);

      if (d.toDateString() === now.toDateString()) {
        groups.Today.push(tx);
      } else {
        groups.Earlier.push(tx);
      }
    });

    return groups;
  }, [withdraws]);

  // ─── LOADING ─────────────────────────

  if (loading) {
    return (
      <View style={s.centered}>
        <ActivityIndicator color="#22c55e" />
      </View>
    );
  }

  // ─── RENDER ─────────────────────────

  return (
    <View style={s.container}>
      <Text style={s.title}>Withdrawals</Text>

      <FlatList
        data={Object.entries(grouped)}
        keyExtractor={(item) => item[0]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchWithdraws({ refreshing: true })}
            tintColor="#22c55e"
          />
        }
        renderItem={({ item }) => {
          const [label, list] = item;

          if (!list.length) return null;

          return (
            <View>
              <Text style={s.section}>{label}</Text>

              {list.map((tx) => (
                <View key={tx.id} style={s.card}>
                  <Text style={s.amount}>
                    - {ngn.format(tx.amount)}
                  </Text>

                  <Text style={s.date}>
                    {new Date(tx.created_at).toLocaleString()}
                  </Text>

                  <Timeline status={tx.status} />

                  {!!tx.errand_id && (
                    <Text style={s.meta}>
                      Ref: {tx.errand_id.slice(0, 10)}
                    </Text>
                  )}
                </View>
              ))}
            </View>
          );
        }}
      />

      <TouchableOpacity onPress={() => setTab('wallet')}>
        <Text style={s.back}>← Back to Wallet</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── STYLES ─────────────────────────

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
    padding: 20,
  },

  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  title: {
    color: 'white',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 16,
  },

  section: {
    color: '#94a3b8',
    marginTop: 10,
    marginBottom: 6,
  },

  card: {
    backgroundColor: '#0f172a',
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
  },

  amount: {
    color: '#ef4444',
    fontWeight: '700',
    fontSize: 16,
  },

  date: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 4,
  },

  meta: {
    color: '#475569',
    fontSize: 11,
    marginTop: 6,
  },

  back: {
    color: '#22c55e',
    textAlign: 'center',
    marginTop: 20,
  },
});

// ─── TIMELINE STYLES ─────────────────────────

const t = StyleSheet.create({
  container: { marginTop: 10 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },

  activeDot: { backgroundColor: '#22c55e' },
  inactiveDot: { backgroundColor: '#1e293b' },

  line: {
    position: 'absolute',
    left: 4,
    top: 12,
    height: 20,
    width: 2,
  },

  activeLine: { backgroundColor: '#22c55e' },
  inactiveLine: { backgroundColor: '#1e293b' },

  label: {
    fontSize: 12,
    marginBottom: 12,
  },

  activeText: { color: 'white' },
  inactiveText: { color: '#475569' },
});