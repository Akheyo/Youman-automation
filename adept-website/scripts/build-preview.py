#!/usr/bin/env python3
"""
Baut aus dem fertigen dist/-Ordner eine einzige, vollständig eigenständige
HTML-Datei: alle 19 Seiten, CSS und Schriften eingebettet, klickbare Navigation.

Ablauf:  npm run build  &&  python3 scripts/build-preview.py
Ausgabe: preview/adept-vorschau.html
"""
import base64, glob, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST = os.path.join(ROOT, 'dist')
OUT_DIR = os.path.join(ROOT, 'preview')
OUT = os.path.join(OUT_DIR, 'adept-vorschau.html')

if not os.path.isdir(DIST):
    sys.exit('dist/ fehlt – bitte zuerst "npm run build" ausführen.')

# ---------------------------------------------------------------- CSS + Fonts
css = open(glob.glob(f'{DIST}/_astro/*.css')[0], encoding='utf-8').read()

# Nur die für Deutsch nötigen Subsets einbetten; der Rest würde die Datei
# unnötig aufblähen.
KEEP = ('latin-wght', 'latin-ext-wght')

def sub_font(m):
    name = m.group(1)
    path = f'{DIST}/_astro/{name}'
    if not os.path.exists(path):
        return m.group(0)
    if not any(k in name for k in KEEP):
        return 'url(about:blank)'
    data = base64.b64encode(open(path, 'rb').read()).decode()
    return f'url(data:font/woff2;base64,{data})'

css = re.sub(r'url\(/_astro/([^)]+\.woff2)\)', sub_font, css)

def data_svg(path):
    return 'data:image/svg+xml;base64,' + base64.b64encode(open(path, 'rb').read()).decode()

poster = data_svg(f'{DIST}/hero-poster.svg')
favicon = data_svg(f'{DIST}/favicon.svg')

# --- Bilder und Video einbetten ---------------------------------------------
# Je Bild wird eine Aufloesung eingebettet - die groesste, damit die Vorschau
# dieselbe Schaerfe zeigt wie die ausgelieferte Seite.
import base64 as _b64
from functools import lru_cache

MIME = {'webp': 'image/webp', 'avif': 'image/avif', 'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg', 'png': 'image/png', 'mp4': 'video/mp4'}

@lru_cache(maxsize=None)
def data_uri(rel: str) -> str | None:
    pfad = os.path.join(DIST, rel.lstrip('/'))
    if not os.path.exists(pfad):
        return None
    endung = rel.rsplit('.', 1)[-1].lower()
    mime = MIME.get(endung)
    if not mime:
        return None
    return f'data:{mime};base64,' + _b64.b64encode(open(pfad, 'rb').read()).decode()


def groesste_variante(srcset: str) -> str | None:
    """Waehlt aus einem srcset die groesste Variante.

    Frueher wurde hier die 800px-Fassung genommen, um die Datei klein zu
    halten. Das hat vollflaechige Bilder in der Vorschau sichtbar unscharf
    gemacht, weil sie dort auf 1440px hochskaliert wurden - ein Fehler, der
    nur in der Vorschau auftrat und nicht auf der echten Seite.
    """
    eintraege = []
    for teil in srcset.split(','):
        teil = teil.strip()
        if not teil:
            continue
        stueck = teil.split()
        if len(stueck) != 2 or not stueck[1].endswith('w'):
            continue
        try:
            eintraege.append((int(stueck[1][:-1]), stueck[0]))
        except ValueError:
            continue
    if not eintraege:
        return None
    return sorted(eintraege)[-1][1]


def bilder_einbetten(html: str) -> str:
    def img_ersetzen(m):
        tag = m.group(0)
        ss = re.search(r'srcset="([^"]+)"', tag)
        if ss:
            gewaehlt = groesste_variante(ss.group(1))
            if gewaehlt:
                tag = re.sub(r'\ssrcset="[^"]*"', '', tag)
                tag = re.sub(r'\ssizes="[^"]*"', '', tag)
                tag = re.sub(r'src="[^"]*"', f'src="{gewaehlt}"', tag)
        return tag

    html = re.sub(r'<img\b[^>]*>', img_ersetzen, html)

    # Alle verbliebenen lokalen Verweise als Data-URI einsetzen
    def quelle_ersetzen(m):
        attr, url = m.group(1), m.group(2)
        d = data_uri(url)
        return f'{attr}="{d}"' if d else m.group(0)

    return re.sub(r'\b(src|poster)="(/[^"]+\.(?:webp|avif|jpg|jpeg|png|mp4))"',
                  quelle_ersetzen, html)


# ---------------------------------------------------------------- Seiten
pages = {}
for path in sorted(glob.glob(f'{DIST}/**/*.html', recursive=True)):
    route = '/' + os.path.relpath(path, DIST).replace('\\', '/')
    route = route.replace('/index.html', '') or '/'
    route = route.replace('/404.html', '/404')
    html = open(path, encoding='utf-8').read()
    # Stylesheet-Link raus – das CSS wird zur Laufzeit einmalig eingesetzt.
    html = re.sub(r'<link rel="stylesheet" href="/_astro/[^"]+"\s*/?>', '<!--CSS-->', html)
    html = html.replace('/hero-poster.svg', poster).replace('/favicon.svg', favicon)
    # WebM entfaellt in der Vorschau, MP4 genuegt und halbiert die Dateigroesse.
    html = re.sub(r'<source[^>]+\.webm[^>]*>', '', html)
    html = bilder_einbetten(html)
    pages[route] = html

# ---------------------------------------------------------------- Ausgabe
shell = open(os.path.join(ROOT, 'scripts', 'preview-shell.html'), encoding='utf-8').read()
payload = json.dumps({'css': css, 'pages': pages}, ensure_ascii=False).replace('</', '<\\/')
out = shell.replace('/*__PAYLOAD__*/', payload)

os.makedirs(OUT_DIR, exist_ok=True)
open(OUT, 'w', encoding='utf-8').write(out)

print(f'{len(pages)} Seiten eingebettet')
print(f'{OUT}  ({round(len(out)/1024)} KB)')
