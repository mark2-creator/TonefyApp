import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, Modal, Image, PanResponder, StyleSheet,
} from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { MaterialIcons } from '@expo/vector-icons';
import SheetHeader, { useSheetInset } from './SheetHeader';

// Crop one clip: a rectangle dragged over the source frame.
//
// The rectangle is stored as FRACTIONS of the source (x, y, w, h in 0..1), never as
// pixels. The sheet draws it at whatever size fits the screen and the export applies
// it to a 4K master; a pixel rectangle would mean one of the two being wrong.
//
// Which makes the source's real shape the one thing this cannot guess. A frame drawn
// to the wrong aspect puts the rectangle over the wrong part of the picture, and the
// crop would come back not matching what was on screen - so the caller measures it and
// this refuses to draw until it has.

const HANDLE = 26;
const MIN_FRAC = 0.12;

const RATIOS = [
  { id: 'free', label: 'Free', r: null },
  { id: '1:1', label: '1:1', r: 1 },
  { id: '4:5', label: '4:5', r: 4 / 5 },
  { id: '9:16', label: '9:16', r: 9 / 16 },
  { id: '16:9', label: '16:9', r: 16 / 9 },
  { id: '3:4', label: '3:4', r: 3 / 4 },
];

const FULL = { x: 0, y: 0, w: 1, h: 1 };
const clamp01 = v => Math.max(0, Math.min(1, v));

function VideoFrame({ uri, style }) {
  // Paused at the first frame: this is a still to aim at, and a clip playing under a
  // crop rectangle makes the edges impossible to judge.
  const player = useVideoPlayer(uri, p => { p.muted = true; p.audioMixingMode = 'mixWithOthers'; });
  return <VideoView player={player} style={style} contentFit="fill" nativeControls={false} />;
}

