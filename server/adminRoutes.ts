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
      
      const allReaders = await storage.getAllReaders();
      const allMeters = await storage.getAllMeters();
      
      if (type === "all" || type === "readers") {
        const readersExport = allReaders.map(r => ({
          اسم_المستخدم: r.username,
          الاسم_الكامل: r.displayName,
          تاريخ_الإنشاء: r.createdAt,
        }));
        if (type === "readers") {
          data = readersExport;
        } else {
          data.push(...readersExport.map(r => ({ ...r, _type: "reader" })));
        }
      }
      
      if (type === "all" || type === "meters") {
        let meters = allMeters;
        if (readerId && typeof readerId === "string") {
          meters = meters.filter(m => m.readerId === readerId);
        }
        const metersExport = meters.map(m => {
          const reader = allReaders.find(r => r.id === m.readerId);
          return {
            رقم_الحساب: m.accountNumber,
            التسلسل: m.sequence,
            رقم_المقياس: m.meterNumber,
            الصنف: m.category,
            اسم_المشترك: m.subscriberName,
            العنوان: m.address || '',
            السجل: m.record,
            البلوك: m.block,
            العقار: m.property,
            القراءة_السابقة: m.previousReading,
            تاريخ_القراءة_السابقة: m.previousReadingDate,
            المبلغ_الحالي: m.currentAmount,
            الديون: m.debts,
            المجموع: m.totalAmount,
            القارئ: reader?.displayName || '',
          };
        });
        if (type === "meters") {
          data = metersExport;
        } else {
          data.push(...metersExport.map(m => ({ ...m, _type: "meter" })));
        }
      }
      
      if (type === "all" || type === "readings") {
        let readings = await storage.getAllReadings();
        if (readerId && typeof readerId === "string") {
          readings = readings.filter(r => r.readerId === readerId);
        }
        const readingsExport = readings.map(r => {
          const meter = allMeters.find(m => m.id === r.meterId);
          const reader = allReaders.find(rd => rd.id === r.readerId);
          const prevReading = meter?.previousReading || 0;
          const newReading = r.newReading || 0;
          const difference = r.newReading !== null ? (newReading - prevReading) : null;
          return {
            رقم_الحساب: meter?.accountNumber || '',
            اسم_المشترك: meter?.subscriberName || '',
            رقم_المقياس: meter?.meterNumber || '',
            الصنف: meter?.category || '',
            العنوان: meter?.address || '',
            القارئ: reader?.displayName || '',
            القراءة_السابقة: meter?.previousReading || 0,
            القراءة_الجديدة: r.newReading,
            الفرق: difference,
            سبب_التخطي: r.skipReason || '',
            تاريخ_القراءة: r.readingDate,
            خط_العرض: r.latitude || '',
            خط_الطول: r.longitude || '',
            رابط_الموقع: r.latitude && r.longitude ? `https://www.google.com/maps?q=${r.latitude},${r.longitude}` : '',
            الصورة: r.photoPath ? 'متوفرة' : 'غير متوفرة',
            مسار_الصورة: r.photoPath || '',
            الملاحظات: r.notes || '',
          };
        });
        if (type === "readings") {
          data = readingsExport;
        } else {
          data.push(...readingsExport.map(r => ({ ...r, _type: "reading" })));
        }
      }
      
      res.json(data);
    } catch (error) {
      console.error("Error exporting data:", error);
      res.status(500).json({ error: "Failed to export data" });
    }
  });
}
