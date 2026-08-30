import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, Image, ScrollView,
  StyleSheet, ActivityIndicator, Alert, StatusBar,
  Dimensions, Modal, TextInput, PanResponder, Animated, FlatList
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { Video, Audio } from 'expo-av';
import * as DocumentPicker from 'expo-document-picker';
import Slider from '@react-native-community/slider';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SheetHeader, { useSheetInset } from '../components/SheetHeader';
import ColorPicker, { normalizeHex } from '../components/ColorPicker';
import FontPicker from '../components/FontPicker';
import CaptionStylePicker from '../components/CaptionStylePicker';
import CaptionText, { captionMetrics } from '../components/CaptionText';
import TextOverlayContent from '../components/TextOverlayContent';
import CanvasOverlay from '../components/CanvasOverlay';
import FilmStrip from '../components/FilmStrip';
import TrimStrip from '../components/TrimStrip';
import TransitionSheet from '../components/TransitionPicker';
import Waveform from '../components/Waveform';
import ConfirmSheet from '../components/ConfirmSheet';
import {
  saveDraft, loadDraft, clearDraft, describeAge, validateDraft, draftUris,
} from '../utils/draft';
import { requestNotificationPermission, scheduleReminders } from '../utils/notifications';
import { persistMedia, newMediaId, sweepUnreferenced, cacheRemoteMedia } from '../utils/mediaStore';
import FilterSheet from '../components/FilterPicker';
import MotionPicker from '../components/MotionPicker';
import ChromaSheet from '../components/ChromaSheet';
import EffectPicker from '../components/EffectPicker';
import { filterSpec, resolveFilter, filterCss } from '../constants/filters';
import { motionChain, resolveMotion } from '../constants/motions';
import { effectCss } from '../constants/effects';
import { effectChain, resolveEffect } from '../constants/effects';
import AdjustSheet from '../components/AdjustSheet';
import { adjustChain, hasAdjustments } from '../constants/adjustments';
import { ASPECT_RATIOS, DEFAULT_ASPECT, resolveAspect, fitAspect } from '../constants/aspectRatios';
import StickerSheet, { stickerUri } from '../components/StickerPicker';
import BackgroundSheet from '../components/BackgroundSheet';
import CropSheet from '../components/CropSheet';
import AudioFxSheet from '../components/AudioFxSheet';
import { TransformSheet, TransparencySheet } from '../components/TransformSheet';
import LayersSheet from '../components/LayersSheet';
import MaskSheet from '../components/MaskSheet';
import BeatMarkers from '../components/BeatMarkers';
import { DEFAULT_BACKGROUND, normaliseBackground } from '../constants/background';
import { TRANSITION_PREVIEW_VERSION } from '../constants/transitionPreviewVersion';
import {
  transitionSpec, resolveTransition, hasTransition, transitionPreviewFrame, previewFidelity,
} from '../constants/transitions';
import { usePlan } from '../constants/plan';
import { Image as ExpoImage } from 'expo-image';
import { VideoView, useVideoPlayer } from 'expo-video';
import { measureVideoDuration, measureVideo } from '../utils/videoDuration';
import { fontFamilyFor } from '../constants/fonts';
import {
  DEFAULT_CAPTION_STYLE_ID, resolveCaptionStyle, captionChunkSize,
  captionFontSize, captionFill, captionExportSpec, captionHighlight, activeWordIndex,
  DEFAULT_TEXT_BACKGROUND, withAlpha, backgroundExportBox,
} from '../constants/captionStyles';
import { auth } from '../firebase';
import ReanimatedAnimated, { useSharedValue, useAnimatedStyle, runOnJS, useAnimatedRef, useAnimatedReaction, scrollTo } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { showAlert } from '../components/BrandedAlert';
import { useJobs } from '../context/JobsContext';
import { voiceById } from '../constants/voices';
import VoiceAvatar from '../components/VoiceAvatar';
import VoicePicker from '../components/VoicePicker';
import { navigationRef } from '../utils/navigationRef';

const BACKEND = 'https://api.fitlifesolutions.site';

// Every /api route on the server sits behind verifyToken. A call that forgets the
// header does not fail loudly: it gets a 401 whose JSON has none of the fields the
// caller was reading, so the feature silently does nothing. That is how the export
// bar sat at 0% while the render finished on disk, and how the music library, the
// voice preview and voiceover generation had all quietly stopped working.
//
// The token is read per call rather than captured: these expire after an hour and a
// long render outlives that. getIdToken() returns the cached one until it is near
// expiry, so this is not a round trip every time.
async function apiFetch(path, options = {}) {
  const user = auth.currentUser;
  const token = user ? await user.getIdToken() : null;
  const headers = { ...(options.headers || {}) };
  if (token) headers.Authorization = 'Bearer ' + token;
  return fetch(BACKEND + path, { ...options, headers });
}

// Turns a fetch Response into JSON, or a message someone can actually act on.
//
// "JSON Parse error: Unexpected character: <" is what res.json() throws when the
// server did not answer with JSON at all - and that character is always the start
// of an HTML page. It is almost never this app's own code producing that page: it is
// nginx, in front of it, rejecting the request before Express ever saw it - a body
// over the 50MB proxy limit, or a slow upload outrunning the 60s it waits between
// packets by default. On this connection that second one is the likely case: upload
// speeds logged elsewhere in this session run from tens of bytes a second to a few
// kilobytes. The raw parse error names none of that, so whoever hits it cannot tell
// a slow connection from a bug in the app.
//
// Every real error the backend sends is a real JSON body - {"error": "..."} - and
// almost every call site already assumed this function hands that back rather than
// throwing on it (`const data = await readJson(res); if (data.error) ...`, or a
// 402/403 branch reading `error` off the return value to show promptUpgrade). It
// didn't: a non-ok response threw immediately, before any of those checks ever ran,
// so every one of those branches was dead code - every rejection, credit-limit
// included, fell through to a generic catch block showing whatever raw text this
// function's own fallback produced. That's what put an unparsed `{"error":"..."}`
// straight on screen for a 402. Only a response with no real JSON body at all - the
// nginx-page case above, where there is nothing structured to hand back - still
// throws a translated message here.
async function readJson(res) {
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === 'object') return parsed;
    } catch {}
    const known = {
      408: 'The upload took too long and the server gave up waiting. Try again on a faster connection.',
      413: 'That file is too large for the server to accept.',
      502: 'The server is not responding right now. Try again in a moment.',
      504: 'The upload took too long and the connection timed out. Try again on a faster connection.',
    };
    throw new Error(known[res.status] || `Server error (${res.status}).${text ? ' ' + text.slice(0, 120) : ''}`);
  }
  try {
    return await res.json();
  } catch {
    // A 200 that is not JSON should not happen, but a bare SyntaxError here is
    // exactly as uninformative as the failure this function exists to replace.
    throw new Error('The server sent back something unexpected. Try again.');
  }
}
const { width: SW, height: SH } = Dimensions.get('window');
const PIXELS_PER_SECOND = 40;
// Where the playhead sits across the timeline viewport. Left of it is elapsed
// footage only, right of it holds the clips, aux rows and add buttons, so it
// sits well left of centre to give that side the room.
const SCRUBBER_POS = 0.3;
const SCRUBBER_LINE_W = 2;
// Visible breathing room between the playhead and the first clip / aux chip.
const SCRUBBER_GAP = 4;
// The BOX the preview frame is fitted inside, not the frame itself. A 9:16 project
// fills its height and comes out the same 50%-of-width it always was; a 16:9 one is
// free to use the width instead of being squeezed into a portrait column.
const PREVIEW_MAX_W = SW * 0.86;
const PREVIEW_MAX_H = SH * 0.40;
// The 9:16 frame, still a constant because a handful of module-level helpers need a
// sensible default before the project's own aspect is known.
const PREVIEW_W = SW * 0.5;
// The fixed left rail of the timeline. Read by both the sidebar and the ruler that
// has to line up past it.
const SIDEBAR_W = 72;
// An overlay added at scale 1 covers this fraction of the frame's width. Read by
// the canvas to draw it and by the export to reproduce it, so they cannot disagree.
const OVERLAY_BASE_FRAC = 0.4;
// A clip is as wide as the time it covers - see clipsComputed. CLIP_MIN_W only
// keeps a very short clip selectable; below about 0.4s the strip stops being an
// accurate ruler, which is the better trade against a clip too small to touch.
const CLIP_MIN_W = 16;
const CLIP_H = 56;
// The grab area on each edge of a selected clip. Wide enough to hit with a thumb
// without the two handles meeting in the middle of a short clip.
const TRIM_HANDLE_W = 16;
// Nothing may be trimmed shorter than this. A zero-length clip is not a thing the
// export or the playhead can make sense of.
const MIN_CLIP_DUR = 0.3;
// A still has no footage to run out of, so its right handle needs a stop of its own.
const IMAGE_MAX_DUR = 30;
// The floating add button on each timeline row. Small enough to sit inside a 26px
// aux row without touching its edges.
const RAIL_BTN = 24;
// How far the rail sits in from the timeline's right edge. Named because the widened
// add-clip slot has to subtract exactly this to end where the round buttons end.
const RAIL_INSET = 6;
// The visible gap drawn on a join between two clips, and the transition marker centred
// on it. Both are painted over the clips, so neither is time the timeline has to carry.
const CLIP_SEAM_W = 4;
const TRANSITION_BTN = 22;
// In row order, which is the order they are drawn down the timeline.
//
// Add clip keeps the shape it has always had - a clip-height square with a dashed
// border and a plus in it, reading as the empty slot the next clip goes into. The
// aux rows get small round buttons carrying their own row's icon rather than a bare
// plus, since four identical circles in a column say nothing about which row each
// one adds to. `big` rather than a style object here: `styles` is declared at the
// bottom of the file and this array is built at module load, which is before it.
const ADD_RAIL = [
  { key: 'clips', icon: 'add', label: 'Add clip', big: true },
  { key: 'voiceover', icon: 'record-voice-over', label: 'Add voiceover' },
  { key: 'music', icon: 'music-note', label: 'Add music' },
  { key: 'text', icon: 'title', label: 'Add text' },
  { key: 'captions', icon: 'closed-caption', label: 'Auto captions' },
];

// What the bottom bar becomes while a clip is selected. Grouped as written; the
// groups are separated by a rule rather than run together, since the order is the
// only thing that says these belong to each other.

// One side of a join, drawn as a plain layer. Muted always - the main <Video> owns
// the audio and the clock, and a second source playing aloud would double it.
function JoinClipLayer({ item, isPlaying, active, style }) {
  if (item.type === 'video') {
    return (
      <Video
        source={{ uri: item.uri }}
        // The frame that plays right after this join finishes is trimStart, not
        // whatever the file's own beginning is.
        positionMillis={(item.trimStart || 0) * 1000}
        style={[styles.previewImage, flipTransform(item), style]}
        resizeMode="cover"
        // Paused until the blend actually starts. This layer mounts well before that
        // - see LOOKAHEAD below - purely so its decoder has time to open the file and
        // seek before it is needed. If it were also playing during that head start,
        // it would run forward from trimStart the whole time, and by the moment the
        // blend became visible it would already be showing footage seconds past the
        // frame the export actually opens on. Held still keeps it sitting on the
        // correct first frame until there is an audience for it.
        shouldPlay={isPlaying && active}
        isLooping={false}
        isMuted
        rate={item.speed || 1}
        shouldCorrectPitch
      />
    );
  }
  return (
    <Image
      source={{ uri: item.uri }}
      style={[styles.previewImage, flipTransform(item), style]}
      resizeMode="cover"
    />
  );
}

// The window a masked transition reveals through. Fractions become points here, which
// is the only place that turns them into points.
function maskContainerStyle(mask, dims) {
  const { w: PW, h: PH } = dims;
  if (mask.type === 'circle') {
    // A square with a full corner radius. Sized off the larger edge so the circle can
    // grow past the corners and clear the frame completely.
    const side = 2 * mask.r * Math.max(PW, PH);
    return {
      position: 'absolute',
      left: mask.cx * PW - side / 2,
      top: mask.cy * PH - side / 2,
      width: side,
      height: side,
      borderRadius: side / 2,
      overflow: 'hidden',
    };
  }
  return {
    position: 'absolute',
    left: mask.x * PW,
    top: mask.y * PH,
    width: mask.w * PW,
    height: mask.h * PH,
    overflow: 'hidden',
  };
}

// Cancels the container's offset, so the clip inside sits exactly where it would have
// sat unmasked. Without this the picture slides along with the window and the whole
// effect looks like a slide with a ragged edge.
function maskInnerStyle(mask, dims) {
  const { w: PW, h: PH } = dims;
  const left = mask.type === 'circle'
    ? -(mask.cx * PW - (mask.r * Math.max(PW, PH)))
    : -mask.x * PW;
  const top = mask.type === 'circle'
    ? -(mask.cy * PH - (mask.r * Math.max(PW, PH)))
    : -mask.y * PH;
  return { position: 'absolute', left, top, width: PW, height: PH };
}

// The row of sources at the top of Add Voiceover and Add Music.
//
// Two pills fitted a row; six do not, so this scrolls. It is wrapped in a
// fixed-height View on purpose - an unconstrained horizontal ScrollView in a column
// is what pushed the whole timeline 200px down the screen earlier, and a tab strip
// is another element that must never be able to grow.
//
// An unbuilt source is dimmed and says so on tap rather than switching to an empty
// panel. It does NOT offer the plan, even when it carries a diamond: paying does not
// summon a feature that has not been written.
function SourceTabs({ tabs, value, isPremium, onSelect }) {
  return (
    <View style={styles.sourceTabsRow}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.sourceTabsContent}>
        {tabs.map(t => {
          const active = t.built && t.key === value;
          const locked = t.premium && !isPremium;
          return (
            <TouchableOpacity
              key={t.key}
              onPress={() => (t.built ? onSelect(t) : showAlert(
                t.label,
                t.premium ? 'Coming soon on the paid plans.' : 'Coming soon.'
              ))}
              style={[styles.sourceTab, active && styles.sourceTabActive]}>
              <Text style={[
                styles.sourceTabText,
                active && styles.sourceTabTextActive,
                !t.built && styles.sourceTabTextDim,
              ]}>{t.label}</Text>
              {/* Only when it is actually LOCKED. A diamond on a plan that already
                  includes the thing is not information - for a Creator subscriber it
                  was a gold mark on most of the bar at once. Every picker in the app
                  already gated it this way; the four in this file did not. */}
              {t.premium && locked && (
                <MaterialIcons name="diamond" size={11} color="#f5c451" />
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

// Where a voiceover or a piece of music can come from. Generate is the app's
// text-to-audio and Library is its sounds catalogue - both already built, so they are
// not duplicated under the names another editor gives them.
const VOICEOVER_SOURCES = [
  { key: 'generate', label: 'Text to audio', built: true },
  { key: 'file', label: 'Pick file', built: true },
  { key: 'record', label: 'Record', built: false },
];

const MUSIC_SOURCES = [
  { key: 'library', label: 'Sounds', built: true },
  { key: 'device', label: 'Upload', built: true },
  { key: 'soundfx', label: 'Sound FX', built: false, premium: true },
  { key: 'brand', label: 'Brand music', built: false, premium: true },
  { key: 'extract', label: 'Extract', built: false, premium: true },
  { key: 'copyright', label: 'Copyright', built: false, premium: true },
];

// What a locked feature says when tapped.
//
// There is no checkout in this app yet, so this does not claim there is one. Saying
// "upgrade now" and then going nowhere is worse than saying plainly that the feature
// is on the paid plans - and when billing lands, this is the one function that has to
// learn how to open it.
// message, when given, is the backend's own rejection reason (credits
// exhausted, a per-video duration cap, a locked caption style or voice) -
// shown verbatim rather than restated, since the backend already knows
// exactly which cap was hit and by how much. Falls back to the generic
// "this is a paid feature" copy for the tool-locking call sites that have
// no specific reason to report, only a feature name.
//
// Routes into SubscriptionScreen via navigationRef rather than a web
// pricing page: Play Billing (not Stripe) is the plan, entirely inside the
// Android app via react-native-iap, not a website checkout - so the only
// honest place to send someone is the in-app purchase screen itself.
function promptUpgrade(label, message) {
  showAlert(
    'Upgrade to Continue',
    message || `${label} is on the Pro and Creator plans.`,
    [
      { text: 'Not now', style: 'cancel' },
      { text: 'See Plans', onPress: () => navigationRef.isReady() && navigationRef.navigate('Subscription') },
    ]
  );
}

const CLIP_TOOLS = [
  // Everything here works. The bar opens on them so the first thing met is a tool
  // that does something, not a run of grey.
  [
    { key: 'replace', icon: 'swap-horiz', label: 'Replace' },
    { key: 'trim', icon: 'straighten', label: 'Trim' },
    { key: 'split', icon: 'content-cut', label: 'Split' },
    { key: 'duplicate', icon: 'content-copy', label: 'Duplicate' },
    { key: 'delete', icon: 'delete', label: 'Delete' },
  ],
  [
    { key: 'volume', icon: 'volume-up', label: 'Volume' },
    { key: 'speed', icon: 'speed', label: 'Speed' },
    { key: 'audio', icon: 'graphic-eq', label: 'Audio tools' },
    { key: 'captions', icon: 'closed-caption', label: 'Captions' },
    { key: 'transition', icon: 'compare-arrows', label: 'Transition' },
    { key: 'overlay', icon: 'picture-in-picture-alt', label: 'Overlay' },
    { key: 'filters', icon: 'photo-filter', label: 'Filters' },
    { key: 'motion', icon: 'animation', label: 'Motion' },
    { key: 'effect', icon: 'auto-awesome', label: 'Effects' },
    { key: 'flip', icon: 'flip', label: 'Flip' },
  ],
  // Beyond this point nothing is built yet. Grouped by what they would do, so the
  // scroll reads as categories rather than as a wall.
  [
    { key: 'transparency', icon: 'opacity', label: 'Transparency', premium: true },
    { key: 'layers', icon: 'layers', label: 'Layers', premium: true },
    // Built and free: choosing which part of the shot is used is core editing.
    { key: 'crop', icon: 'crop', label: 'Crop' },
    { key: 'colour', icon: 'palette', label: 'Colour', premium: true },
    { key: 'animate', icon: 'animation', label: 'Animate', premium: true },
    { key: 'transform', icon: 'transform', label: 'Transform', premium: true },
  ],
  [
    // Built, and free: hand correction of brightness and colour is table stakes in
    // an editor, not a paid extra. It kept its diamond while it did nothing.
    { key: 'adjust', icon: 'tune', label: 'Adjust' },
    { key: 'bgremover', icon: 'auto-fix-high', label: 'BG Remover', premium: true },
    { key: 'magic', icon: 'auto-awesome', label: 'Magic Studio', premium: true },
    { key: 'retouch', icon: 'face-retouching-natural', label: 'Retouch', premium: true },
  ],
  [
    { key: 'freeze', icon: 'ac-unit', label: 'Freeze', premium: true },
    { key: 'reverse', icon: 'fast-rewind', label: 'Reverse', premium: true },
    { key: 'unlink', icon: 'link-off', label: 'Unlink', premium: true },
  ],
  [
    { key: 'extractaudio', icon: 'audiotrack', label: 'Extract audio', premium: true },
    { key: 'reducenoise', icon: 'noise-control-off', label: 'Reduce noise', premium: true },
    { key: 'audioeffects', icon: 'equalizer', label: 'Audio effects', premium: true },
    { key: 'isolatevoice', icon: 'mic', label: 'Isolate voice', premium: true },
    { key: 'enhancevoice', icon: 'record-voice-over', label: 'Enhance voice', premium: true },
    { key: 'beats', icon: 'av-timer', label: 'Beats', premium: true },
  ],
  [
    { key: 'autoreframe', icon: 'crop-free', label: 'Auto reframe', premium: true },
    { key: 'stabilize', icon: 'vibration', label: 'Stabilize', premium: true },
    { key: 'motionblur', icon: 'blur-on', label: 'Motion blur', premium: true },
    { key: 'mask', icon: 'masks', label: 'Mask', premium: true },
    { key: 'relight', icon: 'light-mode', label: 'Relight', premium: true },
  ],
  // The generative set: every one is a model call that exists on no backend yet.
  [
    { key: 'airemove', icon: 'healing', label: 'AI remove', premium: true },
    { key: 'aiexpand', icon: 'open-in-full', label: 'AI expand', premium: true },
    { key: 'airemix', icon: 'auto-awesome-motion', label: 'AI remix', premium: true },
    { key: 'eyecontact', icon: 'remove-red-eye', label: 'Eye contact', premium: true },
    { key: 'lipsync', icon: 'face', label: 'Lip sync', premium: true },
    { key: 'translate', icon: 'translate', label: 'Video translator', premium: true },
  ],
];

// What the bottom bar becomes while an audio track is selected. Confirm is not in
// this list - it is pinned outside the scroller so it cannot be scrolled away from.
// Working tools first, unbuilt ones last.
//
// The tables below are grouped by what a tool WOULD do, which is the right way to write
// a roadmap and the wrong way to lay out a toolbar: it left Video translator, Stabilize,
// Reverse, Reduce noise and Motion blur - all built and all paid - scattered among
// thirty dimmed placeholders, so the features worth paying for were the hardest to find.
//
// Derived from the action map rather than reordered by hand, and that is the point:
// wiring a tool up promotes it into the front group by itself. A hand-written order
// would be correct on the day it was written and quietly wrong from the next tool
// onwards - the same staleness that let a shipped feature sit in the roadmap as
// "not built".
//
// Unbuilt tools keep their own grouping and their own order behind the working ones, so
// the roadmap is still legible.
const toolIsBuilt = (t, actions) => t.built !== false && !!actions[t.key];

function builtFirst(groups, actions) {
  const built = [];
  const rest = [];
  for (const group of groups) {
    const unbuilt = group.filter(t => !toolIsBuilt(t, actions));
    for (const t of group) if (toolIsBuilt(t, actions)) built.push(t);
    if (unbuilt.length) rest.push(unbuilt);
  }
  return built.length ? [built, ...rest] : rest;
}

const AUDIO_TOOLS = [
  { key: 'replace', icon: 'swap-horiz', label: 'Replace' },
  { key: 'duplicate', icon: 'content-copy', label: 'Duplicate' },
  { key: 'delete', icon: 'delete', label: 'Delete' },
  { key: 'split', icon: 'content-cut', label: 'Split' },
  { key: 'slip', icon: 'swipe', label: 'Slip' },
  { key: 'fade', icon: 'gradient', label: 'Fade' },
  { key: 'volume', icon: 'volume-up', label: 'Volume' },
  { key: 'beatsync', icon: 'av-timer', label: 'Beat Sync', premium: true },
  { key: 'audiofx', icon: 'equalizer', label: 'Effects', premium: true },
  { key: 'enhance', icon: 'auto-fix-high', label: 'Enhance voice', premium: true },
  { key: 'captions', icon: 'closed-caption', label: 'Captions' },
];

const FILTERS = ['None','Bright','Contrast','Warm','Cool','Fade','B&W'];
// Measured bands, not adjectives: slow <=80, medium <=110, upbeat <=139, fast above.
const MUSIC_TEMPOS = ['Any', 'Slow', 'Medium', 'Upbeat', 'Fast'];
// How long to hold the last frame. Capped at 5 on both sides - the server clamps it
// too, because this is duration invented after the credit check counted the clip.
const FREEZE_SECONDS = [0, 1, 2, 3, 5];
const SPEEDS = [0.3, 0.5, 1, 1.5, 2, 3];
const TEXT_COLORS = ['#fff','#000','#ff0','#f00','#0f0','#00f','#f0f','#0ff'];
// A colour mixed on the picker is worth keeping - the next overlay almost always
// wants the same one, and re-finding it by eye on the plane is not possible.
const RECENT_COLORS_KEY = 'tonefy.recentTextColors';
const MAX_RECENT_COLORS = 8;
// Draggable/trimmable wrapper for an absolute-positioned audio timeline
// block. Position is driven externally (via initialLeft, recomputed from
// startOffset/PIXELS_PER_SECOND by the caller) but tracked internally
// during an active drag/trim gesture so movement feels immediate rather
// than waiting on a full re-render round-trip.
function DraggableAudioTrack({ trackKey, initialLeft, width, height, minX, maxX, onDragEnd, onTrimEnd, isSelected, children }) {
  const leftAnim = useRef(new Animated.Value(initialLeft)).current;
  const currentLeftRef = useRef(initialLeft);
  const dragStartRef = useRef(initialLeft);
  // The PanResponder below is built once and never rebuilt, so it would clamp
  // against whatever minX/maxX were on the first render. A track's width is not
  // known then - it starts as the 30px minimum and only reaches its real size
  // once the duration lands - so the mount-time maxX is always wrong. Read the
  // live values through a ref instead.
  const boundsRef = useRef({ minX, maxX });
  boundsRef.current = { minX, maxX };

  useEffect(() => {
    currentLeftRef.current = initialLeft;
    leftAnim.setValue(initialLeft);
  }, [initialLeft]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (e, g) => Math.abs(g.dx) > 4 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderGrant: () => {
        dragStartRef.current = currentLeftRef.current;
      },
      onPanResponderMove: (e, g) => {
        const { minX: lo, maxX: hi } = boundsRef.current;
        const newX = Math.max(lo, Math.min(hi, dragStartRef.current + g.dx));
        currentLeftRef.current = newX;
        leftAnim.setValue(newX);
      },
      onPanResponderRelease: () => {
        onDragEnd(trackKey, currentLeftRef.current);
      },
    })
  ).current;

  const leftTrimResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (e, g) => Math.abs(g.dx) > 4,
      onPanResponderRelease: (e, g) => { onTrimEnd(trackKey, 'left', g.dx); },
    })
  ).current;

  const rightTrimResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (e, g) => Math.abs(g.dx) > 4,
      onPanResponderRelease: (e, g) => { onTrimEnd(trackKey, 'right', g.dx); },
    })
  ).current;

  return (
    <Animated.View style={{ position: 'absolute', left: leftAnim, top: 0, width, height }} {...panResponder.panHandlers}>
      {children}
      {isSelected && (
        <React.Fragment>
          <View {...leftTrimResponder.panHandlers} style={{ position: 'absolute', left: -6, top: 0, width: 14, height, justifyContent: 'center', alignItems: 'center' }}>
            <View style={{ width: 3, height: height * 0.6, backgroundColor: '#fff', borderRadius: 2 }} />
          </View>
          <View {...rightTrimResponder.panHandlers} style={{ position: 'absolute', right: -6, top: 0, width: 14, height, justifyContent: 'center', alignItems: 'center' }}>
            <View style={{ width: 3, height: height * 0.6, backgroundColor: '#fff', borderRadius: 2 }} />
          </View>
        </React.Fragment>
      )}
    </Animated.View>
  );
}

// What an overlay looks like. Where it sits, how big it is and which way up it is
// are CanvasOverlay's business - this only draws. Splitting the two is what lets
// the same content be dragged, pinched and turned without the renderer knowing.
// What an overlay sends as its export spec. A caption already has one from its
// style; a manual overlay has at most a chip, which is a `box` like any other -
// so a manual overlay with a background is exported through exactly the machinery
// that draws Newsroom and Sticker, rather than a second path beside it.
function overlayExportSpec(overlay) {
  const box = backgroundExportBox(overlay.background);
  if (!box) return overlay.captionSpec;
  return { ...(overlay.captionSpec || null), box };
}

// A video overlay actually playing on the canvas - picture-in-picture, not a still
// standing in for one. This is expo-video rather than the expo-av <Video> driving the
// main canvas, and deliberately: expo-av's session manager is what cut the preview's
// audio in e1937cfe, while expo-video takes an explicit audioMixingMode and can be
// told to stay out of the way. useVideoPlayer also releases the player when this
// unmounts, which createVideoPlayer would not.
function MediaOverlayVideo({ uri, width, height, isPlaying }) {
  const player = useVideoPlayer(uri, p => {
    // Muted because the export cannot do otherwise: the server's overlay filter takes
    // the video stream alone ([n:v]), so PiP audio is not in the burned-in result.
    // A preview that played it would promise something the export does not deliver.
    p.muted = true;
    p.audioMixingMode = 'mixWithOthers';
    // No timing controls yet, so the overlay spans the whole video. A PiP shorter
    // than the piece would otherwise sit on its last frame for the remainder.
    p.loop = true;
  });

  // Follows the preview's transport instead of running on its own clock. A PiP still
  // playing while the timeline is paused reads as a bug.
  useEffect(() => {
    if (isPlaying) player.play(); else player.pause();
  }, [isPlaying, player]);

  return (
    <VideoView
      player={player}
      style={{ width, height }}
      contentFit="contain"
      nativeControls={false}
    />
  );
}

// A media overlay on the canvas: a second video or photo sitting on top of the main
// one, at whatever size and angle it has been put.
const MediaOverlayContent = React.memo(function MediaOverlayContent({ overlay, isPlaying, frameW }) {
  const w = (frameW || PREVIEW_W) * OVERLAY_BASE_FRAC;
  // Its own proportions, not a guessed square. An asset that reported no size falls
  // back to square, which is wrong for the picture but right for the layout.
  const ratio = overlay.naturalW && overlay.naturalH ? overlay.naturalH / overlay.naturalW : 1;
  const h = w * ratio;
  if (overlay.type === 'video') {
    return <MediaOverlayVideo uri={overlay.uri} width={w} height={h} isPlaying={isPlaying} />;
  }
  return (
    <ExpoImage source={{ uri: overlay.uri }} style={{ width: w, height: h }}
      contentFit="contain" transition={0} />
  );
});

// Typing happens on the canvas, over the overlay as it is actually drawn, rather
// than in a sheet with a plain input in it. The text being edited is the text you
// are looking at, so a font, a stroke or a chip is judged against the frame behind
// it instead of against a grey modal.
//
// The caret is a transparent TextInput laid over the rendered overlay: nothing can
// reproduce the stacked stroke and glow layers, and a real input styled to match
// would lose them the moment editing began. Both are laid out from `captionMetrics`
// so the caret lands between the right two letters - the one thing this approach
// can get wrong, and the reason there is a single definition of those metrics.

const AudioTrackRow = React.memo(function AudioTrackRow({
  scrollRef, timelineContentWidth, tracksComputed, waveformCache, selectedAudioTrackKey,
  accentColor, iconName, addLabel, leadOffset, onDragEnd, onTrimEnd, onPressTrack, onLongPressTrack, onPressAdd, onLayout
}) {
  const hasTracks = tracksComputed.length > 0;
  return (
    <ReanimatedAnimated.ScrollView horizontal showsHorizontalScrollIndicator={false} scrollEnabled={false}
      ref={scrollRef}
      onLayout={onLayout}
      style={[styles.auxScrollRow, { paddingLeft: 0 }]}
      contentContainerStyle={{ paddingLeft: leadOffset, alignItems: 'center' }}>
      <View style={{ width: hasTracks ? timelineContentWidth : 0, height: 26, position: 'relative', overflow: 'visible' }}>
        {tracksComputed.map(({ track, trackW, trackX }) => (
          <DraggableAudioTrack key={track.key} trackKey={track.key}
            initialLeft={trackX} width={trackW} height={26}
            minX={0} maxX={Math.max(0, timelineContentWidth - trackW)}
            onDragEnd={onDragEnd}
            onTrimEnd={onTrimEnd}
            isSelected={selectedAudioTrackKey === track.key}>
            <TouchableOpacity
              onPress={() => onPressTrack(track.key)}
              onLongPress={() => onLongPressTrack(track.key)}
              style={{ backgroundColor: accentColor, borderRadius:8, paddingHorizontal:8, paddingVertical:4, width: trackW, height: 26, justifyContent: 'center', overflow: 'hidden', borderWidth: selectedAudioTrackKey === track.key ? 2 : 0, borderColor: '#fff' }}>
              <Text style={{ color:'#fff', fontSize:9, marginBottom:1 }} numberOfLines={1}>{track.name?.slice(0, 18)}</Text>
              {/* Width is the block's own width, so the waveform is the audio that
                  is actually under it - the old one was a fixed 3px per sample and
                  simply got clipped. */}
              <Waveform peaks={waveformCache[track.key]} width={trackW - 16} height={12} />
              {/* Over the waveform rather than beside it: a beat is a moment IN this
                  audio, and a separate lane would make the reader match two rows up. */}
              <BeatMarkers
                beats={track.beats}
                trimStart={track.trimStart || 0}
                width={trackW}
                pixelsPerSecond={PIXELS_PER_SECOND}
              />
            </TouchableOpacity>
          </DraggableAudioTrack>
        ))}
      </View>
      {/* Only the empty state. It sits at the head of the row, where it names what the
          row is for and is reachable without scrolling; the button that used to follow
          the tracks sat past the full width of the timeline, which is what the fixed
          add bar in the header replaces. */}
      {!hasTracks && (
        <TouchableOpacity style={styles.auxTrackBtn} onPress={onPressAdd}>
          <MaterialIcons name={iconName} size={12} color="#fff" />
          <Text style={styles.auxLabel}>{addLabel}</Text>
        </TouchableOpacity>
      )}
    </ReanimatedAnimated.ScrollView>
  );
});

// The time ruler. It scrolls with everything else, so a tick sits over the moment it
// names for the whole length of the project.
//
// It replaces a hardcoded [0,1,2,3,4] printed in the header: five labels that never
// moved, never went past four seconds, and had no relationship to what was under
// them. On a 27-second project they were simply wrong.
//
// Label spacing is chosen so labels never collide: at 40px per second, one every
// second would overlap, so the step grows with how much time is on screen.
function fmtClock(s) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

const RULER_H = 18;
const RULER_STEPS = [1, 2, 5, 10, 15, 30, 60, 120, 300];
function rulerStep(pixelsPerSecond) {
  const MIN_LABEL_GAP = 56;
  return RULER_STEPS.find(st => st * pixelsPerSecond >= MIN_LABEL_GAP) || RULER_STEPS[RULER_STEPS.length - 1];
}

const TimeRuler = React.memo(function TimeRuler({ scrollRef, duration, leadOffset, onLayout }) {
  const step = rulerStep(PIXELS_PER_SECOND);
  // One past the end, so the final tick is reachable rather than stopping short.
  const ticks = Math.max(1, Math.ceil(duration / step) + 1);
  // Wrapped in a fixed-height View with overflow hidden. A height on the ScrollView
  // itself was not holding it: the row pushed the whole track area - sidebar, clips
  // and every aux row - about 200px down the screen. Whatever the ScrollView was
  // measuring, a parent with a hard height cannot be argued with, and a ruler is
  // exactly the kind of element that should never be able to grow.
  return (
    <View style={styles.rulerClip}>
    <ScrollView
      ref={scrollRef}
      horizontal
      scrollEnabled={false}
      showsHorizontalScrollIndicator={false}
      style={styles.rulerRow}
      onLayout={onLayout}
      contentContainerStyle={{ paddingLeft: leadOffset }}>
      <View style={{ height: RULER_H, width: Math.max(1, duration * PIXELS_PER_SECOND) + PIXELS_PER_SECOND }}>
        {Array.from({ length: ticks }, (_, i) => {
          const t = i * step;
          return (
            <View key={t} style={[styles.rulerTick, { left: t * PIXELS_PER_SECOND }]}>
              <View style={styles.rulerTickMark} />
              <Text style={styles.rulerTickLabel}>{fmtClock(t)}</Text>
            </View>
          );
        })}
      </View>
    </ScrollView>
    </View>
  );
});

