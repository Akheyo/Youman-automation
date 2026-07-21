# adept& – Einmal-Setup: Backend mit Supabase-Datenbank einrichten und starten.
# Ausführen per Doppelklick auf setup-windows.bat oder in PowerShell:
#   powershell -ExecutionPolicy Bypass -File .\setup-windows.ps1

$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $repo

function Invoke-Step {
    param([string]$Label, [scriptblock]$Command)
    Write-Host ""
    Write-Host ">> $Label" -ForegroundColor Cyan
    & $Command
    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "FEHLER bei: $Label (Exit-Code $LASTEXITCODE)" -ForegroundColor Red
        Write-Host "Bitte die Meldung oben kopieren und Claude schicken." -ForegroundColor Red
        Read-Host "Enter zum Beenden"
        exit 1
    }
}

Write-Host ""
Write-Host "=== adept& Backend-Setup ===" -ForegroundColor Cyan
Write-Host ""

# ── Voraussetzungen prüfen ────────────────────────────────────────────────────
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "FEHLER: Node.js ist nicht installiert. Bitte von https://nodejs.org (Version 20+) installieren und dieses Script erneut ausführen." -ForegroundColor Red
    Read-Host "Enter zum Beenden"
    exit 1
}
if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
    Write-Host "pnpm nicht gefunden - wird installiert..." -ForegroundColor Yellow
    # corepack braucht Admin-Rechte (schreibt nach C:\Program Files); npm -g
    # installiert nach %APPDATA%\npm und funktioniert ohne Admin.
    npm install -g pnpm@9
    $npmBin = Join-Path $env:APPDATA "npm"
    if (Test-Path $npmBin) { $env:Path = "$npmBin;$env:Path" }
    if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
        Write-Host "FEHLER: pnpm konnte nicht installiert werden. Bitte einmal manuell ausführen:  npm install -g pnpm@9" -ForegroundColor Red
        Read-Host "Enter zum Beenden"
        exit 1
    }
}

# ── .env anlegen (falls noch nicht vorhanden) ────────────────────────────────
$envFile = Join-Path $repo "apps\backend\.env"
if (Test-Path $envFile) {
    Write-Host ".env existiert bereits - wird unverändert weiterverwendet." -ForegroundColor Yellow
} else {
    Write-Host "Supabase-Datenbank-Passwort eingeben (ganz normal tippen,"
    Write-Host "Sonderzeichen wie ! ? werden automatisch korrekt kodiert):"
    $pwSecure = Read-Host -AsSecureString "Passwort"
    $pw = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($pwSecure))
    if ([string]::IsNullOrWhiteSpace($pw)) {
        Write-Host "FEHLER: Kein Passwort eingegeben." -ForegroundColor Red
        exit 1
    }
    $pwEnc = [uri]::EscapeDataString($pw)

    $chars = [char[]]([char]'A'..[char]'Z') + [char[]]([char]'a'..[char]'z') + [char[]]([char]'0'..[char]'9')
    $jwtSecret  = -join (1..48 | ForEach-Object { $chars | Get-Random })
    $jwtRefresh = -join (1..48 | ForEach-Object { $chars | Get-Random })

    @"
NODE_ENV=development
PORT=3001

DATABASE_URL=postgresql://postgres.fryexvyrakmjjzhdsepy:$pwEnc@aws-1-eu-west-2.pooler.supabase.com:5432/postgres?sslmode=require

JWT_SECRET=$jwtSecret
JWT_REFRESH_SECRET=$jwtRefresh
JWT_ACCESS_EXPIRY=1h
JWT_REFRESH_EXPIRY=30d

ALLOWED_ORIGINS=http://localhost:5173,app://localhost
"@ | Set-Content -Path $envFile -Encoding UTF8
    Write-Host ".env erstellt: $envFile" -ForegroundColor Green
}

# ── Abhängigkeiten installieren (nur Backend + Bibliotheken) ─────────────────
# Bewusst OHNE die Desktop-App: deren native Module (better-sqlite3) brauchen
# einen C++-Compiler. Die Desktop-App kommt als fertiger Installer von GitHub.
Invoke-Step "Installiere Backend-Abhängigkeiten (erster Lauf dauert einige Minuten)" {
    pnpm install --filter "@youman/backend..." --no-frozen-lockfile
}

Invoke-Step "Baue Workspace-Pakete" {
    pnpm build:shared
    if ($LASTEXITCODE -ne 0) { return }
    pnpm build:config-engine
    if ($LASTEXITCODE -ne 0) { return }
    pnpm build:sap
    if ($LASTEXITCODE -ne 0) { return }
    pnpm build:plenty
}

# ── Datenbank einrichten (nur beim ersten erfolgreichen Lauf) ────────────────
Set-Location (Join-Path $repo "apps\backend")
Write-Host ""
Write-Host ">> Generiere Prisma-Client" -ForegroundColor Cyan
pnpm exec prisma generate
if ($LASTEXITCODE -ne 0) {
    $clientDir = Join-Path $repo "node_modules\.prisma\client"
    $clientDirAlt = Get-ChildItem -Path (Join-Path $repo "node_modules\.pnpm") -Filter ".prisma" -Recurse -Directory -ErrorAction SilentlyContinue | Select-Object -First 1
    if ((Test-Path $clientDir) -or $clientDirAlt) {
        Write-Host "Prisma-Generate fehlgeschlagen (Datei vermutlich von laufendem Backend gesperrt) - vorhandener Client wird weiterverwendet." -ForegroundColor Yellow
        Write-Host "Tipp: Alle alten Backend-Fenster schließen, dann klappt das Generieren wieder."
    } else {
        Write-Host "FEHLER: Prisma-Client konnte nicht generiert werden und existiert noch nicht." -ForegroundColor Red
        Write-Host "Bitte alle Node-Prozesse beenden (taskkill /f /im node.exe) und erneut versuchen." -ForegroundColor Red
        Read-Host "Enter zum Beenden"
        exit 1
    }
}

$dbMarker = Join-Path $repo "apps\backend\.db-setup-done"
if (Test-Path $dbMarker) {
    Write-Host "Datenbank ist bereits eingerichtet - Schritt wird übersprungen." -ForegroundColor Yellow
    Write-Host "(Zum erneuten Einrichten die Datei apps\backend\.db-setup-done löschen.)"
} else {
    Invoke-Step "Lege Datenbankschema in Supabase an" { pnpm exec prisma db push }
    Invoke-Step "Lege Demo-Mandant und Demo-User an" { pnpm run db:seed }
    "done" | Set-Content -Path $dbMarker
}
Set-Location $repo

Write-Host ""
Write-Host "Fertig! Demo-Zugangsdaten für die adept&-App:" -ForegroundColor Green
Write-Host "  Mandant:  demo"
Write-Host "  E-Mail:   admin@demo.adept.de   Passwort: Admin123!"
Write-Host "  E-Mail:   sales@demo.adept.de   Passwort: Sales123!"
Write-Host ""
Write-Host "Starte Backend auf http://localhost:3001 - dieses Fenster OFFEN LASSEN," -ForegroundColor Cyan
Write-Host "solange du die App benutzt. Beenden mit Strg+C."
Write-Host ""
pnpm dev:backend
