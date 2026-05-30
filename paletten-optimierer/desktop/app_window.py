"""Hauptfenster der Youman Desktop-App.

Layout:
  ┌──────────┬───────────────────────────────┐
  │ Sidebar  │  Topbar (Logo + Build-Stempel)│
  │ (Tabs)   ├───────────────────────────────┤
  │          │                               │
  │          │  Aktuelles Tab                │
  │          │                               │
  └──────────┴───────────────────────────────┘
"""
from __future__ import annotations

import base64
from pathlib import Path

import customtkinter as ctk

from . import theme as t


# Edition / Tab-Reihenfolge (gleiche Reihenfolge wie in Streamlit-App)
BASIC_TABS = [
    "Dashboard", "Datenimport", "Optimierung",
    "Ergebnisse", "Katalog", "Aufträge",
]


class _SidebarButton(ctk.CTkFrame):
    """Einzelner Sidebar-Eintrag mit Hover + aktiv-Indikator."""

    def __init__(self, parent, label: str, on_click, **kwargs):
        super().__init__(parent, fg_color=t.BG_SIDEBAR,
                          corner_radius=0, height=40, **kwargs)
        self._on_click = on_click
        self._aktiv = False
        # Linke aktiv-Linie
        self._line = ctk.CTkFrame(self, fg_color="transparent",
                                     width=3, corner_radius=0)
        self._line.pack(side="left", fill="y")
        self._lbl = ctk.CTkLabel(
            self, text=label,
            font=ctk.CTkFont(family=t.FONT_FAMILY[0], size=14, weight="normal"),
            text_color=t.TEXT_MUTED_DARK, anchor="w",
        )
        self._lbl.pack(side="left", fill="both", expand=True,
                        padx=(14, 0))
        self.label = label
        for w in (self, self._lbl):
            w.bind("<Button-1>", lambda e: self._on_click(self.label))
            w.bind("<Enter>", lambda e: self._hover(True))
            w.bind("<Leave>", lambda e: self._hover(False))
        self.configure(cursor="hand2")

    def _hover(self, on: bool) -> None:
        if self._aktiv:
            return
        col = t.BG_SIDEBAR_HOVER if on else t.BG_SIDEBAR
        self.configure(fg_color=col)
        self._lbl.configure(fg_color=col)

    def set_aktiv(self, aktiv: bool) -> None:
        self._aktiv = aktiv
        if aktiv:
            self.configure(fg_color=t.BG_SIDEBAR_HOVER)
            self._lbl.configure(fg_color=t.BG_SIDEBAR_HOVER,
                                  text_color=t.TEXT_ON_DARK,
                                  font=ctk.CTkFont(family=t.FONT_FAMILY[0],
                                                     size=14, weight="bold"))
            self._line.configure(fg_color=t.ACCENT)
        else:
            self.configure(fg_color=t.BG_SIDEBAR)
            self._lbl.configure(fg_color=t.BG_SIDEBAR,
                                  text_color=t.TEXT_MUTED_DARK,
                                  font=ctk.CTkFont(family=t.FONT_FAMILY[0],
                                                     size=14))
            self._line.configure(fg_color="transparent")


