import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

// A button that IS its own progress bar.
//
// The pattern it replaces was a button plus a separate bar plus a percentage caption -
// three elements saying one thing, and the button among them usually just spinning. The
// fill answers "is it working", "how far" and "what is it doing" in the space the button
// already occupied.
//
// The fill sits UNDER the label rather than over it, so the text never moves and never
// changes colour mid-fill: a label that flips from dark to light as the fill passes
// under it is the detail that makes this look cheap rather than considered.
export default function ProgressButton({
  label,
  progress = 0,          // 0-100
  hint,                  // e.g. "about 2 min left" - the reason the fill is worth watching
  busy = false,
  disabled = false,
  onPress,
  icon,
  style,
  // Green by default: these are the buttons that commit something - export, download,
  // generate. See the colour rule in the tonefy-design skill.
  fillColor = '#2ECC71',
  trackColor = '#14532d',
  textColor = '#04211f',
}) {
  const pct = Math.max(0, Math.min(100, Number(progress) || 0));
  return (
    <TouchableOpacity
      style={[styles.btn, { backgroundColor: busy ? trackColor : fillColor }, disabled && styles.disabled, style]}
      onPress={onPress}
      disabled={disabled || busy}
      activeOpacity={0.85}
    >
      {busy && <View style={[styles.fill, { width: `${pct}%`, backgroundColor: fillColor }]} />}
      <View style={styles.content}>
        {!!icon && !busy && <MaterialIcons name={icon} size={20} color={textColor} style={styles.icon} />}
        <Text style={[styles.label, { color: busy ? '#fff' : textColor }]} numberOfLines={1}>
          {label}
        </Text>
        {busy && !!hint && <Text style={styles.hint} numberOfLines={1}>{hint}</Text>}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: { borderRadius: 28, overflow: 'hidden', minHeight: 54, justifyContent: 'center' },
  disabled: { opacity: 0.6 },
  // Absolute so the fill cannot push the label around as it grows.
  fill: { ...StyleSheet.absoluteFillObject, right: undefined },
  content: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, gap: 8 },
  icon: { marginRight: 2 },
  label: { fontSize: 16, fontWeight: '700' },
  hint: { color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: '600' },
});
