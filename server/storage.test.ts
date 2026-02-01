
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DatabaseStorage } from './storage';
import { db } from './db';
import * as schema from '@shared/schema';

// Mock the db object
vi.mock('./db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('DatabaseStorage', () => {
  let storage: DatabaseStorage;

  beforeEach(() => {
    storage = new DatabaseStorage();
    vi.clearAllMocks();
  });

  describe('getReader', () => {
    it('should return a reader if found', async () => {
      const mockReader = { id: 'reader-1', username: 'testuser' };
      
      // Mock drizzle chain: db.select().from().where()
      const mockWhere = vi.fn().mockResolvedValue([mockReader]);
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      (db.select as any).mockReturnValue({ from: mockFrom });

      const result = await storage.getReader('reader-1');
      expect(result).toEqual(mockReader);
      expect(db.select).toHaveBeenCalled();
    });

    it('should return undefined if reader not found', async () => {
      const mockWhere = vi.fn().mockResolvedValue([]);
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      (db.select as any).mockReturnValue({ from: mockFrom });

      const result = await storage.getReader('unknown');
      expect(result).toBeUndefined();
    });
  });

  describe('createReader', () => {
    it('should insert and return a new reader', async () => {
      const mockReader = { id: 'reader-2', username: 'newuser' };
      const insertData = { username: 'newuser', password: 'password', displayName: 'New User' };

      const mockReturning = vi.fn().mockResolvedValue([mockReader]);
      const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
      (db.insert as any).mockReturnValue({ values: mockValues });

      const result = await storage.createReader(insertData as any);
      expect(result).toEqual(mockReader);
      expect(db.insert).toHaveBeenCalledWith(schema.readers);
    });
  });
});
