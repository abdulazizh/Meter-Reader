import type { Express, Request, Response, NextFunction } from "express";
import multer from "multer";
import { storage } from "./storage";
import path from "node:path";
import * as XLSX from "xlsx";
import type { InsertMeter } from "@shared/schema";

// Multer configuration for file uploads
const upload = multer({ dest: 'uploads/' });

const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "admin123";

declare module 'express-session' {
  interface SessionData {
    isAdmin?: boolean;
  }
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.session?.isAdmin) {
    return next();
  }
  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ error: "غير مصرح - يرجى تسجيل الدخول" });
  }
  return res.redirect('/admin/login');
}

export function registerAdminRoutes(app: Express) {
  app.get("/admin/login", (req, res) => {
    res.sendFile(path.join(process.cwd(), "server/templates/admin/login.html"));
  });

  app.post("/api/admin/login", (req, res) => {
    const { username, password } = req.body;
    
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      req.session.isAdmin = true;
      return res.json({ success: true });
    }
    
    return res.status(401).json({ success: false, error: "اسم المستخدم أو كلمة المرور غير صحيحة" });
  });

  app.post("/api/admin/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: "فشل تسجيل الخروج" });
      }
      res.json({ success: true });
    });
  });

  app.get("/admin", requireAdmin, (req, res) => {
    res.sendFile(path.join(process.cwd(), "server/templates/admin/index.html"));
  });

  app.get("/api/admin/readers", requireAdmin, async (req, res) => {
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

  app.post("/api/admin/readers", requireAdmin, async (req, res) => {
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

  app.put("/api/admin/readers/:id", requireAdmin, async (req, res) => {
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

  app.delete("/api/admin/readers/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteReader(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting reader:", error);
      res.status(500).json({ error: "Failed to delete reader" });
    }
  });

  app.get("/api/admin/meters", requireAdmin, async (req, res) => {
    try {
      const meters = await storage.getAllMeters();
      res.json(meters);
    } catch (error) {
      console.error("Error fetching meters:", error);
      res.status(500).json({ error: "Failed to fetch meters" });
    }
  });

  app.post("/api/admin/meters", requireAdmin, async (req, res) => {
    try {
      // Transform the request body to handle date conversion and default values
      const meterData = { ...req.body };
      
      // Handle date conversion
      if (meterData.previousReadingDate === "") {
        meterData.previousReadingDate = new Date();
      } else if (typeof meterData.previousReadingDate === 'string') {
        meterData.previousReadingDate = new Date(meterData.previousReadingDate);
      }
      
      // Set default address if not provided
      if (meterData.address === undefined) {
        meterData.address = "";
      }
      
      const meter = await storage.createMeter(meterData);
      res.status(201).json(meter);
    } catch (error) {
      console.error("Error creating meter:", error);
      res.status(500).json({ error: "Failed to create meter" });
    }
  });

  app.put("/api/admin/meters/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const updateData: Partial<InsertMeter> = {};
      
      // Copy all fields from req.body, converting types as needed
      Object.entries(req.body).forEach(([key, value]) => {
        switch(key) {
          case 'address':
            (updateData as any)[key] = value || "";
            break;
          case 'previousReadingDate':
            if (value === "") {
              (updateData as any)[key] = undefined;
            } else if (typeof value === 'string') {
              (updateData as any)[key] = new Date(value);
            } else {
              (updateData as any)[key] = value;
            }
            break;
          default:
            (updateData as any)[key] = value;
        }
      });
      const meter = await storage.updateMeter(id, updateData);
      res.json(meter);
    } catch (error) {
      console.error("Error updating meter:", error);
      res.status(500).json({ error: "Failed to update meter" });
    }
  });

  app.delete("/api/admin/meters/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteMeter(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting meter:", error);
      res.status(500).json({ error: "Failed to delete meter" });
    }
  });

  app.delete("/api/admin/meters-all", requireAdmin, async (req, res) => {
    try {
      await storage.deleteAllMeters();
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting all meters:", error);
      res.status(500).json({ error: "Failed to delete all meters" });
    }
  });

  // Bulk assign meters to a reader
  app.post("/api/admin/meters/bulk-assign", requireAdmin, async (req, res) => {
    try {
      const { readerId, filterType, filterValue, filterValueEnd } = req.body;
      
      if (!readerId) {
        return res.status(400).json({ error: "Reader ID is required" });
      }
      
      const allMeters = await storage.getAllMeters();
      let metersToUpdate: string[] = [];
      
      if (filterType === "accountRange") {
        // Filter by account number range
        const startNum = parseInt(filterValue) || 0;
        const endNum = parseInt(filterValueEnd) || startNum;
        metersToUpdate = allMeters
          .filter(m => {
            const accNum = parseInt(m.accountNumber);
            return !isNaN(accNum) && accNum >= startNum && accNum <= endNum;
          })
          .map(m => m.id);
      } else if (filterType === "block") {
        // Filter by block
        metersToUpdate = allMeters
          .filter(m => m.block === filterValue)
          .map(m => m.id);
      } else if (filterType === "record") {
        // Filter by record
        metersToUpdate = allMeters
          .filter(m => m.record === filterValue)
          .map(m => m.id);
      } else if (filterType === "category") {
        // Filter by category
        metersToUpdate = allMeters
          .filter(m => m.category === filterValue)
          .map(m => m.id);
      } else if (filterType === "selected") {
        // Direct list of meter IDs
        metersToUpdate = filterValue || [];
      }
      
      // Update each meter
      let updatedCount = 0;
      for (const meterId of metersToUpdate) {
        await storage.updateMeter(meterId, { readerId });
        updatedCount++;
      }
      
      res.json({ success: true, count: updatedCount });
    } catch (error) {
      console.error("Error bulk assigning meters:", error);
      res.status(500).json({ error: "Failed to bulk assign meters" });
    }
  });

  app.get("/api/admin/readings", requireAdmin, async (req, res) => {
    try {
      const { year, month } = req.query;
      let readings;
      if (year && month) {
        readings = await storage.getReadingsByMonth(parseInt(year as string), parseInt(month as string));
      } else {
        readings = await storage.getAllReadings();
      }
      res.json(readings);
    } catch (error) {
      console.error("Error fetching readings:", error);
      res.status(500).json({ error: "Failed to fetch readings" });
    }
  });

  app.get("/api/admin/readings/:id", requireAdmin, async (req, res) => {
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

  app.put("/api/admin/readings/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { newReading, notes, skipReason } = req.body;
      const reading = await storage.updateReading(id, {
        newReading: newReading !== undefined ? parseInt(newReading) : undefined,
        notes,
        skipReason,
      });
      res.json(reading);
    } catch (error) {
      console.error("Error updating reading:", error);
      res.status(500).json({ error: "Failed to update reading" });
    }
  });

  app.delete("/api/admin/readings/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteReading(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting reading:", error);
      res.status(500).json({ error: "Failed to delete reading" });
    }
  });

  app.post("/api/admin/import/:type", requireAdmin, async (req, res) => {
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
  
  // New endpoint for Excel file import
  app.post("/api/admin/import-excel/:type", upload.single('file'), requireAdmin, async (req, res) => {
    try {
      const { type } = req.params;
      
      if (!req.file) {
        return res.status(400).json({ error: "File is required" });
      }
      
      // Check if file is Excel
      const allowedTypes = [
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/octet-stream'
      ];
      
      if (!allowedTypes.some(allowedType => req.file!.mimetype?.includes(allowedType.split('/')[1]))) {
        return res.status(400).json({ error: "Invalid file type. Only Excel files (.xls, .xlsx) are supported" });
      }
      
      // Parse Excel file
      const workbook = XLSX.readFile(req.file.path);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet);
      
      if (!Array.isArray(jsonData)) {
        return res.status(400).json({ error: "Data must be in tabular format" });
      }
      
      // Process the data based on type
      let count = 0;
      if (type === "readers") {
        for (const item of jsonData) {
          await storage.createReader({
            username: item['اسم المستخدم'] || item['username'],
            password: item['كلمة المرور'] || item['password'] || "123456",
            displayName: item['الاسم الظاهر'] || item['displayName'] || item['username'] || item['اسم المستخدم'] || '',
          });
          count++;
        }
      } else if (type === "meters") {
        for (const item of jsonData) {
          await storage.createMeter({
            accountNumber: item['رقم الحساب'] || item['accountNumber'],
            sequence: item['تسلسل'] || item['sequence'] || "001",
            meterNumber: item['رقم المقياس'] || item['meterNumber'],
            category: item['الصنف'] || item['category'] || "سكني",
            subscriberName: item['اسم المشترك'] || item['subscriberName'],
            record: item['السجل'] || item['record'] || "1",
            block: item['البلوك'] || item['block'] || "1",
            property: item['العقار'] || item['property'] || "1",
            previousReading: parseInt(item['القراءة السابقة'] || item['previousReading']) || 0,
            previousReadingDate: item['تاريخ القراءة السابقة'] || item['previousReadingDate'] ? new Date(item['تاريخ القراءة السابقة'] || item['previousReadingDate']) : new Date(),
            currentAmount: item['المبلغ الحالي'] || item['currentAmount'] || "0",
            debts: item['الديون'] || item['debts'] || "0",
            totalAmount: item['المجموع'] || item['totalAmount'] || "0",
            readerId: item['معرف القارئ'] || item['readerId'],
          });
          count++;
        }
      }
      
      res.json({ success: true, count });
    } catch (error) {
      console.error("Error importing Excel data:", error);
      res.status(500).json({ error: "Failed to import Excel data" });
    }
  });

  // Endpoint to download Excel templates
  app.get("/api/admin/template/:type", requireAdmin, async (req, res) => {
    try {
      const { type } = req.params;
      
      // Define sample data based on type
      let templateData: any[] = [];
      let fileName = '';
      
      if (type === "readers") {
        templateData = [
          { 'اسم المستخدم': 'reader1', 'كلمة المرور': 'password123', 'الاسم الظاهر': 'قارئ أول' },
          { 'اسم المستخدم': 'reader2', 'كلمة المرور': 'password123', 'الاسم الظاهر': 'قارئ ثاني' },
        ];
        fileName = 'template_readers.xlsx';
      } else if (type === "meters") {
        templateData = [
          { 
            'رقم الحساب': '1001', 
            'تسلسل': '001', 
            'رقم المقياس': 'MTR-001', 
            'الصنف': 'سكني', 
            'اسم المشترك': 'محمد أحمد', 
            'السجل': '1', 
            'البلوك': 'A', 
            'العقار': '1', 
            'القراءة السابقة': 1000, 
            'تاريخ القراءة السابقة': '2024-01-01', 
            'المبلغ الحالي': '50000', 
            'الديون': '0', 
            'المجموع': '50000', 
            'معرف القارئ': 'reader-id-123' 
          },
        ];
        fileName = 'template_meters.xlsx';
      } else {
        return res.status(400).json({ error: "Invalid template type. Use 'readers' or 'meters'" });
      }
      
      // Create Excel workbook
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(templateData);
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Template');
      
      // Generate buffer
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      
      // Send as attachment
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
      res.send(buffer);
    } catch (error) {
      console.error("Error generating template:", error);
      res.status(500).json({ error: "Failed to generate template" });
    }
  });

app.get("/api/admin/export/:type", requireAdmin, async (req, res) => {
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

  app.get("/api/admin/export-excel/:type", requireAdmin, async (req, res) => {
    try {
      const { type } = req.params;
      const { readerId } = req.query;
      
      const allReaders = await storage.getAllReaders();
      const allMeters = await storage.getAllMeters();
      
      const workbook = XLSX.utils.book_new();
      
      if (type === "all" || type === "readers") {
        const readersData = allReaders.map(r => ({
          'اسم المستخدم': r.username,
          'الاسم الكامل': r.displayName,
          'تاريخ الإنشاء': r.createdAt ? new Date(r.createdAt).toLocaleDateString('ar-IQ') : '',
        }));
        const readersSheet = XLSX.utils.json_to_sheet(readersData);
        XLSX.utils.book_append_sheet(workbook, readersSheet, 'القراء');
      }
      
      if (type === "all" || type === "meters") {
        let meters = allMeters;
        if (readerId && typeof readerId === "string") {
          meters = meters.filter(m => m.readerId === readerId);
        }
        const metersData = meters.map(m => {
          const reader = allReaders.find(r => r.id === m.readerId);
          return {
            'رقم الحساب': m.accountNumber,
            'التسلسل': m.sequence,
            'رقم المقياس': m.meterNumber,
            'الصنف': m.category,
            'اسم المشترك': m.subscriberName,
            'العنوان': m.address || '',
            'السجل': m.record,
            'البلوك': m.block,
            'العقار': m.property,
            'القراءة السابقة': m.previousReading,
            'تاريخ القراءة السابقة': m.previousReadingDate ? new Date(m.previousReadingDate).toLocaleDateString('ar-IQ') : '',
            'المبلغ الحالي': parseFloat(m.currentAmount as string || '0'),
            'الديون': parseFloat(m.debts as string || '0'),
            'المجموع': parseFloat(m.totalAmount as string || '0'),
            'القارئ': reader?.displayName || '',
          };
        });
        const metersSheet = XLSX.utils.json_to_sheet(metersData);
        XLSX.utils.book_append_sheet(workbook, metersSheet, 'المشتركين');
      }
      
      if (type === "all" || type === "readings") {
        let readings = await storage.getAllReadings();
        if (readerId && typeof readerId === "string") {
          readings = readings.filter(r => r.readerId === readerId);
        }
        const readingsData = readings.map(r => {
          const meter = allMeters.find(m => m.id === r.meterId);
          const reader = allReaders.find(rd => rd.id === r.readerId);
          const prevReading = meter?.previousReading || 0;
          const newReading = r.newReading || 0;
          const difference = r.newReading !== null ? (newReading - prevReading) : null;
          return {
            'رقم الحساب': meter?.accountNumber || '',
            'اسم المشترك': meter?.subscriberName || '',
            'رقم المقياس': meter?.meterNumber || '',
            'الصنف': meter?.category || '',
            'العنوان': meter?.address || '',
            'القارئ': reader?.displayName || '',
            'القراءة السابقة': meter?.previousReading || 0,
            'القراءة الجديدة': r.newReading,
            'الفرق': difference,
            'سبب التخطي': r.skipReason || '',
            'تاريخ القراءة': r.readingDate ? new Date(r.readingDate).toLocaleDateString('ar-IQ') + ' ' + new Date(r.readingDate).toLocaleTimeString('ar-IQ') : '',
            'خط العرض': r.latitude ? parseFloat(r.latitude) : '',
            'خط الطول': r.longitude ? parseFloat(r.longitude) : '',
            'رابط الموقع': r.latitude && r.longitude ? `https://www.google.com/maps?q=${r.latitude},${r.longitude}` : '',
            'الصورة': r.photoPath ? 'متوفرة' : 'غير متوفرة',
            'مسار الصورة': r.photoPath || '',
            'الملاحظات': r.notes || '',
          };
        });
        const readingsSheet = XLSX.utils.json_to_sheet(readingsData);
        XLSX.utils.book_append_sheet(workbook, readingsSheet, 'القراءات');
      }
      
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=export_${type}_${Date.now()}.xlsx`);
      res.send(buffer);
    } catch (error) {
      console.error("Error exporting Excel:", error);
      res.status(500).json({ error: "Failed to export Excel" });
    }
  });
}
