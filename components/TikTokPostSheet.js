import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, Switch, ActivityIndicator,
  ScrollView, Linking, Image,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { auth } from '../firebase';
import { useSheetInset } from './SheetHeader';
import { useVideoPlayer, VideoView } from 'expo-video';

const BACKEND = 'https://api.fitlifesolutions.site';

// TikTok's music/branded-content policies the declaration links to.
const MUSIC_URL = 'https://www.tiktok.com/legal/page/global/music-usage-confirmation/en';
const BRANDED_URL = 'https://www.tiktok.com/legal/page/global/bc-policy/en';

const PRIVACY_LABELS = {
  PUBLIC_TO_EVERYONE: 'Everyone',
  MUTUAL_FOLLOW_FRIENDS: 'Friends',
  FOLLOWER_OF_CREATOR: 'Followers',
  SELF_ONLY: 'Only me',
};

/**
 * The compliant TikTok posting sheet.
 *
 * This is not decoration - it is the exact thing TikTok's Content Posting API audit
 * reviews before granting Direct Post (video.publish). Their UX guidelines require, before
 * a direct post, that the app:
 *   - fetches the creator's ALLOWED privacy levels (creator_info) and shows only those,
 *   - makes the user actively CHOOSE a privacy level (no default - Post stays disabled
 *     until one is picked),
 *   - lets the user allow/disallow Comment, Duet, Stitch (respecting what the creator has
 *     turned off account-wide),
 *   - offers a commercial-content disclosure ("Your brand" / "Branded content"), forbids
 *     private branded content, and shows the Music Usage / Branded Content declarations.
 *
 * Collects those choices and hands them back via onConfirm(options); the caller posts.
 *
 * The Direct Post audit PASSED Sep 24 2026, so these options are live rather than moot -
 * every one of them now reaches the real post. The inbox-draft fallback in
 * publishToTikTok stays as the safety net for an account or app state TikTok refuses
 * direct posting for; it is no longer the ordinary path.
 */
