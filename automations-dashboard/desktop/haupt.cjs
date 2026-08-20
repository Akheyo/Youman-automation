/**
 * Fenster für Windows. Die Oberfläche ist dieselbe wie im Browser, sie wird
 * hier nur in einem eigenen Fenster gezeigt, mit Eintrag im Startmenü.
 *
 * Die Zugangsdaten stehen entweder fest im Bündel (beim Bauen gesetzt) oder in
 * einer Datei neben den Einstellungen, damit ein neuer Schlüssel kein neues
 * Setup braucht.
 */

const { app, BrowserWindow, Menu, shell, protocol, net, dialog } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');

const OBERFLAECHE = path.join(__dirname, '..', 'dist');
const ANWENDUNG = 'app';

app.setName('Automationen');

protocol.registerSchemesAsPrivileged([
  { scheme: ANWENDUNG, privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

function datei(name) {
  return path.join(app.getPath('userData'), name);
}

function konfigurationLesen() {
  const pfad = datei('konfiguration.json');
  try {
    if (fs.existsSync(pfad)) {
      const inhalt = JSON.parse(fs.readFileSync(pfad, 'utf8'));
      return { url: inhalt.supabaseUrl ?? '', schluessel: inhalt.supabaseSchluessel ?? '', pfad };
    }
    fs.mkdirSync(path.dirname(pfad), { recursive: true });
    fs.writeFileSync(
      pfad,
      JSON.stringify(
        {
          _hinweis:
            'Nur der publishable Key (anon) gehört hier hinein. Den secret Key niemals eintragen.',
          supabaseUrl: 'https://cmijgibhncndxipfrtxl.supabase.co',
          supabaseSchluessel: '',
        },
        null,
        2,
      ),
      'utf8',
    );
  } catch (fehler) {
    console.error('Konfiguration konnte nicht gelesen werden:', fehler);
  }
  return { url: '', schluessel: '', pfad };
}

function fensterMasseLesen() {
  try {
    const inhalt = JSON.parse(fs.readFileSync(datei('fenster.json'), 'utf8'));
    if (Number.isFinite(inhalt.breite) && Number.isFinite(inhalt.hoehe)) return inhalt;
  } catch {
    /* Beim ersten Start gibt es noch nichts zu lesen. */
  }
  return { breite: 1320, hoehe: 900 };
}

function fensterMasseSchreiben(fenster) {
  try {
    const { width, height } = fenster.getNormalBounds();
    fs.writeFileSync(datei('fenster.json'), JSON.stringify({ breite: width, hoehe: height }), 'utf8');
  } catch {
    /* Wenn das nicht klappt, startet das Fenster eben in Standardgröße. */
  }
}

function menueBauen(fenster) {
  const vorlage = [
    {
      label: 'Datei',
      submenu: [
        {
          label: 'Neu laden',
          accelerator: 'CmdOrCtrl+R',
          click: () => fenster.webContents.reload(),
        },
        { type: 'separator' },
        { label: 'Beenden', accelerator: 'CmdOrCtrl+Q', role: 'quit' },
      ],
    },
    {
      label: 'Ansicht',
      submenu: [
        { label: 'Größer', accelerator: 'CmdOrCtrl+Plus', role: 'zoomIn' },
        { label: 'Kleiner', accelerator: 'CmdOrCtrl+-', role: 'zoomOut' },
        { label: 'Normale Größe', accelerator: 'CmdOrCtrl+0', role: 'resetZoom' },
        { type: 'separator' },
        { label: 'Vollbild', accelerator: 'F11', role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Hilfe',
      submenu: [
        {
          label: 'Einstellungsordner öffnen',
          click: () => shell.openPath(app.getPath('userData')),
        },
        {
          label: 'Über Automationen',
          click: () =>
            dialog.showMessageBox(fenster, {
              type: 'info',
              title: 'Über Automationen',
              message: `Automationen ${app.getVersion()}`,
              detail:
                'Internes Dashboard für alle Automationen des Unternehmens.\n' +
                `Einstellungen: ${app.getPath('userData')}`,
              buttons: ['Schließen'],
            }),
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(vorlage));
}

function fensterOeffnen() {
  const konfiguration = konfigurationLesen();
  const masse = fensterMasseLesen();

  const fenster = new BrowserWindow({
    width: masse.breite,
    height: masse.hoehe,
    minWidth: 380,
    minHeight: 560,
    backgroundColor: '#0a111e',
    title: 'Automationen',
    autoHideMenuBar: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'bruecke.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      additionalArguments: [
        `--automationen-konfiguration=${Buffer.from(
          JSON.stringify({
            url: konfiguration.url,
            schluessel: konfiguration.schluessel,
            einstellungspfad: konfiguration.pfad,
            version: app.getVersion(),
          }),
        ).toString('base64')}`,
      ],
    },
  });

  menueBauen(fenster);

  fenster.once('ready-to-show', () => fenster.show());
  fenster.on('close', () => fensterMasseSchreiben(fenster));

  /* Verweise nach draußen gehören in den normalen Browser, nicht in dieses Fenster. */
  fenster.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });
  fenster.webContents.on('will-navigate', (ereignis, ziel) => {
    if (!ziel.startsWith(`${ANWENDUNG}://`)) {
      ereignis.preventDefault();
      void shell.openExternal(ziel);
    }
  });

  void fenster.loadURL(`${ANWENDUNG}://oberflaeche/index.html`);
  return fenster;
}

const einzelstart = app.requestSingleInstanceLock();
if (!einzelstart) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const [vorhanden] = BrowserWindow.getAllWindows();
    if (vorhanden) {
      if (vorhanden.isMinimized()) vorhanden.restore();
      vorhanden.focus();
    }
  });

  app.whenReady().then(() => {
    /* Eigenes Schema statt file://, damit die Anmeldung sauber gespeichert wird. */
    protocol.handle(ANWENDUNG, (anfrage) => {
      const { pathname } = new URL(anfrage.url);
      const entpackt = decodeURIComponent(pathname);
      const ziel = path.join(OBERFLAECHE, entpackt);
      const innerhalb = path.normalize(ziel).startsWith(path.normalize(OBERFLAECHE));
      const endgueltig = innerhalb && fs.existsSync(ziel) && fs.statSync(ziel).isFile()
        ? ziel
        : path.join(OBERFLAECHE, 'index.html');
      return net.fetch(pathToFileURL(endgueltig).toString());
    });

    fensterOeffnen();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) fensterOeffnen();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
