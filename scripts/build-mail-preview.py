#!/usr/bin/env python3
"""Baut aus marketing/cold-email-adept.html die Vorschau-Seite.

Die Mail-Datei enthaelt zwei Fassungen: sichtbar die Industrie-Fassung, in
Kommentaren daneben die E-Commerce-Fassung. Markiert ist das so:

    <!--@ind:start--> ...sichtbar... <!--@ind:end-->
    <!--@ecom:start   ...auskommentiert... @ecom:end-->

Dieses Skript loest die Marker auf, setzt Beispieldaten fuer die Platzhalter
ein und schreibt marketing/preview-cold-email-adept.html - eine Seite, die
beide Fassungen in Desktop/Mobil und Hell/Dunkel zeigt.

    python3 scripts/build-mail-preview.py
"""

from __future__ import annotations

import base64
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "marketing" / "cold-email-adept.html"
TARGET = ROOT / "marketing" / "preview-cold-email-adept.html"

# Paar aus sichtbarem Industrie-Block und auskommentiertem E-Commerce-Block.
PAIR = re.compile(
    r"<!--@ind:start-->(?P<ind>.*?)<!--@ind:end-->\s*"
    r"<!--@ecom:start(?P<ecom>.*?)@ecom:end-->",
    re.S,
)

# Beispieldaten nur fuer die Vorschau - die Mail selbst behaelt die Platzhalter.
DEMO = {
    "vorname": "Frau Berger",
    "firma": "Meridian Fertigung",
    "aufhaenger": "Ihr Beitrag zur neuen Fertigungslinie in Ense",
}

# Die Vorschau laeuft unter einer CSP, die externe Hosts blockt. Die beiden
# Logo-Dateien werden deshalb aus marketing/assets/ als data-URI eingebettet.
LOGOS = {
    "https://www.adeptandpartners.de/mail/adept-logo@2x.png": ROOT / "marketing" / "assets" / "adept-logo@2x.png",
    "https://www.adeptandpartners.de/mail/adept-logo-invers@2x.png": ROOT / "marketing" / "assets" / "adept-logo-invers@2x.png",
}


def inline_logos(html: str) -> str:
    for url, path in LOGOS.items():
        data = base64.b64encode(path.read_bytes()).decode("ascii")
        html = html.replace(url, f"data:image/png;base64,{data}")
    return html


# Meldet die Hoehe an die Vorschau-Seite. Steckt nur in der Vorschau-Kopie,
# nie in der Mail, die verschickt wird.
HEIGHT_REPORTER = """
<script>
(function () {
  function post() {
    parent.postMessage({ mailPreviewHeight: document.documentElement.scrollHeight }, '*');
  }
  window.addEventListener('load', post);
  window.addEventListener('resize', post);
  post();
})();
</script>
"""


def js(value) -> str:
    """JSON fuer ein inline <script>.

    Die Frames enthalten selbst ein </script>. Ohne Maskierung beendet der
    HTML-Parser dort das Skript und der Rest der Seite landet als Text im
    Browser. \/ ist in JSON-Strings gleichbedeutend mit /.
    """
    return json.dumps(value).replace("</", "<\\/")


def variant(html: str, which: str) -> str:
    """Loest die Marker fuer 'ind' oder 'ecom' auf."""
    return PAIR.sub(lambda m: m.group(which), html)


def force_dark(html: str) -> str:
    """Hebt die prefers-color-scheme-Regeln auf oberste Ebene.

    Ein iframe folgt dem OS-Theme, nicht dem Umschalter auf der Seite. Fuer die
    Dunkel-Vorschau werden die Dark-Mode-Regeln deshalb unbedingt gesetzt.
    """
    marker = "@media (prefers-color-scheme: dark) {"
    start = html.index(marker)
    depth, i = 0, start + len(marker) - 1
    while True:  # passende schliessende Klammer suchen
        if html[i] == "{":
            depth += 1
        elif html[i] == "}":
            depth -= 1
            if depth == 0:
                break
        i += 1
    rules = html[start + len(marker) : i]
    return html[: i + 1] + "\n" + rules + "\n" + html[i + 1 :]


def fill(html: str) -> str:
    return re.sub(r"\{\{(\w+)\}\}", lambda m: DEMO.get(m.group(1), m.group(0)), html)


