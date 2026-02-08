import MDBReader from 'mdb-reader';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.resolve(__dirname, '../invest_db.mdb');

// API URL (use local for testing, production for actual import)
const API_URL = process.env.API_URL || 'http://localhost:5000';

interface AccessMaster {
  m_accountno: string;
  m_serial: string;
  m_meter: string;
  m_type?: number;
  m_name?: string;
  m_address?: string;
  m_streetno?: string;
  m_houseno?: string;
  m_prevread?: number;
  m_prevdt?: string | null;
  m_amount?: number;
  m_outs?: number;
  m_amount_all?: number;
  // Add any other fields that might exist in the master table
  [key: string]: any;
}

interface MeterReaderMeter {
  accountNumber: string;
  sequence: string;
  meterNumber: string;
  category: string;
  subscriberName: string;
  address: string;
  record: string;
  block: string;
  property: string;
  previousReading: number;
  previousReadingDate: string;
  currentAmount: string;
  debts: string;
  totalAmount: string;
}

// Map category codes to names
function mapCategory(typeCode: number | undefined): string {
  const categories: Record<number, string> = {
    1: 'منزلي',
    2: 'تجاري',
    3: 'صناعي',
    4: 'حكومي',
    5: 'زراعي',
  };
  return categories[typeCode || 0] || 'منزلي';
}

// Convert Access date to ISO string
function convertDate(date: string | null | Date | undefined): string {
  if (!date) {
    return new Date().toISOString();
  }
  if (date instanceof Date) {
    return date.toISOString();
  }
  return new Date(date).toISOString();
}

// Transform Access record to Meter Reader format
function transformMeter(accessMeter: AccessMaster): MeterReaderMeter {
  return {
    accountNumber: String(accessMeter.m_accountno || ''),
    sequence: String(accessMeter.m_serial || '0'),
    meterNumber: String(accessMeter.m_meter || ''),
    category: mapCategory(accessMeter.m_type),
    subscriberName: accessMeter.m_name || 'غير محدد',
    address: accessMeter.m_address || '',
    record: String(accessMeter.m_streetno || '0'),
    block: String(accessMeter.m_houseno || '0'), // Using houseno as block
    property: String(accessMeter.m_houseno || '0'),
    previousReading: accessMeter.m_prevread || 0,
    previousReadingDate: convertDate(accessMeter.m_prevdt),
    currentAmount: String(accessMeter.m_amount || 0),
    debts: String(accessMeter.m_outs || 0),
    totalAmount: String(accessMeter.m_amount_all || 0),
  };
}

async function importData() {
  console.log('=== Master Table Import Tool ===\n');
  console.log('Reading Access database:', dbPath);
  
  if (!fs.existsSync(dbPath)) {
    console.error(`❌ Error: Database file not found at ${dbPath}`);
    console.log('Please ensure the file invest_db.mdb exists in the project root directory.');
    return;
  }
  
  try {
    const buffer = fs.readFileSync(dbPath);
    const reader = new MDBReader(buffer);
    
    // Get master table data
    const table = reader.getTable('master');
    const data = table.getData();
    
    console.log(`\nFound ${data.length} records in master table.\n`);
    
    // Transform all records
    const transformedMeters = data.map((accessMeter: any) => transformMeter(accessMeter as AccessMaster));
    
    // Export to JSON file for review/import
    const outputPath = path.resolve(__dirname, '../master-import-data.json');
    fs.writeFileSync(outputPath, JSON.stringify(transformedMeters, null, 2), 'utf-8');
    
    console.log(`✅ Data exported to: ${outputPath}`);
    console.log(`\nTotal meters prepared: ${transformedMeters.length}`);
    
    // Show sample of transformed data
    console.log('\n=== Sample Transformed Data ===');
    transformedMeters.slice(0, 3).forEach((meter, i) => {
      console.log(`\nMeter ${i + 1}:`);
      console.log(`  Account Number: ${meter.accountNumber}`);
      console.log(`  Subscriber Name: ${meter.subscriberName}`);
      console.log(`  Meter Number: ${meter.meterNumber}`);
      console.log(`  Address: ${meter.address}`);
      console.log(`  Previous Reading: ${meter.previousReading}`);
      console.log(`  Current Amount: ${meter.currentAmount}`);
      console.log(`  Debts: ${meter.debts}`);
    });
    
    console.log('\n=== Import Complete ===');
    console.log('الملف جاهز للاستيراد عبر لوحة التحكم (Admin Panel).');
    console.log('يمكنك استخدام ميزة "استيراد Excel" لرفع البيانات، أو استخدام الـ API مباشرة.');
    
  } catch (error) {
    console.error('❌ Error importing data:', error);
    if (error instanceof Error && error.message.includes('Table not found')) {
      console.log('\nAvailable tables in database:');
      try {
        const buffer = fs.readFileSync(dbPath);
        const reader = new MDBReader(buffer);
        // Try to get all table names by attempting to get each possible table
        const possibleTables = ['master', 'output', 'meters', 'customers', 'users'];
        console.log('\nAvailable tables in database:');
        for (const tableName of possibleTables) {
          try {
            reader.getTable(tableName);
            console.log(`- ${tableName}`);
          } catch {
            // Table doesn't exist, continue
          }
        }
      } catch (tableError) {
        console.error('Could not list tables:', tableError);
      }
    }
  }
}

importData().catch(console.error);