export default function TikTokPostSheet({ visible, onClose, onConfirm, theme, posting, videoUrl }) {
  const sheetInset = useSheetInset();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);

  const [privacy, setPrivacy] = useState(null);          // no default, on purpose
  // Also no default, and for the same reason. TikTok's guidelines: "Users must manually
  // turn on these interaction settings and none should be checked by default." They used
  // to start on, which is the app deciding on the creator's behalf.
  const [allowComment, setAllowComment] = useState(false);
  const [allowDuet, setAllowDuet] = useState(false);
  const [allowStitch, setAllowStitch] = useState(false);
  const [disclose, setDisclose] = useState(false);
  const [yourBrand, setYourBrand] = useState(false);      // brand_organic_toggle
  const [brandedContent, setBrandedContent] = useState(false); // brand_content_toggle

  // Which account this post is for. Settings are per account - the privacy levels on offer
  // and whether comments are even allowed differ between them - so switching accounts
  // re-asks TikTok rather than reusing the previous account's answer. Showing one
  // account's rules while posting to another is exactly what TikTok's guidelines forbid.
  const [accountId, setAccountId] = useState(null);

  // Muted, not looping, never played: this is a still of the first frame in practice, and
  // sound starting under a posting sheet would be a surprise.
  const preview = useVideoPlayer(videoUrl || null, (pl) => { pl.muted = true; pl.loop = false; });

  // The duration comes from the preview player rather than from a prop: it is the same
  // file, the player has to load it anyway, and a number measured here cannot disagree
  // with the video actually on screen.
  const [durationSec, setDurationSec] = useState(null);
  useEffect(() => {
    if (!preview) return;
    const sub = preview.addListener('statusChange', ({ status }) => {
      if (status === 'readyToPlay' && preview.duration) setDurationSec(preview.duration);
    });
    return () => sub.remove();
  }, [preview]);

  useEffect(() => {
    if (!visible) return;
    setAccountId(null);          // start from the server's default each time it opens
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    // reset each open so a previous session's choices never carry over
    setLoading(true); setError(null); setInfo(null);
    setPrivacy(null); setAllowComment(false); setAllowDuet(false); setAllowStitch(false);
    setDisclose(false); setYourBrand(false); setBrandedContent(false);
    (async () => {
      try {
        const token = await auth.currentUser?.getIdToken();
        const q = accountId ? `?accountId=${encodeURIComponent(accountId)}` : '';
        const r = await fetch(`${BACKEND}/tiktok/creator-info${q}`, { headers: { Authorization: 'Bearer ' + token } });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || 'Could not load your TikTok settings.');
        setInfo(d);
      } catch (e) {
        setError(e.message || 'Could not load your TikTok settings.');
      } finally {
        setLoading(false);
      }
    })();
  }, [visible, accountId]);

  // Branded content cannot be private: drop SELF_ONLY from the choices, and clear it if
  // it was the current selection.
  const options = (info?.privacyOptions || []).filter((p) => !(brandedContent && p === 'SELF_ONLY'));
  useEffect(() => {
    if (brandedContent && privacy === 'SELF_ONLY') setPrivacy(null);
  }, [brandedContent, privacy]);

  // TikTok signals "this creator cannot post any more right now" by returning NO privacy
  // options. Their guidelines require the attempt to stop and the user to be told to try
  // later, rather than being allowed to start an upload that will be refused.
  const cannotPostNow = !loading && !error && (info?.privacyOptions?.length || 0) === 0;

  // And the video must fit the creator's own maximum, which creator_info reports.
  const maxSec = info?.maxDurationSec || null;
  const tooLong = !!(maxSec && durationSec && durationSec > maxSec);

  const discloseValid = !disclose || yourBrand || brandedContent;
  const canPost = !!privacy && discloseValid && !posting && !cannotPostNow && !tooLong;

  function confirm() {
    if (!canPost) return;
    onConfirm({
      // The account these settings were read FROM, so the caller posts to that one and
      // not to every connected account under one account's rules.
      accountId: info?.accountId || null,
      // For "all", name them explicitly rather than relying on an empty selection meaning
      // everything - the settings above were computed for exactly this list.
      accountIds: info?.accountId === 'all' ? (info.accounts || []).map(a => a.accountId) : null,
      privacyLevel: privacy,
      disableComment: !allowComment,
      disableDuet: !allowDuet,
      disableStitch: !allowStitch,
      brandOrganicToggle: disclose && yourBrand,
      brandContentToggle: disclose && brandedContent,
    });
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, sheetInset]}>
          <View style={styles.grabber} />
          <View style={styles.headerRow}>
            <Text style={styles.title}>Post to TikTok</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <MaterialIcons name="close" size={22} color="#888" />
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator color="#2ECC71" style={{ marginVertical: 40 }} />
          ) : error ? (
            <Text style={styles.error}>{error}</Text>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* A preview of exactly what is about to be posted. Required: "API Clients
                  should display a preview of the to-be-posted content." Muted and not
                  autoplaying - it is here to confirm WHICH video, not to be watched. */}
              {videoUrl ? (
                <View style={styles.previewBox}>
                  <VideoView player={preview} style={styles.preview} contentFit="contain"
                    nativeControls={false} />
                </View>
              ) : null}

              {cannotPostNow ? (
                <Text style={styles.blocked}>
                  TikTok says this account cannot post again just yet. Please try later.
                </Text>
              ) : null}
              {tooLong ? (
                <Text style={styles.blocked}>
                  This video is {Math.round(durationSec)}s. TikTok allows up to {maxSec}s on
                  this account.
                </Text>
              ) : null}

              {/* Which account. Only when there IS a choice - one account needs no picker,
                  and the creator row below already names it. */}
              {(info?.accounts?.length || 0) > 1 ? (
                <>
                  <Text style={[styles.label, { marginTop: 4 }]}>Post to which account</Text>
                  {[{ accountId: 'all', name: `All ${info.accounts.length} accounts` }, ...info.accounts].map((a) => (
                    <TouchableOpacity key={a.accountId} style={styles.optRow}
                      onPress={() => { if (a.accountId !== info.accountId) setAccountId(a.accountId); }}>
                      <MaterialIcons
                        name={info.accountId === a.accountId ? 'radio-button-checked' : 'radio-button-unchecked'}
                        size={22} color={info.accountId === a.accountId ? '#2ECC71' : '#888'}
                      />
                      <Text style={styles.optText}>{a.name || 'TikTok account'}</Text>
                    </TouchableOpacity>
                  ))}
                  {info.accountId === 'all' ? (
                    <Text style={styles.allNote}>
                      Only the settings every account allows are offered below.
                    </Text>
                  ) : null}
                </>
              ) : null}

              {/* Creator. Hidden when the picker is showing, which already names the
                  choice - two rows saying the same thing read as a rendering fault. */}
              <View style={[styles.creator, (info?.accounts?.length || 0) > 1 && { display: 'none' }]}>
                {info?.avatar ? <Image source={{ uri: info.avatar }} style={styles.avatar} /> : null}
                <Text style={styles.creatorName}>{info?.nickname || 'Your TikTok'}</Text>
              </View>

              {/* Privacy — required, no default */}
              <Text style={styles.label}>Who can view this video</Text>
              {options.map((p) => (
                <TouchableOpacity key={p} style={styles.optRow} onPress={() => setPrivacy(p)}>
                  <MaterialIcons
                    name={privacy === p ? 'radio-button-checked' : 'radio-button-unchecked'}
                    size={22} color={privacy === p ? '#2ECC71' : '#888'}
                  />
                  <Text style={styles.optText}>{PRIVACY_LABELS[p] || p}</Text>
                </TouchableOpacity>
              ))}

              {/* Interactions */}
              <Text style={styles.label}>Allow users to</Text>
              <Row label="Comment" value={allowComment} onChange={setAllowComment} disabled={info?.commentDisabled} />
              <Row label="Duet" value={allowDuet} onChange={setAllowDuet} disabled={info?.duetDisabled} />
              <Row label="Stitch" value={allowStitch} onChange={setAllowStitch} disabled={info?.stitchDisabled} />

              {/* Commercial disclosure */}
              <Text style={styles.label}>Disclose video content</Text>
              <Row label="This video promotes a brand, product or service" value={disclose} onChange={setDisclose} />
              {disclose && (
                <View style={styles.discloseBox}>
                  <TouchableOpacity style={styles.optRow} onPress={() => setYourBrand((v) => !v)}>
                    <MaterialIcons name={yourBrand ? 'check-box' : 'check-box-outline-blank'} size={22} color={yourBrand ? '#2ECC71' : '#888'} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.optText}>Your brand</Text>
                      <Text style={styles.optSub}>You are promoting yourself or your own business.</Text>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.optRow} onPress={() => setBrandedContent((v) => !v)}>
                    <MaterialIcons name={brandedContent ? 'check-box' : 'check-box-outline-blank'} size={22} color={brandedContent ? '#2ECC71' : '#888'} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.optText}>Branded content</Text>
                      <Text style={styles.optSub}>You are promoting another brand in a paid partnership.</Text>
                    </View>
                  </TouchableOpacity>
                  {!discloseValid && <Text style={styles.warn}>Choose at least one.</Text>}
                  {brandedContent && <Text style={styles.optSub}>Branded content can&apos;t be private.</Text>}
                </View>
              )}

              {/* Required declaration */}
              <Text style={styles.declaration}>
                By posting, you agree to TikTok&apos;s{' '}
                {brandedContent && (
                  <>
                    <Text style={styles.link} onPress={() => Linking.openURL(BRANDED_URL)}>Branded Content Policy</Text>
                    {' and '}
                  </>
                )}
                <Text style={styles.link} onPress={() => Linking.openURL(MUSIC_URL)}>Music Usage Confirmation</Text>.
              </Text>

              <TouchableOpacity
                style={[styles.postBtn, !canPost && styles.postBtnOff]}
                onPress={confirm}
                disabled={!canPost}
              >
                {posting ? <ActivityIndicator color="#000" /> : <Text style={styles.postBtnText}>Post to TikTok</Text>}
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

