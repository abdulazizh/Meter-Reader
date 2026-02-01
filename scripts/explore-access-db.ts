import MDBReader from 'mdb-reader';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.resolve(__dirname, '../invest_db_REC.mdb');

async function exploreDatabase() {
  console.log('Reading Access database:', dbPath);
  
  const buffer = fs.readFileSync(dbPath);
  const reader = new MDBReader(buffer);
  
  // Get all table names
  const tableNames = reader.getTableNames();
  console.log('\n=== Tables in Database ===');
  console.log(tableNames);
  
  // For each table, show structure and sample data
  for (const tableName of tableNames) {
    console.log(`\n\n=== Table: ${tableName} ===`);
    
    const table = reader.getTable(tableName);
    
    // Show columns
    console.log('\nColumns:');
    const columns = table.getColumnNames();
    columns.forEach((col, i) => {
      console.log(`  ${i + 1}. ${col}`);
    });
    
    // Show sample data (first 3 rows)
    const data = table.getData();
    console.log(`\nTotal Rows: ${data.length}`);
    console.log('\nSample Data (first 3 rows):');
    data.slice(0, 3).forEach((row, i) => {
      console.log(`\nRow ${i + 1}:`, JSON.stringify(row, null, 2));
    });
  }
}

exploreDatabase().catch(console.error);
