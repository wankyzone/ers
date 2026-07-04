import { View, Text } from 'react-native';

export default function TrackingMap() {
  return (
    <View
      style={{
        height: 200,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#1e293b',
        borderRadius: 12,
      }}
    >
      <Text style={{ color: 'white' }}>Map not available on web</Text>
    </View>
  );
}