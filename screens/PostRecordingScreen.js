import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, StatusBar, TextInput, ActivityIndicator
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';

const BACKEND = 'https://api.fitlifesolutions.site';
import { useVideoPlayer, VideoView } from 'expo-video';
import { saveVideoToDevice } from '../utils/saveVideo';
import { showAlert } from '../components/BrandedAlert';
import { getAuth } from 'firebase/auth';
import ProgressButton from '../components/ProgressButton';
import FilterSheet from '../components/FilterPicker';
import AdjustSheet from '../components/AdjustSheet';
import MotionPicker from '../components/MotionPicker';
import EffectPicker from '../components/EffectPicker';
import { FILTERS, resolveFilter, filterCss, filterSpec } from '../constants/filters';
import { EFFECTS, resolveEffect, effectCss, effectChain } from '../constants/effects';
import { MOTIONS, resolveMotion, motionChain } from '../constants/motions';
import { adjustChain } from '../constants/adjustments';
import { usePlan } from '../constants/plan';

export default function PostRecordingScreen({ navigation, route }) {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  // The clip that was just recorded. This screen used to receive nothing at all and
  // drew a videocam icon on a grey rectangle in place of the footage.
  const recordedUri = route?.params?.uri || null;
  const [enhancedUri, setEnhancedUri] = useState(null);
  const uri = enhancedUri || recordedUri;
  const recordedSeconds = Number(route?.params?.seconds) || 0;
  const [refinement, setRefinement] = useState('');
  const [saving, setSaving] = useState(false);
  const [savePct, setSavePct] = useState(0);
  const { isPremium } = usePlan();

  // The clip's own settings, held here and passed to the same sheets the editor uses.
  // These were four Switches bound to booleans nothing read.
  // Seeded from what was chosen before recording, so the look you set up is already on
  // when you get here rather than needing choosing twice.
  const [filter, setFilter] = useState(route?.params?.filter || 'None');
  const [adjust, setAdjust] = useState(null);
  const [effect, setEffect] = useState(route?.params?.effect || 'none');
  const [motion, setMotion] = useState('none');
  const [sheet, setSheet] = useState(null);   // 'filter' | 'adjust' | 'effect' | 'motion'
  const [speed, setSpeed] = useState(1);
  const [refining, setRefining] = useState(false);
  const [position, setPosition] = useState(0);

  const player = useVideoPlayer(uri || null, p => { if (p) p.loop = false; });
  const soonRef = useRef(null);

  const soon = (what) => showAlert(what, 'Coming soon.');

  const SPEEDS = ['0.3', '0.5', '1', '1.5', '2', '3'];

  // Describe the look, get the settings. The model PICKS FROM the catalogues rather
  // than describing a look in prose - asked to invent, it returns ids that do not exist
  // and the app then applies nothing, which reads as the request being ignored.
  async function refineWithAI(text) {
    const prompt = String(text || refinement || '').trim();
    if (!prompt || refining) return;
    setRefining(true);
    try {
      const token = await getAuth().currentUser?.getIdToken();
      const r = await fetch(`${BACKEND}/api/suggest-look`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({
          prompt,
          filters: FILTERS.map(f => f.id),
          effects: EFFECTS.map(e => e.id),
          motions: MOTIONS.map(m => m.id),
          speeds: SPEEDS,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Could not work that out.');

      const applied = [];
      if (d.filter) { setFilter(d.filter); applied.push(resolveFilter(d.filter).label); }
      if (d.effect && d.effect !== 'none') { setEffect(d.effect); applied.push(resolveEffect(d.effect).label); }
      if (d.motion && d.motion !== 'none') { setMotion(d.motion); applied.push(resolveMotion(d.motion).label); }
      if (d.speed && Number(d.speed) !== 1) { setSpeed(Number(d.speed)); applied.push(`${d.speed}x speed`); }

      // Nothing matched is a real answer, not a failure. Saying so beats leaving the
      // screen unchanged and letting it look like the request was dropped.
      showAlert(applied.length ? 'Applied' : 'Nothing matched',
        applied.length
          ? `${applied.join(', ')}. Tap Apply to render it.`
          : 'Nothing in the catalogue matched that. Try naming a look, a mood or a speed.');
      setRefinement('');
    } catch (e) {
      showAlert('Refine', e?.message || 'Could not reach the service.');
    } finally {
      setRefining(false);
    }
  }

  // The same live preview the editor canvas runs. RN 0.81's `filter` style compiles to
  // a ColorMatrixColorFilter on Android, so a grade and a colour effect show on the
  // real footage rather than being described in a label.
  const liveFilter = useMemo(() => {
    const parts = [];
    const f = filter !== 'None' ? filterCss(filter) : null;
    if (f) parts.push(f);
    const e = effect !== 'none' ? effectCss(effect, position) : null;
    if (e) parts.push(e);
    return parts.length ? parts.join(' ') : null;
  }, [filter, effect, position]);

  // A clock for the time-varying effects, only while something needs one.
  useEffect(() => {
    if (effect === 'none' && motion === 'none') return undefined;
    const t = setInterval(() => setPosition(p => p + 0.1), 100);
    return () => clearInterval(t);
  }, [effect, motion]);

  const motionTransform = useMemo(() => {
    const p = motion !== 'none' ? resolveMotion(motion).preview : null;
    if (!p) return null;
    const t = position, prog = Math.max(0, Math.min(1, p.hold ? t / p.hold : (t % 5) / 5));
    const out = []; let scale = 1;
    if (p.zoom) scale = p.zoom[0] + (p.zoom[1] - p.zoom[0]) * prog;
    if (p.osc) scale = p.osc[0] + p.osc[1] * Math.sin(p.osc[2] * t);
    if (p.shake) {
      out.push({ translateX: p.shake.ax * Math.sin(p.shake.fx * t) });
      out.push({ translateY: p.shake.ay * Math.cos(p.shake.fy * t) });
    }
    if (p.spin) out.push({ rotate: `${(p.spin[0] * Math.sin(p.spin[1] * t) * 180 / Math.PI).toFixed(2)}deg` });
    if (scale !== 1) out.push({ scale });
    return out.length ? out : null;
  }, [motion, position]);

  // Rows rather than switches, and each opens the sheet the editor already uses -
  // 155 grades, 10 adjustments, 129 effects, 66 camera moves. They were four toggles
  // that named a capability and did nothing with it.
  const enhanceRows = [
    { key: 'filter', icon: 'photo-filter', label: 'Filter', value: resolveFilter(filter).label, onPress: () => setSheet('filter') },
    { key: 'adjust', icon: 'tune', label: 'Adjust', value: adjust ? 'Custom' : 'Default', onPress: () => setSheet('adjust') },
    { key: 'effect', icon: 'auto-awesome', label: 'Effects', value: resolveEffect(effect).label, onPress: () => setSheet('effect') },
    { key: 'motion', icon: 'animation', label: 'Motion', value: resolveMotion(motion).label, onPress: () => setSheet('motion') },
  ];

  async function saveRaw() {
    if (!uri || saving) return;
    setSaving(true); setSavePct(0);
    try {
      const { method } = await saveVideoToDevice(uri, { prompt: 'Tonefy recording' }, setSavePct);
      if (method === 'gallery') showAlert('Saved', 'The recording is in your gallery.');
    } catch (e) {
      showAlert('Save failed', e?.message || 'Could not save the recording.');
    } finally { setSaving(false); }
  }

  const [applying, setApplying] = useState(false);
  const [applyPct, setApplyPct] = useState(0);
  const [applyMsg, setApplyMsg] = useState('');

  const anythingChosen = filter !== 'None' || !!adjust || effect !== 'none' || motion !== 'none' || speed !== 1;

  // Renders the choices onto the clip HERE, rather than handing it to another screen.
  // Same endpoint the editor exports through, and the same per-clip fields - so a grade
  // picked on this screen and the same grade picked in the editor produce the same file.
  async function applyEnhancements() {
    if (!uri || applying) return;
    setApplying(true); setApplyPct(0); setApplyMsg('Uploading…');
    try {
      const token = await getAuth().currentUser?.getIdToken();
      if (!token) throw new Error('Please sign in again.');

      const form = new FormData();
      form.append('files', { uri, name: 'recording.mp4', type: 'video/mp4' });
      const up = await (await fetch(`${BACKEND}/api/upload-media`, {
        method: 'POST', headers: { Authorization: 'Bearer ' + token }, body: form,
      })).json();
      const remote = up.items?.[0]?.url;
      if (!remote) throw new Error(up.error || 'The upload did not complete.');

      setApplyMsg('Applying…');
      const body = {
        mediaItems: [{
          url: remote, type: 'video', trimStart: 0,
          trimEnd: recordedSeconds || undefined, speed,
          filter,
          filterSpec: [...(filterSpec(filter) || []), ...adjustChain(adjust)].slice(0, 20),
          motionSpec: motionChain(motion) || undefined,
          effectSpec: effectChain(effect) || undefined,
          volume: 1, muted: false, transition: 'none',
        }],
        aspectRatio: '9:16', resolution: route?.params?.quality || '1080p', transition: 'none',
      };
      const start = await (await fetch(`${BACKEND}/api/media-to-video`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify(body),
      })).json();
      if (!start.jobId) throw new Error(start.error || 'Could not start the render.');

      let job = null;
      for (let i = 0; i < 180; i += 1) {
        await new Promise(r => setTimeout(r, 2000));
        job = await (await fetch(`${BACKEND}/api/job/${start.jobId}`, {
          headers: { Authorization: 'Bearer ' + token },
        })).json();
        if (typeof job.progress === 'number') setApplyPct(job.progress);
        if (job.message) setApplyMsg(job.message);
        if (job.status === 'done' || job.status === 'error') break;
      }
      if (job?.status !== 'done' || !job.videoUrl) throw new Error(job?.error || 'The render did not finish.');

      // The enhanced file becomes the clip on this screen: the preview, and what Save
      // Raw now saves. The choices are cleared because they are baked in - leaving them
      // set would apply them a second time on a second pass.
      setEnhancedUri(`${BACKEND}${job.videoUrl}`);
      setFilter('None'); setAdjust(null); setEffect('none'); setMotion('none'); setSpeed(1);
      showAlert('Done', 'Your recording has been enhanced.');
    } catch (e) {
      showAlert('Could not enhance', e?.message || 'Something went wrong.');
    } finally {
      setApplying(false); setApplyMsg('');
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.bg, paddingTop: insets.top }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.bg} />
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={20} color='#fff' />
        </TouchableOpacity>
        <Text style={[styles.logo, { color: '#fff' }]}>Tonefy AI</Text>
        <View style={{ width: 20 }} />
      </View>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Video Preview */}
        <View style={[styles.videoCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.videoPlaceholder}>
            <View style={styles.rawBadge}>
              <View style={styles.rawDot} />
              <Text style={styles.rawBadgeText}>RAW PREVIEW</Text>
            </View>
            {uri ? (
              // expo-video's own controls, rather than a play button and a timecode of
              // "0:12 / 0:45" that were painted on and wired to nothing.
              <VideoView player={player}
                style={[StyleSheet.absoluteFill,
                  motionTransform ? { transform: motionTransform } : null,
                  liveFilter ? { filter: liveFilter } : null]}
                nativeControls allowsFullscreen contentFit="contain" />
            ) : (
              <>
                <MaterialIcons name="videocam-off" size={40} color="#333" />
                <Text style={styles.noClipText}>No recording to show.</Text>
              </>
            )}
          </View>
          {/* The scrubber, play button, timecode and volume/settings icons that used to
              sit here were all painted on - none had a handler and the timecode was the
              literal string "0:12 / 0:45". The player above has real ones. */}
        </View>

        {/* Quick Edit Toggles */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: '#fff' }]}>QUICK EDITS</Text>
          <View style={[styles.toggleGrid, { backgroundColor: theme.card, borderColor: theme.border }]}>
            {enhanceRows.map(r => (
              <TouchableOpacity key={r.key} style={styles.enhanceRow} onPress={r.onPress}>
                <MaterialIcons name={r.icon} size={20} color='#fff' />
                <Text style={[styles.enhanceLabel, { color: '#fff' }]}>{r.label}</Text>
                <Text style={[styles.enhanceValue, { color: '#fff' }]} numberOfLines={1}>{r.value}</Text>
                <MaterialIcons name="chevron-right" size={20} color='#fff' />
              </TouchableOpacity>
            ))}
            {/* Face Retouch is real now and needs no model: smartblur with a negative
                threshold smooths only what has low local contrast, which is skin and
                not eyes or hair. It lives in the effects catalogue under Beauty, so
                this row opens the same sheet filtered to it. */}
            <TouchableOpacity style={styles.enhanceRow} onPress={() => setSheet('effect')}>
              <MaterialIcons name="face-retouching-natural" size={20} color='#fff' />
              <Text style={[styles.enhanceLabel, { color: '#fff' }]}>Face Retouch</Text>
              <Text style={[styles.enhanceValue, { color: '#fff' }]}>Beauty effects</Text>
              <MaterialIcons name="chevron-right" size={20} color='#fff' />
            </TouchableOpacity>
            {/* Eye contact is the one that genuinely cannot be done here. Redirecting a
                gaze means generating eyes that were never photographed - there is no
                ffmpeg filter for it at any setting, and no amount of tuning gets there.
                It needs a model, which is a cost rather than a technique. */}
            <TouchableOpacity style={styles.enhanceRow} onPress={() => soon('Eye Contact Fix')}>
              <MaterialIcons name="remove-red-eye" size={20} color="#5a5a5a" />
              <Text style={[styles.enhanceLabel, { color: '#5a5a5a' }]}>Eye Contact Fix</Text>
              <Text style={styles.soonTag}>SOON</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* AI Suggestions */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: '#fff' }]}>AI SUGGESTIONS</Text>
          <View style={[styles.aiCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.aiCardHeader}>
              <MaterialIcons name="auto-awesome" size={20} color='#fff' />
              <Text style={[styles.aiCardTitle, { color: '#fff' }]}>AI Suggestions</Text>
            </View>
            <Text style={[styles.aiCardSub, { color: '#fff' }]}>Based on your content, we recommend these high-impact edits:</Text>
            {[
              { icon: 'bolt', label: 'Turn into motivational video' },
              { icon: 'movie', label: 'Add cinematic B-roll' },
            ].map(s => (
              <TouchableOpacity key={s.label} onPress={() => soon(s.label)}
                style={[styles.suggestionBtn, { backgroundColor: theme.divider, borderColor: theme.border }]}>
                <View style={styles.suggestionLeft}>
                  <MaterialIcons name={s.icon} size={20} color="#5a5a5a" />
                  <Text style={[styles.suggestionText, { color: '#5a5a5a' }]}>{s.label}</Text>
                </View>
                <Text style={styles.soonTag}>SOON</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Refine */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: '#fff' }]}>REFINE WITH AI</Text>
          <View style={[styles.refineCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <TextInput
              style={[styles.refineInput, { color: '#fff', borderBottomColor: theme.border }]}
              placeholder="e.g. Make the colors warmer and add more film grain..."
              placeholderTextColor="rgba(255,255,255,0.45)"
              multiline
              value={refinement}
              onChangeText={setRefinement}
            />
            <TouchableOpacity style={styles.sendBtn} onPress={() => refineWithAI()} disabled={refining}>
              {refining
                ? <ActivityIndicator size="small" color="#04211f" />
                : <MaterialIcons name="send" size={20} color="#04211f" />}
            </TouchableOpacity>
            <View style={styles.promptChips}>
              {['Enhance Blue Tones', 'Reduce Noise', 'Add Slow-mo'].map(p => (
                <TouchableOpacity key={p} onPress={() => refineWithAI(p)} disabled={refining}
                  style={[styles.promptChip, { borderColor: theme.border }]}>
                  <Text style={[styles.promptChipText, { color: '#fff' }]}>{p}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.section}>
          {/* The primary action is the editor, where the tools this screen only named
              actually exist - filters, motion, effects, captions and Reduce noise. It
              was "Enhance with AI" and did nothing. */}
          <ProgressButton
            label={applying ? (applyMsg || 'Applying…') : 'Apply to recording'}
            hint={applying && applyPct ? `${applyPct}%` : ''}
            progress={applyPct}
            busy={applying}
            icon="auto-fix-high"
            disabled={!uri || !anythingChosen}
            onPress={applyEnhancements}
            style={styles.applyBtn}
          />
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: theme.card, borderColor: theme.border }]}
              onPress={() => navigation.replace('Recording')}>
              <MaterialIcons name="refresh" size={20} color='#fff' />
              <Text style={[styles.actionBtnText, { color: '#fff' }]}>Retake</Text>
            </TouchableOpacity>
            <ProgressButton
              variant="outline"
              label={saving ? `${savePct}%` : 'Save Raw'}
              progress={savePct}
              busy={saving}
              borderColor={theme.border}
              textColor="#fff"
              icon="download"
              style={styles.saveRawBtn}
              labelStyle={styles.saveRawLabel}
              onPress={saveRaw}
            />
          </View>
        </View>

        {/* Stats */}
        <View style={[styles.section, { marginBottom: 40 }]}>
          {/* Both of these were hardcoded strings: "4K (2160p)" and "60 FPS", stated as
              facts about a recording neither had looked at. The export has no 4K path at
              all, so it was not merely unverified - it was not achievable. Replaced with
              two things actually known here: what the render will output, and how long
              the clip is. */}
          <View style={[styles.statsCard, { backgroundColor: theme.card, borderLeftColor: theme.border }]}>
            <View>
              <Text style={[styles.statsLabel, { color: '#fff' }]}>EXPORTS AT</Text>
              <Text style={[styles.statsValue, { color: '#fff' }]}>
                {route?.params?.quality || '1080p'}
              </Text>
            </View>
            <View>
              <Text style={[styles.statsLabel, { color: '#fff' }]}>LENGTH</Text>
              <Text style={[styles.statsValue, { color: '#fff' }]}>
                {recordedSeconds > 0
                  ? `${Math.floor(recordedSeconds / 60)}:${String(recordedSeconds % 60).padStart(2, '0')}`
                  : '--:--'}
              </Text>
            </View>
          </View>
        </View>
      <EnhanceSheets
        sheet={sheet}
        close={() => setSheet(null)}
        backend={BACKEND}
        isPremium={isPremium}
        state={{ filter, adjust, effect, motion }}
        set={{ filter: setFilter, adjust: setAdjust, effect: setEffect, motion: setMotion }}
      />
      </ScrollView>
    </View>
  );
}

