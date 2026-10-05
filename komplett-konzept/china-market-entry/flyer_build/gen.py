"""Rebuilds the Komplett Konzept Canton Fair flyer (CN/EN and DE) as HTML from the
Canva layout data, applies the requested edits, and lets Chromium print it to PDF."""
import json, sys, copy, html, os
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
IMG = json.load(open(f'{HERE}/img/map.json'))
for _m in IMG.values(): _m['file'] = _m['file'].replace('rebuild/', '')
PHONE_NR = '+49 177 2711126'
PHONE_SVG = ('<svg class="ph" viewBox="0 0 16 24" aria-hidden="true"><rect x="1.5" y="1.5" width="13" height="21" rx="2.5" '
             'fill="none" stroke="currentColor" stroke-width="2.2"/><rect x="5.5" y="4" width="5" height="1.6" rx=".8" '
             'fill="currentColor"/><circle cx="8" cy="18.6" r="1.6" fill="currentColor"/></svg>')
FONT = {'YAFmnBd9xfA': "'SHS'", 'YACgEZ1cb1Q': "'Arimo', 'SHS'"}
WEIGHT = {'normal': 400, 'medium': 500, 'bold': 700}

# banner: only the strip the user marked (below the purple line, above the red line)
strip = Image.open(f'{HERE}/KomplettKonzept_Banner_Luftbild.jpg').crop((0, 100, 1672, 703))
strip.save(f'{HERE}/img/banner_strip.jpg', quality=93)
BANNER_H = round(1123 * strip.height / strip.width)


def text_el(id, top, left, width, txt, size, color='#ffffff', weight='normal', align='start', lh=1.4,
            font='YACgEZ1cb1Q', italic=False):
    return {'id': id, 'type': 'text', 'top': top, 'left': left, 'width': width, 'height': 0,
            'textRegions': [{'characters': txt, 'formatting': {'fontSize': size, 'fontWeight': weight,
                             'fontStyle': 'italic' if italic else 'normal', 'color': color, 'textAlign': align,
                             'lineHeight': lh, 'fontRef': font + ',0'}}]}


def render(page, page_bg):
    out = []
    for e in page['elements']:
        st = f"left:{e['left']:.2f}px;top:{e['top']:.2f}px;width:{e['width']:.2f}px;"
        if e.get('opacity', 1) != 1: st += f"opacity:{e['opacity']};"
        if e['type'] == 'shape':
            p = e['paths'][0]
            st += f"height:{e['height']:.2f}px;background:{p['fill']['color']['color']};border-radius:{p.get('cornerRounding', 0)}px;"
            out.append(f'<div class="el" style="{st}"></div>')
        elif e['type'] == 'rect':
            st += f"height:{e['height']:.2f}px;overflow:hidden;"
            if 'src' in e:   # replaced image, fitted to the element box
                out.append(f'<div class="el" style="{st}"><img src="{e["src"]}" style="width:100%;height:100%;object-fit:{e.get("fit","fill")}"></div>')
                continue
            m = IMG[e['fill']['media']['mediaId']]
            b = m['pdfbbox']
            ist = f"left:{e['ox']:.2f}px;top:{e['oy']:.2f}px;width:{b[2]-b[0]:.2f}px;height:{b[3]-b[1]:.2f}px;"
            out.append(f'<div class="el" style="{st}"><img src="{m["file"]}" style="position:absolute;{ist}"></div>')
        elif e['type'] == 'text':
            parts = []
            for r in e['textRegions']:
                f = r['formatting']
                fst = (f"font-family:{FONT[f['fontRef'].split(',')[0]]};font-size:{f['fontSize']:.2f}px;"
                       f"font-weight:{WEIGHT[f['fontWeight']]};font-style:{f['fontStyle']};color:{f['color']};")
                t = html.escape(r['characters']).replace('{PHONE}', PHONE_SVG)
                parts.append(f'<span style="{fst}">{t}</span>')
            f0 = e['textRegions'][0]['formatting']
            al = {'start': 'left', 'center': 'center', 'end': 'right'}[f0['textAlign']]
            st += f"text-align:{al};line-height:{f0['lineHeight']};"
            out.append(f'<div class="el tx" style="{st}">{"".join(parts)}</div>')
        elif e['type'] == 'html':
            out.append(f'<div class="el" style="{st}{e.get("style","")}">{e["html"]}</div>')
    return f'<section class="page" style="{page_bg}">{"".join(out)}</section>'


def find(page, id):
    return next(e for e in page['elements'] if e['id'] == id)


def set_text(page, id, txt, **fmt):
    e = find(page, id)
    e['textRegions'] = [dict(e['textRegions'][0], characters=txt)]
    e['textRegions'][0]['formatting'] = dict(e['textRegions'][0]['formatting'], **fmt)
    return e


def delete(page, *ids):
    page['elements'] = [e for e in page['elements'] if e['id'] not in ids]


