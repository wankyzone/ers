import MapView, { Marker } from 'react-native-maps';

export default function TrackingMap({ runnerLocation }: any) {
  return (
    <MapView
      style={{ height: 250, borderRadius: 16 }}
      initialRegion={{
        latitude: 6.5244,
        longitude: 3.3792,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      }}
    >
      {runnerLocation && <Marker coordinate={runnerLocation} />}
    </MapView>
  );
}