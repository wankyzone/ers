// screens/RunnerScreen.tsx — REAL-TIME DISPATCH ENGINE (UBER-STYLE)

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { io, Socket } from 'socket.io-client';

import { useAuth } from '../src/context/AuthContext';
import { DEBUG_API } from '../src/config/api';
import { useApiDebugText } from '../src/hooks/useApiDebugText';
import { Errand } from '../src/services/api';

// ─── CONFIG ─────────────────────────

const SOCKET_URL = 'https://YOUR_BACKEND_URL'; // replace

const C = {
  bg: '#020617',
  card: '#0f172a',
  border: '#1e293b',
  green: '#22c55e',
  red: '#ef4444',
  textPri: '#f1f5f9',
  textSec: '#94a3b8',
};

// ─── SOCKET INSTANCE (singleton pattern) ───

let socket: Socket | null = null;

// ─── MAIN SCREEN ─────────────────────

export default function RunnerScreen() {
  const { user } = useAuth();
  const debugText = useApiDebugText();

  const [errands, setErrands] = useState<Errand[]>([]);
  const [loading, setLoading] = useState(true);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  const acceptLock = useRef(false);

  // ─── INIT SOCKET ─────────────────────

  useEffect(() => {
    if (!user?.id) return;

    socket = io(SOCKET_URL, {
      transports: ['websocket'],
      auth: {
        userId: user.id,
        role: user.role,
      },
    });

    socket.on('connect', () => {
      setConnected(true);
      setLoading(false);
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    // 🔥 REAL-TIME NEW ERRAND
    socket.on('errand:new', (errand: Errand) => {
      setErrands(prev => {
        const exists = prev.some(e => e.id === errand.id);
        if (exists) return prev;
        return [errand, ...prev];
      });
    });

    // 🔥 ERRAND REMOVED (accepted by another runner)
    socket.on('errand:removed', (id: string) => {
      setErrands(prev => prev.filter(e => e.id !== id));
    });

    // initial bootstrap
    socket.emit('runner:join');

    return () => {
      socket?.disconnect();
      socket = null;
    };
  }, [user?.id]);

  // ─── ACCEPT ERRAND (ATOMIC DISPATCH) ───

  const handleAccept = useCallback((id: string) => {
    if (!socket || !user?.id) return;
    if (acceptLock.current) return;

    acceptLock.current = true;
    setAcceptingId(id);

    socket.emit(
      'errand:accept',
      {
        errandId: id,
        runnerId: user.id,
      },
      (response: any) => {
        acceptLock.current = false;
        setAcceptingId(null);

        if (!response?.ok) {
          Alert.alert('Failed', response?.message || 'Acceptance rejected');
          return;
        }

        // optimistic removal
        setErrands(prev => prev.filter(e => e.id !== id));

        Alert.alert('Success', 'Errand assigned to you');
      }
    );
  }, [user?.id]);

  // ─── UI HELPERS ─────────────────────

  const renderItem = useCallback(
    ({ item }: { item: Errand }) => (
      <View style={card.wrapper}>
        <View style={card.body}>
          <Text style={card.title}>{item.title}</Text>

          <Text style={card.meta}>
            📍 {item.pickup_location ?? '—'} → {item.delivery_location ?? '—'}
          </Text>

          <Text style={card.desc} numberOfLines={2}>
            {item.description}
          </Text>
        </View>

        <TouchableOpacity
          style={[card.btn, acceptingId === item.id && card.disabled]}
          onPress={() => handleAccept(item.id)}
          disabled={acceptingId === item.id}
        >
          {acceptingId === item.id ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={card.btnText}>Accept</Text>
          )}
        </TouchableOpacity>
      </View>
    ),
    [acceptingId, handleAccept]
  );

  const header = useMemo(() => {
    return (
      <View style={s.header}>
        <Text style={s.title}>Live Dispatch</Text>

        <Text style={connected ? s.live : s.offline}>
          {connected ? '● LIVE' : 'OFFLINE'}
        </Text>
      </View>
    );
  }, [connected]);

  // ─── LOADING ─────────────────────

  if (loading) {
    return (
      <SafeAreaView style={[s.container, s.center]}>
        <ActivityIndicator color={C.green} size="large" />
      </SafeAreaView>
    );
  }

  // ─── RENDER ─────────────────────

  return (
    <SafeAreaView style={s.container}>
      {header}

      {DEBUG_API && !!debugText && (
        <Text style={{ color: 'white' }}>{debugText}</Text>
      )}

      <FlatList
        data={errands}
        keyExtractor={(i) => i.id}
        renderItem={renderItem}
        contentContainerStyle={errands.length ? s.list : s.center}
        ListEmptyComponent={
          <Text style={s.empty}>No live dispatches</Text>
        }
      />
    </SafeAreaView>
  );
}

// ─── STYLES ─────────────────────

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
    padding: 16,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },

  title: {
    color: C.textPri,
    fontSize: 22,
    fontWeight: '700',
  },

  live: {
    color: C.green,
    fontWeight: '700',
  },

  offline: {
    color: C.red,
    fontWeight: '700',
  },

  list: {
    paddingBottom: 40,
  },

  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  empty: {
    color: C.textSec,
  },
});

const card = StyleSheet.create({
  wrapper: {
    backgroundColor: C.card,
    padding: 14,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: C.border,
  },

  body: {
    marginBottom: 10,
  },

  title: {
    color: C.textPri,
    fontWeight: '700',
    fontSize: 16,
  },

  meta: {
    color: C.textSec,
    fontSize: 12,
    marginTop: 4,
  },

  desc: {
    color: C.textSec,
    marginTop: 6,
    fontSize: 12,
  },

  btn: {
    backgroundColor: C.green,
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
  },

  disabled: {
    opacity: 0.5,
  },

  btnText: {
    color: '#fff',
    fontWeight: '700',
  },
});