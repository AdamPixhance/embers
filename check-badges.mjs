import ExcelJS from 'exceljs';

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile('data/embers-habits.xlsx');

const badgesSheet = wb.getWorksheet('Badges');
console.log('=== BADGES SHEET ===');
console.log('Rows:', badgesSheet.actualRowCount);
console.log('Columns:', badgesSheet.actualColumnCount);

console.log('\nRaw badge data:');
badgesSheet.eachRow((row, rowNum) => {
  if (rowNum > 1) {
    const badgeId = row.getCell(1).value;
    const name = row.getCell(2).value;
    const icon = row.getCell(3).value;
    const color = row.getCell(4).value;
    const minScore = row.getCell(5).value;
    const sortOrder = row.getCell(6).value;
    const active = row.getCell(7).value;
    console.log(`  Row ${rowNum}: id=${badgeId}, minScore=${minScore}, name=${name}`);
  }
});
