# Second OCR pass over the profile pages: crop every numeric stat box by position and read
# it alone. The whole-page pass skips isolated single digits, so this is the primary reader
# for numbers, and the whole-page pass is the witness.
# usage: boxes.py <pdf> <ocrdir> <outfile> [pdf pages comma separated]
import json, os, sys, re, pymupdf
import numpy as np, cv2
from rapidocr import RapidOCR, LangRec, OCRVersion, ModelType

pdf, ocrdir, outfile = sys.argv[1:4]
pages = [int(x) for x in sys.argv[4].split(',')] if len(sys.argv) > 4 else [n for n in range(135, 263)]
doc = pymupdf.open(pdf)
ocr = RapidOCR(params={'Rec.lang_type': LangRec.EN, 'Rec.ocr_version': OCRVersion.PPOCRV4,
                       'Rec.model_type': ModelType.MOBILE, 'Global.log_level': 'error'})

ROW_Y = [(778, 842), (870, 934), (962, 1026), (1055, 1119), (1147, 1211), (1240, 1304)]
DEF_Y = [(792, 852), (884, 944), (976, 1036), (1068, 1128), (1160, 1220), (1252, 1312)]
DMG_Y = [(1393, 1448), (1487, 1542), (1581, 1636), (1675, 1730)]
ABIL = ['melee', 'agility', 'resilience', 'vigilance', 'ego', 'logic']
DMG = ['melee', 'agility', 'ego', 'logic']

def read(img, x0, y0, x1, y1):
    h, w = img.shape[:2]
    x0, x1 = max(0, int(x0)), min(w, int(x1))
    y0, y1 = max(0, int(y0)), min(h, int(y1))
    crop = img[y0:y1, x0:x1]
    crop = cv2.resize(crop, None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC)
    pad = cv2.copyMakeBorder(crop, 24, 24, 40, 40, cv2.BORDER_REPLICATE)
    r = ocr(pad, use_det=False, use_cls=False, use_rec=True)
    if r.txts:
        return r.txts[0].strip(), round(float(r.scores[0]), 3)
    return '', 0.0

out = {}
for n in pages:
    rows = json.load(open(os.path.join(ocrdir, f'p{n:03d}.json'), encoding='utf-8'))['rows']
    def anchor(word, dflt):
        for r in rows:
            if r['t'].replace(' ', '').upper() == word:
                return r
        return dflt
    ab = anchor('ABILITIES', {'x0': 94, 'y0': 692})
    rk = anchor('RANK', None)
    dx = ab['x0'] - 94
    dy = ab['y0'] - 692
    raw = doc.extract_image(doc[n - 1].get_images()[0][0])['image']
    img = cv2.imdecode(np.frombuffer(raw, np.uint8), cv2.IMREAD_COLOR)
    # A few pages are a slightly different scan size; scale the template to match.
    sx = img.shape[1] / 1478
    sy = img.shape[0] / 1920
    R = lambda a, b, c, d: read(img, (a + dx) * sx, (b + dy) * sy, (c + dx) * sx, (d + dy) * sy)
    rec = {'dx': dx, 'dy': dy, 'abil': {}, 'dmg': {}}
    rec['rank'] = R(565, 197, 665, 280)
    rec['karma'] = R(695, 190, 835, 275)
    rec['health'] = R(575, 322, 722, 378)
    rec['healthDR'] = R(745, 336, 835, 392)
    rec['focus'] = R(575, 472, 722, 528)
    rec['focusDR'] = R(745, 487, 835, 543)
    rec['init'] = R(738, 636, 840, 692)
    for a, (y0, y1), (d0, d1) in zip(ABIL, ROW_Y, DEF_Y):
        rec['abil'][a] = {'score': R(118, y0, 192, y1), 'def': R(232, d0, 320, d1), 'check': R(360, d0, 448, d1)}
    for a, (y0, y1) in zip(DMG, DMG_Y):
        rec['dmg'][a] = {'mult': R(198, y0, 272, y1), 'ability': R(355, y0, 432, y1)}
    out[n] = rec
    print(n, rec['rank'], rec['health'], rec['focus'], flush=True)
with open(outfile, 'w', encoding='utf-8') as f:
    json.dump(out, f, ensure_ascii=False, indent=0)
