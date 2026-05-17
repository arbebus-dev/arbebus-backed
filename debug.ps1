$ErrorActionPreference = "Continue"

$root = Get-Location
$logDir = "$root\debug-logs"
$logFile = "$logDir\debug-report.txt"

if (!(Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir | Out-Null
}

Clear-Content $logFile -ErrorAction SilentlyContinue

function Run-Check {
    param (
        [string]$Title,
        [string]$Command
    )

    Write-Host ""
    Write-Host "=============================="
    Write-Host $Title
    Write-Host "=============================="

    Add-Content $logFile ""
    Add-Content $logFile "=============================="
    Add-Content $logFile $Title
    Add-Content $logFile "=============================="

    cmd /c $Command 2>&1 | Tee-Object -FilePath $logFile -Append
}

Write-Host "ARBEBUS ULTIMATE DEBUG TOOL"
Write-Host "Project: $root"
Write-Host "Log file: $logFile"

Run-Check "1. ROOT NPM CHECK" "npm -v && node -v"

Run-Check "2. BACKEND PACKAGE CHECK" "cd backend && npm install --dry-run"

Run-Check "3. BACKEND JS SYNTAX CHECK" "cd backend && for /R %f in (*.js) do node --check ""%f"""

Run-Check "4. BACKEND SERVER START CHECK" "cd backend && node server.js"

Run-Check "5. MOBILE PACKAGE CHECK" "cd mobile && npm install --dry-run"

Run-Check "6. MOBILE TYPESCRIPT CHECK" "cd mobile && npx tsc --noEmit"

Run-Check "7. MOBILE EXPO CONFIG CHECK" "cd mobile && npx expo config"

Run-Check "8. MOBILE LINT CHECK" "cd mobile && npx eslint . --ext .ts,.tsx"

Write-Host ""
Write-Host "DEBUG BAIGTAS"
Write-Host "Ataskaita: $logFile"