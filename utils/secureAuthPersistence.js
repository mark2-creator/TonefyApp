import AsyncStorage from '@react-native-async-storage/async-storage';
import { getReactNativePersistence } from 'firebase/auth';

// expo-secure-store is a native module, and a native module cannot ship over
// the air. Its JS entry calls requireNativeModule('ExpoSecureStore') at
// import time and then reads constants straight off the result, so a plain
// top-level `import * as SecureStore` throws while this file is being
// evaluated on any binary that predates the dependency. firebase.js imports
// this module, and every screen imports firebase.js, so that throw is not a
// broken feature - it is the whole app failing to launch.
//
// Required lazily inside a try instead, which is the pattern
// utils/notifications.js already uses for the same reason: the current
// install keeps working with the refresh token in AsyncStorage exactly as it
// did before this file existed, and the Keystore-backed path comes alive by
// itself once a build containing the module is installed. Nothing here needs
// changing at that point.
let SecureStore = null;
try {
  SecureStore = require('expo-secure-store');
} catch (e) {
  SecureStore = null;
}

// Firebase's own React Native persistence writes the whole signed-in user
// (uid, email, displayName, provider data, AND stsTokenManager - the object
// holding refreshToken/accessToken/expirationTime) as one JSON blob into
// AsyncStorage, which on Android is unencrypted SQLite. Of everything in
// that blob, the refresh token is the one piece that's a real standing
// credential - it doesn't expire like the access token does, and holding it
// is enough to mint fresh sign-ins indefinitely without the password.
//
// SecureStore (Android Keystore / iOS Keychain backed) is the right place
// for it, but it has a hard 2048-byte per-value limit
// (node_modules/expo-secure-store/build/byteCounter.js) - the full blob,
// with its JWTs and provider metadata, doesn't reliably fit. So this wraps
// AsyncStorage's own persistence rather than replacing it: on write, pull
// stsTokenManager.refreshToken out into SecureStore under a fixed key and
// store the rest (short-lived access token, non-sensitive profile fields)
// via the normal AsyncStorage path; on read, put it back before handing the
// object to Firebase.
//
// Deliberately falls through to plain AsyncStorage behaviour unchanged
// whenever the value isn't the shape expected (not JSON, no
// stsTokenManager) - this is a defense-in-depth layer on top of Firebase's
// own persistence, not a replacement for it, and must never be the reason
// sign-in breaks if a future Firebase SDK version changes its internal
// format.

const REFRESH_TOKEN_KEY = 'tonefy.authRefreshToken';

function extractRefreshToken(value) {
  try {
    const parsed = JSON.parse(value);
    const token = parsed?.stsTokenManager?.refreshToken;
    if (typeof token !== 'string' || !token) return null;
    delete parsed.stsTokenManager.refreshToken;
    return { strippedValue: JSON.stringify(parsed), token };
  } catch (e) {
    return null;
  }
}

function reinsertRefreshToken(value, token) {
  try {
    const parsed = JSON.parse(value);
    if (parsed?.stsTokenManager && token) {
      parsed.stsTokenManager.refreshToken = token;
    }
    return JSON.stringify(parsed);
  } catch (e) {
    return value;
  }
}

const secureBackedAsyncStorage = {
  async getItem(key) {
    const value = await AsyncStorage.getItem(key);
    if (!value) return value;
    if (!SecureStore) return value;
    let token = null;
    try {
      token = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
    } catch (e) {
      // SecureStore unavailable (e.g. no device lock configured on some
      // Android setups) - fall back to whatever AsyncStorage already has,
      // which still contains a refresh token if this device never
      // successfully split one out.
      return value;
    }
    return token ? reinsertRefreshToken(value, token) : value;
  },
  async setItem(key, value) {
    const extracted = extractRefreshToken(value);
    if (!extracted || !SecureStore) {
      return AsyncStorage.setItem(key, value);
    }
    try {
      await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, extracted.token);
      return AsyncStorage.setItem(key, extracted.strippedValue);
    } catch (e) {
      // SecureStore write failed - store the untouched original rather than
      // a stripped blob with no token anywhere, which would break sign-in.
      return AsyncStorage.setItem(key, value);
    }
  },
  async removeItem(key) {
    if (SecureStore) {
      // A missing method would throw synchronously, which .catch() on the
      // returned promise never sees.
      try { await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY); } catch (e) {}
    }
    return AsyncStorage.removeItem(key);
  },
};

export const secureAuthPersistence = getReactNativePersistence(secureBackedAsyncStorage);
