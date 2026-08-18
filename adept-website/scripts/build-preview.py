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
    pages[route] = html

# ---------------------------------------------------------------- Ausgabe
shell = open(os.path.join(ROOT, 'scripts', 'preview-shell.html'), encoding='utf-8').read()
payload = json.dumps({'css': css, 'pages': pages}, ensure_ascii=False).replace('</', '<\\/')
out = shell.replace('/*__PAYLOAD__*/', payload)

os.makedirs(OUT_DIR, exist_ok=True)
open(OUT, 'w', encoding='utf-8').write(out)

print(f'{len(pages)} Seiten eingebettet')
print(f'{OUT}  ({round(len(out)/1024)} KB)')
