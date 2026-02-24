Add-Type -AssemblyName System.IO.Compression.FileSystem

$zipPath = 'data/embers-habits.xlsx'
$extractPath = 'data/embers-detailed'

if (Test-Path $extractPath) { 
  Remove-Item $extractPath -Recurse -Force 
}

[System.IO.Compression.ZipFile]::ExtractToDirectory($zipPath, $extractPath)

Write-Host '=== Checking Habits Sheet (sheet2.xml) for issues ==='
$habitsXml = Get-Content 'data/embers-detailed/xl/worksheets/sheet2.xml' -Raw

# Check for common corruption patterns
$patterns = @{
  'Unclosed sheetData' = '</sheetData>'
  'Missing namespace' = 'xmlns='
  'Bad cell refs' = 'r="[A-Z]{1,3}(\d{1,7})"'
  'Inline strings' = '<is>'
  'Formulas' = '<f>'
}

foreach ($pattern in $patterns.GetEnumerator()) {
  if ($habitsXml -match $pattern.Value) {
    Write-Host "$($pattern.Name): FOUND"
  } else {
    Write-Host "$($pattern.Name): not found"
  }
}

Write-Host ''
Write-Host '=== Checking for broken relationships in workbook.xml.rels ==='
$relationships = Get-Content 'data/embers-detailed/xl/_rels/workbook.xml.rels' -Raw
Write-Host "Relationships content:"
Write-Host $relationships

Write-Host ''
Write-Host '=== Checking _rels/.rels ==='
$mainRels = Get-Content 'data/embers-detailed/_rels/.rels' -Raw
Write-Host $mainRels

Write-Host ''
Write-Host '=== Checking [Content_Types].xml ==='
$contentTypes = Get-Content 'data/embers-detailed/[Content_Types].xml' -Raw
Write-Host $contentTypes

# Cleanup
Remove-Item $extractPath -Recurse -Force
