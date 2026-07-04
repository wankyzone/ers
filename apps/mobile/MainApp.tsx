import { NavigationContainer } from '@react-navigation/native';

import BottomTabs from './src/navigation/BottomTabs';

export default function MainApp() {
  return (
    <NavigationContainer>
      <BottomTabs />
    </NavigationContainer>
  );
}