export default function CropSheet({ visible, item, sourceSize, boxW, boxH, onApply, onClose }) {
  const sheetInset = useSheetInset(16);
  const [crop, setCrop] = useState(item?.crop || FULL);
  const [ratio, setRatio] = useState('free');
  const cropRef = useRef(crop);
  cropRef.current = crop;

  useEffect(() => { if (visible) { setCrop(item?.crop || FULL); setRatio('free'); } }, [visible, item?.key]);

  // The frame drawn at the source's own aspect, fitted inside the space available.
  const frame = useMemo(() => {
    const ar = sourceSize?.width && sourceSize?.height
      ? sourceSize.width / sourceSize.height
      : null;
    if (!ar) return null;
    let w = boxW;
    let h = boxW / ar;
    if (h > boxH) { h = boxH; w = boxH * ar; }
    return { w: Math.round(w), h: Math.round(h) };
  }, [sourceSize, boxW, boxH]);

  // Built once; reads the live rectangle and frame through refs, because a
  // PanResponder captures whatever existed on the render that made it.
  const liveRef = useRef({ crop, frame, ratio });
  liveRef.current = { crop, frame, ratio };

  const makeResponder = (corner) => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => { cropRef.current = liveRef.current.crop; },
    onPanResponderMove: (e, g) => {
      const { frame: f, ratio: rid } = liveRef.current;
      if (!f) return;
      const dx = g.dx / f.w;
      const dy = g.dy / f.h;
      const c = { ...cropRef.current };
      const r = RATIOS.find(x => x.id === rid)?.r || null;

      if (corner === 'move') {
        c.x = clamp01(Math.min(c.x + dx, 1 - c.w));
        c.y = clamp01(Math.min(c.y + dy, 1 - c.h));
      } else {
        // Each corner moves its own two edges, and the opposite corner stays put -
        // which is what makes a resize feel like dragging that corner rather than
        // the whole box drifting.
        let { x, y, w, h } = c;
        if (corner.includes('l')) { const nx = clamp01(x + dx); w += x - nx; x = nx; }
        if (corner.includes('r')) { w = clamp01(w + dx); }
        if (corner.includes('t')) { const ny = clamp01(y + dy); h += y - ny; y = ny; }
        if (corner.includes('b')) { h = clamp01(h + dy); }
        w = Math.max(MIN_FRAC, Math.min(w, 1 - x));
        h = Math.max(MIN_FRAC, Math.min(h, 1 - y));
        if (r && f) {
          // Hold the ratio in DISPLAYED pixels, not in fractions - a 1:1 crop of a
          // 16:9 source is not a square in fraction space.
          const pxW = w * f.w;
          const pxH = pxW / r;
          h = Math.min(pxH / f.h, 1 - y);
          w = (h * f.h * r) / f.w;
        }
        c.x = x; c.y = y; c.w = w; c.h = h;
      }
      setCrop(c);
    },
  });

  const move = useRef(makeResponder('move')).current;
  const tl = useRef(makeResponder('tl')).current;
  const tr = useRef(makeResponder('tr')).current;
  const bl = useRef(makeResponder('bl')).current;
  const br = useRef(makeResponder('br')).current;

  const applyRatio = (rid) => {
    setRatio(rid);
    const r = RATIOS.find(x => x.id === rid)?.r;
    if (!r || !frame) return;
    // Largest rectangle of that ratio, centred.
    let w = 1;
    let h = (frame.w * w) / r / frame.h;
    if (h > 1) { h = 1; w = (h * frame.h * r) / frame.w; }
    setCrop({ x: (1 - w) / 2, y: (1 - h) / 2, w, h });
  };

  const px = frame ? {
    left: crop.x * frame.w, top: crop.y * frame.h,
    width: crop.w * frame.w, height: crop.h * frame.h,
  } : null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, sheetInset]}>
          <SheetHeader title="Crop" onClose={onClose} />

          <View style={[styles.stage, { height: boxH }]}>
            {!frame ? (
              <View style={styles.measuring}>
                <MaterialIcons name="crop" size={28} color="#3a3a3a" />
                <Text style={styles.measuringText}>Measuring this clip…</Text>
              </View>
            ) : (
              <View style={{ width: frame.w, height: frame.h }}>
                {item?.type === 'video'
                  ? <VideoFrame uri={item.uri} style={StyleSheet.absoluteFill} />
                  : <Image source={{ uri: item?.uri }} style={StyleSheet.absoluteFill} resizeMode="stretch" />}

                {/* What the crop throws away, dimmed rather than hidden - you are
                    choosing an edge, so both sides have to stay visible. */}
                <View pointerEvents="none" style={[styles.shade, { left: 0, top: 0, right: 0, height: px.top }]} />
                <View pointerEvents="none" style={[styles.shade, { left: 0, top: px.top + px.height, right: 0, bottom: 0 }]} />
                <View pointerEvents="none" style={[styles.shade, { left: 0, top: px.top, width: px.left, height: px.height }]} />
                <View pointerEvents="none" style={[styles.shade, { left: px.left + px.width, top: px.top, right: 0, height: px.height }]} />

                <View style={[styles.rect, px]} {...move.panHandlers}>
                  <View style={[styles.third, { left: '33.33%' }]} />
                  <View style={[styles.third, { left: '66.66%' }]} />
                  <View style={[styles.thirdH, { top: '33.33%' }]} />
                  <View style={[styles.thirdH, { top: '66.66%' }]} />
                </View>

                <View style={[styles.handle, { left: px.left - HANDLE / 2, top: px.top - HANDLE / 2 }]} {...tl.panHandlers}><View style={styles.grip} /></View>
                <View style={[styles.handle, { left: px.left + px.width - HANDLE / 2, top: px.top - HANDLE / 2 }]} {...tr.panHandlers}><View style={styles.grip} /></View>
                <View style={[styles.handle, { left: px.left - HANDLE / 2, top: px.top + px.height - HANDLE / 2 }]} {...bl.panHandlers}><View style={styles.grip} /></View>
                <View style={[styles.handle, { left: px.left + px.width - HANDLE / 2, top: px.top + px.height - HANDLE / 2 }]} {...br.panHandlers}><View style={styles.grip} /></View>
              </View>
            )}
          </View>

          <View style={styles.ratios}>
            {RATIOS.map(r => (
              <TouchableOpacity
                key={r.id}
                style={[styles.ratio, ratio === r.id && styles.ratioOn]}
                onPress={() => applyRatio(r.id)}>
                <Text style={[styles.ratioText, ratio === r.id && styles.ratioTextOn]}>{r.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.reset} onPress={() => { setCrop(FULL); setRatio('free'); }}>
              <MaterialIcons name="restart-alt" size={18} color="#cfcfcf" />
              <Text style={styles.resetText}>Reset</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.done} onPress={() => onApply(crop)} disabled={!frame}>
              <MaterialIcons name="check" size={18} color="#04211f" />
              <Text style={styles.doneText}>Apply</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#111', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16,
  },
  stage: { alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  measuring: { alignItems: 'center', gap: 8 },
  measuringText: { color: '#888', fontSize: 12 },
  shade: { position: 'absolute', backgroundColor: 'rgba(0,0,0,0.62)' },
  rect: { position: 'absolute', borderWidth: 1.5, borderColor: '#00d4d4' },
  third: { position: 'absolute', top: 0, bottom: 0, width: 1, backgroundColor: 'rgba(255,255,255,0.28)' },
  thirdH: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.28)' },
  handle: {
    position: 'absolute', width: HANDLE, height: HANDLE,
    alignItems: 'center', justifyContent: 'center',
  },
  grip: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#00d4d4', borderWidth: 2, borderColor: '#04211f' },
  ratios: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  ratio: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8,
    backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2a2a2a',
  },
  ratioOn: { backgroundColor: '#00d4d4', borderColor: '#00d4d4' },
  ratioText: { color: '#cfcfcf', fontSize: 12, fontWeight: '600' },
  ratioTextOn: { color: '#000' },
  actions: { flexDirection: 'row', gap: 12 },
  reset: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#1a1a1a', borderRadius: 12, paddingVertical: 13,
    borderWidth: 1, borderColor: '#2a2a2a',
  },
  resetText: { color: '#cfcfcf', fontSize: 14, fontWeight: '600' },
  done: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#2ECC71', borderRadius: 12, paddingVertical: 13,
  },
  doneText: { color: '#04211f', fontSize: 14, fontWeight: '700' },
});
