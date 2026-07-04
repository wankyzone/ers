import * as Notifications from 'expo-notifications';

export async function registerForPush() {
  const { status } = await Notifications.requestPermissionsAsync();

  if (status !== 'granted') return;

  const token = (await Notifications.getExpoPushTokenAsync()).data;

  console.log('Push Token:', token);

  return token;
}