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
import * as Location from 'expo-location';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../src/context/AuthContext';
import { DEBUG_API } from '../src/config/api';
import { useApiDebugText } from '../src/hooks/useApiDebugText';
import { useSocket } from '../src/hooks/useSocket';
import {
  acceptErrand,
  getOpenErrands,
  Errand,
} from '../src/services/api';

// ─── CONFIG ─────────────────────────

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';

const C = {
  bg: '#020617',
  card: '#0f172a',
  border: '#1e293b',
  green: '#22c55e',
  red: '#ef4444',
  textPri: '#f1f5f9',
  textSec: '#94a3b8',
};

// ─── MAIN SCREEN ─────────────────────

export default function RunnerScreen() {
  const { user, accessToken } = useAuth();
  const debugText = useApiDebugText();
  const socketRef = useSocket(API_URL, accessToken);

  const [errands, setErrands] = useState<Errand[]>([]);
  const [loading, setLoading] = useState(true);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [tracking, setTracking] = useState(false);
  const [trackingError, setTrackingError] = useState<string | null>(null);

  const locationSubscription =
    useRef<Location.LocationSubscription | null>(null);

  const acceptLock = useRef(false);

  const fetchErrands = useCallback(async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      const data = await getOpenErrands();
      setErrands(data);
    } catch (error: any) {
      console.error('Failed to fetch runner errands:', error);
      setErrands([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  const activeErrand = useMemo(
    () => errands.find((errand) => errand.status === 'accepted'),
    [errands]
  );

  // ─── INIT SOCKET ─────────────────────

  useEffect(() => {
    const socket = socketRef.current;

    if (!socket) {
      setConnected(false);
      return;
    }

    const handleConnect = () => {
      setConnected(true);
      void fetchErrands();
    };

    const handleDisconnect = () => {
      setConnected(false);
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);

    if (socket.connected) {
      handleConnect();
    }

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
    };
  }, [socketRef, accessToken, fetchErrands]);

  // ─── LOCATION TRACKING ─────────────────

  useEffect(() => {
    let cancelled = false;

    const startTracking = async () => {
      if (!activeErrand || !user?.id) {
        locationSubscription.current?.remove();
        locationSubscription.current = null;
        setTracking(false);
        setTrackingError(null);
        return;
      }

      if (!socketRef.current?.connected) {
        setTracking(false);
        setTrackingError('Waiting for realtime connection...');
        return;
      }

      try {
        setTrackingError(null);

        const { status } =
          await Location.requestForegroundPermissionsAsync();

        if (cancelled) return;

        if (status !== Location.PermissionStatus.GRANTED) {
          setTracking(false);
          setTrackingError(
            'Location permission is required for live tracking.'
          );
          return;
        }

        locationSubscription.current?.remove();

        locationSubscription.current =
          await Location.watchPositionAsync(
            {
              accuracy: Location.Accuracy.High,
              timeInterval: 5000,
              distanceInterval: 10,
            },
            (location) => {
              if (cancelled) return;

              const { latitude, longitude } = location.coords;

              if (
                !Number.isFinite(latitude) ||
                !Number.isFinite(longitude)
              ) {
                return;
              }

              if (!socketRef.current?.connected) {
                setTracking(false);
                setTrackingError('Realtime connection lost.');
                return;
              }

              socketRef.current.emit('location:update', {
                errandId: activeErrand.id,
                lat: latitude,
                lng: longitude,
              });

              setTracking(true);
              setTrackingError(null);
            }
          );
      } catch (error: any) {
        console.error('Location tracking error:', error);

        if (!cancelled) {
          setTracking(false);
          setTrackingError(
            error?.message || 'Unable to start location tracking.'
          );
        }
      }
    };

    startTracking();

    return () => {
      cancelled = true;
      locationSubscription.current?.remove();
      locationSubscription.current = null;
      setTracking(false);
    };
  }, [activeErrand?.id, user?.id, connected, socketRef]);

  // ─── ACCEPT ERRAND (ATOMIC REST PATH) ───

  const handleAccept = useCallback(
    async (id: string) => {
      if (acceptLock.current) return;

      acceptLock.current = true;
      setAcceptingId(id);

      try {
        await acceptErrand(id);

        // Reconcile with authoritative server state.
        await fetchErrands();

        Alert.alert('Success', 'Errand assigned to you');
      } catch (error: any) {
        console.error('Accept errand failed:', error);

        Alert.alert(
          'Failed',
          error?.message || 'Acceptance rejected'
        );
      } finally {
        acceptLock.current = false;
        setAcceptingId(null);
      }
    },
    [fetchErrands]
  );

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

      {activeErrand && (
        <View style={trackingStyles.card}>
          <Text style={trackingStyles.title}>Live Tracking</Text>

          <Text style={trackingStyles.status}>
            {tracking
              ? 'Location sharing is active'
              : trackingError || 'Waiting for location...'}
          </Text>
        </View>
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

const trackingStyles = StyleSheet.create({
  card: {
    backgroundColor: C.card,
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: C.border,
  },

  title: {
    color: C.textPri,
    fontWeight: '700',
    fontSize: 14,
  },

  status: {
    color: C.textSec,
    fontSize: 12,
    marginTop: 4,
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
