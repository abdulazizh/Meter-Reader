var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server/index.ts
import express from "express";
import session from "express-session";

// server/routes.ts
import { createServer } from "node:http";

// shared/schema.ts
var schema_exports = {};
__export(schema_exports, {
  insertMeterSchema: () => insertMeterSchema,
  insertReaderSchema: () => insertReaderSchema,
  insertReadingSchema: () => insertReadingSchema,
  meters: () => meters,
  metersRelations: () => metersRelations,
  readers: () => readers,
  readersRelations: () => readersRelations,
  readings: () => readings,
  readingsRelations: () => readingsRelations
});
import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
var readers = pgTable("readers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  displayName: text("display_name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var readersRelations = relations(readers, ({ many }) => ({
  meters: many(meters),
  readings: many(readings)
}));
var meters = pgTable("meters", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  accountNumber: text("account_number").notNull(),
  sequence: text("sequence").notNull(),
  meterNumber: text("meter_number").notNull(),
  category: text("category").notNull(),
  subscriberName: text("subscriber_name").notNull(),
  address: text("address").default(""),
  record: text("record").notNull(),
  block: text("block").notNull(),
  property: text("property").notNull(),
  previousReading: integer("previous_reading").notNull(),
  previousReadingDate: timestamp("previous_reading_date").notNull(),
  currentAmount: numeric("current_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  debts: numeric("debts", { precision: 12, scale: 2 }).notNull().default("0"),
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  readerId: varchar("reader_id").notNull().references(() => readers.id),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var metersRelations = relations(meters, ({ one, many }) => ({
  reader: one(readers, {
    fields: [meters.readerId],
    references: [readers.id]
  }),
  readings: many(readings)
}));
var readings = pgTable("readings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  meterId: varchar("meter_id").notNull().references(() => meters.id),
  readerId: varchar("reader_id").notNull().references(() => readers.id),
  newReading: integer("new_reading"),
  photoPath: text("photo_path"),
  notes: text("notes"),
  skipReason: text("skip_reason"),
  isCompleted: boolean("is_completed").default(true).notNull(),
  readingDate: timestamp("reading_date").defaultNow().notNull(),
  latitude: numeric("latitude", { precision: 10, scale: 7 }),
  longitude: numeric("longitude", { precision: 10, scale: 7 }),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var readingsRelations = relations(readings, ({ one }) => ({
  meter: one(meters, {
    fields: [readings.meterId],
    references: [meters.id]
  }),
  reader: one(readers, {
    fields: [readings.readerId],
    references: [readers.id]
  })
}));
var insertReaderSchema = createInsertSchema(readers).pick({
  username: true,
  password: true,
  displayName: true
});
var insertMeterSchema = createInsertSchema(meters).pick({
  accountNumber: true,
  sequence: true,
  meterNumber: true,
  category: true,
  subscriberName: true,
  address: true,
  record: true,
  block: true,
  property: true,
  previousReading: true,
  previousReadingDate: true,
  currentAmount: true,
  debts: true,
  totalAmount: true,
  readerId: true
});
var insertReadingSchema = createInsertSchema(readings).pick({
  meterId: true,
  readerId: true,
  newReading: true,
  photoPath: true,
  notes: true,
  skipReason: true,
  readingDate: true,
  latitude: true,
  longitude: true
});

// server/db.ts
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
var { Pool } = pg;
if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?"
  );
}
var pool = new Pool({ connectionString: process.env.DATABASE_URL });
var db = drizzle(pool, { schema: schema_exports });

// server/storage.ts
import { eq, desc } from "drizzle-orm";
var DatabaseStorage = class {
  async getReader(id) {
    const [reader] = await db.select().from(readers).where(eq(readers.id, id));
    return reader || void 0;
  }
  async getReaderByUsername(username) {
    const [reader] = await db.select().from(readers).where(eq(readers.username, username));
    return reader || void 0;
  }
  async createReader(insertReader) {
    const [reader] = await db.insert(readers).values(insertReader).returning();
    return reader;
  }
  async getMetersByReaderId(readerId) {
    const metersList = await db.select().from(meters).where(eq(meters.readerId, readerId)).orderBy(meters.sequence);
    const metersWithReadings = [];
    for (const meter of metersList) {
      const latestReading = await this.getLatestReadingByMeterId(meter.id);
      metersWithReadings.push({
        ...meter,
        latestReading: latestReading || null
      });
    }
    return metersWithReadings;
  }
  async getMeterById(id) {
    const [meter] = await db.select().from(meters).where(eq(meters.id, id));
    return meter || void 0;
  }
  async createMeter(insertMeter) {
    const [meter] = await db.insert(meters).values(insertMeter).returning();
    return meter;
  }
  async getReadingsByMeterId(meterId) {
    return db.select().from(readings).where(eq(readings.meterId, meterId)).orderBy(desc(readings.createdAt));
  }
  async getAllReadingsByReaderId(readerId) {
    return db.select().from(readings).where(eq(readings.readerId, readerId)).orderBy(desc(readings.createdAt));
  }
  async getLatestReadingByMeterId(meterId) {
    const [reading] = await db.select().from(readings).where(eq(readings.meterId, meterId)).orderBy(desc(readings.createdAt)).limit(1);
    return reading || void 0;
  }
  async createReading(insertReading) {
    const [reading] = await db.insert(readings).values(insertReading).returning();
    return reading;
  }
  async updateMeterAfterReading(meterId, newReading) {
    await db.update(meters).set({
      previousReading: newReading,
      previousReadingDate: /* @__PURE__ */ new Date()
    }).where(eq(meters.id, meterId));
  }
  async getAllReaders() {
    return db.select().from(readers);
  }
  async updateReader(id, data) {
    const updateData = {};
    if (data.username) updateData.username = data.username;
    if (data.displayName) updateData.displayName = data.displayName;
    if (data.password) updateData.password = data.password;
    const [reader] = await db.update(readers).set(updateData).where(eq(readers.id, id)).returning();
    return reader;
  }
  async deleteReader(id) {
    await db.delete(readers).where(eq(readers.id, id));
  }
  async getAllMeters() {
    const metersList = await db.select().from(meters).orderBy(meters.sequence);
    const metersWithReadings = [];
    for (const meter of metersList) {
      const latestReading = await this.getLatestReadingByMeterId(meter.id);
      metersWithReadings.push({
        ...meter,
        latestReading: latestReading || null
      });
    }
    return metersWithReadings;
  }
  async updateMeter(id, data) {
    const [meter] = await db.update(meters).set(data).where(eq(meters.id, id)).returning();
    return meter;
  }
  async deleteMeter(id) {
    await db.delete(readings).where(eq(readings.meterId, id));
    await db.delete(meters).where(eq(meters.id, id));
  }
  async getAllReadings() {
    return db.select().from(readings).orderBy(desc(readings.createdAt));
  }
  async getReadingById(id) {
    const [reading] = await db.select().from(readings).where(eq(readings.id, id));
    return reading || void 0;
  }
  async updateReading(id, data) {
    const [reading] = await db.update(readings).set(data).where(eq(readings.id, id)).returning();
    return reading;
  }
  async deleteReading(id) {
    await db.delete(readings).where(eq(readings.id, id));
  }
  async getReadingsByMonth(year, month) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);
    const allReadings = await db.select().from(readings).orderBy(desc(readings.createdAt));
    return allReadings.filter((r) => {
      if (!r.readingDate) return false;
      const date = new Date(r.readingDate);
      return date >= startDate && date <= endDate;
    });
  }
};
var storage = new DatabaseStorage();

