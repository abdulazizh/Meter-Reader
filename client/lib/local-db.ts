import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';

let _db: SQLite.SQLiteDatabase | null = null;

const getDB = () => {
  if (!_db) {
    _db = SQLite.openDatabaseSync('meter_reader.db');
  }
  return _db;
};

// Initialize database tables
export const initLocalDB = () => {
  try {
    const db = getDB();
    // Create readings table
  db.execSync(
    `CREATE TABLE IF NOT EXISTS readings (
      id TEXT PRIMARY KEY NOT NULL,
      meterId TEXT NOT NULL,
      readerId TEXT NOT NULL,
      newReading INTEGER,
      photoUri TEXT,
      photoFileName TEXT,
      notes TEXT,
      skipReason TEXT,
      latitude REAL,
      longitude REAL,
      createdAt TEXT,
      isCompleted BOOLEAN DEFAULT 0,
      synced BOOLEAN DEFAULT 0
    )`
  );

  // Create meters table (for local cache)
  db.execSync(
    `CREATE TABLE IF NOT EXISTS meters (
      id TEXT PRIMARY KEY NOT NULL,
      accountNumber TEXT NOT NULL,
      sequence TEXT,
      meterNumber TEXT,
      category TEXT,
      subscriberName TEXT,
      record TEXT,
      block TEXT,
      property TEXT,
      previousReading INTEGER,
      previousReadingDate TEXT,
      currentAmount TEXT,
      debts TEXT,
      totalAmount TEXT,
      address TEXT,
      readerId TEXT,
      isCompleted BOOLEAN DEFAULT 0
    )`
  );
  } catch (error) {
    console.log('Error initializing local DB:', error);
  }
};

// Save reading to local database
export const saveReadingToLocalDB = (
  id: string,
  meterId: string,
  readerId: string,
  newReading: number | null,
  photoUri: string | null,
  photoFileName: string | null,
  notes?: string,
  skipReason?: string,
  latitude?: number,
  longitude?: number
) => {
  try {
    const db = getDB();
    db.runSync(
      `INSERT OR REPLACE INTO readings 
      (id, meterId, readerId, newReading, photoUri, photoFileName, notes, skipReason, latitude, longitude, createdAt, isCompleted, synced) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0)`,
      [
        id,
        meterId,
        readerId,
        newReading,
        photoUri,
        photoFileName,
        notes || null,
        skipReason || null,
        latitude || null,
        longitude || null,
        new Date().toISOString()
      ]
    );
    
    console.log('Reading saved to local DB successfully');
    return true;
  } catch (error) {
    console.log('Error saving reading to local DB:', error);
    return false;
  }
};

// Get reading by meter ID from local database
export const getReadingByMeterId = (meterId: string): any => {
  try {
    const db = getDB();
    const result = db.getAllSync(`SELECT * FROM readings WHERE meterId = ? ORDER BY createdAt DESC LIMIT 1`, [meterId]);
    return result.length > 0 ? result[0] : null;
  } catch (error) {
    console.log('Error getting reading from local DB:', error);
    return null;
  }
};

// Get all pending readings from local database
export const getPendingReadingsFromDB = (): any[] => {
  try {
    const db = getDB();
    return db.getAllSync(`SELECT * FROM readings WHERE synced = 0 ORDER BY createdAt DESC`);
  } catch (error) {
    console.log('Error getting pending readings from local DB:', error);
    return [];
  }
};

// Mark reading as synced
export const markReadingAsSynced = (id: string) => {
  try {
    const db = getDB();
    db.runSync(`UPDATE readings SET synced = 1 WHERE id = ?`, [id]);
    console.log('Reading marked as synced');
    return true;
  } catch (error) {
    console.log('Error marking reading as synced:', error);
    return false;
  }
};

