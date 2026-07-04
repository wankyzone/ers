import React, { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  GestureHandlerRootView,
} from 'react-native-gesture-handler';

import BottomSheet, {
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet';

import * as Location from 'expo-location';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../src/navigation';
import { createErrand, type ApiError } from '../src/services/api';

// ─── SAFE MAP IMPORT ─────────────────────────

let MapView: any = null;
let Marker: any = null;

if (Platform.OS !== 'web') {
  import Maps from 'react-native-maps';
  MapView = Maps.default;
  Marker = Maps.Marker;
}

// ─── TYPES ─────────────────────────

type NavProp = NativeStackNavigationProp<RootStackParamList>;

type MapTarget = 'pickup' | 'delivery' | null;

interface LatLng {
  latitude: number;
  longitude: number;
}

// ─── DEFAULT REGION ─────────────────

const DEFAULT_REGION = {
  latitude: 6.5244,
  longitude: 3.3792,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

// ─── SCREEN ─────────────────────────

export default function CreateErrandScreen() {
  const navigation = useNavigation<NavProp>();

  const sheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['40%', '75%', '95%'], []);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [pickup, setPickup] = useState('');
  const [delivery, setDelivery] = useState('');
  const [budget, setBudget] = useState('');
  const [loading, setLoading] = useState(false);

  const [mapTarget, setMapTarget] = useState<MapTarget>(null);
  const [pin, setPin] = useState<LatLng | null>(null);

  const parsedBudget = Number(budget);

  const isValid =
    title.trim().length > 0 &&
    pickup.trim().length > 0 &&
    delivery.trim().length > 0 &&
    parsedBudget > 0;

  // ─── MAP HANDLERS ─────────────────

  const handleMapPress = (e: any) => {
    setPin(e.nativeEvent.coordinate);
  };

  const confirmLocation = async () => {
    if (!pin) return;

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert('Permission required');
        return;
      }

      const [res] = await Location.reverseGeocodeAsync(pin);

      const address =
        res?.name ||
        `${pin.latitude.toFixed(4)}, ${pin.longitude.toFixed(4)}`;

      if (mapTarget === 'pickup') setPickup(address);
      if (mapTarget === 'delivery') setDelivery(address);

    } catch {
      Alert.alert('Failed to get address');
    }

    setMapTarget(null);
    setPin(null);
  };

  // ─── CREATE ─────────────────────

  const handleCreate = async () => {
    if (!isValid) {
      Alert.alert('Fill all fields correctly');
      return;
    }

    try {
      setLoading(true);

      await createErrand({
        title: title.trim(),
        description: description.trim(),
        pickup_location: pickup.trim(),
        delivery_location: delivery.trim(),
        price: parsedBudget,
      });

      navigation.goBack();
    } catch (err) {
      Alert.alert('Error', (err as ApiError).message);
    } finally {
      setLoading(false);
    }
  };

  // ─── UI ─────────────────────────

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={{ flex: 1 }}>

        {/* BACKDROP */}
        <Pressable
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            backgroundColor: 'rgba(0,0,0,0.6)',
          }}
          onPress={() => navigation.goBack()}
        />

        {/* MAP MODAL */}
        <Modal visible={mapTarget !== null} animationType="slide">
          <View style={{ flex: 1 }}>

            {Platform.OS !== 'web' && MapView ? (
              <MapView
                style={{ flex: 1 }}
                initialRegion={DEFAULT_REGION}
                onPress={handleMapPress}
              >
                {pin && <Marker coordinate={pin} />}
              </MapView>
            ) : (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <Text>Map not supported on web</Text>
              </View>
            )}

            <TouchableOpacity
              style={{
                position: 'absolute',
                bottom: 40,
                left: 20,
                right: 20,
                backgroundColor: '#22c55e',
                padding: 16,
                borderRadius: 12,
              }}
              onPress={confirmLocation}
            >
              <Text style={{ color: '#fff', textAlign: 'center' }}>
                Confirm Location
              </Text>
            </TouchableOpacity>

          </View>
        </Modal>

        {/* SHEET */}
        <BottomSheet
          ref={sheetRef}
          index={1}
          snapPoints={snapPoints}
          enablePanDownToClose
          onClose={() => navigation.goBack()}
        >
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <BottomSheetScrollView style={{ padding: 20 }}>

              <Text style={{ fontSize: 22, fontWeight: '700' }}>
                Create Errand
              </Text>

              {/* LOCATION */}
              <TouchableOpacity onPress={() => setMapTarget('pickup')}>
                <Text style={{ marginTop: 12 }}>
                  Pickup: {pickup || 'Select location'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => setMapTarget('delivery')}>
                <Text style={{ marginTop: 12 }}>
                  Delivery: {delivery || 'Select location'}
                </Text>
              </TouchableOpacity>

              {/* INPUTS */}
              <TextInput
                placeholder="Title"
                value={title}
                onChangeText={setTitle}
                style={{
                  borderWidth: 1,
                  marginTop: 12,
                  padding: 10,
                  borderRadius: 8,
                }}
              />

              <TextInput
                placeholder="Description"
                value={description}
                onChangeText={setDescription}
                style={{
                  borderWidth: 1,
                  marginTop: 12,
                  padding: 10,
                  borderRadius: 8,
                }}
              />

              <TextInput
                placeholder="Budget"
                value={budget}
                onChangeText={setBudget}
                keyboardType="numeric"
                style={{
                  borderWidth: 1,
                  marginTop: 12,
                  padding: 10,
                  borderRadius: 8,
                }}
              />

              <TouchableOpacity
                onPress={handleCreate}
                disabled={!isValid || loading}
                style={{
                  backgroundColor: '#22c55e',
                  padding: 16,
                  marginTop: 20,
                  borderRadius: 10,
                  opacity: !isValid ? 0.5 : 1,
                }}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={{ color: '#fff', textAlign: 'center' }}>
                    Post Errand
                  </Text>
                )}
              </TouchableOpacity>

            </BottomSheetScrollView>
          </KeyboardAvoidingView>
        </BottomSheet>

      </View>
    </GestureHandlerRootView>
  );
}