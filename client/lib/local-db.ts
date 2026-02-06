import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';

// Open database
const db = SQLite.openDatabaseSync('meter_reader.db');

// Initialize database tables
export const initLocalDB = () => {
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
};

// Save reading to local database
export const saveReadingToLocalDB = (
  id: string,
  meterId: string,
  readerId: string,
  newReading: number | null,
  photoUri: string,
  photoFileName: string,
  notes?: string,
  skipReason?: string,
  latitude?: number,
  longitude?: number
) => {
  try {
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
    return db.getAllSync(`SELECT * FROM readings WHERE synced = 0 ORDER BY createdAt DESC`);
  } catch (error) {
    console.log('Error getting pending readings from local DB:', error);
    return [];
  }
};

// Mark reading as synced
export const markReadingAsSynced = (id: string) => {
  try {
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
    
    console.log('Meter saved to local DB successfully');
    return true;
  } catch (error) {
    console.log('Error saving meter to local DB:', error);
    return false;
  }
};

// Get all meters from local database
export const getMetersFromLocalDB = (readerId: string): any[] => {
  try {
    const rows = db.getAllSync(
      `SELECT m.*, r.id as r_id, r.newReading as r_newReading, r.photoUri as r_photoUri, 
              r.photoFileName as r_photoFileName, r.notes as r_notes,
              r.skipReason as r_skipReason, r.createdAt as r_createdAt,
              r.latitude as r_latitude, r.longitude as r_longitude
       FROM meters m
       LEFT JOIN readings r ON m.id = r.meterId
       WHERE m.readerId = ?
       GROUP BY m.id
       ORDER BY m.sequence`,
      [readerId]
    ) as any[];

    return rows.map(row => {
      const { 
        r_id, r_newReading, r_photoUri, r_photoFileName, r_notes, 
        r_skipReason, r_createdAt, r_latitude, r_longitude,
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
          notes: r_notes,
          skipReason: r_skipReason,
          createdAt: r_createdAt,
          readingDate: r_createdAt,
          latitude: r_latitude,
          longitude: r_longitude
        } : null
      };
    });
  } catch (error) {
    console.log('Error getting meters from local DB:', error);
    return [];
  }
};

// Clear local database (for testing purposes)
export const clearLocalDB = () => {
  try {
    db.execSync(`DELETE FROM readings`);
    db.execSync(`DELETE FROM meters`);
    console.log('Local DB cleared successfully');
    return true;
  } catch (error) {
    console.log('Error clearing local DB:', error);
    return false;
  }
};