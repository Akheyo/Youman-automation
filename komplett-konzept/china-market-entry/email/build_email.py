"""Builds the Komplett Konzept outreach e-mail (CN/EN for suppliers, DE reading version) from the flyer content.

Outputs per language:
  email_<LANG>.html  – preview in the browser (images as local files)
  email_<LANG>.eml   – ready-to-send draft (images embedded inline via cid:), opens in Outlook/Apple Mail/Thunderbird
"""
import os, sys, html, urllib.parse, mimetypes, base64
from email.message import EmailMessage
from email.utils import make_msgid
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
FB = os.path.join(HERE, '..', 'flyer_build', 'img')
OUT_IMG = os.path.join(HERE, 'img')
os.makedirs(OUT_IMG, exist_ok=True)

MAIL = 'info@mapatec.de'
PHONE = '+49 177 2711123'
NAVY, CARD, RED, GOLD, LIGHT = '#0b1f4b', '#16336e', '#d62828', '#ffc857', '#c9d4ea'
FONT = "Arial,'Helvetica Neue',Helvetica,'PingFang SC','Microsoft YaHei',sans-serif"

# images: (key, source, max width in px of the stored file)
IMAGES = {
    'logo': ('MAHWduUtRtY.png', 360), 'banner': ('banner_strip.jpg', 1200), 'qr_mario': ('MAHWlFIXZ8E.png', 240),
    'qr_frank': ('QR_WeChat_Frank_Matysik.png', 240), 'mapatec': ('MAHWlA8t-z4.png', 300),
    'qr_central': ('MAHWGY8J69I.png', 240), 'qr_frankfurt': ('MAHWGRkaej0.png', 240),
    'ic1': ('MAHWGfSQUeU.png', 120), 'ic2': ('MAHWGcKGPag.png', 120), 'ic3': ('MAHWGZPSbPQ.png', 120), 'ic4': ('MAHWlDtj0e0.png', 120),
}


def prep_images():
    files = {}
    for k, (src, w) in IMAGES.items():
        im = Image.open(os.path.join(FB, src))
        if im.width > w:
            im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
        if src.endswith('.jpg'):
            dst = os.path.join(OUT_IMG, k + '.jpg'); im.convert('RGB').save(dst, quality=80, optimize=True)
        else:
            dst = os.path.join(OUT_IMG, k + '.png'); im.save(dst, optimize=True)
        files[k] = dst
    return files