def header(page, contact_id, contact_txt):
    logo = find(page, next(e['id'] for e in page['elements'] if e['type'] == 'rect' and e['fill']['media']['mediaId'] == 'MAHWduUtRtY'))
    h = 92; w = h * 997 / 489
    logo.update(top=8, left=158.7 - w / 2, width=w, height=h, src=IMG['MAHWduUtRtY']['file'])
    page['elements'].append(text_el('url', 106, 40, 237, 'www.komplett-konzept.de', 15, '#0b1f4b', 'bold', 'center', 1.2))
    set_text(page, contact_id, contact_txt)


def footer(page, old_id):
    delete(page, old_id)
    page['elements'].append(text_el('foot', 1514, 43, 940, f'CEO Mario Parlitz  ·  {{PHONE}} {PHONE_NR}  ·  info@mapatec.de',
                                    20, '#ffffff', 'bold', 'center', 1.3))
    page['elements'].append({'id': 'footqr', 'type': 'rect', 'top': 1484, 'left': 997, 'width': 86, 'height': 86,
                             'fill': {'media': {'mediaId': 'MAHWlFIXZ8E'}}, 'src': IMG['MAHWlFIXZ8E']['file']})


def build(lang):
    cn = lang == 'CN'
    p1 = json.load(open(f'{HERE}/{lang}_p1.json'))
    p2 = json.load(open(f'{HERE}/{lang}_p2.json'))
    for pg in (p1, p2):   # image offsets inside their frame, from the original layout
        for e in pg['elements']:
            if e['type'] == 'rect' and e['fill']['media'].get('mediaId') in IMG:
                b = IMG[e['fill']['media']['mediaId']]['pdfbbox']; e['ox'] = b[0] - e['left']; e['oy'] = b[1] - e['top']
    contact = ('首席执行官 CEO Mario Parlitz  ·  {PHONE} ' if cn else 'CEO Mario Parlitz  ·  {PHONE} ') + PHONE_NR

    # ---------------- page 1 ----------------
    header(p1, 'LBQdNMdgkMRrQt25', contact)
    ban = find(p1, 'LBB21yZr8ZNH5b3G'); ban.update(height=BANNER_H, src='img/banner_strip.jpg')
    # move everything below the banner up (sections keep their inner layout)
    o = 140 + BANNER_H + 24 - 772   # sections start 24px below the banner
    secs = [(772, 958, o), (958, 1142, o + 50), (1142, 1264, o + 100), (1264, 1500, o + 150)]
    for e in p1['elements']:
        for a, b, d in secs:
            if a <= e['top'] < b: e['top'] += d; break
    # badge: 30+ years of online retail experience
    l1, l2, s1, s2 = (('30多年电商经验', '30+ years of e-commerce experience', 30, 15.5) if cn
                      else ('Über 30 Jahre', 'Erfahrung im Onlinehandel', 33, 17.5))
    p1['elements'].append({'id': 'badge', 'type': 'html', 'top': 160, 'left': 29, 'width': 0,
                           'html': f'<div class="badge"><div style="font-size:{s1}px">{l1}</div><div style="font-size:{s2}px">{l2}</div></div>'})
    # own warehouses instead of "examples – scan"
    set_text(p1, 'LBzY5RNBxDRsYWy4', '精选自有仓库 · 报警防护及视频监控  /  Our own warehouses – alarm-secured & video-monitored'
             if cn else 'Auswahl unserer eigenen Lagerhallen – alarmgesichert & videoüberwacht', fontSize=20 if cn else 24)
    q1, q2 = find(p1, 'LBLCnD3kV3F0jcf5'), find(p1, 'LBDKkVVw7v4WgqYS')
    q1['fill'], q2['fill'] = q2['fill'], q1['fill']   # Geisleden (central Germany) left, Grävenwiesbach (Frankfurt area) right
    for qid, lid, t in [('LBLCnD3kV3F0jcf5', 'LBGr0ZzJqPxcSrDc', '德国中部 · 8,000 m²\nCentral Germany' if cn else 'Mitten in Deutschland\n8.000 m²'),
                        ('LBDKkVVw7v4WgqYS', 'LBrqmL1sHH9MpPXF', '法兰克福 · 4,000 m²\nFrankfurt' if cn else 'Frankfurt\n4.000 m²')]:
        q = find(p1, qid); lab = set_text(p1, lid, t, lineHeight=1.25)
        lab.update(left=q['left'] + 75 - 150, width=300, top=q['top'] + 160)
    find(p1, 'LBzY5RNBxDRsYWy4')['top'] -= 12   # more air between heading and QR codes
    footer(p1, 'LBDfKDv7L0dyZJXN')

    # ---------------- page 2 ----------------
    header(p2, 'LBfc3TvJJmJS1P3q' if cn else 'LBDY7qjHbTf6kMpw', contact)
    if cn:
        set_text(p2, 'LB8dBDLjYK0Tp8Cr', '您在德国备货。我们不仅负责仓储、主动销售、发货和退货，还负责品牌建设与商标注册。')
        set_text(p2, 'LBt0gHCXX9x0tzrS', 'You stock your products in Germany. We handle not only storage, active sales, shipping and returns, '
                                         'but also brand development and trademark registration.').update(top=444)
    else:
        set_text(p2, 'LB8dBDLjYK0Tp8Cr', 'Sie stellen Ihre Produkte in Deutschland bereit. Wir übernehmen nicht nur Lagerung, aktiven Vertrieb, '
                                         'Versand und Retouren, sondern auch Markenentwicklung und Markenanmeldung.')
    # advantages: subtitle + rows moved down, "innen und außen" removed
    sub = ('成功源于信任——您的客户在德国本地拥有一位德国联系人。 Success is built on trust – your customers get a German contact person on site.'
           if cn else 'Erfolg basiert auf Vertrauen – mit uns haben Ihre Kunden einen deutschen Ansprechpartner direkt vor Ort.')
    p2['elements'].append(text_el('advsub', 1094, 60, 1010, sub, 15 if cn else 17, '#ffc857', 'normal', 'start', 1.3, italic=True))
    if cn:
        set_text(p2, 'LBrRksDJHncSqDk0', '德国多个基地，整托及单件。')
        set_text(p2, 'LBhbyCbwR1jbp86H', 'Several sites in Germany – pallets and single items.')
        for e in p2['elements']:
            if 1095 <= e['top'] < 1200: e['top'] += 28
            elif 1200 <= e['top'] < 1320: e['top'] += 14
    else:
        set_text(p2, 'LBrRksDJHncSqDk0', 'Mehrere Standorte – Palettenware und Einzelpakete.')
        for e in p2['elements']:
            if 1095 <= e['top'] < 1200: e['top'] += 26
            elif 1200 <= e['top'] < 1320: e['top'] += 6
    # Komplett Konzept & MapaTec box
    box = find(p2, 'LBJS3p3Rr0HS3tql'); box.update(top=1318 if not cn else 1338, height=150 if not cn else 134)
    bt = box['top']
    logo = find(p2, 'LBVCrYYRs4p2CJms'); lh = box['height'] - 28; lw = lh * 744 / 495
    logo.update(top=bt + 14, left=72, width=lw, height=lh, src=IMG['MAHWlA8t-z4']['file'])
    tx = 72 + lw + 26
    delete(p2, 'LB6fZs1ZkrcDyfrC', 'LBFRLmybQ1QmD80X', 'LBPTC45kV7WqrKkX', 'LBNY4w00HP8lltkh', 'LBGYN2KCP09GkLTN')
    W = 1073 - 24 - tx
    if cn:
        rows = [(bt + 10, 'Komplett Konzept & MapaTec', 21, '#0b1f4b', 'bold'),
                (bt + 37, '我们两家公司为您提供全方位服务 · With our two companies you are covered end to end.', 15, '#d62828', 'bold'),
                (bt + 59, '进出口经验不足？我们自己的进口公司 MapaTec 为您提供支持。', 16, '#0b1f4b', 'normal'),
                (bt + 82, 'New to import/export? Our own import company MapaTec supports you.', 14, '#4a5a7a', 'normal'),
                (bt + 103, '联系人 Contact: Frank Matysik', 15, '#d62828', 'bold')]
    else:
        rows = [(bt + 14, 'Komplett Konzept & MapaTec', 22, '#0b1f4b', 'bold'),
                (bt + 44, 'Mit unseren beiden Unternehmen decken Sie alles ab.', 17, '#d62828', 'bold'),
                (bt + 72, 'Unerfahren im Import/Export? Unsere eigene Importfirma MapaTec unterstützt Sie.', 17, '#0b1f4b', 'normal'),
                (bt + 112, 'Ansprechpartner MapaTec: Frank Matysik', 15, '#0b1f4b', 'bold')]
    for i, (t, s, sz, col, wt) in enumerate(rows):
        p2['elements'].append(text_el(f'mt{i}', t, tx, W, s, sz, col, wt, 'start', 1.3))
    footer(p2, 'LB9LHPPnPGZssrFY')

    bg1 = 'background:linear-gradient(180deg,#07264d 0%,#05224a 55%,#031f44 100%);'
    bg2 = 'background:#0b1f4b;'
    css = open(f'{HERE}/flyer.css').read()
    doc = f'<!doctype html><html><head><meta charset="utf-8"><style>{css}</style></head><body>{render(p1,bg1)}{render(p2,bg2)}</body></html>'
    open(f'{HERE}/flyer_{lang}.html', 'w').write(doc)


if __name__ == '__main__':
    for lang in sys.argv[1:] or ['CN', 'DE']:
        build(lang)
    print('banner height', BANNER_H)
