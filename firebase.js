import { initializeApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: "AIzaSyDcMeyTtu21RMpFKj90b4umvIqy4_WeQOY",
  authDomain: "gen-lang-client-0229110424.firebaseapp.com",
  projectId: "gen-lang-client-0229110424",
  storageBucket: "gen-lang-client-0229110424.firebasestorage.app",
  messagingSenderId: "527163602306",
  appId: "1:527163602306:web:aaa3f48b5ecf11d00acb9b",
  measurementId: "G-6VMCC5QZKK"
};

const app = initializeApp(firebaseConfig);
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});
export const db = getFirestore(app);