def subject_and_preheader(html: str) -> tuple[str, str]:
    subject = re.search(r"<title>(.*?)</title>", html, re.S).group(1).strip()
    body = re.search(r"mso-hide:all;\">(.*?)</div>", html, re.S).group(1)
    preheader = re.sub(r"&#8203;|\s+", lambda m: "" if "8203" in m.group(0) else " ", body)
    return subject, preheader.strip()


def main() -> None:
    source = SOURCE.read_text(encoding="utf-8")

    frames, meta = {}, {}
    for key in ("ind", "ecom"):
        mail = variant(source, key)
        meta[key] = {
            "subject": subject_and_preheader(fill(mail))[0],
            "preheader": subject_and_preheader(fill(mail))[1],
            "bytes": len(mail.encode("utf-8")),
        }
        preview = fill(mail).replace("</body>", HEIGHT_REPORTER + "</body>")
        preview = inline_logos(preview)
        frames[f"{key}-hell"] = preview
        frames[f"{key}-dunkel"] = force_dark(preview)

    placeholders = sorted(set(re.findall(r"\{\{(\w+)\}\}", source)))

    TARGET.write_text(
        PAGE.replace("__FRAMES__", js(frames))
        .replace("__META__", js(meta))
        .replace("__PLACEHOLDERS__", js(placeholders)),
        encoding="utf-8",
    )
    print(f"geschrieben: {TARGET.relative_to(ROOT)}")
    for key, info in meta.items():
        print(f"  {key}: {info['bytes']} Bytes · {info['subject']}")