// Mounted once, outside the ScrollView, exactly as the editor mounts the same four.
function EnhanceSheets({ sheet, close, backend, isPremium, state, set }) {
  return (
    <>
      <FilterSheet visible={sheet === 'filter'} value={state.filter} backend={backend}
        isPremium={isPremium} onSelect={(id) => { set.filter(id); close(); }}
        onLocked={(f) => showAlert(f.label, 'Available on the Pro and Creator plans.')}
        onClose={close} />
      <AdjustSheet visible={sheet === 'adjust'} value={state.adjust}
        onChange={set.adjust} onClose={close} />
      <EffectPicker visible={sheet === 'effect'} value={state.effect} backend={backend}
        isPremium={isPremium} onSelect={(id) => { set.effect(id); close(); }}
        onLocked={(e) => showAlert(e.label, 'Available on the Pro and Creator plans.')}
        onClose={close} />
      <MotionPicker visible={sheet === 'motion'} value={state.motion} backend={backend}
        isPremium={isPremium} onSelect={(id) => { set.motion(id); close(); }}
        onLocked={(m) => showAlert(m.label, 'Available on the Pro and Creator plans.')}
        onClose={close} />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1a1a1a' },
  logo: { fontSize: 18, fontWeight: '800', color: '#fff' },
  videoCard: { margin: 16, backgroundColor: '#111', borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: '#2a2a2a' },
  videoPlaceholder: { height: 200, backgroundColor: '#0a0a0a', alignItems: 'center', justifyContent: 'center', position: 'relative' },
  rawBadge: { position: 'absolute', top: 12, left: 12, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  rawDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#00d4d4' },
  rawBadgeText: { color: '#fff', fontSize: 10, fontWeight: '600' },
  fullscreenBtn: { position: 'absolute', top: 10, right: 10, width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  timeline: { paddingHorizontal: 14, paddingTop: 10 },
  timelineTrack: { height: 3, backgroundColor: '#2a2a2a', borderRadius: 4, overflow: 'hidden' },
  timelineFill: { width: '33%', height: '100%', backgroundColor: '#00d4d4', borderRadius: 4 },
  playRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12 },
  playLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  playRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  timeCode: { color: '#fff', fontSize: 11 },
  section: { paddingHorizontal: 16, marginBottom: 16 },
  sectionLabel: { fontSize: 10, fontWeight: '700', color: '#fff', letterSpacing: 2, marginBottom: 10 },
  // A column, not a wrapping 2x2. It was `flexDirection: row, flexWrap: wrap` with 46%
  // wide children - correct for the four Switches that used to live here, and wrong the
  // moment they became full-width rows: two rows landed per line at auto width and the
  // labels, being flex:1 inside a shrunk cell, collapsed to nothing.
  toggleGrid: { backgroundColor: '#111', borderRadius: 14, borderWidth: 1, borderColor: '#2a2a2a', overflow: 'hidden' },
  toggleItem: { width: '46%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  soonTag: { color: '#5a5a5a', fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
  applyBtn: { borderRadius: 12, minHeight: 50, marginBottom: 10 },
  enhanceRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: '#1e1e1e' },
  enhanceLabel: { fontSize: 14, flex: 1 },
  enhanceValue: { fontSize: 12, maxWidth: 130, textAlign: 'right' },
  noClipText: { color: '#5a5a5a', fontSize: 12, marginTop: 6 },
  saveRawBtn: { flex: 1, minHeight: 46, borderRadius: 10 },
  saveRawLabel: { fontSize: 13 },
  toggleItemLabel: { color: '#fff', fontSize: 12, flex: 1 },
  aiCard: { backgroundColor: '#111', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#2a2a2a', gap: 10 },
  aiCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  aiCardTitle: { fontSize: 16, fontWeight: '700', color: '#fff' },
  aiCardSub: { fontSize: 12, color: '#fff' },
  suggestionBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1a1a1a', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#2a2a2a' },
  suggestionLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  suggestionText: { color: '#fff', fontSize: 13, fontWeight: '500' },
  refineCard: { backgroundColor: '#111', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#2a2a2a', gap: 10 },
  refineInput: { color: '#fff', fontSize: 13, minHeight: 70, textAlignVertical: 'top', borderBottomWidth: 1, borderBottomColor: '#2a2a2a', paddingBottom: 8 },
  sendBtn: { alignSelf: 'flex-end', backgroundColor: '#2ECC71', borderRadius: 8, padding: 8 },
  promptChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  promptChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: '#2a2a2a' },
  promptChipText: { color: '#fff', fontSize: 11 },
  enhanceBtn: { backgroundColor: '#2ECC71', borderRadius: 12, height: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 10, shadowColor: '#2ECC71', shadowOpacity: 0.3, shadowRadius: 12 },
  enhanceBtnText: { color: '#04211f', fontWeight: '700', fontSize: 14 },
  actionRow: { flexDirection: 'row', gap: 10 },
  actionBtn: { flex: 1, height: 46, backgroundColor: '#111', borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: '#2a2a2a' },
  actionBtnText: { color: '#fff', fontSize: 13, fontWeight: '500' },
  statsCard: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#111', borderRadius: 12, padding: 14, borderLeftWidth: 3, borderLeftColor: '#2a2a2a' },
  statsLabel: { fontSize: 10, color: '#fff', letterSpacing: 1, marginBottom: 4 },
  statsValue: { fontSize: 14, fontWeight: '700', color: '#fff' },
});
