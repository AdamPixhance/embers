Add-Type -AssemblyName System.IO.Compression.FileSystem

# Backup original
Copy-Item 'data/embers-habits.xlsx' 'data/embers-habits.xlsx.bak' -Force

# Extract and examine
$zipPath = 'data/embers-habits.xlsx'
$extractPath = 'data/embers-temp'

if (Test-Path $extractPath) { 
  Remove-Item $extractPath -Recurse -Force 
}

[System.IO.Compression.ZipFile]::ExtractToDirectory($zipPath, $extractPath)

# Check for XML corruption patterns
Write-Host '=== Checking workbook.xml ==='
$workbookXml = Get-Content 'data/embers-temp/xl/workbook.xml' -Raw
Write-Host "Size: $($workbookXml.Length) chars"
Write-Host "Contains proper XML declaration: $($workbookXml.StartsWith('<?xml'))"

Write-Host ''
Write-Host '=== Checking for orphaned/unclosed tags ==='
if ($workbookXml -match '</workbook>') { 
  Write-Host 'Workbook closing tag: OK' 
} else { 
  Write-Host 'ERROR: Missing closing workbook tag' 
}

Write-Host ''
Write-Host '=== Sheet references ==='
Get-Content 'data/embers-temp/xl/workbook.xml' | Select-String -Pattern 'sheet' | ForEach-Object { 
  Write-Host $_.Line.Trim() 
}

Write-Host ''
Write-Host '=== Examining styles.xml for issues ==='
$stylesXml = Get-Content 'data/embers-temp/xl/styles.xml' -Raw
Write-Host "Styles.xml size: $($stylesXml.Length) chars"

Write-Host ''
Write-Host '=== List all worksheet files ==='
Get-ChildItem 'data/embers-temp/xl/worksheets/' -Filter '*.xml' | ForEach-Object {
  $ws = Get-Content $_.FullName -Raw
  Write-Host "$($_.Name): $($ws.Length) chars"
}

# Cleanup
Remove-Item $extractPath -Recurse -Force
