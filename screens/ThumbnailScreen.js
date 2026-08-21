import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput,
  Image, ActivityIndicator, StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import Slider from '@react-native-community/slider';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { showAlert } from '../components/BrandedAlert';
import { CaptionStyleSheet } from '../components/CaptionStylePicker';
import { resolveCaptionStyle } from '../constants/captionStyles';
import CanvasOverlay from '../components/CanvasOverlay';
import TextOverlayContent from '../components/TextOverlayContent';
import FontPicker from '../components/FontPicker';
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

// Fills that hold up on a photograph. Deliberately few and deliberately saturated: a
// thumbnail is judged at about 320px wide in a feed, where a subtle colour is just grey.
// The style's own colour is always the first option, so this is an override rather than
// a palette to build from.
const HEADLINE_COLOURS = ['#FFFFFF', '#000000', '#FFE24A', '#2ECC71', '#00d4d4', '#FF4D4D', '#FF7AC8'];

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

  // The headline is an OVERLAY, not a string, because it now carries where it sits,
  // how big it is and which way up it is - the same shape EditVideoScreen's overlays
  // have, so the same CanvasOverlay and TextOverlayContent drive it.
  const [overlay, setOverlay] = useState(null);
  const [selected, setSelected] = useState(false);
  const [editing, setEditing] = useState(false);
  const [showStyles, setShowStyles] = useState(false);
  // The real frame, with no text on it, so the overlay is positioned against the
  // picture it will actually sit on rather than against a grey box.
  const [backdrop, setBackdrop] = useState(null);
  const [backdropBusy, setBackdropBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
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

  const styleId = overlay?.captionStyleId || 'tiktok';
  const baseSpec = useMemo(() => resolveCaptionStyle(styleId), [styleId]);
  // What actually goes to the server: the catalogue style with the overlay's own
  // overrides folded in. TextOverlayContent folds the same ones for the preview, so the
  // two agree by construction rather than by both being edited the same way.
  const spec = useMemo(() => {
    const over = {};
    if (overlay?.spacing != null) over.spacing = overlay.spacing;
    if (overlay?.lineSpacing != null) over.lineSpacing = overlay.lineSpacing;
    return Object.keys(over).length ? { ...baseSpec, ...over } : baseSpec;
  }, [baseSpec, overlay?.spacing, overlay?.lineSpacing]);
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
  useEffect(() => { setResult(null); }, [picked, overlay, atSeconds, aspect]);
  useEffect(() => { setKnownDuration(0); }, [picked]);

  const maxSeconds = Math.max(knownDuration, Math.floor(Number(picked?.durationSeconds) || 0));

  // The frame on its own, so the overlay is dragged around the real picture instead of
  // a grey box. Deliberately a separate call from `generate`: it carries no text, so it
  // is the cheap path through the same endpoint (measured ~0.5s) and it must NOT be
  // invalidated by a text edit - only by which frame is being looked at.
  useEffect(() => {
    if (!picked) { setBackdrop(null); return; }
    const url = picked.downloadUrl || picked.localUrl;
    if (!url) return;
    let cancelled = false;
    setBackdropBusy(true);
    (async () => {
      try {
        const res = await apiFetch('/api/thumbnail', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: url.replace(BACKEND, ''), atSeconds, aspectRatio: aspect, textOverlays: [],
          }),
        });
        const data = await res.json().catch(() => ({}));
        // Ignored if the selection moved on while this was in flight - otherwise a
        // slow reply for an old frame lands on top of a newer one.
        if (cancelled) return;
        if (data.thumbnailUrl) setBackdrop(BACKEND + data.thumbnailUrl);
        if (Number(data.durationSeconds) > 0) setKnownDuration(Math.floor(Number(data.durationSeconds)));
      } catch (e) {
        if (!cancelled) setBackdrop(null);
      } finally {
        if (!cancelled) setBackdropBusy(false);
      }
    })();
    return () => { cancelled = true; };
  }, [picked, atSeconds, aspect]);

  // A photo or a clip straight from the phone, not only a finished Tonefy video.
  //
  // A thumbnail is very often made from a photo that was never a video at all - a
  // frame grab, a product shot, a screenshot - and offering only the userVideos
  // library made that impossible. The picked file is uploaded and then behaves exactly
  // like a library video: the same url goes to the same endpoint.
  const pickFromDevice = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      return showAlert('Permission needed', 'Allow access to photos and videos to use your own.');
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All, quality: 0.9,
    });
    if (res.canceled || !res.assets?.length) return;
    const asset = res.assets[0];
    const isVideo = asset.type === 'video';
    try {
      setUploading(true);
      const user = auth.currentUser;
      if (!user) throw new Error('Not logged in');
      const token = await user.getIdToken();
      const form = new FormData();
      form.append('files', {
        uri: asset.uri,
        name: isVideo ? 'source.mp4' : 'source.jpg',
        type: isVideo ? 'video/mp4' : 'image/jpeg',
      });
      const up = await fetch(BACKEND + '/api/upload-media', {
        method: 'POST', headers: { Authorization: 'Bearer ' + token }, body: form,
      });
      const data = await up.json().catch(() => ({}));
      const url = data.items?.[0]?.url;
      if (!url) throw new Error(data.error || 'That file could not be uploaded.');
      // Shaped like a userVideos record so everything downstream - the backdrop fetch,
      // generate, the frame slider - takes one path rather than branching on origin.
      setPicked({
        id: 'device-' + Date.now(),
        prompt: asset.fileName || (isVideo ? 'Your video' : 'Your photo'),
        downloadUrl: BACKEND + url,
        // A photo has no timeline, so the frame slider stays away and atSeconds stays
        // 0 - which is also what keeps the server from seeking past its only frame.
        durationSeconds: isVideo ? undefined : 0,
        fromDevice: true,
      });
      setAtSeconds(0);
    } catch (e) {
      showAlert('Upload', e.message || 'That file could not be uploaded.');
    } finally {
      setUploading(false);
    }
  }, []);

  const setOverlayFields = useCallback((patch) => {
    setOverlay(prev => (prev ? { ...prev, ...patch } : prev));
  }, []);

  const addText = useCallback(() => {
    setOverlay({
      key: 'headline',
      text: 'Your headline',
      captionStyleId: 'tiktok',
      font: resolveCaptionStyle('tiktok').font,
      color: resolveCaptionStyle('tiktok').color,
      size: 34,
      x: 50, y: 50, scale: 1, rotation: 0,
    });
    setSelected(true);
    // Straight into typing: the placeholder text is there to be replaced, and making
    // someone tap twice to reach a caret they were always going to need is friction.
    setEditing(true);
  }, []);

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
          textOverlays: overlay?.text?.trim()
            ? [{
                text: overlay.text.trim(),
                font: overlay.font || spec.font,
                // A pinch scales every part of an overlay together, and every part is
                // already a multiple of the size - stroke, glow, chip padding - so
                // folding the scale into the size reproduces it exactly, with no
                // second factor for the renderer to apply and get wrong. Same rule
                // the editor's export uses.
                size: Math.max(1, Math.round((overlay.size || 34) * (overlay.scale ?? 1))),
                color: overlay.color || spec.color,
                gradient: spec.gradient,
                // Percentages of the frame, and they are the overlay's CENTRE -
                // anchor: 'center'. Top-left is not a position you can rotate about.
                x: overlay.x ?? 50,
                y: overlay.y ?? 50,
                anchor: 'center',
                rotation: overlay.rotation ?? 0,
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
  }, [picked, isPremium, atSeconds, aspect, overlay, spec, stageWidth]);

  const save = useCallback(async () => {
    if (!result) return;
    try {
      setSaving(1);
      const out = await saveImageToDevice(result, { prompt: overlay?.text || 'Tonefy thumbnail' },
        (p) => setSaving(Math.max(1, p)));
      showAlert('Thumbnail',
        out.method === 'gallery' ? 'Saved to your gallery.' : SAVE_PLATFORM_NOTE);
    } catch (e) {
      showAlert('Thumbnail', e.message || 'Could not save the thumbnail.');
    } finally {
      setSaving(0);
    }
  }, [result, overlay]);

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

      {/* The bottom inset matters as much as the top here and was missing: this screen
          ends in the Generate and Save buttons, and under Android's gesture navigation
          the bar is drawn OVER the content, so a fixed padding puts the primary action
          underneath it. insets.bottom is 0 on a device with hardware keys, so the 40
          stays the floor rather than being replaced by it. */}
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 + insets.bottom }}>
        {/* 1 - the frame it is made from */}
        <Text style={styles.step}>Choose a video</Text>
        {loading ? (
          <ActivityIndicator color="#00d4d4" style={{ marginVertical: 20 }} />
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.pickRow}
            contentContainerStyle={styles.pickRowContent}>
            {/* First, and always here. A thumbnail is often made from a photo that was
                never a video - and with an empty library this row used to be a dead end
                telling you to go and make a video first. */}
            <TouchableOpacity style={styles.upload} onPress={pickFromDevice} disabled={uploading}>
              {uploading
                ? <ActivityIndicator color="#2ECC71" size="small" />
                : <MaterialIcons name="add-photo-alternate" size={20} color="#2ECC71" />}
              <Text style={styles.uploadText}>{uploading ? 'Uploading' : 'Upload'}</Text>
            </TouchableOpacity>
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
          {/* Once generated, the text is BURNED IN - drawing the live overlay on top of
              it too would show the headline twice. Any edit clears `result`, which puts
              the editable canvas straight back. */}
          {result ? (
            <Image source={{ uri: result }} style={styles.shot} resizeMode="cover" />
          ) : (
            <>
              {backdrop
                ? <Image source={{ uri: backdrop }} style={styles.shot} resizeMode="cover" />
                : (
                  <View style={styles.stageInner}>
                    {backdropBusy
                      ? <ActivityIndicator color="#00d4d4" />
                      : <MaterialIcons name="image" size={28} color="#333" />}
                  </View>
                )}

              {/* Tapping the canvas itself deselects, the same way the editor's does -
                  otherwise there is no way to put the handles away. */}
              {selected && !editing && (
                <TouchableOpacity
                  style={StyleSheet.absoluteFill}
                  activeOpacity={1}
                  onPress={() => setSelected(false)}
                />
              )}

              {!!overlay && stageWidth > 0 && (
                <CanvasOverlay
                  overlay={overlay}
                  containerW={stageWidth}
                  containerH={stageWidth / ratio}
                  selected={selected}
                  onSelect={() => setSelected(true)}
                  onTransform={(key, next) => setOverlayFields(next)}
                  // First tap selects so it can be moved without the keyboard in the
                  // way; tapping the selected one puts a caret in it. Same two-step
                  // the editor uses, and for the same reason.
                  onTap={() => (selected ? setEditing(true) : setSelected(true))}
                  onLongPress={() => setShowStyles(true)}
                  onEditDone={() => {
                    setEditing(false);
                    // Typed empty means deleted. Leaving it would keep an invisible
                    // object on the canvas that still swallows every tap.
                    setOverlay(prev => (prev && !prev.text.trim() ? null : prev));
                  }}
                  editing={editing}
                >
                  <TextOverlayContent
                    overlay={overlay}
                    maxWidth={stageWidth * 0.8}
                    editing={editing}
                    onChangeText={(key, text) => setOverlayFields({ text })}
                    onEndEditing={() => setEditing(false)}
                  />
                </CanvasOverlay>
              )}
            </>
          )}
        </View>

        <Text style={styles.note}>
          {overlay
            ? 'Drag to move, pinch to resize, two fingers to turn. Tap once to select, again to type.'
            : 'Add a headline and place it anywhere on the frame.'}
        </Text>

        {/* 3 - composition */}
        <View style={styles.headlineRow}>
          <Text style={styles.step}>Headline</Text>
          {overlay ? (
            <TouchableOpacity onPress={() => setOverlay(null)} hitSlop={8}>
              <Text style={styles.remove}>Remove</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        {overlay ? (
          <TextInput
            style={styles.input}
            value={overlay.text}
            onChangeText={(text) => setOverlayFields({ text })}
            placeholder="Your headline"
            placeholderTextColor="#555"
            maxLength={60}
          />
        ) : (
          <TouchableOpacity style={styles.addText} onPress={addText}>
            <MaterialIcons name="add" size={20} color="#2ECC71" />
            <Text style={styles.addTextLabel}>Add headline</Text>
          </TouchableOpacity>
        )}

        {/* The two are LAYERS, not alternatives, and the order here is the order they
            apply in. A caption style is a whole look - face, fill, stroke, glow, shadow,
            box, tracking, case - and stroke and glow are precisely what keeps text
            legible on top of a photograph, which is the only problem a thumbnail has.
            The font then overrides just the face, because every one of the 138 styles is
            locked to one, and a typeface is a brand decision rather than a look. The
            renderer already honours the override ({ ...captionStyle, font }); this only
            exposes it. */}
        <TouchableOpacity style={[styles.row, !overlay && styles.rowOff]} disabled={!overlay} onPress={() => setShowStyles(true)}>
          <Text style={styles.rowLabel}>Style</Text>
          <View style={styles.rowRight}>
            <Text style={styles.rowValue}>{spec.label || styleId}</Text>
            <MaterialIcons name="chevron-right" size={20} color="#888" />
          </View>
        </TouchableOpacity>

        {!!overlay && (
          <View style={styles.fontWrap}>
            <FontPicker
              value={overlay.font || spec.font}
              onChange={(font) => setOverlayFields({ font })}
            />
          </View>
        )}

        {!!overlay && (
          <>
            <Text style={styles.sliderLabel}>Colour</Text>
            <View style={styles.swatches}>
              {/* First swatch reverts to whatever the style itself specifies, so a
                  colour tried and disliked is one tap from undone - the same "Match
                  style" affordance the Auto Captions sheet already uses. */}
              <TouchableOpacity
                style={[styles.swatchMatch, overlay.color === spec.color && styles.swatchOn]}
                onPress={() => setOverlayFields({ color: spec.color })}>
                <Text style={styles.swatchMatchText}>Match style</Text>
              </TouchableOpacity>
              {HEADLINE_COLOURS.map(c => (
                <TouchableOpacity
                  key={c}
                  style={[styles.swatch, { backgroundColor: c }, overlay.color === c && styles.swatchOn]}
                  onPress={() => setOverlayFields({ color: c })}
                />
              ))}
            </View>

            {/* Both are points at the app's 18pt base, the unit every other length in a
                caption spec already uses, and both scale with the font size on the way
                out. The style's own tracking is the starting value, so a style designed
                wide stays wide until it is deliberately changed. */}
            <Text style={styles.sliderLabel}>
              Letter spacing · {(overlay.spacing ?? baseSpec.spacing ?? 0).toFixed(1)}
            </Text>
            <Slider
              minimumValue={-1} maximumValue={8} step={0.1}
              value={overlay.spacing ?? baseSpec.spacing ?? 0}
              onValueChange={(v) => setOverlayFields({ spacing: Math.round(v * 10) / 10 })}
              minimumTrackTintColor="#00d4d4" maximumTrackTintColor="#2a2a2a" thumbTintColor="#00d4d4"
            />

            <Text style={styles.sliderLabel}>
              Line spacing · {(overlay.lineSpacing ?? 0).toFixed(1)}
            </Text>
            <Slider
              minimumValue={-4} maximumValue={16} step={0.5}
              value={overlay.lineSpacing ?? 0}
              onValueChange={(v) => setOverlayFields({ lineSpacing: Math.round(v * 2) / 2 })}
              minimumTrackTintColor="#00d4d4" maximumTrackTintColor="#2a2a2a" thumbTintColor="#00d4d4"
            />
            {/* Only reachable by having moved one of them, so it is never a control
                offering to undo nothing. */}
            {(overlay.spacing != null || overlay.lineSpacing != null) && (
              <TouchableOpacity
                style={styles.resetSpacing}
                onPress={() => setOverlayFields({ spacing: null, lineSpacing: null })}>
                <Text style={styles.resetSpacingText}>Reset spacing</Text>
              </TouchableOpacity>
            )}
          </>
        )}

        {/* Kept alongside the pinch rather than replaced by it. A pinch is quick and
            imprecise; a slider is the only way to land on an exact size. They edit the
            same number - this is the base, and a pinch multiplies it by `scale`, which
            is folded back in when the request is built. Reading the pinch back into the
            label keeps the two honest with each other. */}
        <Text style={styles.sliderLabel}>
          Text size · {Math.round((overlay?.size || 34) * (overlay?.scale ?? 1))}
        </Text>
        <Slider
          minimumValue={16} maximumValue={64} step={1}
          value={overlay?.size || 34}
          disabled={!overlay}
          onValueChange={(v) => setOverlayFields({ size: Math.round(v), scale: 1 })}
          minimumTrackTintColor="#00d4d4" maximumTrackTintColor="#2a2a2a" thumbTintColor="#00d4d4"
        />

        {/* A photo has no timeline to scrub. maxSeconds is already 0 for one - its
            record carries durationSeconds 0 and the server probes ~0.04s, which floors
            to 0 - so this needs no separate check for image sources. */}
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
        onChange={(id) => {
          const next = resolveCaptionStyle(id);
          // The style's own face and colour come with it. They stay editable
          // afterwards, which is why they live on the overlay rather than being read
          // from the style at render time.
          setOverlayFields({ captionStyleId: id, font: next.font, color: next.color });
          setShowStyles(false);
        }}
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
  // The four-part horizontal row: flexGrow/flexShrink on style, alignItems and padding
  // on the content container. Three of the four get forgotten when this is written from
  // scratch rather than copied - see the flex traps note in CLAUDE.md.
  pickRow: { flexGrow: 0, flexShrink: 0 },
  pickRowContent: { alignItems: 'center', paddingHorizontal: 2, gap: 8 },
  upload: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#111', borderWidth: 1, borderColor: '#2ECC71', borderStyle: 'dashed', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  uploadText: { color: '#2ECC71', fontSize: 12, fontWeight: '700' },
  pick: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, maxWidth: 190 },
  pickOn: { backgroundColor: '#2ECC71', borderColor: '#2ECC71' },
  pickText: { color: '#cfcfcf', fontSize: 12, fontWeight: '600', flexShrink: 1 },
  pickTextOn: { color: '#000' },
  stage: { width: '100%', backgroundColor: '#0a0a0a', borderRadius: 12, borderWidth: 1, borderColor: '#2a2a2a', overflow: 'hidden' },
  stageInner: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  overlayWrap: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  shot: { width: '100%', height: '100%' },
  note: { color: '#888', fontSize: 11, lineHeight: 16, marginTop: 8 },
  headlineRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  remove: { color: '#ff6b6b', fontSize: 12, fontWeight: '600', marginTop: 18 },
  addText: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#111', borderWidth: 1, borderColor: '#2a2a2a', borderStyle: 'dashed', borderRadius: 12, paddingVertical: 14 },
  addTextLabel: { color: '#2ECC71', fontSize: 13, fontWeight: '700' },
  rowOff: { opacity: 0.45 },
  fontWrap: { marginTop: 10 },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 8 },
  swatch: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: '#2a2a2a' },
  swatchMatch: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 15, backgroundColor: '#1a1a1a', borderWidth: 2, borderColor: '#2a2a2a' },
  swatchMatchText: { color: '#cfcfcf', fontSize: 11, fontWeight: '600' },
  swatchOn: { borderColor: '#2ECC71' },
  resetSpacing: { alignSelf: 'flex-start', marginTop: 10, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 15, borderWidth: 1, borderColor: '#2a2a2a' },
  resetSpacingText: { color: '#cfcfcf', fontSize: 11, fontWeight: '600' },
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
