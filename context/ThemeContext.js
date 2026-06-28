import React, { createContext, useContext, useState } from 'react';

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
};

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(true);
  const theme = isDark ? darkTheme : lightTheme;
  const toggleTheme = () => setIsDark(v => !v);
  return (
    <ThemeContext.Provider value={{ theme, isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
