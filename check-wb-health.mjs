import ExcelJS from 'exceljs';
import fs from 'node:fs/promises';
import path from 'node:path';

// Check portable workbook too
const portableWbPath = 'release/Embers-portable-1.0.0/resources/app/data/embers-habits.xlsx';
const localWbPath = 'data/embers-habits.xlsx';

for (const filePath of [localWbPath, portableWbPath]) {
  try {
    await fs.access(filePath);
  } catch {
    console.log(`${filePath}: MISSING`);
    continue;
  }
  
  console.log(`\n=== ${filePath} ===`);
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.readFile(filePath);
    console.log('Parse: OK');
    
    // Check for potential corruption markers
    let hasIssues = false;
    wb.worksheets.forEach(sheet => {
      if (!sheet.name) {
        console.log('WARNING: Empty sheet name');
        hasIssues = true;
      }
      if (sheet.actualRowCount === 0) {
        console.log(`WARNING: Sheet "${sheet.name}" has no rows`);
        hasIssues = true;
      }
    });
    
    if (!hasIssues) {
      console.log('No corruption markers detected');
    }
  } catch (err) {
    console.log('Parse ERROR:', err.message);
  }
}