PAGE = """<title>adept& Cold Mail</title>
<style>
  :root {
    --ground:   #EAE6E0;
    --panel:    #FDFCFA;
    --sunk:     #DFD9D1;
    --ink:      #2E2A28;
    --ink-soft: #5F5751;
    --muted:    #8A817C;
    --accent:   #574D49;
    --hairline: #D8D0C6;
    --radius:   3px;
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      --ground:   #15120F;
      --panel:    #1F1B17;
      --sunk:     #100E0B;
      --ink:      #EDE7E0;
      --ink-soft: #BFB6AC;
      --muted:    #93897F;
      --accent:   #C9BFB4;
      --hairline: #322C25;
    }
  }
  :root[data-theme="dark"] {
    --ground:   #15120F;
    --panel:    #1F1B17;
    --sunk:     #100E0B;
    --ink:      #EDE7E0;
    --ink-soft: #BFB6AC;
    --muted:    #93897F;
    --accent:   #C9BFB4;
    --hairline: #322C25;
  }

  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: var(--ground);
    color: var(--ink);
    font-family: ui-sans-serif, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    font-size: 15px;
    line-height: 1.55;
    -webkit-font-smoothing: antialiased;
  }
  .shell {
    max-width: 980px;
    margin: 0 auto;
    padding: 32px 20px 64px;
    display: flex;
    flex-direction: column;
    gap: 22px;
  }

  header { display: flex; flex-direction: column; gap: 5px; }
  .mark {
    font-size: 25px;
    font-weight: 650;
    letter-spacing: -0.035em;
    color: var(--accent);
  }
  .kicker {
    font-size: 11px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--muted);
  }

  .bar {
    display: flex;
    flex-wrap: wrap;
    gap: 18px 26px;
    padding: 14px 16px;
    background: var(--panel);
    border: 1px solid var(--hairline);
    border-radius: var(--radius);
  }
  .group { display: flex; flex-direction: column; gap: 7px; }
  .group > span {
    font-size: 10px;
    letter-spacing: 0.13em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .seg { display: flex; border: 1px solid var(--hairline); border-radius: var(--radius); overflow: hidden; }
  .seg button {
    appearance: none;
    border: 0;
    background: transparent;
    color: var(--ink-soft);
    font: inherit;
    font-size: 13.5px;
    padding: 6px 15px;
    cursor: pointer;
    transition: background .14s ease, color .14s ease;
  }
  .seg button + button { border-left: 1px solid var(--hairline); }
  .seg button:hover { background: var(--sunk); }
  .seg button[aria-pressed="true"] { background: var(--accent); color: var(--panel); }
  .seg button:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }

  .inbox {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 4px 14px;
    padding: 15px 17px;
    background: var(--panel);
    border: 1px solid var(--hairline);
    border-radius: var(--radius);
    font-size: 14px;
  }
  .inbox dt {
    font-size: 10px;
    letter-spacing: 0.13em;
    text-transform: uppercase;
    color: var(--muted);
    padding-top: 4px;
  }
  .inbox dd { margin: 0; }
  .subject { font-weight: 600; }
  .preheader { color: var(--muted); }

  .stage {
    background: var(--sunk);
    border: 1px solid var(--hairline);
    border-radius: var(--radius);
    padding: 26px 16px;
    display: flex;
    justify-content: center;
    overflow-x: auto;
  }
  iframe {
    width: 640px;
    max-width: 100%;
    height: 1400px;
    border: 1px solid var(--hairline);
    border-radius: 2px;
    background: #fff;
    display: block;
    transition: width .2s ease;
  }
  iframe.mobil { width: 390px; }

  footer {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 12.5px;
    color: var(--muted);
  }
  footer code {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 12px;
    color: var(--ink-soft);
  }
  .size { font-variant-numeric: tabular-nums; }
  @media (prefers-reduced-motion: reduce) {
    * { transition: none !important; }
  }
</style>

<div class="shell">
  <header>
    <div class="mark">adept&amp;</div>
    <div class="kicker">Cold Mail &middot; Vorschau</div>
  </header>

  <div class="bar">
    <div class="group">
      <span>Fassung</span>
      <div class="seg" id="fassung">
        <button type="button" data-value="ind" aria-pressed="true">Industrie</button>
        <button type="button" data-value="ecom" aria-pressed="false">E-Commerce</button>
      </div>
    </div>
    <div class="group">
      <span>Ansicht</span>
      <div class="seg" id="ansicht">
        <button type="button" data-value="desktop" aria-pressed="true">Desktop</button>
        <button type="button" data-value="mobil" aria-pressed="false">Mobil</button>
      </div>
    </div>
    <div class="group">
      <span>Darstellung</span>
      <div class="seg" id="darstellung">
        <button type="button" data-value="hell" aria-pressed="true">Hell</button>
        <button type="button" data-value="dunkel" aria-pressed="false">Dunkel</button>
      </div>
    </div>
  </div>

  <dl class="inbox">
    <dt>Betreff</dt>
    <dd class="subject" id="subject"></dd>
    <dt>Vorschau</dt>
    <dd class="preheader" id="preheader"></dd>
  </dl>

  <div class="stage">
    <iframe id="frame" title="Vorschau der Cold Mail" sandbox="allow-scripts"></iframe>
  </div>

  <footer>
    <div>Vorschau mit Beispieldaten. Im Versand stehen dort die Platzhalter: <code id="placeholders"></code></div>
    <div class="size" id="size"></div>
  </footer>
</div>

<script>
  const FRAMES = __FRAMES__;
  const META = __META__;
  const PLACEHOLDERS = __PLACEHOLDERS__;

  const state = { fassung: 'ind', ansicht: 'desktop', darstellung: 'hell' };
  const frame = document.getElementById('frame');

  document.getElementById('placeholders').textContent = PLACEHOLDERS.map(p => '{{' + p + '}}').join('  ');

  function render() {
    const info = META[state.fassung];
    document.getElementById('subject').textContent = info.subject;
    document.getElementById('preheader').textContent = info.preheader;
    document.getElementById('size').textContent =
      info.bytes.toLocaleString('de-DE') + ' Bytes \\u00b7 Gmail k\\u00fcrzt ab 102.400 Bytes';
    frame.classList.toggle('mobil', state.ansicht === 'mobil');
    frame.srcdoc = FRAMES[state.fassung + '-' + state.darstellung];
  }

  for (const id of ['fassung', 'ansicht', 'darstellung']) {
    document.getElementById(id).addEventListener('click', (event) => {
      const button = event.target.closest('button');
      if (!button) return;
      state[id] = button.dataset.value;
      for (const sibling of button.parentElement.children) {
        sibling.setAttribute('aria-pressed', String(sibling === button));
      }
      render();
    });
  }

  window.addEventListener('message', (event) => {
    const height = event.data && event.data.mailPreviewHeight;
    if (typeof height === 'number' && height > 200) frame.style.height = height + 'px';
  });

  render();
</script>
"""


if __name__ == "__main__":
    main()
