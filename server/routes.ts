import type { Express } from "express";
import { createServer, type Server } from "node:http";
import { storage } from "./storage";
import type { InsertMeter } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
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
      const { meterId, readerId, newReading, photoPath, notes } = req.body;

      if (!meterId || !readerId || newReading === undefined) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const reading = await storage.createReading({
        meterId,
        readerId,
        newReading: parseInt(newReading, 10),
        photoPath: photoPath || null,
        notes: notes || null,
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
            sequence: "سجل 1 / بلوك 5 / عقار 12",
            meterNumber: "M-2024-001",
            category: "سكني",
            previousReading: 15420,
            previousReadingDate: new Date("2024-12-15"),
          },
          {
            accountNumber: "1001234568",
            sequence: "سجل 1 / بلوك 5 / عقار 13",
            meterNumber: "M-2024-002",
            category: "تجاري",
            previousReading: 28750,
            previousReadingDate: new Date("2024-12-15"),
          },
          {
            accountNumber: "1001234569",
            sequence: "سجل 1 / بلوك 5 / عقار 14",
            meterNumber: "M-2024-003",
            category: "صناعي",
            previousReading: 45230,
            previousReadingDate: new Date("2024-12-15"),
          },
          {
            accountNumber: "1001234570",
            sequence: "سجل 1 / بلوك 6 / عقار 1",
            meterNumber: "M-2024-004",
            category: "سكني",
            previousReading: 12100,
            previousReadingDate: new Date("2024-12-14"),
          },
          {
            accountNumber: "1001234571",
            sequence: "سجل 1 / بلوك 6 / عقار 2",
            meterNumber: "M-2024-005",
            category: "سكني",
            previousReading: 8750,
            previousReadingDate: new Date("2024-12-14"),
          },
          {
            accountNumber: "1001234572",
            sequence: "سجل 2 / بلوك 1 / عقار 1",
            meterNumber: "M-2024-006",
            category: "تجاري",
            previousReading: 35600,
            previousReadingDate: new Date("2024-12-13"),
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

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  const httpServer = createServer(app);

  return httpServer;
}