T = {
 'CN': dict(
    subject='德国/欧洲市场合作 · 预约展位拜访 | Germany/Europe partnership – book a booth visit',
    preheader='Mario Parlitz 将亲临您的展位：广交会第一期 15.–19.10. · 上海 21.–25.10.',
    headline='进入德国及欧洲市场', headline2='Enter the German & European Market',
    intro='您只需提供产品，其余一切由我们完成：销售、物流、退货和技术支持。',
    intro2='You just deliver the products – we take care of everything else: sales, logistics, returns & technical support.',
    badge='30多年电商经验 · 30+ years of e-commerce experience',
    visit_t='Mario Parlitz 将亲临您的展位', visit_t2='Mario Parlitz will visit your booth',
    visit_p='我们的首席执行官 Mario Parlitz 将在中国参展期间亲自拜访您的展位，与您面谈合作。',
    visit_p2='Our CEO Mario Parlitz will personally visit your booth in China to talk about working together.',
    fairs=[('广交会 第一期 · Canton Fair Phase 1', '广州 Guangzhou', '15.–19.10.'), ('上海 · Shanghai', '上海 Shanghai', '21.–25.10.')],
    reg_t='登记面谈 · Register for a meeting', reg_p='请告诉我们以下信息，Mario 将前往您的展位：',
    reg_p2='Please send us the following details and Mario will come to your booth:',
    fields=['姓名 Name', '电话 / 微信 Phone / WeChat', '展位号 Booth ID', '行业 Industry'],
    fair_field='展会 Fair: 广州 Guangzhou / 上海 Shanghai',
    button='立即登记 · Register now', reply='或直接回复本邮件并填写以上信息。 · Or simply reply to this e-mail with these details.',
    mail_subject='展位拜访登记 · Booth visit registration',
    models_t='四种合作模式 · 按优先顺序排列', models_t2='Four ways to work with us – in order of our preference',
    models=[
     ('1', '寄售模式 · Consignment', '★ 首选 · 1st choice', '您的货物 · 我们的销售 · 长期合作',
      '您在德国备货。我们不仅负责仓储、主动销售、发货和退货，还可应要求负责品牌建设与商标注册。可签订分销协议，条款可协商。',
      'You stock your products in Germany. We handle storage, active sales, shipping and returns – and, on request, brand development and trademark registration. Distribution agreement possible and negotiable.'),
     ('2', '代发货 + 销售 · Fulfillment + Sales', '第二选择 · 2nd choice', '您的货物 · 共同销售 · 我们的德国物流',
      '您提供货物。我们负责仓储和发货，并通过现有销售渠道为您开发新客户。',
      'You provide the goods. We store and ship your products and win new customers through our existing sales channels.'),
     ('3', '代发货服务 · Fulfillment', '第三选择 · 3rd choice', '您的销售 · 我们的德国物流',
      '您自行销售产品。我们在德国负责仓储、拣货、包装和发货。',
      'You sell your products yourself. We handle storage, picking, packing and shipping in Germany.'),
     ('4', '纯仓储面积 · Storage Space', '第四选择 · 4th choice', '您的货物 · 我们的仓储空间',
      '您在德国租用仓储面积——托盘位或整块区域，室内及室外均可。',
      'You rent storage space in Germany – pallet spaces or whole areas, indoors and outdoors.')],
    adv_t='您的优势 · Your advantages',
    adv_sub='成功源于信任——您的客户在德国本地拥有一位德国联系人。 Success is built on trust – your customers get a German contact person on site.',
    adv=[('无需德国公司 · No German company needed', '无需在德国注册公司、租仓库或招聘员工。 No company, warehouse or staff of your own needed in Germany.'),
         ('19,000 m² 仓储 · 19,000 m² storage', '德国多个基地，整托及单件。 Several sites in Germany – pallets and single items.'),
         ('B2B & B2C · Germany/Europe-wide', '面向经销商、企业客户、网店及电商平台。 Dealers, business customers, online shops and marketplaces.'),
         ('退货 · 技术支持 · 备件 · Returns, support, parts', '均在德国本地完成。 Handled locally in Germany – no return shipping to China.')],
    wh_t='精选自有仓库 · 报警防护及视频监控 · Our own warehouses – alarm-secured & video-monitored',
    wh=[('德国中部 · 8,000 m²', 'Central Germany'), ('法兰克福 · 4,000 m²', 'Frankfurt')], wh_more='+ 更多仓库遍布德国 · more sites in Germany',
    mt_t='Komplett Konzept & MapaTec', mt_1='我们两家公司为您提供全方位服务 · With our two companies you are covered end to end.',
    mt_2='进出口经验不足？我们自己的进口公司 MapaTec 为您提供支持。 New to import/export? Our own import company MapaTec supports you.',
    mt_3='联系人 Contact: Frank Matysik · 📱\u00a0+49\u00a0155\u00a067815122 · 微信 WeChat',
    contact='您的联系人 Your contact', wechat='微信扫码 · Scan WeChat',
 ),
 'DE': dict(
    subject='Kooperation Deutschland/Europa · Standbesuch vereinbaren',
    preheader='Mario Parlitz besucht Ihren Stand: Kanton-Messe Phase 1 15.–19.10. · Shanghai 21.–25.10.',
    headline='Ihr Weg in den deutschen und europäischen Markt', headline2='Deutsche Lesefassung der chinesischen E-Mail (intern)',
    intro='Sie brauchen nur die Produkte zu liefern – wir erledigen den ganzen Rest: Vertrieb, Logistik, Retouren und technischen Support.',
    intro2='', badge='Über 30 Jahre Erfahrung im Onlinehandel',
    visit_t='Mario Parlitz besucht Ihren Stand', visit_t2='',
    visit_p='Unser CEO Mario Parlitz kommt während der Messen in China persönlich an Ihren Stand, um mit Ihnen über eine Zusammenarbeit zu sprechen.',
    visit_p2='',
    fairs=[('Kanton-Messe, Phase 1', 'Guangzhou', '15.–19.10.'), ('Shanghai', 'Shanghai', '21.–25.10.')],
    reg_t='Gesprächstermin eintragen', reg_p='Schicken Sie uns diese Angaben – Mario kommt dann an Ihren Stand:', reg_p2='',
    fields=['Name', 'Telefon / WeChat', 'Stand-Nr. (Booth ID)', 'Branche'],
    fair_field='Messe: Guangzhou / Shanghai',
    button='Jetzt eintragen', reply='Oder antworten Sie einfach auf diese E-Mail mit den Angaben.',
    mail_subject='Anmeldung Standbesuch',
    models_t='Vier Kooperationsmodelle – nach unserer Präferenz', models_t2='1 = unsere erste Wahl',
    models=[
     ('1', 'Konsignationsmodell', '★ 1. Wahl', 'Ihre Ware – unser Vertrieb – langfristige Partnerschaft.',
      'Sie stellen Ihre Produkte in Deutschland bereit. Wir übernehmen nicht nur Lagerung, aktiven Vertrieb, Versand und Retouren, sondern auf Wunsch auch Markenentwicklung und Markenanmeldung. Distributionsvertrag möglich und verhandelbar.', ''),
     ('2', 'Fulfillment + Vertrieb', '2. Wahl', 'Ihre Ware – gemeinsamer Vertrieb – unsere deutsche Logistik.',
      'Sie stellen die Ware bereit. Wir lagern und versenden Ihre Produkte und erschließen zusätzlich über unsere bestehenden Vertriebskanäle neue Kunden.', ''),
     ('3', 'Fulfillment', '3. Wahl', 'Ihr Vertrieb – unsere deutsche Logistik.',
      'Sie verkaufen Ihre Produkte selbst. Wir übernehmen in Deutschland Lagerung, Kommissionierung, Verpackung und Versand.', ''),
     ('4', 'Reine Lagerfläche', '4. Wahl', 'Ihre Ware – unsere Lagerfläche.',
      'Sie mieten Lagerfläche in Deutschland – Palettenstellplätze oder ganze Flächen, innen und außen.', '')],
    adv_t='Ihre Vorteile auf einen Blick',
    adv_sub='Erfolg basiert auf Vertrauen – mit uns haben Ihre Kunden einen deutschen Ansprechpartner direkt vor Ort.',
    adv=[('Keine eigene Firma in Deutschland nötig', 'Verkaufen in der EU ohne eigene Gesellschaft, Lager oder Personal in Deutschland.'),
         ('19.000 m² Lagerfläche bundesweit', 'Mehrere Standorte – Palettenware und Einzelpakete.'),
         ('B2B & B2C Deutschland/Europaweit', 'Händler, Firmenkunden, Online-Shops und Marktplätze – in Deutschland und Europa.'),
         ('Retouren, technischer Support & Ersatzteile', 'Direkt aus Deutschland – kein Rückversand nach China.')],
    wh_t='Auswahl unserer eigenen Lagerhallen – alarmgesichert & videoüberwacht',
    wh=[('Mitten in Deutschland', '8.000 m²'), ('Frankfurt', '4.000 m²')], wh_more='+ weitere Standorte in Deutschland',
    mt_t='Komplett Konzept & MapaTec', mt_1='Mit unseren beiden Unternehmen decken Sie alles ab.',
    mt_2='Unerfahren im Import/Export? Unsere eigene Importfirma MapaTec unterstützt Sie.',
    mt_3='Ansprechpartner MapaTec: Frank Matysik · 📱\u00a0+49\u00a0155\u00a067815122 · WeChat',
    contact='Ihr Ansprechpartner', wechat='WeChat scannen',
 ),
}