const CaptionsRow = React.memo(function CaptionsRow({ scrollRef, captionPreviewGroups, leadOffset, onPress, onLayout }) {
  return (
    <ReanimatedAnimated.ScrollView horizontal showsHorizontalScrollIndicator={false} scrollEnabled={false}
      ref={scrollRef}
      onLayout={onLayout}
      style={styles.auxScrollRow}
      contentContainerStyle={{ paddingLeft: leadOffset, alignItems: 'center' }}>
      {captionPreviewGroups.length > 0 ? (
        captionPreviewGroups.map(g => (
          <TouchableOpacity key={g.key} style={styles.captionChip}
            onPress={onPress}>
            <Text style={styles.captionChipText} numberOfLines={1}>{g.text}</Text>
          </TouchableOpacity>
        ))
      ) : (
        <TouchableOpacity style={styles.auxTrackBtn}
          onPress={onPress}>
          <MaterialIcons name="closed-caption" size={12} color="#fff" />
          <Text style={styles.auxLabel}>Auto captions</Text>
        </TouchableOpacity>
      )}
    </ReanimatedAnimated.ScrollView>
  );
});

const TextRow = React.memo(function TextRow({ scrollRef, manualTextOverlays, leadOffset, onLongPressChip, onPressChip, onPressAdd, onLayout }) {
  return (
    <ReanimatedAnimated.ScrollView horizontal showsHorizontalScrollIndicator={false} scrollEnabled={false}
      ref={scrollRef}
      onLayout={onLayout}
      style={styles.auxScrollRow}
      contentContainerStyle={{ paddingLeft: leadOffset, alignItems: 'center' }}>
      {manualTextOverlays.map(t => (
        <TouchableOpacity key={t.key} style={styles.textChip}
          onLongPress={() => onLongPressChip(t.key)}
          onPress={() => onPressChip(t)}>
          <Text style={[styles.textChipText, { color: t.color }]}>{t.text}</Text>
        </TouchableOpacity>
      ))}
      {/* Empty state only, as on the audio rows - with chips present this trailed all
          of them, and the header's add bar is always in reach. */}
      {manualTextOverlays.length === 0 && (
        <TouchableOpacity style={styles.auxTrackBtn} onPress={onPressAdd}>
          <MaterialIcons name="title" size={12} color="#fff" />
          <Text style={styles.auxLabel}>Add text</Text>
        </TouchableOpacity>
      )}
    </ReanimatedAnimated.ScrollView>
  );
});

// One clip on the timeline, and the edges you trim it by.
//
// Trimming happens on the clip itself rather than through the sliders in the trim
// modal, because a trim is a judgement about a frame: you drag until you can see the
// frame you want to start on. The modal is still there on long press for setting an
// exact number.
//
// The drag is local and animated. Only two numbers move - how wide the clip's window
// is, and how far the strip is slid inside it - and the edit is committed once, on
// release. Writing to `items` on every frame instead would re-lay-out every later clip
// and every aux row sixty times a second for a gesture that has one outcome.
function TimelineClip({
  item, idx, width, length, selected,
  onPressClip, onLongPressClip, onPressRemove, onTrimEnd,
}) {
  const trimStart = item.trimStart ?? 0;
  const baseOffset = -trimStart * PIXELS_PER_SECOND;
  const leftDx = useRef(new Animated.Value(0)).current;
  const rightDx = useRef(new Animated.Value(0)).current;

  // Dragging the left edge takes width off the front, so it both narrows the window
  // and slides the strip the same amount - which is what keeps the frames under the
  // cursor still while the clip's start moves through them. The right edge only
  // changes the width.
  const animWidth = useMemo(
    () => Animated.add(width, Animated.subtract(rightDx, leftDx)),
    [width, leftDx, rightDx]
  );
  const animOffset = useMemo(
    () => Animated.subtract(baseOffset, leftDx),
    [baseOffset, leftDx]
  );

  // The responders below are built once, so they would otherwise clamp against the
  // geometry of the first render - and a clip's length changes with every trim.
  const srcDur = item.sourceDuration ?? item.trimEnd ?? 0;
  const geomRef = useRef(null);
  geomRef.current = {
    length,
    trimStart,
    // Pixels per second OF SOURCE. trimStart and headroom are measured in the source
    // file while `length` is measured on the timeline, and the two only convert at
    // the same rate when speed is 1.
    srcPps: PIXELS_PER_SECOND / clipSpeed(item),
    // How much unused footage lies past the clip's end - how far right the right edge
    // may still be pulled. A clip whose duration the picker never reported has
    // trimEnd standing in for the source length, which makes this zero: better to
    // refuse to extend than to open a window onto footage that may not be there.
    headroom: item.type === 'image'
      ? IMAGE_MAX_DUR - length
      : srcDur - (item.trimEnd ?? srcDur),
  };
  // Kept out of geomRef, which is rebuilt on every render: a re-render landing mid-drag
  // would take the gesture's own progress with it and commit a trim of zero.
  const dragDxRef = useRef(0);

  const makeTrimResponder = (side, dxValue) => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (e, g) => Math.abs(g.dx) > 2,
    // The clip row lives in a horizontal ScrollView, which will otherwise ask for the
    // touch back the moment the finger moves sideways - which is every trim.
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => { dragDxRef.current = 0; dxValue.setValue(0); },
    onPanResponderMove: (e, g) => {
      const { length: len, trimStart: start, headroom, srcPps } = geomRef.current;
      // Clamped here rather than at the commit so the edge stops where the footage
      // does. Letting it run past and correcting on release drags a handle out to
      // somewhere the clip cannot go, then snaps it back.
      const dx = side === 'left'
        // Back to the head of the source at most, forward to the minimum length.
        ? Math.max(-start * srcPps, Math.min((len - MIN_CLIP_DUR) * PIXELS_PER_SECOND, g.dx))
        // Out to whatever footage is left, in to the minimum length.
        : Math.max(-(len - MIN_CLIP_DUR) * PIXELS_PER_SECOND, Math.min(headroom * srcPps, g.dx));
      dxValue.setValue(dx);
      dragDxRef.current = dx;
    },
    onPanResponderRelease: () => {
      const dx = dragDxRef.current;
      dragDxRef.current = 0;
      dxValue.setValue(0);
      if (dx !== 0) onTrimEnd(item.key, side, dx);
    },
    onPanResponderTerminate: () => {
      dragDxRef.current = 0;
      dxValue.setValue(0);
    },
  });

  const leftTrim = useRef(makeTrimResponder('left', leftDx)).current;
  const rightTrim = useRef(makeTrimResponder('right', rightDx)).current;

  return (
    <View style={styles.clipSlot}>
      <TouchableOpacity
        onPress={() => onPressClip(item.key)}
        onLongPress={() => onLongPressClip(item)}
        activeOpacity={0.85}>
        <Animated.View style={[styles.clipFrame, { width: animWidth }, selected && styles.clipFrameSelected]}>
          <FilmStrip
            uri={item.uri}
            // Survives the copy into permanent storage, so the strip is not rebuilt
            // when the path changes under it.
            cacheId={item.mediaId}
            type={item.type}
            // A still is its own source and can be held for as long as the right
            // handle allows, so its strip is laid out over that whole span.
            sourceDuration={item.type === 'image'
              ? IMAGE_MAX_DUR
              : (item.sourceDuration ?? item.trimEnd ?? item.duration)}
            width={animWidth}
            height={CLIP_H}
            offset={animOffset}
            // Source seconds into timeline pixels: a 2x clip shows the same frames in
            // half the width, so the strip has to be laid out at half the scale or it
            // runs past the clip's own box.
            pixelsPerSecond={PIXELS_PER_SECOND / clipSpeed(item)}
          />
          {/* Beats found in this clip's own sound. Same component the audio tracks use,
              so it is capped and grouped the same way - and laid out at the same scale
              as the filmstrip above, since a 2x clip shows its seconds in half the width
              and beats drawn at full scale would drift steadily out of the box. */}
          <BeatMarkers
            beats={item.beats}
            trimStart={item.trimStart || 0}
            width={width}
            pixelsPerSecond={PIXELS_PER_SECOND / clipSpeed(item)}
          />
          {/* Its file is gone. Says so on the clip rather than leaving a grey box the
              filmstrip will keep trying to decode - and names the fix, since replacing
              it keeps the trim, speed and grade already set on this clip. */}
          {item.missing && (
            <View style={styles.missingClip}>
              <MaterialIcons name="image-not-supported" size={14} color="#ff6b6b" />
              <Text style={styles.missingClipText} numberOfLines={2}>File gone{'\n'}Tap Replace</Text>
            </View>
          )}
          {idx === 0 && (
            <View style={styles.coverBadge}>
              <MaterialIcons name="edit" size={9} color="#fff" />
              <Text style={styles.coverText}>Cover</Text>
            </View>
          )}
          {item.muted && (
            <View style={styles.mutedBadge}>
              <MaterialIcons name="volume-off" size={10} color="#fff" />
            </View>
          )}
          {item.speed && item.speed !== 1 && (
            <View style={styles.speedBadge}>
              <Text style={styles.speedBadgeText}>{item.speed}x</Text>
            </View>
          )}
          <View style={styles.clipBottom}>
            <Text style={styles.clipDuration}>
              {length.toFixed(1)}s
            </Text>
          </View>
          {selected && (
            <TouchableOpacity style={styles.clipRemove} onPress={() => onPressRemove(item.key)}>
              <MaterialIcons name="close" size={11} color="#fff" />
            </TouchableOpacity>
          )}
        </Animated.View>
      </TouchableOpacity>
      {/* Outside the press target rather than inside it: a PanResponder nested in a
          TouchableOpacity has to win the touch back from it on every grab, and losing
          that race once means a trim that selects the clip instead of trimming it. */}
      {selected && (
        <React.Fragment>
          <View {...leftTrim.panHandlers} style={[styles.trimHandle, { left: 0 }]}>
            <View style={styles.trimGrip} />
          </View>
          <View {...rightTrim.panHandlers} style={[styles.trimHandle, { right: 0 }]}>
            <View style={styles.trimGrip} />
          </View>
        </React.Fragment>
      )}
    </View>
  );
}

const ClipsRow = React.memo(function ClipsRow({ clipsComputed, selectedKey, onPressClip, onLongPressClip, onPressRemove, onPressTransition, onPressAdd, onTrimEnd }) {
  // With nothing on the row the slot sits at its head, in the flow, where it lines up
  // under the playhead with the empty-state button on every aux row. Once there is a
  // clip that place belongs to the footage, and the pinned one in the rail takes over -
  // which is why the rail does not draw its own while this is showing.
  if (clipsComputed.length === 0) {
    return (
      <TouchableOpacity style={styles.addClipBtn} onPress={onPressAdd} accessibilityLabel="Add clip">
        <MaterialIcons name="add" size={22} color="#fff" />
      </TouchableOpacity>
    );
  }
  return (
    <View style={styles.clipRowInner}>
      {clipsComputed.map(({ item, idx, width, length }) => (
        <TimelineClip
          key={item.key}
          item={item}
          idx={idx}
          width={width}
          length={length}
          selected={item.key === selectedKey}
          onPressClip={onPressClip}
          onLongPressClip={onLongPressClip}
          onPressRemove={onPressRemove}
          onTrimEnd={onTrimEnd}
        />
      ))}
      {/* Seams and transition markers ride on a layer above the clips instead of
          sitting between them. A real gap in the flow would be pixels that are not
          time, and every clip after it would be drawn that much later than the moment
          it plays at - the fault the fixed-width chips had, reintroduced once per
          join. Drawn on top, a seam costs two pixels off the face of each neighbour
          and nothing off its length.

          It is one layer over the whole row rather than a marker parented to each
          clip because siblings paint in the order they are written: a marker centred
          on a join and owned by the clip on its left is drawn before, and therefore
          under, the clip on its right. */}
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        {clipsComputed.map(({ item, idx, isLast, endX }) => {
          if (isLast) return null;
          const next = clipsComputed[idx + 1];
          // The right trim handle of the clip on the left lands on this same join, so
          // the marker stands down while either neighbour is selected rather than
          // covering a handle it would also steal the touch from.
          const busy = item.key === selectedKey || next.item.key === selectedKey;
          return (
            <React.Fragment key={item.key}>
              <View style={[styles.clipSeam, { left: endX - CLIP_SEAM_W / 2 }]} pointerEvents="none" />
              {!busy && (
                <TouchableOpacity
                  style={[
                    styles.transitionBtn,
                    { left: endX - TRANSITION_BTN / 2 },
                    hasTransition(item.transition) && styles.transitionBtnSet,
                  ]}
                  onPress={() => onPressTransition(item.key)}
                  accessibilityLabel="Transition">
                  {/* A plus invites you to add one; once there IS one, the marker
                      has to say so - it filled teal for every clip before, including
                      the ones with nothing on them, so adding a transition changed
                      nothing on screen. */}
                  {hasTransition(item.transition) ? (
                    <MaterialIcons name="compare-arrows" size={13} color="#04211f" />
                  ) : (
                    <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }}>+</Text>
                  )}
                </TouchableOpacity>
              )}
            </React.Fragment>
          );
        })}
      </View>
    </View>
  );
});

// Mirroring is one of the few looks the canvas can reproduce exactly rather than
// approximate: a negative scale on an axis is what hflip and vflip do in the export,
// so what is previewed is what is rendered.
function flipTransform(item) {
  if (!item || (!item.flipH && !item.flipV)) return null;
  return { transform: [{ scaleX: item.flipH ? -1 : 1 }, { scaleY: item.flipV ? -1 : 1 }] };
}

// A clip's length on the timeline. trimStart/trimEnd are absolute offsets into
// the source file, so a trimmed or split clip occupies trimEnd - trimStart on
// the timeline. Counting trimEnd alone stretches every later clip boundary past
// where it is actually drawn, and the canvas then shows the wrong clip for the
// scroll position.
// A clip's length ON THE TIMELINE, which is not the length of the footage it shows:
// at 2x, ten seconds of source occupies five. Everything positional reads this - the
// clip's width, the playhead's mapping, where every later clip and aux row starts -
// so leaving speed out of it put a sped-up clip out of step with its own audio and
// with the frame under the playhead.
//
// A still has no motion to speed up, so its held duration is already timeline time.
function clipSpeed(item) {
  const s = Number(item.speed);
  return Number.isFinite(s) && s > 0 ? s : 1;
}

function clipLength(item) {
  if (item.type === 'image') return item.duration || 3;
  const end = item.trimEnd ?? item.sourceDuration ?? 0;
  return Math.max(0, end - (item.trimStart ?? 0)) / clipSpeed(item);
}

