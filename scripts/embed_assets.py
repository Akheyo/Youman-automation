#!/usr/bin/env python3
"""Inline every assets/*.png reference in bingo-caller.html as base64 → standalone."""
import base64, re, os
HERE=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
html=open(os.path.join(HERE,"bingo-caller.html"),encoding="utf-8").read()
paths=sorted(set(re.findall(r"assets/[\w.-]+\.png", html)))
for p in paths:
    b=open(os.path.join(HERE,p),"rb").read()
    uri="data:image/png;base64,"+base64.b64encode(b).decode()
    html=html.replace(p, uri)
assert "assets/" not in html, "noch relative Pfade vorhanden!"
out=os.path.join(HERE,"bingo-caller-standalone.html")
open(out,"w",encoding="utf-8").write(html)
print("eingebettet:", paths)
print("standalone:", round(len(html)/1024), "KB")
