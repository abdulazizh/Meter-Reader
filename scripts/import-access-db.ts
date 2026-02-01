import MDBReader from 'mdb-reader';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.resolve(__dirname, '../invest_db_REC.mdb');

// API URL (use local for testing, production for actual import)
const API_URL = process.env.API_URL || 'http://localhost:5000';

interface AccessMeter {
  O_accountno: string;
  o_region: number;
  o_sect: number;
  O_type: number;
  O_serial: number;
  O_name: string;
  O_address: string;
  O_streetno: number;
  O_houseno: string;
  O_meter: number;
  O_prevread: number;
  O_prevdt: string | null;
  o_amount: number;
  o_outs: number;
  o_amount_all: number;
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
function mapCategory(typeCode: number): string {
  const categories: Record<number, string> = {
    1: 'منزلي',
    2: 'تجاري',
    3: 'صناعي',
    4: 'حكومي',
    5: 'زراعي',
  };
  return categories[typeCode] || 'منزلي';
}

// Convert Access date to ISO string
function convertDate(date: string | null | Date): string {
  if (!date) {
    return new Date().toISOString();
  }
  if (date instanceof Date) {
    return date.toISOString();
  }
  return new Date(date).toISOString();
}

// Transform Access record to Meter Reader format
function transformMeter(accessMeter: any): MeterReaderMeter {
  return {
    accountNumber: String(accessMeter.O_accountno || ''),
    sequence: String(accessMeter.O_serial || '0'),
    meterNumber: String(accessMeter.O_meter || ''),
    category: mapCategory(accessMeter.O_type),
    subscriberName: accessMeter.O_name || 'غير محدد',
    address: accessMeter.O_address || '',
    record: String(accessMeter.O_streetno || '0'),
    block: String(accessMeter.o_sect || '0'),
    property: String(accessMeter.O_houseno || '0'),
    previousReading: accessMeter.O_prevread || 0,
    previousReadingDate: convertDate(accessMeter.O_prevdt || accessMeter.O_avgdt),
    currentAmount: String(accessMeter.o_amount || 0),
    debts: String(accessMeter.o_outs || 0),
    totalAmount: String(accessMeter.o_amount_all || 0),
  };
}

async function importData() {
  console.log('=== Access Database Import Tool ===\n');
  console.log('Reading Access database:', dbPath);
  
  const buffer = fs.readFileSync(dbPath);
  const reader = new MDBReader(buffer);
  
  // Get output table data
  const table = reader.getTable('output');
  const data = table.getData();
  
  console.log(`\nFound ${data.length} records to import.\n`);
  
  // Transform all records
  const transformedMeters = data.map(transformMeter);
  
  // Export to JSON file for review/import
  const outputPath = path.resolve(__dirname, '../import-data.json');
  fs.writeFileSync(outputPath, JSON.stringify(transformedMeters, null, 2), 'utf-8');
  
  console.log(`✅ Data exported to: ${outputPath}`);
  console.log(`\nTotal meters prepared: ${transformedMeters.length}`);
  
  // Show sample of transformed data
  console.log('\n=== Sample Transformed Data ===');
  transformedMeters.slice(0, 3).forEach((meter, i) => {
    console.log(`\nMeter ${i + 1}:`);
    console.log(`  رقم الحساب: ${meter.accountNumber}`);
    console.log(`  اسم المشترك: ${meter.subscriberName}`);
    console.log(`  رقم العداد: ${meter.meterNumber}`);
    console.log(`  العنوان: ${meter.address}`);
    console.log(`  القراءة السابقة: ${meter.previousReading}`);
    console.log(`  المبلغ الحالي: ${meter.currentAmount}`);
    console.log(`  المديونية: ${meter.debts}`);
  });
  
  console.log('\n=== Import Complete ===');
  console.log('الملف جاهز للاستيراد عبر لوحة التحكم (Admin Panel).');
  console.log('يمكنك استخدام ميزة "استيراد Excel" لرفع البيانات، أو استخدام الـ API مباشرة.');
}

importData().catch(console.error);
