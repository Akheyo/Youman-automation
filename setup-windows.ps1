# adept& – Einmal-Setup: Backend mit Supabase-Datenbank einrichten und starten.
# Ausführen per Doppelklick auf setup-windows.bat oder in PowerShell:
#   powershell -ExecutionPolicy Bypass -File .\setup-windows.ps1

$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $repo

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
    Write-Host "pnpm nicht gefunden - wird über corepack aktiviert..." -ForegroundColor Yellow
    corepack enable
    corepack prepare pnpm@9.15.0 --activate
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

# ── Abhängigkeiten installieren und Pakete bauen ─────────────────────────────
Write-Host ""
Write-Host "Installiere Abhängigkeiten (kann beim ersten Mal einige Minuten dauern)..." -ForegroundColor Cyan
pnpm install --no-frozen-lockfile

Write-Host "Baue Workspace-Pakete..." -ForegroundColor Cyan
pnpm build:shared
pnpm build:config-engine
pnpm build:sap
pnpm build:plenty

# ── Datenbank einrichten ─────────────────────────────────────────────────────
Write-Host ""
Write-Host "Richte Supabase-Datenbank ein (Schema + Demo-Daten)..." -ForegroundColor Cyan
Set-Location (Join-Path $repo "apps\backend")
pnpm exec prisma generate
pnpm exec prisma db push
pnpm run db:seed
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
