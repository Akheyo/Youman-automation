"""Tests für die Suchbegriff-Generierung (LLM gemockt) und das Ranking."""
from __future__ import annotations

import json

from core import llm, search
from sources.base import Hit, SearchTerms

LLM_RESPONSE = {
    "sprache": "Serbisch",
    "uebersetzung_de": "Ich brauche eine Maschine, die mit wechselbaren Köpfen "
                       "Dosen von 0,5 kg bis 5 kg halbautomatisch verschließen kann.",
    "maschinentyp": "Dosenverschließmaschine",
    "anforderungen": ["wechselbare Verschließköpfe", "0,5–5 kg Dosen", "halbautomatisch"],
    "referenz_hersteller": "Lanico",
    "referenz_modell": "UV 245",
    "budget": None,
    "suchbegriffe": {
        "exakt": ["Lanico UV 245"],
        "funktional": ["Dosenverschließmaschine", "can seamer", "Verschliessmaschine Dosen"],
    },
}


def test_analyze_request_with_mocked_llm(monkeypatch):
    monkeypatch.setattr(llm, "_call", lambda *a, **k: json.dumps(LLM_RESPONSE))
    result = llm.analyze_request(
        "Verpackungsmaschinen - Verschliessmaschinen",
        "Lanico UV 245",
        "Treba mi mašina ...",
    )
    assert result["sprache"] == "Serbisch"
    assert result["suchbegriffe"]["exakt"] == ["Lanico UV 245"]
    assert "can seamer" in result["suchbegriffe"]["funktional"]
    assert result["anforderungen"][0] == "wechselbare Verschließköpfe"


def test_analyze_request_handles_markdown_fenced_json(monkeypatch):
    fenced = "```json\n" + json.dumps(LLM_RESPONSE) + "\n```"
    monkeypatch.setattr(llm, "_call", lambda *a, **k: fenced)
    result = llm.analyze_request("Kat", "Lanico UV 245", "Text")
    assert result["suchbegriffe"]["exakt"] == ["Lanico UV 245"]


def test_analyze_request_falls_back_on_llm_error(monkeypatch):
    def boom(*a, **k):
        raise RuntimeError("API down")

    monkeypatch.setattr(llm, "_call", boom)
    result = llm.analyze_request(
        "Verpackungsmaschinen - Verschliessmaschinen", "Lanico UV 245", "Text"
    )
    # Fallback: Referenzmaschine als exakter Begriff, Kategorie als funktional
    assert result["suchbegriffe"]["exakt"] == ["Lanico UV 245"]
    assert "Verschliessmaschinen" in result["suchbegriffe"]["funktional"]
    assert result["uebersetzung_de"] == "Text"


def test_search_terms_dedup_and_limit():
    terms = SearchTerms(
        exact=["Lanico UV 245", "lanico uv 245"],
        functional=["can seamer", "Can Seamer", "Dosenverschließer"],
    )
    assert terms.all_terms() == ["Lanico UV 245", "can seamer", "Dosenverschließer"]
    assert terms.all_terms(limit=2) == ["Lanico UV 245", "can seamer"]


def test_ranking_exact_model_beats_category_and_own_stock_first():
    terms = SearchTerms(
        exact=["Lanico UV 245"],
        functional=["Dosenverschließmaschine"],
        kategorie="Verpackungsmaschinen - Verschliessmaschinen",
    )
    exact_hit = Hit(title="Lanico UV 245 Dosenverschließer", url="u1", source="eBay.de")
    type_hit = Hit(title="Dosenverschließmaschine halbautomatisch", url="u2", source="eBay.de")
    weak_hit = Hit(title="Verpackungsmaschinen Konvolut", url="u3", source="eBay.de")
    own_hit = Hit(title="Verschliessmaschine gebraucht", url="u4",
                  source="Eigener Bestand (Plenty)", own_stock=True)

    ranked = search.rank_hits([weak_hit, type_hit, exact_hit, own_hit], terms)

    assert ranked[0].own_stock  # eigener Bestand immer zuerst
    assert ranked[1].title.startswith("Lanico UV 245")
    assert ranked[1].score > ranked[2].score > ranked[3].score
