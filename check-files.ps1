Add-Type -AssemblyName System.IO.Compression.FileSystem

$zipPath = 'data/embers-habits.xlsx'
$extractPath = 'data/embers-check'

if (Test-Path $extractPath) { 
  Remove-Item $extractPath -Recurse -Force 
}

[System.IO.Compression.ZipFile]::ExtractToDirectory($zipPath, $extractPath)

# Check Content Types
Write-Host '=== [Content_Types].xml ==='
Get-Content 'data/embers-check/[Content_Types].xml' -Head 50

Write-Host ''
Write-Host '=== Checking for theme file ==='
if (Test-Path 'data/embers-check/xl/theme/theme1.xml') {
  Write-Host 'Theme file EXISTS'
  $themeSize = (Get-Item 'data/embers-check/xl/theme/theme1.xml').Length
  Write-Host "Theme file size: $themeSize bytes"
} else {
  Write-Host 'ERROR: Theme file MISSING!'
}

Write-Host ''
Write-Host '=== Checking for sharedStrings ==='
if (Test-Path 'data/embers-check/xl/sharedStrings.xml') {
  Write-Host 'SharedStrings file EXISTS'
  $sharedSize = (Get-Item 'data/embers-check/xl/sharedStrings.xml').Length
  Write-Host "SharedStrings file size: $sharedSize bytes"
} else {
  Write-Host 'ERROR: SharedStrings file MISSING!'
}

Write-Host ''
Write-Host '=== Checking for styles.xml ==='
if (Test-Path 'data/embers-check/xl/styles.xml') {
  Write-Host 'Styles file EXISTS'
  $stylesSize = (Get-Item 'data/embers-check/xl/styles.xml').Length
  Write-Host "Styles file size: $stylesSize bytes"
  Write-Host 'Sampling styles.xml:'
  Get-Content 'data/embers-check/xl/styles.xml' -Head 5
} else {
  Write-Host 'ERROR: Styles file MISSING!'
}

Write-Host ''
Write-Host '=== All files in xlsx ==='
Get-ChildItem $extractPath -Recurse | ForEach-Object { $_.FullName.Replace($extractPath, '') }

Remove-Item $extractPath -Recurse -Force