// Save meter to local database
export const saveMeterToLocalDB = (meter: any) => {
  try {
    const db = getDB();
    db.runSync(
      `INSERT OR REPLACE INTO meters 
      (id, accountNumber, sequence, meterNumber, category, subscriberName, record, block, property, 
       previousReading, previousReadingDate, currentAmount, debts, totalAmount, address, readerId) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        meter.id,
        meter.accountNumber,
        meter.sequence,
        meter.meterNumber,
        meter.category,
        meter.subscriberName,
        meter.record,
        meter.block,
        meter.property,
        meter.previousReading,
        meter.previousReadingDate ? new Date(meter.previousReadingDate).toISOString() : null,
        meter.currentAmount,
        meter.debts,
        meter.totalAmount,
        meter.address,
        meter.readerId
      ]
    );
    return true;
  } catch (error) {
    console.log('Error saving meter to local DB:', error);
    return false;
  }
};

// Get all meters from local database
export const getMetersFromLocalDB = (readerId: string): any[] => {
  try {
    const db = getDB();
    const rows = db.getAllSync(
      `SELECT m.*, r.id as r_id, r.newReading as r_newReading, r.photoUri as r_photoUri, 
              r.photoFileName as r_photoFileName, r.notes as r_notes,
              r.skipReason as r_skipReason, r.createdAt as r_createdAt,
              r.latitude as r_latitude, r.longitude as r_longitude,
              r.synced as r_synced
       FROM meters m
       LEFT JOIN readings r ON r.id = (
         SELECT id FROM readings 
         WHERE meterId = m.id 
         ORDER BY createdAt DESC 
         LIMIT 1
       )
       WHERE m.readerId = ?
       ORDER BY m.sequence`,
      [readerId]
    ) as any[];

    return rows.map(row => {
      const { 
        r_id, r_newReading, r_photoUri, r_photoFileName, r_notes, 
        r_skipReason, r_createdAt, r_latitude, r_longitude, r_synced,
        ...meter 
      } = row;
      
      return {
        ...meter,
        latestReading: r_id ? {
          id: r_id,
          newReading: r_newReading,
          meterId: meter.id,
          readerId: meter.readerId,
          photoPath: r_photoFileName,
          localPhotoUri: r_photoUri,
          notes: r_notes,
          skipReason: r_skipReason,
          createdAt: r_createdAt,
          readingDate: r_createdAt,
          latitude: r_latitude,
          longitude: r_longitude,
          synced: r_synced === 1
        } : null
      };
    });
  } catch (error) {
    console.log('Error getting meters from local DB:', error);
    return [];
  }
};

// Get formatted export data from local database
export const getExportDataFromLocalDB = (readerId: string) => {
  const meters = getMetersFromLocalDB(readerId);
  
  return {
    exportDate: new Date().toISOString(),
    readerId,
    totalMeters: meters.length,
    completedReadings: meters.filter(m => m.latestReading !== null).length,
    meters: meters.filter(m => m.latestReading !== null).map(meter => {
      const readingsArray = [];
      if (meter.latestReading) {
        readingsArray.push({
          newReading: meter.latestReading.newReading,
          photoPath: meter.latestReading.photoPath,
          localPhotoUri: meter.latestReading.localPhotoUri,
          notes: meter.latestReading.notes,
          skipReason: meter.latestReading.skipReason,
          createdAt: meter.latestReading.createdAt,
        });
      }
      
      return {
        accountNumber: meter.accountNumber,
        sequence: meter.sequence,
        meterNumber: meter.meterNumber,
        category: meter.category,
        subscriberName: meter.subscriberName,
        address: {
          record: meter.record,
          block: meter.block,
          property: meter.property,
        },
        previousReading: meter.previousReading,
        previousReadingDate: meter.previousReadingDate,
        amounts: {
          currentAmount: meter.currentAmount,
          debts: meter.debts,
          totalAmount: meter.totalAmount,
        },
        readings: readingsArray,
      };
    }),
  };
};

// Clear local database (for testing purposes)
export const clearLocalDB = () => {
  try {
    const db = getDB();
    db.execSync(`DELETE FROM readings`);
    db.execSync(`DELETE FROM meters`);
    console.log('Local DB cleared successfully');
    return true;
  } catch (error) {
    console.log('Error clearing local DB:', error);
    return false;
  }
};