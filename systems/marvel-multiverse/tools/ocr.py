# OCR the scanned rulebook page by page. One JSON per page, so it can stop and resume,
# and the reading order can be redone later without running OCR again.
# usage: ocr.py <pdf> <outdir> <worker> <workers>
import json, os, sys, time, pymupdf
import numpy as np, cv2
from rapidocr import RapidOCR, LangRec, OCRVersion, ModelType

pdf, outdir, worker, workers = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4])
os.makedirs(outdir, exist_ok=True)
doc = pymupdf.open(pdf)
ocr = RapidOCR(params={'Rec.lang_type': LangRec.EN, 'Rec.ocr_version': OCRVersion.PPOCRV4,
                       'Rec.model_type': ModelType.MOBILE, 'Global.log_level': 'error',
                       'EngineConfig.onnxruntime.intra_op_num_threads': 4})
t0 = time.time()
for n in range(1, doc.page_count + 1):
    if n % workers != worker:
        continue
    out = os.path.join(outdir, f'p{n:03d}.json')
    if os.path.exists(out):
        continue
    raw = doc.extract_image(doc[n - 1].get_images()[0][0])['image']
    img = cv2.imdecode(np.frombuffer(raw, np.uint8), cv2.IMREAD_COLOR)
    # The scan is about 180 dpi. Doubling helps with the small print in stat blocks.
    img = cv2.resize(img, None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC)
    r = ocr(img, use_cls=False)
    rows = []
    if r.txts:
        for box, text, score in zip(r.boxes, r.txts, r.scores):
            xs = [float(p[0]) / 2 for p in box]
            ys = [float(p[1]) / 2 for p in box]
            rows.append({'x0': round(min(xs), 1), 'y0': round(min(ys), 1), 'x1': round(max(xs), 1),
                         'y1': round(max(ys), 1), 't': text, 's': round(float(score), 3)})
    tmp = out + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump({'page': n, 'w': img.shape[1] / 2, 'h': img.shape[0] / 2, 'rows': rows}, f, ensure_ascii=False)
    os.replace(tmp, out)
    print(f'p{n}: {len(rows)} lines, {time.time() - t0:.0f}s', flush=True)
print('worker', worker, 'done', flush=True)
