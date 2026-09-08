import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, Switch, ActivityIndicator,
  ScrollView, Linking, Image,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { auth } from '../firebase';
import { useSheetInset } from './SheetHeader';

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
 * Until the app is audited the backend falls back to an inbox draft (the options are then
 * moot), but the sheet must exist and be correct for the audit to pass.
 */
export default function TikTokPostSheet({ visible, onClose, onConfirm, theme, posting }) {
  const sheetInset = useSheetInset();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);

  const [privacy, setPrivacy] = useState(null);          // no default, on purpose
  const [allowComment, setAllowComment] = useState(true);
  const [allowDuet, setAllowDuet] = useState(true);
  const [allowStitch, setAllowStitch] = useState(true);
  const [disclose, setDisclose] = useState(false);
  const [yourBrand, setYourBrand] = useState(false);      // brand_organic_toggle
  const [brandedContent, setBrandedContent] = useState(false); // brand_content_toggle

  useEffect(() => {
    if (!visible) return;
    // reset each open so a previous session's choices never carry over
    setLoading(true); setError(null); setInfo(null);
    setPrivacy(null); setAllowComment(true); setAllowDuet(true); setAllowStitch(true);
    setDisclose(false); setYourBrand(false); setBrandedContent(false);
    (async () => {
      try {
        const token = await auth.currentUser?.getIdToken();
        const r = await fetch(`${BACKEND}/tiktok/creator-info`, { headers: { Authorization: 'Bearer ' + token } });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || 'Could not load your TikTok settings.');
        setInfo(d);
      } catch (e) {
        setError(e.message || 'Could not load your TikTok settings.');
      } finally {
        setLoading(false);
      }
    })();
  }, [visible]);

  // Branded content cannot be private: drop SELF_ONLY from the choices, and clear it if
  // it was the current selection.
  const options = (info?.privacyOptions || []).filter((p) => !(brandedContent && p === 'SELF_ONLY'));
  useEffect(() => {
    if (brandedContent && privacy === 'SELF_ONLY') setPrivacy(null);
  }, [brandedContent, privacy]);

  const discloseValid = !disclose || yourBrand || brandedContent;
  const canPost = !!privacy && discloseValid && !posting;

  function confirm() {
    if (!canPost) return;
    onConfirm({
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
              {/* Creator */}
              <View style={styles.creator}>
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
