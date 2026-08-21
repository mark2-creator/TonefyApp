import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput,
  Image, ActivityIndicator, StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { showAlert } from '../components/BrandedAlert';
import { CaptionStyleSheet } from '../components/CaptionStylePicker';
import { resolveCaptionStyle } from '../constants/captionStyles';
import CaptionText from '../components/CaptionText';
import ProgressButton from '../components/ProgressButton';
import { saveImageToDevice, SAVE_PLATFORM_NOTE } from '../utils/saveVideo';
import { usePlan } from '../constants/plan';

const BACKEND = 'https://api.fitlifesolutions.site';

// Thumbnails are dark-only, like the editor and every other surface where the subject is
// the picture rather than the chrome - see the theming note in CLAUDE.md item 8.
const ASPECTS = [
  { id: '16:9', label: 'YouTube', ratio: 16 / 9 },
  { id: '9:16', label: 'Shorts', ratio: 9 / 16 },
  { id: '1:1', label: 'Feed', ratio: 1 },
];

// The preview's width is MEASURED and sent, not assumed.
//
// Every length in a caption spec is points at the app's 18pt base, and the renderer
// scales by (output width / previewWidth). So previewWidth is not a constant the server
// needs - it is the app telling the server what the numbers on screen were drawn
// against. Hardcoding 360 while the stage is actually 380 on a wider phone makes every
// thumbnail's text ~5% off the preview, which is the "two definitions of one number"
// failure this project keeps recording. Verified: halving previewWidth doubles the
// rendered text exactly (33x62 -> 65x122 px, measured).
const FALLBACK_PREVIEW_WIDTH = 360;

async function apiFetch(path, options = {}) {
  const user = auth.currentUser;
  const token = user ? await user.getIdToken() : null;
  const headers = { ...(options.headers || {}) };
  if (token) headers.Authorization = 'Bearer ' + token;
  return fetch(BACKEND + path, { ...options, headers });
}

