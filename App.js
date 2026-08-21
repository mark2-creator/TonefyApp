import React, { useEffect, useState } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import * as Updates from 'expo-updates';
import * as SplashScreen from 'expo-splash-screen';
import { NavigationContainer } from '@react-navigation/native';
import { navigationRef } from './utils/navigationRef';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { onAuthStateChanged } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from './firebase';
import { configureForegroundBehaviour } from './utils/notifications';
import BrandedAlertHost from './components/BrandedAlert';
import ErrorBoundary from './components/ErrorBoundary';
import { JobsProvider } from './context/JobsContext';
import ActiveJobsBar from './components/ActiveJobsBar';
import UpdateNotice from './components/UpdateNotice';
import LandingScreen from './screens/LandingScreen';
import AuthScreen from './screens/AuthScreen';
import IdeaToVideoScreen from './screens/IdeaToVideoScreen';
import ScriptToVideoScreen from './screens/ScriptToVideoScreen';
import UrlToVideoScreen from './screens/UrlToVideoScreen';
import EditPostVideoScreen from './screens/EditPostVideoScreen';
import EditVideoScreen from './screens/EditVideoScreen';
import ConnectAccountsScreen from './screens/ConnectAccountsScreen';
import IdeaToAudioScreen from './screens/IdeaToAudioScreen';
import GeneratingAudioScreen from './screens/GeneratingAudioScreen';
import AudioResultScreen from './screens/AudioResultScreen';
import ScriptToAudioScreen from './screens/ScriptToAudioScreen';
import RecordToVideoScreen from './screens/RecordToVideoScreen';
import RecordingScreen from './screens/RecordingScreen';
import PostRecordingScreen from './screens/PostRecordingScreen';
import NotificationsScreen from './screens/NotificationsScreen';
import ThumbnailScreen from './screens/ThumbnailScreen';
import HelpSupportScreen from './screens/HelpSupportScreen';
import SubscriptionScreen from './screens/SubscriptionScreen';
import AdminScreen from './screens/AdminScreen';
import MainTabs from './screens/MainTabs';
import * as Sentry from '@sentry/react-native';
import { loadAppFonts } from './constants/fontLoader';

Sentry.init({
  dsn: 'https://5e8c412f592386efb8324e760011c7c9@o4511619343122432.ingest.de.sentry.io/4511619368091728',
  tracesSampleRate: 1.0,
  enabled: true,
});

SplashScreen.preventAutoHideAsync();

const Stack = createNativeStackNavigator();

