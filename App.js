import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';
import LandingScreen from './screens/LandingScreen';
import AuthScreen from './screens/AuthScreen';
import IdeaToVideoScreen from './screens/IdeaToVideoScreen';
import EditPostVideoScreen from './screens/EditPostVideoScreen';
import ConnectAccountsScreen from './screens/ConnectAccountsScreen';
import MainTabs from './screens/MainTabs';

const Stack = createNativeStackNavigator();

export default function App() {
  const [user, setUser] = React.useState(undefined);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return unsub;
  }, []);

  if (user === undefined) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0a0a0a', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color="#2ecc71" size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <StatusBar style="light" />
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <>
            <Stack.Screen name="MainTabs" component={MainTabs} />
            <Stack.Screen name="IdeaToVideo" component={IdeaToVideoScreen} />
            <Stack.Screen name="EditPostVideo" component={EditPostVideoScreen} />
            <Stack.Screen name="ConnectAccounts" component={ConnectAccountsScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="Landing" component={LandingScreen} />
            <Stack.Screen name="Auth" component={AuthScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
