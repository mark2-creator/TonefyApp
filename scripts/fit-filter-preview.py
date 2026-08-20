"""Fit each ffmpeg grade to the closest CSS colour-matrix filter, and MEASURE the error.

The point is not to guess a mapping. It is to find the best one a colour matrix can
express and then say, in numbers, how close it got - so a preview is offered only where
it has been shown to resemble the render, and abstains where it cannot.

The CSS functions are implemented from the W3C filter-effects matrices, which is what
Android's ColorMatrixColorFilter applies, so the simulation is of the real thing rather
than of an idea of it.
"""
import json, subprocess, sys
import numpy as np
from scipy.optimize import minimize

IMGS = ['face_106.jpg', 'face_117.jpg', 'face_058.jpg']   # luminance 99 / 128 / 134
D = '/home/ahumuza/.cache/tonefy/filter-src/'
W, H = 64, 96

def render(chain):
    vf = ','.join([f'scale={W}:{H}:force_original_aspect_ratio=increase', f'crop={W}:{H}'] + list(chain))
    out = []
    for im in IMGS:
        raw = subprocess.run(['ffmpeg','-v','error','-i',D+im,'-vf',vf,'-frames:v','1',
                              '-f','rawvideo','-pix_fmt','rgb24','-'],
                             capture_output=True).stdout
        out.append(np.frombuffer(raw, np.uint8).astype(np.float64).reshape(-1,3)/255.0)
    return np.concatenate(out)

LUM = np.array([0.2126, 0.7152, 0.0722])

def m_saturate(s):
    return np.array([[0.213+0.787*s, 0.715-0.715*s, 0.072-0.072*s],
                     [0.213-0.213*s, 0.715+0.285*s, 0.072-0.072*s],
                     [0.213-0.213*s, 0.715-0.715*s, 0.072+0.928*s]])

def m_huerotate(deg):
    a = np.radians(deg); c, s = np.cos(a), np.sin(a)
    return np.array([
      [0.213+c*0.787-s*0.213, 0.715-c*0.715-s*0.715, 0.072-c*0.072+s*0.928],
      [0.213-c*0.213+s*0.143, 0.715+c*0.285+s*0.140, 0.072-c*0.072-s*0.283],
      [0.213-c*0.213-s*0.787, 0.715-c*0.715+s*0.715, 0.072+c*0.928+s*0.072]])

def m_sepia(a):
    I = np.eye(3)
    S = np.array([[0.393,0.769,0.189],[0.349,0.686,0.168],[0.272,0.534,0.131]])
    return I*(1-a) + S*a

def apply_css(px, p):
    """brightness, contrast, saturate, hue-rotate, sepia - in the order a browser applies them."""
    b, c, s, h, se = p
    x = px * b                                    # brightness
    x = x * c + (0.5 - 0.5*c)                     # contrast
    M = m_sepia(se) @ m_saturate(s) @ m_huerotate(h)
    x = x @ M.T
    return np.clip(x, 0, 1)

def fit(target, base):
    def loss(p):
        return float(np.mean(np.abs(apply_css(base, p) - target)))
    best, bestp = 1e9, None
    # A few starts, because the landscape has local minima around hue.
    for h0 in (0.0, -25.0, 25.0):
        r = minimize(loss, [1.0, 1.0, 1.0, h0, 0.0], method='Nelder-Mead',
                     options={'maxiter': 1200, 'xatol': 1e-3, 'fatol': 1e-5})
        if r.fun < best: best, bestp = float(r.fun), r.x
    return best, bestp

def css_string(p):
    b, c, s, h, se = p
    out = []
    if abs(b-1) > 0.005: out.append(f'brightness({b:.3f})')
    if abs(c-1) > 0.005: out.append(f'contrast({c:.3f})')
    if abs(s-1) > 0.005: out.append(f'saturate({max(0.0,s):.3f})')
    if abs(h)   > 0.5:   out.append(f'hue-rotate({h:.1f}deg)')
    if se       > 0.005: out.append(f'sepia({min(1.0,max(0.0,se)):.3f})')
    return ' '.join(out)

filters = json.load(open(sys.argv[1]))
base = render([])
rows = []
for i, f in enumerate(filters):
    if not f['chain']:
        continue
    try:
        target = render(f['chain'])
    except Exception:
        continue
    err, p = fit(target, base)
    rows.append({'id': f['id'], 'err': round(err*255, 2), 'css': css_string(p)})
    if (i+1) % 25 == 0:
        print(f'  ... {i+1}', file=sys.stderr)
json.dump(rows, open(sys.argv[2], 'w'))
errs = np.array([r['err'] for r in rows])
print(f'fitted {len(rows)} grades')
for t in (2, 4, 6, 8, 12):
    print(f'  within {t:>2} levels (of 255): {int((errs<=t).sum()):>3} ({(errs<=t).mean()*100:.0f}%)')
print(f'  median error {np.median(errs):.1f}, worst {errs.max():.1f}')
