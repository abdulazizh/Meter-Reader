import MDBReader from 'mdb-reader';
import * as fs from 'fs';
import * as path from 'path';

const dbPath = 'e:/2026/Meter-Reader/invest_db.mdb';

async function inspectDb() {
  if (!fs.existsSync(dbPath)) {
    console.error(`File not found: ${dbPath}`);
    return;
  }

  const buffer = fs.readFileSync(dbPath);
  const reader = new MDBReader(buffer);
  const tableNames = reader.getTableNames();

  console.log('Tables found:', tableNames);

  for (const tableName of tableNames) {
    if (tableName.toLowerCase() === 'master' || tableName.toLowerCase() === 'output' || tableName.toLowerCase() === 'cuttypeind') {
      const table = reader.getTable(tableName);
      const columns = table.getColumns();
      console.log(`\nColumns in table '${tableName}':`);
      console.log(columns.map(c => c.name));
      
      const data = table.getData();
      if (data.length > 0) {
        console.log(`Sample data from '${tableName}':`);
        console.log(data[0]);
      }
    }
  }
}

inspectDb().catch(console.error);