// server/routes.ts
import { createClient } from "@supabase/supabase-js";
async function registerRoutes(app2) {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing Supabase credentials in environment variables");
  }
  const supabase = createClient(supabaseUrl, supabaseKey);
  app2.post("/api/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ success: false, error: "\u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u0648\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0645\u0637\u0644\u0648\u0628\u0627\u0646" });
      }
      const reader = await storage.getReaderByUsername(username);
      if (!reader) {
        return res.status(401).json({ success: false, error: "\u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" });
      }
      if (reader.password !== password) {
        return res.status(401).json({ success: false, error: "\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629" });
      }
      res.json({
        success: true,
        reader: {
          id: reader.id,
          username: reader.username,
          displayName: reader.displayName
        }
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ success: false, error: "\u062D\u062F\u062B \u062E\u0637\u0623 \u0641\u064A \u0627\u0644\u062E\u0627\u062F\u0645" });
    }
  });
  app2.get("/api/meters/:readerId", async (req, res) => {
    try {
      const { readerId } = req.params;
      const meters2 = await storage.getMetersByReaderId(readerId);
      res.json(meters2);
    } catch (error) {
      console.error("Error fetching meters:", error);
      res.status(500).json({ error: "Failed to fetch meters" });
    }
  });
  app2.get("/api/meter/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const meter = await storage.getMeterById(id);
      if (!meter) {
        return res.status(404).json({ error: "Meter not found" });
      }
      res.json(meter);
    } catch (error) {
      console.error("Error fetching meter:", error);
      res.status(500).json({ error: "Failed to fetch meter" });
    }
  });
  app2.post("/api/readings", async (req, res) => {
    try {
      const { meterId, readerId, newReading, photoPath, notes, skipReason } = req.body;
      if (!meterId || !readerId) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      if (skipReason) {
        const reading2 = await storage.createReading({
          meterId,
          readerId,
          newReading: null,
          photoPath: null,
          notes: null,
          skipReason
        });
        res.status(201).json(reading2);
        return;
      }
      if (newReading === void 0 || newReading === null) {
        return res.status(400).json({ error: "Missing reading value" });
      }
      const reading = await storage.createReading({
        meterId,
        readerId,
        newReading: parseInt(newReading, 10),
        photoPath: photoPath || null,
        notes: notes || null,
        skipReason: null
      });
      await storage.updateMeterAfterReading(meterId, parseInt(newReading, 10));
      res.status(201).json(reading);
    } catch (error) {
      console.error("Error creating reading:", error);
      res.status(500).json({ error: "Failed to create reading" });
    }
  });
  app2.get("/api/readings/:meterId", async (req, res) => {
    try {
      const { meterId } = req.params;
      const readings2 = await storage.getReadingsByMeterId(meterId);
      res.json(readings2);
    } catch (error) {
      console.error("Error fetching readings:", error);
      res.status(500).json({ error: "Failed to fetch readings" });
    }
  });
  app2.post("/api/seed", async (req, res) => {
    try {
      let reader = await storage.getReaderByUsername("demo");
      if (!reader) {
        reader = await storage.createReader({
          username: "demo",
          password: "demo123",
          displayName: "\u0642\u0627\u0631\u0626 \u062A\u062C\u0631\u064A\u0628\u064A"
        });
      }
      const existingMeters = await storage.getMetersByReaderId(reader.id);
      if (existingMeters.length === 0) {
        const sampleMeters = [
          {
            accountNumber: "1001234567",
            sequence: "001",
            meterNumber: "M-2024-001",
            category: "\u0633\u0643\u0646\u064A",
            subscriberName: "\u0623\u062D\u0645\u062F \u0645\u062D\u0645\u062F \u0639\u0644\u064A",
            record: "1",
            block: "5",
            property: "12",
            previousReading: 15420,
            previousReadingDate: /* @__PURE__ */ new Date("2024-12-15"),
            currentAmount: "45000",
            debts: "12500",
            totalAmount: "57500"
          },
          {
            accountNumber: "1001234568",
            sequence: "002",
            meterNumber: "M-2024-002",
            category: "\u062A\u062C\u0627\u0631\u064A",
            subscriberName: "\u0645\u062D\u0644 \u0627\u0644\u0631\u062D\u0645\u0646 \u0644\u0644\u062A\u062C\u0627\u0631\u0629",
            record: "1",
            block: "5",
            property: "13",
            previousReading: 28750,
            previousReadingDate: /* @__PURE__ */ new Date("2024-12-15"),
            currentAmount: "125000",
            debts: "0",
            totalAmount: "125000"
          },
          {
            accountNumber: "1001234569",
            sequence: "003",
            meterNumber: "M-2024-003",
            category: "\u0635\u0646\u0627\u0639\u064A",
            subscriberName: "\u0645\u0635\u0646\u0639 \u0627\u0644\u0646\u0648\u0631 \u0644\u0644\u062D\u062F\u064A\u062F",
            record: "1",
            block: "5",
            property: "14",
            previousReading: 45230,
            previousReadingDate: /* @__PURE__ */ new Date("2024-12-15"),
            currentAmount: "350000",
            debts: "75000",
            totalAmount: "425000"
          },
          {
            accountNumber: "1001234570",
            sequence: "004",
            meterNumber: "M-2024-004",
            category: "\u0633\u0643\u0646\u064A",
            subscriberName: "\u0641\u0627\u0637\u0645\u0629 \u062D\u0633\u064A\u0646 \u062C\u0627\u0633\u0645",
            record: "1",
            block: "6",
            property: "1",
            previousReading: 12100,
            previousReadingDate: /* @__PURE__ */ new Date("2024-12-14"),
            currentAmount: "32000",
            debts: "8500",
            totalAmount: "40500"
          },
          {
            accountNumber: "1001234571",
            sequence: "005",
            meterNumber: "M-2024-005",
            category: "\u0633\u0643\u0646\u064A",
            subscriberName: "\u0639\u0644\u064A \u0639\u0628\u062F \u0627\u0644\u0643\u0631\u064A\u0645",
            record: "1",
            block: "6",
            property: "2",
            previousReading: 8750,
            previousReadingDate: /* @__PURE__ */ new Date("2024-12-14"),
            currentAmount: "28000",
            debts: "0",
            totalAmount: "28000"
          },
          {
            accountNumber: "1001234572",
            sequence: "006",
            meterNumber: "M-2024-006",
            category: "\u062A\u062C\u0627\u0631\u064A",
            subscriberName: "\u0645\u0637\u0639\u0645 \u0627\u0644\u0635\u0641\u0627",
            record: "2",
            block: "1",
            property: "1",
            previousReading: 35600,
            previousReadingDate: /* @__PURE__ */ new Date("2024-12-13"),
            currentAmount: "95000",
            debts: "22000",
            totalAmount: "117000"
          }
        ];
        for (const meterData of sampleMeters) {
          await storage.createMeter({
            ...meterData,
            readerId: reader.id
          });
        }
      }
      res.json({ success: true, readerId: reader.id });
    } catch (error) {
      console.error("Error seeding data:", error);
      res.status(500).json({ error: "Failed to seed data" });
    }
  });
  app2.get("/api/export/:readerId", async (req, res) => {
    try {
      const { readerId } = req.params;
      const meters2 = await storage.getMetersByReaderId(readerId);
      const allReadings = await storage.getAllReadingsByReaderId(readerId);
      const exportData = {
        exportDate: (/* @__PURE__ */ new Date()).toISOString(),
        readerId,
        totalMeters: meters2.length,
        completedReadings: allReadings.length,
        meters: meters2.map((meter) => {
          const meterReadings = allReadings.filter((r) => r.meterId === meter.id);
          return {
            accountNumber: meter.accountNumber,
            sequence: meter.sequence,
            meterNumber: meter.meterNumber,
            category: meter.category,
            subscriberName: meter.subscriberName,
            address: {
              record: meter.record,
              block: meter.block,
              property: meter.property
            },
            previousReading: meter.previousReading,
            previousReadingDate: meter.previousReadingDate,
            amounts: {
              currentAmount: meter.currentAmount,
              debts: meter.debts,
              totalAmount: meter.totalAmount
            },
            readings: meterReadings.map((r) => ({
              newReading: r.newReading,
              photoPath: r.photoPath,
              notes: r.notes,
              skipReason: r.skipReason,
              createdAt: r.createdAt
            }))
          };
        })
      };
      res.json(exportData);
    } catch (error) {
      console.error("Error exporting data:", error);
      res.status(500).json({ error: "Failed to export data" });
    }
  });
  app2.get("/api/reader/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const reader = await storage.getReader(id);
      if (!reader) {
        return res.status(404).json({ error: "Reader not found" });
      }
      const meters2 = await storage.getMetersByReaderId(id);
      const allReadings = await storage.getAllReadingsByReaderId(id);
      const completedMeters = meters2.filter((m) => m.latestReading !== null).length;
      res.json({
        id: reader.id,
        username: reader.username,
        displayName: reader.displayName,
        stats: {
          totalMeters: meters2.length,
          completedMeters,
          totalReadings: allReadings.length
        }
      });
    } catch (error) {
      console.error("Error fetching reader:", error);
      res.status(500).json({ error: "Failed to fetch reader" });
    }
  });
  app2.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });
  app2.post("/api/upload-photo", async (req, res) => {
    try {
      const { photoBase64, fileName } = req.body;
      if (!photoBase64 || !fileName) {
        return res.status(400).json({ error: "Missing photo data or filename" });
      }
      const base64Data = photoBase64.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");
      const photoPath = `${fileName}`;
      const { data, error } = await supabase.storage.from("photos").upload(photoPath, buffer, {
        contentType: "image/jpeg",
        upsert: true
      });
      if (error) {
        console.error("Upload error:", error);
        return res.status(500).json({ error: "Failed to upload photo to Supabase" });
      }
      res.json({
        success: true,
        photoPath: data.path,
        message: "Photo uploaded successfully"
      });
    } catch (error) {
      console.error("Error uploading photo:", error);
      res.status(500).json({ error: "Failed to upload photo" });
    }
  });
  app2.get("/api/photo/:path(*)", async (req, res) => {
    try {
      const photoPath = req.params.path;
      const { data, error } = await supabase.storage.from("photos").download(photoPath);
      if (error || !data) {
        console.error("Download error:", error);
        return res.status(404).json({ error: "Photo not found" });
      }
      const buffer = Buffer.from(await data.arrayBuffer());
      res.setHeader("Content-Type", "image/jpeg");
      res.send(buffer);
    } catch (error) {
      console.error("Error fetching photo:", error);
      res.status(500).json({ error: "Failed to fetch photo" });
    }
  });
  const httpServer = createServer(app2);
  return httpServer;
}

