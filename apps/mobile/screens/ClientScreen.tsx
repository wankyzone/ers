import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  useNavigation,
  CompositeNavigationProp,
} from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useAuth } from '../src/context/AuthContext';
import { getClientErrands, confirmErrand } from '../src/services/api';
import TrackingMap from '../src/components/TrackingMap';
import { useSocket } from '../src/hooks/useSocket';

import type { RootTabParamList } from '../src/navigation/BottomTabs';
import type { RootStackParamList } from '../src/navigation';

const API_URL = process.env.EXPO_PUBLIC_API_URL!;

// ─── NAV TYPE ─────────────────────────

type NavProp = CompositeNavigationProp<
  BottomTabNavigationProp<RootTabParamList>,
  NativeStackNavigationProp<RootStackParamList>
>;

// ─── Tokens ─────────────────────────

const C = {
  bg: '#020617',
  card: '#0f172a',
  border: '#1e293b',
  green: '#22c55e',
  red: '#ef4444',
  textPri: '#f1f5f9',
  textSec: '#94a3b8',
  textMut: '#475569',
};

// ─── Screen ─────────────────────────

export default function ClientScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<NavProp>();
  const socketRef = useSocket(API_URL);

  const [errands, setErrands] = useState<any[]>([]);
  const [runnerLocation, setRunnerLocation] = useState<any>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ─── Fetch ─────────────────────────────────────

  const fetchErrands = async () => {
    if (!user?.id) return;

    try {
      setError(null);

      const data = await getClientErrands();

      if (!Array.isArray(data)) {
        throw new Error('Invalid response');
      }

      setErrands(data);
    } catch (err: any) {
      console.error('Fetch errands error:', err);
      setError(err.message || 'Failed to load errands');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchErrands();
  }, [user]);

  // ─── Active Errand ─────────────────────────────

  const activeErrand = useMemo(
    () => errands.find((e) => e.status === 'accepted'),
    [errands]
  );

  // ─── Socket Tracking ───────────────────────────

  useEffect(() => {
    if (!activeErrand) return;

    const socket = socketRef.current;
    if (!socket) return;

    socket.emit('join:errand', activeErrand.id);

    const handler = (data: any) => {
      if (!data?.lat || !data?.lng) return;

      setRunnerLocation({
        latitude: data.lat,
        longitude: data.lng,
      });
    };

    socket.on('location:update', handler);

    return () => {
      socket.off('location:update', handler);
    };
  }, [activeErrand]);

  // ─── Confirm ───────────────────────────────────

  const handleConfirm = async (id: string) => {
    if (!user?.id) return;

    try {
      await confirmErrand(id);
await fetchErrands();
    } catch (err: any) {
      console.error('Confirm failed:', err);
      setError(err.message || 'Failed to confirm');
    }
  };

  // ─── Loading ───────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={C.green} />
      </SafeAreaView>
    );
  }

  // ─── Error State ───────────────────────────────

  if (error) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={{ color: C.red, marginBottom: 10 }}>
          {error}
        </Text>

        <TouchableOpacity onPress={fetchErrands}>
          <Text style={{ color: C.green }}>Retry</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // ─── UI ────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container}>
      
      {/* HEADER */}
      <View style={styles.header}>
        <Text style={styles.headerText}>My Errands</Text>

        <TouchableOpacity
          style={styles.createBtn}
          onPress={() => navigation.navigate('CreateErrand')}
        >
          <Text style={styles.createBtnText}>+ Create</Text>
        </TouchableOpacity>
      </View>

      {/* TRACKING */}
      {activeErrand && (
        <>
          <TrackingMap runnerLocation={runnerLocation} />

          <TouchableOpacity
            style={styles.confirmBtn}
            onPress={() => handleConfirm(activeErrand.id)}
          >
            <Text style={styles.confirmBtnText}>
              Confirm Delivery
            </Text>
          </TouchableOpacity>
        </>
      )}

      {/* LIST */}
      <FlatList
        data={errands}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No errands yet</Text>
            <Text style={styles.emptyHint}>
              Tap + Create to post your first one
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            {!!item.status && (
              <Text style={styles.cardStatus}>{item.status}</Text>
            )}
          </View>
        )}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg, padding: 20 },

  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: C.bg,
  },

  listContent: { paddingBottom: 24 },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },

  headerText: {
    color: C.textPri,
    fontSize: 24,
    fontWeight: '700',
  },

  createBtn: {
    backgroundColor: C.green,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },

  createBtnText: {
    color: '#fff',
    fontWeight: '700',
  },

  confirmBtn: {
    backgroundColor: C.green,
    padding: 12,
    marginVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },

  confirmBtnText: {
    color: 'white',
    fontWeight: '700',
  },

  card: {
    backgroundColor: C.card,
    padding: 15,
    marginVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  cardTitle: {
    color: C.textPri,
    fontWeight: '600',
  },

  cardStatus: {
    color: C.green,
    fontSize: 12,
  },

  empty: {
    flex: 1,
    alignItems: 'center',
    marginTop: 60,
  },

  emptyTitle: {
    color: C.textSec,
    fontWeight: '600',
  },

  emptyHint: {
    color: C.textMut,
    marginTop: 6,
  },
});