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
//
// Two variants, because not every button that reports progress is the primary one on its
// screen. `outline` exists for a download sitting next to a green primary: it fills
// left-to-right exactly the same way, but with a translucent tint rather than solid
// green, so watching it does not promote it into looking like the commit button.
export default function ProgressButton({
  label,
  progress = 0,          // 0-100
  hint,                  // e.g. "about 2 min left" - the reason the fill is worth watching
  busy = false,
  disabled = false,
  onPress,
  icon,
  style,
  labelStyle,
  variant = 'solid',     // 'solid' | 'outline'
  // Green by default: these are the buttons that commit something - export, download,
  // generate. See the colour rule in the tonefy-design skill.
  fillColor,
  trackColor,
  textColor,
  borderColor = '#2a2a2a',
}) {
  const outline = variant === 'outline';
  const fill = fillColor ?? (outline ? 'rgba(46,204,113,0.30)' : '#2ECC71');
  const track = trackColor ?? (outline ? 'transparent' : '#14532d');
  const text = textColor ?? (outline ? '#fff' : '#04211f');
  // Solid flips its label to white once the dark track is behind it. Outline never
  // changes colour: its tint is translucent precisely so the label can stay put.
  const busyText = outline ? text : '#fff';

  const pct = Math.max(0, Math.min(100, Number(progress) || 0));
  return (
    <TouchableOpacity
      style={[
        styles.btn,
        { backgroundColor: busy ? track : fill },
        outline && { backgroundColor: 'transparent', borderWidth: 1, borderColor },
        disabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || busy}
      activeOpacity={0.85}
    >
      {busy && <View style={[styles.fill, { width: `${pct}%`, backgroundColor: fill }]} />}
      <View style={styles.content}>
        {!!icon && !busy && <MaterialIcons name={icon} size={20} color={text} style={styles.icon} />}
        <Text style={[styles.label, { color: busy ? busyText : text }, labelStyle]} numberOfLines={1}>
          {label}
        </Text>
        {busy && !!hint && (
          <Text style={[styles.hint, outline && { color: text, opacity: 0.7 }]} numberOfLines={1}>{hint}</Text>
        )}
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