// server/adminRoutes.ts
import path from "node:path";
import * as XLSX from "xlsx";
var ADMIN_USERNAME = "admin";
var ADMIN_PASSWORD = "admin123";
function requireAdmin(req, res, next) {
  if (req.session?.isAdmin) {
    return next();
  }
  if (req.path.startsWith("/api/")) {
    return res.status(401).json({ error: "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D - \u064A\u0631\u062C\u0649 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644" });
  }
  return res.redirect("/admin/login");
}
function registerAdminRoutes(app2) {
  app2.get("/admin/login", (req, res) => {
    res.sendFile(path.join(process.cwd(), "server/templates/admin/login.html"));
  });
  app2.post("/api/admin/login", (req, res) => {
    const { username, password } = req.body;
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      req.session.isAdmin = true;
      return res.json({ success: true });
    }
    return res.status(401).json({ success: false, error: "\u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u0623\u0648 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629" });
  });
  app2.post("/api/admin/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: "\u0641\u0634\u0644 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062E\u0631\u0648\u062C" });
      }
      res.json({ success: true });
    });
  });
  app2.get("/admin", requireAdmin, (req, res) => {
    res.sendFile(path.join(process.cwd(), "server/templates/admin/index.html"));
  });
  app2.get("/api/admin/readers", requireAdmin, async (req, res) => {
    try {
      const readers2 = await storage.getAllReaders();
      const readersWithCounts = await Promise.all(
        readers2.map(async (reader) => {
          const meters2 = await storage.getMetersByReaderId(reader.id);
          return { ...reader, meterCount: meters2.length };
        })
      );
      res.json(readersWithCounts);
    } catch (error) {
      console.error("Error fetching readers:", error);
      res.status(500).json({ error: "Failed to fetch readers" });
    }
  });
  app2.post("/api/admin/readers", requireAdmin, async (req, res) => {
    try {
      const { username, password, displayName } = req.body;
      const reader = await storage.createReader({
        username,
        password,
        displayName
      });
      res.status(201).json(reader);
    } catch (error) {
      console.error("Error creating reader:", error);
      res.status(500).json({ error: "Failed to create reader" });
    }
  });
  app2.put("/api/admin/readers/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { username, password, displayName } = req.body;
      const reader = await storage.updateReader(id, {
        username,
        password: password || void 0,
        displayName
      });
      res.json(reader);
    } catch (error) {
      console.error("Error updating reader:", error);
      res.status(500).json({ error: "Failed to update reader" });
    }
  });
  app2.delete("/api/admin/readers/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteReader(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting reader:", error);
      res.status(500).json({ error: "Failed to delete reader" });
    }
  });
  app2.get("/api/admin/meters", requireAdmin, async (req, res) => {
    try {
      const meters2 = await storage.getAllMeters();
      res.json(meters2);
    } catch (error) {
      console.error("Error fetching meters:", error);
      res.status(500).json({ error: "Failed to fetch meters" });
    }
  });
  app2.post("/api/admin/meters", requireAdmin, async (req, res) => {
    try {
      const meter = await storage.createMeter(req.body);
      res.status(201).json(meter);
    } catch (error) {
      console.error("Error creating meter:", error);
      res.status(500).json({ error: "Failed to create meter" });
    }
  });
  app2.put("/api/admin/meters/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const meter = await storage.updateMeter(id, req.body);
      res.json(meter);
    } catch (error) {
      console.error("Error updating meter:", error);
      res.status(500).json({ error: "Failed to update meter" });
    }
  });
  app2.delete("/api/admin/meters/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteMeter(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting meter:", error);
      res.status(500).json({ error: "Failed to delete meter" });
    }
  });
  app2.get("/api/admin/readings", requireAdmin, async (req, res) => {
    try {
      const { year, month } = req.query;
      let readings2;
      if (year && month) {
        readings2 = await storage.getReadingsByMonth(parseInt(year), parseInt(month));
      } else {
        readings2 = await storage.getAllReadings();
      }
      res.json(readings2);
    } catch (error) {
      console.error("Error fetching readings:", error);
      res.status(500).json({ error: "Failed to fetch readings" });
    }
  });
  app2.get("/api/admin/readings/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const reading = await storage.getReadingById(id);
      if (!reading) {
        return res.status(404).json({ error: "Reading not found" });
      }
      res.json(reading);
    } catch (error) {
      console.error("Error fetching reading:", error);
      res.status(500).json({ error: "Failed to fetch reading" });
    }
  });
  app2.put("/api/admin/readings/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { newReading, notes, skipReason } = req.body;
      const reading = await storage.updateReading(id, {
        newReading: newReading !== void 0 ? parseInt(newReading) : void 0,
        notes,
        skipReason
      });
      res.json(reading);
    } catch (error) {
      console.error("Error updating reading:", error);
      res.status(500).json({ error: "Failed to update reading" });
    }
  });
  app2.delete("/api/admin/readings/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteReading(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting reading:", error);
      res.status(500).json({ error: "Failed to delete reading" });
    }
  });
  app2.post("/api/admin/import/:type", requireAdmin, async (req, res) => {
    try {
      const { type } = req.params;
      const data = req.body;
      if (!Array.isArray(data)) {
        return res.status(400).json({ error: "Data must be an array" });
      }
      let count = 0;
      if (type === "readers") {
        for (const item of data) {
          await storage.createReader({
            username: item.username,
            password: item.password || "123456",
            displayName: item.displayName || item.username
          });
          count++;
        }
      } else if (type === "meters") {
        for (const item of data) {
          await storage.createMeter({
            accountNumber: item.accountNumber,
            sequence: item.sequence || "001",
            meterNumber: item.meterNumber,
            category: item.category || "\u0633\u0643\u0646\u064A",
            subscriberName: item.subscriberName,
            record: item.record || "1",
            block: item.block || "1",
            property: item.property || "1",
            previousReading: parseInt(item.previousReading) || 0,
            previousReadingDate: item.previousReadingDate ? new Date(item.previousReadingDate) : /* @__PURE__ */ new Date(),
            currentAmount: item.currentAmount || "0",
            debts: item.debts || "0",
            totalAmount: item.totalAmount || "0",
            readerId: item.readerId
          });
          count++;
        }
      }
      res.json({ success: true, count });
    } catch (error) {
      console.error("Error importing data:", error);
      res.status(500).json({ error: "Failed to import data" });
    }
  });
  app2.get("/api/admin/export/:type", requireAdmin, async (req, res) => {
    try {
      const { type } = req.params;
      const { readerId } = req.query;
      let data = [];
      const allReaders = await storage.getAllReaders();
      const allMeters = await storage.getAllMeters();
      if (type === "all" || type === "readers") {
        const readersExport = allReaders.map((r) => ({
          \u0627\u0633\u0645_\u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645: r.username,
          \u0627\u0644\u0627\u0633\u0645_\u0627\u0644\u0643\u0627\u0645\u0644: r.displayName,
          \u062A\u0627\u0631\u064A\u062E_\u0627\u0644\u0625\u0646\u0634\u0627\u0621: r.createdAt
        }));
        if (type === "readers") {
          data = readersExport;
        } else {
          data.push(...readersExport.map((r) => ({ ...r, _type: "reader" })));
        }
      }
      if (type === "all" || type === "meters") {
        let meters2 = allMeters;
        if (readerId && typeof readerId === "string") {
          meters2 = meters2.filter((m) => m.readerId === readerId);
        }
        const metersExport = meters2.map((m) => {
          const reader = allReaders.find((r) => r.id === m.readerId);
          return {
            \u0631\u0642\u0645_\u0627\u0644\u062D\u0633\u0627\u0628: m.accountNumber,
            \u0627\u0644\u062A\u0633\u0644\u0633\u0644: m.sequence,
            \u0631\u0642\u0645_\u0627\u0644\u0645\u0642\u064A\u0627\u0633: m.meterNumber,
            \u0627\u0644\u0635\u0646\u0641: m.category,
            \u0627\u0633\u0645_\u0627\u0644\u0645\u0634\u062A\u0631\u0643: m.subscriberName,
            \u0627\u0644\u0639\u0646\u0648\u0627\u0646: m.address || "",
            \u0627\u0644\u0633\u062C\u0644: m.record,
            \u0627\u0644\u0628\u0644\u0648\u0643: m.block,
            \u0627\u0644\u0639\u0642\u0627\u0631: m.property,
            \u0627\u0644\u0642\u0631\u0627\u0621\u0629_\u0627\u0644\u0633\u0627\u0628\u0642\u0629: m.previousReading,
            \u062A\u0627\u0631\u064A\u062E_\u0627\u0644\u0642\u0631\u0627\u0621\u0629_\u0627\u0644\u0633\u0627\u0628\u0642\u0629: m.previousReadingDate,
            \u0627\u0644\u0645\u0628\u0644\u063A_\u0627\u0644\u062D\u0627\u0644\u064A: m.currentAmount,
            \u0627\u0644\u062F\u064A\u0648\u0646: m.debts,
            \u0627\u0644\u0645\u062C\u0645\u0648\u0639: m.totalAmount,
            \u0627\u0644\u0642\u0627\u0631\u0626: reader?.displayName || ""
          };
        });
        if (type === "meters") {
          data = metersExport;
        } else {
          data.push(...metersExport.map((m) => ({ ...m, _type: "meter" })));
        }
      }
      if (type === "all" || type === "readings") {
        let readings2 = await storage.getAllReadings();
        if (readerId && typeof readerId === "string") {
          readings2 = readings2.filter((r) => r.readerId === readerId);
        }
        const readingsExport = readings2.map((r) => {
          const meter = allMeters.find((m) => m.id === r.meterId);
          const reader = allReaders.find((rd) => rd.id === r.readerId);
          const prevReading = meter?.previousReading || 0;
          const newReading = r.newReading || 0;
          const difference = r.newReading !== null ? newReading - prevReading : null;
          return {
            \u0631\u0642\u0645_\u0627\u0644\u062D\u0633\u0627\u0628: meter?.accountNumber || "",
            \u0627\u0633\u0645_\u0627\u0644\u0645\u0634\u062A\u0631\u0643: meter?.subscriberName || "",
            \u0631\u0642\u0645_\u0627\u0644\u0645\u0642\u064A\u0627\u0633: meter?.meterNumber || "",
            \u0627\u0644\u0635\u0646\u0641: meter?.category || "",
            \u0627\u0644\u0639\u0646\u0648\u0627\u0646: meter?.address || "",
            \u0627\u0644\u0642\u0627\u0631\u0626: reader?.displayName || "",
            \u0627\u0644\u0642\u0631\u0627\u0621\u0629_\u0627\u0644\u0633\u0627\u0628\u0642\u0629: meter?.previousReading || 0,
            \u0627\u0644\u0642\u0631\u0627\u0621\u0629_\u0627\u0644\u062C\u062F\u064A\u062F\u0629: r.newReading,
            \u0627\u0644\u0641\u0631\u0642: difference,
            \u0633\u0628\u0628_\u0627\u0644\u062A\u062E\u0637\u064A: r.skipReason || "",
            \u062A\u0627\u0631\u064A\u062E_\u0627\u0644\u0642\u0631\u0627\u0621\u0629: r.readingDate,
            \u062E\u0637_\u0627\u0644\u0639\u0631\u0636: r.latitude || "",
            \u062E\u0637_\u0627\u0644\u0637\u0648\u0644: r.longitude || "",
            \u0631\u0627\u0628\u0637_\u0627\u0644\u0645\u0648\u0642\u0639: r.latitude && r.longitude ? `https://www.google.com/maps?q=${r.latitude},${r.longitude}` : "",
            \u0627\u0644\u0635\u0648\u0631\u0629: r.photoPath ? "\u0645\u062A\u0648\u0641\u0631\u0629" : "\u063A\u064A\u0631 \u0645\u062A\u0648\u0641\u0631\u0629",
            \u0645\u0633\u0627\u0631_\u0627\u0644\u0635\u0648\u0631\u0629: r.photoPath || "",
            \u0627\u0644\u0645\u0644\u0627\u062D\u0638\u0627\u062A: r.notes || ""
          };
        });
        if (type === "readings") {
          data = readingsExport;
        } else {
          data.push(...readingsExport.map((r) => ({ ...r, _type: "reading" })));
        }
      }
      res.json(data);
    } catch (error) {
      console.error("Error exporting data:", error);
      res.status(500).json({ error: "Failed to export data" });
    }
  });
  app2.get("/api/admin/export-excel/:type", requireAdmin, async (req, res) => {
    try {
      const { type } = req.params;
      const { readerId } = req.query;
      const allReaders = await storage.getAllReaders();
      const allMeters = await storage.getAllMeters();
      const workbook = XLSX.utils.book_new();
      if (type === "all" || type === "readers") {
        const readersData = allReaders.map((r) => ({
          "\u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645": r.username,
          "\u0627\u0644\u0627\u0633\u0645 \u0627\u0644\u0643\u0627\u0645\u0644": r.displayName,
          "\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0625\u0646\u0634\u0627\u0621": r.createdAt ? new Date(r.createdAt).toLocaleDateString("ar-IQ") : ""
        }));
        const readersSheet = XLSX.utils.json_to_sheet(readersData);
        XLSX.utils.book_append_sheet(workbook, readersSheet, "\u0627\u0644\u0642\u0631\u0627\u0621");
      }
      if (type === "all" || type === "meters") {
        let meters2 = allMeters;
        if (readerId && typeof readerId === "string") {
          meters2 = meters2.filter((m) => m.readerId === readerId);
        }
        const metersData = meters2.map((m) => {
          const reader = allReaders.find((r) => r.id === m.readerId);
          return {
            "\u0631\u0642\u0645 \u0627\u0644\u062D\u0633\u0627\u0628": m.accountNumber,
            "\u0627\u0644\u062A\u0633\u0644\u0633\u0644": m.sequence,
            "\u0631\u0642\u0645 \u0627\u0644\u0645\u0642\u064A\u0627\u0633": m.meterNumber,
            "\u0627\u0644\u0635\u0646\u0641": m.category,
            "\u0627\u0633\u0645 \u0627\u0644\u0645\u0634\u062A\u0631\u0643": m.subscriberName,
            "\u0627\u0644\u0639\u0646\u0648\u0627\u0646": m.address || "",
            "\u0627\u0644\u0633\u062C\u0644": m.record,
            "\u0627\u0644\u0628\u0644\u0648\u0643": m.block,
            "\u0627\u0644\u0639\u0642\u0627\u0631": m.property,
            "\u0627\u0644\u0642\u0631\u0627\u0621\u0629 \u0627\u0644\u0633\u0627\u0628\u0642\u0629": m.previousReading,
            "\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0642\u0631\u0627\u0621\u0629 \u0627\u0644\u0633\u0627\u0628\u0642\u0629": m.previousReadingDate ? new Date(m.previousReadingDate).toLocaleDateString("ar-IQ") : "",
            "\u0627\u0644\u0645\u0628\u0644\u063A \u0627\u0644\u062D\u0627\u0644\u064A": parseFloat(m.currentAmount || "0"),
            "\u0627\u0644\u062F\u064A\u0648\u0646": parseFloat(m.debts || "0"),
            "\u0627\u0644\u0645\u062C\u0645\u0648\u0639": parseFloat(m.totalAmount || "0"),
            "\u0627\u0644\u0642\u0627\u0631\u0626": reader?.displayName || ""
          };
        });
        const metersSheet = XLSX.utils.json_to_sheet(metersData);
        XLSX.utils.book_append_sheet(workbook, metersSheet, "\u0627\u0644\u0645\u0634\u062A\u0631\u0643\u064A\u0646");
      }
      if (type === "all" || type === "readings") {
        let readings2 = await storage.getAllReadings();
        if (readerId && typeof readerId === "string") {
          readings2 = readings2.filter((r) => r.readerId === readerId);
        }
        const readingsData = readings2.map((r) => {
          const meter = allMeters.find((m) => m.id === r.meterId);
          const reader = allReaders.find((rd) => rd.id === r.readerId);
          const prevReading = meter?.previousReading || 0;
          const newReading = r.newReading || 0;
          const difference = r.newReading !== null ? newReading - prevReading : null;
          return {
            "\u0631\u0642\u0645 \u0627\u0644\u062D\u0633\u0627\u0628": meter?.accountNumber || "",
            "\u0627\u0633\u0645 \u0627\u0644\u0645\u0634\u062A\u0631\u0643": meter?.subscriberName || "",
            "\u0631\u0642\u0645 \u0627\u0644\u0645\u0642\u064A\u0627\u0633": meter?.meterNumber || "",
            "\u0627\u0644\u0635\u0646\u0641": meter?.category || "",
            "\u0627\u0644\u0639\u0646\u0648\u0627\u0646": meter?.address || "",
            "\u0627\u0644\u0642\u0627\u0631\u0626": reader?.displayName || "",
            "\u0627\u0644\u0642\u0631\u0627\u0621\u0629 \u0627\u0644\u0633\u0627\u0628\u0642\u0629": meter?.previousReading || 0,
            "\u0627\u0644\u0642\u0631\u0627\u0621\u0629 \u0627\u0644\u062C\u062F\u064A\u062F\u0629": r.newReading,
            "\u0627\u0644\u0641\u0631\u0642": difference,
            "\u0633\u0628\u0628 \u0627\u0644\u062A\u062E\u0637\u064A": r.skipReason || "",
            "\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0642\u0631\u0627\u0621\u0629": r.readingDate ? new Date(r.readingDate).toLocaleDateString("ar-IQ") + " " + new Date(r.readingDate).toLocaleTimeString("ar-IQ") : "",
            "\u062E\u0637 \u0627\u0644\u0639\u0631\u0636": r.latitude ? parseFloat(r.latitude) : "",
            "\u062E\u0637 \u0627\u0644\u0637\u0648\u0644": r.longitude ? parseFloat(r.longitude) : "",
            "\u0631\u0627\u0628\u0637 \u0627\u0644\u0645\u0648\u0642\u0639": r.latitude && r.longitude ? `https://www.google.com/maps?q=${r.latitude},${r.longitude}` : "",
            "\u0627\u0644\u0635\u0648\u0631\u0629": r.photoPath ? "\u0645\u062A\u0648\u0641\u0631\u0629" : "\u063A\u064A\u0631 \u0645\u062A\u0648\u0641\u0631\u0629",
            "\u0645\u0633\u0627\u0631 \u0627\u0644\u0635\u0648\u0631\u0629": r.photoPath || "",
            "\u0627\u0644\u0645\u0644\u0627\u062D\u0638\u0627\u062A": r.notes || ""
          };
        });
        const readingsSheet = XLSX.utils.json_to_sheet(readingsData);
        XLSX.utils.book_append_sheet(workbook, readingsSheet, "\u0627\u0644\u0642\u0631\u0627\u0621\u0627\u062A");
      }
      const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename=export_${type}_${Date.now()}.xlsx`);
      res.send(buffer);
    } catch (error) {
      console.error("Error exporting Excel:", error);
      res.status(500).json({ error: "Failed to export Excel" });
    }
  });
}

// server/index.ts
import * as fs from "fs";
import * as path2 from "path";
var app = express();
var log = console.log;
function setupCors(app2) {
  app2.use((req, res, next) => {
    const origins = /* @__PURE__ */ new Set();
    if (process.env.REPLIT_DEV_DOMAIN) {
      origins.add(`https://${process.env.REPLIT_DEV_DOMAIN}`);
    }
    if (process.env.REPLIT_DOMAINS) {
      process.env.REPLIT_DOMAINS.split(",").forEach((d) => {
        origins.add(`https://${d.trim()}`);
      });
    }
    const origin = req.header("origin");
    const isLocalhost = origin?.startsWith("http://localhost:") || origin?.startsWith("http://127.0.0.1:");
    if (origin && (origins.has(origin) || isLocalhost)) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, DELETE, OPTIONS"
      );
      res.header("Access-Control-Allow-Headers", "Content-Type");
      res.header("Access-Control-Allow-Credentials", "true");
    }
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });
}
function setupBodyParsing(app2) {
  app2.use(
    express.json({
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      }
    })
  );
  app2.use(express.urlencoded({ extended: false }));
}
function setupRequestLogging(app2) {
  app2.use((req, res, next) => {
    const start = Date.now();
    const path3 = req.path;
    let capturedJsonResponse = void 0;
    const originalResJson = res.json;
    res.json = function(bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };
    res.on("finish", () => {
      if (!path3.startsWith("/api")) return;
      const duration = Date.now() - start;
      let logLine = `${req.method} ${path3} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log(logLine);
    });
    next();
  });
}
function getAppName() {
  try {
    const appJsonPath = path2.resolve(process.cwd(), "app.json");
    const appJsonContent = fs.readFileSync(appJsonPath, "utf-8");
    const appJson = JSON.parse(appJsonContent);
    return appJson.expo?.name || "App Landing Page";
  } catch {
    return "App Landing Page";
  }
}
function serveExpoManifest(platform, res) {
  const manifestPath = path2.resolve(
    process.cwd(),
    "static-build",
    platform,
    "manifest.json"
  );
  if (!fs.existsSync(manifestPath)) {
    return res.status(404).json({ error: `Manifest not found for platform: ${platform}` });
  }
  res.setHeader("expo-protocol-version", "1");
  res.setHeader("expo-sfv-version", "0");
  res.setHeader("content-type", "application/json");
  const manifest = fs.readFileSync(manifestPath, "utf-8");
  res.send(manifest);
}
function serveLandingPage({
  req,
  res,
  landingPageTemplate,
  appName
}) {
  const forwardedProto = req.header("x-forwarded-proto");
  const protocol = forwardedProto || req.protocol || "https";
  const forwardedHost = req.header("x-forwarded-host");
  const host = forwardedHost || req.get("host");
  const baseUrl = `${protocol}://${host}`;
  const expsUrl = `${host}`;
  log(`baseUrl`, baseUrl);
  log(`expsUrl`, expsUrl);
  const html = landingPageTemplate.replace(/BASE_URL_PLACEHOLDER/g, baseUrl).replace(/EXPS_URL_PLACEHOLDER/g, expsUrl).replace(/APP_NAME_PLACEHOLDER/g, appName);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(html);
}
function configureExpoAndLanding(app2) {
  const templatePath = path2.resolve(
    process.cwd(),
    "server",
    "templates",
    "landing-page.html"
  );
  const landingPageTemplate = fs.readFileSync(templatePath, "utf-8");
  const appName = getAppName();
  log("Serving static Expo files with dynamic manifest routing");
  app2.use((req, res, next) => {
    if (req.path.startsWith("/api")) {
      return next();
    }
    if (req.path !== "/" && req.path !== "/manifest") {
      return next();
    }
    const platform = req.header("expo-platform");
    if (platform && (platform === "ios" || platform === "android")) {
      return serveExpoManifest(platform, res);
    }
    if (req.path === "/") {
      return serveLandingPage({
        req,
        res,
        landingPageTemplate,
        appName
      });
    }
    next();
  });
  app2.use("/assets", express.static(path2.resolve(process.cwd(), "assets")));
  app2.use(express.static(path2.resolve(process.cwd(), "static-build")));
  log("Expo routing: Checking expo-platform header on / and /manifest");
}
function setupErrorHandler(app2) {
  app2.use((err, _req, res, _next) => {
    const error = err;
    const status = error.status || error.statusCode || 500;
    const message = error.message || "Internal Server Error";
    res.status(status).json({ message });
    throw err;
  });
}
(async () => {
  setupCors(app);
  setupBodyParsing(app);
  app.use(session({
    secret: process.env.SESSION_SECRET || "dev-secret-key-change-in-production",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1e3
      // 24 hours
    }
  }));
  setupRequestLogging(app);
  registerAdminRoutes(app);
  configureExpoAndLanding(app);
  const server = await registerRoutes(app);
  setupErrorHandler(app);
  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen(
    {
      port,
      host: "0.0.0.0"
    },
    () => {
      log(`express server serving on port ${port}`);
    }
  );
})();