export default function EditVideoScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const videoRef = useRef(null);

  // Media items
  const [items, setItems] = useState([]);
  const [selectedKey, setSelectedKey] = useState(null);
  const [selectedAudioTrackKey, setSelectedAudioTrackKey] = useState(null);

  // Playback
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0); // seconds
  const [duration, setDuration] = useState(0);
  const [timelineLeadW, setTimelineLeadW] = useState(0);
  const sheetInset = useSheetInset();
  const rowLeadW = timelineLeadW + SCRUBBER_LINE_W + SCRUBBER_GAP;
  const playTimer = useRef(null);
  const timelineScrollRef = useAnimatedRef();
  const voiceoverScrollRef = useAnimatedRef();
  const musicScrollRef = useAnimatedRef();
  const textScrollRef = useAnimatedRef();
  const captionsScrollRef = useAnimatedRef();
  const rulerScrollRef = useAnimatedRef();
  const isUserScrubbing = useRef(false);
  const scrollXShared = useSharedValue(0);
  const lastScrubUpdateRef = useRef(0);
  const lastPlaybackPosUpdateRef = useRef(0);
  // Preview audio mixer state. Sounds are keyed by track key; positionRef is the
  // playhead at frame resolution (the `position` state is throttled to ~25/sec,
  // which is too coarse to seek audio against).
  const audioSoundsRef = useRef(new Map());
  const positionRef = useRef(0);
  const audioTracksRef = useRef([]);
  const masterVolumeRef = useRef(1);
  const audioSyncBusy = useRef(false);
  const audioShouldPlayRef = useRef(false);
  // Where the video decoder actually is, expressed as a timeline second, plus
  // the wall-clock instant that reading was taken. Null whenever there is no
  // trustworthy reading - paused, mid-seek, or no video clip under the
  // playhead - and the timeline falls back to its own wall clock.
  const videoClockRef = useRef(null);
  // A seek we issued and are still waiting to see land. Status updates that
  // arrive in the meantime still describe the pre-seek position, so they are
  // dropped rather than adopted as the clock.
  const videoSeekTargetRef = useRef(null);
  const seekVideoToRef = useRef(null);
  useAnimatedReaction(
    () => scrollXShared.value,
    (x) => {
      scrollTo(timelineScrollRef, x, 0, false);
      scrollTo(voiceoverScrollRef, x, 0, false);
      scrollTo(musicScrollRef, x, 0, false);
      scrollTo(textScrollRef, x, 0, false);
      scrollTo(captionsScrollRef, x, 0, false);
      // The ruler rides the same shared value as every row, so a tick stays over
      // the frame it names no matter how the timeline got there.
      scrollTo(rulerScrollRef, x, 0, false);
    },
    []
  );

  // Upload/export
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');

  // Active bottom tab
  // null = the top-level strip is showing. A name = that tab's tools have the bar,
  // with a back chevron to return - the CapCut arrangement.
  const [activeTab, setActiveTab] = useState(null);

  // Text overlays
  const [textOverlays, setTextOverlays] = useState([]);
  const [showTextModal, setShowTextModal] = useState(false);
  const [editingText, setEditingText] = useState(null);
  const [selectedOverlayKey, setSelectedOverlayKey] = useState(null);
  // Which overlay is being typed into on the canvas. Separate from selection: an
  // overlay is selected to be moved and edited to be rewritten, and conflating
  // them would mean every tap-to-move opened the keyboard.
  const [inlineEditKey, setInlineEditKey] = useState(null);
  const [textInput, setTextInput] = useState('');
  const [textColor, setTextColor] = useState('#fff');
  const [recentColors, setRecentColors] = useState([]);
  // A drag on the colour plane must not double as a scroll of the sheet holding it.
  const [colorDragging, setColorDragging] = useState(false);
  const [textFont, setTextFont] = useState('Default');
  const [textSize, setTextSize] = useState(18);
  const [textBackground, setTextBackground] = useState(DEFAULT_TEXT_BACKGROUND);
  const setBackgroundField = useCallback(
    (field, value) => setTextBackground(prev => ({ ...prev, [field]: value })),
    []
  );

  // Audio
  const [audioTracks, setAudioTracks] = useState([]);
  const [masterVolume, setMasterVolume] = useState(1);
  const [showVolumeModal, setShowVolumeModal] = useState(false);
  const [showClipVolumeModal, setShowClipVolumeModal] = useState(false);
  const [fadeSheetKey, setFadeSheetKey] = useState(null);
  const [slipSheetKey, setSlipSheetKey] = useState(null);
  const [audioSheetKey, setAudioSheetKey] = useState(null);
  const [audioLoadStatus, setAudioLoadStatus] = useState({});   // key -> loading | ready | failed

  // Effects
  const [selectedFilter, setSelectedFilter] = useState('None');
  const [selectedSpeed, setSelectedSpeed] = useState(1);
  const [selectedTransition, setSelectedTransition] = useState('None');
  const [brightness, setBrightness] = useState(1);

  // Voiceover
  const [showVoiceoverModal, setShowVoiceoverModal] = useState(false);
  // Beside the sheet it opens from, not beside the preview code it replaced - the
  // declaration lived in that block and went with it when the block was deleted.
  const { track } = useJobs();
  const [showVoicePicker, setShowVoicePicker] = useState(false);
  const [voiceoverTab, setVoiceoverTab] = useState('generate'); // 'generate' | 'file'
  const [voiceoverScript, setVoiceoverScript] = useState('');
  const [voiceId, setVoiceId] = useState('gtts-us');
  const [voiceoverTracks, setVoiceoverTracks] = useState([]);
  const [generatingVoiceover, setGeneratingVoiceover] = useState(false);

  // Waveforms
  const [waveformCache, setWaveformCache] = useState({});

  // Music library
  const [showMusicModal, setShowMusicModal] = useState(false);
  const [musicTab, setMusicTab] = useState('library'); // 'library' | 'device'
  const [musicMood, setMusicMood] = useState('All');
  const [musicTempo, setMusicTempo] = useState('Any');
  const [musicLibraryTracks, setMusicLibraryTracks] = useState([]);
  const [musicLoading, setMusicLoading] = useState(false);
  const musicPreviewSoundRef = useRef(null);
  // Bumped by every stop. An audition load that finishes after its token went
  // stale is unloaded instead of adopted - see previewMusicTrack.
  const musicPreviewTokenRef = useRef(0);
  const [musicPreviewPlayingId, setMusicPreviewPlayingId] = useState(null);

  // Transition picker
  const [showTransitionModal, setShowTransitionModal] = useState(false);
  const [applyAllPrompt, setApplyAllPrompt] = useState(null);
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  const [showMotionSheet, setShowMotionSheet] = useState(false);
  const [showChromaSheet, setShowChromaSheet] = useState(false);
  // Which object the audio-effects sheet is editing: null (closed), 'clip', or a track
  // key. Not a boolean plus a separate "current target" - two pieces of state for one
  // question drift, and the sheet then edits whatever was selected last rather than
  // what was tapped.
  const [audioFxTarget, setAudioFxTarget] = useState(null);
  const [showTransformSheet, setShowTransformSheet] = useState(false);
  const [showTransparencySheet, setShowTransparencySheet] = useState(false);
  const [showLayersSheet, setShowLayersSheet] = useState(false);
  const [showMaskSheet, setShowMaskSheet] = useState(false);
  const [showEffectSheet, setShowEffectSheet] = useState(false);
  const [showAdjustSheet, setShowAdjustSheet] = useState(false);
  const [showAspectSheet, setShowAspectSheet] = useState(false);
  const [showStickerSheet, setShowStickerSheet] = useState(false);
  const [showBackgroundSheet, setShowBackgroundSheet] = useState(false);
  const [showCropSheet, setShowCropSheet] = useState(false);
  const [cropSize, setCropSize] = useState(null);
  const [background, setBackground] = useState(DEFAULT_BACKGROUND);

  // How the canvas draws a clip has to match how the export will frame it, or Fit is
  // a setting the user cannot see the effect of until the file comes back.
  const bg = useMemo(() => normaliseBackground(background), [background]);
  const clipResize = bg.fit === 'fit' ? 'contain' : 'cover';
  const canvasBg = bg.fit === 'fit' && bg.type === 'colour' ? bg.colour : '#111';
  const [aspectRatio, setAspectRatio] = useState(DEFAULT_ASPECT);

  // The frame the project is actually being composed in. Everything that positions an
  // overlay works in percentages of THIS, so a caption stays where it was put when the
  // shape changes rather than sliding off the new edge.
  const frame = useMemo(
    () => fitAspect(aspectRatio, PREVIEW_MAX_W, PREVIEW_MAX_H),
    [aspectRatio]
  );
  // Nothing may be written to the draft until the existing one has been read and
  // answered. Autosaving before that would immediately overwrite the saved project
  // with this screen's empty initial state - the draft would be destroyed by the very
  // mount that was supposed to offer it back.
  const [draftChecked, setDraftChecked] = useState(false);
  const [draftOffer, setDraftOffer] = useState(null);
  const [transitionTargetKey, setTransitionTargetKey] = useState(null);

  // Undo/Redo history
  const [history, setHistory] = useState([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // Overlays
  const [overlays, setOverlays] = useState([]);

  // Captions
  const [showCaptionModal, setShowCaptionModal] = useState(false);
  const [captionScript, setCaptionScript] = useState('');
  const [captionStyle, setCaptionStyle] = useState(DEFAULT_CAPTION_STYLE_ID);
  // null means "whatever the chosen style says". A style carries its own colour,
  // so an override has to stay distinguishable from a colour that merely happens
  // to equal one - otherwise switching style could never move the colour again.
  const [captionColor, setCaptionColor] = useState(null);

  // Split/trim
  const [showTrimModal, setShowTrimModal] = useState(false);
  const [trimItem, setTrimItem] = useState(null);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(10);

  // Resolution
  const [resolution, setResolution] = useState('1080p');
  const [showResModal, setShowResModal] = useState(false);

  const selectedItem = items.find(i => i.key === selectedKey);
  // Reasonable positioning bounds for audio track drag/trim - based on total
  // clip duration, with a floor so short/empty timelines still give tracks
  // room to be dragged around rather than being pinned to a near-zero width.
  const timelineContentWidth = Math.max(duration * PIXELS_PER_SECOND, 300);
  // A clip is drawn as wide as the time it covers, at the same pixels-per-second the
  // scroll offset is read back through - so the frame under the playhead really is the
  // frame being played, and a clip boundary lines up with the audio, text and caption
  // rows, which have always been positioned by time. Nothing else in this row may take
  // horizontal space: a fixed-size chip, a margin or an inline transition button all
  // push every later clip out of time by their own width, and the error accumulates.
  // Where each timeline row sits and how tall it is, so the floating add button for
  // that row can be centred on it. Measured rather than computed from a table of
  // heights: a row is as tall as whatever chip is on it, and a text chip is not the
  // same height as an audio block, so a table would be right until someone restyled
  // one row and then silently wrong for every row below it.
  const [rowFrames, setRowFrames] = useState({});
  const rowLayout = useMemo(() => {
    const make = (key) => (e) => {
      const { y, height } = e.nativeEvent.layout;
      setRowFrames(prev => {
        const cur = prev[key];
        if (cur && cur.y === y && cur.height === height) return prev;
        return { ...prev, [key]: { y, height } };
      });
    };
    return {
      clips: make('clips'),
      voiceover: make('voiceover'),
      music: make('music'),
      text: make('text'),
      captions: make('captions'),
    };
  }, []);

  const clipsComputed = useMemo(() => {
    let x = 0;
    return items.map((item, idx) => {
      const length = clipLength(item);
      const width = Math.max(CLIP_MIN_W, length * PIXELS_PER_SECOND);
      x += width;
      return {
        item,
        idx,
        isLast: idx === items.length - 1,
        length,
        width,
        // Where this clip's right edge falls, so a seam can be drawn on the join
        // without asking the layout where anything ended up.
        endX: x,
      };
    });
  }, [items]);
  const onPressClip = useCallback((key) => {
    setSelectedKey(prevKey => prevKey === key ? null : key);
  }, []);
  const onPressClipTransition = useCallback((key) => {
    setTransitionTargetKey(key);
    setShowTransitionModal(true);
  }, []);
  const manualTextOverlays = useMemo(() => textOverlays.filter(t => !t.isAutoCaption), [textOverlays]);
  const onPressTextChip = useCallback((t) => {
    setEditingText(t); setTextInput(t.text); setTextColor(t.color); setTextFont(t.font); setTextSize(t.size); setTextBackground(t.background || DEFAULT_TEXT_BACKGROUND); setShowTextModal(true);
  }, []);
  const onPressAddText = useCallback(() => {
    setEditingText(null); setTextInput(''); setShowTextModal(true);
  }, []);
  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(RECENT_COLORS_KEY)
      .then(raw => {
        if (!alive || !raw) return;
        const list = JSON.parse(raw);
        if (Array.isArray(list)) setRecentColors(list.map(normalizeHex).filter(Boolean).slice(0, MAX_RECENT_COLORS));
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);
  // Only colours the picker settled on are recorded, not every frame of a drag,
  // and never a preset - those already have a permanent slot in the row.
  const rememberColor = useCallback((c) => {
    const norm = normalizeHex(c);
    if (!norm || TEXT_COLORS.some(p => normalizeHex(p) === norm)) return;
    setRecentColors(prev => {
      const next = [norm, ...prev.filter(x => x !== norm)].slice(0, MAX_RECENT_COLORS);
      AsyncStorage.setItem(RECENT_COLORS_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);
  const openCaptionModal = useCallback(() => setShowCaptionModal(true), []);
  const captionPreviewGroups = useMemo(() => {
    const WORDS_PER_GROUP = 6;
    const captions = textOverlays.filter(t => t.isAutoCaption).slice().sort((a, b) => a.startTime - b.startTime);
    const groups = [];
    let current = null;
    captions.forEach(c => {
      const wc = c.text.trim().split(/\s+/).length;
      if (!current || current.wordCount + wc > WORDS_PER_GROUP) {
        current = { key: 'capgroup_' + c.key, text: c.text, wordCount: wc };
        groups.push(current);
      } else {
        current.text += ' ' + c.text;
        current.wordCount += wc;
      }
    });
    return groups;
  }, [textOverlays]);

  // Compute total duration
  useEffect(() => {
    const total = items.reduce((acc, i) => acc + clipLength(i), 0);
    setDuration(total);
  }, [items]);

  // Sync timeline scroll to playback position (CapCut-style fixed playhead).
  // Skipped during active playback and active scrubbing: the RAF tick loop
  // below drives scrollXShared directly every frame in that case.
  useEffect(() => {
    if (isUserScrubbing.current || isPlaying) return;
    scrollXShared.value = position * PIXELS_PER_SECOND;
  }, [position]);

  // Playback timer (requestAnimationFrame-driven, real elapsed time).
  // Scroll is updated directly via scrollXShared every frame (UI thread,
  // cheap) so it stays smooth at 60fps regardless of React render cost.
  // setPosition (React state) is throttled separately since it triggers a
  // full component re-render - the visible scroll motion doesn't depend on it.
  useEffect(() => {
    if (isPlaying) {
      let lastTs = null;
      let localPos = position;
      const tick = (ts) => {
        if (lastTs === null) lastTs = ts;
        const deltaSec = (ts - lastTs) / 1000;
        lastTs = ts;
        localPos += deltaSec;
        // Follow the decoder's own clock while a video clip is under the
        // playhead. The frame on screen is wherever the decoder actually got
        // to - after a keyframe-snapped seek, a buffering stall, or a source
        // slower to decode than real time, that is not where a wall clock says
        // it should be. Dragging the video to the wall clock (what the mixer
        // used to do) fights the decoder and re-seeks forever; moving the
        // timeline to the video instead makes the scroll show what the canvas
        // is showing, by construction.
        const vc = videoClockRef.current;
        if (vc) {
          const videoPos = vc.timelineSec + (Date.now() - vc.at) / 1000;
          const err = videoPos - localPos;
          // A large gap is a seek or a stall, so snap. A small one is ordinary
          // decoder jitter - ease it out so the scroll never visibly jerks.
          if (Math.abs(err) > 0.35) localPos = videoPos;
          else localPos += err * 0.1;
        }
        positionRef.current = localPos;
        if (localPos >= duration) {
          setIsPlaying(false);
          setPosition(0);
          return;
        }
        if (!isUserScrubbing.current) {
          scrollXShared.value = localPos * PIXELS_PER_SECOND;
        }
        // `position` is what the transition layers are drawn from, and at 40ms it
        // only moves 12 times across a half-second join - which is why transitions
        // looked steppy on real clips while the picker tiles, rendered at 20fps by
        // ffmpeg with real interpolation, looked smooth. Inside a join the budget
        // drops to a frame, so the motion is drawn at the display's rate; everywhere
        // else it stays at 40ms, because a re-render of this screen is not cheap and
        // nothing outside a join needs more than 25 updates a second.
        // 1.5s: matches LOOKAHEAD, not WINDOW. The mount itself does not need 60fps
        // updates to happen promptly, but the animated blend inside the last 0.3s of
        // it does, and this one radius has to cover both - the cheap way to guarantee
        // that is to size it to the longer of the two.
        const nearJoin = joinTimesRef.current.some(j => Math.abs(localPos - j) <= 1.5);
        if (ts - lastPlaybackPosUpdateRef.current >= (nearJoin ? 16 : 40)) {
          lastPlaybackPosUpdateRef.current = ts;
          setPosition(localPos);
        }
        playTimer.current = requestAnimationFrame(tick);
      };
      playTimer.current = requestAnimationFrame(tick);
    } else {
      cancelAnimationFrame(playTimer.current);
    }
    return () => cancelAnimationFrame(playTimer.current);
  }, [isPlaying, duration]);

  // ---------------------------------------------------------------------------
  // Preview audio mixer
  //
  // The <Video> element only ever plays the clip under the playhead, so
  // voiceover and music tracks have to be driven separately: one expo-av Sound
  // per track, seeked to (trimStart + playhead - startOffset) and started when
  // the playhead enters the track's window. Without this the timeline scrolls
  // and the canvas plays but the aux rows are silent until export.
  // ---------------------------------------------------------------------------
  // Applies a real measured duration to a track. Never invents one: the track's
  // duration decides the window the mixer will play it in, so a wrong value
  // silences the track for the rest of the timeline. Unknown (null) means "play
  // to the file's natural end", which is always better than a guess.
  const applyTrackDuration = useCallback((trackKey, durationSec) => {
    if (!(durationSec > 0)) return;
    setAudioTracks(prev => prev.map(t => {
      if (t.key !== trackKey || t.sourceDuration === durationSec) return t;
      // Only move trimEnd if the user has not trimmed this track themselves.
      const untrimmed = t.trimEnd == null || t.trimEnd === t.sourceDuration;
      return {
        ...t,
        sourceDuration: durationSec,
        trimEnd: untrimmed ? durationSec : Math.min(t.trimEnd, durationSec),
      };
    }));
  }, []);

  useEffect(() => { audioTracksRef.current = audioTracks; }, [audioTracks]);
  useEffect(() => { masterVolumeRef.current = masterVolume; }, [masterVolume]);
  useEffect(() => { positionRef.current = position; }, [position]);

  useEffect(() => {
    Audio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: false, shouldDuckAndroid: false })
      .catch(() => {});
  }, []);

  // Load a Sound per track, and drop any whose source changed or went away.
  const audioSourceKey = useMemo(
    () => audioTracks.map(t => t.key + '|' + t.uri).join(','), [audioTracks]);
  useEffect(() => {
    const map = audioSoundsRef.current;
    const wanted = new Map(audioTracks.map(t => [t.key, t.uri]));
    for (const [key, entry] of Array.from(map.entries())) {
      if (wanted.get(key) !== entry.uri) {
        map.delete(key);
        entry.sound?.unloadAsync().catch(() => {});
      }
    }
    let cancelled = false;
    audioTracks.forEach(async (t) => {
      if (map.has(t.key)) return;
      map.set(t.key, { sound: null, uri: t.uri });   // claim the slot so we load once
      setAudioLoadStatus(prev => ({ ...prev, [t.key]: 'loading' }));
      try {
        const initialVolume = Math.max(0, Math.min(1, (t.volume ?? 1) * masterVolumeRef.current));
        // downloadFirst: true - a remote library track reports no duration, or a
        // streaming estimate, until it has actually been fetched. This Sound is
        // now the only thing that measures duration, so it has to wait for a
        // real answer rather than a partial one.
        const { sound, status } = await Audio.Sound.createAsync(
          { uri: t.uri }, { shouldPlay: false, volume: initialVolume }, null, true);
        if (cancelled || map.get(t.key)?.uri !== t.uri) { sound.unloadAsync().catch(() => {}); return; }
        map.set(t.key, { sound, uri: t.uri });
        setAudioLoadStatus(prev => ({ ...prev, [t.key]: 'ready' }));
        // The mixer's own Sound is the single source of truth for duration.
        // A separate probe Sound used to measure the same file in parallel; the
        // two raced to write sourceDuration/trimEnd (resizing the block under
        // the user), and unloading the probe mid-playback made expo-av drop
        // audio focus for the entire app - see the comment on syncPreviewAudio.
        let durationSec = status?.isLoaded && status.durationMillis > 0
          ? status.durationMillis / 1000 : null;
        for (let attempt = 0; durationSec === null && attempt < 10; attempt++) {
          await new Promise(r => setTimeout(r, 200));
          if (cancelled || map.get(t.key)?.sound !== sound) return;
          const s = await sound.getStatusAsync();
          if (s.isLoaded && s.durationMillis > 0) durationSec = s.durationMillis / 1000;
        }
        if (durationSec === null) {
          console.warn('Audio duration unavailable for', t.name, '- will play to natural end');
        }
        applyTrackDuration(t.key, durationSec);
      } catch (e) {
        map.delete(t.key);
        setAudioLoadStatus(prev => ({ ...prev, [t.key]: 'failed' }));
        console.warn('Preview audio load failed:', e?.message || e);
      }
    });
    return () => { cancelled = true; };
  }, [audioSourceKey, applyTrackDuration]);

  // Unload everything on unmount so sounds don't outlive the screen.
  useEffect(() => () => {
    const map = audioSoundsRef.current;
    map.forEach(entry => entry.sound?.unloadAsync().catch(() => {}));
    map.clear();
    musicPreviewTokenRef.current += 1;
    musicPreviewSoundRef.current?.unloadAsync().catch(() => {});
    musicPreviewSoundRef.current = null;
  }, []);

  const syncPreviewAudio = useCallback(async () => {
    if (audioSyncBusy.current) return;
    audioSyncBusy.current = true;
    try {
      for (const track of audioTracksRef.current) {
        // A sync pass awaits several native calls, so the user can hit pause
        // half way through it. Without this check the pass would go on to start
        // a sound the pause had already stopped, leaving it playing untracked.
        if (!audioShouldPlayRef.current) break;
        const entry = audioSoundsRef.current.get(track.key);
        if (!entry?.sound) continue;
        // Read the playhead per track rather than once at the top of the pass:
        // each track costs a native round-trip, so a snapshot is already stale
        // by the time targetMs is derived from it further down. Against a 250ms
        // drift threshold on a 200ms tick that stale value reads as drift, and
        // the correction seeks the sound backwards over and over.
        const pos = positionRef.current;
        const trimStart = track.trimStart ?? 0;
        const known = track.trimEnd ?? track.sourceDuration;
        // Duration is fetched asynchronously; until it lands, let the track run
        // to its natural end rather than treating it as zero-length (silent).
        const dur = known != null ? known - trimStart : Infinity;
        const start = track.startOffset ?? 0;
        const inWindow = dur > 0 && pos >= start && pos < start + dur;
        try {
          const status = await entry.sound.getStatusAsync();
          if (!status.isLoaded) continue;
          if (!inWindow) {
            if (status.isPlaying) await entry.sound.pauseAsync();
            continue;
          }
          const targetMs = (trimStart + (pos - start)) * 1000;
          if (!status.isPlaying) {
            if (!audioShouldPlayRef.current) continue;
            await entry.sound.playFromPositionAsync(targetMs);
          } else if (Math.abs(status.positionMillis - targetMs) > 250) {
            await entry.sound.setPositionAsync(targetMs);   // drift correction
          }
        } catch (e) { /* sound can be unloaded mid-flight by an edit */ }
      }
      // expo-av pauses every player in the app whenever it lets go of audio
      // focus - another app taking it, a notification, or its own
      // abandonAudioFocusIfUnused(), which fires at the end of every setStatus
      // call and drops focus the moment no player happens to want it. The
      // <Video>'s shouldPlay prop is untouched by that, so React never resends
      // it and the preview stays silent while the timeline scrolls on. Sounds
      // recover on the next pass because the loop above restarts anything
      // in-window that stopped; this gives the video the same treatment.
      if (audioShouldPlayRef.current && videoRef.current) {
        const clip = previewClipRef.current;
        try {
          const vs = await videoRef.current.getStatusAsync();
          if (vs.isLoaded) {
            // Ordinary drift is no longer corrected here. The timeline now
            // follows the decoder (see the RAF loop), so seeking the canvas to
            // match a wall clock would fight it - and on Android a seek lands
            // on the nearest keyframe, which is itself off target, so the
            // correction re-fires every pass and never converges. That is what
            // left the canvas jumping while the scroll ran on regardless.
            // What still needs a seek is a position outside the clip's own
            // window: a source that loaded at 0 for a trimmed clip, or one
            // that ran past trimEnd into footage this clip does not cover.
            if (clip && clip.clipStart != null) {
              const inClip = vs.positionMillis / 1000 - clip.trimStart;
              if (inClip < -0.5 || inClip > clip.clipLen + 0.5) {
                seekVideoToRef.current?.(positionRef.current);
              }
            }
            const atEnd = vs.durationMillis != null && vs.positionMillis >= vs.durationMillis - 100;
            if (vs.shouldPlay === false && !vs.didJustFinish && !atEnd) {
              await videoRef.current.playAsync();
            }
          }
        } catch (e) { /* no video loaded, or it was swapped mid-flight */ }
      }
    } finally {
      audioSyncBusy.current = false;
      // Anything this pass started after a pause slipped in gets stopped here.
      if (!audioShouldPlayRef.current) pausePreviewAudioRef.current?.();
    }
  }, []);

  const pausePreviewAudio = useCallback(() => {
    audioSoundsRef.current.forEach(entry => {
      entry.sound?.pauseAsync().catch(() => {});
    });
  }, []);
  const pausePreviewAudioRef = useRef(null);
  pausePreviewAudioRef.current = pausePreviewAudio;

  useEffect(() => {
    audioShouldPlayRef.current = isPlaying;
    if (!isPlaying) { pausePreviewAudio(); return; }
    syncPreviewAudio();
    const id = setInterval(syncPreviewAudio, 200);
    return () => clearInterval(id);
  }, [isPlaying, syncPreviewAudio, pausePreviewAudio]);

  // The gain a track's fades imply at a given moment. Returns 1 outside them, so a
  // track with no fade set is untouched by this.
  const fadeGainAt = useCallback((t, timelineSec) => {
    const len = trackLength(t);
    if (!len) return 1;
    const start = t.startOffset ?? 0;
    const into = timelineSec - start;
    if (into < 0 || into > len) return 1;
    const fin = Math.max(0, Math.min(Number(t.fadeIn) || 0, len));
    const fout = Math.max(0, Math.min(Number(t.fadeOut) || 0, len));
    let g = 1;
    if (fin > 0 && into < fin) g = Math.min(g, into / fin);
    if (fout > 0 && into > len - fout) g = Math.min(g, (len - into) / fout);
    return Math.max(0, Math.min(1, g));
  }, [trackLength]);

  // Live volume: master scales every track, so the slider is audible while the
  // preview is running instead of only mattering at export. The fade rides on top of
  // it for the same reason - a fade you can only hear after exporting is a fade you
  // have to guess at, and this runs on every position tick anyway.
  useEffect(() => {
    audioTracks.forEach(t => {
      const entry = audioSoundsRef.current.get(t.key);
      const vol = Math.max(0, Math.min(1, (t.volume ?? 1) * masterVolume * fadeGainAt(t, position)));
      entry?.sound?.setVolumeAsync(vol).catch(() => {});
    });
  }, [audioTracks, masterVolume, position, fadeGainAt]);

  // How long a track occupies the timeline. trimEnd may be unset on a track whose
  // duration never landed, in which case there is no length to fade against and the
  // fade sheet says so rather than offering a slider with nothing behind it.
  const trackLength = useCallback((t) => {
    if (!t) return 0;
    const end = t.trimEnd ?? t.sourceDuration ?? null;
    if (end == null) return 0;
    return Math.max(0, end - (t.trimStart ?? 0));
  }, []);

  const setTrackField = useCallback((key, patch) => {
    setAudioTracks(prev => prev.map(t => (t.key === key ? { ...t, ...patch } : t)));
  }, []);

  // Look for unfinished work, once, on mount.
  useEffect(() => {
    let alive = true;
    (async () => {
      const raw = await loadDraft();
      if (!alive) return;
      if (!raw) { setDraftChecked(true); return; }
      // Check the media is still there before offering it back. A draft whose files
      // the OS reclaimed restores as a timeline of broken clips, which looks like the
      // app losing the work rather than the work already being gone.
      const { draft, missing, total, allGone } = await validateDraft(raw);
      if (!alive) return;
      if (allGone) {
        // Nothing left to restore. Offering a project of holes is worse than a clean
        // start, and keeping it would offer the same holes on every launch.
        await clearDraft();
        setDraftChecked(true);
        return;
      }
      setDraftOffer({ ...draft, missingCount: missing, mediaTotal: total });
    })();
    return () => { alive = false; };
  }, []);

  const restoreDraft = useCallback((draft) => {
    setItems(draft.items || []);
    setAudioTracks(draft.audioTracks || []);
    setTextOverlays(draft.textOverlays || []);
    setOverlays(draft.overlays || []);
    if (draft.masterVolume != null) setMasterVolume(draft.masterVolume);
    if (draft.captionStyle) setCaptionStyle(draft.captionStyle);
    if (draft.aspectRatio) setAspectRatio(draft.aspectRatio);
    if (draft.background) setBackground(draft.background);
    setDraftOffer(null);
    setDraftChecked(true);
  }, []);

  const discardDraft = useCallback(() => {
    clearDraft();
    setDraftOffer(null);
    setDraftChecked(true);
  }, []);

  // With the draft answered, anything in permanent storage the project cannot reach
  // is genuinely orphaned - a deleted clip, an abandoned draft, a Start fresh. Swept
  // here rather than when a clip is removed, because undo can bring one back and
  // deleting its file on removal would restore a clip pointing at nothing.
  useEffect(() => {
    if (!draftChecked) return;
    (async () => {
      const referenced = draftUris({ items, audioTracks, textOverlays, overlays });

      // Whatever a draft ON DISK still points at is never orphaned, even when the
      // timeline in front of us is empty.
      //
      // Without this the sweep is a one-way door. It deletes every file the CURRENT
      // project does not reference, so any path that reaches draftChecked with an
      // empty timeline wipes the media directory - and a draft whose files are gone
      // validates as allGone on the next launch and is cleared for good. The work is
      // then unrecoverable, from a sweep that was only ever meant to reclaim space.
      //
      // Reading the draft back costs one AsyncStorage get on a screen that has just
      // done several. Being wrong here costs someone their project.
      let protectedUris = referenced;
      try {
        const saved = await loadDraft();
        if (saved) protectedUris = [...referenced, ...draftUris(saved)];
      } catch (e) {
        // Could not read the draft, so cannot know what it needs. Skip the sweep
        // rather than guess: unreclaimed disk is a cost, a deleted project is not.
        return;
      }

      const { removed, bytes } = await sweepUnreferenced(protectedUris);
      if (removed) console.log(`[media] swept ${removed} orphaned file(s), ${Math.round(bytes / 1024)}KB`);
    })();
    // Deliberately once, on the launch pass. Re-running it as the timeline changes
    // would race the background copies that patch a clip's uri moments after it is
    // added, and delete the file that copy had just written.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftChecked]);

  // Whether this session has ever had a clip on the timeline. See the empty check
  // below - it is the difference between a project the user cleared and a screen that
  // simply opened with nothing on it.
  const hadItemsRef = useRef(false);

  // Autosave. Debounced because a trim drag commits on release and a slider does not,
  // and writing the whole project to disk on every keystroke of a caption would be
  // felt on the JS thread this screen already shares with playback.
  useEffect(() => {
    if (!draftChecked) return undefined;
    const t = setTimeout(() => {
      if (items.length === 0) {
        // An empty timeline is only worth clearing the draft for if the user EMPTIED
        // it. Arriving empty is a different thing entirely, and treating the two the
        // same is how a saved project gets deleted 900ms after a screen mounts with
        // nothing on it - silently, and with no way back.
        //
        // hadItems is set the moment a clip exists this session, so "they removed the
        // last clip" is distinguishable from "there was never one here". Never having
        // had a clip leaves the draft exactly where it is, and Start fresh still
        // clears it explicitly through discardDraft.
        if (hadItemsRef.current) clearDraft();
        return;
      }
      hadItemsRef.current = true;
      saveDraft({ items, audioTracks, textOverlays, overlays, masterVolume, captionStyle, aspectRatio, background });
    }, 900);
    return () => clearTimeout(t);
  }, [draftChecked, items, audioTracks, textOverlays, overlays, masterVolume, captionStyle, aspectRatio, background]);

  // A finished video sent here by "Use" on My Videos. It arrives as a local file that
  // MyVideosScreen has already fetched and measured, so it becomes an ordinary clip
  // and everything downstream - filmstrip, playback, trim, export - treats it exactly
  // like one picked from the gallery.
  //
  // Held until draftChecked, or it would be appended to an empty timeline and then
  // wiped by the restore that follows. The ref is what stops it being added again on
  // every re-render, since navigation params persist for the life of the screen.
  const usedVideoRef = useRef(null);
  useEffect(() => {
    if (!draftChecked) return;
    const incoming = route?.params?.useVideo;
    if (!incoming?.uri) return;
    if (usedVideoRef.current === incoming.uri) return;
    usedVideoRef.current = incoming.uri;

    const seconds = Number(incoming.seconds) > 0 ? Number(incoming.seconds) : null;
    const key = String(Date.now()) + '_used';
    const mediaId = newMediaId('clip');
    const item = {
      key,
      mediaId,
      naturalW: 0,
      naturalH: 0,
      uri: incoming.uri,
      type: 'video',
      fileName: incoming.fileName || ('tonefy_' + Date.now() + '.mp4'),
      duration: 3,
      sourceDuration: seconds,
      trimStart: 0,
      // Without a measured length this behaves like ImagePicker's no-duration case:
      // 3 seconds, with a right handle that will not extend. Better than pretending
      // to a length nothing has established.
      trimEnd: seconds || 3,
      volume: 1,
      speed: 1,
      filter: 'None',
      transition: 'none',
    };
    setItems(prev => {
      const next = [...prev, item];
      pushHistory(next);
      return next;
    });
    // Copies it out of cache into permanent storage, same as a picked clip - the OS
    // reclaims cache whenever it likes, and a draft pointing into it comes back broken.
    persistInto(setItems, key, mediaId, incoming.uri, 'mp4');
    // Cleared so going back and forward does not re-add it.
    navigation.setParams({ useVideo: undefined });
  }, [draftChecked, route?.params?.useVideo]);

  // "Add to Video" on the Audio Result screen. Same shape as the clip handler above -
  // held until draftChecked or the restore wipes it, and ref-guarded because nav params
  // outlive every re-render.
  //
  // Goes through addVoiceoverTrack rather than pushing onto audioTracks directly: that
  // is what tags the track, zeroes its offsets and calls attachAudioSource, and a second
  // copy of those four steps is how one of them ends up missing later.
  const usedVoiceoverRef = useRef(null);
  useEffect(() => {
    if (!draftChecked) return;
    const incoming = route?.params?.useVoiceover;
    if (!incoming?.uri) return;
    if (usedVoiceoverRef.current === incoming.uri) return;
    usedVoiceoverRef.current = incoming.uri;

    // Left as a remote URL on purpose: a GENERATED voiceover is durable on the backend
    // and already exempt from persistInto, exactly as the generate-voiceover path does
    // it. Only a voiceover the user PICKED is theirs to protect.
    addVoiceoverTrack({
      key: String(Date.now()) + '_audio',
      uri: incoming.uri,
      name: incoming.name || 'Generated voiceover',
      volume: 1,
    });
    navigation.setParams({ useVoiceover: undefined });
  }, [draftChecked, route?.params?.useVoiceover]); // eslint-disable-line react-hooks/exhaustive-deps

  const fmtTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  };

  // A picked file is added immediately with its cache path and copied into permanent
  // storage behind the user's back. Waiting for the copy before showing the clip would
  // put a multi-second pause in the picker for a video of any size; adding it now and
  // patching the path when the copy lands costs nothing visible, because the filmstrip
  // is keyed on mediaId rather than on the path.
  //
  // Failure is not fatal: persistMedia returns the original uri, so the clip still
  // plays from the cache for this session and is simply not protected from a sweep.
  const persistInto = useCallback((setList, key, mediaId, uri, kind) => {
    persistMedia(uri, mediaId, kind).then(next => {
      if (!next || next === uri) return;
      setList(prev => prev.map(x => (x.key === key && x.uri === uri ? { ...x, uri: next } : x)));
    });
  }, []);

  const pickMedia = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { showAlert('Permission needed','Allow access to photos/videos.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsMultipleSelection: true, quality: 0.8, selectionLimit: 20,
    });
    if (!result.canceled) {
      const picked = result.assets.map((a, idx) => ({
        key: String(Date.now()) + '_' + idx,
        // Identifies the FILE, not the clip: it survives the copy that changes `uri`,
        // and both halves of a split inherit it so they share one filmstrip.
        mediaId: newMediaId('clip'),
        // The source's real shape. The crop editor draws its rectangle over a frame at
        // this aspect, and a frame drawn to the wrong one puts the rectangle over the
        // wrong part of the picture.
        naturalW: a.width || 0,
        naturalH: a.height || 0,
        uri: a.uri,
        type: a.type === 'video' ? 'video' : 'image',
        fileName: a.fileName || ('media_' + Date.now() + '_' + idx + '.' + (a.type === 'video' ? 'mp4' : 'jpg')),
        duration: 3,
        sourceDuration: a.duration ? a.duration / 1000 : null,
        trimStart: 0,
        trimEnd: a.duration ? a.duration / 1000 : 3,
        volume: 1,
        speed: 1,
        filter: 'None',
        transition: 'none',
      }));
      setItems(prev => {
        const next = [...prev, ...picked];
        pushHistory(next);
        return next;
      });
      picked.forEach(it => persistInto(setItems, it.key, it.mediaId,
        it.uri, it.type === 'video' ? 'mp4' : 'jpg'));
    }
  }, []);

  // Swap the footage under the selected clip, keeping its place on the timeline.
  const replaceSelectedClip = useCallback(async () => {
    if (!selectedKey) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { showAlert('Permission needed','Allow access to photos/videos.'); return; }
    let result;
    try {
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All, quality: 0.8,
      });
    } catch (err) {
      // A picker that throws used to reject into nothing, so the tool looked inert.
      showAlert('Could not open your library', String(err?.message || err));
      return;
    }
    if (result.canceled || !result.assets?.length) return;
    const a = result.assets[0];
    const isVideo = a.type === 'video';
    const reported = a.duration ? a.duration / 1000 : null;

    const replacementId = newMediaId('clip');
    const next = items.map(i => (i.key !== selectedKey ? i : {
      ...i,
      // A different file behind the same clip, so a different media id - otherwise the
      // new footage would be drawn with the old one's cached filmstrip.
      mediaId: replacementId,
      naturalW: a.width || 0,
      naturalH: a.height || 0,
      // A different picture is not cropped the way the last one was.
      crop: null,
      // Whatever was wrong with the old file is not wrong with this one.
      missing: false,
      uri: a.uri,
      type: isVideo ? 'video' : 'image',
      fileName: a.fileName || ('media_' + Date.now() + '.' + (isVideo ? 'mp4' : 'jpg')),
      sourceDuration: reported,
      // An image is held for a set time rather than trimmed, and that time is a
      // property of the slot on the timeline, not of the file in it - so unlike the
      // in/out points below it survives the swap. It still has to be defined, or a
      // video replaced by an image lands on clipLength's bare 3s fallback.
      duration: i.duration || 3,
      // In and out points are offsets into a file, so they mean nothing once the file
      // underneath them changes. Carrying them over would open the new clip on a
      // window into footage that may be shorter than where the old one ended.
      trimStart: 0,
      trimEnd: reported ?? 3,
    }));
    // Replacing a clip destroys the outgoing footage's place in the project, and
    // nothing else on screen holds it. Going through history rather than straight to
    // setItems is what makes the undo button in the header apply to this.
    pushHistory(next);
    persistInto(setItems, selectedKey, replacementId, a.uri, isVideo ? 'mp4' : 'jpg');

    // ImagePicker reports no duration for a lot of phone-camera footage, and the 3s
    // fallback above would hold a long take at three seconds with no way to recover
    // it - the trim handle refuses to extend past a length nothing has measured.
    // Measuring costs a load, so the swap has already landed and this patches the
    // length in behind it rather than leaving the user on a frozen picker.
    if (isVideo && !reported) {
      const measured = await measureVideoDuration(a.uri);
      if (measured) {
        setItems(prev => prev.map(i => (
          // Only the clip this call replaced, and only while it still carries the
          // placeholder length: the measurement is in flight for long enough to trim,
          // replace again, or undo, and none of those should be quietly overwritten.
          i.key === selectedKey && i.uri === a.uri
            && i.sourceDuration == null && i.trimStart === 0 && i.trimEnd === 3
            ? { ...i, sourceDuration: measured, trimEnd: measured }
            : i
        )));
      }
    }
  }, [selectedKey, items]);

  // A copy directly after the original, carrying its trim, speed, volume and grade -
  // duplicating a clip you have already worked on and getting back an unedited one
  // would make the tool useless for the case it exists for.
  const duplicateSelectedClip = useCallback(() => {
    if (!selectedKey) return;
    const idx = items.findIndex(i => i.key === selectedKey);
    if (idx < 0) return;
    const copy = {
      ...items[idx],
      key: `${items[idx].key}_copy${Date.now()}`,
      // The original keeps the transition on its right edge; the copy is inserted at
      // that join, so the transition now belongs to the copy's edge instead.
      transition: items[idx].transition,
    };
    const next = [...items];
    next.splice(idx + 1, 0, copy);
    pushHistory(next);
  }, [items, selectedKey]);

  const confirmDeleteSelectedClip = useCallback(() => {
    if (!selectedKey) return;
    showAlert('Delete clip?', 'It will be removed from the timeline.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          const next = items.filter(i => i.key !== selectedKey);
          pushHistory(next);
          setSelectedKey(null);
        },
      },
    ]);
  }, [items, selectedKey]);

  const removeItem = useCallback((key) => {
    setItems(prev => prev.filter(i => i.key !== key));
    setSelectedKey(prevKey => prevKey === key ? null : prevKey);
  }, []);

  // The nearest beat to a timeline second, across every track that has been analysed,
  // or null if none is close enough.
  //
  // Beats are stored against the SOURCE FILE, so each one has to be mapped through the
  // track's own placement to become a timeline second: startOffset moves the whole track
  // and trimStart says which part of the file the block begins at. Reading the raw beat
  // time would work only for an untrimmed track sitting at 0:00.
  const BEAT_SNAP = 0.12;
  function nearestBeat(t) {
    let best = null, bestD = BEAT_SNAP;
    const consider = (b, off) => {
      const d = Math.abs(b + off - t);
      if (d < bestD) { bestD = d; best = b + off; }
    };
    for (const track of audioTracks) {
      if (!track.beats?.length) continue;
      // startOffset moves the whole track; trimStart says where in the file it begins.
      const off = (track.startOffset || 0) - (track.trimStart || 0);
      for (const b of track.beats) consider(b, off);
    }
    // A clip's beats map differently and the difference is not cosmetic: a clip has no
    // startOffset at all - where it sits is the running sum of every length before it -
    // so reusing the track mapping would put every clip's beats at 0:00.
    let clipStart = 0;
    for (const item of items) {
      const len = clipLength(item);
      if (item.beats?.length) {
        const off = clipStart - (item.trimStart || 0);
        for (const b of item.beats) consider(b, off);
      }
      clipStart += len;
    }
    return best;
  }

  function splitAtPlayhead() {
    if (!selectedItem) { showAlert('Split', 'Select a clip first.'); return; }
    const idx = items.findIndex(i => i.key === selectedKey);
    if (idx < 0) return;
    // Where this clip starts on the timeline. That is what turns the playhead's
    // timeline second into a distance into the clip - the two are only the same
    // number for the first clip in the project, which is why splitting appeared to
    // work at all.
    let clipStart = 0;
    for (let i = 0; i < idx; i += 1) clipStart += clipLength(items[i]);
    const len = clipLength(selectedItem);
    // Snap to the beat if one is near. Markers you can see but not land on are
    // decoration - this is what makes Beat Sync an edit rather than a readout.
    //
    // 0.12s either side, which is under a sixteenth note at 120bpm, so the snap can
    // never cross to the wrong beat at any tempo this detects (60-180 BPM puts beats
    // at least 0.33s apart). Below that it is a correction, not a hijack: a deliberate
    // cut somewhere else stays where it was put.
    const at = nearestBeat(positionRef.current) ?? positionRef.current;
    const into = at - clipStart;
    if (!(into > MIN_CLIP_DUR && into < len - MIN_CLIP_DUR)) {
      showAlert('Split', 'Move the playhead inside this clip first.');
      return;
    }

    let part1, part2;
    if (selectedItem.type === 'image') {
      // A still has no footage to cut into: both halves are the same picture, each
      // held for less time. clipLength reads duration for an image and ignores the
      // trim offsets, so cutting those would have produced two clips that each still
      // ran the full length - a split that made the timeline longer.
      part1 = { ...selectedItem, key: selectedItem.key + '_a', duration: into };
      part2 = { ...selectedItem, key: selectedItem.key + '_b', duration: len - into };
    } else {
      // `into` is timeline seconds from the clip's start; the cut is a source offset.
      const cut = (selectedItem.trimStart ?? 0) + into * clipSpeed(selectedItem);
      part1 = { ...selectedItem, key: selectedItem.key + '_a', trimEnd: cut };
      part2 = { ...selectedItem, key: selectedItem.key + '_b', trimStart: cut };
    }
    // A transition belongs to a clip's right edge, so it stays with the half that
    // still ends where the original did. The cut itself is a hard join: the user
    // asked for a cut, and inheriting the transition would put a crossfade on it.
    part1.transition = 'none';

    const next = [...items];
    next.splice(idx, 1, part1, part2);
    pushHistory(next);
    setSelectedKey(null);
  }

  const openTrim = useCallback((item) => {
    // A still has no footage to seek into - clipLength reads its duration and ignores
    // trimStart/trimEnd entirely - so in and out sliders would be a live-looking
    // control that changes nothing. How long it is held is the same question asked a
    // different way, and Photo Duration is where it is asked.
    if (item.type === 'image') {
      setSelectedKey(item.key);
      setShowImageDurationModal(true);
      return;
    }
    const fallbackEnd = item.trimEnd || item.sourceDuration || item.duration || 3;
    setTrimItem(item);
    setTrimStart(item.trimStart || 0);
    setTrimEnd(fallbackEnd);
    setShowTrimModal(true);

    // The sliders can only reach as far as the length we know about, so a clip whose
    // duration ImagePicker never reported opens on a 3s window into footage that may
    // run for minutes - there is no way to trim to a point past the fallback. Measure
    // it behind the open sheet and widen the sliders when it lands.
    if (!item.sourceDuration) {
      measureVideoDuration(item.uri).then(measured => {
        if (!measured) return;
        setItems(prev => prev.map(i => (
          i.key === item.key && i.sourceDuration == null ? { ...i, sourceDuration: measured } : i
        )));
        setTrimItem(prev => (prev && prev.key === item.key ? { ...prev, sourceDuration: measured } : prev));
        // Only if the out point is still where it was opened. Once it has been dragged
        // it is a choice, and a measurement arriving late must not overrule it.
        setTrimEnd(prev => (prev === fallbackEnd ? measured : prev));
      });
    }
  }, []);

  function applyTrim() {
    if (!trimItem) { setShowTrimModal(false); return; }
    // The sliders are bounded against each other, but a bound is a UI affordance and
    // this is the write. The handle path clamps on every frame of a drag; the modal
    // wrote whatever the two sliders happened to hold, and a start dragged past an end
    // gives clipLength a negative span that floors to a zero-length clip.
    const srcDur = trimItem.sourceDuration || null;
    const start = Math.max(0, trimStart);
    const end = Math.max(srcDur ? Math.min(srcDur, trimEnd) : trimEnd, start + MIN_CLIP_DUR);
    const next = items.map(i => (i.key === trimItem.key ? { ...i, trimStart: start, trimEnd: end } : i));
    pushHistory(next);
    setShowTrimModal(false);
  }


  function applySpeed(speed) {
    setSelectedSpeed(speed);
    if (selectedItem) {
      setItems(prev => prev.map(i => i.key === selectedKey ? { ...i, speed } : i));
    }
  }

  function applyFilter(filter) {
    setSelectedFilter(filter);
    if (selectedItem) {
      setItems(prev => prev.map(i => i.key === selectedKey ? { ...i, filter } : i));
    }
  }

  // Stored as an id, not a chain. The recipe is looked up once, at export - keeping the
  // id on the item means a project saved today still resolves if a motion's expression
  // is retuned tomorrow, exactly as the filter and caption catalogues work.
  function applyMotion(motion) {
    if (!selectedItem) return;
    setItems(prev => prev.map(i => i.key === selectedKey ? { ...i, motion } : i));
  }

  function applyEffect(effect) {
    if (!selectedItem) return;
    setItems(prev => prev.map(i => i.key === selectedKey ? { ...i, effect } : i));
  }

  function applyTransition(t) {
    setSelectedTransition(t);
    if (selectedItem) {
      setItems(prev => prev.map(i => i.key === selectedKey ? { ...i, transition: t } : i));
    }
  }

  function addTextOverlay() {
    if (!textInput.trim()) return;
    if (editingText) {
      setTextOverlays(prev => prev.map(t => t.key === editingText.key
        ? { ...t, text: textInput, color: textColor, font: textFont, size: textSize,
            background: textBackground,
            ...(t.captionStyleId ? { captionColorOverride: textColor, captionSpec: { ...t.captionSpec, gradient: undefined } } : null) }
        : t));
    } else {
      setTextOverlays(prev => [...prev, {
        key: String(Date.now()),
        text: textInput,
        color: textColor,
        font: textFont,
        size: textSize,
        background: textBackground,
        x: 50, y: 80,
        scale: 1,
        rotation: 0,
      }]);
    }
    setShowTextModal(false);
    setTextInput('');
    setEditingText(null);
  }

  // Auto-captions move as one. They are a caption per phrase rather than a single
  // object, and only the phrase under the playhead is on screen - so dragging the
  // one you can see and leaving the other forty where they were would look like
  // the caption jumping back the moment the clip moves on.
  // A chip that follows the spoken word needs one still per word: the phrase stays on
  // screen while the chip moves along it, and the server draws exactly one word lit.
  //
  // This was tried once before and reverted, because every still rebuilt the whole
  // caption - mask, dilate, and a blurred tint for shadow, glow and stroke - and a
  // 27-second voiceover became 885 renders that wedged the export. The server now
  // caches those layers per phrase, since none of them depend on which word is lit.
  // Measured at real export size: a four-word phrase went from 10.1s to 2.8s, which
  // is about what a single plain caption cost before any of this.
  //
  // Capped anyway. The cost is now linear and modest, but a very long voiceover should
  // not be able to turn into an export nobody waits for - past the cap the captions
  // render as plain text rather than slowly.
  const MAX_HIGHLIGHT_STILLS = 400;

  const expandForExport = useCallback((list) => {
    const total = list.reduce((n, t) => {
      const style = t.captionStyleId ? resolveCaptionStyle(t.captionStyleId) : null;
      const hl = style ? captionHighlight(style) : null;
      return n + ((hl && Array.isArray(t.words) && t.words.length) ? t.words.length : 1);
    }, 0);
    if (total > MAX_HIGHLIGHT_STILLS) return list;

    return list.flatMap((t) => {
      const style = t.captionStyleId ? resolveCaptionStyle(t.captionStyleId) : null;
      const hl = style ? captionHighlight(style) : null;
      if (!hl || !Array.isArray(t.words) || t.words.length === 0) return [t];
      return t.words.map((w, i) => ({
        ...t,
        key: `${t.key}__w${i}`,
        activeWord: i,
        // Each still covers only its own word's span, so together they tile the
        // phrase's original window and nothing is shown for longer than it was.
        startTime: w.start,
        endTime: w.end,
      }));
    });
  }, []);
  const applyOverlayTransform = useCallback((key, next) => {
    setTextOverlays(prev => {
      const target = prev.find(t => t.key === key);
      if (!target) return prev;
      const movesTogether = t => (target.isAutoCaption ? t.isAutoCaption : t.key === key);
      return prev.map(t => (movesTogether(t) ? { ...t, ...next } : t));
    });
  }, []);

  // First tap selects and shows the frame, so an overlay can be picked up and moved
  // without a keyboard covering the canvas; tapping the selected one puts a caret
  // in it. The style sheet moved to a long press - typing is the common act and
  // deserves the shorter gesture.
  // Read the selection rather than deciding inside a state updater. An updater has
  // to be pure and may be run more than once for a single update; setting other
  // state from inside one is a side effect in a function React is free to replay.
  const openOverlayEditor = useCallback((ov) => {
    if (selectedOverlayKey === ov.key) setInlineEditKey(ov.key);
    else setSelectedOverlayKey(ov.key);
  }, [selectedOverlayKey]);

  const openOverlayStyleSheet = useCallback((ov) => {
    setInlineEditKey(null);
    setEditingText(ov);
    setTextInput(ov.text);
    setTextColor(ov.color);
    setTextFont(ov.font);
    setTextSize(ov.size);
    setTextBackground(ov.background || DEFAULT_TEXT_BACKGROUND);
    setShowTextModal(true);
  }, []);

  // Typed straight onto the overlay. Only this one phrase changes even for an
  // auto-caption, unlike a move - the captions share a position but not their words.
  const setOverlayText = useCallback((key, text) => {
    setTextOverlays(prev => prev.map(t => (t.key === key ? { ...t, text } : t)));
  }, []);

  // Leaving the caret behind commits. An overlay typed empty is deleted rather
  // than left as an invisible object that still catches every tap on the canvas.
  const endInlineEdit = useCallback(() => {
    setInlineEditKey(key => {
      if (key) {
        setTextOverlays(prev => prev.filter(t => t.key !== key || String(t.text || '').trim() !== ''));
      }
      return null;
    });
  }, []);

  const removeTextOverlay = useCallback((key) => {
    setTextOverlays(prev => prev.filter(t => t.key !== key));
  }, []);

  async function pickAudio() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos, // audio files
      allowsMultipleSelection: false,
    });
    if (!result.canceled && result.assets[0]) {
      const audioId = newMediaId('aud');
      const audioKey = String(Date.now());
      const audioUri = result.assets[0].uri;
      persistInto(setAudioTracks, audioKey, audioId, audioUri, 'm4a');
      setAudioTracks(prev => [...prev, {
        key: audioKey,
        mediaId: audioId,
        uri: audioUri,
        name: result.assets[0].fileName || 'Audio track',
        volume: 1,
      }]);
    }
  }async function processVideo() {
    if (items.length === 0) { showAlert('No media','Add at least one photo or video.'); return; }
    setUploading(true); setMessage('Uploading media...');
    try {
      const formData = new FormData();
      items.forEach(item => formData.append('files', {
        uri: item.uri, name: item.fileName,
        type: item.type === 'video' ? 'video/mp4' : 'image/jpeg',
      }));
      const user = auth.currentUser;
      if (!user) throw new Error('Not logged in');
      const token = await user.getIdToken();
      const uploadRes = await fetch(BACKEND + '/api/upload-media', {
        method: 'POST', headers: { Authorization: 'Bearer ' + token }, body: formData,
      });
      const uploadData = await readJson(uploadRes);
      if (uploadData.error) throw new Error(uploadData.error);
      const mediaItems = uploadData.items.map((uploaded, i) => ({
        url: uploaded.url, type: uploaded.type,
        duration: items[i].type === 'image' ? items[i].duration : undefined,
        trimStart: items[i].trimStart || 0,
        trimEnd: items[i].type === 'video' ? items[i].trimEnd : undefined,
        speed: items[i].speed || 1,
        filter: items[i].filter || 'None',
        // The grade itself, so the catalogue lives in the app and a filter added there
        // renders without a backend deploy. The name is still sent for older servers.
        // The chosen grade first, then the hand adjustment on top of it - the same
        // order the sheets are used in, and the order that makes a correction correct
        // what the filter did rather than the other way round. One chain, so the
        // server needed no change at all to support this.
        filterSpec: [
          ...(filterSpec(items[i].filter) || []),
          ...adjustChain(items[i].adjust),
        // Bounded, but above anything reachable: a filter contributes at most 3
        // fragments and the ten adjustments one each, so 13 is the real ceiling.
        // A cap of 12 would have silently dropped grain from a fully-used clip.
        ].slice(0, 20),
        // What the clip DOES while it is on screen. One string rather than a list -
        // zoompan and crop expressions are full of commas, and splitting on those
        // would take them apart. Undefined when no motion is set, so a clip without
        // one produces exactly the command it did before this existed.
        motionSpec: motionChain(items[i].motion) || undefined,
        // Effects run after motion: the effect should act on the framing the motion
        // chose, not be reframed by it. A glitch tear across a picture that is then
        // zoomed would have its own tear scaled up with the picture.
        effectSpec: effectChain(items[i].effect) || undefined,
        // Fractions of the source, so one rectangle is right for the phone's preview
        // and for the 4K master.
        // The four per-clip processing flags. The server has read item.denoise,
        // item.stabilize, item.reverse and item.motionBlur since those tools were
        // written - but nothing ever put them in this object, so every one of them set
        // a flag that never left the phone. The chip turned green, the toolbar showed
        // it on, and the export silently ignored it.
        //
        // Nothing failed and nothing logged; the video simply came back unprocessed,
        // which is indistinguishable from the filter being subtle. The tools were
        // verified against real ffmpeg when they were built - but that proved the
        // BACKEND could do it, not that the app ever asked.
        reverse: !!items[i].reverse,
        denoise: !!items[i].denoise,
        motionBlur: !!items[i].motionBlur,
        stabilize: !!items[i].stabilize,
        enhanceVoice: !!items[i].enhanceVoice,
        // An id, never a filter string - the chain lives in AUDIO_FX on the server.
        audioFx: items[i].audioFx || undefined,
        transform: items[i].transform || undefined,
        mask: items[i].mask || undefined,
        rotate: Number(items[i].rotate) || 0,
        opacity: Number.isFinite(Number(items[i].opacity)) ? Number(items[i].opacity) : 1,
        // Seconds of held final frame. The server clamps it to 5 - it is duration the
        // client asks the server to invent, and duration the credit check did not count.
        freezeEnd: Number(items[i].freezeEnd) || 0,
        chromaKey: items[i].chromaKey || undefined,
        crop: items[i].crop || null,
        flipH: !!items[i].flipH,
        flipV: !!items[i].flipV,
        // The clip's own audio. Neither of these was sent, and the server discarded
        // clip sound entirely, so muting a clip on the timeline changed nothing about
        // the file that came back.
        volume: items[i].volume ?? 1,
        muted: !!items[i].muted,
        transition: items[i].transition || 'none',
        // The recipe itself - an xfade base plus an fx chain the server gates to the
        // join. Sending it means a transition added to the catalogue renders without a
        // backend deploy, the same arrangement the caption styles use.
        transitionSpec: transitionSpec(items[i].transition),
      }));

      // Upload overlays if any
      let uploadedOverlays = [];
      // Split before uploading. A sticker's picture is already on the server, so
      // sending it up would be a round trip to hand the backend a file it wrote.
      const stickerOverlays = overlays.filter(o => o.isSticker && o.stickerId);
      const pickedOverlays = overlays.filter(o => !(o.isSticker && o.stickerId));
      if (pickedOverlays.length > 0) {
        setMessage('Uploading overlays...');
        const overlayForm = new FormData();
        pickedOverlays.forEach(o => overlayForm.append('files', {
          uri: o.uri, name: o.fileName, type: o.type === 'video' ? 'video/mp4' : 'image/jpeg',
        }));
        const overlayRes = await fetch(BACKEND + '/api/upload-media', {
          method: 'POST', headers: { Authorization: 'Bearer ' + token }, body: overlayForm,
        });
        const overlayData = await readJson(overlayRes);
        if (overlayData.items) {
          uploadedOverlays = overlayData.items.map((u, i) => {
            const o = pickedOverlays[i];
            return {
              url: u.url,
              type: o.type,
              // Centre of the overlay as a percentage of the frame, the same anchor
              // text overlays use. Width rather than a raw scale, because the server
              // knows the output's dimensions and the canvas does not.
              x: o.x ?? 50,
              y: o.y ?? 50,
              widthPercent: OVERLAY_BASE_FRAC * 100 * (o.scale ?? 1),
              rotation: o.rotation ?? 0,
            };
          });
        }
      }

      // Stickers join the payload with the path they already have on disk.
      // resolveMediaPath allows anything under public/, which is where they live.
      uploadedOverlays = uploadedOverlays.concat(stickerOverlays.map(o => ({
        url: `/stickers/${o.stickerId}.png`,
        type: 'image',
        x: o.x ?? 50,
        y: o.y ?? 50,
        widthPercent: OVERLAY_BASE_FRAC * 100 * (o.scale ?? 1),
        rotation: o.rotation ?? 0,
      })));

      // Upload audio tracks (voiceover + music) if any
      let uploadedAudio = [];
      // Placement travels with the track: without startOffset/trim the export
      // starts every track at 0:00 and runs it full length, which is not what
      // the timeline preview plays back.
      const audioPlacement = (track) => ({
        volume: (track.volume ?? 1) * masterVolume,
        // Fades are seconds at each end of the trimmed region, applied before the
        // track is delayed into place so they refer to the audio and not the timeline.
        fadeIn: Math.max(0, Number(track.fadeIn) || 0),
        fadeOut: Math.max(0, Number(track.fadeOut) || 0),
        isVoiceover: !!track.isVoiceover,
        // Broadcast voice chain on the server. Sent here rather than baked into the
        // file, so it can be turned off again on a track already on the timeline.
        enhanceVoice: !!track.enhanceVoice,
        audioFx: track.audioFx || undefined,
        startOffset: track.startOffset ?? 0,
        trimStart: track.trimStart ?? 0,
        trimEnd: track.trimEnd ?? track.sourceDuration ?? null,
      });
      if (audioTracks.length > 0) {
        setMessage('Uploading audio...');
        for (const track of audioTracks) {
          if (track.remoteUrl) {
            uploadedAudio.push({ url: track.remoteUrl, ...audioPlacement(track) });
          } else if (track.uri.startsWith('http')) {
            uploadedAudio.push({ url: track.uri, ...audioPlacement(track) });
          } else {
            const audioForm = new FormData();
            audioForm.append('files', { uri: track.uri, name: track.name || 'audio.mp3', type: 'audio/mpeg' });
            const audioRes = await fetch(BACKEND + '/api/upload-media', {
              method: 'POST', headers: { Authorization: 'Bearer ' + token }, body: audioForm,
            });
            const audioData = await readJson(audioRes);
            if (audioData.items?.[0]) {
              uploadedAudio.push({ url: audioData.items[0].url, ...audioPlacement(track) });
            }
          }
        }
      }

      setMessage('Creating video...');
      const mergeRes = await fetch(BACKEND + '/api/media-to-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({
          mediaItems, userId: user.uid, resolution, aspectRatio, background: bg,
          textOverlays: expandForExport(textOverlays).map(t => ({
            text: t.text, color: t.color, font: t.font,
            // A pinch scales every part of the overlay together, and every part is
            // already a multiple of the size - stroke, padding, glow - so folding
            // the scale into the size reproduces it exactly, with no second factor
            // for the renderer to apply and get wrong.
            size: Math.max(1, Math.round(t.size * (t.scale ?? 1))),
            x: t.x, y: t.y, anchor: 'center', rotation: t.rotation ?? 0,
            isAutoCaption: t.isAutoCaption || false,
            captionStyleId: t.captionStyleId,
            // A manual overlay's chip travels as a spec box, which is the same
            // thing a boxed caption style sends and the same code that draws it -
            // the server needs no idea that one came from a catalogue and the
            // other from four sliders.
            captionSpec: overlayExportSpec(t),
            // A side-handle drag on the canvas, at scale 1 (same reason size folds
            // scale in above - a pinch afterwards should widen the box exactly as
            // much as it grows the font, so the effective fraction of the frame is
            // this times the same scale). Absent for a caption or an overlay never
            // width-resized, which is most of them - the server falls back to its
            // existing word-count wrap for those, unchanged.
            boxWidthPercent: t.boxWidthPercent != null ? t.boxWidthPercent * (t.scale ?? 1) : undefined,
            // Word timings, for the styles whose chip follows the voice. Absent on
            // every other overlay, which is most of them.
            words: t.words,
            // Which word this still has chipped. The server treats a non-integer as
            // "no chip", so omitting it renders plain text - which is exactly what
            // used to happen.
            activeWord: Number.isInteger(t.activeWord) ? t.activeWord : undefined,
            startTime: t.startTime, endTime: t.endTime,
          })),
          // The width the overlay positions and sizes were chosen against. The
          // server scales text by W / previewWidth and this was never sent, so it
          // fell back to 360 while the real canvas is half the screen - about 180 on
          // this phone. Every caption therefore exported at roughly half the size it
          // was set at, which is why they looked right here and shrank in the file.
          previewWidth: frame.w,
          overlays: uploadedOverlays,
          audioTracks: uploadedAudio,
        }),
      });
      const { jobId, error } = await readJson(mergeRes);
      if (!jobId) {
        // 402 (no credits) / 403 (over a plan's cap) are the tier-enforcement
        // rejections added on the backend - shown as an upgrade prompt with
        // the server's own specific reason, not a generic red error alert.
        if (mergeRes.status === 402 || mergeRes.status === 403) {
          promptUpgrade(null, error);
        } else {
          showAlert('Error', error || 'Failed to start job');
        }
        setUploading(false);
        return;
      }
      // The export is the longest job in the app - a caption-heavy project is minutes -
      // so this is the one that most needed to survive leaving the screen. pollJob stays
      // for the in-screen progress bar; track() is what keeps it alive beyond it.
      track(jobId, { kind: 'export', label: 'Exporting your video' });
      pollJob(jobId);
    } catch (e) { showAlert('Error', e.message); setUploading(false); }
  }

  async function generateVoiceover() {
    if (!voiceoverScript.trim()) { showAlert('Script required', 'Enter text to generate voiceover.'); return; }
    setGeneratingVoiceover(true);
    try {
      const res = await apiFetch('/api/generate-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: voiceoverScript, voiceId }),
      });
      const data = await readJson(res);
      if (data.error) {
        // 403 here means the chosen voice needs Pro/Creator - the backend's
        // own message names which voice, so it's shown as-is.
        if (res.status === 403) { promptUpgrade(null, data.error); return; }
        throw new Error(data.error);
      }
      const fullUrl = BACKEND + data.audioUrl;
      // Same streaming problem as the translated track above, same fix.
      const voId = newMediaId('vo');
      const local = await cacheRemoteMedia(fullUrl, voId, 'mp3');
      setVoiceoverTracks(prev => [...prev, {
        key: String(Date.now()), mediaId: voId, uri: local || fullUrl, remoteUrl: fullUrl,
        name: 'Voiceover: ' + voiceoverScript.slice(0, 30), volume: 1, isVoiceover: true,
      }]);
      setVoiceoverScript('');
    } catch (e) {
      showAlert('Error', e.message);
    } finally {
      setGeneratingVoiceover(false);
    }
  }

  // Voice preview lives in components/VoicePicker.js now. It used to be here, driving
  // a horizontal strip of eight cards; with 325 voices the strip became a picker, and
  // the fetch-and-play went with it so IdeaToVideoScreen could use the same one rather
  // than reimplement it.

  async function pickVoiceoverFile() {
    const result = await DocumentPicker.getDocumentAsync({ type: 'audio/*', copyToCacheDirectory: true });
    if (!result.canceled && result.assets?.[0]) {
      const a = result.assets[0];
      const voKey = String(Date.now());
      const voId = newMediaId('vo');
      // A picked voiceover FILE is the user's own and needs protecting. A GENERATED
      // one does not - it comes back from the backend as a remoteUrl and is durable
      // there, so it is deliberately left alone.
      persistInto(setVoiceoverTracks, voKey, voId, a.uri, 'mp3');
      setVoiceoverTracks(prev => [...prev, {
        key: voKey, mediaId: voId, uri: a.uri, name: a.name || 'Voiceover file', volume: 1, isVoiceover: true,
      }]);
    }
  }

  function addVoiceoverTrack(track) {
    const tagged = { ...track, isVoiceover: true, startOffset: 0, trimStart: 0, trimEnd: null, sourceDuration: null };
    setAudioTracks(prev => [...prev, tagged]);
    setVoiceoverTracks(prev => prev.filter(t => t.key !== track.key));
    setShowVoiceoverModal(false);
    attachAudioSource(tagged);
  }

  // Beat detection for an audio track.
  //
  // The server returns a beat GRID plus how periodic the audio actually was. `strength`
  // is reported rather than used as a gate there, on purpose - so the decision about
  // what to tell someone whose track has no beat in it is made HERE, where there is a
  // user to tell. Spoken word measures around 0.1; music with a real pulse measures
  // 0.44-0.86. Below the threshold the grid is still stored, because a weak reading is
  // not always a wrong one, but the message says plainly not to trust it.
  const WEAK_BEAT = 0.25;
  async function detectBeats(trackKey) {
    const track = audioTracks.find(t => t.key === trackKey);
    if (!track) return;
    if (!isPremium) {
      promptUpgrade('Beat Sync', 'Beat Sync is available on the Pro and Creator plans.');
      return;
    }
    const url = track.remoteUrl;
    if (!url) {
      // A track picked from the device has not been uploaded until an export sends it,
      // and the server cannot analyse what it has never received. Saying so beats a 404.
      showAlert('Beat Sync', 'This track has not finished uploading yet. Try again in a moment.');
      return;
    }
    try {
      setUploading(true); setProgress(0); setMessage('Finding the beat...');
      const res = await apiFetch('/api/detect-beats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.replace(BACKEND, '') }),
      });
      const data = await readJson(res);
      if (data.error || !data.beats) throw new Error(data.error || 'Could not find a beat in this track.');

      setTrackField(trackKey, { beats: data.beats, bpm: data.bpm });
      setUploading(false);
      showAlert(
        'Beat Sync',
        data.strength < WEAK_BEAT
          ? `This track has no strong beat - the marks are a best guess at ${Math.round(data.bpm)} BPM and may not line up.`
          : `${data.beats.length} beats marked at ${Math.round(data.bpm)} BPM. Split a clip near a mark and the cut lands on it.`
      );
    } catch (e) {
      setUploading(false);
      showAlert('Beat Sync', e.message || 'Could not find a beat in this track.');
    }
  }

  // Beats in a clip's own audio. Same detector as a track's Beat Sync, but the clip has
  // to be uploaded first and its sound extracted, because /api/detect-beats analyses an
  // audio file and a clip on the device is neither uploaded nor separated.
  async function detectClipBeats(item) {
    if (item.type === 'image') return showAlert('Beats', 'A photo has no sound to analyse.');
    if (!isPremium) {
      promptUpgrade('Beats', 'Beats is available on the Pro and Creator plans.');
      return;
    }
    try {
      setUploading(true); setProgress(0); setMessage('Preparing clip...');
      const user = auth.currentUser;
      if (!user) throw new Error('Not logged in');
      const token = await user.getIdToken();

      let url = item.remoteUrl;
      if (!url) {
        const form = new FormData();
        form.append('files', { uri: item.uri, name: 'clip.mp4', type: 'video/mp4' });
        const upRes = await fetch(BACKEND + '/api/upload-media', {
          method: 'POST', headers: { Authorization: 'Bearer ' + token }, body: form,
        });
        const upData = await readJson(upRes);
        if (upData.error) throw new Error(upData.error);
        url = upData.items?.[0]?.url;
        if (!url) throw new Error('That clip could not be uploaded.');
        setItems(prev => prev.map(i => (i.key === item.key ? { ...i, remoteUrl: url } : i)));
      }

      setMessage('Extracting audio...');
      const exRes = await apiFetch('/api/extract-audio', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const exData = await readJson(exRes);
      if (exData.error || !exData.audioUrl) {
        throw new Error(exData.error || 'Could not read this clip’s sound.');
      }

      setMessage('Finding the beat...');
      const res = await apiFetch('/api/detect-beats', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: exData.audioUrl }),
      });
      const data = await readJson(res);
      if (data.error || !data.beats) throw new Error(data.error || 'Could not find a beat in this clip.');

      setItems(prev => prev.map(i => (i.key === item.key
        ? { ...i, beats: data.beats, bpm: data.bpm } : i)));
      setUploading(false);
      showAlert('Beats', data.strength < WEAK_BEAT
        ? `This clip has no strong beat - the marks are a best guess at ${Math.round(data.bpm)} BPM and may not line up.`
        : `${data.beats.length} beats found at ${Math.round(data.bpm)} BPM. Split near one and the cut lands on it.`);
    } catch (e) {
      setUploading(false);
      showAlert('Beats', e.message || 'Could not find a beat in this clip.');
    }
  }

  async function loadMusicLibrary() {
    if (musicLibraryTracks.length > 0) return;
    setMusicLoading(true);
    try {
      const res = await apiFetch('/api/music-tracks');
      const data = await readJson(res);
      setMusicLibraryTracks(data.tracks || []);
    } catch (e) {
      showAlert('Error', 'Failed to load music library.');
    } finally {
      setMusicLoading(false);
    }
  }

  // The library audition sound is separate from the timeline mixer. It used to
  // be stopped only when auditioning a different track, so closing the sheet -
  // or adding the track - left it playing over the timeline, which sounded
  // exactly like music that ignores the play/pause button and then cuts out
  // when the 30s preview file ends.
  async function stopMusicPreview() {
    musicPreviewTokenRef.current += 1;
    const sound = musicPreviewSoundRef.current;
    musicPreviewSoundRef.current = null;
    setMusicPreviewPlayingId(null);
    if (sound) {
      try { await sound.stopAsync(); } catch (e) {}
      try { await sound.unloadAsync(); } catch (e) {}
    }
  }

  function closeMusicModal() {
    stopMusicPreview();
    setShowMusicModal(false);
  }

  async function previewMusicTrack(track) {
    const wasPlayingThis = musicPreviewPlayingId === track.id;
    await stopMusicPreview();
    if (wasPlayingThis) return;
    const token = musicPreviewTokenRef.current;
    try {
      const { sound } = await Audio.Sound.createAsync({ uri: BACKEND + track.previewUrl }, { shouldPlay: true });
      // The remote preview takes a moment to load, and closing the sheet or
      // hitting Add stops the audition during that gap. Without this check the
      // sound lands after the stop, nothing owns it, and it plays on over the
      // timeline - deaf to play/pause, and not seeking when you scrub, because
      // it was never a mixer track at all.
      if (musicPreviewTokenRef.current !== token) {
        try { await sound.stopAsync(); } catch (e) {}
        sound.unloadAsync().catch(() => {});
        return;
      }
      musicPreviewSoundRef.current = sound;
      setMusicPreviewPlayingId(track.id);
      sound.setOnPlaybackStatusUpdate(status => {
        if (status.didJustFinish) setMusicPreviewPlayingId(null);
      });
    } catch (e) {}
  }

  function addMusicTrackFromLibrary(track) {
    const newTrack = { key: String(Date.now()), uri: BACKEND + track.previewUrl, name: track.name, volume: 1, isMusic: true, startOffset: 0, trimStart: 0, trimEnd: null, sourceDuration: null };
    setAudioTracks(prev => [...prev, newTrack]);
    closeMusicModal();
    attachAudioSource(newTrack);
  }

  async function pickMusicFile() {
    const result = await DocumentPicker.getDocumentAsync({ type: 'audio/*', copyToCacheDirectory: true });
    if (!result.canceled && result.assets?.[0]) {
      const a = result.assets[0];
      const musicKey = String(Date.now());
      const musicId = newMediaId('mus');
      const newTrack = { key: musicKey, mediaId: musicId, uri: a.uri, name: a.name || 'Music track', volume: 1, isMusic: true, startOffset: 0, trimStart: 0, trimEnd: null, sourceDuration: null };
      persistInto(setAudioTracks, musicKey, musicId, a.uri, 'mp3');
      setAudioTracks(prev => [...prev, newTrack]);
      closeMusicModal();
      attachAudioSource(newTrack);
    }
  }

  async function fetchWaveform(trackKey, url) {
    if (!url || waveformCache[trackKey]) return;
    try {
      const user = auth.currentUser;
      const token = user ? await user.getIdToken() : null;
      const res = await fetch(BACKEND + '/api/audio-waveform', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: 'Bearer ' + token } : {}),
        },
        body: JSON.stringify({ url, samples: 400 }),
      });
      const data = await readJson(res);
      if (data.peaks) {
        setWaveformCache(prev => ({ ...prev, [trackKey]: data.peaks }));
      }
    } catch (e) {}
  }

  // A picked file lives only on the device, so the backend cannot read it for a
  // waveform and the export would have to upload it at the worst possible
  // moment - after the user hits Export. Upload once at add-time instead: the
  // block gets a real waveform, and Export reuses the same URL. Preview audio
  // keeps playing from the local file, so it stays instant and works offline.
  async function uploadAudioTrackFile(track) {
    setAudioTracks(prev => prev.map(t => t.key === track.key ? { ...t, uploadState: 'uploading' } : t));
    try {
      const user = auth.currentUser;
      const token = user ? await user.getIdToken() : null;
      const form = new FormData();
      form.append('files', {
        uri: track.uri,
        name: track.name || 'audio.mp3',
        type: 'audio/mpeg',
      });
      const res = await fetch(BACKEND + '/api/upload-media', {
        method: 'POST',
        headers: token ? { Authorization: 'Bearer ' + token } : {},
        body: form,
      });
      const data = await readJson(res);
      const remoteUrl = data.items?.[0]?.url;
      if (!remoteUrl) throw new Error(data.error || 'Upload failed');
      setAudioTracks(prev => prev.map(t => t.key === track.key ? { ...t, remoteUrl, uploadState: 'ready' } : t));
      fetchWaveform(track.key, remoteUrl);
    } catch (e) {
      // Not fatal: the track still plays locally, and Export retries the upload.
      setAudioTracks(prev => prev.map(t => t.key === track.key ? { ...t, uploadState: 'failed' } : t));
      console.warn('Audio track upload failed:', e?.message || e);
    }
  }

  // Backend-hosted sources (generated voiceovers, library music) are already
  // readable server-side; device files have to be uploaded first.
  function attachAudioSource(track) {
    if (/^https?:/i.test(track.uri)) {
      fetchWaveform(track.key, track.uri);
    } else {
      uploadAudioTrackFile(track);
    }
  }

  // Commit of a clip's edge drag. The handle has already clamped the pixels it hands
  // over against the footage that exists, so this only has to convert and store - but
  // it clamps again, because the two ends of a gesture are far enough apart in time
  // that the clip may have been trimmed from the modal in between.
  const applyClipTrimEdit = useCallback((key, side, dx) => {
    const timelineDelta = dx / PIXELS_PER_SECOND;
    const next = items.map(i => {
      if (i.key !== key) return i;
      // A still has no footage to seek into, so neither edge is a trim: both just
      // change how long it is on the timeline.
      if (i.type === 'image') {
        const cur = i.duration || 3;
        const next = cur + (side === 'left' ? -timelineDelta : timelineDelta);
        return { ...i, duration: Math.max(MIN_CLIP_DUR, Math.min(IMAGE_MAX_DUR, next)) };
      }
      // The finger moved a distance on the timeline; the in and out points it moves
      // are offsets into the source, and a second of timeline is `speed` seconds of
      // source. Without this a trim on a 2x clip moved the edge half as far as the
      // handle went.
      const deltaSec = timelineDelta * clipSpeed(i);
      const srcDur = i.sourceDuration ?? i.trimEnd ?? 0;
      const curStart = i.trimStart ?? 0;
      const curEnd = i.trimEnd ?? srcDur;
      if (side === 'left') {
        return { ...i, trimStart: Math.max(0, Math.min(curStart + deltaSec, curEnd - MIN_CLIP_DUR)) };
      }
      return { ...i, trimEnd: Math.min(srcDur, Math.max(curEnd + deltaSec, curStart + MIN_CLIP_DUR)) };
    });
    // One drag is one entry: this runs on release, not per frame, so undo steps back
    // over whole trims rather than over sixty intermediate positions.
    pushHistory(next);
  }, [items]);

  const applyAudioTrimEdit = useCallback((trackKey, side, dx) => {
    const deltaSec = dx / PIXELS_PER_SECOND;
    const MIN_DUR = 0.3;
    setAudioTracks(prev => prev.map(t => {
      if (t.key !== trackKey) return t;
      const srcDur = t.sourceDuration ?? 0;
      const curStart = t.trimStart ?? 0;
      const curEnd = t.trimEnd ?? srcDur;
      const curOffset = t.startOffset ?? 0;
      if (side === 'left') {
        const newTrimStart = Math.max(0, Math.min(curStart + deltaSec, curEnd - MIN_DUR));
        const actualDelta = newTrimStart - curStart;
        const newOffset = Math.max(0, curOffset + actualDelta);
        return { ...t, trimStart: newTrimStart, startOffset: newOffset };
      } else {
        const newTrimEnd = Math.min(srcDur, Math.max(curEnd + deltaSec, curStart + MIN_DUR));
        return { ...t, trimEnd: newTrimEnd };
      }
    }));
  }, []);
  const onDragEndAudioTrack = useCallback((key, newX) => {
    const newOffset = newX / PIXELS_PER_SECOND;
    setAudioTracks(prev => prev.map(t => t.key === key ? { ...t, startOffset: newOffset } : t));
  }, []);
  const onPressAudioTrack = useCallback((key) => {
    setSelectedAudioTrackKey(prev => (prev === key ? null : key));
  }, []);
  const setAudioTrackVolume = useCallback((key, volume) => {
    setAudioTracks(prev => prev.map(t => t.key === key ? { ...t, volume } : t));
  }, []);
  const removeAudioTrack = useCallback((key) => {
    setAudioTracks(prev => prev.filter(t => t.key !== key));
    setAudioSheetKey(prev => prev === key ? null : prev);
    setSelectedAudioTrackKey(prev => prev === key ? null : prev);
  }, []);
  // Swap the file under a track, keeping where it sits and how loud it is. Its in and
  // out points go, being offsets into a file that is no longer there.
  const replaceAudioTrackFile = useCallback(async () => {
    if (!selectedAudioTrackKey) return;
    const res = await DocumentPicker.getDocumentAsync({ type: 'audio/*', copyToCacheDirectory: true });
    if (res.canceled || !res.assets?.length) return;
    const a = res.assets[0];
    const swapId = newMediaId('aud');
    persistInto(setAudioTracks, selectedAudioTrackKey, swapId, a.uri, 'mp3');
    setAudioTracks(prev => prev.map(t => (t.key !== selectedAudioTrackKey ? t : {
      ...t, mediaId: swapId, uri: a.uri, name: a.name || t.name, sourceDuration: null, trimStart: 0, trimEnd: null,
    })));
  }, [selectedAudioTrackKey]);

  // The copy lands immediately after the original rather than on top of it, which is
  // the only placement that is visible and audible as a separate thing.
  const duplicateAudioTrack = useCallback(() => {
    setAudioTracks(prev => {
      const t = prev.find(x => x.key === selectedAudioTrackKey);
      if (!t) return prev;
      const len = (t.trimEnd ?? t.sourceDuration ?? 0) - (t.trimStart ?? 0);
      return [...prev, { ...t, key: String(Date.now()), startOffset: (t.startOffset ?? 0) + len }];
    });
  }, [selectedAudioTrackKey]);

  const splitAudioAtPlayhead = useCallback(() => {
    const t = audioTracks.find(x => x.key === selectedAudioTrackKey);
    if (!t) return;
    const start = t.startOffset ?? 0;
    const ts = t.trimStart ?? 0;
    const te = t.trimEnd ?? t.sourceDuration ?? 0;
    // The playhead is a timeline second; the cut is an offset into the source, which
    // is the trim's origin plus however far into the track the playhead has reached.
    const cut = ts + (positionRef.current - start);
    if (!(cut > ts + MIN_CLIP_DUR && cut < te - MIN_CLIP_DUR)) {
      showAlert('Split', 'Move the playhead inside this track first.');
      return;
    }
    setAudioTracks(prev => prev.flatMap(x => (x.key !== t.key ? [x] : [
      { ...x, key: x.key + '_a', trimEnd: cut },
      { ...x, key: x.key + '_b', trimStart: cut, startOffset: start + (cut - ts) },
    ])));
    setSelectedAudioTrackKey(null);
  }, [audioTracks, selectedAudioTrackKey]);

  const onLongPressVoiceoverTrack = useCallback((key) => {
    showAlert('Delete voiceover?', 'This will remove this voiceover track.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => setAudioTracks(prev => prev.filter(t => t.key !== key)) }]);
  }, []);
  const onLongPressMusicTrack = useCallback((key) => {
    showAlert('Delete music?', 'This will remove this music track.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => setAudioTracks(prev => prev.filter(t => t.key !== key)) }]);
  }, []);
  const onPressAddVoiceover = useCallback(() => {
    setShowVoiceoverModal(true); setVoiceoverTab('generate');
  }, []);
  const onPressAddMusic = useCallback(() => {
    setShowMusicModal(true); setMusicTab('library'); loadMusicLibrary();
  }, []);
  const voiceoverTracksComputed = useMemo(() => {
    return audioTracks.filter(t => t.isVoiceover).map(track => {
      const trackDur = (track.trimEnd ?? track.sourceDuration ?? 0) - (track.trimStart ?? 0);
      const trackW = Math.max(30, trackDur * PIXELS_PER_SECOND);
      const trackX = (track.startOffset ?? 0) * PIXELS_PER_SECOND;
      return { track, trackW, trackX };
    });
  }, [audioTracks]);
  const musicTracksComputed = useMemo(() => {
    return audioTracks.filter(t => t.isMusic).map(track => {
      const trackDur = (track.trimEnd ?? track.sourceDuration ?? 0) - (track.trimStart ?? 0);
      const trackW = Math.max(30, trackDur * PIXELS_PER_SECOND);
      const trackX = (track.startOffset ?? 0) * PIXELS_PER_SECOND;
      return { track, trackW, trackX };
    });
  }, [audioTracks]);

  // Picking a transition has already applied it to this join by the time this runs, so
  // the question is only whether to spread it. Asked rather than offered as a button:
  // the sheet closes on selection, so a button in it could only ever act on the
  // PREVIOUS choice, which is not the one anybody wants to spread.
  const offerApplyToAll = useCallback((id) => {
    const joins = items.length - 1;
    // One join is the whole project; there is nothing else to apply it to.
    if (joins < 2) return;
    // Every join already carries it - usually because this was answered yes a moment
    // ago. Asking again would be noise.
    const already = items.slice(0, -1).every(it => (it.transition || 'none') === id);
    if (already) return;

    setApplyAllPrompt({ id, joins, def: resolveTransition(id) });
  }, [items]);

  const applyTransitionEverywhere = useCallback((id) => {
    setItems(prev => prev.map((it, i) => (
      // The last clip's right edge is the end of the video, so it has nothing to
      // transition into and is left alone.
      i === prev.length - 1 ? it : { ...it, transition: id }
    )));
    setApplyAllPrompt(null);
  }, []);

  function setClipTransition(key, transitionId) {
    setItems(prev => prev.map(i => i.key === key ? { ...i, transition: transitionId } : i));
  }

  function pushHistory(newItems) {
    setHistory(prev => {
      const trimmed = prev.slice(0, historyIndex + 1);
      return [...trimmed, newItems];
    });
    setHistoryIndex(prev => prev + 1);
    setItems(newItems);
  }

  function undo() {
    if (historyIndex <= 0) return;
    const newIndex = historyIndex - 1;
    setHistoryIndex(newIndex);
    setItems(history[newIndex]);
  }

  function redo() {
    if (historyIndex >= history.length - 1) return;
    const newIndex = historyIndex + 1;
    setHistoryIndex(newIndex);
    setItems(history[newIndex]);
  }

  async function pickOverlay() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { showAlert('Permission needed', 'Allow access to photos/videos.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsMultipleSelection: false, quality: 0.8,
    });
    if (!result.canceled) {
      const a = result.assets[0];
      const ovId = newMediaId('ov');
      const ovKey = 'ov_' + Date.now();
      persistInto(setOverlays, ovKey, ovId, a.uri, a.type === 'video' ? 'mp4' : 'jpg');
      setOverlays(prev => [...prev, {
        // Prefixed, because canvas selection is one slot shared with text overlays and
        // both key generators are Date.now(). Two overlays added in the same
        // millisecond is unlikely; two *kinds* colliding on one key is not worth
        // leaving to chance when a prefix costs nothing.
        key: ovKey,
        mediaId: ovId,
        uri: a.uri,
        type: a.type === 'video' ? 'video' : 'image',
        fileName: a.fileName || ('overlay_' + Date.now() + '.' + (a.type === 'video' ? 'mp4' : 'jpg')),
        // Its own pixels, kept so the canvas can draw it at its real proportions
        // rather than guessing a square.
        naturalW: a.width || 0,
        naturalH: a.height || 0,
        // Centre of the frame, as a percentage - the same convention text overlays
        // use, and the same one the export reads.
        x: 50, y: 50, scale: 1, rotation: 0,
      }]);
    }
  }

  // Media overlays and text overlays share the canvas and its one selection slot, but
  // not their state, so the transform has to land in the right list.
  const applyMediaOverlayTransform = useCallback((key, next) => {
    setOverlays(prev => prev.map(o => (o.key === key ? { ...o, ...next } : o)));
  }, []);

  // A sticker joins the same overlays list as a picked image, so it inherits dragging,
  // pinching, rotating, the canvas render and the export compositing without any of it
  // being written twice. What marks it out is that its file is ALREADY on the server:
  // nothing to copy into permanent storage, and nothing to upload at export.
  const addSticker = useCallback((sticker) => {
    const key = 'st_' + Date.now();
    setOverlays(prev => [...prev, {
      key,
      isSticker: true,
      stickerId: sticker.id,
      uri: stickerUri(BACKEND, sticker.id),
      type: 'image',
      fileName: `${sticker.id}.png`,
      // Rendered square and centred on its own ink, so no measurement is needed to
      // place it and two stickers dropped on the same point land in the same place.
      naturalW: 1, naturalH: 1,
      x: 50, y: 50, scale: 1, rotation: 0,
    }]);
    setShowStickerSheet(false);
    setSelectedOverlayKey(key);
  }, []);

  // Crop needs the source's pixel size. Clips added since this shipped carry it from
  // the picker; older ones are measured on the way into the sheet - images by asking
  // React Native, videos through the same sourceLoad the duration probe uses, which
  // reports the track's size in the very same event.
  const openCrop = useCallback(async () => {
    if (!selectedItem) return;
    setShowCropSheet(true);
    if (selectedItem.naturalW && selectedItem.naturalH) {
      setCropSize({ width: selectedItem.naturalW, height: selectedItem.naturalH });
      return;
    }
    setCropSize(null);
    const remember = (width, height) => {
      if (!width || !height) return;
      setCropSize({ width, height });
      setItems(prev => prev.map(i => (
        i.key === selectedItem.key ? { ...i, naturalW: width, naturalH: height } : i
      )));
    };
    if (selectedItem.type === 'image') {
      // react-native's Image, not expo-image: getSize is a static on the RN one.
      Image.getSize(selectedItem.uri, (w, h) => remember(w, h), () => setCropSize(null));
    } else {
      const { width, height } = await measureVideo(selectedItem.uri);
      remember(width, height);
    }
  }, [selectedItem]);

  const confirmRemoveOverlay = useCallback((o) => {
    showAlert('Remove overlay?', 'It will be taken off the video.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          setOverlays(prev => prev.filter(x => x.key !== o.key));
          // Or the canvas keeps a selection pointing at something that is gone.
          setSelectedOverlayKey(prev => (prev === o.key ? null : prev));
        },
      },
    ]);
  }, []);

  async function generateCaptionsFromVoiceover(voiceoverTrack) {
    setShowCaptionModal(false);
    setUploading(true); setMessage('Transcribing voice...'); setProgress(0);
    const progressInterval = setInterval(() => {
      setProgress(p => (p >= 90 ? 90 : p + 3));
    }, 1500);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Not logged in');
      const token = await user.getIdToken();
      const res = await fetch(BACKEND + '/api/transcribe-voiceover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ url: voiceoverTrack.remoteUrl || voiceoverTrack.uri }),
      });
      const data = await readJson(res);
      if (!data.words || data.words.length === 0) throw new Error(data.error || 'No speech detected');

      const style = resolveCaptionStyle(captionStyle);
      // Cadence is part of the style now rather than a list of ids kept beside it,
      // which is what let the two drift: a style added to the catalogue and not to
      // the list silently fell back to three-word chunks.
      const chunkSize = captionChunkSize(style);
      const chunks = [];
      for (let i = 0; i < data.words.length; i += chunkSize) {
        chunks.push(data.words.slice(i, i + chunkSize));
      }
      const startOffset = voiceoverTrack.startOffset || 0;
      const fill = captionFill(style, captionColor);
      const exportSpec = captionExportSpec(style, captionColor);
      const size = captionFontSize(style);
      const highlight = captionHighlight(style);
      const newOverlays = chunks.map((group, idx) => {
        const words = group.map(w => w.word).join(' ');
        return {
          key: 'autocap_' + Date.now() + '_' + idx,
          // Capitalised here rather than only at render: the export renders the
          // string it is handed, so a style that reads as capitals on the canvas
          // and sentence case in the finished file is the one bug worth ruling out
          // up front. The renderer applies the same transform, which is idempotent.
          text: style.upper ? words.toUpperCase() : words,
          // The flat colour is what a renderer with no gradient support falls back
          // to; the gradient itself travels in captionSpec.
          color: fill.color,
          captionColorOverride: captionColor || undefined,
          // The style's family, so the export's font map resolves it like any
          // other overlay. It stays editable in the text sheet afterwards.
          font: style.font || 'Default',
          size,
          // Centre-anchored: 50 is the middle of the frame whatever the phrase
          // happens to be, which a left-edge percentage could never be.
          x: 50, y: 80,
          scale: 1,
          rotation: 0,
          startTime: startOffset + group[0].start,
          endTime: startOffset + group[group.length - 1].end,
          // Per-word timings, kept only for the styles that chip the spoken word -
          // every caption carrying a copy of its words would be paid for by every
          // project, to be read by almost none of them. Offset like the phrase's own
          // times, or the chip would lead the voice by the length of the intro.
          words: highlight
            ? group.map(w => ({
              word: style.upper ? String(w.word).toUpperCase() : w.word,
              start: startOffset + w.start,
              end: startOffset + w.end,
            }))
            : undefined,
          isAutoCaption: true,
          captionStyleId: style.id,
          captionSpec: exportSpec,
        };
      });

      setTextOverlays(prev => [...prev.filter(t => !t.isAutoCaption), ...newOverlays]);
      clearInterval(progressInterval); setProgress(100);
      setUploading(false);
      showAlert('Done', 'Captions generated from your voiceover!');
    } catch (e) { clearInterval(progressInterval); showAlert('Error', e.message); setUploading(false); }
  }

  async function handleAutoCaption() {
    const voiceoverTrack = audioTracks.find(t => t.isVoiceover);
    if (voiceoverTrack) { generateCaptionsFromVoiceover(voiceoverTrack); return; }
    if (items.length === 0) { showAlert('No media', 'Add a video clip first.'); return; }
    const videoItem = items.find(i => i.type === 'video');
    if (!videoItem) { showAlert('No video', 'Auto Captions requires at least one video clip.'); return; }
    setShowCaptionModal(false);
    setUploading(true); setMessage('Generating captions...');
    const style = resolveCaptionStyle(captionStyle);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Not logged in');
      const token = await user.getIdToken();
      const res = await fetch(BACKEND + '/api/edit-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({
          videoUrl: videoItem.uri,
          script: captionScript,
          captionStyle: captionStyle,
          // The server burns these in itself, so it needs the style rather than
          // just its name - it has no copy of the catalogue to look the name up in.
          captionMeta: {
            spec: captionExportSpec(style, captionColor),
            font: style.font || null,
            size: captionFontSize(style),
            color: captionFill(style, captionColor).color,
            upper: !!style.upper,
            words: captionChunkSize(style),
          },
          userId: user.uid,
        }),
      });
      const { jobId, error } = await readJson(res);
      if (!jobId) {
        if (res.status === 402 || res.status === 403) {
          promptUpgrade(null, error);
        } else {
          showAlert('Error', error || 'Failed to start caption job');
        }
        setUploading(false);
        return;
      }
      pollCaptionJob(jobId);
    } catch (e) { showAlert('Error', e.message); setUploading(false); }
  }

  function pollCaptionJob(jobId) {
    // Same shape as pollJob below: readJson can throw a message worth showing, and an
    // empty catch here had the same failure mode pollJob's did before it was fixed -
    // a job that could not be reached would poll forever with nothing on screen ever
    // saying so.
    let consecutiveFailures = 0;
    const interval = setInterval(async () => {
      try {
        const r = await apiFetch('/api/job/' + jobId);
        const job = await readJson(r);
        consecutiveFailures = 0;
        setProgress(job.progress || 0); setMessage(job.message || '');
        if (job.status === 'done') {
          clearInterval(interval); setUploading(false);
          const captionedUrl = BACKEND + job.videoUrl;
          setItems(prev => prev.map((item, i) =>
            i === 0 ? { ...item, uri: captionedUrl, type: 'video' } : item
          ));
          showAlert('Done', 'Captions added to your first clip!');
        } else if (job.status === 'error') {
          clearInterval(interval); setUploading(false);
          showAlert('Error', job.error || 'Caption generation failed');
        }
      } catch (e) {
        consecutiveFailures += 1;
        if (consecutiveFailures >= 8) {
          clearInterval(interval); setUploading(false);
          showAlert('Lost track of the caption job', e.message);
        }
      }
    }, 2000);
  }

  function pollJob(jobId) {
    let consecutiveFailures = 0;
    const interval = setInterval(async () => {
      try {
        // This poll sent no Authorization header, so it got 401 forever while the
        // render finished perfectly: job.progress came back undefined, the bar sat at
        // 0%, job.status was never 'done', and the export looked broken when the video
        // was already on disk.
        const r = await apiFetch('/api/job/' + jobId);
        if (!r.ok) throw new Error(`Job status ${r.status}`);
        const job = await readJson(r);
        consecutiveFailures = 0;
        setProgress(job.progress || 0); setMessage(job.message || '');
        if (job.status === 'done') {
          clearInterval(interval); setUploading(false);
          // Asked here rather than on first launch. Before anything has been made the
          // honest answer to "can we notify you" is no, and a refusal is permanent -
          // Android will not show the dialog twice. Someone who has just finished a
          // video has a reason to say yes.
          //
          // Scheduling also RESTARTS the series, so the nudges mean "you have not been
          // here in a while" rather than firing on a clock set before this export.
          requestNotificationPermission().then(ok => { if (ok) scheduleReminders(); });
          navigation.navigate('EditPostVideo', { videoUrl: job.videoUrl, videoPath: job.videoUrl });
        } else if (job.status === 'error') {
          clearInterval(interval); setUploading(false);
          showAlert('Export failed', job.error || 'Video creation failed');
        }
      } catch (e) {
        // A dropped packet on mobile data is normal and not worth reporting; a poll
        // that cannot succeed at all is, and swallowing it silently is exactly how a
        // 401 went unnoticed while the bar sat at zero.
        consecutiveFailures += 1;
        if (consecutiveFailures >= 8) {
          clearInterval(interval); setUploading(false);
          showAlert(
            'Lost track of the export',
            `The video may still be rendering. ${e.message}`,
          );
        }
      }
    }, 2000);
  }

  // Current preview item based on playback position
  // Returns the clip under the playhead together with the timeline second it
  // starts at. The start is what lets the canvas be seeked to the right frame
  // within the clip instead of always playing it from its beginning.
  const getPreviewItem = () => {
    let t = 0;
    for (const item of items) {
      const d = clipLength(item);
      if (position <= t + d) return { item, start: t };
      t += d;
    }
    return { item: items[items.length - 1], start: Math.max(0, t - clipLength(items[items.length - 1])) };
  };

  // Selecting a clip pins the canvas to it so it can be trimmed and inspected,
  // but only while paused. During playback the playhead wins: otherwise the
  // timeline auto-scrolls through every clip while the canvas sits frozen on
  // whichever one happens to be selected, and tapping a clip is how nearly
  // every edit starts.
  const playheadClip = items.length > 0 ? getPreviewItem() : null;
  const previewItem = items.length > 0
    ? ((isPlaying ? null : selectedItem) || playheadClip.item)
    : null;
  const previewClipStart =
    playheadClip && previewItem && previewItem.key === playheadClip.item.key
      ? playheadClip.start
      : null;
  // Read by the mixer pass, which is created once and must not close over
  // render-scoped values.
  const previewClipRef = useRef(null);
  previewClipRef.current = previewItem && previewItem.type === 'video'
    ? {
        key: previewItem.key,
        trimStart: previewItem.trimStart ?? 0,
        clipStart: previewClipStart,
        clipLen: clipLength(previewItem),
      }
    : null;
  const previewVideoSource = useMemo(() => (previewItem ? { uri: previewItem.uri } : null), [previewItem?.uri]);

  // The timeline second of every join that actually has a transition on it. Held in a
  // ref because the playback loop is created once and must not close over items.
  const joinTimesRef = useRef([]);
  useEffect(() => {
    const out = [];
    let t = 0;
    for (let i = 0; i < items.length - 1; i += 1) {
      t += clipLength(items[i]);
      if (hasTransition(items[i].transition)) out.push(t);
    }
    joinTimesRef.current = out;
  }, [items]);

  // The join the playhead is currently crossing, if any.
  //
  // Two real layers: the outgoing clip in the main <Video>, the incoming one stacked
  // on top, moved and masked exactly as transitionPreviewFrame says. What made that
  // still look wrong on a device, even with the maths right and the seek fixed, is a
  // cost that only exists on a device: opening a video file and seeking it takes real
  // time - a hundred milliseconds at best, and on some files and phones a good deal
  // more. WINDOW is short (0.3s) on purpose, because that is the span the blend
  // itself should run over - but a decoder given only 0.3s to open, buffer and seek
  // before it is expected to show a frame will often show nothing, or a stale one,
  // for most of that time. The export never pays this cost: ffmpeg has the whole file
  // already decoded on disk.
  //
  // LOOKAHEAD fixes the cause instead of the symptom. The incoming layer mounts up to
  // a second and a half before the join - far more time than any file needs to open -
  // and sits there paused on its correct first frame (see JoinClipLayer). Only once
  // we are within WINDOW of the join does `p` leave zero and the blend actually start
  // moving, the same instant it always did; the difference is the layer has had a
  // long head start to be READY, instead of being asked to load and perform in the
  // same 0.3 seconds.
  const WINDOW = 0.3;
  const LOOKAHEAD = 1.5;
  const activeJoin = useMemo(() => {
    if (items.length < 2) return null;
    let t = 0;
    for (let i = 0; i < items.length - 1; i += 1) {
      t += clipLength(items[i]);
      if (position >= t - LOOKAHEAD && position < t) {
        const def = resolveTransition(items[i].transition);
        if (!def?.base) return null;
        // Clamped to 0 for the whole lookahead-but-not-blending span, which is
        // exactly the state every transition already starts from - a dissolve at p=0
        // is fully transparent, a slide at p=0 is fully off-frame, a mask at p=0 is
        // fully closed. Mounting early and simply holding p at 0 is what keeps the
        // layer invisible during the head start, with no second "warming" style to
        // keep in sync with the real one.
        const raw = (position - (t - WINDOW)) / WINDOW;
        return {
          def,
          p: Math.max(0, Math.min(1, raw)),
          active: raw > 0,
          outItem: items[i],
          incItem: items[i + 1],
          fidelity: previewFidelity(items[i].transition),
        };
      }
      if (t - position > LOOKAHEAD) break;
    }
    return null;
  }, [items, position]);

  // The two layers the join is drawn from, in screen units.
  const joinLayers = useMemo(() => {
    if (!activeJoin) return null;
    const f = transitionPreviewFrame(activeJoin.def.base, activeJoin.p);
    const toStyle = (l) => ({
      opacity: l.opacity,
      transform: [
        { translateX: l.tx * frame.w },
        { translateY: l.ty * frame.h },
        { scale: l.scale },
      ],
    });
    // The main <Video> is the outgoing clip for the whole window, so the second
    // layer is always the incoming one.
    return {
      main: toStyle(f.out),
      other: toStyle(f.inc),
      otherItem: activeJoin.incItem,
      mask: f.mask || null,
      tint: f.tint,
      active: activeJoin.active,
    };
  // `frame` in the deps too: it is a NEW object whenever the aspect ratio changes,
  // and this used to recompute only when the playhead moved - so a join layer's
  // translate would be sized against a frame that no longer matched the canvas until
  // the next join was reached.
  }, [activeJoin, frame]);

  // Held across renders on purpose. `position` is React state written ~25 times a
  // second during playback, so this screen re-renders at that rate - and building
  // this list inline meant reconciling a native VideoView, and rebuilding every
  // handler closure, 25 times a second for overlays that do not depend on the
  // playhead at all. That work lands on the JS thread, which is the same thread the
  // timeline's scroll and the RAF playback clock run on, so it showed up as the
  // timeline stuttering while a picture-in-picture clip played.
  //
  // Text overlays legitimately rebuild per tick: a caption's chip follows the spoken
  // word, so `playhead` really is one of their inputs. These have no such input.
  const mediaOverlayViews = useMemo(() => overlays.map(o => (
    <CanvasOverlay
      key={o.key}
      overlay={o}
      containerW={frame.w}
      containerH={frame.h}
      selected={selectedOverlayKey === o.key}
      onSelect={setSelectedOverlayKey}
      onTransform={applyMediaOverlayTransform}
      onTap={() => setSelectedOverlayKey(o.key)}
      onLongPress={() => confirmRemoveOverlay(o)}
    >
      <MediaOverlayContent overlay={o} isPlaying={isPlaying} frameW={frame.w} />
    </CanvasOverlay>
  )), [overlays, selectedOverlayKey, isPlaying, applyMediaOverlayTransform, confirmRemoveOverlay]);

  // Same reasoning as mediaOverlayViews above, for text. position is a real
  // dependency (auto-captions gate on it, and playhead drives which word a
  // highlight style chips) so this still recomputes during playback - the
  // point is only to stop recomputing for state this list has nothing to do
  // with, like export progress.
  const textOverlayViews = useMemo(
    () => textOverlays
      .filter(t => !t.isAutoCaption || (position >= t.startTime && position <= t.endTime))
      .map(t => (
        <CanvasOverlay
          key={t.key}
          overlay={t}
          containerW={frame.w}
          containerH={frame.h}
          selected={selectedOverlayKey === t.key}
          onSelect={setSelectedOverlayKey}
          onTransform={applyOverlayTransform}
          onTap={openOverlayEditor}
          onLongPress={openOverlayStyleSheet}
          onEditDone={endInlineEdit}
          editing={inlineEditKey === t.key}
          // Side-handle width resize is Canva's move for a text block, not
          // a caption's - a caption style has no independent box-width
          // concept, and the export only knows how to wrap by width for
          // this one kind of overlay (see boxWidthPercent in server.js).
          resizableWidth={!t.captionStyleId && !t.isAutoCaption}
        >
          <TextOverlayContent
            overlay={t}
            maxWidth={frame.w * 0.8}
            boxWidth={t.boxWidthPercent ? (t.boxWidthPercent / 100) * frame.w * (t.scale ?? 1) : null}
            playhead={position}
            editing={inlineEditKey === t.key}
            onChangeText={setOverlayText}
            onEndEditing={endInlineEdit}
          />
        </CanvasOverlay>
      )),
    [
      textOverlays, position, frame.w, frame.h, selectedOverlayKey, inlineEditKey,
      applyOverlayTransform, openOverlayEditor, openOverlayStyleSheet, endInlineEdit, setOverlayText,
    ]
  );

  // Put the canvas on the frame a given timeline second points at. Every path
  // that moves the playhead somewhere the decoder is not already heading goes
  // through here, so the clock is invalidated in one place too.
  const seekVideoTo = useCallback((timelineSec) => {
    const clip = previewClipRef.current;
    if (!clip || !videoRef.current) return;
    const targetSec = clip.clipStart != null
      ? clip.trimStart + Math.max(0, timelineSec - clip.clipStart)
      : clip.trimStart;
    videoClockRef.current = null;
    videoSeekTargetRef.current = clip.clipStart != null
      ? { sec: timelineSec, at: Date.now() }
      : null;
    videoRef.current.setPositionAsync(targetSec * 1000).catch(() => {});
  }, []);
  seekVideoToRef.current = seekVideoTo;

  // The canvas reporting where the decoder really is. Translated into a
  // timeline second for the RAF loop to follow.
  const onVideoStatus = useCallback((status) => {
    const clip = previewClipRef.current;
    if (!status?.isLoaded || !status.isPlaying || !clip || clip.clipStart == null) {
      videoClockRef.current = null;
      return;
    }
    // Right after a source swap expo-av still reports the outgoing clip's
    // position. Adopting that would yank the timeline to an unrelated second,
    // so only readings that fall inside the current clip's window count.
    const inClip = status.positionMillis / 1000 - clip.trimStart;
    if (inClip < -0.5 || inClip > clip.clipLen + 0.5) {
      videoClockRef.current = null;
      return;
    }
    const timelineSec = clip.clipStart + inClip;
    const pending = videoSeekTargetRef.current;
    if (pending) {
      // Still the pre-seek position. Give the seek a second to land - a
      // keyframe-snapped one may never land close, and waiting forever would
      // leave the timeline on its wall clock permanently.
      if (Math.abs(timelineSec - pending.sec) > 0.6 && Date.now() - pending.at < 1000) return;
      videoSeekTargetRef.current = null;
    }
    videoClockRef.current = { timelineSec, at: Date.now() };
  }, []);

  // Seek the moment the playhead crosses into a new clip rather than waiting up
  // to 200ms for the next mixer pass to notice. A freshly swapped source loads
  // at 0, which is the wrong frame for any clip carrying a trimStart.
  const previewKey = previewItem?.key;
  useEffect(() => { seekVideoTo(positionRef.current); }, [previewKey, seekVideoTo]);

  // Pressing play left the canvas wherever the decoder happened to be - the end
  // of the previous run, or 0 - while the timeline started scrolling from the
  // playhead, and nothing reconciled the two until the mixer's next pass. Seek
  // up front so the first frame of playback is the frame under the scrubber.
  useEffect(() => {
    if (!isPlaying) { videoClockRef.current = null; return; }
    seekVideoTo(positionRef.current);
  }, [isPlaying, seekVideoTo]);

  // Keep the canvas on the scrubbed frame while paused. Without this the
  // preview holds a stale frame for the whole scrub, so it is already out of
  // sync with the timeline before play is ever pressed. Debounced: a scrub
  // emits positions far faster than the decoder can serve seeks.
  useEffect(() => {
    if (isPlaying) return;
    const t = setTimeout(() => seekVideoTo(position), 90);
    return () => clearTimeout(t);
  }, [position, isPlaying, previewKey, seekVideoTo]);
  const audioSheetTrack = useMemo(
    () => audioTracks.find(t => t.key === audioSheetKey) || null, [audioTracks, audioSheetKey]);

  // The bar with nothing selected. `built` says whether the tab has anything behind
  // it; an unbuilt one does not switch, because switching would show an empty tool row
  // and read as the app breaking rather than as a feature not being ready.
  const bottomTabs = [
    { name: 'Edit', icon: 'content-cut', built: true },
    { name: 'Audio', icon: 'music-note', built: true },
    { name: 'Text', icon: 'title', built: true },
    { name: 'Effects', icon: 'auto-awesome', built: true },
    { name: 'Overlay', icon: 'image', built: true },
    { name: 'Captions', icon: 'closed-caption', built: true },
    // Filters is genuinely built: the grades and applyFilter already exist, they were
    // only reachable from inside the Effects tab and from a selected clip.
    { name: 'Filters', icon: 'photo-filter', built: true },
    { name: 'Adjust', icon: 'tune', built: true },
    { name: 'Stickers', icon: 'emoji-emotions', built: true },
    { name: 'AI avatar', icon: 'smart-toy', built: false, premium: true },
    { name: 'Aspect ratio', icon: 'aspect-ratio', built: true },
    { name: 'Background', icon: 'wallpaper', built: true },
  ];

  const [showImageDurationModal, setShowImageDurationModal] = useState(false);
  const [showAudioListModal, setShowAudioListModal] = useState(false);
  // 'speed' | 'filter' | null. Kept as which sheet rather than as its contents, so the
  // options are rebuilt from live state each render and cannot show a stale selection.
  const [chipPicker, setChipPicker] = useState(null);
  const [showTextListModal, setShowTextListModal] = useState(false);

  const getTabTools = () => {
    switch (activeTab) {
      case 'Edit':
        return [
          { key: 'split', icon: 'content-cut', label: 'Split', onPress: splitAtPlayhead },
          { key: 'trim', icon: 'straighten', label: 'Trim', onPress: () => selectedItem && openTrim(selectedItem) },
          { key: 'delete', icon: 'delete', label: 'Delete', color: '#ff6b6b', onPress: () => selectedKey && removeItem(selectedKey) },
          { key: 'res', icon: 'hd', label: resolution, color: '#00d4d4', onPress: () => setShowResModal(true) },
          ...(selectedItem?.type === 'image' ? [{ key: 'duration', icon: 'timer', label: selectedItem.duration + 's', onPress: () => setShowImageDurationModal(true) }] : []),
        ];
      case 'Audio':
        return [
          { key: 'addmusic', icon: 'add', label: 'Add Music', onPress: pickAudio },
          { key: 'volume', icon: 'volume-up', label: 'Volume', onPress: () => setShowVolumeModal(true) },
          ...(selectedItem ? [{ key: 'mute', icon: selectedItem.muted ? 'volume-off' : 'volume-up', label: selectedItem.muted ? 'Unmute' : 'Mute', onPress: () => setItems(prev => prev.map(i => i.key === selectedKey ? { ...i, muted: !i.muted } : i)) }] : []),
          ...(audioTracks.length > 0 ? [{ key: 'tracks', icon: 'queue-music', label: `Tracks (${audioTracks.length})`, color: '#00d4d4', onPress: () => setShowAudioListModal(true) }] : []),
        ];
      case 'Text':
        return [
          { key: 'addtext', icon: 'add', label: 'Add Text', onPress: () => { setEditingText(null); setTextInput(''); setShowTextModal(true); } },
          ...(textOverlays.length > 0 ? [{ key: 'textlist', icon: 'format-list-bulleted', label: `Texts (${textOverlays.length})`, color: '#00d4d4', onPress: () => setShowTextListModal(true) }] : []),
        ];
      case 'Effects':
        // This tab used to list the seven legacy filter names and the speeds - a worse
        // copy of the Filters tab sitting next to it, which is why the app read as
        // having no effects. An effect is something HAPPENING on the footage; a filter
        // is a grade. They are different catalogues and now different tabs.
        if (!selectedItem) return [{ key: 'fxhint', icon: 'auto-awesome', label: 'Select a clip', color: '#5a5a5a', onPress: () => {} }];
        return [{
          key: 'openeffects',
          icon: 'auto-awesome',
          label: resolveEffect(selectedItem?.effect).label,
          color: '#00d4d4',
          onPress: () => setShowEffectSheet(true),
        }];
      case 'Background':
        return [{
          key: 'openbg', icon: 'wallpaper',
          label: bg.fit === 'fit' ? `Fit · ${bg.type === 'colour' ? 'Colour' : 'Blur'}` : 'Fill',
          color: bg.fit === 'fit' ? '#00d4d4' : undefined,
          onPress: () => setShowBackgroundSheet(true),
        }];
      case 'Stickers':
        return [{
          key: 'openstickers', icon: 'emoji-emotions', label: 'Add sticker',
          onPress: () => setShowStickerSheet(true),
        }];
      case 'Aspect ratio':
        return ASPECT_RATIOS.map(a => ({
          key: 'ar-' + a.id,
          label: a.label,
          active: aspectRatio === a.id,
          onPress: () => setAspectRatio(a.id),
        }));
      case 'Adjust':
        return [{
          key: 'openadjust',
          icon: 'tune',
          label: hasAdjustments(selectedItem?.adjust) ? 'Adjusted' : 'Adjust',
          color: hasAdjustments(selectedItem?.adjust) ? '#00d4d4' : undefined,
          onPress: () => setShowAdjustSheet(true),
        }];
      case 'Filters':
        // One button into the catalogue rather than seven chips. 77 grades cannot be
        // chosen from a scrolling row of words - a filter is picked by looking at it.
        return [{
          key: 'openfilters',
          icon: 'photo-filter',
          label: resolveFilter(selectedItem?.filter).label,
          color: '#00d4d4',
          onPress: () => setShowFilterSheet(true),
        }];
      case 'Overlay':
        return [
          { key: 'addoverlay', icon: 'add-photo-alternate', label: 'Add Overlay', onPress: pickOverlay },
          ...overlays.map(o => ({
            key: 'ov-' + o.key,
            label: o.type,
            isOverlayThumb: true,
            overlay: o,
            // Was a no-op, so the thumbnail looked like a control and was not one.
            onPress: () => setSelectedOverlayKey(o.key),
            onLongPress: () => confirmRemoveOverlay(o),
          })),
        ];
      case 'Captions':
        return [
          { key: 'autocap', icon: 'closed-caption', label: 'Auto Captions', onPress: () => setShowCaptionModal(true) },
          { key: 'addcap', icon: 'add', label: 'Add Caption', onPress: () => { setEditingText(null); setTextInput(''); setShowTextModal(true); } },
        ];
      default: return [];
    }
  };

  // What each rail button does, keyed the same way the rows are. Defined here rather
  // than in ADD_RAIL because these are the screen's own handlers, and ADD_RAIL is only
  // the order and the icons.
  const railActions = useMemo(() => ({
    clips: pickMedia,
    voiceover: onPressAddVoiceover,
    music: onPressAddMusic,
    text: onPressAddText,
    captions: openCaptionModal,
  }), [pickMedia, onPressAddVoiceover, onPressAddMusic, onPressAddText, openCaptionModal]);

  // What each clip tool does. Only the ones already built are here; anything absent
  // falls through to a "coming soon" below rather than being silently inert, so the
  // bar is honest about which of its buttons are wired.
  const { isPremium, caps } = usePlan();

  // Whether a paid plan would actually change anything about this tool right now.
  // A diamond on something UNBUILT marks it as a planned tier, not as something an
  // upgrade unlocks today - so an unbuilt tool keeps saying "coming soon" whatever
  // the plan is. Telling a paying user to pay for a feature that does not exist is
  // the one outcome worth engineering around.
  const toolTapAction = useCallback((t, actions) => {
    const action = actions[t.key];
    if (!action) {
      return () => showAlert(
        t.label,
        t.premium
          ? 'Coming soon on the paid plans.'
          : 'Coming soon.'
      );
    }
    if (t.premium && !isPremium) return () => promptUpgrade(t.label);
    return action;
  }, [isPremium]);

  const clipToolActions = {
    replace: replaceSelectedClip,
    trim: () => selectedItem && openTrim(selectedItem),
    split: splitAtPlayhead,
    overlay: pickOverlay,
    volume: () => setShowClipVolumeModal(true),
    audio: () => setShowAudioListModal(true),
    captions: openCaptionModal,
    speed: () => setChipPicker('speed'),
    transition: () => selectedKey && onPressClipTransition(selectedKey),
    filters: () => setShowFilterSheet(true),
    motion: () => setShowMotionSheet(true),
    effect: () => setShowEffectSheet(true),
    // BG Remover opens the green-screen sheet, which says plainly that it needs a real
    // screen. Cutting a person out of an ordinary room needs a model; keying a known
    // colour does not, and only one of those is free.
    extractaudio: () => selectedItem && extractClipAudio(selectedItem),
    audioeffects: () => {
      if (!selectedItem) return;
      if (selectedItem.type === 'image') {
        return showAlert('Audio effects', 'A photo has no sound to work on.');
      }
      if (selectedItem.muted) {
        // Silently applying an effect to a muted clip produces a render identical to
        // not applying it, which reads as the effect being broken rather than as the
        // clip being off.
        return showAlert('Audio effects', 'This clip is muted. Turn its volume up first.');
      }
      setAudioFxTarget('clip');
    },
    bgremover: () => {
      if (!selectedItem) return;
      if (selectedItem.type === 'image') {
        return showAlert('Green screen', 'This works on a video clip.');
      }
      setShowChromaSheet(true);
    },
    freeze: () => {
      if (!selectedItem) return;
      if (selectedItem.type === 'image') {
        return showAlert('Freeze', 'A photo is already a held frame. Drag its edge to hold it longer.');
      }
      setChipPicker('freeze');
    },
    enhancevoice: () => {
      if (!selectedItem) return;
      if (selectedItem.type === 'image') {
        return showAlert('Enhance voice', 'A photo has no sound to enhance.');
      }
      const on = !selectedItem.enhanceVoice;
      setItems(prev => prev.map(i => (i.key === selectedKey ? { ...i, enhanceVoice: on } : i)));
      showAlert(on ? 'Voice enhancement on' : 'Voice enhancement off', on
        ? "This clip's own audio will be cleaned up and levelled when you export."
        : 'This clip will export as recorded.');
    },
    adjust: () => setShowAdjustSheet(true),
    // Colour is what Adjust IS - brightness, contrast, saturation, temperature, tint,
    // highlights, shadows, and three more. A separate colour tool would be a second
    // sheet of the same ten sliders, so this is the same door with the other name on it.
    colour: () => setShowAdjustSheet(true),
    transform: () => selectedItem && setShowTransformSheet(true),
    transparency: () => selectedItem && setShowTransparencySheet(true),
    layers: () => setShowLayersSheet(true),
    mask: () => selectedItem && setShowMaskSheet(true),
    // Animating a CLIP is a camera move, and this app has 66 of them. A separate
    // animation tool would be a second way to say the same thing - the same mistake
    // Colour and Retouch would have been.
    animate: () => selectedItem && setShowMotionSheet(true),
    // Beats on a CLIP finds the pulse in the clip's own sound, so cuts land on the
    // music that is already in the footage rather than on a track added over it.
    beats: () => selectedItem && detectClipBeats(selectedItem),
    // Magic Studio is a bundle, not a new capability: it turns on the things this app
    // already does that almost every clip wants, in one tap. Named for what it applies
    // rather than promising a model that is not there.
    magic: () => {
      if (!selectedItem) return;
      const isImage = selectedItem.type === 'image';
      const key = selectedItem.key;
      setItems(prev => prev.map(i => (i.key === key
        ? {
            ...i,
            adjust: { ...(i.adjust || {}), contrast: 8, saturation: 10, sharpen: 12 },
            ...(isImage ? {} : { denoise: true, enhanceVoice: true }),
          }
        : i)));
      showAlert('Magic Studio', isImage
        ? 'Contrast, colour and sharpness lifted. Open Adjust to fine-tune.'
        : 'Contrast, colour and sharpness lifted, background noise reduced and the voice evened out. Open Adjust to fine-tune.');
    },
    // Retouch already exists as a real effect in the Beauty category (edge-preserving
    // smartblur, a small lift, a touch of warmth). It needed a way in, not building.
    retouch: () => {
      if (!selectedItem) return;
      if (selectedItem.type === 'image') return showAlert('Retouch', 'This works on a video clip.');
      applyEffect('retouch');
      showAlert('Retouch', 'Skin smoothing applied. Open Effects to change or remove it.');
    },
    // Unlink is Extract audio PLUS muting the clip - the two halves of "separate this
    // clip's sound from its picture". Extract on its own deliberately does not mute,
    // because there the extracted track is the same sound; here detaching is the point.
    unlink: async () => {
      if (!selectedItem) return;
      if (selectedItem.type === 'image') return showAlert('Unlink', 'A photo has no sound to unlink.');
      const key = selectedItem.key;
      await extractClipAudio(selectedItem);
      setItems(prev => prev.map(i => (i.key === key ? { ...i, muted: true } : i)));
    },
    crop: openCrop,
    flip: () => setChipPicker('flip'),
    // ffmpeg-native, so they cost CPU and nothing else - no model and no per-use fee.
    reverse: () => {
      if (selectedItem?.type === 'image') {
        return showAlert('Reverse', 'A photo has nothing to reverse. Try it on a video clip.');
      }
      if (!selectedItem?.reverse && clipSpanSeconds(selectedItem) > REVERSE_MAX_SECONDS) {
        return showAlert('Reverse', `Reverse works on clips up to ${REVERSE_MAX_SECONDS} seconds. Trim this clip shorter and try again.`);
      }
      toggleClipFlag('reverse');
    },
    reducenoise: () => {
      if (selectedItem?.type === 'image') {
        return showAlert('Reduce noise', 'A photo has no sound to clean up. Try it on a video clip.');
      }
      toggleClipFlag('denoise');
    },
    motionblur: () => {
      if (selectedItem?.type === 'image') {
        return showAlert('Motion blur', 'Motion blur blends neighbouring frames, so it needs a video clip.');
      }
      toggleClipFlag('motionBlur');
    },
    // Two ffmpeg passes over the clip - one to measure the camera's motion, one to
    // correct it - so it is the slowest tool here by a distance. Said plainly the
    // first time it is switched on, since an export that takes noticeably longer
    // with no explanation reads as the app hanging, which this project has already
    // been caught by once.
    translate: () => {
      if (selectedItem?.type === 'image') {
        return showAlert('Video translator', 'A photo has no speech to translate. Try it on a video clip.');
      }
      openTranslateSheet();
    },
    stabilize: () => {
      if (selectedItem?.type === 'image') {
        return showAlert('Stabilize', 'A photo has no camera shake to remove. Try it on a video clip.');
      }
      const turningOn = !selectedItem?.stabilize;
      toggleClipFlag('stabilize');
      if (turningOn) {
        showAlert('Stabilize', 'Shake will be smoothed out when you export. This clip takes a little longer to render because it is analysed first.');
      }
    },
    // Built rather than dimmed: both are operations on the item list, which this
    // screen already owns. Adding them greyed out alongside the model calls would
    // have been the lazy reading of "add these tools".
    duplicate: duplicateSelectedClip,
    delete: confirmDeleteSelectedClip,
  };

  const toggleFlip = (axis) => setItems(prev => prev.map(i => (
    i.key === selectedKey ? { ...i, [axis]: !i[axis] } : i
  )));

  // Clip tools that are a single on/off property on the item, applied by ffmpeg at
  // export. Kept as one table so the toolbar can show which are on without each
  // needing its own piece of state, and so adding the next one is a line here plus
  // a filter on the server rather than a new mechanism.
  // Mirrors TRANSLATE_LANGS on the server. Kept here as well so the sheet opens
  // with something the moment it is tapped rather than after a round trip, and
  // refreshed from /api/translate-languages when that answers - so adding a
  // language on the server reaches existing installs without an app update.
  const TRANSLATE_FALLBACK_LANGS = [
    { code: 'es', label: 'Spanish' }, { code: 'fr', label: 'French' },
    { code: 'de', label: 'German' }, { code: 'pt', label: 'Portuguese' },
    { code: 'it', label: 'Italian' }, { code: 'hi', label: 'Hindi' },
    { code: 'ar', label: 'Arabic' }, { code: 'sw', label: 'Swahili' },
    { code: 'zh', label: 'Chinese' }, { code: 'ja', label: 'Japanese' },
    { code: 'ko', label: 'Korean' }, { code: 'ru', label: 'Russian' },
    { code: 'tr', label: 'Turkish' }, { code: 'en', label: 'English' },
  ];
  const [translateSheet, setTranslateSheet] = useState(false);
  const [translateLangs, setTranslateLangs] = useState(TRANSLATE_FALLBACK_LANGS);

  const openTranslateSheet = useCallback(async () => {
    setTranslateSheet(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(BACKEND + '/api/translate-languages', {
        headers: token ? { Authorization: 'Bearer ' + token } : {},
      });
      const data = await readJson(res);
      if (Array.isArray(data.languages) && data.languages.length) setTranslateLangs(data.languages);
    } catch (e) {
      // The fallback list is already on screen; a failed refresh changes nothing.
    }
  }, []);

  // Transcribe -> translate -> speak, all on the server. The result arrives as an
  // audio URL and goes onto the timeline as a voiceover, with the clip's own sound
  // muted - otherwise the original narration plays underneath the translation.
  // Pull a clip's own sound out into a track of its own.
  //
  // Deliberately does NOT mute the source, unlike Translate - which must, or the
  // original narration plays under the translation. Here the extracted audio is the
  // SAME sound, so muting would leave the timeline sounding identical while looking
  // changed, and un-muting is not obviously the fix for that. Detaching sound from
  // picture is a means to an end (fade it, move it, keep it past the clip), and which
  // of those the user wants is theirs to choose next.
  const extractClipAudio = useCallback(async (item) => {
    if (item.type === 'image') {
      return showAlert('Extract audio', 'A photo has no sound to extract.');
    }
    try {
      setUploading(true); setProgress(0); setMessage('Preparing clip...');
      const user = auth.currentUser;
      if (!user) throw new Error('Not logged in');
      const token = await user.getIdToken();

      // Same on-demand upload as Translate: the clip lives on the device until an
      // export sends it, and the server cannot read what it has never received. The
      // URL is kept on the item so a second extraction does not re-send it.
      let url = item.remoteUrl;
      if (!url) {
        const form = new FormData();
        form.append('files', { uri: item.uri, name: 'clip.mp4', type: 'video/mp4' });
        const upRes = await fetch(BACKEND + '/api/upload-media', {
          method: 'POST', headers: { Authorization: 'Bearer ' + token }, body: form,
        });
        const upData = await readJson(upRes);
        if (upData.error) throw new Error(upData.error);
        url = upData.items?.[0]?.url;
        if (!url) throw new Error('That clip could not be uploaded.');
        setItems(prev => prev.map(i => (i.key === item.key ? { ...i, remoteUrl: url } : i)));
      }

      setMessage('Extracting audio...');
      const res = await apiFetch('/api/extract-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await readJson(res);
      if (data.error || !data.audioUrl) throw new Error(data.error || 'Could not extract the audio.');

      // Cached locally before it goes on the timeline: left remote, expo-av streams it
      // while the video is also decoding and the playback breaks up mid-sentence.
      // remoteUrl keeps the export pointed at the copy the server already has.
      const remote = BACKEND + data.audioUrl;
      const audId = newMediaId('vo');
      const local = await cacheRemoteMedia(remote, audId, 'mp3');
      addVoiceoverTrack({
        key: String(Date.now()) + '_extract',
        mediaId: audId,
        uri: local || remote,
        remoteUrl: remote,
        name: `${item.name || 'Clip'} audio`,
        volume: 1,
      });

      setUploading(false);
      showAlert('Audio extracted',
        'The clip’s sound is now its own track. Mute the clip if you want only the track to play.');
    } catch (e) {
      setUploading(false);
      showAlert('Extract audio', e.message || 'Could not extract the audio from this clip.');
    }
  }, [items]); // eslint-disable-line react-hooks/exhaustive-deps

  const runTranslate = useCallback(async (lang) => {
    setTranslateSheet(false);
    const item = items.find(i => i.key === selectedKey);
    if (!item) return;
    try {
      setUploading(true); setProgress(0); setMessage('Preparing clip...');
      const user = auth.currentUser;
      if (!user) throw new Error('Not logged in');
      const token = await user.getIdToken();

      // The clip lives on the device until an export uploads it, and the server
      // cannot transcribe what it cannot read. Uploaded here if needed, and the URL
      // is kept on the item so translating a second time does not send it again.
      let url = item.remoteUrl;
      if (!url) {
        const form = new FormData();
        form.append('files', { uri: item.uri, name: 'clip.mp4', type: 'video/mp4' });
        const upRes = await fetch(BACKEND + '/api/upload-media', {
          method: 'POST', headers: { Authorization: 'Bearer ' + token }, body: form,
        });
        const upData = await readJson(upRes);
        if (upData.error) throw new Error(upData.error);
        url = upData.items?.[0]?.url;
        if (!url) throw new Error('That clip could not be uploaded.');
        setItems(prev => prev.map(i => (i.key === item.key ? { ...i, remoteUrl: url } : i)));
      }

      setMessage('Starting translation...');
      const res = await fetch(BACKEND + '/api/translate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ url, targetLang: lang.code }),
      });
      const data = await readJson(res);
      if (!data.jobId) {
        setUploading(false);
        // 402/403 come back with the server's own explanation, which names the plan.
        if (res.status === 402 || res.status === 403) return promptUpgrade(data.error || 'Video translator');
        throw new Error(data.error || 'Could not start the translation.');
      }

      // Its own poller rather than pollJob, which finishes by handing an exported
      // video to the result screen - a different ending than this needs.
      await new Promise((resolve, reject) => {
        let misses = 0;
        const tick = setInterval(async () => {
          try {
            const t = await auth.currentUser?.getIdToken();
            const jr = await fetch(`${BACKEND}/api/job/${data.jobId}`, { headers: { Authorization: 'Bearer ' + t } });
            const job = await readJson(jr);
            if (typeof job.progress === 'number') setProgress(job.progress);
            if (job.message) setMessage(job.message);
            if (job.status === 'done') {
              clearInterval(tick);
              const remote = BACKEND + job.audioUrl;
              // Pulled down before it goes on the timeline. Left remote, expo-av
              // streams it during preview while the video is also decoding, and the
              // playback breaks up mid-sentence even though the file is continuous.
              // remoteUrl keeps the export pointed at the copy the server already has,
              // so nothing is uploaded twice.
              const voId = newMediaId('vo');
              const local = await cacheRemoteMedia(remote, voId, 'mp3');
              addVoiceoverTrack({
                key: String(Date.now()),
                mediaId: voId,
                uri: local || remote,
                remoteUrl: remote,
                name: `${job.languageLabel} translation`,
                volume: 1,
              });
              // Mute the source, or the original narration plays under the new one.
              setItems(prev => prev.map(i => (i.key === item.key ? { ...i, muted: true } : i)));
              resolve();
            } else if (job.status === 'error' || job.status === 'failed') {
              clearInterval(tick);
              reject(new Error(job.error || job.message || 'Translation failed.'));
            }
          } catch (e) {
            // A blip mid-job is not a failed job; only give up after several.
            if (++misses > 5) { clearInterval(tick); reject(new Error('Lost contact with the server.')); }
          }
        }, 3000);
      });

      setUploading(false);
      showAlert('Translated', 'The translated voiceover is on your timeline and the clip has been muted. Adjust or delete it like any other track.');
    } catch (e) {
      setUploading(false);
      showAlert('Translate', e.message || 'Could not translate this clip.');
    }
  }, [items, selectedKey]);

  const CLIP_TOGGLES = { reverse: 'reverse', reducenoise: 'denoise', motionblur: 'motionBlur', stabilize: 'stabilize', enhancevoice: 'enhanceVoice', freeze: 'freezeEnd', bgremover: 'chromaKey' };

  // Unlike toggleFlip above these go through pushHistory, so they undo. They change
  // what the export renders rather than only how the preview is drawn.
  const toggleClipFlag = useCallback((flag) => {
    if (!selectedKey) return;
    pushHistory(items.map(i => (i.key === selectedKey ? { ...i, [flag]: !i[flag] } : i)));
  }, [items, selectedKey]);

  // The server refuses reverse past this, because the filter holds every decoded
  // frame of the clip in memory at once. Checked here too so it is a sentence before
  // the export rather than a failed render minutes into one - the number is
  // duplicated deliberately and flagged on both sides.
  const REVERSE_MAX_SECONDS = 15;
  const clipSpanSeconds = (it) => {
    if (!it) return 0;
    const ss = Number(it.trimStart) > 0 ? Number(it.trimStart) : 0;
    const te = Number(it.trimEnd) > ss ? Number(it.trimEnd) : null;
    return te !== null ? te - ss : (Number(it.duration) || 0);
  };

  const chipPickerOptions = chipPicker === 'speed'
    ? SPEEDS.map(v => ({ key: 's-' + v, label: v + 'x', active: selectedSpeed === v, onPick: () => applySpeed(v) }))
    : chipPicker === 'filter'
      ? FILTERS.map(v => ({ key: 'f-' + v, label: v, active: selectedFilter === v, onPick: () => applyFilter(v) }))
      : chipPicker === 'freeze'
        ? FREEZE_SECONDS.map(v => ({
            key: 'fz-' + v,
            label: v === 0 ? 'Off' : v + 's',
            active: (selectedItem?.freezeEnd || 0) === v,
            onPick: () => {
              setItems(prev => prev.map(i => (i.key === selectedKey ? { ...i, freezeEnd: v } : i)));
              setChipPicker(null);
            },
          }))
      : chipPicker === 'flip'
        ? [
          { key: 'flipH', label: 'Horizontal', active: !!selectedItem?.flipH, onPick: () => toggleFlip('flipH') },
          { key: 'flipV', label: 'Vertical', active: !!selectedItem?.flipV, onPick: () => toggleFlip('flipV') },
        ]
        : [];

  const selectedAudioTrack = useMemo(
    () => audioTracks.find(t => t.key === selectedAudioTrackKey) || null,
    [audioTracks, selectedAudioTrackKey]
  );

  // Toggles the chain on the selected track. A flag rather than a render, so it costs
  // nothing until the export and can be undone.
  function toggleEnhanceVoice() {
    const t = audioTracks.find(x => x.key === selectedAudioTrackKey);
    if (!t) return;
    const on = !t.enhanceVoice;
    setTrackField(t.key, { enhanceVoice: on });
    showAlert(on ? 'Voice enhancement on' : 'Voice enhancement off', on
      ? 'Rumble and hiss removed, sibilance tamed, presence lifted and the level evened out. Applied when you export.'
      : 'This track will export as recorded.');
  }

  const audioToolActions = {
    enhance: toggleEnhanceVoice,
    replace: replaceAudioTrackFile,
    duplicate: duplicateAudioTrack,
    delete: () => selectedAudioTrackKey && removeAudioTrack(selectedAudioTrackKey),
    split: splitAudioAtPlayhead,
    volume: () => setAudioSheetKey(selectedAudioTrackKey),
    captions: openCaptionModal,
    fade: () => setFadeSheetKey(selectedAudioTrackKey),
    audiofx: () => selectedAudioTrackKey && setAudioFxTarget(selectedAudioTrackKey),
    beatsync: () => selectedAudioTrackKey && detectBeats(selectedAudioTrackKey),
    slip: () => setSlipSheetKey(selectedAudioTrackKey),
  };

  // Built-first orderings. Must sit BELOW both action maps: a useMemo factory runs
  // during render, so reading clipToolActions from above its own `const` is a temporal
  // dead zone error - which unmounts the tree and shows the grey screen this file has
  // now been caught by five times, and which lint does not flag.
  //
  // Not memoised, deliberately. Both action maps are object literals rebuilt every
  // render, so any dependency on them changes every render and the memo would never
  // hit - it would cost a comparison and buy nothing. Reordering forty items is far
  // cheaper than the toolbar it feeds.
  const tabTools = getTabTools();

  // A horizontal ScrollView keeps its contentOffset when its children change. Scroll
  // the strip right to reach a tab, tap it, and the short tools row that replaces it
  // opens already scrolled past its own end - an empty bar that fills in the moment you
  // touch it, which is exactly how this was reported.
  //
  // Reset on every level change, in both directions: coming back up to a strip that is
  // still scrolled to where a tool used to be is the same bug wearing the other hat.
  const bottomBarScrollRef = useRef(null);
  useEffect(() => {
    bottomBarScrollRef.current?.scrollTo({ x: 0, animated: false });
  }, [activeTab, selectedKey, selectedAudioTrackKey]);
  // Built from what the library actually contains rather than from a fixed list, so a
  // mood with no tracks in it is never offered.
  const musicMoods = useMemo(
    () => ['All', ...Array.from(new Set(musicLibraryTracks.map(t => t.mood).filter(Boolean))).sort()],
    [musicLibraryTracks]);
  const musicFiltered = useMemo(() => musicLibraryTracks.filter(t =>
    (musicMood === 'All' || t.mood === musicMood) &&
    (musicTempo === 'Any' || t.tempo === musicTempo)
  ), [musicLibraryTracks, musicMood, musicTempo]);

  const clipToolGroups = builtFirst(CLIP_TOOLS, clipToolActions);
  const audioToolsOrdered = [...AUDIO_TOOLS].sort(
    (a, b) => Number(toolIsBuilt(b, audioToolActions)) - Number(toolIsBuilt(a, audioToolActions)));

  const fadeSheetTrack = audioTracks.find(t => t.key === fadeSheetKey) || null;
  const slipSheetTrack = audioTracks.find(t => t.key === slipSheetKey) || null;

  // --- Live preview of what the export will do -------------------------------------
  //
  // Three separate mechanisms, because the three things are separately expressible:
  //
  //   motion   a transform. Faithful - a zoom is a scale and a shake is a translate,
  //            which is the same operation ffmpeg performs, not an imitation of it.
  //   filter   RN 0.81's `filter` style. Exact for the grades built from eq and hue;
  //            null for the rest, which use colorbalance or curves - a curve is
  //            non-linear and a colour matrix is by definition linear, so no amount of
  //            native module makes those expressible this way.
  //   effect   the same style, evaluated against the clock for the pulsing ones.
  //
  // Anything with no live form keeps its name on the badge instead. Showing an
  // approximation that disagrees with the render is the one outcome worth avoiding:
  // it teaches the wrong thing about a file you have not made yet.
  const clipLocalTime = previewClipStart != null ? Math.max(0, position - previewClipStart) : 0;

  const motionTransform = useMemo(() => {
    const p = previewItem && previewItem.motion ? resolveMotion(previewItem.motion).preview : null;
    if (!p) return null;
    const len = Math.max(0.1, clipSpanSeconds(previewItem));
    // A hold finishes the move early and stays there, which is what a punch is.
    const prog = Math.max(0, Math.min(1, p.hold ? clipLocalTime / p.hold : clipLocalTime / len));
    const t = clipLocalTime;
    const out = [];
    let scale = 1;
    if (p.zoom) scale = p.zoom[0] + (p.zoom[1] - p.zoom[0]) * prog;
    if (p.osc) scale = p.osc[0] + p.osc[1] * Math.sin(p.osc[2] * t);
    if (p.shake) {
      out.push({ translateX: p.shake.ax * Math.sin(p.shake.fx * t) });
      out.push({ translateY: p.shake.ay * Math.cos(p.shake.fy * t) });
    }
    if (p.pan) {
      // Fraction of the frame, so the travel is the same on any canvas size.
      out.push({ translateX: -p.pan[0] * frame.w * prog });
      out.push({ translateY: -p.pan[1] * frame.h * prog });
    }
    // Zooming about a point other than the centre. Scaling by s about an anchor a
    // (in -1..1) leaves the anchor fixed if the view also moves by -a*(s-1)*size/2 -
    // which is what zoompan's own x expression does on the other side.
    if (p.anchor && scale !== 1) {
      out.push({ translateX: -p.anchor[0] * (scale - 1) * frame.w / 2 });
      out.push({ translateY: -p.anchor[1] * (scale - 1) * frame.h / 2 });
    }
    if (p.spin) out.push({ rotate: `${(p.spin[0] * Math.sin(p.spin[1] * t) * 180 / Math.PI).toFixed(2)}deg` });
    // A rotation that travels rather than oscillates. freq 0 means it settles at the
    // angle instead of continuing, which is the Dutch angle case.
    if (p.drift) {
      const ang = p.drift[1] === 0 ? p.drift[0] * Math.min(t, p.hold || 1) : p.drift[0] * t;
      out.push({ rotate: `${(ang * 180 / Math.PI).toFixed(2)}deg` });
    }
    if (scale !== 1) out.push({ scale });
    return out.length ? out : null;
  }, [previewItem, clipLocalTime, frame.w, frame.h]);

  // Flip and motion both want `transform`, and two transform keys in a style array do
  // not merge - the later one silently replaces the earlier, so a flipped clip with a
  // zoom would lose its flip. Composed into one array here instead.
  const canvasLayerStyle = useMemo(() => {
    const flip = flipTransform(previewItem);
    const t = [...(flip ? flip.transform : []), ...(motionTransform || [])];
    const out = {};
    if (t.length) out.transform = t;
    return Object.keys(out).length ? out : null;
  }, [previewItem, motionTransform]);

  const liveFilter = useMemo(() => {
    if (!previewItem) return null;
    const parts = [];
    const f = previewItem.filter && previewItem.filter !== 'None' ? filterCss(previewItem.filter) : null;
    if (f) parts.push(f);
    const e = previewItem.effect && previewItem.effect !== 'none' ? effectCss(previewItem.effect, clipLocalTime) : null;
    if (e) parts.push(e);
    return parts.length ? parts.join(' ') : null;
  }, [previewItem, clipLocalTime]);

  // The look/movement settings on the clip under the playhead, named for the badge
  // above. Only the ones actually set, so an untouched clip carries no badge at all.
  const previewBadges = useMemo(() => {
    const it = previewItem;
    if (!it) return [];
    const out = [];
    // Only what the canvas CANNOT show. A grade that is already on screen does not need
    // announcing; one that is not does. Motion is always previewable, so it never
    // appears here.
    if (it.filter && it.filter !== 'None' && !filterCss(it.filter)) out.push(resolveFilter(it.filter).label);
    if (it.effect && it.effect !== 'none' && !effectCss(it.effect, 0)) out.push(resolveEffect(it.effect).label);
    return out;
  }, [previewItem]);

  const captionStyleDef = resolveCaptionStyle(captionStyle);
  const effectiveCaptionColor = captionColor || captionFill(captionStyleDef).color;
  // Generate Captions still has two paths - with a voiceover the words are timed
  // here and laid down as text overlays, without one the server burns them in -
  // but both now carry the same style spec, so a colour picked here is honoured
  // either way. It used to apply only to the first, and the sheet said so.

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      {/* TOP BAR */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.topBtn}>
          <MaterialIcons name="close" size={24} color="#fff" />
        </TouchableOpacity>
        {/* Search was an icon with no handler and nothing to search - the timeline is a
            handful of clips you can already see. Removed rather than given a
            "Coming soon", because there is no feature intended behind it. */}
        <View style={{ flex: 1 }} />
        <TouchableOpacity style={styles.qualityBtn} onPress={() => setShowResModal(true)}>
          <MaterialIcons name="diamond" size={14} color="#00d4d4" />
          <Text style={styles.qualityText}>AI UHD</Text>
          <MaterialIcons name="keyboard-arrow-down" size={16} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.exportBtn, items.length > 0 && !uploading && styles.exportBtnActive]}
          onPress={processVideo} disabled={uploading || items.length === 0}>
          {uploading
            ? <ActivityIndicator color="#000" size="small" />
            : <Text style={[styles.exportBtnText, items.length > 0 && { color: '#000' }]}>Export</Text>}
        </TouchableOpacity>
      </View>

      {/* VIDEO PREVIEW */}
      <View style={styles.previewContainer}>
        <View style={[styles.previewFrame, { width: frame.w, height: frame.h, backgroundColor: canvasBg }]}>
          {/* What is on this clip that the canvas cannot show.
              Filters, effects and motion are ffmpeg chains that run on the server at
              export - the canvas is a plain video view and applies none of them, and
              never has. Silence about that reads as the setting not having worked:
              you pick VHS, press play, and nothing happens.
              Naming them is the honest half. A live approximation would be the
              dishonest one - it would disagree with the render, and a preview that
              disagrees is worse than a preview that abstains. */}
          {!!previewBadges.length && (
            <View style={styles.exportBadge} pointerEvents="none">
              <MaterialIcons name="auto-awesome" size={10} color="#00d4d4" />
              <Text style={styles.exportBadgeText} numberOfLines={1}>
                {previewBadges.join(' · ')} — applied on export
              </Text>
            </View>
          )}
          {previewItem ? (
            previewItem.type === 'video' ? (
              <Video ref={videoRef} source={previewVideoSource}
                style={[styles.previewImage, canvasLayerStyle, joinLayers?.main, liveFilter ? { filter: liveFilter } : null]} resizeMode={clipResize}
                shouldPlay={isPlaying} isLooping={false}
                // isMuted was here and volume was not, which is exactly why muting a
                // clip worked and setting its level did nothing: there was no prop
                // for the level to arrive on. expo-av takes 0..1.
                volume={Math.max(0, Math.min(1, previewItem.volume ?? 1))}
                // The export changes tempo with atempo, which leaves pitch alone.
                // expo-av's default shifts pitch with rate, so without this a sped-up
                // clip auditions an octave up and exports at its own pitch.
                shouldCorrectPitch
                progressUpdateIntervalMillis={50}
                onPlaybackStatusUpdate={onVideoStatus}
                isMuted={previewItem.muted} rate={previewItem.speed || 1} />
            ) : (
              <Image source={{ uri: previewItem.uri }}
                style={[styles.previewImage, canvasLayerStyle, joinLayers?.main, liveFilter ? { filter: liveFilter } : null]} resizeMode={clipResize} />
            )
          ) : (
            <View style={styles.previewEmpty}>
              <MaterialIcons name="movie" size={48} color="#333" />
              <Text style={styles.previewEmptyText}>Add media to get started</Text>
            </View>
          )}
          {previewItem?.missing && (
            <View style={styles.missingCanvas} pointerEvents="none">
              <MaterialIcons name="image-not-supported" size={34} color="#ff6b6b" />
              <Text style={styles.missingCanvasText}>
                This clip&apos;s file is no longer on the device
              </Text>
              <Text style={styles.missingCanvasHint}>
                Select it and use Replace to pick it again — its trim, speed and filter are kept
              </Text>
            </View>
          )}
          {/* The other side of the join, drawn as a second layer over the canvas.
              This is what makes a transition actually play here: the outgoing and the
              incoming clip are both on screen, which is the same pair xfade gets.
              Muted always - the main <Video> carries the audio and two sources
              playing at once would double it. */}
          {joinLayers && joinLayers.otherItem && (
            <View pointerEvents="none" style={StyleSheet.absoluteFill}>
              {/* A masked transition puts the incoming clip inside a window with a
                  HARD EDGE - overflow hidden on the container, and the clip inside
                  offset by exactly the container's own position so it does not travel
                  as the window grows. That standing-still is what makes it read as a
                  wipe rather than as something sliding in. Unmasked families render
                  the clip directly with a transform. */}
              {joinLayers.mask ? (
                <View style={maskContainerStyle(joinLayers.mask, frame)}>
                  <View style={maskInnerStyle(joinLayers.mask, frame)}>
                    <JoinClipLayer item={joinLayers.otherItem} isPlaying={isPlaying} active={joinLayers.active} style={null} />
                  </View>
                </View>
              ) : (
                <JoinClipLayer item={joinLayers.otherItem} isPlaying={isPlaying} active={joinLayers.active} style={joinLayers.other} />
              )}
              {/* Fades that go THROUGH a colour rather than between the two frames. */}
              {joinLayers.tint && (
                <View style={[
                  StyleSheet.absoluteFill,
                  { backgroundColor: joinLayers.tint.color, opacity: joinLayers.tint.opacity },
                ]} />
              )}
              {/* Says which transition is running, and admits when the canvas is
                  standing in rather than reproducing it - a wipe shown as a dissolve
                  should not be mistaken for what the export will do. */}
              <View style={styles.joinLabel}>
                <MaterialIcons name="compare-arrows" size={12} color="#04211f" />
                <Text style={styles.joinLabelText}>
                  {activeJoin.def.label}{activeJoin.fidelity === 'approx' ? ' · approx' : ''}
                </Text>
              </View>
            </View>
          )}

          {/* Sits under the overlays and over the video, so a tap that misses every
              overlay clears the selection instead of doing nothing. */}
          {selectedOverlayKey && (
            <TouchableOpacity
              style={StyleSheet.absoluteFill}
              activeOpacity={1}
              onPress={() => { endInlineEdit(); setSelectedOverlayKey(null); }}
            />
          )}
          {/* Media overlays - drag, pinch and turn, same as text. Drawn before the
              text overlays so a caption is never buried under a sticker; within the
              list, later additions sit on top of earlier ones. */}
          {mediaOverlayViews}

          {/* Text overlays on preview - drag, pinch and turn. Auto-captions are
              time-gated to the playhead position; manual overlays always show.
              Memoized like mediaOverlayViews below - without this, every
              unrelated re-render (an export progress tick, a poll message
              update, neither of which this list depends on) rebuilt every
              overlay's CanvasOverlay from scratch, including seven fresh
              Gesture.Pan objects each. With enough overlays accumulated in a
              project that adds up to a real per-tick cost, and enough ticks
              in a row froze the JS thread - the export polling loop is a
              setInterval on that same thread, so it stopped firing too,
              which is what made a slow export look like a stuck one. */}
          {/* Hidden for the span a transition is actually blending (not the
              longer lookahead mount window before it - joinLayers.active is
              specifically the 0.3s the two clips are visibly crossing). A
              caption or manual overlay has no transition of its own, so it
              was just sitting flat on top of a moving/masked/scaled clip
              blend, reading as broken rather than as a deliberate effect -
              this is a device-reported request to simply not show it there. */}
          {!joinLayers?.active && textOverlayViews}
        </View>

        {/* Playback controls */}
        <View style={styles.playbackRow}>
          <TouchableOpacity style={styles.playBtn} onPress={() => setShowResModal(true)}>
            <MaterialIcons name="fullscreen" size={22} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.playBtn} onPress={() => setPosition(Math.max(0, position - 1))}>
            <MaterialIcons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.playBtnMain} onPress={() => setIsPlaying(!isPlaying)}>
            <MaterialIcons name={isPlaying ? 'pause' : 'play-arrow'} size={36} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.playBtn} onPress={() => setPosition(Math.min(duration, position + 1))}>
            <MaterialIcons name="arrow-forward" size={22} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.playBtn} onPress={undo}>
            <MaterialIcons name="undo" size={22} color={historyIndex > 0 ? '#fff' : '#888'} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.playBtn} onPress={redo}>
            <MaterialIcons name="redo" size={22} color={historyIndex < history.length - 1 ? '#fff' : '#888'} />
          </TouchableOpacity>
        </View>
      </View> {/* TIMELINE */}
      <View style={styles.timeline}>
        {/* The clock and the ruler share one line. The clock occupies exactly the
            sidebar's width, so the ruler begins where the clips begin and a tick still
            sits over the moment it names - which is the only constraint that matters
            here, and the reason the ruler cannot simply follow the text. */}
        <View style={styles.timecodeRow}>
          <View style={styles.timecodeCell}>
            <Text style={styles.timecode}>{fmtTime(position)}/{fmtTime(duration)}</Text>
          </View>
          <TimeRuler
            scrollRef={rulerScrollRef}
            duration={duration}
            leadOffset={timelineLeadW}
          />
        </View>

        <View style={styles.trackArea}>
          {/* Sidebar */}
          <View style={styles.sidebar}>
            <TouchableOpacity style={styles.sideBtn}
              onPress={() => selectedItem && setItems(prev =>
                prev.map(i => i.key === selectedKey ? { ...i, muted: !i.muted } : i))}>
              <MaterialIcons name={selectedItem?.muted ? 'volume-off' : 'volume-up'} size={18} color="#fff" />
              <Text style={styles.sideBtnLabel}>Mute{'\n'}clip</Text>
            </TouchableOpacity>
            {/* Choosing which frame represents the video is real work - it needs a
                frame picker here and a poster on the export - and none of it exists.
                It carries a pencil, so it looks like a control; dimmed and honest
                beats live-looking and inert. */}
            <TouchableOpacity
              style={styles.coverThumbWrap}
              onPress={() => showAlert('Cover', 'Choosing a cover frame is coming soon.')}>
              {items.length > 0
                ? <Image source={{ uri: items[0].uri }} style={styles.coverThumbImg} resizeMode="cover" />
                : <View style={styles.coverThumbEmpty} />}
              <MaterialIcons name="edit" size={10} color="#5a5a5a" style={styles.coverEditIcon} />
              <Text style={[styles.sideBtnLabel, { color: '#fff' }]}>Cover</Text>
            </TouchableOpacity>
            {/* These two sit beside the music and text rows and had no onPress at all -
                two buttons that looked like the rest of the rail and did nothing. They
                add to the row they are next to, which is the only thing they could
                sensibly mean. */}
            {/* Icon only. Labelling these cost about 26px of column, which was enough
                to push the last one off the bottom of the rail - the rail is as tall as
                the track area and does not scroll. */}
            <TouchableOpacity style={styles.sideBtn} onPress={onPressAddMusic}>
              <MaterialIcons name="music-note" size={18} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.sideBtn} onPress={onPressAddText}>
              <MaterialIcons name="title" size={18} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Clips + scrubber */}
          <View style={styles.clipsWrapper}
            onLayout={(e) => setTimelineLeadW(e.nativeEvent.layout.width * SCRUBBER_POS)}>
            <View style={[styles.scrubberLine, { left: timelineLeadW }]} pointerEvents="none" />
            <ReanimatedAnimated.ScrollView
              ref={timelineScrollRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              scrollEventThrottle={32}
              onScrollBeginDrag={() => { isUserScrubbing.current = true; setIsPlaying(false); }}
              onScroll={(e) => {
                if (!isUserScrubbing.current) return;
                const now = Date.now();
                if (now - lastScrubUpdateRef.current < 35) return;
                lastScrubUpdateRef.current = now;
                const x = e.nativeEvent.contentOffset.x;
                const newPos = Math.max(0, Math.min(duration, x / PIXELS_PER_SECOND));
                setPosition(newPos);
              }}
              onScrollEndDrag={(e) => {
                isUserScrubbing.current = false;
                const x = e.nativeEvent.contentOffset.x;
                const newPos = Math.max(0, Math.min(duration, x / PIXELS_PER_SECOND));
                setPosition(newPos);
              }}
              onMomentumScrollEnd={(e) => {
                isUserScrubbing.current = false;
                const x = e.nativeEvent.contentOffset.x;
                const newPos = Math.max(0, Math.min(duration, x / PIXELS_PER_SECOND));
                setPosition(newPos);
              }}>
            <View>
            <View style={[styles.clipsScroll, { paddingLeft: rowLeadW }]} onLayout={rowLayout.clips}>
              <ClipsRow clipsComputed={clipsComputed} selectedKey={selectedKey} onPressClip={onPressClip} onLongPressClip={openTrim} onPressRemove={removeItem} onPressTransition={onPressClipTransition} onPressAdd={pickMedia} onTrimEnd={applyClipTrimEdit} />
            </View>

            {/* Voiceover row */}
            <AudioTrackRow scrollRef={voiceoverScrollRef} timelineContentWidth={timelineContentWidth}
              tracksComputed={voiceoverTracksComputed} waveformCache={waveformCache}
              selectedAudioTrackKey={selectedAudioTrackKey}
              accentColor="#3b82f6" iconName="record-voice-over" addLabel="Add voiceover" leadOffset={rowLeadW}
              onDragEnd={onDragEndAudioTrack} onTrimEnd={applyAudioTrimEdit} onPressTrack={onPressAudioTrack}
              onLongPressTrack={onLongPressVoiceoverTrack} onPressAdd={onPressAddVoiceover} onLayout={rowLayout.voiceover} />
            {/* Music row */}
            <AudioTrackRow scrollRef={musicScrollRef} timelineContentWidth={timelineContentWidth}
              tracksComputed={musicTracksComputed} waveformCache={waveformCache}
              selectedAudioTrackKey={selectedAudioTrackKey}
              accentColor="#22c55e" iconName="music-note" addLabel="Add music" leadOffset={rowLeadW}
              onDragEnd={onDragEndAudioTrack} onTrimEnd={applyAudioTrimEdit} onPressTrack={onPressAudioTrack}
              onLongPressTrack={onLongPressMusicTrack} onPressAdd={onPressAddMusic} onLayout={rowLayout.music} />
            {/* Text row */}
            <TextRow scrollRef={textScrollRef} manualTextOverlays={manualTextOverlays} leadOffset={rowLeadW} onLongPressChip={removeTextOverlay} onPressChip={onPressTextChip} onPressAdd={onPressAddText} onLayout={rowLayout.text} />
            {/* Captions row - grouped preview chips, see comment on
                captionPreviewGroups for why. */}
            <CaptionsRow scrollRef={captionsScrollRef} captionPreviewGroups={captionPreviewGroups} leadOffset={rowLeadW} onPress={openCaptionModal} onLayout={rowLayout.captions} />
            </View>
            </ReanimatedAnimated.ScrollView>

            {/* One add button per row, each pinned to its row's centre and to the right
                edge of the timeline. Outside the ScrollView, so the footage moves under
                them and they stay where they were left - the buttons these replace sat
                at the end of their rows, and a row is now as long as the media on it,
                so reaching the one that adds a second clip meant scrolling the whole
                length of the first. box-none lets touches through everywhere except on
                a button, or the rail would swallow scrubbing across the whole strip. */}
            <View style={styles.addRail} pointerEvents="box-none">
              {ADD_RAIL.map(r => {
                const frame = rowFrames[r.key];
                // Nothing to centre on until that row has been laid out once.
                if (!frame) return null;
                // An empty clips row draws its own slot at the head, and two identical
                // dashed squares on one row say nothing that one does not.
                if (r.key === 'clips' && clipsComputed.length === 0) return null;
                const h = r.big ? CLIP_H : RAIL_BTN;
                // Clamped so a button can never be placed outside the rail, whatever a
                // row's height turns out to be. Centring on a row shorter than the
                // button gives a negative top, which puts it over the timecode strip.
                const top = Math.max(0, frame.y + (frame.height - h) / 2);
                return (
                  <TouchableOpacity
                    key={r.key}
                    style={[r.big ? styles.railBtnClip : styles.railBtn, { top }]}
                    onPress={railActions[r.key]}
                    accessibilityLabel={r.label}>
                    <MaterialIcons name={r.icon} size={r.big ? 22 : 14} color={r.big ? '#888' : '#c0c0c0'} />
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </View>

      {/* TRUE SINGLE-ROW BOTTOM TOOLBAR */}
      <View style={[styles.bottomToolbar, { paddingBottom: insets.bottom || 16 }]}>
        {selectedAudioTrack && !selectedItem ? (
          <View style={styles.barWithAction}>
            {/* flex:1 so the scroller takes the room the pinned button does not; without
                it a row lays the ScrollView out at its content width and pushes Confirm
                off the end - which is the one thing it must never be. */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}
              contentContainerStyle={{ alignItems: 'center', paddingHorizontal: 8, gap: 6 }}>
              {audioToolsOrdered.map(t => (
                <TouchableOpacity
                  key={t.key}
                  style={styles.clipToolBtn}
                  onPress={toolTapAction(t, audioToolActions)}>
                  <View style={styles.toolIconWrap}>
                    <MaterialIcons name={t.icon} size={20} color={audioToolActions[t.key] ? '#fff' : '#5a5a5a'} />
                    {/* The premium mark is a badge on the icon rather than a word in
                        the label, which would not fit the column and would read as
                        part of the tool's name. */}
                    {t.premium && !isPremium && (
                      <MaterialIcons name="diamond" size={12} color="#f5c451" style={styles.premiumBadge} />
                    )}
                  </View>
                  <Text style={[styles.clipToolLabel, !audioToolActions[t.key] && { color: '#5a5a5a' }]}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {/* Outside the scroller: it is how you leave this bar, so it must never be
                the thing that has been scrolled off the end. */}
            <TouchableOpacity style={styles.confirmBtn} onPress={() => setSelectedAudioTrackKey(null)}
              accessibilityLabel="Done">
              <MaterialIcons name="check" size={24} color="#04211f" />
            </TouchableOpacity>
          </View>
        ) : (
        <View style={styles.barWithAction}>
        {/* Pinned at the LEFT, outside the scroller, and only once a tab has the bar.
            It is the way back to the top level, so it cannot be a thing that scrolls
            off the end - and it sits where CapCut puts it, which is where a thumb
            already expects it. */}
        {!selectedItem && !!activeTab && (
          <>
            <TouchableOpacity style={styles.tabBackBtn} onPress={() => setActiveTab(null)}
              accessibilityLabel="Back">
              <MaterialIcons name="chevron-left" size={24} color="#fff" />
            </TouchableOpacity>
            <View style={styles.toolGroupDivider} />
          </>
        )}
        <ScrollView ref={bottomBarScrollRef} horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}
          contentContainerStyle={{ alignItems: 'center', paddingHorizontal: 8, gap: 6 }}>
          {/* Selecting a clip turns the bar into that clip's tools. Tapping the clip
              again deselects it and the tabs come back, so there is a way out that
              does not need a button of its own. */}
          {selectedItem ? clipToolGroups.map((group, gi) => (
            <React.Fragment key={'g' + gi}>
              {gi > 0 && <View style={styles.toolGroupDivider} />}
              {group.map(t => {
                // Dimming still tracks whether the tool DOES anything, not whether it
                // is paid: a built premium tool is live-looking and says so when
                // tapped, an unbuilt one is dim whatever the plan.
                const built = !!clipToolActions[t.key];
                const locked = t.premium && !isPremium;
                // A toggle that is currently on says so. Green rather than teal: it
                // chose a value and applies on tap, which is the green case.
                const flagOn = !!(CLIP_TOGGLES[t.key] && selectedItem?.[CLIP_TOGGLES[t.key]]);
                return (
                  <TouchableOpacity
                    key={t.key}
                    style={styles.clipToolBtn}
                    onPress={toolTapAction(t, clipToolActions)}>
                    <View>
                      <MaterialIcons name={t.icon} size={20} color={flagOn ? '#2ECC71' : built ? '#fff' : '#5a5a5a'} />
                      {t.premium && locked && (
                        <MaterialIcons name="diamond" size={12} color="#f5c451"
                          style={styles.premiumBadge} />
                      )}
                    </View>
                    <Text style={[styles.clipToolLabel, !built && { color: '#5a5a5a' }, flagOn && { color: '#2ECC71' }]}>{t.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </React.Fragment>
          )) : activeTab ? (
          // Icon above label, the same shape as the tabs they replaced and as a clip's
          // tools - not the pill chips these used to be. In CapCut every level of this
          // bar looks the same, which is what makes going down a level read as the bar
          // changing rather than as a different control appearing.
          tabTools.map(tool => (
            tool.isOverlayThumb ? (
              <TouchableOpacity key={tool.key} onLongPress={tool.onLongPress} onPress={tool.onPress}
                style={styles.overlayThumbBtn}>
                <Image source={{ uri: tool.overlay.uri }} style={styles.overlayThumb} resizeMode="cover" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity key={tool.key} style={styles.clipToolBtn} onPress={tool.onPress}>
                <MaterialIcons name={tool.icon || 'tune'} size={20}
                  color={tool.active ? '#2ECC71' : (tool.color || '#fff')} />
                <Text style={[styles.clipToolLabel, tool.active && { color: '#2ECC71' },
                  tool.color && !tool.active && { color: tool.color }]}>{tool.label}</Text>
              </TouchableOpacity>
            )
          ))
          ) : (
          bottomTabs.map(tab => {
            const active = tab.built && activeTab === tab.name;
            const locked = tab.premium && !isPremium;
            return (
              <TouchableOpacity
                key={tab.name}
                style={[styles.tabBtn, active && styles.tabBtnActive]}
                onPress={() => (tab.built
                  ? setActiveTab(tab.name)
                  : showAlert(tab.name, tab.premium ? 'Coming soon on the paid plans.' : 'Coming soon.'))}>
                <View>
                  <MaterialIcons
                    name={tab.icon}
                    size={20}
                    color={active ? '#00d4d4' : (tab.built ? '#fff' : '#3a3a3a')}
                  />
                  {tab.premium && locked && (
                    <MaterialIcons name="diamond" size={11} color="#f5c451"
                      style={styles.premiumBadge} />
                  )}
                </View>
                <Text style={[
                  styles.tabLabel,
                  active && { color: '#00d4d4' },
                  !tab.built && { color: '#3a3a3a' },
                ]}>{tab.name}</Text>
              </TouchableOpacity>
            );
          })
          )}
        </ScrollView>
        </View>
        )}
      </View>

      {/* SPEED / FILTERS PICKER - the two clip tools that were only ever a row of
          chips under a tab, and have nowhere to sit once the tabs step aside. */}
      <Modal visible={!!chipPicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, sheetInset]}>
            <SheetHeader title={chipPicker === 'speed' ? 'Speed' : chipPicker === 'flip' ? 'Flip' : chipPicker === 'freeze' ? 'Hold last frame' : 'Filters'} onClose={() => setChipPicker(null)} />
            <View style={styles.chipPickerWrap}>
              {chipPickerOptions.map(o => (
                <TouchableOpacity key={o.key} style={[styles.toolChip, o.active && styles.toolChipActive]}
                  onPress={() => { o.onPick(); if (chipPicker !== 'flip') setChipPicker(null); }}>
                  <Text style={[styles.toolChipText, o.active && { color: '#000' }]}>{o.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>

      <VoicePicker
        visible={showVoicePicker}
        selectedId={voiceId}
        onSelect={setVoiceId}
        onClose={() => setShowVoicePicker(false)}
      />

      {/* TRANSLATE LANGUAGE PICKER */}
      <Modal visible={translateSheet} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, sheetInset]}>
            <SheetHeader title="Translate video" onClose={() => setTranslateSheet(false)} />
            <Text style={styles.translateHint}>
              The speech in this clip is transcribed, translated, and spoken back in the
              language you pick. It arrives as a voiceover on your timeline and the clip
              is muted.
            </Text>
            <ScrollView style={styles.translateList}>
              <View style={styles.chipPickerWrap}>
                {translateLangs.map(l => (
                  <TouchableOpacity key={l.code} style={styles.toolChip} onPress={() => runTranslate(l)}>
                    <Text style={styles.toolChipText}>{l.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* UPLOAD OVERLAY */}
      {uploading && (
        <View style={styles.uploadOverlay}>
          <ActivityIndicator color="#00d4d4" size="large" />
          <Text style={styles.uploadMsg}>{message}</Text>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: progress + '%' }]} />
          </View>
          <Text style={styles.progressText}>{progress}%</Text>
        </View>
      )}

      {/* TRIM MODAL */}
      <Modal visible={showTrimModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, sheetInset]}>
            <SheetHeader title="Trim Clip" onClose={() => setShowTrimModal(false)} />
            {trimItem && (
              <>
                <Text style={styles.trimHint}>Drag either end to choose what to keep</Text>
                <TrimStrip
                  uri={trimItem.uri}
                  type={trimItem.type}
                  // The strip lays out the whole source file across the sheet, so this
                  // has to be the file's length and not the clip's current window -
                  // otherwise the footage a trim would give back is not on screen to
                  // aim at, which is the entire reason for showing frames.
                  sourceDuration={trimItem.sourceDuration || trimItem.duration || 0}
                  trimStart={trimStart}
                  trimEnd={trimEnd}
                  width={SW - 48}
                  height={64}
                  minDur={MIN_CLIP_DUR}
                  onChange={(start, end) => { setTrimStart(start); setTrimEnd(end); }}
                />
              </>
            )}
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalBtnCancel} onPress={() => setShowTrimModal(false)}>
                <Text style={styles.modalBtnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBtnApply} onPress={applyTrim}>
                <Text style={styles.modalBtnApplyText}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* TEXT MODAL */}
      <Modal visible={showTextModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, styles.textModalSheet, sheetInset]}>
            <SheetHeader title={editingText ? 'Edit Text' : 'Add Text'} onClose={() => setShowTextModal(false)} />
            <ScrollView keyboardShouldPersistTaps="handled" scrollEnabled={!colorDragging}
              showsVerticalScrollIndicator={false}>
            {/* Typed in the face and colour that were chosen, not in the system font.
                Judging a display face against a default sans is guessing, and the
                whole point of picking one is to see it. Size is left alone - the
                field is a place to type, not a preview of scale, and following the
                slider up to 96pt would push everything else off the sheet. */}
            <TextInput
              style={[
                styles.textModalInput,
                { fontFamily: fontFamilyFor(textFont), color: textColor },
                textBackground?.enabled && { backgroundColor: withAlpha(textBackground.color, textBackground.opacity) },
              ]}
              value={textInput}
              onChangeText={setTextInput}
              placeholder="Enter text..."
              placeholderTextColor="#555"
              multiline
            />
            <Text style={styles.modalLabel}>Color</Text>
            <ColorPicker
              color={textColor}
              onChange={setTextColor}
              onCommit={rememberColor}
              presets={TEXT_COLORS}
              recents={recentColors}
              onDragStateChange={setColorDragging}
            />
            <Text style={styles.modalLabel}>Font</Text>
            <FontPicker value={textFont} onChange={setTextFont} />
            <Text style={styles.modalLabel}>Size: {textSize}</Text>
            <Slider style={styles.modalSlider} minimumValue={10} maximumValue={48} step={2}
              value={textSize} minimumTrackTintColor="#00d4d4" maximumTrackTintColor="#333"
              thumbTintColor="#00d4d4" onValueChange={setTextSize} />

            {/* The chip. Off by default: text over a video usually wants a stroke
                or a shadow, and a box behind every overlay would be the louder
                choice made for the user rather than by them. */}
            <TouchableOpacity
              style={styles.bgToggleRow}
              onPress={() => setBackgroundField('enabled', !textBackground.enabled)}
              accessibilityRole="switch"
              accessibilityState={{ checked: textBackground.enabled }}
              accessibilityLabel="Text background"
            >
              <Text style={styles.modalLabel}>Background</Text>
              <View style={[styles.bgSwitch, textBackground.enabled && styles.bgSwitchOn]}>
                <View style={[styles.bgKnob, textBackground.enabled && styles.bgKnobOn]} />
              </View>
            </TouchableOpacity>

            {textBackground.enabled && (
              <>
                <View style={styles.bgPreviewRow}>
                  <View style={{
                    backgroundColor: withAlpha(textBackground.color, textBackground.opacity),
                    borderRadius: textBackground.radius * (textSize / 18),
                    paddingHorizontal: textBackground.padX * (textSize / 18),
                    paddingVertical: textBackground.padY * (textSize / 18),
                  }}>
                    <Text style={{ color: textColor, fontSize: textSize }} numberOfLines={1}>
                      {textInput.trim() || 'Preview'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.modalLabel}>Background colour</Text>
                <ColorPicker
                  color={textBackground.color}
                  onChange={c => setBackgroundField('color', c)}
                  onCommit={rememberColor}
                  presets={TEXT_COLORS}
                  recents={recentColors}
                  onDragStateChange={setColorDragging}
                />
                <Text style={styles.modalLabel}>
                  Opacity: {Math.round(textBackground.opacity * 100)}%
                </Text>
                <Slider style={styles.modalSlider} minimumValue={0} maximumValue={1} step={0.05}
                  value={textBackground.opacity} minimumTrackTintColor="#00d4d4"
                  maximumTrackTintColor="#333" thumbTintColor="#00d4d4"
                  onValueChange={v => setBackgroundField('opacity', v)} />
                <Text style={styles.modalLabel}>Corner radius: {textBackground.radius}</Text>
                <Slider style={styles.modalSlider} minimumValue={0} maximumValue={28} step={1}
                  value={textBackground.radius} minimumTrackTintColor="#00d4d4"
                  maximumTrackTintColor="#333" thumbTintColor="#00d4d4"
                  onValueChange={v => setBackgroundField('radius', v)} />
                <Text style={styles.modalLabel}>Padding: {textBackground.padX} × {textBackground.padY}</Text>
                <Slider style={styles.modalSlider} minimumValue={0} maximumValue={32} step={1}
                  value={textBackground.padX} minimumTrackTintColor="#00d4d4"
                  maximumTrackTintColor="#333" thumbTintColor="#00d4d4"
                  onValueChange={v => setBackgroundField('padX', v)} />
                <Slider style={styles.modalSlider} minimumValue={0} maximumValue={24} step={1}
                  value={textBackground.padY} minimumTrackTintColor="#00d4d4"
                  maximumTrackTintColor="#333" thumbTintColor="#00d4d4"
                  onValueChange={v => setBackgroundField('padY', v)} />
              </>
            )}
            </ScrollView>
            {/* Pinned below the scroller, not inside it. The sheet grew a background
                section and this row went with it - so after choosing a colour, a font
                and a background there was nothing on screen to press, and the way to
                finish was to scroll past everything you had just set. Same rule the
                context toolbar's Confirm follows: the thing that ends the job must
                never be the thing that scrolled away. */}
            <View style={styles.textModalActions}>
              <TouchableOpacity style={styles.modalBtnCancel} onPress={() => setShowTextModal(false)}>
                <Text style={styles.modalBtnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBtnApply} onPress={addTextOverlay}>
                <MaterialIcons name="check" size={18} color="#04211f" />
                <Text style={styles.modalBtnApplyText}>
                  {editingText ? 'Update' : 'Done'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>   {/* VOLUME MODAL */}
      {/* CLIP VOLUME - the selected clip's own sound, not the master level. Reachable
          from the clip toolbar, where Volume used to open the master sheet and quietly
          change the voiceover and music instead of the clip in front of you. */}
      <Modal visible={showClipVolumeModal} transparent animationType="slide"
        onRequestClose={() => setShowClipVolumeModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, sheetInset]}>
            <SheetHeader title="Clip Volume" onClose={() => setShowClipVolumeModal(false)} />
            {selectedItem && (
              <>
                <View style={styles.clipVolRow}>
                  <Text style={styles.clipVolLabel}>Level</Text>
                  <Text style={styles.clipVolValue}>
                    {selectedItem.muted ? 'Muted' : Math.round((selectedItem.volume ?? 1) * 100) + '%'}
                  </Text>
                </View>
                <Slider style={styles.modalSlider} minimumValue={0} maximumValue={1}
                  value={Math.min(1, selectedItem.volume ?? 1)}
                  minimumTrackTintColor="#00d4d4" maximumTrackTintColor="#333"
                  thumbTintColor="#00d4d4"
                  // Touching the slider is a clear statement that you want to hear it,
                  // so it lifts the mute rather than moving a level nothing will play.
                  onValueChange={v => setItems(prev => prev.map(i => (
                    i.key === selectedKey ? { ...i, volume: v, muted: v > 0 ? false : i.muted } : i
                  )))} />
                <TouchableOpacity
                  style={styles.clipMuteBtn}
                  onPress={() => setItems(prev => prev.map(i => (
                    i.key === selectedKey ? { ...i, muted: !i.muted } : i
                  )))}>
                  <MaterialIcons
                    name={selectedItem.muted ? 'volume-off' : 'volume-up'}
                    size={20} color={selectedItem.muted ? '#ff6b6b' : '#e6e6e6'} />
                  <Text style={styles.clipMuteText}>{selectedItem.muted ? 'Muted' : 'Mute this clip'}</Text>
                </TouchableOpacity>
                <Text style={styles.clipVolNote}>
                  Applies to this clip only. Voiceover and music levels are under Audio tools.
                </Text>
              </>
            )}
            <TouchableOpacity style={styles.modalBtnApplyBlock} onPress={() => setShowClipVolumeModal(false)}>
              <Text style={styles.modalBtnApplyText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showVolumeModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, sheetInset]}>
            <SheetHeader title="Master Volume" onClose={() => setShowVolumeModal(false)} />
            <Text style={styles.modalLabel}>{Math.round(masterVolume * 100)}%</Text>
            <Slider style={styles.modalSlider} minimumValue={0} maximumValue={1}
              value={masterVolume} minimumTrackTintColor="#00d4d4" maximumTrackTintColor="#333"
              thumbTintColor="#00d4d4" onValueChange={setMasterVolume} />
            <Text style={{ color:'#fff', fontSize:11, textAlign:'center', marginBottom:10 }}>
              Scales every voiceover and music track. Tap a track on the timeline to set its own level.
            </Text>
            <TouchableOpacity style={styles.modalBtnApplyBlock} onPress={() => setShowVolumeModal(false)}>
              <Text style={styles.modalBtnApplyText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* FADE - seconds of ramp at each end of a track. Fade was in the audio toolbar
          from the start and had no action behind it, so it fell through to the
          "coming soon" alert like the tools that are genuinely unbuilt. */}
      <Modal visible={!!fadeSheetTrack} transparent animationType="slide"
        onRequestClose={() => setFadeSheetKey(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, sheetInset]}>
            <SheetHeader title="Fade" onClose={() => setFadeSheetKey(null)} />
            {fadeSheetTrack && (trackLength(fadeSheetTrack) > 0 ? (() => {
              const len = trackLength(fadeSheetTrack);
              // Half the track each, or the two ramps meet and the middle never
              // reaches full level - a fade that quietly becomes a volume cut.
              const maxFade = Math.max(0.1, Math.min(5, len / 2));
              const fin = Math.min(Number(fadeSheetTrack.fadeIn) || 0, maxFade);
              const fout = Math.min(Number(fadeSheetTrack.fadeOut) || 0, maxFade);
              return (
                <>
                  <Text numberOfLines={1} style={styles.audioSheetName}>{fadeSheetTrack.name}</Text>
                  <View style={styles.clipVolRow}>
                    <Text style={styles.clipVolLabel}>Fade in</Text>
                    <Text style={styles.clipVolValue}>{fin.toFixed(1)}s</Text>
                  </View>
                  <Slider style={styles.modalSlider} minimumValue={0} maximumValue={maxFade}
                    value={fin} minimumTrackTintColor="#00d4d4" maximumTrackTintColor="#333"
                    thumbTintColor="#00d4d4"
                    onValueChange={v => setTrackField(fadeSheetTrack.key, { fadeIn: v })} />
                  <View style={styles.clipVolRow}>
                    <Text style={styles.clipVolLabel}>Fade out</Text>
                    <Text style={styles.clipVolValue}>{fout.toFixed(1)}s</Text>
                  </View>
                  <Slider style={styles.modalSlider} minimumValue={0} maximumValue={maxFade}
                    value={fout} minimumTrackTintColor="#00d4d4" maximumTrackTintColor="#333"
                    thumbTintColor="#00d4d4"
                    onValueChange={v => setTrackField(fadeSheetTrack.key, { fadeOut: v })} />
                  <Text style={styles.clipVolNote}>
                    Play the timeline across this track to hear it.
                  </Text>
                </>
              );
            })() : (
              <Text style={styles.clipVolNote}>
                This track's length has not been measured yet, so there is nothing to
                fade against. Give it a moment and reopen.
              </Text>
            ))}
            <TouchableOpacity style={styles.modalBtnApplyBlock} onPress={() => setFadeSheetKey(null)}>
              <Text style={styles.modalBtnApplyText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* SLIP - move the source window inside the track without moving the track. The
          block stays exactly where it sits on the timeline and different audio plays
          through it, which is what makes it a distinct tool from trim or drag. */}
      <Modal visible={!!slipSheetTrack} transparent animationType="slide"
        onRequestClose={() => setSlipSheetKey(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, sheetInset]}>
            <SheetHeader title="Slip" onClose={() => setSlipSheetKey(null)} />
            {slipSheetTrack && (() => {
              const len = trackLength(slipSheetTrack);
              const src = Number(slipSheetTrack.sourceDuration) || 0;
              const room = src - len;
              if (!len || room <= 0.05) {
                return (
                  <Text style={styles.clipVolNote}>
                    There is no spare footage in this track to slip - it already uses
                    the whole file. Trim an end first to make room.
                  </Text>
                );
              }
              const at = Math.max(0, Math.min(slipSheetTrack.trimStart ?? 0, room));
              return (
                <>
                  <Text numberOfLines={1} style={styles.audioSheetName}>{slipSheetTrack.name}</Text>
                  <View style={styles.clipVolRow}>
                    <Text style={styles.clipVolLabel}>Starts at</Text>
                    <Text style={styles.clipVolValue}>{at.toFixed(1)}s of {src.toFixed(1)}s</Text>
                  </View>
                  <Slider style={styles.modalSlider} minimumValue={0} maximumValue={room}
                    value={at} minimumTrackTintColor="#00d4d4" maximumTrackTintColor="#333"
                    thumbTintColor="#00d4d4"
                    // Both ends move together by design: the window keeps its length,
                    // so the block on the timeline does not change size or position
                    // and only the audio inside it changes.
                    onValueChange={v => setTrackField(slipSheetTrack.key, {
                      trimStart: v, trimEnd: v + len,
                    })} />
                  <Text style={styles.clipVolNote}>
                    Same length, same place on the timeline - a different part of the file.
                  </Text>
                </>
              );
            })()}
            <TouchableOpacity style={styles.modalBtnApplyBlock} onPress={() => setSlipSheetKey(null)}>
              <Text style={styles.modalBtnApplyText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* AUDIO TRACK MODAL - per-track level, opened by tapping a timeline track */}
      <Modal visible={!!audioSheetTrack} transparent animationType="slide"
        onRequestClose={() => setAudioSheetKey(null)}>
        <View style={{ flex:1, justifyContent:'flex-end', backgroundColor:'rgba(0,0,0,0.6)' }}>
          <View style={[{ backgroundColor:'#1a1a1a', borderTopLeftRadius:16, borderTopRightRadius:16, padding:20 }, sheetInset]}>
            <SheetHeader title={audioSheetTrack?.isVoiceover ? 'Voiceover Track' : 'Music Track'}
              onClose={() => setAudioSheetKey(null)} />
            {audioSheetTrack && (
              <>
                <Text numberOfLines={1} style={{ color:'#fff', fontSize:12, marginBottom:16 }}>
                  {audioSheetTrack.name}
                </Text>
                <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center' }}>
                  <Text style={{ color:'#fff', fontSize:13, fontWeight:'600' }}>Volume</Text>
                  <Text style={{ color:'#00d4d4', fontSize:13 }}>
                    {Math.round((audioSheetTrack.volume ?? 1) * 100)}%
                  </Text>
                </View>
                <Slider style={styles.modalSlider} minimumValue={0} maximumValue={1}
                  value={audioSheetTrack.volume ?? 1}
                  minimumTrackTintColor="#00d4d4" maximumTrackTintColor="#333" thumbTintColor="#00d4d4"
                  onValueChange={(v) => setAudioTrackVolume(audioSheetTrack.key, v)} />
                <View style={{ flexDirection:'row', gap:10, marginTop:4 }}>
                  <TouchableOpacity
                    onPress={() => setAudioTrackVolume(audioSheetTrack.key, (audioSheetTrack.volume ?? 1) > 0 ? 0 : 1)}
                    style={{ flex:1, flexDirection:'row', alignItems:'center', justifyContent:'center', gap:6,
                      backgroundColor:'#2a2a2a', borderRadius:8, paddingVertical:12 }}>
                    <MaterialIcons name={(audioSheetTrack.volume ?? 1) > 0 ? 'volume-up' : 'volume-off'} size={16} color="#fff" />
                    <Text style={{ color:'#fff', fontSize:13, fontWeight:'600' }}>
                      {(audioSheetTrack.volume ?? 1) > 0 ? 'Mute' : 'Unmute'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => removeAudioTrack(audioSheetTrack.key)}
                    style={{ flex:1, flexDirection:'row', alignItems:'center', justifyContent:'center', gap:6,
                      backgroundColor:'#2a1a1a', borderRadius:8, paddingVertical:12 }}>
                    <MaterialIcons name="delete-outline" size={16} color="#ff6b6b" />
                    <Text style={{ color:'#ff6b6b', fontSize:13, fontWeight:'600' }}>Delete</Text>
                  </TouchableOpacity>
                </View>
                <Text style={{
                  color: audioLoadStatus[audioSheetTrack.key] === 'failed' ? '#ff6b6b' : '#666',
                  fontSize: 11, marginTop: 14,
                }}>
                  Preview audio: {audioLoadStatus[audioSheetTrack.key] === 'ready' ? 'ready'
                    : audioLoadStatus[audioSheetTrack.key] === 'failed' ? "couldn't load this file"
                    : 'loading...'}
                </Text>
                {audioSheetTrack.uploadState && audioSheetTrack.uploadState !== 'ready' && (
                  <Text style={{
                    color: audioSheetTrack.uploadState === 'failed' ? '#ff6b6b' : '#666',
                    fontSize: 11, marginTop: 6,
                  }}>
                    {audioSheetTrack.uploadState === 'uploading'
                      ? 'Uploading for waveform and export...'
                      : "Upload failed - plays here, will be retried when you export"}
                  </Text>
                )}
                <Text style={{ color:'#fff', fontSize:11, marginTop:6 }}>
                  Starts at {fmtTime(audioSheetTrack.startOffset ?? 0)}
                  {audioSheetTrack.sourceDuration
                    ? ' \u00b7 ' + Math.round((audioSheetTrack.trimEnd ?? audioSheetTrack.sourceDuration) - (audioSheetTrack.trimStart ?? 0)) + 's long'
                    : ''}
                  {' \u00b7 drag the block to move it, long-press to delete'}
                </Text>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* RESOLUTION MODAL */}
      <Modal visible={showResModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, sheetInset]}>
            <SheetHeader title="Export Resolution" onClose={() => setShowResModal(false)} />
            {['720p','1080p','4K'].map(r => {
              // Same rank comparison the backend clamps with (tiers.js's
              // RESOLUTION_RANK) - kept here only to grey out and prompt
              // upgrade before a request is even sent, not as the real
              // enforcement, which stays server-side either way.
              const RANK = { '720p': 0, '1080p': 1, '4K': 2 };
              const locked = RANK[r] > (RANK[caps.maxResolution] ?? 0);
              return (
                <TouchableOpacity key={r} style={[styles.resRow, resolution === r && styles.resRowActive]}
                  onPress={() => {
                    if (locked) { promptUpgrade(`${r} export`); return; }
                    setResolution(r); setShowResModal(false);
                  }}>
                  <Text style={[styles.resText, resolution === r && { color: '#2ECC71' }, locked && { color: '#555' }]}>{r}</Text>
                  {/* Diamond, not a padlock - the same mark the transitions use. A
                      padlock says "you cannot", a diamond says "this is on a paid
                      plan", and only one of those is true here. */}
                  {locked
                    ? <MaterialIcons name="diamond" size={14} color="#f5c451" />
                    : resolution === r && <MaterialIcons name="check" size={18} color="#2ECC71" />}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </Modal>

      {/* IMAGE DURATION MODAL */}
      <Modal visible={showImageDurationModal} transparent animationType="slide">
        <View style={{ flex:1, justifyContent:'flex-end', backgroundColor:'rgba(0,0,0,0.6)' }}>
          <View style={[{ backgroundColor:'#1a1a1a', borderTopLeftRadius:16, borderTopRightRadius:16, padding:20 }, sheetInset]}>
            <SheetHeader title="Photo Duration" onClose={() => setShowImageDurationModal(false)} />
            {selectedItem && (
              <>
                {/* One decimal, because the slider can now set one. A whole-second
                    readout under a continuous control just hides what it did. */}
                <Text style={{ color:'#fff', fontSize:13, marginBottom:8 }}>
                  Duration: {Number(selectedItem.duration ?? 3).toFixed(1)}s
                </Text>
                {/* Same floor as the drag handles, and continuous like them. This read
                    minimumValue 1 with step 1 while the handles go to MIN_CLIP_DUR and
                    move freely - so merely opening this sheet on a 0.4s photo rewrote
                    it to 1s, and any photo cut to a beat or a phrase was rounded away
                    the moment the slider was touched. A control must not destroy a
                    value just by being looked at. */}
                <Slider style={{ width: '100%', height: 32 }}
                  minimumValue={MIN_CLIP_DUR} maximumValue={IMAGE_MAX_DUR}
                  value={selectedItem.duration}
                  minimumTrackTintColor="#00d4d4"
                  maximumTrackTintColor="#333"
                  thumbTintColor="#00d4d4"
                  onValueChange={v => setItems(prev =>
                    prev.map(i => i.key === selectedKey ? { ...i, duration: v } : i))}
                />
              </>
            )}
            <TouchableOpacity onPress={() => setShowImageDurationModal(false)}
              style={{ backgroundColor:'#2ECC71', borderRadius:8, padding:14, alignItems:'center', marginTop:16 }}>
              <Text style={{ color:'#000', fontWeight:'bold' }}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* AUDIO LIST MODAL */}
      <Modal visible={showAudioListModal} transparent animationType="slide">
        <View style={{ flex:1, justifyContent:'flex-end', backgroundColor:'rgba(0,0,0,0.6)' }}>
          <View style={[{ backgroundColor:'#1a1a1a', borderTopLeftRadius:16, borderTopRightRadius:16, padding:20, maxHeight:'70%' }, sheetInset]}>
            <SheetHeader title="Audio Tracks" onClose={() => setShowAudioListModal(false)} />
            <ScrollView>
              {audioTracks.map(track => (
                <TouchableOpacity key={track.key}
                  onPress={() => { setShowAudioListModal(false); setSelectedAudioTrackKey(track.key); setAudioSheetKey(track.key); }}
                  style={{ flexDirection:'row', alignItems:'center', backgroundColor:'#2a2a2a', borderRadius:8, padding:10, marginBottom:8 }}>
                  <MaterialIcons name={track.isVoiceover ? 'record-voice-over' : 'music-note'} size={16} color="#00d4d4" />
                  <Text style={{ color:'#fff', flex:1, marginLeft:8, fontSize:13 }} numberOfLines={1}>{track.name}</Text>
                  <Text style={{ color:'#fff', fontSize:11, marginRight:8 }}>{Math.round((track.volume ?? 1) * 100)}%</Text>
                  <TouchableOpacity onPress={() => removeAudioTrack(track.key)}>
                    <MaterialIcons name="close" size={18} color="#fff" />
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity onPress={() => setShowAudioListModal(false)}
              style={{ alignItems:'center', padding:10, marginTop:6 }}>
              <Text style={{ color:'#fff' }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* TEXT LIST MODAL */}
      <Modal visible={showTextListModal} transparent animationType="slide">
        <View style={{ flex:1, justifyContent:'flex-end', backgroundColor:'rgba(0,0,0,0.6)' }}>
          <View style={[{ backgroundColor:'#1a1a1a', borderTopLeftRadius:16, borderTopRightRadius:16, padding:20, maxHeight:'70%' }, sheetInset]}>
            <SheetHeader title="Text Overlays" onClose={() => setShowTextListModal(false)} />
            <ScrollView>
              {textOverlays.map(t => (
                <TouchableOpacity key={t.key}
                  onPress={() => { setShowTextListModal(false); setEditingText(t); setTextInput(t.text); setTextColor(t.color); setTextFont(t.font); setTextSize(t.size); setTextBackground(t.background || DEFAULT_TEXT_BACKGROUND); setShowTextModal(true); }}
                  style={{ flexDirection:'row', alignItems:'center', backgroundColor:'#2a2a2a', borderRadius:8, padding:10, marginBottom:8 }}>
                  <Text style={{ color: t.color, flex:1, fontSize:13 }} numberOfLines={1}>{t.text}</Text>
                  <TouchableOpacity onPress={() => removeTextOverlay(t.key)}>
                    <MaterialIcons name="close" size={18} color="#fff" />
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity onPress={() => setShowTextListModal(false)}
              style={{ alignItems:'center', padding:10, marginTop:6 }}>
              <Text style={{ color:'#fff' }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* VOICEOVER MODAL */}
      <Modal visible={showVoiceoverModal} transparent animationType="slide">
        <View style={{ flex:1, justifyContent:'flex-end', backgroundColor:'rgba(0,0,0,0.6)' }}>
          <View style={[{ backgroundColor:'#1a1a1a', borderTopLeftRadius:16, borderTopRightRadius:16, padding:20, maxHeight:'85%' }, sheetInset]}>
            <SheetHeader title="Add Voiceover" onClose={() => setShowVoiceoverModal(false)} />

            <SourceTabs
              tabs={VOICEOVER_SOURCES}
              value={voiceoverTab}
              isPremium={isPremium}
              onSelect={(t) => setVoiceoverTab(t.key)}
            />

            {voiceoverTab === 'generate' ? (
              <ScrollView>
                <Text style={{ color:'#fff', fontSize:12, marginBottom:6 }}>Script</Text>
                <TextInput
                  style={{ backgroundColor:'#2a2a2a', color:'#fff', borderRadius:8, padding:10, minHeight:70, marginBottom:14, textAlignVertical:'top' }}
                  placeholder="Type what you want the voiceover to say..."
                  placeholderTextColor="#555"
                  multiline
                  value={voiceoverScript}
                  onChangeText={setVoiceoverScript}
                />
                <Text style={{ color:'#fff', fontSize:12, marginBottom:8 }}>Voice</Text>
                {/* One row that opens the picker, not a strip of every voice. The
                    catalogue is 325 across 75 languages now - a horizontal scroll of
                    that is not something anyone reaches the end of. */}
                <TouchableOpacity
                  onPress={() => setShowVoicePicker(true)}
                  style={{ flexDirection:'row', alignItems:'center', gap:12, backgroundColor:'#1a1a1a',
                    borderWidth:1, borderColor:'#2a2a2a', borderRadius:14, padding:12, marginBottom:16 }}
                >
                  <VoiceAvatar voice={voiceById(voiceId)} size={40} selected />
                  <View style={{ flex:1 }}>
                    <Text style={{ color:'#fff', fontWeight:'700', fontSize:15 }}>{voiceById(voiceId).label}</Text>
                    <Text style={{ color:'#fff', fontSize:12, marginTop:2 }}>
                      {voiceById(voiceId).langName} · {voiceById(voiceId).accent}
                    </Text>
                  </View>
                  <Text style={{ color:'#2ECC71', fontWeight:'700', fontSize:13 }}>Change</Text>
                  <MaterialIcons name="chevron-right" size={20} color="#2ECC71" />
                </TouchableOpacity>

                <TouchableOpacity onPress={generateVoiceover} disabled={generatingVoiceover}
                  style={{ backgroundColor:'#2ECC71', borderRadius:8, padding:14, alignItems:'center', marginBottom:10, opacity: generatingVoiceover ? 0.6 : 1 }}>
                  {generatingVoiceover
                    ? <ActivityIndicator color="#000" />
                    : <Text style={{ color:'#000', fontWeight:'bold', fontSize:15 }}>Generate Voiceover</Text>}
                </TouchableOpacity>

                {voiceoverTracks.map(t => (
                  <View key={t.key} style={{ flexDirection:'row', alignItems:'center', backgroundColor:'#2a2a2a', borderRadius:8, padding:10, marginBottom:8 }}>
                    <MaterialIcons name="graphic-eq" size={16} color="#00d4d4" />
                    <Text style={{ color:'#fff', flex:1, marginLeft:8, fontSize:12 }} numberOfLines={1}>{t.name}</Text>
                    <TouchableOpacity onPress={() => addVoiceoverTrack(t)} style={{ marginLeft:8 }}>
                      <Text style={{ color:'#2ECC71', fontWeight:'700', fontSize:12 }}>ADD</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            ) : (
              <View>
                <TouchableOpacity onPress={pickVoiceoverFile}
                  style={{ backgroundColor:'#2a2a2a', borderRadius:8, padding:16, alignItems:'center', marginBottom:10 }}>
                  <MaterialIcons name="upload-file" size={28} color="#00d4d4" />
                  <Text style={{ color:'#fff', marginTop:8 }}>Browse audio files</Text>
                </TouchableOpacity>
                {voiceoverTracks.map(t => (
                  <View key={t.key} style={{ flexDirection:'row', alignItems:'center', backgroundColor:'#2a2a2a', borderRadius:8, padding:10, marginBottom:8 }}>
                    <MaterialIcons name="graphic-eq" size={16} color="#00d4d4" />
                    <Text style={{ color:'#fff', flex:1, marginLeft:8, fontSize:12 }} numberOfLines={1}>{t.name}</Text>
                    <TouchableOpacity onPress={() => addVoiceoverTrack(t)} style={{ marginLeft:8 }}>
                      <Text style={{ color:'#2ECC71', fontWeight:'700', fontSize:12 }}>ADD</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            <TouchableOpacity onPress={() => setShowVoiceoverModal(false)} style={{ alignItems:'center', padding:10, marginTop:6 }}>
              <Text style={{ color:'#fff' }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MUSIC MODAL */}
      <Modal visible={showMusicModal} transparent animationType="slide">
        <View style={{ flex:1, justifyContent:'flex-end', backgroundColor:'rgba(0,0,0,0.6)' }}>
          <View style={[{ backgroundColor:'#1a1a1a', borderTopLeftRadius:16, borderTopRightRadius:16, padding:20, maxHeight:'85%' }, sheetInset]}>
            <SheetHeader title="Add Music" onClose={closeMusicModal} />

            <SourceTabs
              tabs={MUSIC_SOURCES}
              value={musicTab}
              isPremium={isPremium}
              onSelect={(t) => {
                setMusicTab(t.key);
                if (t.key === 'library') loadMusicLibrary();
              }}
            />

            {musicTab === 'library' ? (
              musicLoading ? (
                <ActivityIndicator color="#00d4d4" style={{ marginVertical: 30 }} />
              ) : (
                <>
                  {/* Mood, then tempo. 68 tracks in one alphabetical column is a folder,
                      not a library - you cannot look for "something calm and slow", which
                      is the only way anyone actually chooses music for a cut.
                      Teal, because these switch which part of the library you are looking
                      at rather than choosing a value. */}
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}
                    style={styles.musicFilterRow} contentContainerStyle={styles.musicFilterContent}>
                    {musicMoods.map(m => (
                      <TouchableOpacity key={m} onPress={() => setMusicMood(m)}
                        style={[styles.musicChip, musicMood === m && styles.musicChipActive]}>
                        <Text style={[styles.musicChipText, musicMood === m && styles.musicChipTextActive]}>{m}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}
                    style={styles.musicFilterRow} contentContainerStyle={styles.musicFilterContent}>
                    {MUSIC_TEMPOS.map(t => (
                      <TouchableOpacity key={t} onPress={() => setMusicTempo(t)}
                        style={[styles.musicChip, musicTempo === t && styles.musicChipActive]}>
                        <Text style={[styles.musicChipText, musicTempo === t && styles.musicChipTextActive]}>{t}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  <Text style={styles.musicCount}>
                    {musicFiltered.length} of {musicLibraryTracks.length} tracks
                  </Text>

                  {/* No flex here, deliberately. The sheet is maxHeight:'85%', which
                      bounds it but does not give it a definite height - so a flex:1
                      child has nothing to flex against and resolves to zero, which is
                      exactly what emptied this list. Content-sized and clipped by the
                      sheet is what worked, and the chip rows above are protected by
                      flexShrink:0 rather than by this competing with them. */}
                  <ScrollView>
                    {musicFiltered.map(track => (
                      <TouchableOpacity key={track.id} onPress={() => addMusicTrackFromLibrary(track)}
                        style={styles.musicRow}>
                        <TouchableOpacity onPress={() => previewMusicTrack(track)}
                          style={[styles.musicPlay, musicPreviewPlayingId === track.id && styles.musicPlayOn]}>
                          <MaterialIcons name={musicPreviewPlayingId === track.id ? 'pause' : 'play-arrow'} size={18}
                            color={musicPreviewPlayingId === track.id ? '#000' : '#fff'} />
                        </TouchableOpacity>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.musicName} numberOfLines={1}>{track.name}</Text>
                          {/* What the track IS, which is what you are choosing on. */}
                          <Text style={styles.musicMeta} numberOfLines={1}>
                            {[track.mood, track.bpm ? `${track.bpm} BPM` : null,
                              track.seconds ? fmtTime(track.seconds) : null]
                              .filter(Boolean).join('  ·  ')}
                          </Text>
                        </View>
                        <Text style={styles.musicAdd}>ADD</Text>
                      </TouchableOpacity>
                    ))}
                    {musicFiltered.length === 0 && (
                      <Text style={styles.musicEmpty}>Nothing matches those two filters.</Text>
                    )}
                  </ScrollView>
                </>
              )
            ) : (
              <TouchableOpacity onPress={pickMusicFile}
                style={{ backgroundColor:'#2a2a2a', borderRadius:8, padding:16, alignItems:'center', marginBottom:10 }}>
                <MaterialIcons name="upload-file" size={28} color="#00d4d4" />
                <Text style={{ color:'#fff', marginTop:8 }}>Browse audio files</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity onPress={closeMusicModal} style={{ alignItems:'center', padding:10, marginTop:6 }}>
              <Text style={{ color:'#fff' }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* TRANSITION PICKER - 133 recipes, each tile playing its own preview. */}
      <TransitionSheet
        visible={showTransitionModal}
        value={items.find(i => i.key === transitionTargetKey)?.transition || 'none'}
        backend={BACKEND}
        isPremium={isPremium}
        onSelect={(id) => {
          setClipTransition(transitionTargetKey, id);
          setShowTransitionModal(false);
          offerApplyToAll(id);
        }}
        // Stays open on a locked tap: the point is to keep browsing the ones that are
        // locked, not to be thrown out of the sheet for touching one.
        onLocked={(t) => promptUpgrade(t.label)}
        onClose={() => setShowTransitionModal(false)}
      />

      {/* Asked in the app's own surface rather than through Alert.alert, whose grey
          platform slab has no relationship to anything around it. */}
      <ConfirmSheet
        visible={!!applyAllPrompt}
        title={applyAllPrompt?.def?.base
          ? `Use ${applyAllPrompt.def.label} everywhere?`
          : 'Remove every transition?'}
        message={applyAllPrompt?.def?.base
          ? `${applyAllPrompt.def.label} is on this join. Put it between all ${applyAllPrompt?.joins} of your clips? You can change any of them afterwards.`
          : `Take the transition off all ${applyAllPrompt?.joins} joins? You can set them again one at a time.`}
        previewUri={applyAllPrompt?.def?.base
          ? `${BACKEND}/transitions/${applyAllPrompt.def.id}.webp?v=${TRANSITION_PREVIEW_VERSION}`
          : null}
        icon="content-cut"
        confirmLabel={applyAllPrompt?.def?.base ? 'Apply to all' : 'Remove all'}
        cancelLabel="Just this one"
        destructive={!applyAllPrompt?.def?.base}
        onConfirm={() => applyTransitionEverywhere(applyAllPrompt.id)}
        onCancel={() => setApplyAllPrompt(null)}
      />

      <CropSheet
        visible={showCropSheet}
        item={selectedItem}
        sourceSize={cropSize}
        boxW={SW - 64}
        boxH={SH * 0.42}
        onApply={(crop) => {
          setItems(prev => prev.map(i => (i.key === selectedKey ? { ...i, crop } : i)));
          setShowCropSheet(false);
        }}
        onClose={() => setShowCropSheet(false)}
      />

      <BackgroundSheet
        visible={showBackgroundSheet}
        value={background}
        onChange={setBackground}
        onClose={() => setShowBackgroundSheet(false)}
      />

      <StickerSheet
        visible={showStickerSheet}
        backend={BACKEND}
        isPremium={isPremium}
        onSelect={addSticker}
        onLocked={(s) => promptUpgrade(s.label)}
        onClose={() => setShowStickerSheet(false)}
      />

      <AdjustSheet
        visible={showAdjustSheet}
        value={selectedItem?.adjust}
        onChange={(next) => setItems(prev => prev.map(i => (
          i.key === selectedKey ? { ...i, adjust: next } : i
        )))}
        onClose={() => setShowAdjustSheet(false)}
      />

      <EffectPicker
        backend={BACKEND}
        visible={showEffectSheet}
        value={selectedItem?.effect || 'none'}
        isPremium={isPremium}
        onSelect={(id) => { applyEffect(id); setShowEffectSheet(false); }}
        onLocked={(e) => promptUpgrade(e.label)}
        onClose={() => setShowEffectSheet(false)}
      />

      <MaskSheet
        visible={showMaskSheet}
        value={selectedItem?.mask || null}
        onChange={(next) => setItems(prev => prev.map(i => (
          i.key === selectedKey ? { ...i, mask: next || undefined } : i
        )))}
        onClose={() => setShowMaskSheet(false)}
      />

      <LayersSheet
        visible={showLayersSheet}
        overlays={textOverlays}
        onReorder={setTextOverlays}
        onClose={() => setShowLayersSheet(false)}
      />

      <TransformSheet
        visible={showTransformSheet}
        value={selectedItem?.transform || null}
        rotate={Number(selectedItem?.rotate) || 0}
        onChange={(next) => setItems(prev => prev.map(i => (
          i.key === selectedKey ? { ...i, transform: next || undefined } : i
        )))}
        onRotate={(deg) => setItems(prev => prev.map(i => (
          i.key === selectedKey ? { ...i, rotate: deg || undefined } : i
        )))}
        onClose={() => setShowTransformSheet(false)}
      />

      <TransparencySheet
        visible={showTransparencySheet}
        value={selectedItem?.opacity ?? null}
        onChange={(next) => setItems(prev => prev.map(i => (
          i.key === selectedKey ? { ...i, opacity: next ?? undefined } : i
        )))}
        onClose={() => setShowTransparencySheet(false)}
      />

      <AudioFxSheet
        visible={audioFxTarget !== null}
        title={audioFxTarget === 'clip' ? 'Clip audio effects' : 'Track audio effects'}
        value={audioFxTarget === 'clip'
          ? (selectedItem?.audioFx || null)
          : (audioTracks.find(t => t.key === audioFxTarget)?.audioFx || null)}
        isPremium={isPremium}
        onSelect={(id) => {
          if (audioFxTarget === 'clip') {
            setItems(prev => prev.map(i => (
              i.key === selectedKey ? { ...i, audioFx: id || undefined } : i
            )));
          } else {
            setTrackField(audioFxTarget, { audioFx: id || undefined });
          }
        }}
        onLocked={(fx) => promptUpgrade(fx.label, 'Audio effects are available on the Pro and Creator plans.')}
        onClose={() => setAudioFxTarget(null)}
      />

      <ChromaSheet
        visible={showChromaSheet}
        value={selectedItem?.chromaKey || null}
        onChange={(next) => setItems(prev => prev.map(i => (
          i.key === selectedKey ? { ...i, chromaKey: next || undefined } : i
        )))}
        onClose={() => setShowChromaSheet(false)}
      />

      <MotionPicker
        backend={BACKEND}
        visible={showMotionSheet}
        value={selectedItem?.motion || 'none'}
        isPremium={isPremium}
        onSelect={(id) => { applyMotion(id); setShowMotionSheet(false); }}
        onLocked={(m) => promptUpgrade(m.label)}
        onClose={() => setShowMotionSheet(false)}
      />

      <FilterSheet
        visible={showFilterSheet}
        value={selectedItem?.filter || 'None'}
        backend={BACKEND}
        isPremium={isPremium}
        onSelect={(id) => { applyFilter(id); setShowFilterSheet(false); }}
        onLocked={(f) => promptUpgrade(f.label)}
        onClose={() => setShowFilterSheet(false)}
      />

      {/* Unfinished work from a previous session. */}
      <ConfirmSheet
        visible={!!draftOffer}
        icon="history"
        title="Pick up where you left off?"
        message={draftOffer
          ? `You were editing ${draftOffer.items?.length || 0} clip${(draftOffer.items?.length || 0) === 1 ? '' : 's'} ${describeAge(draftOffer.savedAt)}.`
            + (draftOffer.missingCount
              ? `\n\n${draftOffer.missingCount} of ${draftOffer.mediaTotal} files are no longer on this device - those clips come back empty and can be replaced. Everything else is intact.`
              : ' Restore that project, or start a new one?')
          : ''}
        confirmLabel="Restore"
        cancelLabel="Start fresh"
        onConfirm={() => restoreDraft(draftOffer)}
        onCancel={discardDraft}
        // Tapping the backdrop is not an answer. On every other sheet dismissing means
        // "no", but here "no" DELETES the saved project - so a stray tap beside the
        // card would throw away the work it was offering back. Only the explicit
        // Start fresh discards; dismissing leaves the draft alone to be offered again.
        onDismiss={() => { setDraftOffer(null); setDraftChecked(true); }}
      />

      {/* AUTO CAPTIONS MODAL */}
      <Modal visible={showCaptionModal} transparent animationType="slide">
        <View style={{ flex:1, justifyContent:'flex-end', backgroundColor:'rgba(0,0,0,0.6)' }}>
          <View style={[{ backgroundColor:'#1a1a1a', borderTopLeftRadius:16, borderTopRightRadius:16, padding:20, maxHeight: '80%' }, sheetInset]}>
            <SheetHeader title="Auto Captions" onClose={() => setShowCaptionModal(false)} />
            <ScrollView showsVerticalScrollIndicator={false} scrollEnabled={!colorDragging}>

            <Text style={{ color:'#fff', fontSize:12, marginBottom:6 }}>Caption Script (optional)</Text>
            <TextInput
              style={{ backgroundColor:'#2a2a2a', color:'#fff', borderRadius:8, padding:10, minHeight:80, marginBottom:14, textAlignVertical:'top' }}
              placeholder="Enter script or leave blank to auto-detect..."
              placeholderTextColor="#555"
              multiline
              value={captionScript}
              onChangeText={setCaptionScript}
            />

            <CaptionStylePicker value={captionStyle} onChange={setCaptionStyle} />

            <View style={{ flexDirection:'row', alignItems:'center', marginBottom:8 }}>
              <Text style={{ color:'#fff', fontSize:12, flex:1 }}>Caption Colour</Text>
              {captionColor && (
                <TouchableOpacity onPress={() => setCaptionColor(null)} accessibilityRole="button">
                  <Text style={{ color:'#2ECC71', fontSize:12, fontWeight:'600' }}>Match style</Text>
                </TouchableOpacity>
              )}
            </View>
            <ColorPicker
              color={effectiveCaptionColor}
              onChange={setCaptionColor}
              onCommit={rememberColor}
              presets={TEXT_COLORS}
              recents={recentColors}
              onDragStateChange={setColorDragging}
            />
            {captionColor && (
              <Text style={{ color:'#fff', fontSize:11, marginTop:6 }}>
                Overrides the style's own fill, including a gradient one.
              </Text>
            )}
            </ScrollView>

            <TouchableOpacity onPress={handleAutoCaption}
              style={{ backgroundColor:'#2ECC71', borderRadius:8, padding:14, alignItems:'center', marginBottom:10 }}>
              <Text style={{ color:'#000', fontWeight:'bold', fontSize:15 }}>Generate Captions</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowCaptionModal(false)}
              style={{ alignItems:'center', padding:10 }}>
              <Text style={{ color:'#fff' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, gap: 4 },
  topBtn: { padding: 4 },
  qualityBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a1a', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginRight: 8, gap: 4, borderWidth: 1, borderColor: '#333' },
  qualityText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  exportBtn: { backgroundColor: '#1a1a1a', borderRadius: 8, paddingHorizontal: 20, paddingVertical: 8 },
  exportBtnActive: { backgroundColor: '#2ECC71' },
  exportBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  previewContainer: { alignItems: 'center', paddingVertical: 6, backgroundColor: '#000' },
  // Size comes from the project's aspect at render time; the fixed 9/16 that used to
  // be here is why every export was portrait whatever the picker said.
  previewFrame: { backgroundColor: '#111', borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: '#222' },
  exportBadge: { position: 'absolute', top: 6, left: 6, right: 6, zIndex: 5, flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.62)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3 },
  exportBadgeText: { color: '#fff', fontSize: 9, fontWeight: '600', flex: 1 },
  previewImage: { width: '100%', height: '100%' },
  previewEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  previewEmptyText: { color: '#fff', fontSize: 12 },
  textOverlayPreview: { position: 'absolute', bottom: 40, left: 0, right: 0, textAlign: 'center', textShadowColor: '#000', textShadowRadius: 4 },
  playbackRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 8 },
  playBtn: { padding: 4 },
  playBtnMain: { padding: 4 },

  timeline: { flex: 1, backgroundColor: '#0a0a0a', borderTopWidth: 1, borderTopColor: '#1a1a1a' },
  timecodeRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  // Exactly the sidebar's width, so what follows lines up with the clips rather
  // than with the end of a string whose length changes as the video plays.
  timecodeCell: { width: SIDEBAR_W, paddingLeft: 10 },
  timecode: { color: '#fff', fontSize: 9, fontFamily: 'monospace' },
  // marginLeft is the sidebar's width, so tick 00:00 sits over the head of the
  // clips rather than over the Mute button.
  // No left margin now: it sits after the clock's cell, which is already the
  // sidebar's width. flex so it takes the rest of the line.
  rulerClip: { height: RULER_H, flex: 1, overflow: 'hidden' },
  rulerRow: { height: RULER_H },
  rulerTick: { position: 'absolute', top: 0, alignItems: 'center', width: 60, marginLeft: -30 },
  rulerTickMark: { width: 1, height: 5, backgroundColor: '#3a3a3a' },
  rulerTickLabel: { color: '#fff', fontSize: 9, marginTop: 2 },
  timeMarkers: { flexDirection: 'row', gap: 20 },
  timeMarker: { color: '#333', fontSize: 9 },
  // The add buttons ride above the rows rather than in them: each one is pinned to
  // its own row's vertical centre and to the right edge of the timeline, so it stays
  // put however far the footage under it is scrolled. Laid out from each row's
  // measured frame rather than from a table of heights, because a row is only as tall
  // as whatever chip happens to be on it.
  addRail: { position: 'absolute', right: RAIL_INSET, top: 0, bottom: 0, zIndex: 20 },
  railBtn: { position: 'absolute', right: 0, width: RAIL_BTN, height: RAIL_BTN, borderRadius: RAIL_BTN / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(18,18,18,0.9)', borderWidth: 1, borderColor: '#3a3a3a' },
  // The add-clip slot as it always looked, now pinned instead of trailing the clips.
  // Opaque rather than the rail's translucent fill: a dashed border over moving
  // footage reads as a broken edge on the clip behind it rather than as an empty slot.
  railBtnClip: { position: 'absolute', right: 0, width: 40, height: CLIP_H, borderRadius: 3, borderWidth: 1, borderColor: '#333', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', backgroundColor: '#111' },
  trackArea: { flex: 1, flexDirection: 'row' },
  sidebar: { width: SIDEBAR_W, alignItems: 'center', paddingTop: 8, gap: 12, borderRightWidth: 1, borderRightColor: '#1a1a1a' },
  sideBtn: { alignItems: 'center', gap: 2 },
  sideBtnLabel: { color: '#fff', fontSize: 9, textAlign: 'center' },
  coverThumbWrap: { alignItems: 'center', gap: 2 },
  coverThumbImg: { width: 40, height: 48, borderRadius: 4, backgroundColor: '#1a1a1a' },
  coverThumbEmpty: { width: 40, height: 48, borderRadius: 4, backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#333' },
  coverEditIcon: { position: 'absolute', top: 2, right: -2 },
  clipsWrapper: { flex: 1, position: 'relative' },
  scrubberLine: { position: 'absolute', top: 0, bottom: 0, width: SCRUBBER_LINE_W, backgroundColor: '#fff', zIndex: 10, opacity: 0.9 },
  // minHeight so the row keeps a clip's height with no clips on it. Without it the
  // empty row collapses to its own padding, the aux rows ride up into the space, and
  // the add-clip square - centred on a 12px row - is placed above the track area
  // entirely, in the timecode strip.
  clipsScroll: { flexDirection: 'row', paddingRight: 40, alignItems: 'center', paddingVertical: 6, minHeight: CLIP_H + 12 },
  clipSlot: { flexDirection: 'row', alignItems: 'center', position: 'relative' },
  clipFrame: { height: CLIP_H, borderRadius: 3, overflow: 'hidden', borderWidth: 1, borderColor: '#333', position: 'relative' },
  clipFrameSelected: { borderColor: '#00d4d4', borderWidth: 2 },
  coverBadge: { position: 'absolute', top: 3, left: 3, backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 3, flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 3, paddingVertical: 1 },
  coverText: { color: '#fff', fontSize: 8, fontWeight: '700' },
  mutedBadge: { position: 'absolute', top: 3, right: 3, backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 10, padding: 2 },
  speedBadge: { position: 'absolute', bottom: 14, right: 3, backgroundColor: '#00d4d430', borderRadius: 3, paddingHorizontal: 3 },
  speedBadgeText: { color: '#00d4d4', fontSize: 8, fontWeight: '700' },
  clipBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 3, paddingVertical: 1 },
  clipDuration: { color: '#fff', fontSize: 8, fontWeight: '700' },
  // Inset past the right trim handle, which appears under exactly the same condition
  // this button does and would otherwise be sitting on top of it.
  clipRemove: { position: 'absolute', top: 3, right: TRIM_HANDLE_W + 3, backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 10, width: 16, height: 16, alignItems: 'center', justifyContent: 'center' },
  trimHandle: { position: 'absolute', top: 0, width: TRIM_HANDLE_W, height: CLIP_H, alignItems: 'center', justifyContent: 'center', backgroundColor: '#00d4d4' },
  trimGrip: { width: 3, height: CLIP_H * 0.4, borderRadius: 2, backgroundColor: '#04211f' },
  clipRowInner: { flexDirection: 'row', position: 'relative' },
  addClipBtn: { width: 40, height: CLIP_H, borderRadius: 3, borderWidth: 1, borderColor: '#333', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', backgroundColor: '#111' },
  // The timeline's own background, so the join reads as a gap between two clips
  // rather than as a line drawn over them.
  clipSeam: { position: 'absolute', top: 0, bottom: 0, width: CLIP_SEAM_W, backgroundColor: '#0a0a0a' },
  transitionBtn: { position: 'absolute', top: (CLIP_H - TRANSITION_BTN) / 2, width: TRANSITION_BTN, height: TRANSITION_BTN, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1a1a1af2', borderRadius: TRANSITION_BTN / 2, borderWidth: 1, borderColor: '#3a3a3a' },
  // Filled rather than merely tinted: at 22px a colour change alone is easy to miss
  // on a busy strip, and this is the only thing on the timeline that says a join has
  // a transition on it.
  transitionBtnSet: { backgroundColor: '#00d4d4', borderColor: '#00d4d4' },
  auxScroll: { paddingLeft: '50%', paddingRight: 40 },
  auxScrollRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  auxTrackBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 26, paddingHorizontal: 12, borderRadius: 13, borderWidth: 1, borderColor: '#222', backgroundColor: '#111' },
  auxLabel: { color: '#fff', fontSize: 11 },


  tabContent: { flexDirection: 'row', alignItems: 'center' },
  tabSectionLabel: { color: '#fff', fontSize: 10, fontWeight: '700', letterSpacing: 1, marginBottom: 6 },
  toolChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#1a1a1a', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, marginRight: 8, borderWidth: 1, borderColor: '#2a2a2a' },
  toolChipActive: { backgroundColor: '#2ECC71', borderColor: '#2ECC71' },
  toolChipText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  clipInfo: { marginTop: 8 },
  clipInfoText: { color: '#fff', fontSize: 11, marginBottom: 4 },
  clipInfoLabel: { color: '#fff', fontSize: 11, width: 90 },
  durationRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  audioTrackRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#1a1a1a', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginTop: 4 },
  audioTrackName: { flex: 1, color: '#fff', fontSize: 12 },
  textChip: { backgroundColor: '#1a1a1a', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, marginRight: 8, borderWidth: 1, borderColor: '#2a2a2a' },
  textChipText: { fontSize: 13 },
  captionChip: { backgroundColor: 'rgba(46,204,113,0.15)', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, marginRight: 8, borderWidth: 1, borderColor: '#2ECC71' },
  captionChipText: { fontSize: 13, color: '#2ECC71', fontWeight: '600' },

  bottomToolbar: { flexDirection: 'column', borderTopWidth: 1, borderTopColor: '#1a1a1a', backgroundColor: '#000' },
  tabIconsRow: { paddingVertical: 4 },
  tabToolsRow: { paddingTop: 8, paddingBottom: 2, paddingHorizontal: 4, minHeight: 44 },
  tabBtn: { alignItems: 'center', gap: 3, paddingHorizontal: 14, paddingVertical: 4 },
  tabBtnActive: { borderBottomWidth: 2, borderBottomColor: '#00d4d4' },
  tabLabel: { color: '#fff', fontSize: 10, fontWeight: '600' },
  clipToolBtn: { alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, minWidth: 62 },
  barWithAction: { flexDirection: 'row', alignItems: 'center' },
  // paddingHorizontal on the CONTENT container: on a horizontal ScrollView `style` is
  // the clipping box, and padding there shrinks what is visible instead of insetting it.
  // All four of these are load-bearing, and this is the SECOND time the same row has
  // been built with one missing - see the My Videos filter chips in CLAUDE.md.
  //   flexGrow 0    it must not expand to fill the sheet
  //   flexShrink 0  and a 68-track list below must not be able to compress it to
  //                 nothing, which is what was wrong here
  //   alignItems    on the CONTENT, or it defaults to stretch and each chip takes the
  //                 row's height instead of defining it - which clips them mid-chip
  //   padding       on the CONTENT, because on a horizontal ScrollView `style` is the
  //                 clipping box and padding there shrinks what is visible
  musicFilterRow: { flexGrow: 0, flexShrink: 0, marginBottom: 8 },
  musicFilterContent: { alignItems: 'center', gap: 6, paddingHorizontal: 2, paddingVertical: 2 },
  musicChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2a2a2a' },
  musicChipActive: { backgroundColor: 'rgba(0,212,212,0.12)', borderColor: '#00d4d4' },
  musicChipText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  musicChipTextActive: { color: '#00d4d4' },
  musicCount: { color: '#fff', fontSize: 10, marginBottom: 8, opacity: 0.6 },
  musicRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#2a2a2a', borderRadius: 8, padding: 12, marginBottom: 8 },
  musicPlay: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#333', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  musicPlayOn: { backgroundColor: '#00d4d4' },
  musicName: { color: '#fff', fontSize: 13 },
  musicMeta: { color: '#fff', fontSize: 10, opacity: 0.55, marginTop: 2 },
  musicAdd: { color: '#2ECC71', fontWeight: '700', fontSize: 12, marginLeft: 10 },
  musicEmpty: { color: '#fff', opacity: 0.6, fontSize: 12, textAlign: 'center', paddingVertical: 24 },
  tabBackBtn: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: 2 },
  overlayThumbBtn: { alignItems: 'center', backgroundColor: '#2a2a2a', borderRadius: 8, padding: 4 },
  overlayThumb: { width: 32, height: 32, borderRadius: 4 },
  toolIconWrap: { position: 'relative' },
  premiumBadge: { position: 'absolute', right: -7, top: -5 },
  confirmBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#2ECC71', alignItems: 'center', justifyContent: 'center', marginRight: 10, marginLeft: 4 },
  clipToolLabel: { color: '#fff', fontSize: 10, fontWeight: '600', textAlign: 'center' },
  toolGroupDivider: { width: 1, height: 32, backgroundColor: '#2a2a2a', marginHorizontal: 6 },
  translateHint: { color: '#fff', fontSize: 13, lineHeight: 19, marginBottom: 14 },
  translateList: { maxHeight: 320 },
  chipPickerWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 8 },

  uploadOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.88)', alignItems: 'center', justifyContent: 'center', gap: 16, zIndex: 100 },
  uploadMsg: { color: '#fff', fontSize: 13 },
  progressBarBg: { width: '70%', height: 6, backgroundColor: '#222', borderRadius: 3, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#00d4d4', borderRadius: 3 },
  progressText: { color: '#00d4d4', fontSize: 13, fontWeight: '700' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#111', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24 },
  modalLabel: { color: '#fff', fontSize: 12, marginBottom: 4, marginTop: 8 },
  modalSlider: { width: '100%', height: 32 },
  bgToggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingRight: 2,
  },
  // Drawn rather than imported: RN's Switch takes the platform's own look, which
  // on Android is a different green from the brand's and cannot be told otherwise
  // for the track and thumb independently.
  bgSwitch: {
    width: 44, height: 26, borderRadius: 13, backgroundColor: '#333',
    padding: 3, justifyContent: 'center',
  },
  bgSwitchOn: { backgroundColor: '#2ECC71' },
  bgKnob: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#888' },
  bgKnobOn: { backgroundColor: '#0b0b0b', alignSelf: 'flex-end' },
  bgPreviewRow: { alignItems: 'center', paddingVertical: 10 },
  modalBtns: { flexDirection: 'row', gap: 12, marginTop: 16 },
  modalBtnCancel: { flex: 1, backgroundColor: '#1a1a1a', borderRadius: 12, padding: 14, alignItems: 'center' },
  modalBtnCancelText: { color: '#fff', fontWeight: '600' },
  modalBtnApply: { flex: 1, backgroundColor: '#2ECC71', borderRadius: 12, padding: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
  // Same button standing alone in a column. flex: 1 belongs only to the pair in
  // modalBtns, which is a row: in a column it resolves flexBasis to 0, so the
  // button collapses to its own padding and the label is clipped out of it.
  modalBtnApplyBlock: { backgroundColor: '#2ECC71', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 8 },
  trimHint: { color: '#fff', fontSize: 12, marginBottom: 10 },
  missingClip: {
    ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#1a0d0dEE', gap: 2,
  },
  missingClipText: { color: '#ff6b6b', fontSize: 8, fontWeight: '600', textAlign: 'center' },
  missingCanvas: {
    ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#0a0a0aF2', paddingHorizontal: 22, gap: 8,
  },
  missingCanvasText: { color: '#fff', fontSize: 13, fontWeight: '600', textAlign: 'center' },
  missingCanvasHint: { color: '#fff', fontSize: 11, textAlign: 'center', lineHeight: 15 },
  sourceTabsRow: { height: 40, marginBottom: 14 },
  sourceTabsContent: { gap: 8, alignItems: 'center', paddingRight: 4 },
  sourceTab: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 8, backgroundColor: '#2a2a2a',
  },
  // Teal: these switch which view you are looking at, they do not commit anything.
  sourceTabActive: { backgroundColor: '#00d4d4' },
  sourceTabText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  sourceTabTextActive: { color: '#000' },
  sourceTabTextDim: { color: '#5a5a5a' },
  joinLabel: {
    position: 'absolute', top: 8, alignSelf: 'center', flexDirection: 'row',
    alignItems: 'center', gap: 4, backgroundColor: '#00d4d4',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10,
  },
  joinLabelText: { color: '#04211f', fontSize: 10, fontWeight: '700' },
  clipVolRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  audioSheetName: { color: '#fff', fontSize: 12, marginBottom: 14 },
  clipVolLabel: { color: '#fff', fontSize: 13, fontWeight: '600' },
  clipVolValue: { color: '#00d4d4', fontSize: 13 },
  clipMuteBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10 },
  clipMuteText: { color: '#fff', fontSize: 13 },
  clipVolNote: { color: '#fff', fontSize: 11, marginBottom: 12 },
  modalBtnApplyText: { color: '#000', fontWeight: '700' },
  textModalSheet: { maxHeight: '88%' },
  textModalActions: {
    flexDirection: 'row', gap: 12, paddingTop: 12, marginTop: 4,
    borderTopWidth: 1, borderTopColor: '#2a2a2a',
  },
  textModalInput: { backgroundColor: '#1a1a1a', borderRadius: 10, padding: 12, color: '#fff', fontSize: 15, minHeight: 60, borderWidth: 1, borderColor: '#2a2a2a', marginBottom: 8 },
  resRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#1a1a1a' },
  resRowActive: { },
  resText: { color: '#fff', fontSize: 15 },
});
