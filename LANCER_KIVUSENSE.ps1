$ErrorActionPreference = 'Stop'
$Host.UI.RawUI.WindowTitle = 'KivuSense - Centre de lancement'
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendRoot = Join-Path $projectRoot 'Fraisebackend'
$backendPython = Join-Path $backendRoot '.venv\Scripts\python.exe'
$envFile = Join-Path $projectRoot '.env'

function Write-Step([string]$Number, [string]$Title, [string]$Detail) {
    Write-Host "`n  $Number  " -NoNewline -ForegroundColor White -BackgroundColor DarkGreen
    Write-Host " $Title" -ForegroundColor Green
    if ($Detail) { Write-Host "     $Detail" -ForegroundColor DarkGray }
}

function Test-Command([string]$Name, [string]$Help) {
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        Write-Host "`n[ERREUR] $Name est introuvable." -ForegroundColor Red
        Write-Host $Help -ForegroundColor Yellow
        Read-Host 'Appuyez sur Entree pour fermer'
        exit 1
    }
}

function Get-FreeExpoPort {
    for ($port = 19000; $port -le 19099; $port++) {
        $used = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
        if (-not $used) {
            try {
                $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $port)
                $listener.Start()
                $listener.Stop()
                return $port
            } catch {
                # Port occupe, on continue jusqu a trouver un endroit libre.
            }
        }
    }
    return 19000
}

function Stop-StaleExpoProcesses {
    $stale = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
        Where-Object {
            $_.Name -match 'node\.exe' -and ($_.CommandLine -match 'expo start|metro|react-native')
        }
    foreach ($process in $stale) {
        Stop-Process -Id $process.ProcessId -Force -ErrorAction SilentlyContinue
        Write-Host "     Serveur Expo stale termine : PID $($process.ProcessId)" -ForegroundColor DarkGray
    }
}

Clear-Host
Write-Host '  ==========================================================' -ForegroundColor DarkGreen
Write-Host '       KIVUSENSE  |  INTELLIGENCE CLIMATIQUE AGRICOLE' -ForegroundColor Green
Write-Host '  ==========================================================' -ForegroundColor DarkGreen
Write-Host '       Mobile + Web + FastAPI + PostgreSQL + ESP32' -ForegroundColor Gray

Test-Command 'node' 'Installez Node.js 20.19 ou plus recent : https://nodejs.org/'
Test-Command 'npm' 'Node.js doit inclure npm.'
Test-Command 'python' 'Installez Python 3.11 ou plus recent : https://python.org/'

Write-Step '01' 'Configuration reseau' 'Detection de l adresse utilisable par le telephone.'
$lanAddress = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' -and $_.PrefixOrigin -ne 'WellKnown' } |
    Sort-Object -Property InterfaceMetric |
    Select-Object -First 1 -ExpandProperty IPAddress
if (-not $lanAddress) { $lanAddress = '127.0.0.1' }
$apiUrl = "http://${lanAddress}:8000"
if (-not (Test-Path -LiteralPath $envFile)) {
    [IO.File]::WriteAllText($envFile, "EXPO_PUBLIC_API_URL=$apiUrl`r`n", [Text.UTF8Encoding]::new($false))
    Write-Host "     Fichier .env cree : $apiUrl" -ForegroundColor Cyan
} else {
    $envLines = @(Get-Content -LiteralPath $envFile)
    $apiLineIndex = -1
    for ($index = 0; $index -lt $envLines.Count; $index++) {
        if ($envLines[$index] -match '^EXPO_PUBLIC_API_URL=') { $apiLineIndex = $index; break }
    }
    if ($apiLineIndex -ge 0 -and $envLines[$apiLineIndex] -match '^EXPO_PUBLIC_API_URL=http://') {
        $envLines[$apiLineIndex] = "EXPO_PUBLIC_API_URL=$apiUrl"
        [IO.File]::WriteAllLines($envFile, $envLines, [Text.UTF8Encoding]::new($false))
        Write-Host "     Adresse locale mise a jour : $apiUrl" -ForegroundColor Cyan
    } else {
        Write-Host "     Configuration distante conservee : $envFile" -ForegroundColor DarkGray
    }
}