def e(s):
    return html.escape(s)


def p(txt, size=15, color='#ffffff', bold=False, italic=False, mb=8, lh=1.5, align='left'):
    if not txt:
        return ''
    st = (f"margin:0 0 {mb}px 0;font-family:{FONT};font-size:{size}px;line-height:{lh};color:{color};text-align:{align};"
          f"{'font-weight:bold;' if bold else ''}{'font-style:italic;' if italic else ''}")
    return f'<p style="{st}">{e(txt)}</p>'


def build(lang, src):
    t = T[lang]
    body_lines = [f'{f}:' for f in t['fields']] + [t['fair_field']]
    mailto = 'mailto:%s?subject=%s&body=%s' % (MAIL, urllib.parse.quote(t['mail_subject']),
                                                urllib.parse.quote('\r\n'.join(body_lines) + '\r\n'))
    img = lambda k, w, alt='', st='': f'<img src="{src[k]}" width="{w}" alt="{e(alt)}" style="display:block;border:0;width:{w}px;max-width:100%;height:auto;{st}">'
    sec = lambda inner, bg=NAVY, pad='24px 28px': f'<tr><td style="background:{bg};padding:{pad};">{inner}</td></tr>'
    rows = []

    # header
    rows.append(f'''<tr><td style="background:#ffffff;padding:16px 24px;border-bottom:4px solid {RED};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td width="180" valign="middle">{img('logo', 160, 'Komplett Konzept')}<p style="margin:4px 0 0 0;font-family:{FONT};font-size:12px;font-weight:bold;color:{NAVY};text-align:center;width:160px;">www.komplett-konzept.de</p></td>
<td valign="middle" align="right"><p style="margin:0;font-family:{FONT};font-size:14px;font-weight:bold;color:{NAVY};">CEO Mario Parlitz</p>
<p style="margin:2px 0 0 0;font-family:{FONT};font-size:14px;color:{NAVY};"><a href="tel:+491772711123" style="color:{NAVY};text-decoration:none;">📱 {PHONE}</a></p>
<p style="margin:2px 0 0 0;font-family:{FONT};font-size:14px;"><a href="mailto:{MAIL}" style="color:{RED};text-decoration:none;">{MAIL}</a></p></td>
<td width="76" valign="middle" align="right" style="padding-left:12px;">{img('qr_mario', 70, 'WeChat Mario Parlitz')}</td>
</tr></table></td></tr>''')
    # banner + badge
    rows.append(f'<tr><td style="padding:0;background:{NAVY};">{img("banner", 640, "Komplett Konzept")}</td></tr>')
    rows.append(sec(
        f'<p style="margin:0 0 14px 0;"><span style="display:inline-block;background:{RED};color:#ffffff;font-family:{FONT};font-size:14px;font-weight:bold;padding:6px 14px;border-radius:12px;">{e(t["badge"])}</span></p>'
        + p(t['headline'], 26, '#ffffff', True, mb=2, lh=1.3) + p(t['headline2'], 16, LIGHT, mb=12)
        + p(t['intro'], 15, '#ffffff', mb=4) + p(t['intro2'], 13, LIGHT, mb=0), pad='22px 28px 18px 28px'))

    # booth visit + registration
    fairs = ''.join(f'''<td width="50%" valign="top" style="padding:6px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:10px;">
<tr><td style="padding:14px 16px;border-left:5px solid {RED};border-radius:10px;">
<p style="margin:0 0 4px 0;font-family:{FONT};font-size:22px;font-weight:bold;color:{RED};">{e(d)}</p>
<p style="margin:0 0 2px 0;font-family:{FONT};font-size:14px;font-weight:bold;color:{NAVY};">{e(n)}</p>
<p style="margin:0;font-family:{FONT};font-size:13px;color:#4a5a7a;">{e(c)}</p></td></tr></table></td>''' for n, c, d in t['fairs'])
    fields = ''.join(f'''<tr><td style="padding:4px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td width="38%" style="font-family:{FONT};font-size:14px;font-weight:bold;color:{NAVY};padding:9px 10px;background:#eef2fa;border:1px solid #cfd8ea;border-right:0;border-radius:6px 0 0 6px;">{e(f)}</td>
<td style="background:#ffffff;border:1px solid #cfd8ea;border-radius:0 6px 6px 0;">&nbsp;</td></tr></table></td></tr>''' for f in t['fields'])
    rows.append(sec(f'''<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:{GOLD};border-radius:14px;">
<tr><td style="padding:20px 20px 8px 20px;">
<p style="margin:0 0 2px 0;font-family:{FONT};font-size:22px;font-weight:bold;color:{NAVY};">🗓 {e(t["visit_t"])}</p>
{p(t["visit_t2"], 16, NAVY, True, mb=8)}{p(t["visit_p"], 14, NAVY, mb=2)}{p(t["visit_p2"], 13, "#33415c", mb=6)}</td></tr>
<tr><td style="padding:0 14px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>{fairs}</tr></table></td></tr>
<tr><td style="padding:14px 20px 4px 20px;">
<p style="margin:0 0 4px 0;font-family:{FONT};font-size:18px;font-weight:bold;color:{NAVY};">✍ {e(t["reg_t"])}</p>
{p(t["reg_p"], 14, NAVY, mb=2)}{p(t["reg_p2"], 13, "#33415c", mb=8)}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">{fields}</table></td></tr>
<tr><td align="center" style="padding:16px 20px 6px 20px;">
<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:{RED};border-radius:26px;">
<a href="{e(mailto)}" style="display:inline-block;padding:14px 34px;font-family:{FONT};font-size:18px;font-weight:bold;color:#ffffff;text-decoration:none;">{e(t["button"])} →</a></td></tr></table></td></tr>
<tr><td style="padding:4px 20px 18px 20px;">{p(t["reply"], 13, NAVY, align="center", mb=0)}</td></tr>
</table>''', pad='8px 20px 20px 20px'))

    # four models
    cards = []
    for i, (n, title, rank, tag, d1, d2) in enumerate(t['models']):
        cards.append(f'''<tr><td style="padding:0 0 12px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:{CARD};border-radius:12px;">
<tr><td width="60" valign="top" style="padding:16px 0 16px 16px;border-left:5px solid {RED};border-radius:12px 0 0 12px;">{img("ic" + str(i + 1), 44, title)}
<p style="margin:6px 0 0 0;font-family:{FONT};font-size:30px;font-weight:bold;color:#ff4d4d;text-align:center;width:44px;">{n}</p></td>
<td valign="top" style="padding:16px 18px 16px 14px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td style="font-family:{FONT};font-size:18px;font-weight:bold;color:#ffffff;">{e(title)}</td>
<td align="right" style="font-family:{FONT};font-size:13px;font-weight:bold;color:{GOLD};white-space:nowrap;">{e(rank)}</td></tr></table>
{p(tag, 14, GOLD, True, mb=6)}{p(d1, 14, "#ffffff", mb=4)}{p(d2, 13, LIGHT, mb=0)}</td></tr></table></td></tr>''')
    rows.append(sec(p(t['models_t'], 22, '#ffffff', True, mb=2, lh=1.3) + p(t['models_t2'], 14, GOLD, italic=True, mb=14)
                    + f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0">{"".join(cards)}</table>', pad='8px 28px 10px 28px'))

    # contact bar (same as flyer)
    rows.append(sec(f'''<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:10px;"><tr>
<td style="padding:12px 16px;font-family:{FONT};font-size:15px;font-weight:bold;color:{NAVY};">{e(t["contact"])}: CEO Mario Parlitz · <a href="tel:+491772711123" style="color:{NAVY};text-decoration:none;">📱 {PHONE}</a> · <a href="mailto:{MAIL}" style="color:{RED};text-decoration:none;">{MAIL}</a></td>
<td width="64" style="padding:6px 8px 6px 0;">{img("qr_mario", 56, "WeChat")}</td></tr></table>''', pad='0 28px 18px 28px'))

    # advantages
    adv = ''.join(f'''<tr><td style="padding:0 0 10px 0;">{p("✓ " + h, 15, "#ffffff", True, mb=2)}{p(d, 13, LIGHT, mb=0)}</td></tr>''' for h, d in t['adv'])
    rows.append(sec(f'<div style="border-top:3px solid {RED};padding-top:16px;">' + p(t['adv_t'], 21, GOLD, True, mb=2)
                    + p(t['adv_sub'], 13, GOLD, italic=True, mb=12)
                    + f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0">{adv}</table></div>', pad='4px 28px 8px 28px'))

    # warehouses
    whc = lambda k, a, b: f'''<td width="33%" align="center" valign="top" style="padding:6px;">{img(k, 110, a, "margin:0 auto;background:#ffffff;padding:6px;")}
{p(a, 13, "#ffffff", True, mb=0, align="center")}{p(b, 12, LIGHT, mb=0, align="center")}</td>'''
    rows.append(sec(p(t['wh_t'], 14, '#ffffff', align='center', mb=10)
                    + f'''<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>{whc("qr_central", *t["wh"][0])}
<td width="33%" align="center" valign="middle">{p(t["wh_more"], 13, "#ffffff", True, align="center", mb=0)}</td>{whc("qr_frankfurt", *t["wh"][1])}</tr></table>''',
                    pad='10px 28px 16px 28px'))

    # MapaTec box
    rows.append(sec(f'''<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;"><tr>
<td width="130" valign="middle" style="padding:14px;">{img("mapatec", 120, "MapaTec")}</td>
<td valign="middle" style="padding:14px 6px;">{p(t["mt_t"], 17, NAVY, True, mb=4)}{p(t["mt_1"], 13, RED, True, mb=4)}{p(t["mt_2"], 13, NAVY, mb=4)}{p(t["mt_3"] + " →", 13, NAVY, True, mb=0)}</td>
<td width="96" valign="middle" style="padding:14px 14px 14px 4px;">{img("qr_frank", 88, "WeChat Frank Matysik")}</td></tr></table>''', pad='4px 28px 20px 28px'))

    # final CTA + footer
    rows.append(sec(f'''<table role="presentation" align="center" cellpadding="0" cellspacing="0"><tr><td style="background:{RED};border-radius:24px;">
<a href="{e(mailto)}" style="display:inline-block;padding:12px 30px;font-family:{FONT};font-size:16px;font-weight:bold;color:#ffffff;text-decoration:none;">{e(t["button"])} →</a></td></tr></table>''', pad='0 28px 22px 28px'))
    rows.append(f'''<tr><td style="background:#071634;padding:16px 28px;">
<p style="margin:0;font-family:{FONT};font-size:13px;color:{LIGHT};text-align:center;line-height:1.6;">Komplett Konzept · MapaTec<br>CEO Mario Parlitz · {PHONE} · <a href="mailto:{MAIL}" style="color:{GOLD};">{MAIL}</a> · <a href="https://www.komplett-konzept.de" style="color:{GOLD};">www.komplett-konzept.de</a></p></td></tr>''')

    doc = f'''<!doctype html><html lang="{'zh' if lang == 'CN' else 'de'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{e(t["subject"])}</title></head>
<body style="margin:0;padding:0;background:#e9edf5;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">{e(t["preheader"])}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#e9edf5;"><tr><td align="center" style="padding:20px 8px;">
<table role="presentation" width="640" cellpadding="0" cellspacing="0" style="width:640px;max-width:100%;background:{NAVY};border-radius:6px;overflow:hidden;">
{"".join(rows)}
</table></td></tr></table></body></html>'''

    # plain-text alternative
    txt = [t['headline'], t['headline2'], '', t['intro'], t['intro2'], '', t['visit_t'], t['visit_t2'], t['visit_p'], t['visit_p2']]
    txt += [f'- {n} ({c}): {d}' for n, c, d in t['fairs']] + ['', t['reg_t'], t['reg_p'], t['reg_p2']]
    txt += [f'  {f}: ____' for f in t['fields']] + [f'  {t["fair_field"]}', '', f'-> {MAIL}', t['reply'], '']
    for n, title, rank, tag, d1, d2 in t['models']:
        txt += [f'{n}. {title} ({rank})', tag, d1, d2, '']
    txt += [t['adv_t']] + [f'✓ {h}: {d}' for h, d in t['adv']] + ['', f'{t["contact"]}: CEO Mario Parlitz · {PHONE} · {MAIL}', 'www.komplett-konzept.de']
    return t['subject'], doc, '\n'.join(s for s in txt if s is not None)


def main(langs):
    files = prep_images()
    for lang in langs:
        # self-contained preview: images embedded as data URIs, so the file works on its own
        rel = {k: 'data:%s;base64,%s' % (mimetypes.guess_type(v)[0], base64.b64encode(open(v, 'rb').read()).decode()) for k, v in files.items()}
        subject, doc, txt = build(lang, rel)
        open(os.path.join(HERE, f'email_{lang}.html'), 'w').write(doc)
        cids = {k: make_msgid(domain='komplett-konzept.de') for k in files}
        subject, doc_cid, txt = build(lang, {k: 'cid:' + v[1:-1] for k, v in cids.items()})
        msg = EmailMessage()
        msg['Subject'] = subject
        msg['X-Unsent'] = '1'          # Outlook opens it as a new, unsent message
        msg.set_content(txt)
        msg.add_alternative(doc_cid, subtype='html')
        part = msg.get_payload()[1]
        for k, path in files.items():
            mt = mimetypes.guess_type(path)[0].split('/')
            part.add_related(open(path, 'rb').read(), maintype=mt[0], subtype=mt[1], cid=cids[k], filename=os.path.basename(path))
        open(os.path.join(HERE, f'email_{lang}.eml'), 'wb').write(bytes(msg))
        print(lang, 'ok', os.path.getsize(os.path.join(HERE, f'email_{lang}.eml')) // 1024, 'KB')


if __name__ == '__main__':
    main(sys.argv[1:] or ['CN', 'DE'])
