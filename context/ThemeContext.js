import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'tonefy.darkMode';

export const lightTheme = {
  dark: false,
  bg: '#f5f5f5',
  card: '#ffffff',
  text: '#111111',
  subtext: '#666666',
  border: '#e0e0e0',
  accent: '#2ecc71',
  header: '#ffffff',
  headerText: '#111111',
  icon: '#555555',
  settingBg: '#ffffff',
  divider: '#eeeeee',
  handle: '#cccccc',
};

export const darkTheme = {
  dark: true,
  bg: '#0a0a0a',
  card: '#111111',
  text: '#ffffff',
  subtext: '#666666',
  border: '#1a1a1a',
  accent: '#2ecc71',
  header: '#0a0a0a',
  headerText: '#ffffff',
  icon: '#888888',
  settingBg: '#111111',
  divider: '#1a1a1a',
  handle: '#333333',
};

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  // Starts dark - the app's default identity - and swaps only if a saved
  // preference says otherwise, so there's no flash for the common case.
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then(saved => { if (saved !== null) setIsDark(saved === 'dark'); })
      .catch(() => {});
  }, []);

  const theme = isDark ? darkTheme : lightTheme;
  const toggleTheme = useCallback(() => {
    setIsDark(v => {
      const next = !v;
      AsyncStorage.setItem(STORAGE_KEY, next ? 'dark' : 'light').catch(() => {});
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
