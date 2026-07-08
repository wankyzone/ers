declare module 'react-native-maps' {
  import type { ComponentType, ReactNode } from 'react';
  import type { StyleProp, ViewStyle } from 'react-native';

  export interface LatLng {
    latitude: number;
    longitude: number;
  }

  export interface Region extends LatLng {
    latitudeDelta: number;
    longitudeDelta: number;
  }

  export interface MapPressEvent {
    nativeEvent: {
      coordinate: LatLng;
    };
  }

  export interface MapViewProps {
    children?: ReactNode;
    initialRegion: Region;
    onPress?: (event: MapPressEvent) => void;
    style?: StyleProp<ViewStyle>;
  }

  export interface MarkerProps {
    coordinate: LatLng;
  }

  const MapView: ComponentType<MapViewProps>;
  export const Marker: ComponentType<MarkerProps>;
  export default MapView;
}
