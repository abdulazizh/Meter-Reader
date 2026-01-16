import type { Express } from "express";
import { storage } from "./storage";
import path from "node:path";

export function registerAdminRoutes(app: Express) {
  app.get("/admin", (req, res) => {
    res.sendFile(path.join(process.cwd(), "server/templates/admin/index.html"));
  });

  app.get("/api/admin/readers", async (req, res) => {
    try {
      const readers = await storage.getAllReaders();
      const readersWithCounts = await Promise.all(
        readers.map(async (reader) => {
          const meters = await storage.getMetersByReaderId(reader.id);
          return { ...reader, meterCount: meters.length };
        })
      );
      res.json(readersWithCounts);
    } catch (error) {
      console.error("Error fetching readers:", error);
      res.status(500).json({ error: "Failed to fetch readers" });
    }
  });

  app.post("/api/admin/readers", async (req, res) => {
    try {
      const { username, password, displayName } = req.body;
      const reader = await storage.createReader({
        username,
        password,
        displayName,
      });
      res.status(201).json(reader);
    } catch (error) {
      console.error("Error creating reader:", error);
      res.status(500).json({ error: "Failed to create reader" });
    }
  });

  app.put("/api/admin/readers/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { username, password, displayName } = req.body;
      const reader = await storage.updateReader(id, {
        username,
        password: password || undefined,
        displayName,
      });
      res.json(reader);
    } catch (error) {
      console.error("Error updating reader:", error);
      res.status(500).json({ error: "Failed to update reader" });
    }
  });

  app.delete("/api/admin/readers/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteReader(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting reader:", error);
      res.status(500).json({ error: "Failed to delete reader" });
    }
  });

  app.get("/api/admin/meters", async (req, res) => {
    try {
      const meters = await storage.getAllMeters();
      res.json(meters);
    } catch (error) {
      console.error("Error fetching meters:", error);
      res.status(500).json({ error: "Failed to fetch meters" });
    }
  });

  app.post("/api/admin/meters", async (req, res) => {
    try {
      const meter = await storage.createMeter(req.body);
      res.status(201).json(meter);
    } catch (error) {
      console.error("Error creating meter:", error);
      res.status(500).json({ error: "Failed to create meter" });
    }
  });

  app.put("/api/admin/meters/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const meter = await storage.updateMeter(id, req.body);
      res.json(meter);
    } catch (error) {
      console.error("Error updating meter:", error);
      res.status(500).json({ error: "Failed to update meter" });
    }
  });

  app.delete("/api/admin/meters/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteMeter(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting meter:", error);
      res.status(500).json({ error: "Failed to delete meter" });
    }
  });

  app.get("/api/admin/readings", async (req, res) => {
    try {
      const readings = await storage.getAllReadings();
      res.json(readings);
    } catch (error) {
      console.error("Error fetching readings:", error);
      res.status(500).json({ error: "Failed to fetch readings" });
    }
  });

  app.post("/api/admin/import/:type", async (req, res) => {
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
            displayName: item.displayName || item.username,
          });
          count++;
        }
      } else if (type === "meters") {
        for (const item of data) {
          await storage.createMeter({
            accountNumber: item.accountNumber,
            sequence: item.sequence || "001",
            meterNumber: item.meterNumber,
            category: item.category || "سكني",
            subscriberName: item.subscriberName,
            record: item.record || "1",
            block: item.block || "1",
            property: item.property || "1",
            previousReading: parseInt(item.previousReading) || 0,
            previousReadingDate: item.previousReadingDate ? new Date(item.previousReadingDate) : new Date(),
            currentAmount: item.currentAmount || "0",
            debts: item.debts || "0",
            totalAmount: item.totalAmount || "0",
            readerId: item.readerId,
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

  app.get("/api/admin/export/:type", async (req, res) => {
    try {
      const { type } = req.params;
      const { readerId } = req.query;
      
      let data: unknown[] = [];
      
      if (type === "all" || type === "readers") {
        const readers = await storage.getAllReaders();
        if (type === "readers") {
          data = readers;
        } else {
          data.push(...readers.map(r => ({ ...r, _type: "reader" })));
        }
      }
      
      if (type === "all" || type === "meters") {
        let meters = await storage.getAllMeters();
        if (readerId && typeof readerId === "string") {
          meters = meters.filter(m => m.readerId === readerId);
        }
        if (type === "meters") {
          data = meters;
        } else {
          data.push(...meters.map(m => ({ ...m, _type: "meter" })));
        }
      }
      
      if (type === "all" || type === "readings") {
        let readings = await storage.getAllReadings();
        if (readerId && typeof readerId === "string") {
          readings = readings.filter(r => r.readerId === readerId);
        }
        if (type === "readings") {
          data = readings;
        } else {
          data.push(...readings.map(r => ({ ...r, _type: "reading" })));
        }
      }
      
      res.json(data);
    } catch (error) {
      console.error("Error exporting data:", error);
      res.status(500).json({ error: "Failed to export data" });
    }
  });
}
