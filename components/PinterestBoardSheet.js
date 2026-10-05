// Choose where (and how) a Pin goes - Oct 3-4 2026.
//
// Before this the server took whatever board Pinterest listed first, so every Pin landed on
// the same board. Now, per connected Pinterest ACCOUNT (a board belongs to one account's
// token), the user picks a board - and can make one here, because a new Pinterest user
// often has none and "create one on Pinterest, then come back" was a dead end.
//
// Two modes:
//   'post'   - the Pinterest row's Post button. Board + optional link + cover frame, then
//              "Post to Pinterest".
//   'choose' - the row's "Change" link. Board only, "Use this board". What Post Now and
//              Save to queue then use, so the destination is always one the user saw.
//
// The board list is cached on the phone and shown at once, then refreshed - on slow mobile
// data a picker that starts empty every time feels broken.

import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal, View, Text, TouchableOpacity, ScrollView, ActivityIndicator, StyleSheet, TextInput, Image,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from '../firebase';
import { SheetHeader, useSheetInset } from './SheetHeader';
import { PinterestLogo } from './BrandLogos';
import { friendlyError } from '../utils/friendlyError';

const BACKEND = 'https://api.fitlifesolutions.site';
const CACHE_KEY = 'tonefy.pinterestBoardsCache';
const SEARCH_FROM = 11;   // a search box only once a list is long enough to need one

async function authed(path, init = {}) {
  const token = await auth.currentUser?.getIdToken();
  return fetch(`${BACKEND}${path}`, { ...init, headers: { ...(init.headers || {}), Authorization: `Bearer ${token}` } });
}

/** Loads (cached first, then fresh) every connected account's boards. Exported so the
 *  screen can show a default board on the row without opening the sheet. */
export async function loadPinterestBoards({ fresh = true, onCached } = {}) {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (raw && onCached) onCached(JSON.parse(raw));
  } catch { /* no cache is fine */ }
  if (!fresh) return null;
  const r = await authed('/api/pinterest/boards');
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || 'Could not load your boards.');
  AsyncStorage.setItem(CACHE_KEY, JSON.stringify(j.accounts || [])).catch(() => {});
  return j.accounts || [];
}

