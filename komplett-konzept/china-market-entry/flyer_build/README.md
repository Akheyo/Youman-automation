# Flyer-Build (HTML → PDF)

Canva war nicht mehr verbunden, daher werden die Flyer aus den letzten Canva-Layoutdaten (`*_p1.json`, `*_p2.json`)
als HTML nachgebaut und mit Chromium als PDF (A3, Vektortext) gedruckt.

```bash
mkdir -p fonts && for w in Regular Medium Bold; do
  curl -sSfL -o fonts/NotoSansSC-$w.otf "https://cdn.jsdelivr.net/gh/notofonts/noto-cjk@main/Sans/SubsetOTF/SC/NotoSansSC-$w.otf"; done
python3 gen.py                                   # erzeugt flyer_CN.html / flyer_DE.html
NODE_PATH=$(npm root -g) node print.js CN DE     # erzeugt flyer_CN.pdf / flyer_DE.pdf
```

Alle Text- und Layoutänderungen gegenüber Canva stehen in `gen.py` (`build()`).