export default function ThumbnailScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { isPremium } = usePlan();

  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [picked, setPicked] = useState(null);

  const [headline, setHeadline] = useState('');
  const [styleId, setStyleId] = useState('tiktok');
  const [showStyles, setShowStyles] = useState(false);
  const [size, setSize] = useState(34);
  const [atSeconds, setAtSeconds] = useState(0);
  const [aspect, setAspect] = useState('16:9');

  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [saving, setSaving] = useState(0);
  // Learned from the server's reply rather than from the video record. Only two of the
  // three userVideos writers store durationSeconds, and the one that does not is
  // Idea-to-Video - which is where most of these come from - so relying on the record
  // would leave the frame slider hidden and every thumbnail stuck on frame zero.
  const [knownDuration, setKnownDuration] = useState(0);
  const [stageWidth, setStageWidth] = useState(FALLBACK_PREVIEW_WIDTH);

  const spec = useMemo(() => resolveCaptionStyle(styleId), [styleId]);
  const ratio = ASPECTS.find(a => a.id === aspect)?.ratio || 16 / 9;

  useEffect(() => {
    (async () => {
      const user = auth.currentUser;
      if (!user) { setLoading(false); return; }
      try {
        const snap = await getDocs(query(collection(db, 'userVideos'), where('userId', '==', user.uid)));
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
          .filter(v => v.downloadUrl || v.localUrl)
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        setVideos(list);
      } catch (e) {
        // A listing failure is not worth a popup on arrival - the empty state below
        // already says there is nothing to work from and how to get something.
        setVideos([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Changing anything about the composition invalidates a thumbnail already made from
  // the old settings. Without this the screen shows a stale image beside controls that
  // no longer describe it, which reads as the controls doing nothing.
  useEffect(() => { setResult(null); }, [picked, headline, styleId, size, atSeconds, aspect]);
  useEffect(() => { setKnownDuration(0); }, [picked]);

  const maxSeconds = Math.max(knownDuration, Math.floor(Number(picked?.durationSeconds) || 0));

  const generate = useCallback(async () => {
    if (!picked) return showAlert('Thumbnail', 'Pick a video first.');
    if (!isPremium) {
      return showAlert('Thumbnail',
        'Thumbnails are available on the Pro and Creator plans.');
    }
    const url = picked.downloadUrl || picked.localUrl;
    try {
      setBusy(true);
      const res = await apiFetch('/api/thumbnail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: url.replace(BACKEND, ''),
          atSeconds,
          aspectRatio: aspect,
          previewWidth: Math.round(stageWidth),
          textOverlays: headline.trim()
            ? [{
                text: headline.trim(),
                font: spec.font,
                size,
                color: spec.color,
                gradient: spec.gradient,
                x: 50, y: 50, anchor: 'center',
                captionSpec: spec,
              }]
            : [],
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error || !data.thumbnailUrl) {
        throw new Error(data.error || 'Could not make a thumbnail from this video.');
      }
      setResult(BACKEND + data.thumbnailUrl);
      if (Number(data.durationSeconds) > 0) setKnownDuration(Math.floor(Number(data.durationSeconds)));
    } catch (e) {
      showAlert('Thumbnail', e.message || 'Could not make a thumbnail.');
    } finally {
      setBusy(false);
    }
  }, [picked, isPremium, atSeconds, aspect, headline, spec, size, stageWidth]);

  const save = useCallback(async () => {
    if (!result) return;
    try {
      setSaving(1);
      const out = await saveImageToDevice(result, { prompt: headline || 'Tonefy thumbnail' },
        (p) => setSaving(Math.max(1, p)));
      showAlert('Thumbnail',
        out.method === 'gallery' ? 'Saved to your gallery.' : SAVE_PLATFORM_NOTE);
    } catch (e) {
      showAlert('Thumbnail', e.message || 'Could not save the thumbnail.');
    } finally {
      setSaving(0);
    }
  }, [result, headline]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <MaterialIcons name="arrow-back" size={20} color="#fff" />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Thumbnail</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {/* 1 - the frame it is made from */}
        <Text style={styles.step}>Choose a video</Text>
        {loading ? (
          <ActivityIndicator color="#00d4d4" style={{ marginVertical: 20 }} />
        ) : videos.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              You have no finished videos yet. Make one first and it will appear here.
            </Text>
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.pickRow}
            contentContainerStyle={styles.pickRowContent}>
            {videos.map(v => (
              <TouchableOpacity
                key={v.id}
                style={[styles.pick, picked?.id === v.id && styles.pickOn]}
                onPress={() => { setPicked(v); setAtSeconds(0); }}>
                <MaterialIcons name="movie" size={20} color={picked?.id === v.id ? '#000' : '#cfcfcf'} />
                <Text style={[styles.pickText, picked?.id === v.id && styles.pickTextOn]} numberOfLines={1}>
                  {v.prompt || 'Untitled'}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* 2 - the live preview. Same CaptionText the editor canvas and the style
            picker use, so what is on screen is what the server will draw. */}
        <Text style={styles.step}>Preview</Text>
        <View
          style={[styles.stage, { aspectRatio: ratio }]}
          onLayout={(e) => setStageWidth(e.nativeEvent.layout.width)}>
          {result ? (
            <Image source={{ uri: result }} style={styles.shot} resizeMode="cover" />
          ) : (
            <View style={styles.stageInner}>
              <MaterialIcons name="image" size={28} color="#333" />
              {!!headline.trim() && (
                <View style={styles.overlayWrap} pointerEvents="none">
                  <CaptionText style={spec} text={headline.trim()} size={size} color={spec.color} />
                </View>
              )}
            </View>
          )}
        </View>
        {!result && (
          <Text style={styles.note}>
            The frame appears once you generate. The text above is drawn by the same
            renderer the server uses, so its style will match.
          </Text>
        )}

        {/* 3 - composition */}
        <Text style={styles.step}>Headline</Text>
        <TextInput
          style={styles.input}
          value={headline}
          onChangeText={setHeadline}
          placeholder="Leave empty for just the frame"
          placeholderTextColor="#555"
          maxLength={60}
        />

        <TouchableOpacity style={styles.row} onPress={() => setShowStyles(true)}>
          <Text style={styles.rowLabel}>Style</Text>
          <View style={styles.rowRight}>
            <Text style={styles.rowValue}>{spec.label || styleId}</Text>
            <MaterialIcons name="chevron-right" size={20} color="#888" />
          </View>
        </TouchableOpacity>

        <Text style={styles.sliderLabel}>Text size · {Math.round(size)}</Text>
        <Slider
          minimumValue={16} maximumValue={64} step={1} value={size}
          onValueChange={setSize}
          minimumTrackTintColor="#00d4d4" maximumTrackTintColor="#2a2a2a" thumbTintColor="#00d4d4"
        />

        {maxSeconds > 0 && (
          <>
            <Text style={styles.sliderLabel}>Frame at · {atSeconds.toFixed(1)}s</Text>
            <Slider
              minimumValue={0} maximumValue={maxSeconds} step={0.5} value={atSeconds}
              onValueChange={setAtSeconds}
              minimumTrackTintColor="#00d4d4" maximumTrackTintColor="#2a2a2a" thumbTintColor="#00d4d4"
            />
          </>
        )}

        <Text style={styles.step}>Size</Text>
        <View style={styles.chips}>
          {ASPECTS.map(a => (
            <TouchableOpacity
              key={a.id}
              style={[styles.chip, aspect === a.id && styles.chipOn]}
              onPress={() => setAspect(a.id)}>
              <Text style={[styles.chipText, aspect === a.id && styles.chipTextOn]}>
                {a.label}
              </Text>
              <Text style={[styles.chipSub, aspect === a.id && styles.chipTextOn]}>{a.id}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.cta, (!picked || busy) && styles.ctaOff]}
          onPress={generate}
          disabled={!picked || busy}>
          {busy
            ? <ActivityIndicator color="#04211f" />
            : (
              <>
                {!isPremium && <MaterialIcons name="diamond" size={12} color="#f5c451" />}
                <Text style={styles.ctaText}>{result ? 'Regenerate' : 'Generate thumbnail'}</Text>
              </>
            )}
        </TouchableOpacity>

        {!!result && (
          <ProgressButton
            label="Save to gallery"
            progress={saving}
            onPress={save}
            variant="outline"
          />
        )}
      </ScrollView>

      <CaptionStyleSheet
        visible={showStyles}
        value={styleId}
        onChange={(id) => { setStyleId(id); setShowStyles(false); }}
        onClose={() => setShowStyles(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  // flexDirection row, or RN's default column stacks the arrow above the label - the
  // copy-pasted back-button bug from CLAUDE.md items 9 and 11.
  back: { flexDirection: 'row', alignItems: 'center', gap: 4, width: 60 },
  backText: { color: '#fff', fontSize: 13 },
  title: { color: '#fff', fontSize: 16, fontWeight: '700' },
  step: { color: '#fff', fontSize: 13, fontWeight: '700', marginTop: 18, marginBottom: 8 },
  empty: { backgroundColor: '#111', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#2a2a2a' },
  emptyText: { color: '#888', fontSize: 12, lineHeight: 18 },
  // The four-part horizontal row: flexGrow/flexShrink on style, alignItems and padding
  // on the content container. Three of the four get forgotten when this is written from
  // scratch rather than copied - see the flex traps note in CLAUDE.md.
  pickRow: { flexGrow: 0, flexShrink: 0 },
  pickRowContent: { alignItems: 'center', paddingHorizontal: 2, gap: 8 },
  pick: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, maxWidth: 190 },
  pickOn: { backgroundColor: '#2ECC71', borderColor: '#2ECC71' },
  pickText: { color: '#cfcfcf', fontSize: 12, fontWeight: '600', flexShrink: 1 },
  pickTextOn: { color: '#000' },
  stage: { width: '100%', backgroundColor: '#0a0a0a', borderRadius: 12, borderWidth: 1, borderColor: '#2a2a2a', overflow: 'hidden' },
  stageInner: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  overlayWrap: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  shot: { width: '100%', height: '100%' },
  note: { color: '#888', fontSize: 11, lineHeight: 16, marginTop: 8 },
  input: { backgroundColor: '#111', borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: '#fff', fontSize: 14 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#111', borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, marginTop: 10 },
  rowLabel: { color: '#fff', fontSize: 13, fontWeight: '600' },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rowValue: { color: '#888', fontSize: 12 },
  sliderLabel: { color: '#cfcfcf', fontSize: 12, marginTop: 14 },
  chips: { flexDirection: 'row', gap: 8 },
  chip: { flex: 1, alignItems: 'center', backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 12, paddingVertical: 10 },
  chipOn: { backgroundColor: '#00d4d4', borderColor: '#00d4d4' },
  chipText: { color: '#cfcfcf', fontSize: 12, fontWeight: '700' },
  chipSub: { color: '#888', fontSize: 10, marginTop: 2 },
  chipTextOn: { color: '#000' },
  cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#2ECC71', borderRadius: 12, paddingVertical: 15, marginTop: 22 },
  ctaOff: { backgroundColor: '#1f3d2c' },
  ctaText: { color: '#04211f', fontSize: 14, fontWeight: '800' },
});
