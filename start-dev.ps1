param(
    [switch]$RunInThisTerminal
)

$ErrorActionPreference = 'Stop'

$port = 5173
$dashboardDir = '/home/projects/Pacific Exposure Map/dashboard'
$wslIp = & wsl.exe -d Ubuntu -- bash -lc "hostname -I | tr ' ' '\n' | head -n 1"
$wslIp = if ($wslIp) { $wslIp.Trim() } else { throw 'Could not determine the WSL IP address.' }
$demoUrl = "http://${wslIp}:$port/"
$isRunning = & wsl.exe -d Ubuntu -- bash -lc "curl -fsS --max-time 2 http://127.0.0.1:$port/ >/dev/null 2>&1 && echo yes || true"

Write-Host "Demo URL: $demoUrl" -ForegroundColor Green

if ($isRunning -eq 'yes') {
    Write-Host "Dev server is already running." -ForegroundColor Yellow
    exit 0
}

if (-not $RunInThisTerminal) {
    $arguments = "-NoExit -ExecutionPolicy Bypass -File `"$PSCommandPath`" -RunInThisTerminal"

    Start-Process `
        -FilePath powershell.exe `
        -ArgumentList $arguments `
        -WindowStyle Normal

    Write-Host "Opened the dev server in a new visible PowerShell window." -ForegroundColor Cyan
    exit 0
}

$Host.UI.RawUI.WindowTitle = 'Pacific Exposure Map Dev Server'
Write-Host "Starting Pacific Exposure Map dev server..." -ForegroundColor Cyan
Write-Host "Leave this terminal open while developing." -ForegroundColor Yellow

& wsl.exe -d Ubuntu -- bash -lc "cd '$dashboardDir' && npm run dev -- --host 0.0.0.0 --port $port --strictPort"