export default function PinterestBoardSheet({
  visible, onClose, onConfirm, remembered = {}, posting = false, mode = 'post', videoUrl = null,
}) {
  const sheetInset = useSheetInset();
  const [accounts, setAccounts] = useState(null);
  const [error, setError] = useState(null);
  const [chosen, setChosen] = useState({});      // accountId -> { id, name }
  const [query, setQuery] = useState('');
  const [newName, setNewName] = useState({});    // accountId -> text being typed
  const [creating, setCreating] = useState(null); // accountId currently creating
  const [link, setLink] = useState('');
  const [frames, setFrames] = useState(null);    // [{ seconds, url }]
  const [cover, setCover] = useState(null);

  // Start each account on its remembered board if it still exists, else its first board.
  const pick = (list) => {
    const start = {};
    for (const a of list) {
      const keep = a.boards.find(b => b.id === remembered[a.accountId]?.id);
      const first = keep || a.boards[0];
      if (first) start[a.accountId] = { id: first.id, name: first.name };
    }
    return start;
  };

  useEffect(() => {
    if (!visible) return;
    let live = true;
    setError(null); setQuery(''); setNewName({});
    loadPinterestBoards({
      onCached: (cached) => { if (live && cached?.length) { setAccounts(cached); setChosen(pick(cached)); } },
    }).then((fresh) => {
      if (!live) return;
      setAccounts(fresh);
      setChosen(prev => {
        // Keep a tap the user already made on the cached list, if that board still exists.
        const next = pick(fresh);
        for (const a of fresh) {
          if (prev[a.accountId] && a.boards.some(b => b.id === prev[a.accountId].id)) next[a.accountId] = prev[a.accountId];
        }
        return next;
      });
    }).catch((e) => { if (live) setError(friendlyError(e, 'Could not load your boards. Check your connection and try again.')); });
    return () => { live = false; };
    // remembered is read once per opening on purpose; a change mid-sheet would undo a tap.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Cover options, only when posting: five frames made on the server.
  useEffect(() => {
    if (!visible || mode !== 'post' || !videoUrl) return;
    let live = true;
    setFrames(null); setCover(null);
    authed(`/api/pinterest/cover-frames?videoUrl=${encodeURIComponent(videoUrl)}`)
      .then(r => r.json())
      .then(j => { if (live && j.frames?.length) { setFrames(j.frames); setCover(j.frames[0].seconds); } })
      .catch(() => { /* no cover choice: the server uses the first frame */ });
    return () => { live = false; };
  }, [visible, mode, videoUrl]);

  async function createBoard(accountId) {
    const name = (newName[accountId] || '').trim();
    if (!name || creating) return;
    setCreating(accountId); setError(null);
    try {
      const r = await authed('/api/pinterest/boards', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accountId, name }),
      });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error || 'Could not create the board.');
      setAccounts(list => list.map(a => (a.accountId === accountId ? { ...a, boards: [b, ...a.boards] } : a)));
      setChosen(c => ({ ...c, [accountId]: { id: b.id, name: b.name } }));
      setNewName(n => ({ ...n, [accountId]: '' }));
    } catch (e) {
      setError(friendlyError(e, 'Could not create the board.'));
    } finally {
      setCreating(null);
    }
  }

  const many = (accounts?.length || 0) > 1;
  const showSearch = !!accounts && accounts.some(a => a.boards.length >= SEARCH_FROM);
  const q = query.trim().toLowerCase();
  const visibleBoards = useMemo(() => (accounts || []).map(a => ({
    ...a, boards: q ? a.boards.filter(b => b.name.toLowerCase().includes(q)) : a.boards,
  })), [accounts, q]);
  const linkOk = !link.trim() || /^https?:\/\/\S+\.\S+/i.test(link.trim());
  const canGo = !!accounts && Object.keys(chosen).length > 0 && !posting && linkOk;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, sheetInset]}>
          <SheetHeader title={mode === 'post' ? 'Post to Pinterest' : 'Choose a board'} onClose={onClose} />
          <View style={styles.brand}>
            <PinterestLogo size={20} />
            <Text style={styles.brandName}>Pinterest</Text>
          </View>

          {!accounts && !error ? (
            <ActivityIndicator color="#2ECC71" style={{ marginVertical: 40 }} />
          ) : (
            <ScrollView style={styles.list} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {error ? <Text style={styles.error}>{error}</Text> : null}

              {showSearch && (
                <View style={styles.search}>
                  <MaterialIcons name="search" size={20} color="#888" />
                  <TextInput
                    style={styles.searchInput} value={query} onChangeText={setQuery}
                    placeholder="Search your boards" placeholderTextColor="#666" autoCorrect={false}
                  />
                </View>
              )}

              <Text style={styles.section}>Board</Text>
              {visibleBoards.map(a => (
                <View key={a.accountId}>
                  {many && <Text style={styles.account}>{a.name || a.accountId}</Text>}
                  {a.boards.length === 0 && !q ? (
                    <Text style={styles.hint}>No boards yet - create your first one below.</Text>
                  ) : null}
                  {a.boards.map(b => {
                    const on = chosen[a.accountId]?.id === b.id;
                    return (
                      <TouchableOpacity
                        key={b.id} style={styles.row}
                        onPress={() => setChosen(c => ({ ...c, [a.accountId]: { id: b.id, name: b.name } }))}
                      >
                        <MaterialIcons name={on ? 'radio-button-checked' : 'radio-button-unchecked'} size={20} color={on ? '#2ECC71' : '#555'} />
                        <Text style={[styles.boardName, on && styles.boardOn]} numberOfLines={1}>{b.name}</Text>
                        {b.privacy && b.privacy !== 'PUBLIC' ? (
                          <View style={styles.secret}>
                            <MaterialIcons name="visibility-off" size={12} color="#888" />
                            <Text style={styles.secretText}>Secret</Text>
                          </View>
                        ) : null}
                      </TouchableOpacity>
                    );
                  })}
                  {/* Create a board without leaving the app. Public: secret boards need a
                      Pinterest permission the app does not ask for. */}
                  <View style={styles.createRow}>
                    <MaterialIcons name="add" size={20} color="#888" />
                    <TextInput
                      style={styles.createInput} value={newName[a.accountId] || ''} maxLength={50}
                      onChangeText={t => setNewName(n => ({ ...n, [a.accountId]: t }))}
                      placeholder="New board name" placeholderTextColor="#666"
                      onSubmitEditing={() => createBoard(a.accountId)} returnKeyType="done"
                    />
                    {(newName[a.accountId] || '').trim() ? (
                      <TouchableOpacity style={styles.createBtn} onPress={() => createBoard(a.accountId)} disabled={!!creating}>
                        {creating === a.accountId ? <ActivityIndicator color="#000" size="small" /> : <Text style={styles.createBtnText}>Create</Text>}
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
              ))}

              {mode === 'post' && (
                <>
                  <Text style={styles.section}>Link (optional)</Text>
                  <Text style={styles.hint}>Where people go when they tap your Pin - your website, shop or app.</Text>
                  <TextInput
                    style={[styles.linkInput, !linkOk && styles.linkBad]} value={link} onChangeText={setLink}
                    placeholder="https://..." placeholderTextColor="#666" autoCapitalize="none"
                    autoCorrect={false} keyboardType="url"
                  />
                  {!linkOk ? <Text style={styles.bad}>Start the link with https://</Text> : null}

                  {frames ? (
                    <>
                      <Text style={styles.section}>Cover</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.frames} contentContainerStyle={styles.framesContent}>
                        {frames.map(f => (
                          <TouchableOpacity key={f.seconds} onPress={() => setCover(f.seconds)} style={[styles.frame, cover === f.seconds && styles.frameOn]}>
                            <Image source={{ uri: f.url }} style={styles.frameImg} />
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </>
                  ) : null}
                </>
              )}
            </ScrollView>
          )}

          <TouchableOpacity
            style={[styles.postBtn, !canGo && styles.postBtnOff]} disabled={!canGo}
            onPress={() => onConfirm({ boards: chosen, link: link.trim() || undefined, coverSeconds: cover ?? undefined })}
          >
            {posting ? <ActivityIndicator color="#000" />
              : <Text style={styles.postBtnText}>{mode === 'post' ? 'Post to Pinterest' : 'Use this board'}</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#111', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, maxHeight: '90%' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  brandName: { color: '#E60023', fontSize: 15, fontWeight: '700' },
  list: { flexGrow: 0, flexShrink: 1 },
  section: { color: '#888', fontSize: 12, fontWeight: '700', letterSpacing: 1, marginTop: 16, marginBottom: 4, textTransform: 'uppercase' },
  account: { color: '#bbb', fontSize: 13, fontWeight: '700', marginTop: 8 },
  hint: { color: '#888', fontSize: 13, lineHeight: 18, marginBottom: 6 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#1a1a1a', borderRadius: 12, paddingHorizontal: 12, marginTop: 8, borderWidth: 1, borderColor: '#2a2a2a' },
  searchInput: { flex: 1, color: '#fff', fontSize: 15, paddingVertical: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#2a2a2a' },
  boardName: { color: '#eee', fontSize: 15, flex: 1 },
  boardOn: { color: '#fff', fontWeight: '700' },
  secret: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  secretText: { color: '#888', fontSize: 12 },
  createRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  createInput: { flex: 1, color: '#fff', fontSize: 15, paddingVertical: 8 },
  createBtn: { backgroundColor: '#2ECC71', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 7, minWidth: 70, alignItems: 'center' },
  createBtnText: { color: '#000', fontSize: 13, fontWeight: '700' },
  linkInput: { backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 12, color: '#fff', fontSize: 14, padding: 12 },
  linkBad: { borderColor: '#ff6b6b' },
  bad: { color: '#ff6b6b', fontSize: 12, marginTop: 4 },
  frames: { flexGrow: 0, flexShrink: 0 },
  framesContent: { alignItems: 'center', gap: 8, paddingVertical: 4 },
  frame: { borderRadius: 10, borderWidth: 2, borderColor: 'transparent', overflow: 'hidden' },
  frameOn: { borderColor: '#2ECC71' },
  frameImg: { width: 60, height: 106, backgroundColor: '#1a1a1a' },
  error: { color: '#ff6b6b', fontSize: 14, lineHeight: 20, marginVertical: 12 },
  postBtn: { backgroundColor: '#2ECC71', borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 16 },
  postBtnOff: { backgroundColor: '#2a2a2a' },
  postBtnText: { color: '#000', fontSize: 15, fontWeight: '700' },
});
