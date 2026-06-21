import React, { useEffect } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';
import LandingScreen from './screens/LandingScreen';
import AuthScreen from './screens/AuthScreen';
import IdeaToVideoScreen from './screens/IdeaToVideoScreen';
import ScriptToVideoScreen from './screens/ScriptToVideoScreen';
import EditPostVideoScreen from './screens/EditPostVideoScreen';
import ConnectAccountsScreen from './screens/ConnectAccountsScreen';
import MainTabs from './screens/MainTabs';

SplashScreen.preventAutoHideAsync();

const Stack = createNativeStackNavigator();

export default function App() {
  const [user, setUser] = React.useState(undefined);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      await new Promise(resolve => setTimeout(resolve, 1000));
      await SplashScreen.hideAsync();
    });
    return unsub;
  }, []);

  if (user === undefined) {
    return null; // native splash screen stays visible during this gap
  }

  return (
    <NavigationContainer>
      <StatusBar style="light" />
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <>
            <Stack.Screen name="MainTabs" component={MainTabs} />
            <Stack.Screen name="IdeaToVideo" component={IdeaToVideoScreen} />
            <Stack.Screen name="ScriptToVideo" component={ScriptToVideoScreen} />
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
