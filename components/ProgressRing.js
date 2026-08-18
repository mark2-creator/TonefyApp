import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { MaterialIcons } from '@expo/vector-icons';

// A ring that closes around an icon as work completes.
//
// For the places a filling button does not fit - an icon-only control in a card or a
// toolbar, where there is no room for a label and no room for a bar underneath. The
// icon stays put and the ring answers "how far" without the layout changing at all,
// which is what a spinner in the same spot cannot do.
//
// Rotated -90 so it starts at twelve o'clock. A ring that starts at three o'clock is
// the small wrongness people notice without being able to name.
export default function ProgressRing({
  progress = 0,          // 0-100
  size = 36,
  stroke = 3,
  icon = 'file-download',
  iconSize = 18,
  color = '#2ECC71',
  trackColor = '#2a2a2a',
  iconColor = '#e6e6e6',
  children,
}) {
  const pct = Math.max(0, Math.min(100, Number(progress) || 0));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={trackColor} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2} cy={size / 2} r={r}
          stroke={color} strokeWidth={stroke} fill="none"
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={c * (1 - pct / 100)}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {children || <MaterialIcons name={icon} size={iconSize} color={iconColor} />}
    </View>
  );
}