function Row({ label, value, onChange, disabled }) {
  return (
    <View style={styles.switchRow}>
      <Text style={[styles.optText, disabled && { color: '#555' }]}>{label}</Text>
      <Switch
        value={disabled ? false : value}
        onValueChange={onChange}
        disabled={!!disabled}
        trackColor={{ false: '#333', true: '#2ECC7180' }}
        thumbColor={!disabled && value ? '#2ECC71' : '#888'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#111', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '88%' },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#333', marginBottom: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  title: { color: '#fff', fontSize: 18, fontWeight: '700' },
  error: { color: '#ff6b6b', fontSize: 14, textAlign: 'center', paddingVertical: 30, lineHeight: 20 },
  creator: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#222' },
  creatorName: { color: '#fff', fontSize: 15, fontWeight: '600' },
  label: { color: '#888', fontSize: 11, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', marginTop: 18, marginBottom: 6 },
  allNote: { color: '#888', fontSize: 12, marginTop: 2, marginBottom: 2, lineHeight: 17 },
  previewBox: { height: 150, borderRadius: 12, overflow: 'hidden', backgroundColor: '#000', marginBottom: 6 },
  preview: { width: '100%', height: '100%' },
  blocked: { color: '#f87171', fontSize: 13, lineHeight: 19, marginTop: 10 },
  optRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9 },
  optText: { color: '#eee', fontSize: 15 },
  optSub: { color: '#777', fontSize: 12, marginTop: 1, lineHeight: 16 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 7 },
  discloseBox: { backgroundColor: '#181818', borderRadius: 12, padding: 10, marginTop: 4 },
  warn: { color: '#f5c451', fontSize: 12.5, marginTop: 4, marginLeft: 4 },
  declaration: { color: '#999', fontSize: 12.5, lineHeight: 18, marginTop: 18 },
  link: { color: '#2ECC71', textDecorationLine: 'underline' },
  postBtn: { backgroundColor: '#2ECC71', borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 20 },
  postBtnOff: { backgroundColor: '#2a2a2a' },
  postBtnText: { color: '#000', fontSize: 15, fontWeight: '700' },
});
