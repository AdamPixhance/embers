param(
    [string]$AppName = "Embers",
    [string]$ExeName = "Embers.exe"
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptDir

$candidateExePaths = @(
    (Join-Path $projectRoot "release\win-unpacked\$ExeName"),
    (Join-Path $projectRoot "release\Embers-portable-0.1.0\$ExeName"),
    (Join-Path $projectRoot $ExeName)
)

$exePath = $candidateExePaths | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $exePath) {
    Write-Error "Could not find $ExeName. Build the desktop app first, or place this script near the executable."
    exit 1
}

$startMenuDir = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs"
$shortcutPath = Join-Path $startMenuDir "$AppName.lnk"

$wshShell = New-Object -ComObject WScript.Shell
$shortcut = $wshShell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $exePath
$shortcut.WorkingDirectory = Split-Path -Parent $exePath
$shortcut.IconLocation = "$exePath,0"
$shortcut.Description = "$AppName desktop app"
$shortcut.Save()

Write-Output "Start Menu shortcut created: $shortcutPath"
Write-Output "Target: $exePath"
