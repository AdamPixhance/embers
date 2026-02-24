Add-Type -AssemblyName System.IO.Compression.FileSystem

$wbPath = 'release/Embers-portable-1.0.0/resources/app/data/embers-habits.xlsx'
$extractPath = 'data/wb-check'

if (Test-Path $extractPath) { 
  Remove-Item $extractPath -Recurse -Force 
}

[System.IO.Compression.ZipFile]::ExtractToDirectory($wbPath, $extractPath)

Write-Host '=== Checking workbook.xml ==='
$wb = Get-Content 'data/wb-check/xl/workbook.xml'
$wb | Write-Host

Write-Host ''
Write-Host '=== Checking styles.xml length ==='
$styles = Get-Content 'data/wb-check/xl/styles.xml' -Raw
Write-Host "Length: $($styles.Length) chars"

Write-Host ''
Write-Host '=== Sample of styles.xml ==='
$styles.Substring(0, 500) | Write-Host

Write-Host ''
Write-Host '=== Checking for invalid characters ==='
if ($styles -match '[^\x00-\x7F]') {
  Write-Host 'Found non-ASCII characters'
  $styles | Select-String -Pattern '[^\x00-\x7F]' | Write-Host
} else {
  Write-Host 'No non-ASCII characters found'
}

Remove-Item $extractPath -Recurse -Force
