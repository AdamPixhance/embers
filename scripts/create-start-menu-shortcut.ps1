param(
    [string]$AppName = "Embers",
    [string]$ExeName = "Embers.exe",
    [string]$TargetPath = ""
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptDir

$appVersion = "1.0.0"
$packageJsonPath = Join-Path $projectRoot "package.json"
if (Test-Path $packageJsonPath) {
    try {
        $pkg = Get-Content $packageJsonPath -Raw | ConvertFrom-Json
        if ($pkg.version) {
            $appVersion = [string]$pkg.version
        }
    }
    catch {
        # keep default version fallback
    }
}

$candidateExePaths = @(
    (Join-Path $projectRoot "release\Embers-win32-x64\$ExeName"),
    (Join-Path $projectRoot "release\Embers-portable-$appVersion\$ExeName"),
    (Join-Path $projectRoot "release\win-unpacked\$ExeName"),
    (Join-Path $projectRoot $ExeName)
)

if ($TargetPath -and (Test-Path $TargetPath)) {
    $exePath = $TargetPath
}
else {
    $exePath = $candidateExePaths | Where-Object { Test-Path $_ } | Select-Object -First 1
}

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