class YoumanApp(ctk.CTk):
    """Hauptfenster der App."""

    def __init__(self) -> None:
        ctk.set_appearance_mode("light")
        super().__init__(fg_color=t.BG_MAIN)
        self.title(t.WIN_TITLE)
        self.geometry(f"{t.WIN_WIDTH}x{t.WIN_HEIGHT}")
        self.minsize(t.WIN_MIN_W, t.WIN_MIN_H)

        # Icon (PhotoImage aus PNG)
        self._set_icon()

        # Layout: 2 Spalten
        self.grid_columnconfigure(0, weight=0, minsize=220)
        self.grid_columnconfigure(1, weight=1)
        self.grid_rowconfigure(0, weight=1)

        # Sidebar
        self._sidebar = ctk.CTkFrame(self, fg_color=t.BG_SIDEBAR,
                                        corner_radius=0, width=220)
        self._sidebar.grid(row=0, column=0, sticky="nsw")
        self._sidebar.grid_propagate(False)
        self._build_sidebar()

        # Content-Bereich
        self._content = ctk.CTkFrame(self, fg_color=t.BG_MAIN,
                                        corner_radius=0)
        self._content.grid(row=0, column=1, sticky="nsew")
        self._content.grid_rowconfigure(1, weight=1)
        self._content.grid_columnconfigure(0, weight=1)

        # Topbar
        self._topbar = ctk.CTkFrame(self._content, fg_color=t.BG_MAIN,
                                       corner_radius=0, height=60)
        self._topbar.grid(row=0, column=0, sticky="ew",
                            padx=t.PAD_L, pady=(t.PAD_L, t.PAD_M))
        self._build_topbar()

        # Tab-Container (Inhalt)
        self._tab_container = ctk.CTkFrame(self._content,
                                              fg_color=t.BG_MAIN,
                                              corner_radius=0)
        self._tab_container.grid(row=1, column=0, sticky="nsew",
                                    padx=t.PAD_L, pady=(0, t.PAD_L))

        # Tab-Instanzen werden hier gehalten
        self._tabs: dict[str, ctk.CTkFrame] = {}
        self._aktiver_tab: str | None = None
        self._build_tabs()

        # Default-Tab
        self.zeige_tab("Dashboard")

    # ------------------------------------------------------------------
    # Icon
    # ------------------------------------------------------------------
    def _set_icon(self) -> None:
        # Sucht das Logo
        kandidaten = [
            Path(__file__).resolve().parent / "assets" / "youman_logo.png",
            Path(__file__).resolve().parent.parent / "assets" / "youman_logo.png",
        ]
        import sys as _sys
        meipass = getattr(_sys, "_MEIPASS", None)
        if meipass:
            kandidaten.append(Path(meipass) / "assets" / "youman_logo.png")
        for p in kandidaten:
            if p.exists():
                try:
                    img = ctk.CTkImage(light_image=__import__("PIL.Image",
                                                              fromlist=["Image"]).open(p),
                                        size=(64, 32))
                    # Wirklich gesetzt wird ueber wm_iconphoto
                    from PIL import ImageTk, Image
                    self._icon_img = ImageTk.PhotoImage(Image.open(p))
                    self.iconphoto(True, self._icon_img)
                except Exception:
                    pass
                return

    # ------------------------------------------------------------------
    # Sidebar mit Logo + Tab-Buttons + Footer
    # ------------------------------------------------------------------
    def _build_sidebar(self) -> None:
        # Logo-Bereich
        logo_frame = ctk.CTkFrame(self._sidebar, fg_color=t.BG_SIDEBAR,
                                     corner_radius=0, height=80)
        logo_frame.pack(fill="x", padx=t.PAD_M, pady=(t.PAD_L, t.PAD_M))

        try:
            from PIL import Image
            kandidaten = [
                Path(__file__).resolve().parent / "assets" / "youman_logo.png",
                Path(__file__).resolve().parent.parent / "assets" / "youman_logo.png",
            ]
            import sys as _sys
            meipass = getattr(_sys, "_MEIPASS", None)
            if meipass:
                kandidaten.append(Path(meipass) / "assets" / "youman_logo.png")
            for p in kandidaten:
                if p.exists():
                    img = ctk.CTkImage(light_image=Image.open(p),
                                         dark_image=Image.open(p),
                                         size=(180, 54))
                    lbl = ctk.CTkLabel(logo_frame, text="", image=img)
                    lbl.pack(pady=(8, 0))
                    break
            else:
                ctk.CTkLabel(logo_frame, text="Youman",
                               font=ctk.CTkFont(family=t.FONT_FAMILY[0],
                                                  size=22, weight="bold"),
                               text_color=t.TEXT_ON_DARK).pack(pady=8)
        except Exception:
            ctk.CTkLabel(logo_frame, text="Youman",
                           font=ctk.CTkFont(family=t.FONT_FAMILY[0],
                                              size=22, weight="bold"),
                           text_color=t.TEXT_ON_DARK).pack(pady=8)

        # Trennlinie
        sep = ctk.CTkFrame(self._sidebar, fg_color="#1e3a5f",
                             height=1, corner_radius=0)
        sep.pack(fill="x", pady=(0, t.PAD_M))

        # Workflow-Header
        ctk.CTkLabel(
            self._sidebar, text="WORKFLOW",
            font=ctk.CTkFont(family=t.FONT_FAMILY[0], size=10, weight="bold"),
            text_color=t.TEXT_LIGHT, anchor="w",
        ).pack(fill="x", padx=t.PAD_M + 4, pady=(0, t.PAD_S))

        # Tab-Buttons
        self._sidebar_btns: dict[str, _SidebarButton] = {}
        for label in BASIC_TABS:
            btn = _SidebarButton(self._sidebar, label,
                                   on_click=self.zeige_tab)
            btn.pack(fill="x")
            self._sidebar_btns[label] = btn

        # Footer: Edition + Speicherort
        footer = ctk.CTkFrame(self._sidebar, fg_color=t.BG_SIDEBAR,
                                corner_radius=0)
        footer.pack(side="bottom", fill="x", padx=t.PAD_M,
                     pady=(t.PAD_M, t.PAD_M))

        ctk.CTkLabel(
            footer, text="Edition: Basic · 6 Tabs",
            font=ctk.CTkFont(family=t.FONT_FAMILY[0], size=10),
            text_color=t.TEXT_LIGHT, anchor="w",
        ).pack(fill="x")
        ctk.CTkLabel(
            footer, text="~/.palettenmini/",
            font=ctk.CTkFont(family="Consolas", size=10),
            text_color=t.TEXT_LIGHT, anchor="w",
        ).pack(fill="x")

    # ------------------------------------------------------------------
    # Topbar
    # ------------------------------------------------------------------
    def _build_topbar(self) -> None:
        self._topbar.grid_columnconfigure(0, weight=1)
        self._topbar.grid_columnconfigure(1, weight=0)

        left = ctk.CTkFrame(self._topbar, fg_color=t.BG_MAIN)
        left.grid(row=0, column=0, sticky="w")

        self._topbar_title = ctk.CTkLabel(
            left, text="Dashboard",
            font=ctk.CTkFont(family=t.FONT_FAMILY[0],
                               size=t.FONT_TITLE_SIZE, weight="bold"),
            text_color=t.PRIMARY,
        )
        self._topbar_title.pack(anchor="w")
        self._topbar_sub = ctk.CTkLabel(
            left, text="Industriepaletten · Standardisierung",
            font=ctk.CTkFont(family=t.FONT_FAMILY[0], size=t.FONT_BODY_SIZE),
            text_color=t.TEXT_MEDIUM,
        )
        self._topbar_sub.pack(anchor="w")

        # Build-Stempel rechts
        try:
            import sys as _sys
            mini = Path(__file__).resolve().parent.parent / "mini"
            if str(mini) not in _sys.path:
                _sys.path.insert(0, str(mini))
            try:
                from _build_info import BUILD_SHA, BUILD_VERSION  # type: ignore
                stamp = f"v{BUILD_VERSION} · {BUILD_SHA}"
            except ImportError:
                stamp = "v dev"
        except Exception:
            stamp = ""
        if stamp:
            self._stamp = ctk.CTkLabel(
                self._topbar, text=stamp,
                font=ctk.CTkFont(family="Consolas", size=10),
                text_color=t.TEXT_LIGHT,
                fg_color="#f3f4f6", corner_radius=4,
                padx=8, pady=4,
            )
            self._stamp.grid(row=0, column=1, sticky="e", padx=(0, 4))

    # ------------------------------------------------------------------
    # Tabs
    # ------------------------------------------------------------------
    def _build_tabs(self) -> None:
        # Lazy-Imports (Tabs ziehen ggf. ihre Engines mit)
        from .tabs.dashboard import DashboardTab
        from .tabs.import_tab import ImportTab
        from .tabs.optimierung import OptimierungTab
        from .tabs.ergebnisse import ErgebnisseTab
        from .tabs.katalog import KatalogTab
        from .tabs.auftraege import AuftraegeTab

        klassen = {
            "Dashboard":   DashboardTab,
            "Datenimport": ImportTab,
            "Optimierung": OptimierungTab,
            "Ergebnisse":  ErgebnisseTab,
            "Katalog":     KatalogTab,
            "Aufträge":    AuftraegeTab,
        }
        for label in BASIC_TABS:
            cls = klassen.get(label)
            if cls is None:
                tab = ctk.CTkFrame(self._tab_container, fg_color=t.BG_MAIN)
            else:
                try:
                    tab = cls(self._tab_container, app=self)
                except Exception as exc:
                    tab = self._fehler_tab(self._tab_container,
                                              f"{label}: {exc}")
            tab.grid(row=0, column=0, sticky="nsew")
            self._tabs[label] = tab

    def _fehler_tab(self, parent, msg: str) -> ctk.CTkFrame:
        f = ctk.CTkFrame(parent, fg_color=t.BG_MAIN)
        ctk.CTkLabel(
            f, text=f"⚠ Tab konnte nicht geladen werden:\n{msg}",
            font=ctk.CTkFont(family=t.FONT_FAMILY[0], size=12),
            text_color=t.RED,
        ).pack(pady=t.PAD_L)
        return f

    def zeige_tab(self, label: str) -> None:
        if label not in self._tabs:
            return
        # Aktiver-Zustand der Sidebar-Buttons
        for nm, btn in self._sidebar_btns.items():
            btn.set_aktiv(nm == label)
        # Tab umschalten
        for nm, frame in self._tabs.items():
            if nm == label:
                frame.tkraise()
            else:
                frame.lower()
        self._topbar_title.configure(text=label)
        self._aktiver_tab = label

        # Tab kann ein on_show()-Hook haben fuer Live-Refresh
        target = self._tabs.get(label)
        if target is not None and hasattr(target, "on_show"):
            try:
                target.on_show()
            except Exception:
                pass


def starte() -> int:
    app = YoumanApp()
    app.mainloop()
    return 0


if __name__ == "__main__":
    raise SystemExit(starte())
