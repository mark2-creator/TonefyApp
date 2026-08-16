import React from 'react';
import { Text } from 'react-native';

// Emoji flags, by explicit request.
//
// Worth knowing what that trades away, since this app's own convention is otherwise no
// emoji anywhere: flag emoji are two regional-indicator letters that the font is
// expected to substitute with a flag, and not every Android build does. Samsung, Pixel
// and Xiaomi render them; some OEM and older builds show the bare letters instead - "US"
// rather than a US flag. That degrades to something readable rather than to a blank,
// which is why it is an acceptable trade here.
//
// The previous version drew each flag as SVG, which rendered identically everywhere but
// meant hand-drawing one per country - fine for three, not for the 76 languages the
// voice catalogue now spans.
function toFlag(cc) {
  const code = String(cc || '').toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return '';
  return String.fromCodePoint(
    ...[...code].map(c => 0x1F1E6 + c.charCodeAt(0) - 65)
  );
}

export default function Flag({ country, size = 14, style }) {
  const flag = toFlag(country);
  if (!flag) return null;
  // No fontFamily: the emoji font has to be whatever the system uses, or the
  // substitution that turns two letters into a flag never happens.
  return <Text style={[{ fontSize: size }, style]}>{flag}</Text>;
}
