"""Measure every track, so the library can be browsed by what a track IS rather than by
what its filename happens to start with.

BPM by onset autocorrelation - decode to mono 22.05k, take a spectral-flux onset
envelope, autocorrelate it and pick the strongest lag in a musical range. No librosa or
aubio on this box, so it is numpy and scipy over ffmpeg's PCM, which is enough for a
tempo band (slow / medium / driving) even where it is a beat or two out on the exact
number.

Energy is integrated loudness against short-term peaks - a track that sits near its own
ceiling reads as busy, one with headroom reads as sparse.
"""
import json, subprocess, sys, os, re
import numpy as np

SR = 22050
D = '/home/ahumuza/Tonefy-react/backend/public/music/'

def pcm(path):
    raw = subprocess.run(['ffmpeg','-v','error','-i',path,'-ac','1','-ar',str(SR),
                          '-f','f32le','-'], capture_output=True).stdout
    return np.frombuffer(raw, np.float32)

def bpm_and_energy(x):
    if x.size < SR * 5: return None, 0.0
    hop, win = 512, 1024
    n = (x.size - win) // hop
    frames = np.lib.stride_tricks.as_strided(
        x, shape=(n, win), strides=(x.strides[0]*hop, x.strides[0]))
    spec = np.abs(np.fft.rfft(frames * np.hanning(win), axis=1))
    flux = np.maximum(0, np.diff(spec, axis=0)).sum(axis=1)
    flux -= flux.mean()
    if flux.std() > 0: flux /= flux.std()
    ac = np.correlate(flux, flux, 'full')[len(flux)-1:]
    fps = SR / hop
    lo, hi = int(fps * 60/180), int(fps * 60/60)      # 60-180 BPM
    seg = ac[lo:hi]
    bpm = round(60.0 * fps / (lo + int(np.argmax(seg)))) if seg.size else None
    rms = float(np.sqrt((x**2).mean()))
    peak = float(np.abs(x).max()) or 1.0
    return bpm, rms / peak

# Name keywords first: Mixkit titles are descriptive and a human wrote them, which beats
# anything inferred. Measurement only fills what the name does not say.
#
# There is no "Corporate" fallback any more. It had absorbed 25 of 68 - Forest Walk,
# Fright Night, Pop 08 and a 185bpm Valley Sunset among them - which is what a fallback
# bucket does when it is the only place for anything unmatched to go. Energy turned out
# not to discriminate at all (everything sits between 0.14 and 0.18); BPM does, so an
# unmatched track is classified by tempo into a band that is at least true.
MOODS = [
 ('Cinematic', r'cinema|epic|trailer|orchestr|dramatic|hero|adventure|battle|danger|tension|suspense|fright|night|dark|descent|shadow|mystery'),
 ('Calm',      r'medit|calm|peace|relax|ambient|sleep|dream|serene|spa|zen|gentle|soft|quiet|forest|woods|beach|nature|walk|garden|rain|ocean|sky'),
 ('Happy',     r'happy|joy|sunny|cheer|fun|playful|smile|bright|holiday|christmas|party|celebr|spring|sunset|summer'),
 ('Corporate', r'corporate|business|tech|inspir|motivat|success|present|innovat|startup|journey'),
 ('Emotional', r'sad|emotion|love|romance|nostalg|melanchol|tender|heart|memory|farewell|lonely|loneliness|careful'),
 ('Energetic', r'energ|sport|workout|aerobic|power|drive|action|fast|run|pump'),
 ('Electronic',r'house|edm|electro|techno|synth|pop \d|pop\d|skyline|vibes|ovo|dance'),
 ('Hip Hop',   r'hip.?hop|trap|urban|rap|groove|funk|r&b|rb '),
 ('Acoustic',  r'acoustic|guitar|folk|country|piano|violin|jazz|blues|classical|strings'),
]

def tempo_band(bpm):
    if not bpm: return 'Medium'
    if bpm <= 80:  return 'Slow'
    if bpm <= 110: return 'Medium'
    if bpm <= 139: return 'Upbeat'
    return 'Fast'

def mood_from_name(name, bpm, energy):
    n = name.lower()
    for label, pat in MOODS:
        if re.search(pat, n): return label
    # Nothing in the name. Tempo is the only thing measured that separates these, so
    # say something true about the tempo rather than something invented about the use.
    band = tempo_band(bpm)
    return {'Slow': 'Calm', 'Medium': 'Chill', 'Upbeat': 'Energetic', 'Fast': 'Energetic'}[band]

out = []
files = sorted(f for f in os.listdir(D) if f.endswith('.mp3'))
for i, f in enumerate(files):
    p = D + f
    dur = float(subprocess.run(['ffprobe','-v','error','-show_entries','format=duration',
        '-of','default=nw=1:nk=1',p], capture_output=True).stdout or 0)
    x = pcm(p)
    bpm, energy = bpm_and_energy(x)
    tid = f[:-4]
    name = re.sub(r'-\d+$','', tid.replace('mixkit-','')).replace('-',' ').title()
    out.append({'id': tid, 'name': name, 'seconds': round(dur),
                'bpm': bpm, 'mood': mood_from_name(name, bpm, energy),
                'tempo': tempo_band(bpm), 'energy': round(energy, 3)})
    if (i+1) % 20 == 0: print(f'  ... {i+1}/{len(files)}', file=sys.stderr)

json.dump(out, open(sys.argv[1],'w'), indent=0)
from collections import Counter
print('tracks:', len(out))
print('moods:', dict(Counter(t['mood'] for t in out)))
print('tempo:', dict(Counter(t['tempo'] for t in out)))
bs=[t['bpm'] for t in out if t['bpm']]
print(f'bpm: {min(bs)}-{max(bs)} (median {int(np.median(bs))})')
print(f'durations: {min(t["seconds"] for t in out)}s - {max(t["seconds"] for t in out)}s')
