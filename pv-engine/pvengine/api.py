"""FastAPI-Service — REST-Schnittstelle der Engine.

Endpunkte:
    GET  /health           Healthcheck
    POST /calculate        ProjectInput → ProjectResult (JSON)
    POST /report.html      ProjectInput → HTML-Report
    POST /report.pdf       ProjectInput → PDF (oder HTML-Fallback)
    GET  /eeg?kwp=&date=   aktueller EEG-Satz

Start:  uvicorn pvengine.api:app --reload
"""
from __future__ import annotations

import tempfile
from datetime import date
from pathlib import Path

from fastapi import FastAPI, Query
from fastapi.responses import FileResponse, HTMLResponse

from . import report
from .config import eeg_feed_in_ct_kwh
from .models import ProjectInput, ProjectResult
from .pipeline import run

app = FastAPI(
    title="PV-Planungs-Engine",
    version="0.1.0",
    description="Eigene Ertrags-, Wirtschaftlichkeits- und Report-Engine (pvlib).",
)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "engine": "pvengine", "version": "0.1.0"}


@app.post("/calculate", response_model=ProjectResult)
def calculate(project: ProjectInput, network: bool = Query(True)) -> ProjectResult:
    return run(project, allow_network=network)


@app.post("/report.html", response_class=HTMLResponse)
def report_html(project: ProjectInput, network: bool = Query(True)) -> str:
    result = run(project, allow_network=network)
    return report.render_html(result)


@app.post("/report.pdf")
def report_pdf(project: ProjectInput, network: bool = Query(True)):
    result = run(project, allow_network=network)
    tmp = Path(tempfile.mkdtemp()) / "pv-report.pdf"
    path = report.render_pdf(result, tmp)
    media = "application/pdf" if path.suffix == ".pdf" else "text/html"
    return FileResponse(str(path), media_type=media, filename=path.name)


@app.get("/eeg")
def eeg(kwp: float = Query(10.0, gt=0),
        on: str | None = Query(None, description="Inbetriebnahme YYYY-MM-DD")) -> dict:
    commissioning = date.fromisoformat(on) if on else date.today()
    return {
        "kwp": kwp,
        "commissioning": commissioning.isoformat(),
        "feed_in_ct_kwh": round(eeg_feed_in_ct_kwh(kwp, commissioning), 3),
    }
