import type { Express } from "express";
import { createServer, type Server } from "node:http";
import { storage } from "./storage";
import type { InsertMeter } from "@shared/schema";
import { createClient } from "@supabase/supabase-js";

export async function registerRoutes(app: Express): Promise<Server> {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing Supabase credentials in environment variables");
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  app.post("/api/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ success: false, error: "اسم المستخدم وكلمة المرور مطلوبان" });
      }
      
      const reader = await storage.getReaderByUsername(username);
      
      if (!reader) {
        return res.status(401).json({ success: false, error: "اسم المستخدم غير موجود" });
      }
      
      if (reader.password !== password) {
        return res.status(401).json({ success: false, error: "كلمة المرور غير صحيحة" });
      }
      
      res.json({
        success: true,
        reader: {
          id: reader.id,
          username: reader.username,
          displayName: reader.displayName,
        },
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ success: false, error: "حدث خطأ في الخادم" });
    }
  });

  app.get("/api/meters/:readerId", async (req, res) => {
    try {
      const { readerId } = req.params;
      const meters = await storage.getMetersByReaderId(readerId);
      res.json(meters);
    } catch (error) {
      console.error("Error fetching meters:", error);
      res.status(500).json({ error: "Failed to fetch meters" });
    }
  });

  app.get("/api/meter/:id", async (req, res) => {
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

  app.post("/api/readings", async (req, res) => {
    try {
      const { meterId, readerId, newReading, photoPath, notes, skipReason } = req.body;

      if (!meterId || !readerId) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      if (skipReason) {
        const reading = await storage.createReading({
          meterId,
          readerId,
          newReading: null,
          photoPath: null,
          notes: null,
          skipReason,
        });
        res.status(201).json(reading);
        return;
      }

      if (newReading === undefined || newReading === null) {
        return res.status(400).json({ error: "Missing reading value" });
      }

      const reading = await storage.createReading({
        meterId,
        readerId,
        newReading: parseInt(newReading, 10),
        photoPath: photoPath || null,
        notes: notes || null,
        skipReason: null,
      });

      await storage.updateMeterAfterReading(meterId, parseInt(newReading, 10));

      res.status(201).json(reading);
    } catch (error) {
      console.error("Error creating reading:", error);
      res.status(500).json({ error: "Failed to create reading" });
    }
  });

  app.get("/api/readings/:meterId", async (req, res) => {
    try {
      const { meterId } = req.params;
      const readings = await storage.getReadingsByMeterId(meterId);
      res.json(readings);
    } catch (error) {
      console.error("Error fetching readings:", error);
      res.status(500).json({ error: "Failed to fetch readings" });
    }
  });

  app.post("/api/seed", async (req, res) => {
    try {
      let reader = await storage.getReaderByUsername("demo");
      
      if (!reader) {
        reader = await storage.createReader({
          username: "demo",
          password: "demo123",
          displayName: "قارئ تجريبي",
        });
      }

      const existingMeters = await storage.getMetersByReaderId(reader.id);
      
      if (existingMeters.length === 0) {
        const sampleMeters: Omit<InsertMeter, "readerId">[] = [
          {
            accountNumber: "1001234567",
            sequence: "001",
            meterNumber: "M-2024-001",
            category: "سكني",
            subscriberName: "أحمد محمد علي",
            record: "1",
            block: "5",
            property: "12",
            previousReading: 15420,
            previousReadingDate: new Date("2024-12-15"),
            currentAmount: "45000",
            debts: "12500",
            totalAmount: "57500",
          },
          {
            accountNumber: "1001234568",
            sequence: "002",
            meterNumber: "M-2024-002",
            category: "تجاري",
            subscriberName: "محل الرحمن للتجارة",
            record: "1",
            block: "5",
            property: "13",
            previousReading: 28750,
            previousReadingDate: new Date("2024-12-15"),
            currentAmount: "125000",
            debts: "0",
            totalAmount: "125000",
          },
          {
            accountNumber: "1001234569",
            sequence: "003",
            meterNumber: "M-2024-003",
            category: "صناعي",
            subscriberName: "مصنع النور للحديد",
            record: "1",
            block: "5",
            property: "14",
            previousReading: 45230,
            previousReadingDate: new Date("2024-12-15"),
            currentAmount: "350000",
            debts: "75000",
            totalAmount: "425000",
          },
          {
            accountNumber: "1001234570",
            sequence: "004",
            meterNumber: "M-2024-004",
            category: "سكني",
            subscriberName: "فاطمة حسين جاسم",
            record: "1",
            block: "6",
            property: "1",
            previousReading: 12100,
            previousReadingDate: new Date("2024-12-14"),
            currentAmount: "32000",
            debts: "8500",
            totalAmount: "40500",
          },
          {
            accountNumber: "1001234571",
            sequence: "005",
            meterNumber: "M-2024-005",
            category: "سكني",
            subscriberName: "علي عبد الكريم",
            record: "1",
            block: "6",
            property: "2",
            previousReading: 8750,
            previousReadingDate: new Date("2024-12-14"),
            currentAmount: "28000",
            debts: "0",
            totalAmount: "28000",
          },
          {
            accountNumber: "1001234572",
            sequence: "006",
            meterNumber: "M-2024-006",
            category: "تجاري",
            subscriberName: "مطعم الصفا",
            record: "2",
            block: "1",
            property: "1",
            previousReading: 35600,
            previousReadingDate: new Date("2024-12-13"),
            currentAmount: "95000",
            debts: "22000",
            totalAmount: "117000",
          },
        ];

        for (const meterData of sampleMeters) {
          await storage.createMeter({
            ...meterData,
            readerId: reader.id,
          });
        }
      }

      res.json({ success: true, readerId: reader.id });
    } catch (error) {
      console.error("Error seeding data:", error);
      res.status(500).json({ error: "Failed to seed data" });
    }
  });

  app.get("/api/export/:readerId", async (req, res) => {
    try {
      const { readerId } = req.params;
      const meters = await storage.getMetersByReaderId(readerId);
      const allReadings = await storage.getAllReadingsByReaderId(readerId);
      
      const exportData = {
        exportDate: new Date().toISOString(),
        readerId,
        totalMeters: meters.length,
        completedReadings: allReadings.length,
        meters: meters.map((meter) => {
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
              property: meter.property,
            },
            previousReading: meter.previousReading,
            previousReadingDate: meter.previousReadingDate,
            amounts: {
              currentAmount: meter.currentAmount,
              debts: meter.debts,
              totalAmount: meter.totalAmount,
            },
            readings: meterReadings.map((r) => ({
              newReading: r.newReading,
              photoPath: r.photoPath,
              notes: r.notes,
              skipReason: r.skipReason,
              createdAt: r.createdAt,
            })),
          };
        }),
      };
      
      res.json(exportData);
    } catch (error) {
      console.error("Error exporting data:", error);
      res.status(500).json({ error: "Failed to export data" });
    }
  });

  app.get("/api/reader/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const reader = await storage.getReader(id);
      if (!reader) {
        return res.status(404).json({ error: "Reader not found" });
      }
      const meters = await storage.getMetersByReaderId(id);
      const allReadings = await storage.getAllReadingsByReaderId(id);
      
      const completedMeters = meters.filter(m => m.latestReading !== null).length;
      
      res.json({
        id: reader.id,
        username: reader.username,
        displayName: reader.displayName,
        stats: {
          totalMeters: meters.length,
          completedMeters,
          totalReadings: allReadings.length,
        }
      });
    } catch (error) {
      console.error("Error fetching reader:", error);
      res.status(500).json({ error: "Failed to fetch reader" });
    }
  });

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/api/upload-photo", async (req, res) => {
    try {
      const { photoBase64, fileName } = req.body;

      if (!photoBase64 || !fileName) {
        return res.status(400).json({ error: "Missing photo data or filename" });
      }

      const base64Data = photoBase64.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');

      const photoPath = `${fileName}`;

      const { data, error } = await supabase.storage
        .from('photos')
        .upload(photoPath, buffer, {
          contentType: 'image/jpeg',
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

  app.get("/api/photo/:path(*)", async (req, res) => {
    try {
      const photoPath = req.params.path;

      const { data, error } = await supabase.storage
        .from('photos')
        .download(photoPath);

      if (error || !data) {
        console.error("Download error:", error);
        return res.status(404).json({ error: "Photo not found" });
      }

      const buffer = Buffer.from(await data.arrayBuffer());
      res.setHeader('Content-Type', 'image/jpeg');
      res.send(buffer);
    } catch (error) {
      console.error("Error fetching photo:", error);
      res.status(500).json({ error: "Failed to fetch photo" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