function App() {
  const [user, setUser] = React.useState(undefined);

  // Kicked off here rather than in the editor so the families are usually
  // registered by the time anyone opens the text sheet. Deliberately not awaited.
  useEffect(() => { loadAppFonts(); }, []);
  // Set once, at the top. Without a handler the OS shows nothing while the app is
  // open - which is precisely when someone is testing whether this works. A no-op
  // on a build without the native module.
  useEffect(() => { configureForegroundBehaviour(); }, []);

  // Updates, and the two things that made them unreliable for real testers.
  //
  // FIRST: an 8MB bundle on a connection measured in hundreds of bytes per second takes
  // minutes, and reloadAsync() fires whenever it finishes. On a fast connection that is
  // seamless; on a slow one it restarts the app several minutes in, discarding whatever
  // the person was doing. expo-updates already applies a downloaded update on the NEXT
  // launch by itself, so the reload is only worth doing while it is still free - inside
  // the first few seconds, before anyone has started.
  //
  // SECOND: every failure was silent. A fetch that times out left the app looking
  // current when it was not, which is how a fixed bug gets reported as still broken -
  // twice, here, on Aug 18. The outcome is now recorded and surfaced on Profile.
  const [otaState, setOtaState] = useState(null); // 'downloading' | 'ready' | 'failed' | null
  useEffect(() => {
    const startedAt = Date.now();
    const SEAMLESS_MS = 8000;
    let alive = true;
    (async () => {
      try {
        if (!Updates.isEnabled) return;
        const update = await Updates.checkForUpdateAsync();
        if (!alive || !update.isAvailable) return;
        setOtaState('downloading');
        await Updates.fetchUpdateAsync();
        if (!alive) return;
        if (Date.now() - startedAt < SEAMLESS_MS) {
          await Updates.reloadAsync();
          return;
        }
        // Too late to restart under someone. It is on disk and launches next time.
        setOtaState('ready');
      } catch (e) {
        console.log('[OTA] failed:', e.message);
        if (alive) setOtaState('failed');
      }
    })();
    return () => { alive = false; };
  }, []);

  const SESSION_TIMEOUT_MS = 24 * 60 * 60 * 1000; // 1 day

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        try {
          const lastActiveRaw = await AsyncStorage.getItem('lastActive');
          const lastActive = lastActiveRaw ? parseInt(lastActiveRaw, 10) : null;
          if (lastActive && Date.now() - lastActive > SESSION_TIMEOUT_MS) {
            await auth.signOut();
            await AsyncStorage.removeItem('lastActive');
            setUser(null);
            await new Promise(resolve => setTimeout(resolve, 1000));
            await SplashScreen.hideAsync();
            return;
          }
          await AsyncStorage.setItem('lastActive', Date.now().toString());
        } catch (e) {
          // if storage fails, fall back to trusting the Firebase session
        }
      } else {
        await AsyncStorage.removeItem('lastActive');
      }
      setUser(u);
      await new Promise(resolve => setTimeout(resolve, 1000));
      await SplashScreen.hideAsync();
    });
    return unsub;
  }, []);

  if (user === undefined) {
    return null; // native splash screen stays visible during this gap
  }

  // Nearly every screen in this app calls useSafeAreaInsets() - the header
  // overlapping the status bar is that hook returning zero because nothing was
  // ever providing it real values to return. SafeAreaProvider is the thing that
  // measures the device's actual insets and makes them available; without it here,
  // every screen's insets.top read as 0 and every screen's top bar sat flush
  // against whatever the OS drew over it - the clock, the battery, the signal
  // bars. One provider at the root fixes it for all of them at once, rather than
  // hardcoding a padding number per screen that would only be right for the one
  // device it was measured on.
  return (
    <SafeAreaProvider>
    <ThemeProvider>
    <GestureHandlerRootView style={{ flex: 1 }}>
    <JobsProvider>
    <NavigationContainer ref={navigationRef}>
      <StatusBar style="light" />
      <ErrorBoundary>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <>
            <Stack.Screen name="MainTabs" component={MainTabs} />
            <Stack.Screen name="IdeaToVideo" component={IdeaToVideoScreen} />
            <Stack.Screen name="ScriptToVideo" component={ScriptToVideoScreen} />
            <Stack.Screen name="UrlToVideo" component={UrlToVideoScreen} />
            <Stack.Screen name="EditPostVideo" component={EditPostVideoScreen} />
            <Stack.Screen name="EditVideo" component={EditVideoScreen} />
            <Stack.Screen name="ConnectAccounts" component={ConnectAccountsScreen} />
            <Stack.Screen name="Notifications" component={NotificationsScreen} />
            <Stack.Screen name="Thumbnail" component={ThumbnailScreen} />
            <Stack.Screen name="Subscription" component={SubscriptionScreen} options={{ presentation: 'modal' }} />
            <Stack.Screen name="HelpSupport" component={HelpSupportScreen} />
            <Stack.Screen name="Admin" component={AdminScreen} />
            <Stack.Screen name="IdeaToAudio" component={IdeaToAudioScreen} />
            <Stack.Screen name="GeneratingAudio" component={GeneratingAudioScreen} />
            <Stack.Screen name="AudioResult" component={AudioResultScreen} />
            <Stack.Screen name="ScriptToAudio" component={ScriptToAudioScreen} />
            <Stack.Screen name="RecordToVideo" component={RecordToVideoScreen} />
            <Stack.Screen name="Recording" component={RecordingScreen} />
            <Stack.Screen name="PostRecording" component={PostRecordingScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="Landing" component={LandingScreen} />
            <Stack.Screen name="Auth" component={AuthScreen} />
          </>
        )}
      </Stack.Navigator>
      </ErrorBoundary>
      {/* Outside the navigator's screens but inside the container, so it shows on every
          screen and can still navigate. This is what makes leaving a render safe. */}
      {!!otaState && otaState !== 'downloading' && (
        <UpdateNotice state={otaState} onDismiss={() => setOtaState(null)} />
      )}
      {user && <ActiveJobsBar onOpen={() => navigationRef.current?.navigate('MainTabs', { screen: 'Videos' })} />}
    </NavigationContainer>
    </JobsProvider>
    <BrandedAlertHost />
    </GestureHandlerRootView>
    </ThemeProvider>
    </SafeAreaProvider>
  );
}

export default Sentry.wrap(App);
