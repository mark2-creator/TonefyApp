import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

// A render-time throw in React Native unmounts the whole tree and leaves the
// bare window background behind - the "grey screen" this project has now hit
// four separate times (gesture composition on a composed Gesture, the
// useDragTracker PanResponder wrapper, a deleted component's surviving call
// site, and whatever is taking SubscriptionScreen down). Every one of them
// passed `expo export`, `node --check` and lint, and every one cost a round
// trip to a real device to even learn the name of the function that failed,
// because the grey screen says nothing at all.
//
// This does not prevent any of that. It just makes the tree report what it
// hit instead of vanishing, which turns a guess into a reading. Deliberately
// permanent rather than a temporary diagnostic: the failure mode it covers is
// only reachable on a device, so the one moment it is useful is always in
// someone's hands and never in front of a build check.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    this.setState({ info });
    console.log('[ErrorBoundary]', error?.message, info?.componentStack);
  }

  render() {
    const { error, info } = this.state;
    if (!error) return this.props.children;

    // The component stack names the screen that threw, which is usually more
    // use than the JS stack - that points into the bundler's output.
    const stack = (info?.componentStack || error?.stack || '').trim();

    return (
      <View style={styles.screen}>
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <MaterialIcons name="error-outline" size={24} color="#ff6b6b" />
            <Text style={styles.title}>This screen stopped</Text>
          </View>

          <Text style={styles.lead}>
            Something in it threw an error while drawing. The details below say what and where.
          </Text>

          <Text style={styles.message}>{String(error?.message || error)}</Text>

          {!!stack && (
            <ScrollView style={styles.stackBox} contentContainerStyle={styles.stackContent}>
              <Text style={styles.stack}>{stack}</Text>
            </ScrollView>
          )}

          <TouchableOpacity style={styles.retry} onPress={() => this.setState({ error: null, info: null })}>
            <MaterialIcons name="refresh" size={24} color="#04211f" />
            <Text style={styles.retryText}>Try again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0a0a0a', justifyContent: 'center', padding: 20 },
  card: { backgroundColor: '#111', borderRadius: 20, borderWidth: 1, borderColor: '#2a2a2a', padding: 24 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  title: { color: '#fff', fontSize: 18, fontWeight: '700' },
  lead: { color: '#888', fontSize: 13, lineHeight: 19, marginBottom: 14 },
  message: { color: '#ff6b6b', fontSize: 14, fontWeight: '600', lineHeight: 20, marginBottom: 14 },
  stackBox: { maxHeight: 220, backgroundColor: '#0a0a0a', borderRadius: 12, borderWidth: 1, borderColor: '#2a2a2a', marginBottom: 18 },
  stackContent: { padding: 12 },
  stack: { color: '#888', fontSize: 11, lineHeight: 16 },
  retry: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#2ECC71', borderRadius: 12, paddingVertical: 14 },
  retryText: { color: '#04211f', fontSize: 15, fontWeight: '700' },
});