Write-Step '02' 'Dependances mobiles' 'Verification Expo SDK 54.'
Push-Location $projectRoot
if (-not (Test-Path -LiteralPath (Join-Path $projectRoot 'node_modules\expo\package.json'))) {
    Write-Host '     Installation initiale des paquets npm...' -ForegroundColor Yellow
} else {
    Write-Host '     Verification et telechargement des paquets manquants...' -ForegroundColor DarkGray
}
npm install --no-audit --no-fund
if (-not (Test-Path -LiteralPath (Join-Path $projectRoot 'node_modules\expo-glass-effect\package.json'))) {
    throw 'La dependance expo-glass-effect est absente apres npm install.'
}
if (-not (Test-Path -LiteralPath (Join-Path $projectRoot 'node_modules\typescript\package.json'))) {
    throw 'La dependance TypeScript est absente apres npm install.'
}
Pop-Location
Write-Host '     Paquets mobiles verifies.' -ForegroundColor Green

Write-Step '03' 'Backend FastAPI' 'Preparation de l environnement Python isole.'
if (-not (Test-Path -LiteralPath $backendPython)) {
    python -m venv (Join-Path $backendRoot '.venv')
}
Write-Host '     Verification et telechargement des paquets Python manquants...' -ForegroundColor DarkGray
& $backendPython -m pip install --disable-pip-version-check --no-input -r (Join-Path $backendRoot 'requirements.txt')
& $backendPython -c "import fastapi, sqlalchemy, jose, psycopg; print('     FastAPI + SQLAlchemy + PostgreSQL verifies.')"

Write-Step '04' 'Demarrage API' "Adresse locale : $apiUrl"
$apiAlreadyRunning = $false
try {
    $health = Invoke-RestMethod -Uri 'http://127.0.0.1:8000/' -TimeoutSec 2
    $apiAlreadyRunning = ($health.status -eq 'online')
} catch { $apiAlreadyRunning = $false }

if (-not $apiAlreadyRunning) {
    Start-Process -FilePath $backendPython -ArgumentList '-m','uvicorn','Fraisebackend.main:app','--host','0.0.0.0','--port','8000' -WorkingDirectory $projectRoot -WindowStyle Hidden
    $ready = $false
    for ($attempt = 0; $attempt -lt 20; $attempt++) {
        Start-Sleep -Milliseconds 400
        try { $null = Invoke-RestMethod -Uri 'http://127.0.0.1:8000/' -TimeoutSec 1; $ready = $true; break } catch { }
    }
    if (-not $ready) { throw 'Le backend ne repond pas sur le port 8000.' }
}
Write-Host '     API en ligne. Documentation : http://127.0.0.1:8000/docs' -ForegroundColor Cyan

Write-Step '05' 'Application universelle' 'QR pour le mobile; touche W pour ouvrir la version web.'
Stop-StaleExpoProcesses
$expoPort = Get-FreeExpoPort
Write-Host "`n  PC     : $lanAddress" -ForegroundColor Gray
Write-Host '  API    : EN LIGNE' -ForegroundColor Green
Write-Host "  EXPO   : DEMARRAGE EN MODE RESEAU LOCAL (port $expoPort)..." -ForegroundColor Yellow
Write-Host '  INTERNET/TUNNEL : non requis pour le lancement local' -ForegroundColor DarkGray
Write-Host '  WEB    : appuyez sur W dans le terminal Expo' -ForegroundColor Cyan
Write-Host "`n  Pour arreter proprement : Ctrl+C`n" -ForegroundColor DarkGray

Set-Location -LiteralPath $projectRoot
Write-Host '     Lancement Expo via le reseau local (plus fiable que --tunnel sur ce poste).' -ForegroundColor Cyan
try {
    & npx expo start --lan --clear --port $expoPort
    if ($LASTEXITCODE -ne 0) { throw "Le lancement Expo local a retourne un code d erreur: $LASTEXITCODE" }
} catch {
    Write-Host '     Le reseau local a echoue. Tentative de tunnel ngrok...' -ForegroundColor Yellow
    & npx expo start --tunnel --clear
}
