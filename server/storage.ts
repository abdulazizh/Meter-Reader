import {
  readers,
  meters,
  readings,
  type Reader,
  type InsertReader,
  type Meter,
  type InsertMeter,
  type Reading,
  type InsertReading,
  type MeterWithReading,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and } from "drizzle-orm";

export interface IStorage {
  getReader(id: string): Promise<Reader | undefined>;
  getReaderByUsername(username: string): Promise<Reader | undefined>;
  createReader(reader: InsertReader): Promise<Reader>;
  
  getMetersByReaderId(readerId: string): Promise<MeterWithReading[]>;
  getMeterById(id: string): Promise<Meter | undefined>;
  createMeter(meter: InsertMeter): Promise<Meter>;
  
  getReadingsByMeterId(meterId: string): Promise<Reading[]>;
  getAllReadingsByReaderId(readerId: string): Promise<Reading[]>;
  getLatestReadingByMeterId(meterId: string): Promise<Reading | undefined>;
  createReading(reading: InsertReading): Promise<Reading>;
  updateMeterAfterReading(meterId: string, newReading: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getReader(id: string): Promise<Reader | undefined> {
    const [reader] = await db.select().from(readers).where(eq(readers.id, id));
    return reader || undefined;
  }

  async getReaderByUsername(username: string): Promise<Reader | undefined> {
    const [reader] = await db.select().from(readers).where(eq(readers.username, username));
    return reader || undefined;
  }

  async createReader(insertReader: InsertReader): Promise<Reader> {
    const [reader] = await db
      .insert(readers)
      .values(insertReader)
      .returning();
    return reader;
  }

  async getMetersByReaderId(readerId: string): Promise<MeterWithReading[]> {
    const metersList = await db
      .select()
      .from(meters)
      .where(eq(meters.readerId, readerId))
      .orderBy(meters.sequence);

    const metersWithReadings: MeterWithReading[] = [];
    
    for (const meter of metersList) {
      const latestReading = await this.getLatestReadingByMeterId(meter.id);
      metersWithReadings.push({
        ...meter,
        latestReading: latestReading || null,
      });
    }

    return metersWithReadings;
  }

  async getMeterById(id: string): Promise<Meter | undefined> {
    const [meter] = await db.select().from(meters).where(eq(meters.id, id));
    return meter || undefined;
  }

  async createMeter(insertMeter: InsertMeter): Promise<Meter> {
    const [meter] = await db
      .insert(meters)
      .values(insertMeter)
      .returning();
    return meter;
  }

  async getReadingsByMeterId(meterId: string): Promise<Reading[]> {
    return db
      .select()
      .from(readings)
      .where(eq(readings.meterId, meterId))
      .orderBy(desc(readings.createdAt));
  }

  async getAllReadingsByReaderId(readerId: string): Promise<Reading[]> {
    return db
      .select()
      .from(readings)
      .where(eq(readings.readerId, readerId))
      .orderBy(desc(readings.createdAt));
  }

  async getLatestReadingByMeterId(meterId: string): Promise<Reading | undefined> {
    const [reading] = await db
      .select()
      .from(readings)
      .where(eq(readings.meterId, meterId))
      .orderBy(desc(readings.createdAt))
      .limit(1);
    return reading || undefined;
  }

  async createReading(insertReading: InsertReading): Promise<Reading> {
    const [reading] = await db
      .insert(readings)
      .values(insertReading)
      .returning();
    return reading;
  }

  async updateMeterAfterReading(meterId: string, newReading: number): Promise<void> {
    await db
      .update(meters)
      .set({
        previousReading: newReading,
        previousReadingDate: new Date(),
      })
      .where(eq(meters.id, meterId));
  }
}

export const storage = new DatabaseStorage();
