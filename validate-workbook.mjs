import ExcelJS from 'exceljs';
import fs from 'node:fs/promises';

const WORKBOOK_PATH = 'data/embers-habits.xlsx';

async function validate() {
  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(WORKBOOK_PATH);
    
    console.log('=== WORKBOOK VALIDATION ===');
    console.log('Worksheets:', workbook.worksheets.length);
    
    workbook.worksheets.forEach(sheet => {
      console.log(`\n--- Sheet: ${sheet.name} ---`);
      console.log('Rows:', sheet.actualRowCount);
      console.log('Columns:', sheet.actualColumnCount);
      
      // Check for formulas
      let formulaCount = 0;
      let validationCount = 0;
      let mergedCells = 0;
      
      sheet.eachRow((row, rowNum) => {
        row.eachCell((cell) => {
          if (cell.formula) {
            formulaCount++;
            console.log(`  Formula at ${cell.address}: ${cell.formula}`);
          }
          if (cell.dataValidation) {
            validationCount++;
            console.log(`  DataValidation at ${cell.address}`);
          }
        });
      });
      
      mergedCells = (sheet._mergedCells || []).length;
      
      console.log('Total formulas:', formulaCount);
      console.log('Total validations:', validationCount);
      console.log('Merged cells:', mergedCells);
    });
    
    console.log('\n=== STRUCTURAL CHECK ===');
    console.log('Workbook has errors:', !!workbook.errors?.length);
    if (workbook.errors?.length) {
      workbook.errors.forEach(err => console.log('  -', err.message));
    }
    
  } catch (err) {
    console.error('ERROR:', err.message);
    console.error(err.stack);
  }
}

validate();
